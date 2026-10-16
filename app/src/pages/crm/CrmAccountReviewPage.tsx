/**
 * The internal account review workspace.
 *
 * BUILT FOR AN HOUR THAT USUALLY GOES BADLY.
 *
 * The failure this page is designed against: somebody opens the account plan in
 * a review meeting and reads it out. Everyone already knows what it says, nobody
 * can remember which parts are new, fifty minutes go on confirming things that
 * have not changed, and the two decisions that needed making get four minutes at
 * the end.
 *
 * So this page opens on WHAT IS DIFFERENT, anchored to the last recorded review,
 * and the things that have not changed are deliberately absent. Then what was
 * promised on both sides, because a review that does not check whether we did
 * what we said teaches the customer that what we say does not mean much. Then
 * what needs a person, listed and never answered here.
 *
 * The agenda at the end is headings with reasons, not a script. Nothing on this
 * page recommends a course of action, ranks anything by value, or estimates a
 * consequence.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, WriteResultLine, useCrmWrite } from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import { buildAccountPlan } from '../../lib/crm/stage6/accountPlan';
import { CHANGE_WORDS, buildAccountReview } from '../../lib/crm/stage6/accountReview';
import { recordReview } from '../../lib/crm/stage6/planWrites';
import { planningEnabled } from '../../lib/crm/stage6/visibility';
import { CRM_SESSION_NOW } from '../../lib/crm/stage5/session';

export const CrmAccountReviewPage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const { organisationId } = useParams<{ organisationId: string }>();
  const write = useCrmWrite();
  const [summary, setSummary] = React.useState('');

  const review = React.useMemo(() => {
    if (!organisationId || !planningEnabled(data)) return null;
    const plan = buildAccountPlan(data, organisationId, CRM_SESSION_NOW);
    if (!plan) return null;
    return buildAccountReview(data, plan, CRM_SESSION_NOW);
  }, [data, organisationId]);

  if (!review) {
    return (
      <Stage4Scaffold
        title="No review here"
        description="Either account planning is off in this workspace, or this account has no plan."
        loadingLabel="the account review"
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

  const { plan } = review;

  return (
    <Stage4Scaffold
      title={`Review: ${plan.organisation.name}`}
      description={`What has changed ${review.sinceLabel}, what is owed, and what needs a decision.`}
      loadingLabel="the account review"
      emptyTitle=""
      emptyBody=""
      resultCount={review.changes.length}
      totalCount={review.changes.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy" role="note">
        This page shows what is different. Everything that has not changed is in the plan, one click
        away, and is deliberately not repeated here: an hour spent confirming what everybody already
        knows is the usual way a review meeting fails.
      </p>

      <Link className="ccrm-back-link" to={linkTo(`/crm/account-plans/${plan.organisation.id}`)}>
        Back to the account plan
      </Link>

      {/* ---- what changed ---- */}
      <section className="ccrm-panel" aria-labelledby="rv-changes">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="rv-changes">
              What has changed
              <span className="ccrm-stage-count">{review.changes.length}</span>
            </h3>
            <p className="ccrm-panel-description">
              Measured {review.sinceLabel}.
              {review.lastReview?.summary ? ` Last time: ${review.lastReview.summary}` : ''}
            </p>
          </div>
        </div>

        {review.nothingChanged ? (
          <p className="ccrm-panel-empty">
            Nothing has changed on this account since the last review, and nothing is owed either
            way. That is worth saying out loud rather than filling the hour.
          </p>
        ) : (
          <ul className="ccrm-item-list">
            {review.changes.map((change, index) => (
              <li key={`${change.kind}-${change.at}-${index}`}>
                <span className="ccrm-item">
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{change.what}</span>
                    <span className="ccrm-item-context">
                      {CHANGE_WORDS[change.kind]}, {change.at.slice(0, 10)}
                    </span>
                    {change.detail ? (
                      <span className="ccrm-reason-text">{change.detail}</span>
                    ) : null}
                  </span>
                  {change.path ? (
                    <Link className="ccrm-text-link" to={linkTo(change.path)}>
                      Open
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- what was promised ---- */}
      <section className="ccrm-panel" aria-labelledby="rv-commitments">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="rv-commitments">
              What was promised
            </h3>
            <p className="ccrm-panel-description">
              Ours and theirs, kept apart. Going first on our own overdue promises is what makes the
              rest of the hour credible.
            </p>
          </div>
        </div>

        <div className="ccrm-two-views">
          <div className="ccrm-promise-column">
            <h4 className="ccrm-plan-section-title">We promised</h4>
            {review.commitmentsBySide.oursOverdue.length === 0 &&
            review.commitmentsBySide.oursCompleted.length === 0 ? (
              <p className="ccrm-plan-empty">Nothing recorded either way.</p>
            ) : (
              <ul className="ccrm-plain-list">
                {review.commitmentsBySide.oursOverdue.map((c) => (
                  <li key={c.id} className="ccrm-overdue-item">
                    {c.description}. Due {c.dueDate}, still open.
                  </li>
                ))}
                {review.commitmentsBySide.oursCompleted.map((c) => (
                  <li key={c.id}>
                    {c.description}. Done {c.completedAt?.slice(0, 10)}.
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ccrm-promise-column">
            <h4 className="ccrm-plan-section-title">They promised</h4>
            {review.commitmentsBySide.theirsOverdue.length === 0 &&
            review.commitmentsBySide.theirsCompleted.length === 0 ? (
              <p className="ccrm-plan-empty">Nothing recorded either way.</p>
            ) : (
              <ul className="ccrm-plain-list">
                {review.commitmentsBySide.theirsOverdue.map((c) => (
                  <li key={c.id} className="ccrm-overdue-item">
                    {c.description}. Due {c.dueDate}, still open.
                  </li>
                ))}
                {review.commitmentsBySide.theirsCompleted.map((c) => (
                  <li key={c.id}>
                    {c.description}. Done {c.completedAt?.slice(0, 10)}.
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---- the state of things ---- */}
      <div className="ccrm-two-views">
        <section className="ccrm-panel" aria-labelledby="rv-open">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="rv-open">
                Open work and issues
              </h3>
            </div>
          </div>
          {review.opportunities.length === 0 && review.serviceIssues.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing is open against this account.</p>
          ) : (
            <ul className="ccrm-plain-list">
              {review.opportunities.map((item) => (
                <li key={item.id}>
                  <Link className="ccrm-text-link" to={linkTo(`/crm/work/${item.id}`)}>
                    {item.title}
                  </Link>
                  {item.nextStep ? `. Next: ${item.nextStep}` : '. No next step recorded.'}
                </li>
              ))}
              {review.serviceIssues.map((kase) => (
                <li key={kase.id}>
                  <strong>{kase.title}.</strong>{' '}
                  <Value value={kase.relationshipEffect} absent="No effect recorded." />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="rv-gaps">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="rv-gaps">
                Relationship gaps
              </h3>
              <p className="ccrm-panel-description">
                About what is recorded, never about anybody here or there.
              </p>
            </div>
          </div>
          {review.relationshipGaps.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing is flagged.</p>
          ) : (
            <ul className="ccrm-plain-list">
              {review.relationshipGaps.map((risk) => (
                <li key={risk.kind}>
                  <strong>{risk.what}</strong> {risk.whatWouldHelp}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- decisions ---- */}
      <section className="ccrm-panel" aria-labelledby="rv-decisions">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="rv-decisions">
              Decisions this needs
              <span className="ccrm-stage-count">{review.decisionsRequired.length}</span>
            </h3>
            <p className="ccrm-panel-description">
              Listed, never answered here. Nothing on this page recommends which way to go.
            </p>
          </div>
        </div>
        {review.decisionsRequired.length === 0 ? (
          <p className="ccrm-panel-empty">Nothing is waiting on a decision.</p>
        ) : (
          <ul className="ccrm-item-list">
            {review.decisionsRequired.map((decision, index) => (
              <li key={`${decision.what}-${index}`}>
                <span className="ccrm-item">
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{decision.what}</span>
                    <span className="ccrm-item-context">Waiting on: {decision.waitingOn}</span>
                  </span>
                  {decision.path ? (
                    <Link className="ccrm-text-link" to={linkTo(decision.path)}>
                      Open
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- proposed plan changes ---- */}
      <section className="ccrm-panel" aria-labelledby="rv-proposed">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="rv-proposed">
              Proposed changes to this plan
            </h3>
            <p className="ccrm-panel-description">
              Drawn from conversations, waiting for a person. Nothing here has been applied.
            </p>
          </div>
        </div>
        {review.proposedChanges.length === 0 ? (
          <p className="ccrm-panel-empty">Nothing is proposed.</p>
        ) : (
          <ul className="ccrm-plain-list">
            {review.proposedChanges.map((proposal) => (
              <li key={proposal.id}>
                <strong>{proposal.headline}.</strong> {proposal.rationale}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- the agenda ---- */}
      <section className="ccrm-panel" aria-labelledby="rv-agenda">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="rv-agenda">
              The next conversation
            </h3>
            <p className="ccrm-panel-description">
              Headings with the reason each one is on the list. Not a script.
            </p>
          </div>
        </div>
        {review.nextAgenda.length === 0 ? (
          <p className="ccrm-panel-empty">
            Nothing here suggests an agenda item. That is a reasonable outcome.
          </p>
        ) : (
          <ol className="ccrm-agenda">
            {review.nextAgenda.map((item) => (
              <li key={item.heading}>
                <span className="ccrm-agenda-heading">{item.heading}</span>
                <span className="ccrm-agenda-because">{item.because}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ---- record it ---- */}
      <section className="ccrm-panel" aria-labelledby="rv-record">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="rv-record">
              Record this review
            </h3>
            <p className="ccrm-panel-description">
              What the next one measures from. The summary is optional; the date is the point.
            </p>
          </div>
        </div>
        <div className="ccrm-field">
          <label className="ccrm-field-label" htmlFor="rv-summary">
            What this review settled <span className="ccrm-optional">optional</span>
          </label>
          <input
            id="rv-summary"
            className="form-input"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>
        <div className="ccrm-capture-actions">
          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            onClick={() => {
              const written = write.run('The review was recorded.', (context, workspace) =>
                recordReview(context, workspace, {
                  accountPlanId: plan.plan.id,
                  summary: summary || null,
                })
              );
              if (written) setSummary('');
            }}
          >
            Record it
          </button>
        </div>
        <WriteResultLine result={write.last} onClear={write.clearLast} />

        {review.history.length > 0 ? (
          <>
            <h4 className="ccrm-plan-section-title">Reviews before this one</h4>
            <ul className="ccrm-plain-list">
              {review.history.map((entry) => (
                <li key={entry.id}>
                  {entry.reviewedAt.slice(0, 10)}.{' '}
                  <Value value={entry.summary} absent="No summary was written." />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </Stage4Scaffold>
  );
};
