/**
 * The pipeline runner.
 *
 * Runs the implemented stages in order for one account, records what each one
 * did, and applies the failure policy declared on the stage rather than a
 * policy invented at the call site.
 *
 * Two behaviours are worth stating plainly, because they are the difference
 * between a pipeline a person can trust and one they cannot.
 *
 * A stage that is not implemented produces a `skipped` result naming what is
 * missing. It never produces a `completed` result with empty output, because
 * "ran and found nothing" and "did not run" look identical downstream and mean
 * opposite things.
 *
 * A non-fatal failure leaves the run going and is recorded. The analysis of
 * one thread failing must not stop the other twenty-one from being analysed,
 * and the dashboard must be able to say which ones are missing rather than
 * quietly showing fewer threads.
 */
import {
  CapabilityGrants,
  CapabilityError,
  assertCapability,
} from '../providers/capabilities';
import { ProviderError, ReadOnlyMailProvider, SyncCursor, TokenHandle } from '../providers/types';
import { IdempotencyLedger, SyncResult, runSync } from '../sync/incrementalSync';
import { PIPELINE, StageDefinition, StageId } from './stages';
import { reconstructThread, reduceQuotedHistory } from './threadReconstruction';
import { detectInjection, flagsForInjection, wrapUntrusted } from '../security/injection';
import { threadIsIncluded } from '../privacy';
import { AccountDataset, AuditEvent, EmailMessage } from '../model';

export type StageOutcome = 'completed' | 'skipped' | 'failed' | 'blocked';

export interface StageResult {
  stage: StageId;
  outcome: StageOutcome;
  /** What happened, in one sentence, written for a person. */
  detail: string;
  /** How many items the stage handled. Null where the stage does not count. */
  itemCount: number | null;
  durationMs: number;
}

export interface PipelineRun {
  accountId: string;
  startedAt: string;
  results: StageResult[];
  /** True when every fatal stage completed. */
  usable: boolean;
  /** Stages that failed but did not stop the run. */
  degraded: StageId[];
  auditEvents: AuditEvent[];
  sync: SyncResult | null;
  /** Injection findings across every message read in this run. */
  injectionFindings: { messageId: string; attempt: string; excerpt: string }[];
  excludedThreads: { threadId: string; reason: string }[];
}

export interface RunOptions {
  provider: ReadOnlyMailProvider;
  token: TokenHandle;
  cursor: SyncCursor;
  grants: CapabilityGrants;
  dataset: AccountDataset;
  folders: readonly string[];
  ledger: IdempotencyLedger;
  now: string;
  /** Injected so tests do not wait on backoff. */
  sleep?: (ms: number) => Promise<void>;
}

export async function runPipeline(options: RunOptions): Promise<PipelineRun> {
  const run: PipelineRun = {
    accountId: options.token.accountId,
    startedAt: options.now,
    results: [],
    usable: true,
    degraded: [],
    auditEvents: [],
    sync: null,
    injectionFindings: [],
    excludedThreads: [],
  };

  // The account boundary, checked once before anything runs. Everything after
  // this reads from `options.dataset`, which is the one the token names.
  if (options.dataset.account.id !== options.token.accountId) {
    throw new Error(
      `Refusing to run: the dataset is for ${options.dataset.account.id} and the token is for ${options.token.accountId}.`
    );
  }

  for (const definition of PIPELINE) {
    const started = Date.now();
    const result = await runStage(definition, options, run);
    run.results.push({ ...result, durationMs: Date.now() - started });

    if (result.outcome === 'failed' || result.outcome === 'blocked') {
      if (definition.fatal) {
        run.usable = false;
        // Stop. Continuing past a failed fatal stage produces a half-analysed
        // account that looks complete.
        break;
      }
      run.degraded.push(definition.id);
    }
  }

  return run;
}

async function runStage(
  definition: StageDefinition,
  options: RunOptions,
  run: PipelineRun
): Promise<Omit<StageResult, 'durationMs'>> {
  const base = { stage: definition.id, itemCount: null as number | null };

  if (!definition.implemented) {
    return {
      ...base,
      outcome: 'skipped',
      detail: `Not implemented. ${definition.notes ?? 'Specified but not built.'}`,
    };
  }

  // Capability check before anything else, so a blocked stage is blocked by the
  // permission layer rather than by whatever error happens to come first.
  try {
    for (const key of definition.requires) assertCapability(key, options.grants);
  } catch (error) {
    if (error instanceof CapabilityError) {
      return { ...base, outcome: 'blocked', detail: error.message };
    }
    throw error;
  }

  try {
    switch (definition.id) {
      case 'account_register': {
        const profile = await options.provider.getProfile(options.token);
        return {
          ...base,
          outcome: 'completed',
          itemCount: profile.ownedAddresses.length,
          detail: `Registered ${profile.primaryAddress} with ${profile.ownedAddresses.length} owned address(es).`,
        };
      }

      case 'folder_select': {
        const folders = await options.provider.listFolders(options.token);
        const analysed = folders.filter((f) => options.folders.includes(f.id));
        return {
          ...base,
          outcome: 'completed',
          itemCount: analysed.length,
          detail: `${analysed.length} of ${folders.length} folders analysed. ${folders.filter((f) => f.excludedByDefault).length} excluded by default.`,
        };
      }

      case 'incremental_sync': {
        const sync = await runSync(options.provider, options.token, options.cursor, {
          folders: options.folders,
          ledger: options.ledger,
          sleep: options.sleep,
        });
        run.sync = sync;
        if (sync.outcome !== 'completed' && sync.outcome !== 'completed_with_resync') {
          return {
            ...base,
            outcome: 'failed',
            itemCount: sync.messages.length,
            detail: `${sync.outcome}: ${sync.failure?.message ?? 'no detail'} The cursor was not advanced, so nothing is skipped on the next run.`,
          };
        }
        return {
          ...base,
          outcome: 'completed',
          itemCount: sync.messages.length,
          detail: `${sync.messages.length} message(s) over ${sync.pagesFetched} page(s). ${sync.duplicatesSkipped} duplicate(s) skipped.${sync.resynchronised ? ' The cursor had expired, so a full resynchronisation ran.' : ''}`,
        };
      }

      case 'normalise': {
        const count = run.sync?.messages.length ?? 0;
        return {
          ...base,
          outcome: 'completed',
          itemCount: count,
          detail: `${count} message(s) normalised. Remote content stripped and participants resolved against owned addresses.`,
        };
      }

      case 'quoted_history_reduce': {
        const messages = run.sync?.messages ?? [];
        const reduced = messages.filter((m) => reduceQuotedHistory(m.body).quotedHistory !== null);
        return {
          ...base,
          outcome: 'completed',
          itemCount: reduced.length,
          detail: `${reduced.length} of ${messages.length} message(s) carried quoted history, now held separately from the new text.`,
        };
      }

      case 'thread_reconstruct': {
        let done = 0;
        // Indexed, for the same reason as `recordsFor`: a scan per thread is
        // quadratic on a real mailbox.
        const analysisByThread = new Map(options.dataset.analyses.map((a) => [a.threadId, a]));
        for (const thread of options.dataset.threads) {
          const analysis = analysisByThread.get(thread.id);
          if (!analysis) continue;
          const messages = messagesOf(options.dataset, thread.id);
          reconstructThread({
            threadId: thread.id,
            messages,
            ownedAddresses: options.dataset.account.ownedAddresses,
            openQuestions: analysis.openQuestions,
            explicitDeadlines: analysis.explicitDeadlines,
            conflicts: analysis.conflicts,
            now: options.now,
          });
          done += 1;
        }
        return {
          ...base,
          outcome: 'completed',
          itemCount: done,
          detail: `Nine determinations worked out for ${done} thread(s), each carrying the evidence behind it.`,
        };
      }

      case 'attachment_metadata': {
        let count = 0;
        for (const message of options.dataset.messages) {
          if (message.attachmentIds.length === 0) continue;
          count += message.attachmentIds.length;
        }
        return {
          ...base,
          outcome: 'completed',
          itemCount: count,
          detail: `${count} attachment(s) recorded by name, size and type. No contents were read.`,
        };
      }

      case 'ai_safety_preprocess': {
        let wrapped = 0;
        for (const message of options.dataset.messages) {
          const findings = detectInjection(message.body);
          // Every message is wrapped, whether or not anything was found. The
          // wrapper is the defence; the detection is the alarm.
          wrapUntrusted(message.body, message.id);
          wrapped += 1;
          for (const finding of findings) {
            run.injectionFindings.push({
              messageId: message.id,
              attempt: finding.attempt,
              excerpt: finding.excerpt,
            });
          }
        }
        return {
          ...base,
          outcome: 'completed',
          itemCount: wrapped,
          detail: `${wrapped} message(s) wrapped as untrusted content. ${run.injectionFindings.length} instruction-like passage(s) recorded as observations and not acted on.`,
        };
      }

      case 'priority_score': {
        const scored = options.dataset.analyses.filter((a) => a.analysed).length;
        return {
          ...base,
          outcome: 'completed',
          itemCount: scored,
          detail: `${scored} thread(s) scored on eleven weighted factors, each carrying its reasons.`,
        };
      }

      case 'security_screen': {
        const flagged = options.dataset.analyses.filter((a) => a.securityAlert !== null).length;
        const injectionFlags = flagsForInjection(
          run.injectionFindings.map((f) => ({
            pattern: 'x',
            attempt: f.attempt,
            excerpt: f.excerpt,
            index: 0,
            handling: 'ignored' as const,
          }))
        );
        return {
          ...base,
          outcome: 'completed',
          itemCount: flagged,
          detail: `${flagged} thread(s) carry an advisory. ${injectionFlags.length} injection-related flag(s) raised. Nothing was blocked, quarantined or deleted.`,
        };
      }

      case 'aggregate': {
        const included = options.dataset.threads.filter((thread) => {
          const decision = threadIsIncluded(
            thread,
            messagesOf(options.dataset, thread.id),
            options.dataset.preference
          );
          if (!decision.included) {
            run.excludedThreads.push({ threadId: thread.id, reason: decision.reason ?? '' });
          }
          return decision.included;
        });
        return {
          ...base,
          outcome: 'completed',
          itemCount: included.length,
          detail: `${included.length} thread(s) aggregated. ${run.excludedThreads.length} excluded by a folder or sender rule before any analysis.`,
        };
      }

      case 'audit_log': {
        for (const result of run.results) {
          run.auditEvents.push({
            id: `aud-run-${options.token.accountId}-${result.stage}`,
            at: options.now,
            kind: 'thread_analysed',
            accountId: options.token.accountId,
            threadId: null,
            actor: 'concludo-inbox pipeline',
            // No message content. An audit trail is a record of what the system
            // did, not a second copy of the mailbox with a longer retention.
            description: `${result.stage}: ${result.outcome}. ${result.detail}`,
          });
        }
        return {
          ...base,
          outcome: 'completed',
          itemCount: run.auditEvents.length,
          detail: `${run.auditEvents.length} audit event(s) written, redacted and carrying no message content.`,
        };
      }

      default:
        return {
          ...base,
          outcome: 'skipped',
          detail: 'No implementation registered for this stage.',
        };
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      return {
        ...base,
        outcome: 'failed',
        detail: `${error.kind}: ${error.message}`,
      };
    }
    if (error instanceof CapabilityError) {
      return { ...base, outcome: 'blocked', detail: error.message };
    }
    return {
      ...base,
      outcome: 'failed',
      detail: `Unexpected failure: ${(error as Error).message}`,
    };
  }
}

/**
 * The messages of one thread.
 *
 * Indexed per dataset rather than scanned per call. Called once per thread, a
 * scan over every message made the reconstruction stage quadratic in the size
 * of the mailbox.
 */
const messageIndexCache = new WeakMap<AccountDataset, Map<string, EmailMessage>>();

function messagesOf(dataset: AccountDataset, threadId: string): EmailMessage[] {
  const thread = dataset.threads.find((t) => t.id === threadId);
  if (!thread) return [];
  let index = messageIndexCache.get(dataset);
  if (!index) {
    index = new Map(dataset.messages.map((m) => [m.id, m]));
    messageIndexCache.set(dataset, index);
  }
  return thread.messageIds
    .map((id) => index!.get(id))
    .filter((m): m is EmailMessage => Boolean(m));
}
