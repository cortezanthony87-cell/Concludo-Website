/**
 * Service, as a CRM holds it.
 *
 * THIS IS NOT A HELP DESK AND MUST NOT BECOME ONE. The only reason a service
 * issue belongs in a CRM is that it changes how the next conversation with that
 * customer should go. So every case here is shown by its CONSEQUENCE for the
 * customer rather than by a severity somebody chose, and the customer's history
 * sits beside it.
 *
 * FOUR THINGS THIS SCREEN IS CAREFUL ABOUT.
 *
 * Priority is derived from consequence, and it shows its working. "Now",
 * "today", "this week" are words about when, which is what somebody needs;
 * "P1" is a number that means whatever the last person thought it meant. Every
 * priority on this page can be expanded to the sentences it was derived from.
 *
 * The targets are Concludo's own. No service level has been agreed with any
 * customer, because Concludo has no customers, and a page that showed "SLA
 * breached" would be asserting a contract that does not exist.
 *
 * Case detail is withheld by role, and says that it was. A viewer sees that a
 * case exists and what it means for the relationship, not what the customer
 * wrote. Hiding the fact that something is hidden is how people end up
 * believing they have the full picture.
 *
 * Nothing sends. A draft response is a draft, every time, on every case.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, currentActingRole } from '../../components/crm/Stage5Pieces';
import {
  PRIORITY_WORDS,
  ServiceCaseView,
  buildServiceInbox,
} from '../../lib/crm/stage8/service';

const CaseCard: React.FC<{ view: ServiceCaseView; linkTo: (p: string) => string }> = ({
  view,
  linkTo,
}) => {
  const [showWorking, setShowWorking] = React.useState(false);

  return (
    <section className="ccrm-panel" aria-labelledby={`case-${view.kase.id}`}>
      <div className="ccrm-panel-head">
        <div>
          <h4 className="ccrm-panel-title" id={`case-${view.kase.id}`}>
            {view.kase.title}
          </h4>
          <p className="ccrm-panel-description">
            {view.organisation ? (
              <Link className="ccrm-text-link" to={linkTo(`/crm/organisations/${view.organisation.id}`)}>
                {view.organisation.name}
              </Link>
            ) : (
              'No organisation recorded against this case'
            )}
            {view.person ? `. Raised by ${view.person.fullName}.` : '.'}
          </p>
        </div>
        <span className="ccrm-mark">{PRIORITY_WORDS[view.priority.priority]}</span>
      </div>

      <p className="ccrm-item-context">
        <strong>What it means for them: </strong>
        {view.consequenceWord}
      </p>

      {view.detailRedacted ? (
        <p className="ccrm-reason-text">{view.detailRedactedBecause}</p>
      ) : view.detail ? (
        <p className="ccrm-flag-detail">{view.detail}</p>
      ) : (
        <p className="ccrm-cell-quiet">No detail is recorded on this case.</p>
      )}

      <p className="ccrm-indicator-state">
        <span className="ccrm-cell-quiet">
          <Clock size={12} aria-hidden="true" /> {view.sla.note}
        </span>
        {view.sla.resolutionOverdue || view.sla.firstResponseOverdue ? (
          <span className="ccrm-mark ccrm-mark-message">
            <AlertTriangle size={12} aria-hidden="true" /> Past Concludo&rsquo;s own target
          </span>
        ) : null}
      </p>

      <button
        type="button"
        className="ccrm-text-link ccrm-disclosure-button"
        aria-expanded={showWorking}
        onClick={() => setShowWorking((open) => !open)}
      >
        {showWorking ? 'Hide how this priority was reached' : 'How was this priority reached?'}
      </button>

      {showWorking ? (
        <ul className="ccrm-flag-list">
          {view.priority.because.map((sentence, index) => (
            <li className="ccrm-flag" key={index}>
              <span className="ccrm-flag-detail">{sentence}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {view.knowledgeReference ? (
        <p className="ccrm-cell-quiet">Reference: {view.knowledgeReference}</p>
      ) : null}

      <div className="ccrm-draft">
        <h5 className="ccrm-plan-section-title">Draft response</h5>
        {view.draft ? (
          <>
            <p className="ccrm-flag-detail">{view.draft.body}</p>
            <p className="ccrm-cell-quiet">
              {view.draft.approvedBy
                ? `Approved ${view.draft.approvedAt?.slice(0, 10) ?? ''}.`
                : 'Not approved yet.'}
            </p>
            <p className="ccrm-reason-text">{view.sendingNote}</p>
          </>
        ) : (
          <p className="ccrm-reason-text">{view.draftNote}</p>
        )}
        <p className="ccrm-panel-footer">
          <Link className="ccrm-text-link" to={linkTo('/crm/proposals')}>
            Open the proposal queue
          </Link>
        </p>
      </div>

      {view.customerHistory.length > 0 ? (
        <>
          <h5 className="ccrm-plan-section-title">Everything else recorded with this customer</h5>
          <ul className="ccrm-item-list">
            {view.customerHistory.slice(0, 6).map((entry, index) => (
              <li key={index}>
                <span className="ccrm-item">
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{entry.what}</span>
                    <span className="ccrm-item-context">
                      {entry.at.slice(0, 10)}. Recorded as a {entry.kind}.
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {view.reopened ? (
        <p className="ccrm-reason-text">
          This case has been reopened. The first resolution did not hold, which is worth knowing
          before the next conversation.
        </p>
      ) : null}
    </section>
  );
};

export const CrmServicePage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const role = currentActingRole();

  const inbox = React.useMemo(() => buildServiceInbox(data, now, role), [data, now, role]);

  const total = inbox.open.length + inbox.waitingOnCustomer.length + inbox.resolved.length;

  return (
    <Stage4Scaffold
      title="Service"
      description="Open cases, ordered by what they mean for the customer rather than by age. This is a CRM's view of service, not a help desk."
      loadingLabel="the service inbox"
      emptyTitle="No service case is recorded in this workspace"
      emptyBody="Cases appear here as they are recorded, with what each one means for the relationship."
      resultCount={total}
      totalCount={total}
      toolbar={<RolePicker />}
    >
      <p className="ccrm-policy" role="note">
        {inbox.slaNote}
      </p>

      <ul className="ccrm-card-rail">
        {(['now', 'today', 'this_week', 'when_we_can', 'undecided'] as const).map((priority) => (
          <li key={priority}>
            <span className="ccrm-card">
              <span className="ccrm-card-count">{inbox.counts[priority]}</span>
              <span className="ccrm-card-label">{PRIORITY_WORDS[priority]}</span>
            </span>
          </li>
        ))}
      </ul>

      {inbox.withoutConsequence.length > 0 ? (
        <p className="ccrm-reason-text">
          {inbox.withoutConsequence.length}{' '}
          {inbox.withoutConsequence.length === 1 ? 'case has' : 'cases have'} nothing recorded about
          what the problem means for the customer, so Concludo cannot work out a priority for
          {inbox.withoutConsequence.length === 1 ? ' it' : ' them'}. They are shown as undecided
          rather than given a guess.
        </p>
      ) : null}

      {inbox.unassigned.length > 0 ? (
        <p className="ccrm-reason-text">
          {inbox.unassigned.length}{' '}
          {inbox.unassigned.length === 1 ? 'case has' : 'cases have'} nobody recorded as looking
          after {inbox.unassigned.length === 1 ? 'it' : 'them'}.
        </p>
      ) : null}

      <h3 className="ccrm-group-title">
        Open
        <span className="ccrm-stage-count">{inbox.open.length}</span>
      </h3>
      {inbox.open.length === 0 ? (
        <p className="ccrm-panel-empty">Nothing is open.</p>
      ) : (
        <div className="ccrm-panel-grid">
          {inbox.open.map((view) => (
            <CaseCard key={view.kase.id} view={view} linkTo={linkTo} />
          ))}
        </div>
      )}

      {inbox.waitingOnCustomer.length > 0 ? (
        <>
          <h3 className="ccrm-group-title">
            Waiting on the customer
            <span className="ccrm-stage-count">{inbox.waitingOnCustomer.length}</span>
          </h3>
          <p className="ccrm-section-description">
            Not ours to progress, and not forgotten either. The clock is shown because a case
            waiting on somebody else for three weeks is still a case going wrong.
          </p>
          <div className="ccrm-panel-grid">
            {inbox.waitingOnCustomer.map((view) => (
              <CaseCard key={view.kase.id} view={view} linkTo={linkTo} />
            ))}
          </div>
        </>
      ) : null}

      {inbox.resolved.length > 0 ? (
        <>
          <h3 className="ccrm-group-title">
            Resolved
            <span className="ccrm-stage-count">{inbox.resolved.length}</span>
          </h3>
          <div className="ccrm-panel-grid">
            {inbox.resolved.map((view) => (
              <CaseCard key={view.kase.id} view={view} linkTo={linkTo} />
            ))}
          </div>
        </>
      ) : null}
    </Stage4Scaffold>
  );
};
