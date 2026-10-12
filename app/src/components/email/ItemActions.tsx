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
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ITEM_ACTIONS, useLocalActions } from '../../lib/email/localActions';

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
  const go = (path: string) => navigate(linkTo(path));

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
        go(`/email/thread/${threadId}`);
        break;
      case 'view_summary':
        go(`/email/thread/${threadId}?tab=overview`);
        break;
      case 'draft_reply':
        go(`/email/thread/${threadId}?tab=draft`);
        break;
    }
  };

  const pressed = (kind: string): boolean | undefined => {
    if (kind === 'review') return isReviewed;
    if (kind === 'defer') return isDeferred;
    if (kind === 'mark_waiting') return isWaiting;
    return undefined;
  };

  const visible = ITEM_ACTIONS.filter((a) => a.kind !== 'draft_reply' || draftAvailable);

  return (
    <div className="ecc-actions">
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
