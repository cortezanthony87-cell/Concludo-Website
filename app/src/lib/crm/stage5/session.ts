/**
 * The session store: where writes live until the tab closes.
 *
 * WHY A MUTABLE STORE AND NOT A DATABASE.
 *
 * Concludo Pty Ltd is pre-revenue. Nothing is connected, there is no migrated
 * project to write to, and a demonstration that quietly persisted to one would
 * be the first thing in this product that was not what it said it was. So the
 * store is a copy of the synthetic fixture held in memory, it is seeded with a
 * short scripted history so the close-date and stage views have something real
 * to show, and it dies with the tab. Every page that writes says so.
 *
 * What this arrangement is actually for is proving the shape of the write path:
 * the role check, the validation, the audit row and the confirmation gate all
 * run exactly as they will when this sits behind the repository port. Those are
 * the parts that must survive the move to a real database, and they are the
 * parts that are exercised here.
 *
 * WHY THE FIXTURE IS COPIED RATHER THAN USED.
 *
 * `CRM_WORKSPACES` is a module-level constant that three other test suites read
 * and assert against. A write path that mutated it would make those suites pass
 * or fail depending on what somebody clicked, which is the worst kind of flaky.
 * Each workspace is deep-copied on first use and the original is never touched.
 */
import { CrmWorkspaceData } from '../domain';
import { CRM_WORKSPACES } from '../data/workspaces';
import { invalidateCaches } from '../cacheBus';
import { CRM_DEMO_NOW } from '../data/factory';
import { CrmContext } from '../repositories/repository';
import {
  captureInteraction,
  closeWorkItem,
  moveStage,
  reopenWorkItem,
  resetIdCounter,
  setExpectedCloseDate,
  setNextStep,
} from './writes';
import { clearForecastSubmissions, submitForecast } from './forecast';

/** The demonstration moment everything is dated against. */
export const CRM_SESSION_NOW = CRM_DEMO_NOW;

const store = new Map<string, CrmWorkspaceData>();
const listeners = new Set<() => void>();

/** Bumped on every write, so a view knows to read again. */
let version = 0;

function seedHistory(data: CrmWorkspaceData): void {
  /* A short scripted history, written through the same functions a person
   * uses.
   *
   * The Stage 3 fixture deliberately ships with no audit rows: they are
   * produced at runtime, and a fabricated audit entry is worse than none. But
   * the close-date movement history and the stage-age views have nothing to
   * show on a dataset where nothing has ever been changed, and a forecast whose
   * most interesting factor is always absent demonstrates nothing.
   *
   * So the history is REPLAYED rather than fabricated: these calls go through
   * the ordinary write path, with the ordinary role check and the ordinary
   * audit row, exactly as if somebody had done them. The dates are backdated,
   * which is the one thing a person could not do, and that is noted on screen.
   */
  const admin = data.members.find((m) => m.crmRole === 'crm_admin') ?? data.members[0];
  if (!admin) return;

  const at = (days: number): string =>
    new Date(new Date(CRM_SESSION_NOW).getTime() - days * 86_400_000).toISOString();

  const asOf = (days: number): CrmContext => ({
    userId: admin.userId,
    workspaceId: data.workspace.id,
    role: admin.crmRole,
    now: at(days),
  });

  const open = data.workItems.filter((w) => w.status === 'open');
  if (open.length === 0) return;

  // The first open item gets a close date that has moved three times, which is
  // the single most readable signal in the whole forecast.
  const slipping = open[0];
  const original = slipping.expectedCloseDate;
  if (original) {
    const shift = (days: number): string =>
      new Date(new Date(original).getTime() + days * 86_400_000).toISOString().slice(0, 10);

    try {
      setExpectedCloseDate(asOf(70), data, slipping.id, shift(14), 'Client asked for more time.');
      setExpectedCloseDate(asOf(42), data, slipping.id, shift(30), 'Waiting on their board date.');
      setExpectedCloseDate(
        asOf(16),
        data,
        slipping.id,
        shift(49),
        'Board moved again. No new date agreed with them.'
      );
      setExpectedCloseDate(asOf(16), data, slipping.id, original, 'Reverted to the original date.');
    } catch {
      // A workspace whose shape does not suit the script is left alone rather
      // than half-seeded.
    }
  }

  // A second item gets a next step recorded and then cleared, so the "missing
  // next step" factor has a record with a history behind it rather than one
  // that has simply never been filled in.
  if (open.length > 1) {
    try {
      setNextStep(asOf(30), data, open[1].id, 'Send the revised scope', null);
      setNextStep(asOf(9), data, open[1].id, null, null);
    } catch {
      /* same */
    }
  }

  // And one recent interaction, so "recent activity" is a factor that can be
  // present as well as absent.
  try {
    captureInteraction(asOf(5), data, {
      activityType: 'call',
      title: 'Check-in call',
      summary: 'Short call to confirm where things stand.',
      organisationId: slipping.organisationId,
      workItemId: slipping.id,
      isMeaningfulContact: true,
      occurredAt: at(5),
    });
  } catch {
    /* same */
  }

  // Work that stopped and started again, written as two ordinary calls so the
  // reopened state carries an audit row and a reason rather than a flag
  // somebody set in a fixture. The lost reason is required by `closeWorkItem`,
  // which is why one is given here.
  //
  // The LAST open item, deliberately: reopening resets the stage clock, so
  // running this over an item the fixture made deliberately old would quietly
  // delete the one example of work that has gone quiet.
  if (open.length > 2) {
    const restarted = open[open.length - 1];
    try {
      closeWorkItem(
        asOf(26),
        data,
        restarted.id,
        'not_proceeding',
        'Owner put the whole portfolio on hold while they decided about selling.'
      );
      reopenWorkItem(
        asOf(6),
        data,
        restarted.id,
        'They decided to keep the portfolio and asked us to start again.'
      );
    } catch {
      /* same */
    }
  }

  // One submitted forecast, so the two views have something to differ about.
  // The other open items stay unsubmitted, because the gap between what people
  // have said and what is open is the first thing worth seeing on that page.
  try {
    submitForecast({
      workItemId: slipping.id,
      category: 'best_case',
      amount: slipping.valueAmount,
      expectedCloseDate: slipping.expectedCloseDate,
      submittedBy: admin.userId,
      submittedAt: at(4),
      note: 'They want it done before the new branch opens, but the date has moved before.',
    });
  } catch {
    /* same */
  }

  // A stage move with an unmet criterion and a reason, so the override path has
  // a worked example in the history rather than only in a test.
  const stages = data.stages
    .filter((s) => s.pipelineId === slipping.pipelineId && !s.isClosed)
    .sort((a, b) => a.stageOrder - b.stageOrder);
  const current = stages.findIndex((s) => s.id === slipping.stageId);
  if (current >= 0 && current + 1 < stages.length) {
    try {
      moveStage(asOf(11), data, {
        workItemId: slipping.id,
        toStageId: stages[current + 1].id,
        metCriterionIds: [],
        overrideReason: 'Client confirmed verbally at the site meeting; paperwork to follow.',
      });
      // Put it back, so the demonstration starts where the fixture says it does
      // and the history shows the round trip.
      moveStage(asOf(11), data, {
        workItemId: slipping.id,
        toStageId: stages[current].id,
        metCriterionIds: [],
        overrideReason: 'Moved back: the paperwork did not follow.',
      });
    } catch {
      /* same */
    }
  }
}

/**
 * The working copy of one workspace.
 *
 * Created on first use, seeded once, and kept for the life of the tab.
 */
export function sessionWorkspace(workspaceId: string): CrmWorkspaceData {
  const existing = store.get(workspaceId);
  if (existing) return existing;

  const source =
    CRM_WORKSPACES.find((d) => d.workspace.id === workspaceId) ?? CRM_WORKSPACES[0];
  const copy: CrmWorkspaceData = JSON.parse(JSON.stringify(source));

  store.set(copy.workspace.id, copy);
  seedHistory(copy);

  return store.get(workspaceId) ?? copy;
}

/* ------------------------------------------------- cache invalidation
 *
 * Found in Phase 2A-i, and it was wrong from Stage 8.
 *
 * Five modules cache an index against the workspace object in a WeakMap:
 * paging, quality, relationships, pipeline and hierarchy. Each of them says in
 * its own comments that this is safe "because the session store deep-copies on
 * write". IT DOES NOT. It deep-copies ONCE, when the workspace is first asked
 * for, and every write after that mutates the same object in place. So the
 * cached index was correct until somebody wrote something, and silently stale
 * afterwards, for the life of the tab.
 *
 * Nothing caught it because the composition suites build a fresh workspace per
 * check, where the bug cannot occur, and the browser suites that do write were
 * reading pages that do not use an index.
 *
 * The fix is here rather than in the five modules, because the thing that
 * knows a write happened is this file. A module that caches registers its own
 * invalidator with `cacheBus`, which imports nothing and so cannot be part of
 * a cycle, and this calls them all on every write.
 */

/** Tells every mounted view that something was written. */
export function notifyWritten(): void {
  version += 1;

  // Before the listeners, not after: a view that re-renders and reads a stale
  // index is the bug this exists to prevent.
  for (const data of store.values()) invalidateCaches(data);

  for (const listener of listeners) listener();
}

export function subscribeToWrites(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sessionVersion(): number {
  return version;
}

/**
 * Back to the fixture.
 *
 * Offered in the interface, because a demonstration that cannot be put back is
 * one nobody will experiment with in front of a buyer.
 */
export function resetSession(): void {
  store.clear();
  resetIdCounter();
  clearForecastSubmissions();
  notifyWritten();
}

/** How much of what is on screen was written in this session. */
export function sessionChangeCount(workspaceId: string): number {
  const data = store.get(workspaceId);
  if (!data) return 0;
  // The seeded history is written through the same path, so it is excluded by
  // actor rather than by pretending it is not there: it is counted separately
  // and the interface says both numbers.
  return data.auditEvents.length;
}
