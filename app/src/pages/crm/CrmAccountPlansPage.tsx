/**
 * Account plans: the index, and the place the feature explains its own absence.
 *
 * TWO VERY DIFFERENT PAGES LIVE IN THIS FILE.
 *
 * Where account planning is ON, this is an index of the accounts that have a
 * plan, plus the accounts that might be worth one, plus the parts of each plan
 * nobody has written. Ordinary.
 *
 * Where it is OFF, this page is reachable only by typing the URL, because the
 * tab is not in the row. So the off state is not an error and not an upsell. It
 * says the feature is off, says who can turn it on, and says plainly that most
 * work does not need it. A person who arrived here by accident should leave
 * without feeling they are missing something.
 *
 * WHAT IS NOT ON THIS PAGE.
 *
 * No plan completeness bar. No account health. No ranking of which accounts
 * matter. "Accounts that might be worth a plan" lists FACTS about each one,
 * never a score, and the person decides.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, useCrmWrite } from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import { accountPlansIn } from '../../lib/crm/stage6/accountPlan';
import {
  maySwitchPlanningOn,
  planCandidates,
  planningVisibility,
} from '../../lib/crm/stage6/visibility';
import { setAccountPlanning, startAccountPlan } from '../../lib/crm/stage6/planWrites';
import { CRM_SESSION_NOW } from '../../lib/crm/stage5/session';

export const CrmAccountPlansPage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const write = useCrmWrite();

  const visibility = React.useMemo(() => planningVisibility(data), [data]);
  const plans = React.useMemo(() => accountPlansIn(data, CRM_SESSION_NOW), [data]);
  const candidates = React.useMemo(
    () => planCandidates(data).filter((c) => !c.hasPlan),
    [data]
  );

  /* ------------------------------------------------- the off state */

  if (!visibility.showDestinations) {
    const canTurnOn = maySwitchPlanningOn(write.role);

    return (
      <Stage4Scaffold
        title="Account planning"
        description="Turned off for this workspace."
        loadingLabel="account planning"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
        toolbar={<RolePicker />}
      >
        <section className="ccrm-panel" aria-labelledby="ap-off">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="ap-off">
                Account planning is off here
              </h3>
              <p className="ccrm-panel-description">{visibility.offBecause}</p>
            </div>
          </div>

          <p className="ccrm-policy" role="note">
            This is not a locked feature and there is nothing to buy. Account planning is work:
            objectives, a stakeholder map, a whitespace grid and a review every quarter. Most
            businesses do not need it for most of their customers, and a product that insists
            otherwise is selling ceremony. It stays out of the way until somebody decides it is
            worth the effort, and it is off for {visibility.unplannedCount}{' '}
            {visibility.unplannedCount === 1 ? 'account' : 'accounts'} in this workspace right now.
          </p>

          {canTurnOn ? (
            <div className="ccrm-capture-actions">
              <button
                type="button"
                className="btn-secondary ccrm-button ccrm-button-primary"
                onClick={() =>
                  write.run('Account planning is on for this workspace.', (context, workspace) =>
                    setAccountPlanning(context, workspace, true)
                  )
                }
              >
                Turn account planning on
              </button>
            </div>
          ) : (
            <p className="ccrm-field-hint">
              An administrator turns this on. You are acting as {write.role.replace('crm_', '')}.
            </p>
          )}
        </section>
      </Stage4Scaffold>
    );
  }

  /* ------------------------------------------------- the on state */

  return (
    <Stage4Scaffold
      title="Account plans"
      description="What each account is working towards, what is written down about it, and what is not."
      loadingLabel="account plans"
      emptyTitle="No account has a plan yet"
      emptyBody="Account planning is on for this workspace, and no plan has been started. The accounts below are the ones that have something recorded that usually means a plan is worth the effort."
      resultCount={plans.length}
      totalCount={data.organisations.filter((o) => o.deletedAt === null).length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy ccrm-not-ranked" role="note">
        There is no plan score and no completeness bar here. A percentage of a plan filled in
        rewards nine shallow risks over the one real one, and it becomes a number about the person
        who owns the account. Each plan says instead what nobody has written down yet.
      </p>

      <h3 className="ccrm-group-title">
        Accounts with a plan
        <span className="ccrm-stage-count">{plans.length}</span>
      </h3>

      {plans.length === 0 ? (
        <p className="ccrm-panel-empty">No account here has a plan.</p>
      ) : (
        <div className="ccrm-panel-grid">
          {plans.map((plan) => (
            <section className="ccrm-panel" key={plan.plan.id}>
              <div className="ccrm-panel-head">
                <div>
                  <h4 className="ccrm-panel-title">
                    <Link
                      className="ccrm-text-link"
                      to={linkTo(`/crm/account-plans/${plan.organisation.id}`)}
                    >
                      {plan.organisation.name}
                    </Link>
                  </h4>
                  <p className="ccrm-panel-description">{plan.plan.objective}</p>
                </div>
              </div>

              <dl className="ccrm-facts">
                <div>
                  <dt>Reviewed</dt>
                  <dd>
                    {plan.lastReviewedAt ? (
                      <>
                        {plan.lastReviewedAt.slice(0, 10)}
                        {plan.daysSinceReview !== null ? `, ${plan.daysSinceReview} days ago` : ''}
                      </>
                    ) : (
                      <span className="ccrm-absent">Never</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Cadence</dt>
                  <dd>{plan.reviewCadenceWord}</dd>
                </div>
                <div>
                  <dt>Objectives</dt>
                  <dd>{plan.objectives.length}</dd>
                </div>
                <div>
                  <dt>Open actions</dt>
                  <dd>
                    {plan.openActions.length}
                    {plan.overdueActions.length > 0
                      ? `, ${plan.overdueActions.length} overdue`
                      : ''}
                  </dd>
                </div>
              </dl>

              {plan.reviewOverdueDays !== null ? (
                <p className="ccrm-before-contact">
                  This review was due {plan.reviewOverdueDays} days ago.
                </p>
              ) : null}

              {plan.notRecorded.length > 0 ? (
                <div className="ccrm-missing-block">
                  <p className="ccrm-field-label">Nobody has written</p>
                  <ul className="ccrm-plain-list">
                    {plan.notRecorded.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="ccrm-field-hint">
                  Every part of this plan has something written in it.
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      <h3 className="ccrm-group-title">
        Accounts that might be worth a plan
        <span className="ccrm-stage-count">{candidates.length}</span>
      </h3>

      <p className="ccrm-field-hint">
        These are facts about each account, not a recommendation and not a ranking. Most accounts
        never need a plan.
      </p>

      {candidates.length === 0 ? (
        <p className="ccrm-panel-empty">
          Nothing else here has enough recorded against it to suggest a plan either way.
        </p>
      ) : (
        <ul className="ccrm-item-list">
          {candidates.map((candidate) => (
            <li key={candidate.organisation.id}>
              <span className="ccrm-item">
                <span className="ccrm-item-main">
                  <span className="ccrm-item-title">{candidate.organisation.name}</span>
                  <span className="ccrm-item-context">
                    <Value value={candidate.organisation.industry} absent="Industry not recorded" />
                  </span>
                  <ul className="ccrm-plain-list">
                    {candidate.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </span>
                <button
                  type="button"
                  className="btn-secondary ccrm-button"
                  onClick={() =>
                    write.run('The plan was started.', (context, workspace) =>
                      startAccountPlan(context, workspace, {
                        organisationId: candidate.organisation.id,
                        objective: `What we are trying to achieve with ${candidate.organisation.name}.`,
                      })
                    )
                  }
                >
                  Start a plan
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Stage4Scaffold>
  );
};
