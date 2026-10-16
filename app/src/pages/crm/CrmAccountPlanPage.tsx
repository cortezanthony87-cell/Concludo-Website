/**
 * One account plan, with the twenty things the brief names.
 *
 * THE LAYOUT IS THE ARGUMENT.
 *
 * The page is in two columns on a wide screen, and the split is not decorative:
 * the left is read from the records every time the page opens, the right is
 * what people here have written. A reader who cannot tell a recorded fact from
 * somebody's opinion will treat the opinion as a fact, defend it in a meeting,
 * and be wrong in front of a customer. So the page says which is which, at the
 * top, in words, and keeps them apart visually all the way down.
 *
 * The parts that are large enough to be screens of their own, the stakeholder
 * map, the whitespace grid, the joint plans and the review, are summarised here
 * and linked. They are not tabs in the module's navigation, because a feature
 * that adds five destinations to everybody's tab row has not been kept out of
 * the way of the people who do not need it.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, WriteResultLine, useCrmWrite } from '../../components/crm/Stage5Pieces';
import { SourceTrailList } from '../../components/crm/Stage4Scaffold';
import { Value } from '../../components/crm/viewPrimitives';
import { useParams } from 'react-router-dom';
import { buildAccountPlan, PlanSectionView } from '../../lib/crm/stage6/accountPlan';
import { recordReview } from '../../lib/crm/stage6/planWrites';
import { CRM_SESSION_NOW } from '../../lib/crm/stage5/session';
import { planningEnabled } from '../../lib/crm/stage6/visibility';

const Section: React.FC<{ view: PlanSectionView; linkTo: (p: string) => string }> = ({
  view,
  linkTo,
}) => (
  <section className="ccrm-plan-section" aria-labelledby={`plan-${view.section}`}>
    <h4 className="ccrm-plan-section-title" id={`plan-${view.section}`}>
      {view.word}
    </h4>
    {view.entries.length === 0 ? (
      <p className="ccrm-plan-empty">{view.emptyMessage}</p>
    ) : (
      <ul className="ccrm-plan-entries">
        {view.entries.map(({ entry, evidence }) => (
          <li key={entry.id}>
            <p className="ccrm-plan-entry-body">{entry.body}</p>
            {evidence ? (
              <p className="ccrm-plan-entry-source">
                {evidence.record
                  ? `From ${evidence.record.label}`
                  : (evidence.unavailableBecause ?? 'Source not held')}
                {evidence.sourceText ? `: \u201c${evidence.sourceText}\u201d` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const CrmAccountPlanPage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const { organisationId } = useParams<{ organisationId: string }>();
  const write = useCrmWrite();

  const plan = React.useMemo(
    () => (organisationId ? buildAccountPlan(data, organisationId, CRM_SESSION_NOW) : null),
    [data, organisationId]
  );

  if (!planningEnabled(data)) {
    return (
      <Stage4Scaffold
        title="Account planning is off for this workspace"
        description="Nothing to show here."
        loadingLabel="the account plan"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
      >
        <p className="ccrm-panel-empty">
          Account planning is turned off in this workspace, so there are no plans to open. The
          account itself is still{' '}
          <Link className="ccrm-text-link" to={linkTo('/crm/organisations')}>
            in the organisations list
          </Link>
          .
        </p>
      </Stage4Scaffold>
    );
  }

  if (!plan) {
    return (
      <Stage4Scaffold
        title="That account is not in this workspace, or has no plan"
        description="Nothing is shown, because nothing here would be about the account you asked for."
        loadingLabel="the account plan"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
      >
        <p className="ccrm-panel-empty">
          Either this account belongs to another workspace, or nobody has started a plan for it.{' '}
          <Link className="ccrm-text-link" to={linkTo('/crm/account-plans')}>
            Back to account plans
          </Link>
          .
        </p>
      </Stage4Scaffold>
    );
  }

  const stakeholderRisks = plan.stakeholders?.risks ?? [];

  return (
    <Stage4Scaffold
      title={plan.organisation.name}
      description={plan.plan.objective}
      loadingLabel="the account plan"
      emptyTitle=""
      emptyBody=""
      resultCount={1}
      totalCount={1}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-derivation-note ccrm-policy" role="note">
        {plan.derivationNote}
      </p>

      <Link className="ccrm-back-link" to={linkTo('/crm/account-plans')}>
        Back to account plans
      </Link>

      {/* ---- the summary tiles: dates and counts, nothing scored ---- */}
      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">
              {plan.daysSinceReview === null ? 'Never' : `${plan.daysSinceReview} d`}
            </span>
            <span className="ccrm-card-label">Since the last review</span>
            <span className="ccrm-card-note">
              {plan.reviewCadenceWord === 'Not set'
                ? 'No cadence is recorded for this account.'
                : `${plan.reviewCadenceWord} is what this account is meant to get.`}
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">
              {plan.renewalInDays === null ? '—' : `${plan.renewalInDays} d`}
            </span>
            <span className="ccrm-card-label">To renewal</span>
            <span className="ccrm-card-note">
              {plan.renewalDate ? `Recorded as ${plan.renewalDate}.` : 'No renewal date is recorded.'}
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{plan.openServiceCases.length}</span>
            <span className="ccrm-card-label">Open service issues</span>
            <span className="ccrm-card-note">
              Each one carries what it does to the relationship.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{plan.notRecorded.length}</span>
            <span className="ccrm-card-label">Parts nobody has written</span>
            <span className="ccrm-card-note">
              Named below rather than totalled into a single number.
            </span>
          </span>
        </li>
      </ul>

      <div className="ccrm-plan-columns">
        {/* ============================= read from the records ============= */}
        <div className="ccrm-plan-derived">
          <p className="ccrm-plan-column-label">Read from the records, every time this opens</p>

          <section className="ccrm-panel" aria-labelledby="plan-value">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-value">
                  What they use
                </h3>
              </div>
            </div>
            {plan.productsInUse.length === 0 ? (
              <p className="ccrm-panel-empty">
                Nothing is recorded as accepted against this account, so nothing can be listed here.
              </p>
            ) : (
              <ul className="ccrm-plain-list">
                {plan.productsInUse.map((product) => (
                  <li key={product.id}>{product.name}</li>
                ))}
              </ul>
            )}

            {plan.whitespace ? (
              <p className="ccrm-field-hint">
                <Link
                  className="ccrm-text-link"
                  to={linkTo(`/crm/account-plans/${plan.organisation.id}/whitespace`)}
                >
                  The whitespace grid
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>{' '}
                has {plan.whitespace.unknownCount} of {plan.whitespace.totalCells} cells nobody has
                answered.
              </p>
            ) : null}
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-people">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-people">
                  Who we know
                </h3>
                <p className="ccrm-panel-description">
                  {plan.stakeholders?.stakeholders.length ?? 0} people recorded,{' '}
                  {plan.stakeholders?.gapCount ?? 0} things nobody has written about them.
                </p>
              </div>
            </div>

            {/* The stakeholder map's list, not Stage 4's. The two differ
                (Stage 4 counts influencer, Stage 6 counts the economic buyer)
                and showing both on one screen is how a reader concludes the
                software does not know either. */}
            {(plan.stakeholders?.rolesNobodyHolds.length ?? 0) > 0 ? (
              <p className="ccrm-before-contact">
                No one is recorded as:{' '}
                {plan.stakeholders?.rolesNobodyHolds.join(', ').replace(/_/g, ' ')}.
              </p>
            ) : null}

            {stakeholderRisks.length > 0 ? (
              <ul className="ccrm-plain-list">
                {stakeholderRisks.map((risk) => (
                  <li key={risk.kind}>
                    <strong>{risk.what}</strong> {risk.whatWouldHelp}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ccrm-field-hint">
                Nothing about the shape of this relationship is flagged.
              </p>
            )}

            <p className="ccrm-field-hint">
              <Link
                className="ccrm-text-link"
                to={linkTo(`/crm/account-plans/${plan.organisation.id}/stakeholders`)}
              >
                The stakeholder map
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </p>
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-open">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-open">
                  What is open
                </h3>
                {plan.rollUpNote ? (
                  <p className="ccrm-panel-description">{plan.rollUpNote}</p>
                ) : null}
              </div>
            </div>
            <dl className="ccrm-facts">
              <div>
                <dt>Work</dt>
                <dd>{plan.openWork.length}</dd>
              </div>
              <div>
                <dt>Service issues</dt>
                <dd>{plan.openServiceCases.length}</dd>
              </div>
              <div>
                <dt>We promised</dt>
                <dd>{plan.openCommitments.ours.length}</dd>
              </div>
              <div>
                <dt>They promised</dt>
                <dd>{plan.openCommitments.theirs.length}</dd>
              </div>
            </dl>

            {plan.openServiceCases.length > 0 ? (
              <ul className="ccrm-plain-list">
                {plan.openServiceCases.map((kase) => (
                  <li key={kase.id}>
                    <strong>{kase.title}.</strong>{' '}
                    <Value value={kase.relationshipEffect} absent="No effect recorded." />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-proposals">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-proposals">
                  Waiting for somebody here
                </h3>
                <p className="ccrm-panel-description">
                  Proposals about this account that nobody has confirmed or declined.
                </p>
              </div>
            </div>
            {plan.pendingProposals.length === 0 ? (
              <p className="ccrm-panel-empty">Nothing is waiting.</p>
            ) : (
              <ul className="ccrm-plain-list">
                {plan.pendingProposals.map((proposal) => (
                  <li key={proposal.id}>
                    {proposal.headline}. {proposal.rationale}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-evidence">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-evidence">
                  Source evidence
                </h3>
                <p className="ccrm-panel-description">
                  Values on this account that were taken from a conversation.
                </p>
              </div>
            </div>
            <SourceTrailList
              trails={plan.evidence}
              linkTo={linkTo}
              emptyMessage="No stored field on this account carries a source sentence."
            />
          </section>
        </div>

        {/* ============================= written by people ================ */}
        <div className="ccrm-plan-written">
          <p className="ccrm-plan-column-label">
            Written by people here, and only as current as the last person who wrote it
          </p>

          <section className="ccrm-panel" aria-labelledby="plan-summary">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-summary">
                  Where this account stands
                </h3>
              </div>
            </div>
            {plan.summary ? (
              <p className="ccrm-plan-entry-body">{plan.summary}</p>
            ) : (
              <p className="ccrm-plan-empty">
                Nobody has written a summary. It is the part somebody reads first when they take
                this account over.
              </p>
            )}
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-objectives">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-objectives">
                  What the customer is trying to achieve
                </h3>
                <p className="ccrm-panel-description">
                  Each one with how it is measured. An objective with no measure is an aspiration,
                  and the model will not store one.
                </p>
              </div>
            </div>
            {plan.objectives.length === 0 ? (
              <p className="ccrm-plan-empty">
                Nothing recorded. This is the question the first review usually answers.
              </p>
            ) : (
              <ul className="ccrm-plan-entries">
                {plan.objectives.map((objective) => (
                  <li key={objective.id}>
                    <p className="ccrm-plan-entry-body">{objective.label}</p>
                    <p className="ccrm-plan-entry-source">
                      Measured by: {objective.measure}. Recorded as{' '}
                      {objective.state.replace(/_/g, ' ')}.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {plan.sections.map((section) => (
            <section className="ccrm-panel" key={section.section}>
              <Section view={section} linkTo={linkTo} />
            </section>
          ))}

          <section className="ccrm-panel" aria-labelledby="plan-swot">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-swot">
                  Strengths, weaknesses, opportunities and threats
                </h3>
              </div>
            </div>
            <div className="ccrm-swot">
              <Section view={plan.swot.strengths} linkTo={linkTo} />
              <Section view={plan.swot.weaknesses} linkTo={linkTo} />
              <Section view={plan.swot.opportunities} linkTo={linkTo} />
              <Section view={plan.swot.threats} linkTo={linkTo} />
            </div>
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-actions">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-actions">
                  The action plan
                </h3>
                <p className="ccrm-panel-description">
                  Ours, internal. The plan written with the customer is separate.
                </p>
              </div>
            </div>
            {plan.actions.length === 0 ? (
              <p className="ccrm-plan-empty">No action is recorded against this plan.</p>
            ) : (
              <ul className="ccrm-plan-entries">
                {plan.actions.map((action) => (
                  <li key={action.id}>
                    <p className="ccrm-plan-entry-body">
                      {action.description}{' '}
                      {action.state === 'done' ? <span className="ccrm-standing">Done</span> : null}
                    </p>
                    <p className="ccrm-plan-entry-source">
                      {action.dueDate ? `Due ${action.dueDate}.` : 'No date recorded.'}
                      {plan.overdueActions.some((a) => a.id === action.id) ? ' Overdue.' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ccrm-panel" aria-labelledby="plan-joint">
            <div className="ccrm-panel-head">
              <div>
                <h3 className="ccrm-panel-title" id="plan-joint">
                  Plans written with the customer
                </h3>
              </div>
            </div>
            {plan.jointPlans.length === 0 ? (
              <p className="ccrm-plan-empty">None.</p>
            ) : (
              <ul className="ccrm-item-list">
                {plan.jointPlans.map((joint) => (
                  <li key={joint.plan.id}>
                    <Link
                      className="ccrm-item"
                      to={linkTo(`/crm/account-plans/joint/${joint.plan.id}`)}
                    >
                      <span className="ccrm-item-main">
                        <span className="ccrm-item-title">{joint.plan.sharedObjective}</span>
                        <span className="ccrm-item-context">
                          {joint.approvalWord}. {joint.actions.length} actions,{' '}
                          {joint.theirs.length} of them theirs.
                        </span>
                      </span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* ---- what nobody has written, named rather than scored ---- */}
      <section className="ccrm-panel" aria-labelledby="plan-missing">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="plan-missing">
              What nobody has written down
            </h3>
            <p className="ccrm-panel-description">
              Named, not totalled. Some of these will never matter for this account, and that is
              a decision for a person.
            </p>
          </div>
        </div>
        {plan.notRecorded.length === 0 ? (
          <p className="ccrm-panel-empty">Every part of this plan has something written in it.</p>
        ) : (
          <ul className="ccrm-plain-list">
            {plan.notRecorded.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="ccrm-panel" aria-labelledby="plan-review">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="plan-review">
              The review
            </h3>
            <p className="ccrm-panel-description">
              What has changed since the last one, what is owed, and what needs a decision.
            </p>
          </div>
        </div>
        <p className="ccrm-field-hint">
          <Link
            className="ccrm-text-link"
            to={linkTo(`/crm/account-plans/${plan.organisation.id}/review`)}
          >
            Open the review workspace
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </p>
        <div className="ccrm-capture-actions">
          <button
            type="button"
            className="btn-secondary ccrm-button"
            onClick={() =>
              write.run('The review was recorded.', (context, workspace) =>
                recordReview(context, workspace, { accountPlanId: plan.plan.id })
              )
            }
          >
            Record that this plan was reviewed today
          </button>
        </div>
        <WriteResultLine result={write.last} onClear={write.clearLast} />
      </section>
    </Stage4Scaffold>
  );
};
