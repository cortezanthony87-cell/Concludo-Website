/**
 * The right column: eight tabs of analysis over one thread.
 *
 * Built as a real ARIA tab list with roving tabindex and arrow-key movement,
 * because that is what a screen reader and a keyboard user expect from
 * something that looks like tabs. A row of buttons that merely looks like tabs
 * announces itself as a row of buttons.
 *
 * Everything extracted is a button that reveals its source in the centre
 * column. An extraction a person cannot trace is an extraction they have to
 * take on faith, and this module does not ask for faith.
 */
import React, { useCallback, useRef } from 'react';
import * as Icons from 'lucide-react';
import { Calendar as CalendarIcon, Check, Plus, Edit2, Clock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import { createCalendarItem } from '../../lib/calendar/calendarClient';
import {
  INTELLIGENCE_TABS,
  IntelligenceTabKey,
  ThreadDetail,
} from '../../lib/email/threadIntelligence';
import { ReplyDraft, PriorityBand, ThreadStatus } from '../../lib/email/model';
import { SAFETY_STATEMENTS } from '../../lib/email/draftReview';
import {
  BandBadge,
  StatusBadge,
  ConfidenceChip,
  DateChip,
  Field,
  formatDayTime,
} from './viewPrimitives';
import { DraftReview } from './DraftReview';
import { decodeHtmlEntities } from './ConversationPane';

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Resolved = Component ?? Icons.Circle;
  return <Resolved size={size} />;
}

interface Props {
  detail: ThreadDetail;
  draft: ReplyDraft | null;
  fromAddress: string;
  activeTab: IntelligenceTabKey;
  onTabChange: (key: IntelligenceTabKey) => void;
  onSelectSource: (id: string, label: string) => void;
  selectedId: string | null;
  isFullView?: boolean;
  onToggleFullView?: () => void;
  onIgnoreEmail?: () => void;
}

export const IntelligencePane: React.FC<Props> = ({
  detail,
  draft,
  fromAddress,
  activeTab,
  onTabChange,
  onSelectSource,
  selectedId,
  isFullView,
  onToggleFullView,
  onIgnoreEmail,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  /** Arrow keys move between tabs, Home and End jump to the ends. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      const index = INTELLIGENCE_TABS.findIndex((t) => t.key === activeTab);
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = INTELLIGENCE_TABS.length - 1;

      const wrapped = (next + INTELLIGENCE_TABS.length) % INTELLIGENCE_TABS.length;
      const target = INTELLIGENCE_TABS[wrapped];
      onTabChange(target.key);
      const button = listRef.current?.querySelector<HTMLButtonElement>(`#ecc-tab-${target.key}`);
      button?.focus();
    },
    [activeTab, onTabChange]
  );

  return (
    <div className="ecc-intelligence">
      <h3 className="ecc-column-title" id="ecc-intelligence-heading">
        Intelligence
      </h3>
      <p className="ecc-column-note">
        Everything below was read out of the conversation on the left. Select any item to see where
        it came from.
      </p>

      {/* Intelligent Box Controls: Ignore email and Full view email */}
      <div
        className="ecc-intelligent-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          margin: '10px 0 14px',
          padding: '8px 10px',
          background: 'rgba(22, 38, 63, 0.7)',
          border: '1px solid rgba(226, 181, 60, 0.25)',
          borderRadius: '8px',
        }}
      >
        {onIgnoreEmail && (
          <button
            type="button"
            onClick={onIgnoreEmail}
            className="ecc-btn-ignore-email"
            title="Ignore email: removes from overview and inbox, marks as done, and excludes from Email Command Centre"
          >
            <Icons.CheckCircle2 size={13} color="#FCA5A5" />
            <span>Ignore email</span>
          </button>
        )}

        {onToggleFullView && (
          <button
            type="button"
            onClick={onToggleFullView}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              background: isFullView ? 'linear-gradient(135deg, #E2B53C, #BC8A1C)' : 'rgba(33, 57, 92, 0.8)',
              border: '1px solid #E2B53C',
              color: isFullView ? '#0E1726' : '#E2B53C',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={isFullView ? 'Return to standard 3-column view' : 'Expand email to full view while keeping intelligence box in view'}
          >
            {isFullView ? <Icons.Minimize2 size={13} /> : <Icons.Maximize2 size={13} />}
            <span>{isFullView ? 'Standard view' : 'Full view email'}</span>
          </button>
        )}
      </div>

      <div
        className="ecc-itab-list"
        role="tablist"
        aria-label="Thread analysis"
        aria-orientation="horizontal"
        ref={listRef}
        onKeyDown={onKeyDown}
      >
        {INTELLIGENCE_TABS.map((tab) => {
          const count = detail.counts[tab.key];
          const selected = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              id={`ecc-tab-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`ecc-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              className={`ecc-itab ${selected ? 'ecc-itab-active' : ''}`}
              onClick={() => onTabChange(tab.key)}
              title={tab.description}
            >
              <Icon name={tab.iconName} size={13} />
              {tab.label}
              {count > 0 ? <span className="ecc-chip-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div
        id={`ecc-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`ecc-tab-${activeTab}`}
        tabIndex={0}
        className="ecc-itab-panel"
      >
        {activeTab === 'overview' ? <OverviewTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'actions' ? <ActionsTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'decisions' ? <DecisionsTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'deadlines' ? <DeadlinesTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'questions' ? <QuestionsTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'attachments' ? <AttachmentsTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'risks' ? <RisksTab detail={detail} onSelectSource={onSelectSource} selectedId={selectedId} /> : null}
        {activeTab === 'draft' ? (
          <DraftReview detail={detail} draft={draft} fromAddress={fromAddress} onSelectSource={onSelectSource} />
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------- shared pieces */

interface TabProps {
  detail: ThreadDetail;
  onSelectSource: (id: string, label: string) => void;
  selectedId: string | null;
}

/** A clickable extraction. Selecting it reveals its source on the left. */
const SourceButton: React.FC<{
  id: string;
  label: string;
  selectedId: string | null;
  onSelect: (id: string, label: string) => void;
  children: React.ReactNode;
}> = ({ id, label, selectedId, onSelect, children }) => (
  <button
    type="button"
    className={`ecc-extraction ${selectedId === id ? 'ecc-extraction-selected' : ''}`}
    aria-pressed={selectedId === id}
    onClick={() => onSelect(id, label)}
  >
    {children}
    <span className="ecc-visually-hidden">
      {selectedId === id ? '. Source shown in the conversation.' : '. Show where this came from.'}
    </span>
  </button>
);

const EmptyTab: React.FC<{ what: string }> = ({ what }) => (
  <p className="ecc-tab-empty">Nothing of this kind was found in the thread. No {what} are listed.</p>
);

/* ------------------------------------------------------------- overview */

const OverviewTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const a = detail.analysis;
  const e = detail.evidence;

  return (
    <div className="ecc-overview-tab">
      <p className="ecc-overview-summary">{decodeHtmlEntities(a.oneLineSummary)}</p>

      <Field label="Why it matters">{decodeHtmlEntities(a.whyItMatters)}</Field>

      <div className="ecc-card-meta">
        <StatusBadge status={a.currentStatus as ThreadStatus} />
        <BandBadge band={a.priorityBand as PriorityBand} score={a.priorityScore} />
        <ConfidenceChip confidence={a.confidence} what="this reading of the thread" />
      </div>

      <Field label="Why it is ranked here">
        <ul className="ecc-reason-list">
          {a.priorityReasons.map((r) => (
            <li key={r}>{decodeHtmlEntities(r)}</li>
          ))}
        </ul>
      </Field>

      <Field label="What the sender is asking for">
        {a.senderRequest ? decodeHtmlEntities(a.senderRequest) : 'Nothing is being asked of you in this thread.'}
      </Field>

      <Field label="Recommended next step">
        {decodeHtmlEntities(a.recommendedNextStep)}
        <span className="ecc-recommended-caveat">{SAFETY_STATEMENTS.recommendedNotDone}</span>
      </Field>

      {/*
        Facts, inferences and unknowns are kept apart. Collapsing them into one
        list of "insights" is how an inference gets acted on as a fact.
      */}
      <section className="ecc-evidence" aria-labelledby="ecc-ev-facts">
        <h4 id="ecc-ev-facts" className="ecc-evidence-head ecc-evidence-fact">
          Facts, stated in the thread ({e.facts.length})
        </h4>
        {e.facts.length === 0 ? (
          <EmptyTab what="stated facts" />
        ) : (
          <ul className="ecc-evidence-list">
            {e.facts.map((f) => (
              <li key={f.id}>
                <SourceButton id={f.id} label={f.text} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(f.text)}
                </SourceButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ecc-evidence" aria-labelledby="ecc-ev-inf">
        <h4 id="ecc-ev-inf" className="ecc-evidence-head ecc-evidence-inference">
          Inferences, worked out rather than stated ({e.inferences.length})
        </h4>
        {e.inferences.length === 0 ? (
          <EmptyTab what="inferences" />
        ) : (
          <ul className="ecc-evidence-list">
            {e.inferences.map((f) => (
              <li key={f.id}>
                <SourceButton id={f.id} label={f.text} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(f.text)}
                </SourceButton>
                <span className="ecc-inference-tag">Inferred, confirm before relying on it</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ecc-evidence" aria-labelledby="ecc-ev-unk">
        <h4 id="ecc-ev-unk" className="ecc-evidence-head ecc-evidence-unknown">
          Unknowns ({e.unknowns.length})
        </h4>
        {e.unknowns.length === 0 ? (
          <EmptyTab what="unknowns" />
        ) : (
          <ul className="ecc-evidence-list">
            {e.unknowns.map((u) => (
              <li key={u.id}>
                <span className="ecc-unknown-text">{decodeHtmlEntities(u.text)}</span>
                <span className="ecc-unknown-why">{decodeHtmlEntities(u.why)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {e.conflicts.length > 0 ? (
        <section className="ecc-evidence" aria-labelledby="ecc-ev-con">
          <h4 id="ecc-ev-con" className="ecc-evidence-head ecc-evidence-conflict">
            Conflicts ({e.conflicts.length})
          </h4>
          <ul className="ecc-evidence-list">
            {e.conflicts.map((c) => (
              <li key={c.id}>
                <SourceButton id={c.id} label={c.description} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(c.description)}
                </SourceButton>
                <ul className="ecc-conflict-positions">
                  {c.positions.map((p) => (
                    <li key={p.statement}>{p.statement}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------- actions */

const ActionsTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const actions = detail.analysis.actions;
  const commitments = detail.analysis.commitments;

  if (actions.length === 0 && commitments.length === 0) return <EmptyTab what="actions" />;

  return (
    <div>
      {actions.length > 0 ? (
        <section aria-labelledby="ecc-act-head">
          <h4 id="ecc-act-head" className="ecc-evidence-head">
            Actions ({actions.length})
          </h4>
          <ul className="ecc-evidence-list">
            {actions.map((a) => (
              <li key={a.id}>
                <SourceButton id={a.id} label={a.description} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(a.description)}
                </SourceButton>
                <span className="ecc-item-meta">
                  {a.ownerIsSelf ? 'Yours' : `Owed by ${a.owner}`}
                  {a.dueAt ? ` · due ${formatDayTime(a.dueAt)}` : ' · no date stated'}
                  {a.estimatedMinutes ? ` · about ${a.estimatedMinutes} minutes` : ''}
                  {` · ${a.status}`}
                </span>
                {a.blockedBy ? <span className="ecc-item-blocked">Blocked by: {a.blockedBy}</span> : null}
                <span className="ecc-recommended-caveat">{SAFETY_STATEMENTS.recommendedNotDone}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {commitments.length > 0 ? (
        <section aria-labelledby="ecc-cmt-head">
          <h4 id="ecc-cmt-head" className="ecc-evidence-head">
            Commitments ({commitments.length})
          </h4>
          <ul className="ecc-evidence-list">
            {commitments.map((c) => (
              <li key={c.id}>
                <SourceButton id={c.id} label={c.description} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(c.description)}
                </SourceButton>
                <span className="ecc-item-meta">
                  {c.promisedByIsSelf ? 'You promised this' : `${c.promisedBy} promised this`}
                  {c.dueAt ? ` · due ${formatDayTime(c.dueAt)}` : ''}
                  {` · ${c.status}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------ decisions */

const DecisionsTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const made = detail.analysis.decisionsMade;
  const required = detail.analysis.decisionsRequired;
  if (made.length === 0 && required.length === 0) return <EmptyTab what="decisions" />;

  return (
    <div>
      {required.length > 0 ? (
        <section aria-labelledby="ecc-dec-req">
          <h4 id="ecc-dec-req" className="ecc-evidence-head ecc-evidence-unknown">
            Decisions required ({required.length})
          </h4>
          <ul className="ecc-evidence-list">
            {required.map((d) => (
              <li key={d.id}>
                <SourceButton id={d.id} label={decodeHtmlEntities(d.description)} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(d.description)}
                </SourceButton>
                {d.options && d.options.length > 0 ? (
                  <ul className="ecc-conflict-positions">
                    {d.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                ) : null}
                <span className="ecc-item-meta">
                  {d.requiredBy ? `Needed by ${formatDayTime(d.requiredBy)}` : 'No date stated'}
                  {d.blocks ? ` · blocks: ${d.blocks}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {made.length > 0 ? (
        <section aria-labelledby="ecc-dec-made">
          <h4 id="ecc-dec-made" className="ecc-evidence-head ecc-evidence-fact">
            Decisions already made ({made.length})
          </h4>
          <ul className="ecc-evidence-list">
            {made.map((d) => (
              <li key={d.id}>
                <SourceButton id={d.id} label={decodeHtmlEntities(d.description)} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(d.description)}
                </SourceButton>
                <span className="ecc-item-meta">
                  {d.decidedBy ? `Decided by ${d.decidedBy}` : 'Decided'}
                  {d.decidedAt ? ` on ${formatDayTime(d.decidedAt)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------ deadlines */

const DeadlinesTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const { user } = useAuth();
  const stated = detail.analysis.explicitDeadlines;
  const suggested = detail.analysis.suggestedDates;

  const [addedMap, setAddedMap] = React.useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap] = React.useState<Record<string, boolean>>({});
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [editingDeadlineId, setEditingDeadlineId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editDate, setEditDate] = React.useState('');
  const [editTime, setEditTime] = React.useState('17:00');
  const [editType, setEditType] = React.useState<'task' | 'review'>('task');

  const [showAddReminder, setShowAddReminder] = React.useState(stated.length === 0 && suggested.length === 0);
  const [customTitle, setCustomTitle] = React.useState(() => `Review email: ${detail.record.thread.subject}`);
  const [customDesc, setCustomDesc] = React.useState(() => `Follow up on email from ${detail.record.counterpartyName}: "${detail.record.thread.subject}"`);
  const [customDate, setCustomDate] = React.useState(() => {
    try {
      const target = new Date();
      target.setDate(target.getDate() + 1);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Melbourne',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(target);
    } catch {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
  });
  const [customTime, setCustomTime] = React.useState('09:00');
  const [customType, setCustomType] = React.useState<'review' | 'task'>('review');
  const [customSaved, setCustomSaved] = React.useState(false);
  const [isSavingCustom, setIsSavingCustom] = React.useState(false);

  // Automatically add explicit deadline to Concludo Calendar
  const handleAutoAddToCalendar = async (d: any) => {
    setLoadingMap((m) => ({ ...m, [d.id]: true }));
    setActionError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const rawDue = d.dueAt || '';
      const dueDate = rawDue.includes('T') ? rawDue.split('T')[0] : (rawDue || new Date().toISOString().split('T')[0]);
      const dueTime = rawDue.includes('T') ? rawDue.split('T')[1].slice(0, 5) : '17:00';
      if (!user?.id) {
        setActionError('You must be signed in to add items to your calendar.');
        setLoadingMap((m) => ({ ...m, [d.id]: false }));
        return;
      }
      const userId = user.id;

      const res = await createCalendarItem(supabase, {
        creator_id: userId,
        title: d.description || detail.record.thread.subject,
        description: `${d.description}${d.consequence ? `\n\nConsequence: ${d.consequence}` : ''}\n\nEmail reference: "${detail.record.thread.subject}" from ${detail.record.counterpartyName}`,
        due_date: dueDate,
        start_date: dueDate,
        end_date: dueDate,
        due_time: dueTime,
        status: 'open',
        type: 'task',
        priority: 'high',
        source_type: 'email',
        source_title: detail.record.thread.subject,
        source_reference: detail.record.thread.id,
        visibility: 'private',
        idempotency_key: `email_dl_${detail.record.thread.id}_${d.id}`,
      });

      if (res.error) {
        setActionError(res.error);
      } else {
        setAddedMap((m) => ({ ...m, [d.id]: true }));
      }
    } catch (e: any) {
      setActionError(e.message || 'Failed to add to calendar');
    } finally {
      setLoadingMap((m) => ({ ...m, [d.id]: false }));
    }
  };

  // Start editing an explicit deadline
  const handleStartEdit = (d: any) => {
    const rawDue = d.dueAt || '';
    const dueDate = rawDue.includes('T') ? rawDue.split('T')[0] : (rawDue || new Date().toISOString().split('T')[0]);
    const dueTime = rawDue.includes('T') ? rawDue.split('T')[1].slice(0, 5) : '17:00';
    setEditingDeadlineId(d.id);
    setEditTitle(d.description || detail.record.thread.subject);
    setEditDesc(`${d.description}${d.consequence ? ` - ${d.consequence}` : ''}`);
    setEditDate(dueDate);
    setEditTime(dueTime);
    setEditType('task');
  };

  // Save edited deadline to Concludo Calendar
  const handleSaveEditedDeadline = async (d: any) => {
    setLoadingMap((m) => ({ ...m, [d.id]: true }));
    setActionError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!user?.id) {
        setActionError('You must be signed in to add items to your calendar.');
        setLoadingMap((m) => ({ ...m, [d.id]: false }));
        return;
      }
      const userId = user.id;

      const res = await createCalendarItem(supabase, {
        creator_id: userId,
        title: editTitle.trim() || d.description,
        description: `${editDesc.trim()}\n\nEmail reference: "${detail.record.thread.subject}" from ${detail.record.counterpartyName}`,
        due_date: editDate || new Date().toISOString().split('T')[0],
        start_date: editDate || new Date().toISOString().split('T')[0],
        end_date: editDate || new Date().toISOString().split('T')[0],
        due_time: editTime || '17:00',
        status: 'open',
        type: editType,
        priority: 'high',
        source_type: 'email',
        source_title: detail.record.thread.subject,
        source_reference: detail.record.thread.id,
        visibility: 'private',
        idempotency_key: `email_dl_edit_${detail.record.thread.id}_${d.id}_${editDate}_${(editTime || '1700').replace(':', '')}`,
      });

      if (res.error) {
        setActionError(res.error);
      } else {
        setAddedMap((m) => ({ ...m, [d.id]: true }));
        setEditingDeadlineId(null);
      }
    } catch (e: any) {
      setActionError(e.message || 'Failed to add to calendar');
    } finally {
      setLoadingMap((m) => ({ ...m, [d.id]: false }));
    }
  };

  // Save custom review reminder to Concludo Calendar
  const handleSaveCustomReminder = async () => {
    setIsSavingCustom(true);
    setActionError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!user?.id) {
        setActionError('You must be signed in to add items to your calendar.');
        setIsSavingCustom(false);
        return;
      }
      const userId = user.id;

      const res = await createCalendarItem(supabase, {
        creator_id: userId,
        title: customTitle.trim() || `Review email: ${detail.record.thread.subject}`,
        description: `${customDesc.trim()}\n\nEmail reference: "${detail.record.thread.subject}" from ${detail.record.counterpartyName}`,
        due_date: customDate || new Date().toISOString().split('T')[0],
        start_date: customDate || new Date().toISOString().split('T')[0],
        end_date: customDate || new Date().toISOString().split('T')[0],
        due_time: customTime || '09:00',
        status: 'open',
        type: customType,
        priority: 'medium',
        source_type: 'email',
        source_title: detail.record.thread.subject,
        source_reference: detail.record.thread.id,
        visibility: 'private',
        idempotency_key: `email_reminder_${detail.record.thread.id}_${customDate}_${(customTime || '0900').replace(':', '')}`,
      });

      if (res.error) {
        setActionError(res.error);
      } else {
        setCustomSaved(true);
      }
    } catch (e: any) {
      setActionError(e.message || 'Failed to save review reminder');
    } finally {
      setIsSavingCustom(false);
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', color: '#FCA5A5', fontSize: '11.5px' }}>
          {actionError}
        </div>
      )}

      {stated.length === 0 && suggested.length === 0 && !showAddReminder && !customSaved && (
        <div style={{ padding: '12px', background: 'rgba(33, 57, 92, 0.4)', borderRadius: '8px', border: '1px solid #21395C', marginBottom: '12px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            No explicit due dates were read from this email. You can add a review reminder to your Concludo calendar below.
          </p>
        </div>
      )}

      {stated.length > 0 ? (
        <section aria-labelledby="ecc-dl-stated">
          <h4 id="ecc-dl-stated" className="ecc-evidence-head ecc-evidence-fact">
            Stated in the email ({stated.length})
          </h4>
          <ul className="ecc-evidence-list">
            {stated.map((d) => (
              <li key={d.id} style={{ marginBottom: '14px', background: 'rgba(22, 38, 63, 0.7)', border: '1px solid #21395C', borderRadius: '8px', padding: '12px' }}>
                <SourceButton id={d.id} label={decodeHtmlEntities(d.description)} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(d.description)}
                </SourceButton>
                <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                  <DateChip dueAt={d.dueAt} origin="explicit_email" withTime />
                  <span className="ecc-item-meta" style={{ display: 'block', marginTop: '4px' }}>
                    {d.ownerIsSelf ? 'Yours. ' : 'Theirs. '}
                    {d.consequence}
                  </span>
                </div>

                {/* Calendar Action Controls for this deadline */}
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #21395C' }}>
                  {addedMap[d.id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '6px', padding: '6px 10px' }}>
                      <span style={{ fontSize: '11.5px', color: '#6EE7B7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Check size={13} color="#6EE7B7" /> Added to Concludo Calendar
                      </span>
                      <Link to="/calendar" style={{ fontSize: '11px', color: '#E2B53C', fontWeight: 700, textDecoration: 'underline' }}>
                        Open Calendar →
                      </Link>
                    </div>
                  ) : editingDeadlineId === d.id ? (
                    <div style={{ background: '#16263F', border: '1px solid #E2B53C', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#E2B53C', marginBottom: '6px' }}>
                        Edit Deadline for Calendar
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '4px 8px', color: '#FFF', fontSize: '11.5px' }}
                        />
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Description & Consequence</label>
                        <textarea
                          rows={2}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '4px 8px', color: '#FFF', fontSize: '11.5px' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Due Date</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '4px 6px', color: '#FFF', fontSize: '11px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Due Time</label>
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '4px 6px', color: '#FFF', fontSize: '11px' }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleSaveEditedDeadline(d)}
                          disabled={loadingMap[d.id]}
                          style={{ flex: 1, padding: '5px 10px', background: 'linear-gradient(135deg, #E2B53C, #BC8A1C)', border: 'none', borderRadius: '4px', color: '#0E1726', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                        >
                          {loadingMap[d.id] ? 'Saving...' : 'Save to Calendar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDeadlineId(null)}
                          style={{ padding: '5px 8px', background: 'transparent', border: '1px solid #21395C', borderRadius: '4px', color: '#94A3B8', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleAutoAddToCalendar(d)}
                        disabled={loadingMap[d.id]}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          padding: '5px 8px',
                          background: 'linear-gradient(135deg, #E2B53C, #BC8A1C)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#0E1726',
                          fontWeight: 700,
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                        title="Automatically adds this extracted deadline and its description to Concludo Calendar"
                      >
                        <CalendarIcon size={12} />
                        <span>{loadingMap[d.id] ? 'Adding...' : 'Add to Calendar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(d)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '5px 8px', background: 'rgba(33, 57, 92, 0.6)', border: '1px solid #E2B53C', borderRadius: '6px', color: '#E2B53C', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                        title="Edit date, description, or reminder before adding"
                      >
                        <Edit2 size={11} />
                        <span>Edit & Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {suggested.length > 0 ? (
        <section aria-labelledby="ecc-dl-sug">
          <h4 id="ecc-dl-sug" className="ecc-evidence-head ecc-evidence-inference">
            Worked out, not stated ({suggested.length})
          </h4>
          <ul className="ecc-evidence-list">
            {suggested.map((d) => (
              <li key={d.id}>
                <SourceButton id={d.id} label={decodeHtmlEntities(d.description)} selectedId={selectedId} onSelect={onSelectSource}>
                  {decodeHtmlEntities(d.description)}
                </SourceButton>
                <DateChip dueAt={d.dueAt} origin="suggested" withTime />
                <span className="ecc-item-meta">{d.consequence}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Review Reminder Section (Available for every email) */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #21395C' }}>
        {customSaved ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6EE7B7', fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>
              <CheckCircle2 size={14} color="#6EE7B7" />
              <span>Review Reminder Saved to Calendar</span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#CBD5E1', marginBottom: '8px' }}>
              Scheduled for {customDate} at {customTime}.
            </p>
            <Link to="/calendar" style={{ fontSize: '11.5px', color: '#E2B53C', fontWeight: 700, textDecoration: 'underline' }}>
              Open Concludo Calendar →
            </Link>
          </div>
        ) : showAddReminder ? (
          <div style={{ background: 'rgba(22, 38, 63, 0.9)', border: '1px solid #E2B53C', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#E2B53C', marginBottom: '8px' }}>
              <CalendarIcon size={13} color="#E2B53C" />
              <span>Add Review Reminder to Calendar</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#94A3B8' }}>
              Create a review date and reminder on your calendar to follow up on this email.
            </p>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Reminder Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '5px 8px', color: '#FFF', fontSize: '11.5px' }}
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Notes / Description</label>
              <textarea
                rows={2}
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '5px 8px', color: '#FFF', fontSize: '11.5px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Review Date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '5px 8px', color: '#FFF', fontSize: '11.5px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10.5px', color: '#94A3B8', marginBottom: '2px' }}>Time</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  style={{ width: '100%', background: '#0E1726', border: '1px solid #21395C', borderRadius: '4px', padding: '5px 8px', color: '#FFF', fontSize: '11.5px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSaveCustomReminder}
                disabled={isSavingCustom}
                style={{ flex: 1, padding: '7px 12px', background: 'linear-gradient(135deg, #E2B53C, #BC8A1C)', border: 'none', borderRadius: '6px', color: '#0E1726', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                {isSavingCustom ? 'Saving Reminder...' : 'Save Reminder to Calendar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddReminder(true)}
            style={{ width: '100%', padding: '7px 12px', background: 'rgba(33, 57, 92, 0.4)', border: '1px dashed #E2B53C', borderRadius: '6px', color: '#E2B53C', fontWeight: 600, fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Plus size={13} color="#E2B53C" />
            <span>+ Add Review Reminder / Date to Calendar</span>
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ questions */

const QuestionsTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const questions = detail.analysis.openQuestions;
  if (questions.length === 0) return <EmptyTab what="questions" />;

  return (
    <ul className="ecc-evidence-list">
      {questions.map((q) => (
        <li key={q.id}>
          <SourceButton id={q.id} label={decodeHtmlEntities(q.question)} selectedId={selectedId} onSelect={onSelectSource}>
            {decodeHtmlEntities(q.question)}
          </SourceButton>
          <span className="ecc-item-meta">
            Asked by {q.askedByIsSelf ? 'you' : q.askedBy} on {formatDayTime(q.askedAt)}
            {q.answered ? ' · answered' : ' · not answered'}
          </span>
          {q.blockedBy ? <span className="ecc-item-blocked">Blocked by: {q.blockedBy}</span> : null}
        </li>
      ))}
    </ul>
  );
};

/* ---------------------------------------------------------- attachments */

const AttachmentsTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const attachments = detail.analysis.attachments;
  if (attachments.length === 0) return <EmptyTab what="attachments" />;

  const DISPOSITION: Record<string, string> = {
    received: 'Received',
    expected: 'Expected, not sent',
    referenced_but_missing: 'Named in the text, not attached',
  };

  return (
    <ul className="ecc-evidence-list">
      {attachments.map((a) => (
        <li key={a.id}>
          <SourceButton id={a.id} label={a.fileName} selectedId={selectedId} onSelect={onSelectSource}>
            {a.fileName}
          </SourceButton>
          <span className="ecc-item-meta">
            {DISPOSITION[a.disposition] ?? a.disposition}
            {a.sizeBytes ? ` · ${Math.round(a.sizeBytes / 1024)} KB` : ''}
            {` · ${a.mimeType}`}
          </span>
          {/* Never imply a file was opened and read. */}
          <span className="ecc-attachment-caveat">{SAFETY_STATEMENTS.attachmentNotReviewed}</span>
          {a.note ? <span className="ecc-item-blocked">{a.note}</span> : null}
        </li>
      ))}
    </ul>
  );
};

/* ---------------------------------------------------------------- risks */

const RisksTab: React.FC<TabProps> = ({ detail, onSelectSource, selectedId }) => {
  const risks = detail.analysis.risks;
  const alert = detail.analysis.securityAlert;
  if (risks.length === 0 && !alert) return <EmptyTab what="risks" />;

  return (
    <div>
      {alert ? (
        <div className="ecc-warning ecc-warning-security" role="note">
          <p className="ecc-warning-head">
            <Icons.ShieldAlert size={14} aria-hidden="true" />
            Security advisory, {alert.severity} severity
          </p>
          <p className="ecc-warning-text">{alert.explanation}</p>
          <p className="ecc-warning-check">
            <strong>What to do:</strong> {alert.recommendedCheck}
          </p>
          <p className="ecc-warning-text">
            Automated detection can assist review but cannot guarantee that an email is safe or
            malicious.
          </p>
        </div>
      ) : null}

      {risks.length > 0 ? (
        <ul className="ecc-evidence-list">
          {risks.map((r) => (
            <li key={r.id}>
              <SourceButton id={r.id} label={r.description} selectedId={selectedId} onSelect={onSelectSource}>
                {r.description}
              </SourceButton>
              <span className="ecc-item-meta">
                {r.kind} · {r.severity} severity
              </span>
              {r.suggestedMitigation ? (
                <span className="ecc-item-blocked">Suggested: {r.suggestedMitigation}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
