/**
 * The pieces the write-path views share.
 *
 * `useCrmWrite` is the important one. It is the only way a view performs a
 * write, and it does three things every write needs and none of them is
 * optional:
 *
 *   it builds the context, so the role and the workspace come from one place
 *   rather than from whatever the component had to hand;
 *   it turns a refusal into a message on the screen instead of a thrown error
 *   in a console nobody is watching;
 *   it tells every other view that something changed.
 *
 * The role is a control rather than a constant. Stage 3 built four roles and
 * row level security over them; a demonstration that always runs as an
 * administrator proves none of it. Switching to viewer and watching the buttons
 * refuse themselves, with the reason, is the only way to see that the gate is
 * real.
 */
import React from 'react';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { CrmRole, CrmWorkspaceData } from '../../lib/crm/domain';
import { CrmContext, CrmRefused } from '../../lib/crm/repositories/repository';
import {
  CRM_SESSION_NOW,
  notifyWritten,
  resetSession,
  sessionChangeCount,
} from '../../lib/crm/stage5/session';
import { useStage4 } from './Stage4Scaffold';

/* ----------------------------------------------------- who is writing */

export const ROLE_LABELS: Record<CrmRole, string> = {
  crm_viewer: 'Viewer',
  crm_contributor: 'Contributor',
  crm_approver: 'Approver',
  crm_admin: 'Administrator',
};

export const ROLE_MEANINGS: Record<CrmRole, string> = {
  crm_viewer: 'Reads everything here. Changes nothing.',
  crm_contributor: 'Creates and changes records.',
  crm_approver: 'Also confirms or declines a proposed update.',
  crm_admin: 'Also manages membership, terminology and retention.',
};

/** Held outside React so a role change survives a route change. */
let actingRole: CrmRole = 'crm_contributor';

export function setActingRole(role: CrmRole): void {
  actingRole = role;
  notifyWritten();
}

export function currentActingRole(): CrmRole {
  return actingRole;
}

/* ------------------------------------------------------- the write hook */

export interface WriteResult {
  ok: boolean;
  message: string;
}

export interface CrmWrite {
  data: CrmWorkspaceData;
  context: CrmContext;
  role: CrmRole;
  /** The last thing that happened, for the screen to say. */
  last: WriteResult | null;
  clearLast: () => void;
  /** Runs a write, catches a refusal, and reports it in words. */
  run: <T>(what: string, write: (context: CrmContext, data: CrmWorkspaceData) => T) => T | null;
}

export function useCrmWrite(): CrmWrite {
  const { data, viewState } = useStage4();
  const [last, setLast] = React.useState<WriteResult | null>(null);

  const member = data.members.find((m) => m.userId === data.members[0]?.userId);

  const context: CrmContext = {
    // The first member of the workspace is who the demonstration acts as. The
    // ROLE is switchable, which is the part that matters: the gate is the role,
    // not the name.
    userId: member?.userId ?? 'u-unknown',
    workspaceId: viewState.workspaceId,
    role: actingRole,
    now: CRM_SESSION_NOW,
  };

  const run = React.useCallback(
    <T,>(what: string, write: (context: CrmContext, data: CrmWorkspaceData) => T): T | null => {
      try {
        const result = write(context, data);
        setLast({ ok: true, message: `${what} Recorded, with an audit entry.` });
        notifyWritten();
        return result;
      } catch (error) {
        // A refusal is a sentence, not a stack trace. `because` is written to
        // be read by the person who hit it.
        const message =
          error instanceof CrmRefused
            ? error.because
            : error instanceof Error
              ? error.message
              : 'Something went wrong and the module could not say what.';
        setLast({ ok: false, message });
        return null;
      }
    },
    [context, data]
  );

  return {
    data,
    context,
    role: actingRole,
    last,
    clearLast: () => setLast(null),
    run,
  };
}

/* --------------------------------------------------------- the banner */

/**
 * What this release does and does not do with a write.
 *
 * On every page that writes. A demonstration that saves things and does not say
 * where they went is the one a buyer asks an awkward question about, and the
 * honest answer is better said first.
 */
export const WriteNotice: React.FC = () => {
  const { viewState } = useStage4();
  const [, bump] = React.useState(0);
  const changes = sessionChangeCount(viewState.workspaceId);

  return (
    <div className="ccrm-write-notice" role="note">
      {/* SAID BEFORE, NOT AFTER.
          The write path refuses a viewer on role, and that refusal is the thing
          that actually holds. But a page that renders a working save button to
          somebody who may not save has already wasted their time by the moment
          it explains itself, so the role is stated at the top where it is read
          before anything is typed. */}
      {actingRole === 'crm_viewer' ? (
        <p className="ccrm-write-notice-readonly">
          You are acting as a viewer. Nothing on this page can be saved in that role, and anything
          you try will be refused with the reason. Change &ldquo;Acting as&rdquo; above to make
          changes.
        </p>
      ) : null}
      <p className="ccrm-write-notice-body">
        Changes made here are held in this browser tab and go nowhere else. No customer
        information, mailbox, accounting system or database is connected. Every record is
        synthetic, and closing the tab puts everything back.
      </p>
      <p className="ccrm-write-notice-meta">
        {changes} {changes === 1 ? 'entry' : 'entries'} in this workspace&rsquo;s audit trail,
        including a short history seeded when the page loaded so the stage and close-date views
        have something to show.
        <button
          type="button"
          className="ccrm-reset-button"
          onClick={() => {
            resetSession();
            bump((n) => n + 1);
          }}
        >
          <RotateCcw size={12} aria-hidden="true" />
          Put everything back
        </button>
      </p>
    </div>
  );
};

/* --------------------------------------------------------- role picker */

export const RolePicker: React.FC = () => {
  const [, bump] = React.useState(0);

  return (
    <div className="ccrm-role-picker">
      <label className="ccrm-workspace-label" htmlFor="ccrm-acting-role">
        Acting as
      </label>
      <select
        id="ccrm-acting-role"
        className="form-select ccrm-workspace-select"
        value={actingRole}
        onChange={(event) => {
          setActingRole(event.target.value as CrmRole);
          bump((n) => n + 1);
        }}
      >
        {(Object.keys(ROLE_LABELS) as CrmRole[]).map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <span className="ccrm-role-meaning">{ROLE_MEANINGS[actingRole]}</span>
    </div>
  );
};

/* ------------------------------------------------------- the result line */

export const WriteResultLine: React.FC<{ result: WriteResult | null; onClear: () => void }> = ({
  result,
  onClear,
}) => {
  if (!result) return null;

  return (
    <p
      className={`ccrm-write-result${result.ok ? '' : ' ccrm-write-result-refused'}`}
      role="status"
    >
      {result.ok ? (
        <Check size={14} aria-hidden="true" />
      ) : (
        <AlertTriangle size={14} aria-hidden="true" />
      )}
      <span>{result.message}</span>
      <button type="button" className="ccrm-reset-button" onClick={onClear}>
        Dismiss
      </button>
    </p>
  );
};

/* ------------------------------------------------------- a small field */

export const Field: React.FC<{
  label: string;
  id: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, id, hint, required, children }) => (
  <div className="ccrm-field">
    <label className="ccrm-field-label" htmlFor={id}>
      {label}
      {required ? (
        <span className="ccrm-field-required"> required</span>
      ) : (
        <span className="ccrm-field-optional"> optional</span>
      )}
    </label>
    {children}
    {hint ? <span className="ccrm-field-hint">{hint}</span> : null}
  </div>
);
