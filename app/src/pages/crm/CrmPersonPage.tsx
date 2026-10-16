/**
 * The person record.
 *
 * ORDER IS THE DESIGN HERE.
 *
 * Consent and communication preferences sit above the contact details, not
 * below them. A person who scrolls to the phone number before they reach the
 * do-not-contact line has already made the mistake the line exists to prevent,
 * and "it was further down the page" is not a defence anybody wants to make to
 * a regulator or a customer.
 *
 * After that: what is open, what was said, what Concludo has proposed, and the
 * evidence behind any of it. Nothing on this page describes the person. Role,
 * preference and consent are things somebody recorded; there is no engagement
 * level, no responsiveness and no sentiment, because each of those is a number
 * about a human being derived from how diligently a salesperson typed.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  FlagList,
  SourceTrailList,
  Stage4Scaffold,
  TimelineList,
  useStage4,
} from '../../components/crm/Stage4Scaffold';
import { Facts, NotYetBuilt, Value } from '../../components/crm/viewPrimitives';
import { ErrorState } from '../../components/crm/StateBlocks';
import { personRecord } from '../../lib/crm/stage4/records';

export const CrmPersonPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const { personId } = useParams<{ personId: string }>();

  const record = React.useMemo(
    () => (personId ? personRecord(data, personId, now) : null),
    [data, personId, now]
  );

  if (!record) {
    return (
      <section className="ccrm-view">
        <div className="ccrm-view-head">
          <div>
            <h2 className="ccrm-view-title" id="ccrm-view-title">
              That person is not in this workspace
            </h2>
            <p className="ccrm-view-description">
              The record may belong to another workspace, or it may have been removed. Records are
              never shared between workspaces, so a link from one does not open in another.
            </p>
          </div>
        </div>
        <ErrorState what="this person record" />
        <p className="ccrm-panel-more">
          <Link className="ccrm-text-link" to={linkTo('/crm/people')}>
            <ArrowLeft size={13} aria-hidden="true" />
            Back to People
          </Link>
        </p>
      </section>
    );
  }

  const { person } = record;

  return (
    <Stage4Scaffold
      title={person.fullName}
      description={[record.roleLabel, record.organisation?.name].filter(Boolean).join(', ') ||
        'No role or organisation recorded.'}
      loadingLabel="this person record"
      emptyTitle="Nothing is recorded against this person"
      emptyBody="The record fills as conversations and commitments are recorded."
      resultCount={1}
      totalCount={1}
    >
      <p className="ccrm-panel-more">
        <Link className="ccrm-text-link" to={linkTo('/crm/people')}>
          <ArrowLeft size={13} aria-hidden="true" />
          Back to People
        </Link>
      </p>

      {/* The one thing that changes what somebody may do next, first. */}
      {record.doNotContact ? (
        <div className="ccrm-dnc-banner" role="note">
          <p className="ccrm-dnc-head">Do not contact</p>
          <p className="ccrm-dnc-body">{record.doNotContact.note}</p>
          <p className="ccrm-dnc-meta">
            Recorded against the {record.doNotContact.channel} channel
            {record.doNotContact.effectiveFrom
              ? `, effective from ${record.doNotContact.effectiveFrom}`
              : ''}
            .
          </p>
        </div>
      ) : null}

      <div className="ccrm-panel-grid">
        <section className="ccrm-panel" aria-labelledby="p-consent">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="p-consent">
                Consent and preferences
              </h3>
              <p className="ccrm-panel-description">
                Consent is a record with a basis, a time and a source, not a checkbox.
              </p>
            </div>
          </div>

          {record.consents.length === 0 ? (
            <p className="ccrm-panel-empty">
              No consent of any kind is recorded for this person. That is a gap worth closing before
              anything is sent.
            </p>
          ) : (
            <ul className="ccrm-consent-list">
              {record.consents.map((consent) => (
                <li
                  className={`ccrm-consent${consent.withdrawnAt ? ' ccrm-consent-withdrawn' : ''}`}
                  key={`${consent.type}-${consent.capturedAt}`}
                >
                  <span className="ccrm-consent-type">{consent.type}</span>
                  <span className="ccrm-consent-sentence">{consent.sentence}</span>
                </li>
              ))}
            </ul>
          )}

          {record.preferences.length > 0 ? (
            <ul className="ccrm-pref-list">
              {record.preferences.map((preference) => (
                <li className="ccrm-pref" key={preference.id}>
                  <span className="ccrm-pref-channel">{preference.channel}</span>
                  <span className="ccrm-pref-value">{preference.preference.replace(/_/g, ' ')}</span>
                  <span className="ccrm-pref-note">{preference.note}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="ccrm-panel" aria-labelledby="p-details">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="p-details">
                Details
              </h3>
              <p className="ccrm-panel-description">
                What was recorded. Absence is written as a sentence, never as a dash.
              </p>
            </div>
          </div>

          <Facts
            items={[
              { term: 'Name', value: person.fullName },
              {
                term: 'Known role',
                value: <Value value={record.roleLabel} absent="Not recorded" />,
              },
              {
                term: 'Role in a decision',
                value: <Value value={record.stakeholderRole} absent="Not recorded" />,
              },
              {
                term: 'Organisation',
                value: record.organisation ? (
                  <Link
                    className="ccrm-text-link"
                    to={linkTo(`/crm/organisations/${record.organisation.id}`)}
                  >
                    {record.organisation.name}
                  </Link>
                ) : (
                  <Value value={null} absent="Not recorded" />
                ),
              },
              {
                term: 'Email',
                value: (
                  <span>
                    <Value value={person.primaryEmail} absent="Not recorded" />
                    {person.primaryEmailScope === 'personal' ? (
                      <span className="ccrm-scope-chip">Personal address</span>
                    ) : null}
                  </span>
                ),
              },
              { term: 'Phone', value: <Value value={person.phone} absent="Not recorded" /> },
              {
                term: 'Relationship owner',
                value: <Value value={record.relationshipOwner} absent="Nobody recorded" />,
              },
              {
                term: 'Last meaningful interaction',
                value:
                  record.lastMeaningfulAt === null ? (
                    <Value value={null} absent="None recorded" />
                  ) : (
                    <span>
                      {record.lastMeaningfulAt.slice(0, 10)}
                      <span className="ccrm-cell-quiet"> ({record.lastMeaningfulDays} days ago)</span>
                    </span>
                  ),
              },
            ]}
          />

          {record.tags.length > 0 ? (
            <p className="ccrm-tag-row">
              {record.tags.map((tag) => (
                <span className="ccrm-tag" key={tag.id}>
                  {tag.label}
                </span>
              ))}
            </p>
          ) : null}
        </section>

        <section className="ccrm-panel" aria-labelledby="p-open">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="p-open">
                What is open
              </h3>
              <p className="ccrm-panel-description">
                Commitments, work and service matters with this person attached.
              </p>
            </div>
          </div>

          <h4 className="ccrm-sub-heading">Upcoming commitments</h4>
          {record.upcomingCommitments.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing is promised either way.</p>
          ) : (
            <ul className="ccrm-item-list">
              {record.upcomingCommitments.map((commitment) => (
                <li key={commitment.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{commitment.description}</span>
                      <span className="ccrm-item-context">
                        {commitment.ownedByUs ? 'We promised this' : 'They promised this'}
                        {commitment.dueDate ? `, by ${commitment.dueDate}` : ', with no date agreed'}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="ccrm-sub-heading">Open work</h4>
          {record.openWork.length === 0 ? (
            <p className="ccrm-panel-empty">No open work has this person as its main contact.</p>
          ) : (
            <ul className="ccrm-item-list">
              {record.openWork.map((item) => (
                <li key={item.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{item.title}</span>
                      <span className="ccrm-item-context">
                        <Value value={item.nextStep} absent="No next step recorded" />
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="ccrm-sub-heading">Open service matters</h4>
          {record.openServiceCases.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing is open.</p>
          ) : (
            <ul className="ccrm-item-list">
              {record.openServiceCases.map((serviceCase) => (
                <li key={serviceCase.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">{serviceCase.title}</span>
                      <span className="ccrm-item-context">
                        <Value
                          value={serviceCase.relationshipEffect}
                          absent="No relationship effect recorded"
                        />
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccrm-panel" aria-labelledby="p-quality">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="p-quality">
                Record quality
              </h3>
              <p className="ccrm-panel-description">
                What is missing, unconfirmed or in conflict on this record. Nothing here is about the
                person or about whoever owns them.
              </p>
            </div>
          </div>
          <FlagList flags={record.flags} />
        </section>
      </div>

      <section className="ccrm-panel" aria-labelledby="p-notes">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="p-notes">
              Notes, with their source
            </h3>
            <p className="ccrm-panel-description">
              A private note says so. Nothing here is hidden from the person it is about by
              accident.
            </p>
          </div>
        </div>
        {record.notes.length === 0 ? (
          <p className="ccrm-panel-empty">No notes are recorded against this person.</p>
        ) : (
          <ul className="ccrm-item-list">
            {record.notes.map((note) => (
              <li key={note.id}>
                <span className="ccrm-item">
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">
                      {note.isPrivate ? 'Private note' : 'Note'}
                    </span>
                    <span className="ccrm-item-context">{note.body}</span>
                    <span className="ccrm-reason">
                      <span className="ccrm-reason-text">
                        Recorded {note.createdAt.slice(0, 10)}.
                        {note.isPrivate
                          ? ' Visible to its author and to administrators.'
                          : ' Visible to everyone in this workspace.'}
                      </span>
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ccrm-panel" aria-labelledby="p-evidence">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="p-evidence">
              Where these values came from
            </h3>
            <p className="ccrm-panel-description">
              Each recorded value, the sentence behind it, and the record that sentence sits in.
            </p>
          </div>
        </div>
        <SourceTrailList
          trails={record.trails}
          linkTo={linkTo}
          emptyMessage="Nothing on this record was drawn out of a conversation. Everything here was entered by a person."
        />
      </section>

      <section className="ccrm-panel" aria-labelledby="p-proposals">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="p-proposals">
              Proposed updates
            </h3>
            <p className="ccrm-panel-description">
              Concludo proposes; a person disposes. Nothing here has been applied.
            </p>
          </div>
          <span className="ccrm-answer-count">{record.proposals.length}</span>
        </div>
        {record.proposals.length === 0 ? (
          <p className="ccrm-panel-empty">Nothing is proposed for this person.</p>
        ) : (
          <ul className="ccrm-item-list">
            {record.proposals.map((proposal) => (
              <li key={proposal.id}>
                <Link className="ccrm-item" to={linkTo('/crm/proposals')}>
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{proposal.headline}</span>
                    <span className="ccrm-item-context">{proposal.rationale}</span>
                    <span className="ccrm-reason">
                      <span className="ccrm-standing">Awaiting confirmation</span>
                      <span className="ccrm-reason-text">
                        {proposal.changes.length}{' '}
                        {proposal.changes.length === 1 ? 'field would change' : 'fields would change'}.
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ccrm-panel" aria-labelledby="p-timeline">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="p-timeline">
              Recent meetings and approved communications
            </h3>
            <p className="ccrm-panel-description">
              Everything recorded with this person present, most recent first.
            </p>
          </div>
        </div>
        <TimelineList
          entries={record.timeline}
          linkTo={linkTo}
          emptyMessage="Nothing is recorded with this person present."
          limit={12}
        />
      </section>

      <NotYetBuilt
        what="Editing a person is not built in this release."
        why="This stage reads the model and shows what is recorded. Writing, merging and sending are the write path, and a button that looked like it saved and did not would be worse than no button."
        when="The write path is Stage 5."
      />
    </Stage4Scaffold>
  );
};
