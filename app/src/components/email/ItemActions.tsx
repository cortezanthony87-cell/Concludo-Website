/**
 * The eight actions on a thread.
 *
 * Every one of them is local. Nothing here sends, files, deletes, archives,
 * creates a task or sets a reminder in any system. Three of them navigate
 * inside the module and five record an intention in React state for the length
 * of this visit.
 *
 * Each button carries an accessible description saying exactly what it will do,
 * including the part people most need: that nothing is saved. A control that
 * looks like it saved and did not is worse than no control at all.
 */
import React, { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ITEM_ACTIONS, useLocalActions } from '../../lib/email/localActions';
import { destinationForPath } from '../../lib/email/moduleNav';
import { threadHref } from '../../lib/email/viewLinks';

function Icon({ name, size = 13 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Resolved = Component ?? Icons.Circle;
  return <Resolved size={size} />;
}

interface Props {
  threadId: string;
  subject: string;
  /** Where "View thread", "View summary" and "Draft reply" go. */
  linkTo: (path: string) => string;
  /** Suggested follow-up date, used to pre-fill the reminder suggestion. */
  suggestedFollowUpAt?: string | null;
  /** The recommended next step, used as the task line. */
  recommendedNextStep: string;
  /** Hides "Draft reply" where no draft exists. */
  draftAvailable: boolean;
}

export const ItemActions: React.FC<Props> = ({
  threadId,
  subject,
  linkTo,
  suggestedFollowUpAt,
  recommendedNextStep,
  draftAvailable,
}) => {
  const actions = useLocalActions();
  const groupId = useId();
  const [open, setOpen] = useState(false);

  const isReviewed = actions.reviewed.includes(threadId);
  const isDeferred = actions.deferred.includes(threadId);
  const isWaiting = actions.markedWaiting.includes(threadId);
  const mine = actions.suggestions.filter((s) => s.threadId === threadId);

  // Corrected in Stage 5. `window.location.assign` reloaded the whole
  // application, which threw away the module's session state, including
  // anything deferred or any draft being reviewed. Inside a single page
  // application the router navigates.
  const navigate = useNavigate();
  const location = useLocation();
  // Where this card is, so the thread can send the person back to it. The old
  // code appended `?tab=` to a path and then let linkTo append `?account=`,
  // which dropped the account. threadHref builds the link in one place.
  const from = destinationForPath(location.pathname).path;
  const go = (tab?: string) => navigate(threadHref(linkTo, threadId, { tab, from }));

  const run = (kind: string) => {
    switch (kind) {
      case 'review':
        actions.toggleReviewed(threadId);
        break;
      case 'defer':
        actions.toggleDeferred(threadId);
        break;
      case 'mark_waiting':
        actions.toggleWaiting(threadId);
        break;
      case 'suggest_task':
        actions.addSuggestion({
          threadId,
          kind: 'task',
          text: `${recommendedNextStep} (${subject})`,
          dueAt: null,
        });
        break;
      case 'suggest_reminder':
        actions.addSuggestion({
          threadId,
          kind: 'reminder',
          text: `Check back on: ${subject}`,
          dueAt: suggestedFollowUpAt ?? null,
        });
        break;
      case 'view_thread':
        go();
        break;
      case 'view_summary':
        go('overview');
        break;
      case 'draft_reply':
        go('draft');
        break;
    }
  };

  const pressed = (kind: string): boolean | undefined => {
    if (kind === 'review') return isReviewed;
    if (kind === 'defer') return isDeferred;
    if (kind === 'mark_waiting') return isWaiting;
    return undefined;
  };

  // "View thread" and "Draft reply" are the two things a person most often wants
  // from a card, so they are real links in front of the card rather than two of
  // nine buttons behind a toggle. They are removed from the group so nothing is
  // offered twice. All eight actions still exist.
  const PROMOTED = ['view_thread', 'draft_reply'];
  const visible = ITEM_ACTIONS.filter((a) => !PROMOTED.includes(a.kind));

  return (
    <div className="ecc-actions">
      <div className="ecc-primary-actions">
        <Link className="ecc-open-thread" to={threadHref(linkTo, threadId, { from })}>
          <Icons.Mail size={14} aria-hidden="true" />
          Open thread
          <span className="ecc-visually-hidden">: {subject}</span>
        </Link>
        {draftAvailable ? (
          <Link
            className="ecc-open-draft"
            to={threadHref(linkTo, threadId, { tab: 'draft', from })}
            aria-describedby={`${groupId}-draft-link`}
          >
            <Icons.PenLine size={14} aria-hidden="true" />
            Review draft
            <span className="ecc-visually-hidden">: {subject}</span>
          </Link>
        ) : null}
        {draftAvailable ? (
          <span id={`${groupId}-draft-link`} className="ecc-visually-hidden">
            Opens the prepared draft for review. Nothing is written to a mailbox and nothing is sent.
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="btn-secondary ecc-actions-toggle"
        aria-expanded={open}
        aria-controls={groupId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icons.MoreHorizontal size={14} aria-hidden="true" />
        {open ? 'Hide actions' : 'Actions'}
        <span className="ecc-visually-hidden"> for {subject}</span>
      </button>

      <div
        id={groupId}
        className={`ecc-action-group ${open ? 'ecc-action-group-open' : ''}`}
        role="group"
        aria-label={`Actions for ${subject}`}
        hidden={!open}
      >
        {visible.map((action) => {
          const state = pressed(action.kind);
          const descriptionId = `${groupId}-${action.kind}-desc`;
          return (
            <span key={action.kind} className="ecc-action-wrap">
              <button
                type="button"
                className={`ecc-action ${state ? 'ecc-action-on' : ''}`}
                aria-pressed={state}
                aria-describedby={descriptionId}
                onClick={() => run(action.kind)}
              >
                <Icon name={action.iconName} />
                {action.label}
              </button>
              <span id={descriptionId} className="ecc-visually-hidden">
                {action.effect}
              </span>
            </span>
          );
        })}
        <span className="ecc-action-wrap">
          <button
            type="button"
            className="ecc-action"
            onClick={() => actions.ignoreEmail(threadId)}
            title="Ignore email: removes from overview and working queues, marks done"
            aria-label={`Ignore email for ${subject}`}
          >
            <Icons.CheckCircle2 size={13} color="#FCA5A5" />
            Ignore email
          </button>
          <span className="ecc-visually-hidden">Removes this thread from overview and queues.</span>
        </span>
      </div>

      {(isDeferred || isWaiting || isReviewed) && (
        <p className="ecc-action-state">
          {[
            isReviewed ? 'Reviewed' : null,
            isDeferred ? 'Deferred' : null,
            isWaiting ? 'Marked as waiting' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {' · this visit only, nothing is saved'}
        </p>
      )}

      {mine.length > 0 && (
        <ul className="ecc-suggestions" aria-label={`Suggestions written for ${subject}`}>
          {mine.map((s) => (
            <li key={s.id}>
              <span className="ecc-suggestion-kind">{s.kind === 'task' ? 'Task' : 'Reminder'}</span>
              <span className="ecc-suggestion-text">{s.text}</span>
              <button
                type="button"
                className="ecc-text-button"
                onClick={() => actions.removeSuggestion(s.id)}
              >
                Remove
                <span className="ecc-visually-hidden"> this suggestion</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
