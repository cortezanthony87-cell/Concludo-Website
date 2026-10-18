/**
 * KAM Copilot: six lenses over one account.
 *
 * THE CLAIM THIS PAGE MAKES, AND HOW IT KEEPS IT.
 *
 * Everything here is one of three things and the page says which, in three
 * separate columns with three different headings:
 *
 *   What is recorded. Somebody wrote it down. The record is one click away and
 *   the quoted sentence is theirs, not a paraphrase.
 *   What the copilot inferred. It says what it inferred it FROM, in the same
 *   block, so the reader can disagree with the reasoning rather than only with
 *   the conclusion.
 *   What nothing answers. The gap, stated plainly, with the question that
 *   would close it.
 *
 * Three columns rather than one list with labels, because a label can be
 * skimmed past and a column cannot. The failure this prevents is somebody
 * reading an inference in a quarterly review as though it were a fact.
 *
 * NOTHING HERE IS ABOUT A PERSON.
 *
 * The brief this was built from asked for power maps, influence networks,
 * blockers and opponents. This page shows SEATS: which roles in the buying
 * centre are filled, which are empty, which were filled by a guess nobody
 * confirmed. It carries no disposition, no rating and no comparison of two
 * people, and the module behind it has no function that would return one. The
 * reasoning is in the header of lib/crm/kam/review.ts and the departures from
 * the brief are listed in lib/crm/kam/prompt.ts, where the suite checks that
 * each one names the code that enforces it.
 *
 * ON THE COVERAGE FIGURE. It is a percentage of the RECORDS, not a score of
 * the account and not a judgement of whoever keeps them. The page says that
 * where it draws it, every time, because a percentage next to a customer's
 * name is read as a grade unless it is told not to be.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker } from '../../components/crm/Stage5Pieces';
import {
  Finding,
  Lens,
  Seat,
  ValidationQuestion,
  accountReviewFor,
  reviewableAccounts,
} from '../../lib/crm/kam/review';

const QUESTION_KINDS: Record<ValidationQuestion['kind'], string> = {
  executive: 'Executive',
  strategic: 'Strategic',
  operational: 'Operational',
  risk: 'Risk',
  expansion: 'Expansion',
};

/* ------------------------------------------------------ one finding */

const FindingBlock: React.FC<{
  finding: Finding;
  organisationId: string;
  linkTo: (path: string) => string;
}> = ({ finding, organisationId, linkTo }) => {
  /* A gap whose only source is the account record itself does not render a
     link. The finding is that something is ABSENT, so pointing at the record
     it is absent from adds nothing, and four identical links down a column
     teaches a reader to stop looking at links. The source stays in the data,
     where the agent contract needs it to ground the proposal.             */
  const onlyTheAccount =
    finding.sources.length > 0 &&
    finding.sources.every(
      (source) => source.table === 'crm_organisations' && source.id === organisationId
    );
  const shown = finding.basis === 'unknown' && onlyTheAccount ? [] : finding.sources;

  return (
  <li className="ccrm-kam-finding">
    <p className="ccrm-kam-statement">{finding.statement}</p>

    {/* An inference says what it was drawn from, beside the inference, not in
        a footnote. A reader who disagrees should be able to disagree with the
        reasoning rather than only with the conclusion. */}
    {finding.basis === 'inferred' && finding.from ? (
      <p className="ccrm-kam-from">
        <span className="ccrm-kam-from-label">Inferred from</span> {finding.from}
      </p>
    ) : null}

    {shown.length > 0 ? (
      <ul className="ccrm-kam-sources">
        {shown.map((source) => (
          <li key={source.id}>
            {source.quote ? <q className="ccrm-kam-quote">{source.quote}</q> : null}
            {source.path ? (
              <Link className="ccrm-text-link" to={linkTo(source.path)}>
                {source.label}
              </Link>
            ) : (
              <span className="ccrm-kam-source-label">{source.label}</span>
            )}
          </li>
        ))}
      </ul>
    ) : null}
  </li>
  );
};

/* ------------------------------------------------------ one lens */

const LensPanel: React.FC<{
  lens: Lens;
  organisationId: string;
  linkTo: (path: string) => string;
}> = ({ lens, organisationId, linkTo }) => (
  <section className="ccrm-panel ccrm-kam-lens" aria-labelledby={`lens-${lens.key}`}>
    <div className="ccrm-panel-head">
      <div>
        <h3 className="ccrm-panel-title" id={`lens-${lens.key}`}>
          {lens.label}
        </h3>
        <p className="ccrm-panel-description">{lens.question}</p>
      </div>
      <span className="ccrm-kam-coverage" title="A proportion of the records, not a score">
        <span className="ccrm-kam-coverage-figure">{lens.coverage}%</span>
        <span className="ccrm-kam-coverage-label">
          of what this lens asks is recorded
        </span>
      </span>
    </div>

    <div className="ccrm-kam-columns">
      <div className="ccrm-kam-column">
        <h4 className="ccrm-kam-column-head ccrm-kam-known">What is recorded</h4>
        {lens.known.length === 0 ? (
          <p className="ccrm-kam-empty">Nothing.</p>
        ) : (
          <ul className="ccrm-kam-list">
            {lens.known.map((finding) => (
              <FindingBlock
                key={finding.key}
                finding={finding}
                organisationId={organisationId}
                linkTo={linkTo}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="ccrm-kam-column">
        <h4 className="ccrm-kam-column-head ccrm-kam-assumed">What the copilot inferred</h4>
        {lens.assumed.length === 0 ? (
          <p className="ccrm-kam-empty">Nothing inferred. Everything here was recorded.</p>
        ) : (
          <ul className="ccrm-kam-list">
            {lens.assumed.map((finding) => (
              <FindingBlock
                key={finding.key}
                finding={finding}
                organisationId={organisationId}
                linkTo={linkTo}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="ccrm-kam-column">
        <h4 className="ccrm-kam-column-head ccrm-kam-unknown">What nothing answers</h4>
        {lens.unknown.length === 0 ? (
          <p className="ccrm-kam-empty">Nothing missing that this lens looks for.</p>
        ) : (
          <ul className="ccrm-kam-list">
            {lens.unknown.map((finding) => (
              <FindingBlock
                key={finding.key}
                finding={finding}
                organisationId={organisationId}
                linkTo={linkTo}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------ the buying centre */

const SeatRow: React.FC<{ seat: Seat }> = ({ seat }) => (
  <li
    className={
      seat.requiredForDecision && seat.filled === 0
        ? 'ccrm-kam-seat ccrm-kam-seat-empty'
        : 'ccrm-kam-seat'
    }
  >
    <span className="ccrm-kam-seat-label">{seat.label}</span>
    <span className="ccrm-kam-seat-figure">
      {seat.filled === 0 ? (
        /* Amber only where the empty seat matters. Colouring every empty seat
           drew the eye to the gatekeeper nobody needs and away from the
           economic buyer a decision does. */
        <span
          className={
            seat.requiredForDecision ? 'ccrm-kam-seat-none' : 'ccrm-kam-seat-none-quiet'
          }
        >
          {seat.requiredForDecision ? 'Nobody recorded' : 'None recorded'}
        </span>
      ) : (
        <>
          {seat.filled} {seat.filled === 1 ? 'person' : 'people'}
          {seat.confirmed < seat.filled ? (
            <span className="ccrm-kam-seat-note">
              {seat.filled - seat.confirmed} not confirmed with the customer
            </span>
          ) : (
            <span className="ccrm-kam-seat-note">all confirmed</span>
          )}
        </>
      )}
    </span>
  </li>
);

/* ====================================================== the page */

export const CrmKamPage: React.FC = () => {
  const { data, now, version, linkTo } = useStage4();
  const [selected, setSelected] = React.useState<string | null>(null);

  // `version` is in the dependencies because the session store mutates one
  // workspace in place: `data` never changes identity, so a memo without it
  // would show the account as it was before the last write.
  const accounts = React.useMemo(
    () => reviewableAccounts(data, now),
    [data, now, version]
  );

  const current = selected ?? accounts[0]?.organisationId ?? null;

  const review = React.useMemo(
    () => (current ? accountReviewFor(data, current, now) : null),
    [data, now, version, current]
  );

  return (
    <Stage4Scaffold
      title="KAM Copilot"
      description="One account through six lenses: what is recorded, what was inferred, and what nobody has answered yet."
      loadingLabel="the account review"
      emptyTitle="No customer is recorded in this workspace yet"
      emptyBody="The copilot reads accounts, so it fills in as organisations and conversations are added."
      resultCount={accounts.length}
      totalCount={accounts.length}
      toolbar={<RolePicker />}
    >
      <p className="ccrm-not-ranked ccrm-policy" role="note">
        {review?.note ??
          'Everything on this page is separated into what is recorded, what the copilot inferred and what nothing answers.'}
      </p>

      {/* ------------------------------------------- choose an account */}

      <p className="ccrm-panel-description">
        Ordered by how much of these six lenses the records can answer, least
        answered first. That figure is about the records, not about the customer
        and not about whoever keeps them.
      </p>

      <ul className="ccrm-card-rail">
        {accounts.map((account) => (
          <li key={account.organisationId}>
            <button
              type="button"
              className={`ccrm-card ccrm-card-button${current === account.organisationId ? ' ccrm-card-attention' : ''}`}
              aria-pressed={current === account.organisationId}
              onClick={() => setSelected(account.organisationId)}
            >
              <span className="ccrm-card-count">{account.coverage}%</span>
              <span className="ccrm-card-label">{account.organisationName}</span>
              <span className="ccrm-card-note">
                {account.questions.length}{' '}
                {account.questions.length === 1 ? 'question' : 'questions'} to ask
              </span>
            </button>
          </li>
        ))}
      </ul>

      {review === null ? (
        <p className="ccrm-panel-empty">Choose a customer to read.</p>
      ) : (
        <>
          {/* --------------------------------- the buying centre */}

          {/* Its own two-column grid rather than the dashboard's three, and
              deliberately NOT stretched. The seats list is seven short rows
              and the question list is eight blocks: stretching the first to
              match the second left a panel two thirds empty, which reads as a
              screen with something missing from it. */}
          <div className="ccrm-kam-top">
            <section className="ccrm-panel" aria-labelledby="kam-seats">
              <div className="ccrm-panel-head">
                <div>
                  <h3 className="ccrm-panel-title" id="kam-seats">
                    The buying centre at {review.organisationName}
                  </h3>
                  <p className="ccrm-panel-description">
                    Which seats are filled and which are empty. This is a count of
                    recorded roles, never an assessment of anybody: the copilot does
                    not decide who is a blocker, who has influence, or who matters
                    more, and it never writes a judgement about a person to a record.
                  </p>
                </div>
              </div>

              <ul className="ccrm-kam-seats">
                {review.seats.map((seat) => (
                  <SeatRow key={seat.role} seat={seat} />
                ))}
              </ul>

              <p className="ccrm-ring-basis">
                A role recorded as &ldquo;resistant&rdquo; appears only where a person
                recorded it and confirmed it, carrying the sentence they gave. The
                copilot never assigns one.
              </p>
            </section>

            {/* --------------------------------- questions to ask */}

            <section className="ccrm-panel" aria-labelledby="kam-questions">
              <div className="ccrm-panel-head">
                <div>
                  <h3 className="ccrm-panel-title" id="kam-questions">
                    What to ask next
                  </h3>
                  <p className="ccrm-panel-description">
                    Each question is tied to the specific gap it would close, biggest
                    gap first. Nothing generic.
                  </p>
                </div>
              </div>

              {review.questions.length === 0 ? (
                <p className="ccrm-panel-empty">
                  Nothing these six lenses look for is unanswered.
                </p>
              ) : (
                <ol className="ccrm-kam-questions">
                  {review.questions.slice(0, 5).map((question) => (
                    <li key={question.key}>
                      <span className="ccrm-kam-question-kind">
                        {QUESTION_KINDS[question.kind]}
                      </span>
                      <p className="ccrm-kam-question">{question.question}</p>
                      <p className="ccrm-kam-question-closes">
                        Closes: {question.closes}. Ask {question.askWhom}.
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {review.questions.length > 5 ? (
                <p className="ccrm-ring-basis">
                  {review.questions.length - 5} more {review.questions.length - 5 === 1 ? 'question sits' : 'questions sit'} with
                  the gaps they close, in the six lenses below.
                </p>
              ) : null}

              <p className="ccrm-form-actions">
                <Link className="ccrm-text-link" to={linkTo('/crm/proposals')}>
                  Open the proposals the copilot raised
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </p>
            </section>
          </div>

          {/* --------------------------------- the six lenses */}

          {review.lenses.map((lens) => (
            <LensPanel
              key={lens.key}
              lens={lens}
              organisationId={review.organisationId}
              linkTo={linkTo}
            />
          ))}
        </>
      )}

      <p className="ccrm-policy" role="note">
        The copilot proposes; a person disposes. It writes nothing to any record, sends
        nothing, and takes no action on its own. It reads only this workspace, and a
        claim it cannot attach to a record in this workspace does not appear. There is
        no model behind this page in this release: every line above was computed from
        the records, which is why each one can be opened.
      </p>
    </Stage4Scaffold>
  );
};
