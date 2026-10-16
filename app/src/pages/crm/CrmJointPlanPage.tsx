/**
 * The joint action plan, and the preview of it.
 *
 * WHAT IS NOT ON THIS PAGE, AND WHY IT IS NOT A SETTING.
 *
 * There is no share button, no copy-link, no send, no export and no recipient
 * field, and there is no toggle anywhere that would produce one. The brief says
 * external sharing stays disabled until it has been securely designed and
 * approved, and the way to honour that is to not build the thing rather than to
 * build it behind a flag. A flag gets flipped by somebody who was not in the
 * conversation where it was decided.
 *
 * The preview below is INTERNAL. It is what the customer would see, rendered
 * for somebody who works here, so a person can check what they are about to
 * read out in a meeting. It sends nothing, and the page says so above it and
 * inside it.
 *
 * APPROVAL IS A SEPARATE ROLE, ON PURPOSE. The person who writes the plan can
 * send it for review. Approving it needs the approver role, and the write path
 * refuses otherwise. A plan that goes to a customer is a commitment made on
 * behalf of the company.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, WriteResultLine, useCrmWrite } from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import { buildJointPlan, previewOf } from '../../lib/crm/stage6/jointPlan';
import { approveJointPlan, sendForReview, withdrawJointPlan } from '../../lib/crm/stage6/planWrites';
import { mayApprove, planningEnabled } from '../../lib/crm/stage6/visibility';
import { CRM_SESSION_NOW } from '../../lib/crm/stage5/session';

export const CrmJointPlanPage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const { jointPlanId } = useParams<{ jointPlanId: string }>();
  const write = useCrmWrite();

  const [showPreview, setShowPreview] = React.useState(false);
  const [withdrawReason, setWithdrawReason] = React.useState('');

  const view = React.useMemo(
    () =>
      jointPlanId && planningEnabled(data)
        ? buildJointPlan(data, jointPlanId, CRM_SESSION_NOW)
        : null,
    [data, jointPlanId]
  );

  if (!view) {
    return (
      <Stage4Scaffold
        title="No joint plan here"
        description="Either account planning is off in this workspace, or this plan is not in it."
        loadingLabel="the joint plan"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
      >
        <p className="ccrm-panel-empty">
          <Link className="ccrm-text-link" to={linkTo('/crm/account-plans')}>
            Back to account plans
          </Link>
        </p>
      </Stage4Scaffold>
    );
  }

  const canApprove = mayApprove(data, write.role);
  const preview = previewOf(view);

  return (
    <Stage4Scaffold
      title="Joint action plan"
      description={view.plan.sharedObjective}
      loadingLabel="the joint plan"
      emptyTitle=""
      emptyBody=""
      resultCount={view.actions.length}
      totalCount={view.actions.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      {/* The safeguard, stated before anything else on the page. */}
      <p className="ccrm-sharing-note ccrm-policy" role="note">
        {view.sharingNote}
      </p>

      {view.organisation ? (
        <Link
          className="ccrm-back-link"
          to={linkTo(`/crm/account-plans/${view.organisation.id}`)}
        >
          Back to the account plan for {view.organisation.name}
        </Link>
      ) : null}

      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{view.actions.length}</span>
            <span className="ccrm-card-label">Actions</span>
            <span className="ccrm-card-note">
              {view.theirs.length} of them theirs. A plan with none of them theirs is our to-do
              list.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{view.overdueCount}</span>
            <span className="ccrm-card-label">Overdue</span>
            <span className="ccrm-card-note">Past the date recorded against them.</span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{view.blockedCount}</span>
            <span className="ccrm-card-label">Waiting or blocked</span>
            <span className="ccrm-card-note">Each one says what it is waiting on.</span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count ccrm-card-word">{view.approvalWord}</span>
            <span className="ccrm-card-label">Approval</span>
            <span className="ccrm-card-note">{view.approvalMeaning}</span>
          </span>
        </li>
      </ul>

      {/* ---- the actions ---- */}
      <section className="ccrm-panel" aria-labelledby="jp-actions">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="jp-actions">
              What each side is doing
            </h3>
            <p className="ccrm-panel-description">
              Last changed{' '}
              {view.lastChangedAt ? view.lastChangedAt.slice(0, 10) : 'never, since it was written'}.
            </p>
          </div>
        </div>

        {view.actions.length === 0 ? (
          <p className="ccrm-panel-empty">No action has been added to this plan.</p>
        ) : (
          <div className="ccrm-grid-scroll">
            <table className="ccrm-table">
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Side</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Date</th>
                  <th scope="col">State</th>
                  <th scope="col">Waiting on</th>
                </tr>
              </thead>
              <tbody>
                {view.actions.map((row) => (
                  <tr key={row.action.id}>
                    <th scope="row">{row.action.description}</th>
                    <td>{row.side}</td>
                    <td>{row.ownerLabel}</td>
                    <td>
                      {row.dueDate ? (
                        <>
                          {row.dueDate}
                          {row.overdueDays !== null ? (
                            <span className="ccrm-overdue"> {row.overdueDays} days over</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="ccrm-absent">No date</span>
                      )}
                    </td>
                    <td>{row.stateWord}</td>
                    <td>
                      {row.waitingOn.length === 0 ? (
                        <span className="ccrm-absent">Nothing</span>
                      ) : (
                        row.waitingOn.join('; ')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- approval ---- */}
      <section className="ccrm-panel" aria-labelledby="jp-approval">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="jp-approval">
              Approval
            </h3>
            <p className="ccrm-panel-description">
              Internal only. This is as far as a plan goes in this release.
            </p>
          </div>
        </div>

        {view.readiness.length > 0 ? (
          <div className="ccrm-missing-block">
            <p className="ccrm-field-label">Settle these before asking anybody to approve it</p>
            <ul className="ccrm-plain-list">
              {view.readiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ccrm-field-hint">
            Nothing is outstanding on the plan itself.
          </p>
        )}

        {view.plan.approvedAt ? (
          <p className="ccrm-field-hint">
            Approved on {view.plan.approvedAt.slice(0, 10)}, with the approver recorded against it.
          </p>
        ) : null}

        {view.plan.reviewNote ? (
          <p className="ccrm-before-contact">Withdrawn: {view.plan.reviewNote}</p>
        ) : null}

        <div className="ccrm-capture-actions">
          {view.plan.approvalState === 'draft' || view.plan.approvalState === 'withdrawn' ? (
            <button
              type="button"
              className="btn-secondary ccrm-button"
              onClick={() =>
                write.run('It was sent for review.', (context, workspace) =>
                  sendForReview(context, workspace, view.plan.id)
                )
              }
            >
              Send it for review
            </button>
          ) : null}

          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            disabled={!view.canBeApproved || !canApprove}
            onClick={() =>
              write.run('It was approved internally.', (context, workspace) =>
                approveJointPlan(context, workspace, view.plan.id)
              )
            }
          >
            Approve it internally
          </button>
        </div>

        {!canApprove ? (
          <p className="ccrm-field-hint">
            Approving needs the approver role. You are acting as {write.role.replace('crm_', '')}.
          </p>
        ) : view.cannotBeApprovedBecause ? (
          <p className="ccrm-field-hint">{view.cannotBeApprovedBecause}</p>
        ) : null}

        {view.plan.approvalState === 'approved_internally' && canApprove ? (
          <div className="ccrm-field">
            <label className="ccrm-field-label" htmlFor="jp-withdraw">
              Withdraw it, with a reason <span className="ccrm-required">required</span>
            </label>
            <input
              id="jp-withdraw"
              className="form-input"
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
            />
            <button
              type="button"
              className="btn-secondary ccrm-button"
              disabled={withdrawReason.trim().length === 0}
              onClick={() =>
                write.run('It was withdrawn.', (context, workspace) =>
                  withdrawJointPlan(context, workspace, view.plan.id, withdrawReason)
                )
              }
            >
              Withdraw it
            </button>
          </div>
        ) : null}

        <WriteResultLine result={write.last} onClear={write.clearLast} />
      </section>

      {/* ---- the internal preview ---- */}
      <section className="ccrm-panel" aria-labelledby="jp-preview">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="jp-preview">
              What the customer would see
            </h3>
            <p className="ccrm-panel-description">
              Rendered here, for you. Nothing on this page sends it anywhere, and this release has
              no way to.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary ccrm-button"
            aria-expanded={showPreview}
            onClick={() => setShowPreview((open) => !open)}
          >
            {showPreview ? 'Hide the preview' : 'Show the preview'}
          </button>
        </div>

        {showPreview ? (
          <div className="ccrm-preview">
            <p className="ccrm-preview-not-shared">{preview.notSharedNote}</p>
            <h4 className="ccrm-preview-title">
              <Value value={preview.organisationName} absent="This account" /> and Concludo
            </h4>
            <p className="ccrm-preview-objective">{preview.sharedObjective}</p>
            <ol className="ccrm-preview-actions">
              {preview.actions.map((action, index) => (
                <li key={`${action.description}-${index}`}>
                  <span className="ccrm-preview-action">{action.description}</span>
                  <span className="ccrm-preview-meta">
                    {action.side === 'Ours' ? 'Concludo' : preview.organisationName ?? 'The customer'}
                    {' · '}
                    {action.owner}
                    {action.dueDate ? ` · by ${action.dueDate}` : ' · no date agreed'}
                    {' · '}
                    {action.state}
                  </span>
                  {action.waitingOn.length > 0 ? (
                    <span className="ccrm-preview-waiting">
                      Waiting on: {action.waitingOn.join('; ')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </Stage4Scaffold>
  );
};
