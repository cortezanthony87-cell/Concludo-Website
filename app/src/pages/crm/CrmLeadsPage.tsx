/**
 * The lead inbox.
 *
 * One card per arriving lead, and every card answers the same five questions in
 * the same order, because a reviewer working through twenty of them should be
 * reading the same shape twenty times rather than hunting:
 *
 *   where did this come from, and what does that mean for what I may do,
 *   is this already somebody we know,
 *   where would it go,
 *   what is the next thing to do,
 *   and what is missing.
 *
 * Nothing is created until somebody presses a button that says what it will
 * create. `convertLead` refuses without a confirmer, so that is enforced below
 * the interface as well as in it.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import {
  Field,
  RolePicker,
  WriteNotice,
  WriteResultLine,
  useCrmWrite,
} from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LeadReview,
  LeadSource,
  reviewInbox,
} from '../../lib/crm/stage5/leadIntake';
import { captureLead, convertLead, declineLead } from '../../lib/crm/stage5/writes';
import { pipelinesIn } from '../../lib/crm/stage5/pipeline';

const BASIS_WORDS: Record<string, string> = {
  express: 'Express',
  implied: 'Implied',
  legitimate_interest: 'Legitimate interest',
  not_obtained: 'Not obtained',
};

/**
 * The card takes the page's write rather than opening its own.
 *
 * Deciding a lead removes it from the waiting list, which unmounts the card.
 * When the card owned the result line, the person pressed "create the contact",
 * the card vanished, and the only confirmation that anything had happened
 * vanished with it. The result belongs to the page, which is still there
 * afterwards.
 */
const LeadCard: React.FC<{
  review: LeadReview;
  linkTo: (path: string) => string;
  write: ReturnType<typeof useCrmWrite>;
}> = ({ review, linkTo, write }) => {
  const { data } = useStage4();
  const pipelines = pipelinesIn(data);

  const [pipelineId, setPipelineId] = React.useState<string>(pipelines[0]?.id ?? '');
  const [declineReason, setDeclineReason] = React.useState('');
  const [showDecline, setShowDecline] = React.useState(false);

  const { lead, routing } = review;
  const decided = lead.state !== 'awaiting_review' && lead.state !== 'in_review';

  const confirmCreate = (withWork: boolean) => {
    write.run(`${lead.personName ?? 'The lead'} was converted.`, (context, workspace) =>
      convertLead(context, workspace, {
        leadId: lead.id,
        // The confirmation, carried into the write. Without it nothing is
        // created, whatever the interface does.
        confirmedBy: context.userId,
        personId: routing.personId,
        organisationId: routing.organisationId,
        pipelineId: withWork ? pipelineId : null,
      })
    );
  };

  return (
    <section className="ccrm-panel ccrm-lead" aria-labelledby={`lead-${lead.id}`}>
      <div className="ccrm-panel-head">
        <div>
          <h3 className="ccrm-panel-title" id={`lead-${lead.id}`}>
            <Value value={lead.personName} absent="No name given" />
            {lead.organisationName ? (
              <span className="ccrm-lead-org">, {lead.organisationName}</span>
            ) : null}
          </h3>
          <p className="ccrm-panel-description">
            <Value value={lead.summary} absent="Nothing was written about what they want." />
          </p>
        </div>
        <span className="ccrm-answer-count">
          {review.waitingDays}
          <span className="ccrm-visually-hidden"> days waiting</span>
          <span aria-hidden="true"> d</span>
        </span>
      </div>

      {/* 1. Where it came from, and what that means. */}
      <div className="ccrm-lead-source">
        <span className="ccrm-lead-source-label">{review.sourceLabel}</span>
        <span className={`ccrm-consent ccrm-consent-${review.consent.basis}`}>
          <span className="ccrm-consent-type">
            Consent: {BASIS_WORDS[review.consent.basis] ?? review.consent.basis}
          </span>
          <span className="ccrm-consent-sentence">{review.consent.meaning}</span>
          <span className="ccrm-role-note">Holds only if: {review.consent.requires}</span>
        </span>
      </div>

      {review.nextAction.beforeYouContact ? (
        <p className="ccrm-before-contact" role="note">
          <strong>Before anybody contacts them:</strong> {review.nextAction.beforeYouContact}
        </p>
      ) : null}

      {/* 2. Is this already somebody we know. */}
      <h4 className="ccrm-sub-heading">Possible existing records</h4>
      {review.matches.length === 0 ? (
        <p className="ccrm-panel-empty">
          Nothing here looks like this person or this organisation. Creating them would create
          something new.
        </p>
      ) : (
        <ul className="ccrm-match-list">
          {review.matches.map((match) => (
            <li className="ccrm-match" key={`${match.kind}-${match.id}`}>
              <span className="ccrm-match-head">
                <Link
                  className="ccrm-text-link"
                  to={linkTo(
                    match.kind === 'person'
                      ? `/crm/people/${match.id}`
                      : `/crm/organisations/${match.id}`
                  )}
                >
                  {match.name}
                </Link>
                <span className="ccrm-match-strength">{match.strength}</span>
              </span>
              {match.context ? <span className="ccrm-match-context">{match.context}</span> : null}
              <span className="ccrm-match-reason">{match.reason}</span>
              <span className="ccrm-match-fields">
                <span>Matches: {match.matching.join(', ')}</span>
                {/* What differs, always. A list that only says "these look the
                    same" trains somebody to press yes without reading. */}
                <span>
                  Differs:{' '}
                  {match.differing.length > 0
                    ? match.differing.join(', ')
                    : 'nothing, on what is recorded here'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 3. Where it would go. */}
      <h4 className="ccrm-sub-heading">Proposed routing</h4>
      <p className={`ccrm-routing${routing.blocked ? ' ccrm-routing-blocked' : ''}`}>
        <span className="ccrm-routing-where">
          {routing.destination === 'existing_account'
            ? `Add to ${routing.organisationName}`
            : routing.destination === 'new_account'
              ? 'Create a new account'
              : 'Somebody has to decide'}
        </span>
        <span className="ccrm-routing-why">{routing.reason}</span>
      </p>

      {/* 4. What to do next. */}
      <h4 className="ccrm-sub-heading">Proposed next action</h4>
      <p className="ccrm-next-action">
        <span className="ccrm-next-action-what">{review.nextAction.what}</span>
        <span className="ccrm-next-action-why">{review.nextAction.why}</span>
      </p>

      {/* 5. What is missing. */}
      {lead.missingInformation.length > 0 ? (
        <p className="ccrm-lead-missing">
          Not given: {lead.missingInformation.join(', ')}.
        </p>
      ) : null}

      {/* The confirmation. */}
      {decided ? (
        <p className="ccrm-lead-decided">
          {lead.state === 'converted'
            ? `Converted. ${[lead.convertedPersonId ? 'A person' : null, lead.convertedOrganisationId ? 'an organisation' : null, lead.convertedWorkItemId ? 'work' : null].filter(Boolean).join(', ')} now exists for this.`
            : `Not proceeding. ${lead.notProceedingReason ?? ''}`}
        </p>
      ) : (
        <div className="ccrm-lead-actions">
          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            disabled={routing.blocked}
            onClick={() => confirmCreate(false)}
          >
            <UserPlus size={14} aria-hidden="true" />
            {routing.personId ? 'Link to the existing person' : 'Create the contact'}
          </button>

          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={routing.blocked || pipelines.length === 0}
            onClick={() => confirmCreate(true)}
          >
            Create the contact and open work
          </button>

          {pipelines.length > 1 ? (
            <select
              className="form-select ccrm-workspace-select ccrm-inline-select"
              value={pipelineId}
              onChange={(event) => setPipelineId(event.target.value)}
              aria-label="Which pipeline the work would open in"
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            className="btn-secondary ccrm-button"
            onClick={() => setShowDecline((open) => !open)}
          >
            Not proceeding
          </button>
        </div>
      )}

      {showDecline && !decided ? (
        <div className="ccrm-decline">
          <Field
            label="Why is this not proceeding?"
            id={`decline-${lead.id}`}
            required
            hint="Without a reason the list fills with rows nobody can tell apart from rows nobody looked at."
          >
            <input
              id={`decline-${lead.id}`}
              className="form-input"
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={declineReason.trim().length === 0}
            onClick={() =>
              write.run('The lead was marked as not proceeding.', (context, workspace) =>
                declineLead(context, workspace, lead.id, declineReason)
              )
            }
          >
            Record it
          </button>
        </div>
      ) : null}

    </section>
  );
};

/* ------------------------------------------------------- arriving leads */

const NewLead: React.FC = () => {
  const write = useCrmWrite();
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<LeadSource>('web_form');
  const [personName, setPersonName] = React.useState('');
  const [organisationName, setOrganisationName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [summary, setSummary] = React.useState('');

  return (
    <details className="ccrm-capture-shell" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="ccrm-capture-summary">
        Record an arriving lead
        <span className="ccrm-field-hint">
          Nothing here is required except a source. A form that demands an address gets a fake one.
        </span>
      </summary>

      <div className="ccrm-capture-grid">
        <Field label="Source" id="lead-source" required>
          <select
            id="lead-source"
            className="form-select"
            value={source}
            onChange={(event) => setSource(event.target.value as LeadSource)}
          >
            {LEAD_SOURCES.map((value) => (
              <option key={value} value={value}>
                {LEAD_SOURCE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Name" id="lead-name">
          <input
            id="lead-name"
            className="form-input"
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
          />
        </Field>

        <Field label="Organisation" id="lead-org">
          <input
            id="lead-org"
            className="form-input"
            value={organisationName}
            onChange={(event) => setOrganisationName(event.target.value)}
          />
        </Field>

        <Field label="Email" id="lead-email">
          <input
            id="lead-email"
            className="form-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="What they want" id="lead-summary" hint="In their words, where you have them.">
          <input
            id="lead-summary"
            className="form-input"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </Field>

        <div className="ccrm-capture-actions">
          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            onClick={() => {
              const created = write.run('The lead was recorded.', (context, workspace) =>
                captureLead(context, workspace, {
                  source,
                  personName,
                  organisationName,
                  email,
                  summary,
                })
              );
              if (created) {
                setPersonName('');
                setOrganisationName('');
                setEmail('');
                setSummary('');
              }
            }}
          >
            Record it
          </button>
        </div>
      </div>

      <WriteResultLine result={write.last} onClear={write.clearLast} />
    </details>
  );
};

/* ---------------------------------------------------------------- page */

export const CrmLeadsPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const write = useCrmWrite();

  const reviews = React.useMemo(() => reviewInbox(data, now), [data, now]);
  const waiting = reviews.filter(
    (r) => r.lead.state === 'awaiting_review' || r.lead.state === 'in_review'
  );
  const decided = reviews.filter((r) => !waiting.includes(r));

  const bySource = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const review of waiting) {
      counts.set(review.sourceLabel, (counts.get(review.sourceLabel) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [waiting]);

  /* The two counts worth a tile.
   *
   * Earlier this rail carried one tile per source, each with the same sentence
   * under it, and it answered nothing: a person opening an inbox wants to know
   * what they cannot act on yet, not that four things arrived by four routes.
   * The sources are still all there, on one line below, where they read as a
   * breakdown rather than as five repetitions. */
  const needsCheck = waiting.filter((r) => r.consent.checkBeforeContact).length;
  const withMatches = waiting.filter((r) => r.matches.length > 0).length;

  return (
    <Stage4Scaffold
      title="Lead inbox"
      description="Everything that arrived, where it came from, whether it is already somebody we know, and what to do about it."
      loadingLabel="the lead inbox"
      emptyTitle="Nothing has arrived in this workspace"
      emptyBody="Leads appear here from a web form, an email, a call, a referral, an event, an existing customer, an imported list or by hand."
      resultCount={reviews.length}
      totalCount={data.leads.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy ccrm-not-ranked" role="note">
        Nothing on this page is created until somebody presses a button that says what it will
        create. The write itself refuses without a confirmation, so a record cannot appear because
        a screen was left open.
      </p>

      <NewLead />

      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{waiting.length}</span>
            <span className="ccrm-card-label">Awaiting review</span>
            <span className="ccrm-card-note">Arrived, and nobody has decided yet.</span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{needsCheck}</span>
            <span className="ccrm-card-label">Check before contact</span>
            <span className="ccrm-card-note">
              Where they came from does not by itself say you may contact them.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{withMatches}</span>
            <span className="ccrm-card-label">Looks like somebody here</span>
            <span className="ccrm-card-note">
              At least one existing record might be this person or this organisation.
            </span>
          </span>
        </li>
      </ul>

      <p className="ccrm-source-breakdown">
        Where they came from:{' '}
        {bySource.length === 0
          ? 'nothing is waiting.'
          : bySource.map(([label, count]) => `${label} ${count}`).join(', ') + '.'}
      </p>

      {/* One result line for the page. A decision removes the card it was made
          on, so a confirmation attached to the card would leave with it. */}
      <WriteResultLine result={write.last} onClear={write.clearLast} />

      <h3 className="ccrm-group-title">
        Awaiting review
        <span className="ccrm-stage-count">{waiting.length}</span>
      </h3>

      {waiting.length === 0 ? (
        <p className="ccrm-panel-empty">
          Nothing is waiting. Every lead that arrived has been decided one way or the other.
        </p>
      ) : (
        <div className="ccrm-panel-grid">
          {waiting.map((review) => (
            <LeadCard key={review.lead.id} review={review} linkTo={linkTo} write={write} />
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <>
          <h3 className="ccrm-group-title">
            Already decided
            <span className="ccrm-stage-count">{decided.length}</span>
          </h3>
          <ul className="ccrm-item-list">
            {decided.map((review) => (
              <li key={review.lead.id}>
                <span className="ccrm-item">
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">
                      <Value value={review.lead.personName} absent="No name given" />
                    </span>
                    <span className="ccrm-item-context">
                      {review.sourceLabel}
                      {review.lead.organisationName ? `, ${review.lead.organisationName}` : ''}
                    </span>
                    <span className="ccrm-reason">
                      <span className="ccrm-standing">
                        {review.lead.state === 'converted' ? 'Converted' : 'Not proceeding'}
                      </span>
                      <span className="ccrm-reason-text">
                        {review.lead.state === 'converted'
                          ? 'Records were created or linked after somebody confirmed it.'
                          : (review.lead.notProceedingReason ?? 'No reason was recorded.')}
                      </span>
                    </span>
                  </span>
                  {review.lead.convertedWorkItemId ? (
                    <Link
                      className="ccrm-text-link"
                      to={linkTo(`/crm/work/${review.lead.convertedWorkItemId}`)}
                    >
                      Open the work
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Stage4Scaffold>
  );
};
