/**
 * The organisation record, whose first screen is Account 360.
 *
 * WHY THESE ARE ONE PAGE AND NOT TWO.
 *
 * The brief asks for an organisation record AND an Account 360 that "combines
 * the relevant customer history without forcing the user to open multiple
 * modules". Built as two pages those are the same page twice: an organisation
 * record that does not combine the history is the thing Account 360 exists to
 * fix, and an Account 360 that is not the organisation record is a second place
 * to look for the same account, which is the problem restated.
 *
 * So the page opens with the 360, the answer to "what is going on here", and
 * everything below is the record that answer was drawn from. A person who wants
 * the summary stops after one screen; a person who wants the detail keeps
 * scrolling; neither of them opens a second module.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BrainCircuit } from 'lucide-react';
import {
  FlagList,
  SourceTrailList,
  Stage4Scaffold,
  TimelineList,
  useStage4,
} from '../../components/crm/Stage4Scaffold';
import { Column, DataTable, Facts, Money, NotYetBuilt, Value } from '../../components/crm/viewPrimitives';
import { ErrorState } from '../../components/crm/StateBlocks';
import { organisationRecord } from '../../lib/crm/stage4/records';
import { WorkItem } from '../../lib/crm/domain';

export const CrmOrganisationPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const { organisationId } = useParams<{ organisationId: string }>();

  const record = React.useMemo(
    () => (organisationId ? organisationRecord(data, organisationId, now) : null),
    [data, organisationId, now]
  );

  if (!record) {
    return (
      <section className="ccrm-view">
        <div className="ccrm-view-head">
          <div>
            <h2 className="ccrm-view-title" id="ccrm-view-title">
              That organisation is not in this workspace
            </h2>
            <p className="ccrm-view-description">
              The record may belong to another workspace, or it may have been removed. Records are
              never shared between workspaces, so a link from one does not open in another.
            </p>
          </div>
        </div>
        <ErrorState what="this organisation record" />
        <p className="ccrm-panel-more">
          <Link className="ccrm-text-link" to={linkTo('/crm/organisations')}>
            <ArrowLeft size={13} aria-hidden="true" />
            Back to Organisations
          </Link>
        </p>
      </section>
    );
  }

  const { organisation, account360: three60 } = record;

  const workColumns: Column<WorkItem>[] = [
    {
      key: 'title',
      header: 'Work',
      isRowHeader: true,
      render: (row) => (
        <span className="ccrm-cell-stack">
          <span className="ccrm-cell-strong">{row.title}</span>
          <span className="ccrm-cell-quiet">
            {data.stages.find((s) => s.id === row.stageId)?.name ?? 'Stage not recorded'}
          </span>
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      narrow: true,
      render: (row) => <Money amount={row.valueAmount} basis={row.valueBasis} />,
    },
    {
      key: 'close',
      header: 'Expected close',
      narrow: true,
      render: (row) => <Value value={row.expectedCloseDate} absent="No date recorded" />,
    },
    {
      key: 'next',
      header: 'Next step',
      render: (row) => (
        <span className="ccrm-cell-stack">
          <Value value={row.nextStep} absent="No next step recorded" />
          {row.nextStepDue ? (
            <span className="ccrm-cell-quiet">Due {row.nextStepDue}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      narrow: true,
      render: (row) => <span className="ccrm-cell-quiet">{row.status.replace(/_/g, ' ')}</span>,
    },
  ];

  return (
    <Stage4Scaffold
      title={organisation.name}
      toolbar={
        <Link
          className="btn btn-primary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--gold, #E2B53C)',
            color: 'var(--navy, #0D1626)',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '13px',
          }}
          to={linkTo(`/crm/organisations/${organisation.id}/knowledge`)}
        >
          <BrainCircuit size={16} aria-hidden="true" />
          Knowledge Hub
        </Link>
      }
      description={record.summary}
      loadingLabel="this account"
      emptyTitle="Nothing is recorded against this organisation"
      emptyBody="The record fills as people, work and conversations are recorded."
      resultCount={1}
      totalCount={1}
    >
      <p className="ccrm-panel-more">
        <Link className="ccrm-text-link" to={linkTo('/crm/organisations')}>
          <ArrowLeft size={13} aria-hidden="true" />
          Back to Organisations
        </Link>
      </p>

      {record.ancestry.length > 0 ? (
        <nav className="ccrm-breadcrumb" aria-label="Organisation hierarchy">
          {record.ancestry.map((ancestor) => (
            <React.Fragment key={ancestor.id}>
              <Link className="ccrm-text-link" to={linkTo(`/crm/organisations/${ancestor.id}`)}>
                {ancestor.name}
              </Link>
              <span aria-hidden="true" className="ccrm-breadcrumb-sep">
                /
              </span>
            </React.Fragment>
          ))}
          <span className="ccrm-breadcrumb-current">{organisation.name}</span>
        </nav>
      ) : null}

      {/* ============================================= Account 360 */}

      <h3 className="ccrm-group-title" id="ccrm-360">
        Account 360
      </h3>
      <p className="ccrm-section-description">
        Everything about this account on one screen. Nothing here needs another module opened.
      </p>

      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{three60.relationship.contactCount}</span>
            <span className="ccrm-card-label">Contacts recorded</span>
            <span className="ccrm-card-note">
              {three60.relationship.singleContact
                ? 'One contact. If they move on there is nobody else recorded here.'
                : 'People recorded against this organisation.'}
            </span>
          </span>
        </li>
        <li>
          <span className={`ccrm-card${three60.relationship.lastMeaningfulDays !== null && three60.relationship.lastMeaningfulDays > 60 ? ' ccrm-card-attention' : ''}`}>
            <span className="ccrm-card-count">
              {three60.relationship.lastMeaningfulDays ?? '—'}
            </span>
            <span className="ccrm-card-label">Days since a conversation</span>
            <span className="ccrm-card-note">
              {three60.relationship.lastMeaningfulAt === null
                ? 'No conversation has ever been recorded here.'
                : `Last recorded ${three60.relationship.lastMeaningfulAt.slice(0, 10)}.`}
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{three60.commercial.openWork.length}</span>
            <span className="ccrm-card-label">Open work</span>
            <span className="ccrm-card-note">
              {three60.commercial.openValue === null
                ? 'No figure is recorded against any of it.'
                : `${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(three60.commercial.openValue)} recorded${three60.commercial.anyValueInferred ? ', some of it inferred rather than stated.' : '.'}`}
            </span>
          </span>
        </li>
        <li>
          <span className={`ccrm-card${three60.service.open.length > 0 ? ' ccrm-card-attention' : ''}`}>
            <span className="ccrm-card-count">{three60.service.open.length}</span>
            <span className="ccrm-card-label">Open service matters</span>
            <span className="ccrm-card-note">
              An open service matter sits between the customer and anything else being agreed.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">
              {three60.outstandingCommitments.ours.length + three60.outstandingCommitments.theirs.length}
            </span>
            <span className="ccrm-card-label">Outstanding commitments</span>
            <span className="ccrm-card-note">
              {three60.outstandingCommitments.ours.length} ours,{' '}
              {three60.outstandingCommitments.theirs.length} theirs.
            </span>
          </span>
        </li>
        <li>
          <span className={`ccrm-card${three60.commercial.renewalInDays !== null && three60.commercial.renewalInDays >= 0 && three60.commercial.renewalInDays <= 60 ? ' ccrm-card-attention' : ''}`}>
            <span className="ccrm-card-count">
              {three60.commercial.renewalInDays ?? '—'}
            </span>
            <span className="ccrm-card-label">Days to renewal</span>
            <span className="ccrm-card-note">
              <Value value={three60.commercial.renewalDate} absent="No renewal date is recorded." />
            </span>
          </span>
        </li>
      </ul>

      <div className="ccrm-panel-grid">
        <section className="ccrm-panel ccrm-panel-lead" aria-labelledby="o-next">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-next">
                Next recommended actions
              </h4>
              <p className="ccrm-panel-description">
                Drawn from next steps and commitments somebody recorded. Nothing here is invented.
              </p>
            </div>
          </div>
          {three60.nextActions.length === 0 ? (
            <p className="ccrm-panel-empty">
              Nothing is recorded as the next thing to do, which is itself worth knowing.
            </p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.nextActions.map((action, index) => (
                <li key={`${action.what}-${index}`}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{action.what}</span>
                      <span className="ccrm-item-context">{action.why}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="o-risks">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-risks">
                What is worth knowing
              </h4>
              <p className="ccrm-panel-description ccrm-policy">
                Named conditions with the fact behind each one. There is no risk score.
              </p>
            </div>
          </div>
          {three60.risks.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing on this account stands out.</p>
          ) : (
            <ul className="ccrm-risk-list">
              {three60.risks.map((risk, index) => (
                <li className="ccrm-risk" key={index}>
                  <span className="ccrm-risk-what">{risk.what}</span>
                  <span className="ccrm-risk-because">{risk.because}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="o-contacts">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-contacts">
                Key contacts and missing roles
              </h4>
              <p className="ccrm-panel-description">{record.coverage.summary}</p>
            </div>
          </div>

          {three60.keyContacts.length === 0 ? (
            <p className="ccrm-panel-empty">Nobody has a role recorded here.</p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.keyContacts.map((contact) => (
                <li key={contact.person.id}>
                  <Link className="ccrm-item" to={linkTo(`/crm/people/${contact.person.id}`)}>
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{contact.person.fullName}</span>
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

          {three60.missingRoles.length > 0 ? (
            <p className="ccrm-missing-roles">
              Not recorded: {three60.missingRoles.join(', ')}. A decision usually needs somebody in
              each of those.
            </p>
          ) : null}
        </section>

        <section className="ccrm-panel" aria-labelledby="o-commitments">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-commitments">
                Outstanding commitments
              </h4>
              <p className="ccrm-panel-description">What was promised, and by whom.</p>
            </div>
          </div>

          <h5 className="ccrm-sub-heading">We promised</h5>
          {three60.outstandingCommitments.ours.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing we promised is still open.</p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.outstandingCommitments.ours.map((commitment) => (
                <li key={commitment.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{commitment.description}</span>
                      <span className="ccrm-item-context">
                        {commitment.dueDate ? `Due ${commitment.dueDate}` : 'No date agreed'}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h5 className="ccrm-sub-heading">They promised</h5>
          {three60.outstandingCommitments.theirs.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing promised to us is still open.</p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.outstandingCommitments.theirs.map((commitment) => (
                <li key={commitment.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{commitment.description}</span>
                      <span className="ccrm-item-context">
                        {commitment.ownerName}
                        {commitment.dueDate ? `, due ${commitment.dueDate}` : ', no date agreed'}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="o-decisions">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-decisions">
                Recent decisions
              </h4>
              <p className="ccrm-panel-description">
                What was decided, and the reasoning somebody recorded with it.
              </p>
            </div>
          </div>
          {three60.recentDecisions.length === 0 ? (
            <p className="ccrm-panel-empty">No decisions are recorded against this account.</p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.recentDecisions.map((decision) => (
                <li key={decision.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{decision.title}</span>
                      <span className="ccrm-item-context">
                        {decision.decidedByName ?? 'Decider not recorded'}
                        {decision.decidedOn ? `, ${decision.decidedOn}` : ''}
                      </span>
                      <span className="ccrm-reason">
                        <span className="ccrm-reason-text">
                          <Value value={decision.reasoning} absent="No reasoning was recorded." />
                        </span>
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="o-commercial">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-commercial">
                Commercial status
              </h4>
              <p className="ccrm-panel-description">
                Quotes and invoices. Concludo points at the accounting system and never authors a
                figure.
              </p>
            </div>
          </div>

          <h5 className="ccrm-sub-heading">Active quotes</h5>
          {three60.commercial.activeQuotes.length === 0 ? (
            <p className="ccrm-panel-empty">No quote is open.</p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.commercial.activeQuotes.map((quote) => (
                <li key={quote.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">Quote {quote.reference}</span>
                      <span className="ccrm-item-context">
                        {quote.state.replace(/_/g, ' ')}
                        {quote.sentOn ? `, sent ${quote.sentOn}` : ''}
                        {quote.validUntil ? `, valid until ${quote.validUntil}` : ''}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h5 className="ccrm-sub-heading">Invoice status</h5>
          {three60.commercial.invoices.length === 0 ? (
            <p className="ccrm-panel-empty">No invoice is referenced for this account.</p>
          ) : (
            <ul className="ccrm-item-list">
              {three60.commercial.invoices.map((invoice) => (
                <li key={invoice.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">
                        {invoice.externalId},{' '}
                        <Value value={invoice.cachedStatus} absent="status not read" />
                      </span>
                      <span className="ccrm-item-context">
                        {invoice.cachedAmount !== null
                          ? new Intl.NumberFormat('en-AU', {
                              style: 'currency',
                              currency: invoice.cachedCurrency ?? 'AUD',
                              maximumFractionDigits: 0,
                            }).format(invoice.cachedAmount)
                          : 'No amount read'}
                        {invoice.cachedDueDate ? `, due ${invoice.cachedDueDate}` : ''}
                      </span>
                      <span className="ccrm-reason">
                        <span className="ccrm-reason-text">
                          Read from {invoice.externalSystem.replace(/_/g, ' ')} on{' '}
                          {invoice.cachedAt?.slice(0, 10) ?? 'a date that was not recorded'}. This is
                          a copy of what that system said, not a figure authored here.
                        </span>
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ============================================ the record below */}

      <h3 className="ccrm-group-title">The record</h3>

      <div className="ccrm-panel-grid">
        <section className="ccrm-panel" aria-labelledby="o-summary">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-summary">
                Summary and structure
              </h4>
            </div>
          </div>
          <Facts
            items={[
              { term: 'Industry', value: <Value value={organisation.industry} absent="Not recorded" /> },
              { term: 'ABN', value: <Value value={organisation.abn} absent="Not recorded" /> },
              { term: 'Lifecycle', value: organisation.lifecycleState },
              {
                term: 'Parent',
                value: record.parent ? (
                  <Link className="ccrm-text-link" to={linkTo(`/crm/organisations/${record.parent.id}`)}>
                    {record.parent.name}
                  </Link>
                ) : (
                  <Value value={null} absent="No parent recorded" />
                ),
              },
              {
                term: 'Subsidiaries',
                value:
                  record.children.length === 0 ? (
                    <Value value={null} absent="None recorded" />
                  ) : (
                    <span>
                      {record.children.map((child, index) => (
                        <React.Fragment key={child.id}>
                          {index > 0 ? ', ' : ''}
                          <Link
                            className="ccrm-text-link"
                            to={linkTo(`/crm/organisations/${child.id}`)}
                          >
                            {child.name}
                          </Link>
                        </React.Fragment>
                      ))}
                    </span>
                  ),
              },
              {
                term: 'Renewal or review',
                value: <Value value={record.renewalDate} absent="No date recorded" />,
              },
            ]}
          />
        </section>

        <section className="ccrm-panel" aria-labelledby="o-plan">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-plan">
                Account plan
              </h4>
              <p className="ccrm-panel-description">
                An outcome with no measure is an aspiration, so every one carries its measure.
              </p>
            </div>
          </div>
          {record.accountPlan === null ? (
            <p className="ccrm-panel-empty">No account plan is recorded.</p>
          ) : (
            <>
              <p className="ccrm-plan-objective">{record.accountPlan.plan.objective}</p>
              <ul className="ccrm-outcome-list">
                {record.accountPlan.outcomes.map((outcome) => (
                  <li key={outcome.id}>
                    <span className="ccrm-outcome-label">{outcome.label}</span>
                    <span className="ccrm-cell-quiet">{outcome.measure}</span>
                    <span className="ccrm-cell-quiet">{outcome.state.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
              {record.accountPlan.plan.reviewDate ? (
                <p className="ccrm-panel-more">
                  Next review {record.accountPlan.plan.reviewDate}.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="o-quality">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-quality">
                Data quality
              </h4>
              <p className="ccrm-panel-description">
                About this record, never about whoever owns it.
              </p>
            </div>
          </div>
          <FlagList flags={record.flags} />
        </section>

        <section className="ccrm-panel" aria-labelledby="o-audit">
          <div className="ccrm-panel-head">
            <div>
              <h4 className="ccrm-panel-title" id="o-audit">
                Audit history
              </h4>
              <p className="ccrm-panel-description">
                What was done to these records, by whom and when. Append only.
              </p>
            </div>
          </div>
          {record.audit.length === 0 ? (
            <p className="ccrm-panel-empty">
              Nothing has been changed through the application yet. Audit rows are written when a
              record changes, which this read-only release does not do.
            </p>
          ) : (
            <ul className="ccrm-item-list">
              {record.audit.map((entry, index) => (
                <li key={index}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{entry.what}</span>
                      <span className="ccrm-item-context">
                        {entry.at.slice(0, 10)}
                        {entry.by ? `, by ${entry.by}` : ''}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ccrm-panel" aria-labelledby="o-work">
        <div className="ccrm-panel-head">
          <div>
            <h4 className="ccrm-panel-title" id="o-work">
              Work
            </h4>
            <p className="ccrm-panel-description">
              Every opportunity, job or case recorded against this account.
            </p>
          </div>
        </div>
        <DataTable
          caption={`Work recorded against ${organisation.name}`}
          columns={workColumns}
          rows={record.workItems}
          emptyMessage="No work is recorded against this account."
        />
      </section>

      <section className="ccrm-panel" aria-labelledby="o-people">
        <div className="ccrm-panel-head">
          <div>
            <h4 className="ccrm-panel-title" id="o-people">
              People
            </h4>
          </div>
        </div>
        {record.people.length === 0 ? (
          <p className="ccrm-panel-empty">Nobody is recorded at this organisation.</p>
        ) : (
          <ul className="ccrm-item-list">
            {record.people.map((entry) => (
              <li key={entry.person.id}>
                <Link className="ccrm-item" to={linkTo(`/crm/people/${entry.person.id}`)}>
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">
                      {entry.person.fullName}
                      {entry.isPrimary ? <span className="ccrm-role-primary">Primary</span> : null}
                    </span>
                    <span className="ccrm-item-context">
                      {entry.role}
                      {entry.person.roleLabel ? `, ${entry.person.roleLabel}` : ''}
                    </span>
                  </span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ccrm-panel" aria-labelledby="o-evidence">
        <div className="ccrm-panel-head">
          <div>
            <h4 className="ccrm-panel-title" id="o-evidence">
              Evidence sources
            </h4>
            <p className="ccrm-panel-description">
              Each recorded value and the sentence behind it.
            </p>
          </div>
        </div>
        <SourceTrailList
          trails={record.trails}
          linkTo={linkTo}
          emptyMessage="Nothing on this record was drawn out of a conversation."
        />
      </section>

      <section className="ccrm-panel" aria-labelledby="o-timeline">
        <div className="ccrm-panel-head">
          <div>
            <h4 className="ccrm-panel-title" id="o-timeline">
              Activity timeline
            </h4>
            <p className="ccrm-panel-description">
              Everything recorded against this account, most recent first.
            </p>
          </div>
          <Link className="ccrm-text-link" to={linkTo(`/crm/activities?org=${organisation.id}`)}>
            Open the full timeline
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <TimelineList
          entries={record.timeline}
          linkTo={linkTo}
          emptyMessage="Nothing is recorded against this account."
          limit={15}
        />
      </section>

      <NotYetBuilt
        what="Editing an account is not built in this release."
        why="This stage reads the model and shows what is recorded. Writing is the write path, and a button that looked like it saved and did not would be worse than no button."
        when="The write path is Stage 5."
      />
    </Stage4Scaffold>
  );
};
