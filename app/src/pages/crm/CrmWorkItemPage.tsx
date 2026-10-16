/**
 * The opportunity or job workspace.
 *
 * Nineteen things on one page, and the write controls beside the thing they
 * change rather than in a toolbar at the top. A stage mover that lives three
 * screens from the stage criteria is one somebody uses without reading them.
 *
 * The stage mover is the piece worth looking at. It shows every criterion with
 * a checkbox, counts what is unmet, and then still lets an authorised person
 * move the record, with a reason of at least ten characters. Not silent, not
 * blocked, for the fourth time in this build and in the fourth place.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import {
  SourceTrailList,
  Stage4Scaffold,
  TimelineList,
  useStage4,
} from '../../components/crm/Stage4Scaffold';
import {
  Field,
  RolePicker,
  WriteNotice,
  WriteResultLine,
  useCrmWrite,
} from '../../components/crm/Stage5Pieces';
import { Facts, Money, Value } from '../../components/crm/viewPrimitives';
import { ErrorState } from '../../components/crm/StateBlocks';
import { buildWorkItemWorkspace } from '../../lib/crm/stage5/workItemWorkspace';
import {
  closeWorkItem,
  moveStage,
  reopenWorkItem,
  setExpectedCloseDate,
  setNextStep,
} from '../../lib/crm/stage5/writes';

/* ------------------------------------------------------- the stage mover */

const StageMover: React.FC<{
  workItemId: string;
  currentStageId: string;
  pipelineId: string;
  criteria: { criterion: { id: string; description: string; isRequired: boolean }; met: boolean }[];
}> = ({ workItemId, currentStageId, pipelineId, criteria }) => {
  const { data } = useStage4();
  const write = useCrmWrite();

  const stages = data.stages
    .filter((s) => s.pipelineId === pipelineId)
    .sort((a, b) => a.stageOrder - b.stageOrder);

  const [toStageId, setToStageId] = React.useState(
    stages.find((s) => s.id !== currentStageId)?.id ?? ''
  );
  const [met, setMet] = React.useState<string[]>(
    criteria.filter((c) => c.met).map((c) => c.criterion.id)
  );
  const [reason, setReason] = React.useState('');

  const unmetRequired = criteria.filter(
    (c) => c.criterion.isRequired && !met.includes(c.criterion.id)
  );
  const needsReason = unmetRequired.length > 0;
  const reasonTooShort = needsReason && reason.trim().length < 10;

  return (
    <section className="ccrm-panel" aria-labelledby="w-move">
      <div className="ccrm-panel-head">
        <div>
          <h3 className="ccrm-panel-title" id="w-move">
            Move it
          </h3>
          <p className="ccrm-panel-description">
            Tick what is actually true. Anything required and unticked needs a reason, and then the
            move goes through.
          </p>
        </div>
      </div>

      {criteria.length === 0 ? (
        <p className="ccrm-panel-empty">This stage declares no exit criteria.</p>
      ) : (
        <ul className="ccrm-criteria-list">
          {criteria.map(({ criterion }) => (
            <li className="ccrm-criterion" key={criterion.id}>
              <label className="ccrm-criterion-label">
                <input
                  type="checkbox"
                  checked={met.includes(criterion.id)}
                  onChange={() =>
                    setMet((current) =>
                      current.includes(criterion.id)
                        ? current.filter((id) => id !== criterion.id)
                        : [...current, criterion.id]
                    )
                  }
                />
                <span className="ccrm-criterion-text">{criterion.description}</span>
                <span className="ccrm-criterion-kind">
                  {criterion.isRequired ? 'required' : 'optional'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="ccrm-move-controls">
        <Field label="Move to" id="w-to-stage" required>
          <select
            id="w-to-stage"
            className="form-select ccrm-workspace-select"
            value={toStageId}
            onChange={(event) => setToStageId(event.target.value)}
          >
            {stages
              .filter((s) => s.id !== currentStageId)
              .map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                  {stage.isClosed ? ' (closes the record)' : ''}
                </option>
              ))}
          </select>
        </Field>

        {needsReason ? (
          <Field
            label="Reason for moving with unmet criteria"
            id="w-override"
            required
            hint={`${unmetRequired.length} required ${unmetRequired.length === 1 ? 'criterion is' : 'criteria are'} unticked: ${unmetRequired.map((c) => c.criterion.description).join('; ')}. At least ten characters.`}
          >
            <input
              id="w-override"
              className="form-input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        ) : null}

        <button
          type="button"
          className="btn-secondary ccrm-button ccrm-button-primary"
          disabled={!toStageId || reasonTooShort}
          onClick={() =>
            write.run('The stage was changed.', (context, workspace) =>
              moveStage(context, workspace, {
                workItemId,
                toStageId,
                metCriterionIds: met,
                overrideReason: reason || null,
              })
            )
          }
        >
          Move it
        </button>
      </div>

      {needsReason ? (
        <p className="ccrm-move-note" role="note">
          Nothing is blocking this. An authorised person can always move work they know is ready,
          and the module records that they did and why.
        </p>
      ) : null}

      <WriteResultLine result={write.last} onClear={write.clearLast} />
    </section>
  );
};

/* ---------------------------------------------------------- close/reopen */

const Resolution: React.FC<{ workItemId: string; status: string; reason: string | null }> = ({
  workItemId,
  status,
  reason,
}) => {
  const write = useCrmWrite();
  const [text, setText] = React.useState('');

  const open = status === 'open' || status === 'on_hold';

  return (
    <section className="ccrm-panel" aria-labelledby="w-resolve">
      <div className="ccrm-panel-head">
        <div>
          <h3 className="ccrm-panel-title" id="w-resolve">
            {open ? 'Close it' : 'Reopen it'}
          </h3>
          <p className="ccrm-panel-description">
            {open
              ? 'A loss needs a reason. In six months it is the only thing anybody will want to know, and now is the only moment it is cheap to write down.'
              : 'A customer who comes back is not a new deal. Reopening keeps the history, and the reason it was closed stays in the audit trail beside the reason it was reopened.'}
          </p>
        </div>
      </div>

      {!open && reason ? (
        <p className="ccrm-closed-reason">
          It was closed as {status.replace(/_/g, ' ')}, because: {reason}
        </p>
      ) : null}

      <Field
        label={open ? 'Reason' : 'Why is this being reopened?'}
        id="w-resolution"
        required={!open || true}
        hint={open ? 'Required when it is not proceeding. Optional on a win.' : undefined}
      >
        <input
          id="w-resolution"
          className="form-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>

      <div className="ccrm-proposal-actions">
        {open ? (
          <>
            <button
              type="button"
              className="btn-secondary ccrm-button ccrm-button-primary"
              onClick={() =>
                write.run('It was recorded as won.', (context, workspace) =>
                  closeWorkItem(context, workspace, workItemId, 'won', text)
                )
              }
            >
              Won
            </button>
            <button
              type="button"
              className="btn-secondary ccrm-button"
              onClick={() =>
                write.run('It was recorded as not proceeding.', (context, workspace) =>
                  closeWorkItem(context, workspace, workItemId, 'not_proceeding', text)
                )
              }
            >
              Not proceeding
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            onClick={() =>
              write.run('It was reopened.', (context, workspace) =>
                reopenWorkItem(context, workspace, workItemId, text)
              )
            }
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reopen it
          </button>
        )}
      </div>

      <WriteResultLine result={write.last} onClear={write.clearLast} />
    </section>
  );
};

/* ---------------------------------------------------------------- page */

export const CrmWorkItemPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const { workItemId } = useParams<{ workItemId: string }>();
  const write = useCrmWrite();

  const workspace = React.useMemo(
    () => (workItemId ? buildWorkItemWorkspace(data, workItemId, now) : null),
    [data, workItemId, now]
  );

  const [nextStep, setNextStepText] = React.useState('');
  const [nextStepDue, setNextStepDue] = React.useState('');
  const [closeDate, setCloseDate] = React.useState('');
  const [closeDateReason, setCloseDateReason] = React.useState('');

  if (!workspace) {
    return (
      <section className="ccrm-view">
        <div className="ccrm-view-head">
          <div>
            <h2 className="ccrm-view-title" id="ccrm-view-title">
              That work is not in this workspace
            </h2>
            <p className="ccrm-view-description">
              It may belong to another workspace, or it may have been removed. Records are never
              shared between workspaces.
            </p>
          </div>
        </div>
        <ErrorState what="this record" />
        <p className="ccrm-panel-more">
          <Link className="ccrm-text-link" to={linkTo('/crm/pipeline')}>
            <ArrowLeft size={13} aria-hidden="true" />
            Back to the pipeline
          </Link>
        </p>
      </section>
    );
  }

  const { item, card, estimate } = workspace;

  return (
    <Stage4Scaffold
      title={item.title}
      description={`${workspace.recordWord}. ${workspace.organisation?.name ?? 'No organisation recorded'}. ${card.stage.name}, ${card.daysInStage} days.`}
      loadingLabel="this record"
      emptyTitle="Nothing is recorded here yet"
      emptyBody="The record fills as conversations, decisions and commitments are recorded."
      resultCount={1}
      totalCount={1}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-panel-more">
        <Link className="ccrm-text-link" to={linkTo('/crm/pipeline')}>
          <ArrowLeft size={13} aria-hidden="true" />
          Back to the pipeline
        </Link>
      </p>

      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{card.daysInStage}</span>
            <span className="ccrm-card-label">Days at {card.stage.name}</span>
            <span className="ccrm-card-note">{card.typicalDays} is usual at this stage here.</span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">
              {/* Not abbreviated. A tile that rounds $7,500 to $8K disagrees
                  with the figure recorded three blocks further down the same
                  page, and the reader has no way to tell which one is the
                  record. */}
              {card.expectedValue === null
                ? 'Not recorded'
                : new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency: 'AUD',
                    maximumFractionDigits: 0,
                  }).format(card.expectedValue)}
            </span>
            <span className="ccrm-card-label">Amount</span>
            <span className="ccrm-card-note">
              {card.expectedValue === null
                ? 'No figure is recorded.'
                : `The figure was ${card.valueBasis} rather than guessed.`}
            </span>
          </span>
        </li>
        <li>
          <span
            className={`ccrm-card${card.closeDateChanges.length >= 2 ? ' ccrm-card-attention' : ''}`}
          >
            <span className="ccrm-card-count">{card.closeDateChanges.length}</span>
            <span className="ccrm-card-label">Close-date changes</span>
            <span className="ccrm-card-note">
              <Value value={card.expectedCloseDate} absent="No expected date recorded." />
            </span>
          </span>
        </li>
        <li>
          <span className={`ccrm-card${card.stale ? ' ccrm-card-attention' : ''}`}>
            <span className="ccrm-card-count">
              {card.daysSinceMeaningfulContact ?? '—'}
            </span>
            <span className="ccrm-card-label">Days since a conversation</span>
            <span className="ccrm-card-note">
              {card.staleReason ?? 'Recorded contact with the customer.'}
            </span>
          </span>
        </li>
      </ul>

      <div className="ccrm-panel-grid">
        {/* Customer, contacts and stakeholder roles. */}
        <section className="ccrm-panel" aria-labelledby="w-customer">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-customer">
                Customer and contacts
              </h3>
            </div>
          </div>
          {workspace.organisation ? (
            <p className="ccrm-panel-description">
              <Link
                className="ccrm-text-link"
                to={linkTo(`/crm/organisations/${workspace.organisation.id}`)}
              >
                {workspace.organisation.name}
              </Link>
            </p>
          ) : (
            <p className="ccrm-panel-empty">No organisation is recorded against this.</p>
          )}

          {workspace.contacts.length === 0 ? (
            <p className="ccrm-panel-empty">Nobody is recorded at this organisation.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.contacts.map((contact) => (
                <li key={contact.person.id}>
                  <Link className="ccrm-item" to={linkTo(`/crm/people/${contact.person.id}`)}>
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">
                        {contact.person.fullName}
                        {contact.isPrimary ? (
                          <span className="ccrm-role-primary">Primary</span>
                        ) : null}
                      </span>
                      <span className="ccrm-item-context">{contact.role}</span>
                      <span className="ccrm-reason">
                        <span className="ccrm-reason-text">
                          {contact.lastContactAt
                            ? `Last spoken to ${contact.lastContactAt.slice(0, 10)}.`
                            : 'No conversation recorded with this person.'}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {workspace.missingRoles.length > 0 ? (
            <p className="ccrm-missing-roles">
              Not recorded: {workspace.missingRoles.join(', ')}. A decision usually needs somebody
              in each of those.
            </p>
          ) : null}
        </section>

        {/* Need or scope. */}
        <section className="ccrm-panel" aria-labelledby="w-need">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-need">
                Need or scope
              </h3>
              <p className="ccrm-panel-description">
                Taken from what was recorded, not from a field somebody has to remember to fill in.
              </p>
            </div>
          </div>
          {workspace.need ? (
            <>
              <blockquote className="ccrm-trail-quote">
                <span>{workspace.need}</span>
              </blockquote>
              <p className="ccrm-trail-meta">From {workspace.needSource}.</p>
            </>
          ) : (
            <p className="ccrm-panel-empty">
              Nothing is recorded about what they actually want. That is usually the first thing
              worth fixing.
            </p>
          )}

          <Facts
            items={[
              { term: 'Stage', value: card.stage.name },
              { term: 'Status', value: item.status.replace(/_/g, ' ') },
              {
                term: 'Amount',
                value: <Money amount={item.valueAmount} basis={item.valueBasis} />,
              },
              {
                term: 'Expected date',
                value: <Value value={item.expectedCloseDate} absent="Not recorded" />,
              },
              {
                term: 'Next step',
                value: <Value value={item.nextStep} absent="Not recorded" />,
              },
            ]}
          />
        </section>

        {/* Required approvals. */}
        <section className="ccrm-panel" aria-labelledby="w-approvals">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-approvals">
                What has to happen before this moves
              </h3>
              <p className="ccrm-panel-description ccrm-policy">
                Drawn from the stage criteria and from proposed updates waiting on a person. There
                is no separate approval engine here, because one that nothing enforced would be a
                screen that lies.
              </p>
            </div>
          </div>
          {workspace.requiredApprovals.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing is outstanding.</p>
          ) : (
            <ul className="ccrm-approval-list">
              {workspace.requiredApprovals.map((approval, index) => (
                <li className={`ccrm-approval ccrm-approval-${approval.state}`} key={index}>
                  <span className="ccrm-approval-what">{approval.what}</span>
                  <span className="ccrm-approval-detail">{approval.detail}</span>
                  <span className="ccrm-approval-origin">{approval.origin}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Risks. */}
        <section className="ccrm-panel" aria-labelledby="w-risks">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-risks">
                What is worth knowing
              </h3>
              <p className="ccrm-panel-description ccrm-policy">
                Named conditions with the fact behind each. There is no risk score.
              </p>
            </div>
          </div>
          {workspace.risks.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing on this record stands out.</p>
          ) : (
            <ul className="ccrm-risk-list">
              {workspace.risks.map((risk, index) => (
                <li className="ccrm-risk" key={index}>
                  <span className="ccrm-risk-what">{risk.what}</span>
                  <span className="ccrm-risk-because">{risk.because}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Competition. */}
        <section className="ccrm-panel" aria-labelledby="w-competition">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-competition">
                Competition
              </h3>
              <p className="ccrm-panel-description ccrm-policy">
                Drawn from what was said and when, not from a field. A competitor name typed once
                and never updated gets repeated in a meeting as if it were current.
              </p>
            </div>
          </div>
          {workspace.competition.length === 0 ? (
            <p className="ccrm-panel-empty">
              Nobody has recorded anything about somebody else being in this conversation. That is
              not the same as there being nobody.
            </p>
          ) : (
            <ul className="ccrm-trail-list">
              {workspace.competition.map((mention, index) => (
                <li className="ccrm-trail" key={index}>
                  <blockquote className="ccrm-trail-quote">
                    <span>{mention.quote}</span>
                  </blockquote>
                  <p className="ccrm-trail-meta">
                    {mention.from}, {mention.when.slice(0, 10)}.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Products and quote. */}
        <section className="ccrm-panel" aria-labelledby="w-commercial">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-commercial">
                Products and quotes
              </h3>
            </div>
          </div>
          {workspace.quotes.length === 0 ? (
            <p className="ccrm-panel-empty">No quote is recorded against this.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.quotes.map(({ quote, lines }) => (
                <li key={quote.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">Quote {quote.reference}</span>
                      <span className="ccrm-item-context">
                        {quote.state.replace(/_/g, ' ')}
                        {quote.sentOn ? `, sent ${quote.sentOn}` : ''}
                      </span>
                      {lines.length > 0 ? (
                        <span className="ccrm-reason">
                          <span className="ccrm-reason-text">
                            {lines.map((l) => `${l.quantity} × ${l.description}`).join('; ')}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {workspace.products.length > 0 ? (
            <p className="ccrm-panel-more">
              Available here: {workspace.products.map((p) => p.name).join(', ')}.
            </p>
          ) : null}
        </section>
      </div>

      {/* The write controls. */}
      <h3 className="ccrm-group-title">Record what happened</h3>

      <div className="ccrm-panel-grid">
        <StageMover
          workItemId={item.id}
          currentStageId={item.stageId}
          pipelineId={item.pipelineId}
          criteria={card.criteria}
        />

        <section className="ccrm-panel" aria-labelledby="w-next">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-next">
                The next step
              </h3>
              <p className="ccrm-panel-description">
                Work with nothing written down as the next thing to do has nothing scheduled to
                happen.
              </p>
            </div>
          </div>

          <Field label="What happens next" id="w-next-step">
            <input
              id="w-next-step"
              className="form-input"
              value={nextStep}
              onChange={(event) => setNextStepText(event.target.value)}
              placeholder={item.nextStep ?? 'Nothing recorded'}
            />
          </Field>
          <Field label="By when" id="w-next-due">
            <input
              id="w-next-due"
              className="form-input"
              type="date"
              value={nextStepDue}
              onChange={(event) => setNextStepDue(event.target.value)}
            />
          </Field>

          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            onClick={() =>
              write.run('The next step was recorded.', (context, data2) =>
                setNextStep(context, data2, item.id, nextStep || null, nextStepDue || null)
              )
            }
          >
            Record it
          </button>

          <h4 className="ccrm-sub-heading">Expected date</h4>
          <Field
            label="New expected date"
            id="w-close-date"
            hint="Every change is kept. One change is a plan; four is a conversation somebody is not having."
          >
            <input
              id="w-close-date"
              className="form-input"
              type="date"
              value={closeDate}
              onChange={(event) => setCloseDate(event.target.value)}
            />
          </Field>
          <Field label="Why it moved" id="w-close-reason">
            <input
              id="w-close-reason"
              className="form-input"
              value={closeDateReason}
              onChange={(event) => setCloseDateReason(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={!closeDate}
            onClick={() =>
              write.run('The expected date was changed.', (context, data2) =>
                setExpectedCloseDate(context, data2, item.id, closeDate, closeDateReason || undefined)
              )
            }
          >
            Change the date
          </button>

          <WriteResultLine result={write.last} onClear={write.clearLast} />
        </section>

        <Resolution
          workItemId={item.id}
          status={item.status}
          reason={item.resolutionReason}
        />
      </div>

      {/* The evidence-based estimate for this one record. */}
      <section className="ccrm-panel ccrm-panel-lead" aria-labelledby="w-estimate">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="w-estimate">
              What the record supports
            </h3>
            <p className="ccrm-panel-description ccrm-policy">
              Not a forecast and not a probability. A description of what is written down, factor by
              factor, so it can be argued with.
            </p>
          </div>
          <span className="ccrm-answer-count">{estimate.band}</span>
        </div>
        <p className="ccrm-estimate-explanation">{estimate.explanation}</p>
        <ul className="ccrm-factor-list">
          {estimate.factors.map((factor) => (
            <li className={`ccrm-factor ccrm-factor-${factor.direction}`} key={factor.name}>
              <span className="ccrm-factor-name">{factor.name}</span>
              <span className="ccrm-factor-fact">{factor.fact}</span>
              <span className="ccrm-factor-direction">{factor.direction}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* History. */}
      <div className="ccrm-panel-grid">
        <section className="ccrm-panel" aria-labelledby="w-stage-history">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-stage-history">
                Stage history
              </h3>
            </div>
          </div>
          {workspace.stageHistory.length === 0 ? (
            <p className="ccrm-panel-empty">No stage moves are recorded.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.stageHistory.map(({ move, fromName, toName }) => (
                <li key={move.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">
                        {fromName ? `${fromName} to ${toName}` : `Entered at ${toName}`}
                      </span>
                      <span className="ccrm-item-context">{move.movedAt.slice(0, 10)}</span>
                      {move.criteriaUnmet.length > 0 ? (
                        <span className="ccrm-reason">
                          <span className="ccrm-standing ccrm-standing-review">Needs review</span>
                          <span className="ccrm-reason-text">
                            Moved with {move.criteriaUnmet.length} unmet{' '}
                            {move.criteriaUnmet.length === 1 ? 'criterion' : 'criteria'}.{' '}
                            {move.overrideReason}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="w-dates">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-dates">
                Close-date movement
              </h3>
            </div>
          </div>
          {workspace.closeDateChanges.length === 0 ? (
            <p className="ccrm-panel-empty">The expected date has not been changed.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.closeDateChanges.map((change, index) => (
                <li key={index}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">
                        <Value value={change.from} absent="not set" /> to{' '}
                        <Value value={change.to} absent="not set" />
                        {change.movedDays !== null ? (
                          <span className="ccrm-kcard-moved">
                            {change.movedDays > 0 ? `${change.movedDays} days later` : `${-change.movedDays} days earlier`}
                          </span>
                        ) : null}
                      </span>
                      <span className="ccrm-item-context">{change.at.slice(0, 10)}</span>
                      <span className="ccrm-reason">
                        <span className="ccrm-reason-text">
                          <Value value={change.reason} absent="No reason was recorded." />
                        </span>
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="w-commitments">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-commitments">
                Commitments and decisions
              </h3>
            </div>
          </div>

          <h4 className="ccrm-sub-heading">We promised</h4>
          {workspace.commitments.ours.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.commitments.ours.map((c) => (
                <li key={c.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{c.description}</span>
                      <span className="ccrm-item-context">
                        {c.dueDate ? `Due ${c.dueDate}` : 'No date agreed'}, {c.state}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="ccrm-sub-heading">They promised</h4>
          {workspace.commitments.theirs.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.commitments.theirs.map((c) => (
                <li key={c.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{c.description}</span>
                      <span className="ccrm-item-context">
                        {c.ownerName}, {c.dueDate ? `due ${c.dueDate}` : 'no date agreed'}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="ccrm-sub-heading">Decisions</h4>
          {workspace.decisions.length === 0 ? (
            <p className="ccrm-panel-empty">None recorded.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.decisions.map((d) => (
                <li key={d.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{d.title}</span>
                      <span className="ccrm-item-context">
                        {d.decidedByName ?? 'Decider not recorded'}
                        {d.decidedOn ? `, ${d.decidedOn}` : ''}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="w-audit">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="w-audit">
                Audit history
              </h3>
              <p className="ccrm-panel-description">
                Every change, append only. The row is written by the same function that makes the
                change, so there is no path that changes a record without one.
              </p>
            </div>
          </div>
          {workspace.audit.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing has been changed through the application.</p>
          ) : (
            <ul className="ccrm-item-list">
              {workspace.audit.map((entry, index) => (
                <li key={index}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{entry.what}</span>
                      <span className="ccrm-item-context">{entry.at.slice(0, 10)}</span>
                      {entry.detail ? (
                        <span className="ccrm-reason">
                          <span className="ccrm-reason-text">{entry.detail}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ccrm-panel" aria-labelledby="w-evidence">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="w-evidence">
              Source evidence
            </h3>
            <p className="ccrm-panel-description">
              Each recorded value and the sentence behind it.
            </p>
          </div>
        </div>
        <SourceTrailList
          trails={workspace.evidence}
          linkTo={linkTo}
          emptyMessage="No stored field on this record carries a source sentence. Where something above is quoted, the quote and its meeting are shown with it."
        />
      </section>

      <section className="ccrm-panel" aria-labelledby="w-timeline">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="w-timeline">
              Everything that happened
            </h3>
          </div>
        </div>
        <TimelineList
          entries={workspace.timeline}
          linkTo={linkTo}
          emptyMessage="Nothing is recorded against this."
          limit={20}
        />
      </section>
    </Stage4Scaffold>
  );
};
