/**
 * Email Settings. It shows what will be configurable and what is not yet
 * possible, rather than a form that saves nothing.
 *
 * Nothing on this page connects a mailbox. Connection needs the token store,
 * the scopes and the revocation path, which are specified and not built.
 *
 * Stage 7 added the register of actions that would reach outside Concludo. It
 * is generated from `approvals.ts` rather than written here, so the page cannot
 * claim an action is off while the code has it on. If somebody turns one on,
 * this table changes by itself.
 */
import React from 'react';
import { ShieldCheck, Lock, Briefcase, House } from 'lucide-react';
import { SYNTHETIC_ACCOUNTS } from '../../lib/email/shellAdapter';
import {
  APPROVAL_GUARANTEE,
  DESTRUCTIVE_BULK_ACTIONS,
  EXTERNAL_ACTIONS,
} from '../../lib/email/approvals';

export const EmailSettingsPage: React.FC = () => (
  <section className="ecc-page" aria-labelledby="ecc-settings-heading">
    <h2 id="ecc-settings-heading" className="ecc-page-title">
      Email Settings
    </h2>
    <p className="ecc-page-description">
      Accounts, exclusions and preferences. Nothing here connects a mailbox yet.
    </p>

    <div className="content-card ecc-settings-card">
      <h3 className="ecc-settings-title">Accounts</h3>
      <ul className="ecc-account-list">
        {SYNTHETIC_ACCOUNTS.map((account) => (
          <li key={account.id} className="ecc-account-item">
            <span
              className={`ecc-account-badge ${
                account.accountType === 'work' ? 'ecc-account-work' : 'ecc-account-personal'
              }`}
            >
              {account.accountType === 'work' ? (
                <Briefcase size={12} aria-hidden="true" />
              ) : (
                <House size={12} aria-hidden="true" />
              )}
              {account.accountType === 'work' ? 'Work' : 'Personal'}
            </span>
            <span className="ecc-account-name">
              {account.label}, {account.address}
            </span>
            <span className="ecc-account-state">
              <Lock size={12} aria-hidden="true" />
              Not connected
            </span>
          </li>
        ))}
      </ul>
      <p className="ecc-settings-note">
        These are demonstration accounts. Connecting a real mailbox needs the token store, the
        permission scopes and the revocation path, none of which exist yet. That work is a separate
        stage with its own security design.
      </p>
    </div>

    <div className="content-card ecc-settings-card">
      <h3 className="ecc-settings-title">What this module will never do</h3>
      <ul className="ecc-rule-list">
        <li>
          <ShieldCheck size={14} aria-hidden="true" />
          Send, reply to or forward a message.
        </li>
        <li>
          <ShieldCheck size={14} aria-hidden="true" />
          Delete, archive, label, file or mark anything as read.
        </li>
        <li>
          <ShieldCheck size={14} aria-hidden="true" />
          Unsubscribe, create a rule or set an automatic reply.
        </li>
        <li>
          <ShieldCheck size={14} aria-hidden="true" />
          Combine a work account with a personal one.
        </li>
        <li>
          <ShieldCheck size={14} aria-hidden="true" />
          Write a draft to a mailbox without your approval of that exact text.
        </li>
      </ul>
      <p className="ecc-settings-note">
        These are enforced in code, not only described here. The tool allowlist and denylist sit in
        the module's operating specification.
      </p>
    </div>

    <div className="content-card ecc-settings-card">
      <h3 className="ecc-settings-title">Actions that would reach outside Concludo</h3>
      <p className="ecc-settings-note">{APPROVAL_GUARANTEE.statement}</p>
      <table className="ecc-approval-table">
        <caption className="ecc-visually-hidden">
          Every action that would touch something outside Concludo, its state in this release, and
          why.
        </caption>
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">State</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {EXTERNAL_ACTIONS.map((action) => (
            <tr key={action.kind}>
              <td data-label="Action">{action.label}</td>
              <td data-label="State">
                <span
                  className={`ecc-approval-state ${
                    action.release === 'available_with_approval' ? 'is-available' : 'is-off'
                  }`}
                >
                  {action.release === 'available_with_approval'
                    ? 'Needs your approval, every time'
                    : 'Not available in this release'}
                </span>
              </td>
              <td data-label="Why">{action.releaseReason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="ecc-settings-subtitle">Bulk actions</h4>
      <ul className="ecc-rule-list">
        {DESTRUCTIVE_BULK_ACTIONS.map((bulk) => (
          <li key={bulk.name}>
            <ShieldCheck size={14} aria-hidden="true" />
            {bulk.name}: off. {bulk.why}
          </li>
        ))}
      </ul>
    </div>

    <div className="content-card ecc-settings-card">
      <h3 className="ecc-settings-title">Planned preferences</h3>
      <p className="ecc-settings-note">
        Listed so the shape is visible, and not shown as controls, because there is nowhere to save
        them yet. Working hours and time zone. Reply tone and sign-off. Priority contacts and
        domains. Topics that always escalate. Folders, labels and senders to exclude. Whether
        drafts may be written to the mailbox. How long analysis is kept.
      </p>
    </div>
  </section>
);
