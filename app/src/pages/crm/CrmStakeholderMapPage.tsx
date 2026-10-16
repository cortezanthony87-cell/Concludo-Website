/**
 * The stakeholder map.
 *
 * WHAT THE PAGE REFUSES TO DO.
 *
 * It does not sort people by importance, colour them by engagement, show a
 * strength bar, or put anything next to a name that could be read as a mark out
 * of ten. The people are in alphabetical order, deliberately, because any other
 * order is an argument about who matters and the page has no business making
 * one.
 *
 * Grouping is by ROLE, which is a position in a process, and every role that a
 * decision usually needs is shown even when nobody holds it, because an empty
 * slot with a label is a question and a missing slot is a blind spot.
 *
 * `Blocker` is rendered differently from the other roles: it always shows who
 * recorded it and what they said, because a person described as an obstacle in
 * a database is entitled to have that claim attached to somebody's name. The
 * write path refuses the row without both.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice } from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import { buildStakeholderMap } from '../../lib/crm/stage6/stakeholderMap';
import { planningEnabled } from '../../lib/crm/stage6/visibility';
import { CRM_SESSION_NOW } from '../../lib/crm/stage5/session';

export const CrmStakeholderMapPage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const { organisationId } = useParams<{ organisationId: string }>();

  const map = React.useMemo(
    () =>
      organisationId && planningEnabled(data)
        ? buildStakeholderMap(data, organisationId, CRM_SESSION_NOW)
        : null,
    [data, organisationId]
  );

  if (!map) {
    return (
      <Stage4Scaffold
        title="No stakeholder map here"
        description="Either account planning is off in this workspace, or this account is not in it."
        loadingLabel="the stakeholder map"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
      >
        <p className="ccrm-panel-empty">
          <Link className="ccrm-text-link" to={linkTo('/crm/organisations')}>
            Back to organisations
          </Link>
        </p>
      </Stage4Scaffold>
    );
  }

  return (
    <Stage4Scaffold
      title={`Stakeholder map: ${map.organisation.name}`}
      description="Who is in the buying centre, what part each plays, and what nobody has recorded."
      loadingLabel="the stakeholder map"
      emptyTitle=""
      emptyBody=""
      resultCount={map.stakeholders.length}
      totalCount={map.stakeholders.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy ccrm-not-ranked" role="note">
        Nobody on this page is scored, rated or ranked, and the list is in alphabetical order
        because every other order is an argument about who matters. What is shown about each person
        is what somebody here wrote down, with their name against it.
      </p>

      <Link className="ccrm-back-link" to={linkTo(`/crm/account-plans/${map.organisation.id}`)}>
        Back to the account plan
      </Link>

      {/* ---- the process risks, which are about the process ---- */}
      <section className="ccrm-panel" aria-labelledby="sm-risks">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="sm-risks">
              What the shape of this says
            </h3>
            <p className="ccrm-panel-description">
              Each one is about what is recorded, not about anybody here or anybody there. Quiet
              means no conversation in {map.quietAfterDays} days, which this workspace sets.
            </p>
          </div>
        </div>

        {map.risks.length === 0 ? (
          <p className="ccrm-panel-empty">Nothing about the shape of this relationship is flagged.</p>
        ) : (
          <ul className="ccrm-plain-list">
            {map.risks.map((risk) => (
              <li key={risk.kind} className={`ccrm-risk ccrm-risk-${risk.kind}`}>
                <strong>{risk.what}</strong>
                <span className="ccrm-risk-help"> {risk.whatWouldHelp}</span>
                {risk.people.length > 0 ? (
                  <span className="ccrm-risk-people">
                    {' '}
                    Concerns: {risk.people.map((p) => p.fullName).join(', ')}.
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {map.rolesNobodyHolds.length > 0 ? (
          <p className="ccrm-before-contact">
            No one is recorded as: {map.rolesNobodyHolds.join(', ').replace(/_/g, ' ')}.
          </p>
        ) : null}
      </section>

      {/* ---- the map itself, by role ---- */}
      {map.byRole.map((group) => (
        <section className="ccrm-panel" key={group.role} aria-labelledby={`sm-${group.role}`}>
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id={`sm-${group.role}`}>
                {group.word}
                <span className="ccrm-stage-count">{group.people.length}</span>
              </h3>
              <p className="ccrm-panel-description">{group.meaning}</p>
            </div>
          </div>

          {group.people.length === 0 ? (
            <p className="ccrm-plan-empty">
              Nobody here is recorded in this part. That is a question, not an answer.
            </p>
          ) : (
            <div className="ccrm-panel-grid">
              {group.people.map((s) => (
                <article className="ccrm-stakeholder" key={s.person.id}>
                  <h4 className="ccrm-stakeholder-name">
                    <Link className="ccrm-text-link" to={linkTo(`/crm/people/${s.person.id}`)}>
                      {s.person.fullName}
                    </Link>
                  </h4>
                  <p className="ccrm-stakeholder-role">
                    <Value value={s.person.roleLabel} absent="Job title not recorded" />
                  </p>

                  {s.stakeholderRole === 'blocker' ? (
                    <p className="ccrm-blocker-note">
                      Recorded as standing in the way by a person, not by the software.{' '}
                      {s.roleEvidence}
                    </p>
                  ) : s.roleEvidence ? (
                    <p className="ccrm-stakeholder-evidence">{s.roleEvidence}</p>
                  ) : null}

                  <dl className="ccrm-facts">
                    <div>
                      <dt>Last conversation</dt>
                      <dd>
                        {s.lastContactAt ? (
                          `${s.lastContactAt.slice(0, 10)}, ${s.daysSinceContact} days ago`
                        ) : (
                          <span className="ccrm-absent">None recorded</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>How they stand</dt>
                      <dd>
                        {s.relationshipState === 'not_recorded' ? (
                          <span className="ccrm-absent">Nobody has described it</span>
                        ) : (
                          s.relationshipStateWord
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Prefers</dt>
                      <dd>
                        <Value value={s.preferredContactMethod} absent="Not recorded" />
                      </dd>
                    </div>
                    <div>
                      <dt>They are trying to</dt>
                      <dd>
                        <Value value={s.currentObjective} absent="Not recorded" />
                      </dd>
                    </div>
                  </dl>

                  {s.openCommitments.length > 0 ? (
                    <p className="ccrm-field-hint">
                      Open commitment: {s.openCommitments.map((c) => c.description).join('; ')}.
                    </p>
                  ) : null}

                  {s.informationGaps.length > 0 ? (
                    <div className="ccrm-missing-block">
                      <p className="ccrm-field-label">Nobody has recorded</p>
                      <ul className="ccrm-plain-list">
                        {s.informationGaps.map((gap) => (
                          <li key={gap}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </Stage4Scaffold>
  );
};
