/**
 * Outputs.
 *
 * Everything the module produces for a person, in one place. It replaces the
 * Drafts tab rather than sitting beside it, because a reply draft is an output
 * and two tabs for one idea is how an interface grows to fourteen tabs that
 * nobody can hold in their head.
 *
 * Two modes:
 *
 * **Documents.** A thread turned into finished Concludo work: an outcome
 * report, an action plan, a decision log. Rendered with the Workspace's own
 * document stylesheet, inside an iframe, so what is on screen is the document
 * rather than an impression of it.
 *
 * **Reply drafts.** The prepared replies, and the ones deliberately not
 * prepared. The withheld ones matter more than the ready ones: they are where
 * the module declines to write something on a person's behalf, and the reason
 * is the only way to judge whether it was right to.
 *
 * Nothing on this page sends anything, and nothing writes to a mailbox.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { FilterChips } from '../../components/email/FilterChips';
import { ItemActions } from '../../components/email/ItemActions';
import {
  AccountBadge,
  DraftChip,
  ConfidenceChip,
  Field,
  NoticeBlock,
  formatDayTime,
} from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { draftItems } from '../../lib/email/views';
import { DraftStatus, DraftStyle, DRAFT_STYLE_LABEL } from '../../lib/email/model';
import {
  OUTPUT_KINDS,
  OutputKind,
  availabilityFor,
  buildFollowUpEmail,
  buildOutputPayload,
  outputDefinition,
} from '../../lib/email/outputs';
import {
  DOCUMENT_LOCKUP,
  DOCUMENT_STYLESHEET,
  documentFileName,
  renderOutputDocument,
} from '../../lib/email/outputDocument';

type Mode = 'documents' | 'drafts';

const MODES: readonly { key: Mode; label: string; description: string }[] = [
  {
    key: 'documents',
    label: 'Documents',
    description: 'A thread turned into a finished Concludo document.',
  },
  {
    key: 'drafts',
    label: 'Reply drafts',
    description: 'Replies prepared for your review, and replies deliberately not prepared.',
  },
];

const STATUS_OPTIONS: readonly { key: DraftStatus; label: string; description: string }[] = [
  { key: 'available', label: 'Ready for review', description: 'A draft has been written and is waiting on you.' },
  {
    key: 'clarification_required',
    label: 'Clarification required',
    description: 'Something is missing, so nothing was written.',
  },
  {
    key: 'withheld_for_safety',
    label: 'Withheld',
    description: 'Deliberately not written: security flagged, sensitive, or already closed.',
  },
];

const STYLES: readonly DraftStyle[] = ['concise', 'warm', 'detailed'];

function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Resolved = Component ?? Icons.Circle;
  return <Resolved size={size} />;
}

export const EmailOutputsPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { dataset, records, accountLabel, accountType, now, state } = useViewData(accountId);
  const [params, setParams] = useSearchParams();

  const mode: Mode = params.get('mode') === 'drafts' ? 'drafts' : 'documents';
  const setMode = useCallback(
    (next: Mode) => {
      const updated = new URLSearchParams(params);
      updated.set('mode', next);
      setParams(updated, { replace: true });
    },
    [params, setParams]
  );

  /* ------------------------------------------------------------ documents */

  // Only analysed threads can produce a document, so the picker never offers
  // one that will immediately refuse for the same reason every time.
  const candidates = useMemo(
    () => records.filter((r) => r.analysis.analysed),
    [records]
  );

  const [threadId, setThreadId] = useState<string>('');
  const [kind, setKind] = useState<OutputKind>('thread_summary');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (candidates.length === 0) {
      setThreadId('');
      return;
    }
    if (!candidates.some((r) => r.thread.id === threadId)) {
      // Default to the thread with the most in it, which is the one where a
      // document is worth the most. Not the newest: a two-line acknowledgement
      // makes a thin demonstration of what this does.
      const richest = candidates
        .slice()
        .sort(
          (a, b) =>
            weightOf(b) - weightOf(a) || b.analysis.priorityScore - a.analysis.priorityScore
        )[0];
      setThreadId(richest.thread.id);
    }
  }, [candidates, threadId]);

  const record = candidates.find((r) => r.thread.id === threadId) ?? null;
  const tier = 'pro' as const;

  const availability = record ? availabilityFor(kind, record) : null;

  const payload = useMemo(() => {
    if (!record || !availability?.available) return null;
    return buildOutputPayload(kind, { record, accountLabel, tier, now });
  }, [record, availability, kind, accountLabel, now]);

  const email = useMemo(() => {
    if (!record || kind !== 'follow_up_email' || !availability?.available) return null;
    return buildFollowUpEmail({ record, accountLabel, tier, now });
  }, [record, kind, availability, accountLabel, now]);

  const documentHtml = useMemo(() => {
    if (!payload || kind === 'follow_up_email') return null;
    return renderOutputDocument(payload, { producedAt: now });
  }, [payload, kind, now]);

  const copy = useCallback((text: string, what: string) => {
    const done = () => {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2400);
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
        return;
      }
    } catch {
      // Falls through to the manual path below.
    }
    done();
  }, []);

  /**
   * The download.
   *
   * The first version kept a hidden anchor in the page. A visually hidden
   * anchor is still a 1 by 1 pixel focusable element, which the accessibility
   * suite correctly flagged as a target under the 24 pixel minimum. Creating
   * the anchor at the moment of the click leaves nothing in the page to focus.
   */
  const download = useCallback(() => {
    if (!documentHtml || !payload) return;
    const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = documentFileName(payload, now);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [documentHtml, payload, now]);

  /* --------------------------------------------------------------- drafts */

  const [statuses, setStatuses] = useState<DraftStatus[]>([]);
  const [style, setStyle] = useState<DraftStyle>('concise');

  const drafts = dataset?.drafts ?? [];
  const chosen = statuses.length > 0 ? statuses : STATUS_OPTIONS.map((s) => s.key);
  const draftRows = useMemo(
    () => draftItems(records, drafts, style, chosen),
    [records, drafts, style, chosen]
  );
  const allDrafts = useMemo(() => draftItems(records, drafts, style), [records, drafts, style]);

  /* ----------------------------------------------------------------- view */

  // A tablist promises arrow keys, so it has them. Roving tabindex means Tab
  // moves past the group and the arrows move within it, which is the pattern
  // the ARIA authoring practices describe and the one the eight analysis panes
  // on a thread already use.
  const onModeKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const index = MODES.findIndex((m) => m.key === mode);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? MODES.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length;
      setMode(MODES[next].key);
      const group = event.currentTarget;
      window.setTimeout(() => {
        group.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }, 0);
    },
    [mode, setMode]
  );

  const modeTabs = (
    <div
      className="ecc-mode-switch"
      role="tablist"
      aria-label="What kind of output"
      onKeyDown={onModeKey}
    >
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={mode === m.key}
          tabIndex={mode === m.key ? 0 : -1}
          className={`ecc-mode-tab ${mode === m.key ? 'is-on' : ''}`}
          onClick={() => setMode(m.key)}
        >
          <span className="ecc-mode-label">{m.label}</span>
          <span className="ecc-mode-note">{m.description}</span>
        </button>
      ))}
    </div>
  );

  if (mode === 'drafts') {
    return (
      <ViewScaffold
        title="Outputs"
        description="Everything Concludo has prepared from this account. Nothing is sent, and nothing is written to a mailbox."
        state={state}
        count={draftRows.length}
        countNoun={['draft', 'drafts']}
        emptyMessage="No draft matches the filters you have chosen."
        accountLabel={accountLabel}
        accountType={accountType}
        notice={
          <>
            {modeTabs}
            <p className="ecc-safety-note" role="note">
              <ShieldCheck size={14} aria-hidden="true" />
              A draft is text on this screen. Writing one into a mailbox would need your approval of
              that exact wording and the capability turned on. Sending is not built at all.
            </p>
          </>
        }
        controls={
          <>
            <FilterChips
              legend="Draft status"
              options={STATUS_OPTIONS.map((s) => ({
                key: s.key,
                label: s.label,
                description: s.description,
                count: allDrafts.filter((i) => i.draft.status === s.key).length,
              }))}
              active={statuses}
              onToggle={(key) =>
                setStatuses((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]))
              }
              onClear={() => setStatuses([])}
              combineNote="Choosing none shows all three."
            />
            <fieldset className="ecc-style-picker">
              <legend className="ecc-chips-legend">Draft style</legend>
              <div className="ecc-chip-row">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`ecc-chip ${style === s ? 'ecc-chip-on' : ''}`}
                    aria-pressed={style === s}
                    onClick={() => setStyle(s)}
                  >
                    {DRAFT_STYLE_LABEL[s]}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        }
      >
        <ul className="ecc-card-list">
          {draftRows.map(({ record: r, draft, bodyForStyle }) => {
            const headingId = `ecc-draft-${r.thread.id}`;
            return (
              <li key={draft.id} className="content-card ecc-card" aria-labelledby={headingId}>
                <div className="ecc-card-top">
                  <div className="ecc-card-identity">
                    <p className="ecc-card-sender">{r.counterpartyName}</p>
                    <h3 id={headingId} className="ecc-card-subject">
                      {r.thread.subject}
                    </h3>
                  </div>
                  <div className="ecc-card-badges">
                    <AccountBadge accountType={accountType} label={accountLabel} />
                    <DraftChip status={draft.status} />
                  </div>
                </div>

                {bodyForStyle ? (
                  <>
                    {draft.recipients.length > 0 ? (
                      <Field label="Would go to">
                        {draft.recipients.map((p) => `${p.displayName} (${p.address})`).join(', ')}
                      </Field>
                    ) : null}
                    <p className="ecc-draft-style-note">{DRAFT_STYLE_LABEL[style]} version</p>
                    <pre
                      className="ecc-draft-body"
                      tabIndex={0}
                      aria-label={`Proposed reply to ${r.thread.subject}`}
                    >
                      {bodyForStyle}
                    </pre>
                    {draft.commitmentsInDraft.length > 0 ? (
                      <Field label="What this commits you to">
                        <ul className="ecc-reason-list ecc-commitments">
                          {draft.commitmentsInDraft.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </Field>
                    ) : null}
                  </>
                ) : (
                  <p className="ecc-draft-withheld">{draft.statusReason}</p>
                )}

                {draft.missingInformation.length > 0 ? (
                  <Field label="Needed before this can be written">
                    <ul className="ecc-reason-list">
                      {draft.missingInformation.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </Field>
                ) : null}

                {draft.factsToVerify.length > 0 ? (
                  <Field label="Check before using">
                    <ul className="ecc-reason-list">
                      {draft.factsToVerify.map((f) => (
                        <li key={f.id}>
                          <strong>{f.claim}</strong> {f.howToVerify}
                        </li>
                      ))}
                    </ul>
                  </Field>
                ) : null}

                <div className="ecc-card-meta">
                  <ConfidenceChip confidence={r.analysis.confidence} what="this draft" />
                  <span className="ecc-attach-chip">Prepared {formatDayTime(draft.createdAt)}</span>
                  <span className="ecc-attach-chip">
                    {draft.approval === null ? 'Not approved, and nothing can approve it' : 'Approved'}
                  </span>
                </div>

                <ItemActions
                  threadId={r.thread.id}
                  subject={r.thread.subject}
                  linkTo={linkTo}
                  recommendedNextStep={r.analysis.recommendedNextStep}
                  draftAvailable={draft.status === 'available'}
                />
              </li>
            );
          })}
        </ul>
      </ViewScaffold>
    );
  }

  const definition = outputDefinition(kind);

  return (
    <ViewScaffold
      title="Outputs"
      description="Turn a conversation into finished work. The document is built only from what the thread actually says."
      state={state}
      count={candidates.length}
      countNoun={['analysed thread to choose from', 'analysed threads to choose from']}
      emptyMessage="No thread on this account has been analysed yet, so there is nothing to build a document from."
      accountLabel={accountLabel}
      accountType={accountType}
      notice={modeTabs}
    >
      <div className="ecc-output-layout">
        <div className="ecc-output-controls">
          <label className="ecc-labelled-control" htmlFor="ecc-output-thread">
            <span>Conversation</span>
            <select
              id="ecc-output-thread"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
            >
              {candidates.map((r) => (
                <option key={r.thread.id} value={r.thread.id}>
                  {r.counterpartyName}: {r.thread.subject}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="ecc-output-kinds">
            <legend>What to produce</legend>
            {OUTPUT_KINDS.map((o) => {
              const a = record ? availabilityFor(o.kind, record) : null;
              const blocked = a ? !a.available : true;
              return (
                <button
                  key={o.kind}
                  type="button"
                  className={`ecc-output-kind ${kind === o.kind ? 'is-on' : ''} ${blocked ? 'is-blocked' : ''}`}
                  aria-pressed={kind === o.kind}
                  onClick={() => setKind(o.kind)}
                >
                  <span className="ecc-output-kind-head">
                    <Icon name={o.iconName} size={14} />
                    {o.label}
                    {blocked ? <span className="ecc-output-kind-flag">Not for this thread</span> : null}
                  </span>
                  <span className="ecc-output-kind-note">{o.description}</span>
                </button>
              );
            })}
          </fieldset>

          <p className="ecc-output-usewhen">
            <strong>Use it when:</strong> {definition.useWhen}
          </p>
        </div>

        <div className="ecc-output-preview">
          {!record ? (
            <NoticeBlock tone="info" title="Nothing selected">
              Choose a conversation to build a document from.
            </NoticeBlock>
          ) : availability && !availability.available ? (
            <NoticeBlock tone="caution" title={`No ${definition.label.toLowerCase()} for this thread`}>
              <p>{availability.reason}</p>
              {availability.missing.length > 0 ? (
                <ul className="ecc-reason-list">
                  {availability.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
              <p>
                Concludo would rather produce nothing than produce a page that looks like work and
                carries none.
              </p>
            </NoticeBlock>
          ) : kind === 'follow_up_email' && email ? (
            <div className="ecc-email-output">
              <div className="ecc-output-actions" role="group" aria-label="Follow-up email actions">
                <button
                  type="button"
                  className="btn-primary ecc-bl-button"
                  onClick={() => copy(`${email.subject}\n\n${email.body}`, 'email')}
                >
                  {copied === 'email' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied === 'email' ? ' Copied' : ' Copy for your mail client'}
                </button>
              </div>

              <p className="ecc-safety-note" role="note">
                <ShieldCheck size={14} aria-hidden="true" />
                This is text on a screen. Concludo cannot send it, and copying it is the only way it
                leaves this page.
              </p>

              <dl className="ecc-email-head">
                <dt>To</dt>
                <dd>{email.to.join(', ') || 'Nobody resolved from this thread'}</dd>
                <dt>Subject</dt>
                <dd>{email.subject}</dd>
              </dl>

              <pre className="ecc-draft-body" tabIndex={0} aria-label="The follow-up email">
                {email.body}
              </pre>

              {email.commits.length > 0 ? (
                <Field label="What sending this would commit you to">
                  <ul className="ecc-reason-list ecc-commitments">
                    {email.commits.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </Field>
              ) : null}
            </div>
          ) : documentHtml && payload ? (
            <>
              <div className="ecc-output-actions" role="group" aria-label="Document actions">
                <button type="button" className="btn-primary ecc-bl-button" onClick={download}>
                  <Download size={14} aria-hidden="true" /> Download the document
                </button>
                <button
                  type="button"
                  className="btn-secondary ecc-bl-button"
                  onClick={() => copy(JSON.stringify(payload, null, 2), 'payload')}
                >
                  {copied === 'payload' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied === 'payload' ? ' Copied' : ' Copy the payload'}
                </button>
              </div>

              <p className="ecc-output-note">
                Drawn with the Workspace document stylesheet at{' '}
                <code>{DOCUMENT_STYLESHEET}</code>, so what is on screen is the document. The payload
                is the contract from <code>Concludo_Output_Payload_Schema_v1</code>, which is what a
                server-side renderer would consume to produce the PDF.
              </p>

              <iframe
                className="ecc-document-frame"
                title={`${definition.label} for ${record.thread.subject}`}
                srcDoc={documentHtml}
                sandbox="allow-same-origin"
              />
            </>
          ) : (
            <NoticeBlock tone="info" title="Nothing to show">
              This combination produced no document.
            </NoticeBlock>
          )}
        </div>
      </div>
    </ViewScaffold>
  );
};

/** How much a thread has in it, for choosing a sensible default. */
function weightOf(r: { analysis: { actions: readonly unknown[]; decisionsMade: readonly unknown[]; decisionsRequired: readonly unknown[]; explicitDeadlines: readonly unknown[]; risks: readonly unknown[] } }): number {
  const a = r.analysis;
  return (
    a.actions.length * 2 +
    a.decisionsMade.length * 2 +
    a.decisionsRequired.length * 2 +
    a.explicitDeadlines.length +
    a.risks.length
  );
}

export { DOCUMENT_LOCKUP };
