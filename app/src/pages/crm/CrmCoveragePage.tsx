/**
 * Stakeholder coverage: which roles are recorded, and which are not.
 *
 * WHAT THIS VIEW IS NOT.
 *
 * It is not a coverage percentage, and the composition layer deliberately
 * returns no ratio for it to render. "Harbourline is at 60 per cent coverage"
 * is a number about an account that becomes, within one quarter, a number about
 * the person who owns the account. The honest version is a list: these roles
 * have somebody recorded, these do not, and here is what that means for the
 * next conversation.
 *
 * The absent roles are the point of the screen, so they are stated in words on
 * every card rather than implied by an empty slot.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Value } from '../../components/crm/viewPrimitives';
import { ROLE_WORDS, workspaceCoverage } from '../../lib/crm/stage4/hierarchy';
import { lastMeaningfulContactWith } from '../../lib/crm/stage4/relationships';

export const CrmCoveragePage: React.FC = () => {
  const { data, linkTo } = useStage4();

  const coverage = React.useMemo(
    () => workspaceCoverage(data, (personId) => lastMeaningfulContactWith(data, personId)),
    [data]
  );

  const withGaps = coverage.filter((c) => c.absent.length > 0 || c.singleContact);
  const complete = coverage.filter((c) => c.absent.length === 0 && !c.singleContact);

  return (
    <Stage4Scaffold
      title="Stakeholder coverage"
      description="Which roles are recorded at each organisation, which are not, and what that means for the next conversation."
      loadingLabel="stakeholder coverage"
      emptyTitle="No organisations are recorded in this workspace"
      emptyBody="Coverage appears here once organisations and the people at them are recorded."
      resultCount={coverage.length}
      totalCount={data.organisations.filter((o) => o.deletedAt === null).length}
    >
      <p className="ccrm-not-ranked ccrm-policy" role="note">
        There is no coverage score here, and there is deliberately nothing to sort by. A percentage
        of an account becomes a percentage of the person who owns it, so this view names what is
        recorded and what is missing instead.
      </p>

      <h3 className="ccrm-group-title">
        Where a role is not recorded
        <span className="ccrm-stage-count">{withGaps.length}</span>
      </h3>

      {withGaps.length === 0 ? (
        <p className="ccrm-panel-empty">
          Every organisation here has somebody recorded in each role that usually matters.
        </p>
      ) : (
        <div className="ccrm-panel-grid">
          {withGaps.map((entry) => (
            <section
              className="ccrm-panel"
              key={entry.organisation.id}
              aria-labelledby={`cov-${entry.organisation.id}`}
            >
              <div className="ccrm-panel-head">
                <div>
                  <h4 className="ccrm-panel-title" id={`cov-${entry.organisation.id}`}>
                    <Link
                      className="ccrm-text-link"
                      to={linkTo(`/crm/organisations/${entry.organisation.id}`)}
                    >
                      {entry.organisation.name}
                    </Link>
                  </h4>
                  <p className="ccrm-panel-description">{entry.summary}</p>
                </div>
                {entry.openWorkCount > 0 ? (
                  <span className="ccrm-answer-count">
                    {entry.openWorkCount}
                    <span className="ccrm-visually-hidden"> open items</span>
                  </span>
                ) : null}
              </div>

              <h5 className="ccrm-coverage-heading">Not recorded</h5>
              {entry.absent.length === 0 ? (
                <p className="ccrm-panel-empty">Every usual role has somebody in it.</p>
              ) : (
                <ul className="ccrm-role-list">
                  {entry.absent.map((role) => (
                    <li className="ccrm-role ccrm-role-absent" key={role}>
                      <span className="ccrm-role-name">{ROLE_WORDS[role]}</span>
                      <span className="ccrm-role-note">
                        Nobody is recorded in this role. The fix is a name, not a warning.
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h5 className="ccrm-coverage-heading">Recorded</h5>
              {entry.held.length === 0 ? (
                <p className="ccrm-panel-empty">Nobody has a role recorded here.</p>
              ) : (
                <ul className="ccrm-role-list">
                  {entry.held.map((holder) => (
                    <li className="ccrm-role" key={holder.person.id}>
                      <span className="ccrm-role-name">
                        {ROLE_WORDS[holder.stakeholderRole]}
                        {holder.isPrimary ? <span className="ccrm-role-primary">Primary</span> : null}
                      </span>
                      <span className="ccrm-role-note">
                        <Link
                          className="ccrm-text-link"
                          to={linkTo(`/crm/people/${holder.person.id}`)}
                        >
                          {holder.person.fullName}
                        </Link>
                        {holder.lastContactAt ? (
                          <span>. Last spoken to {holder.lastContactAt.slice(0, 10)}</span>
                        ) : (
                          <span>. No conversation recorded</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {entry.withoutRole.length > 0 ? (
                <p className="ccrm-panel-more">
                  {entry.withoutRole.length}{' '}
                  {entry.withoutRole.length === 1 ? 'person has' : 'people have'} no role recorded:{' '}
                  {entry.withoutRole.map((p) => p.fullName).join(', ')}.
                </p>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <h3 className="ccrm-group-title">
        Where every usual role has somebody
        <span className="ccrm-stage-count">{complete.length}</span>
      </h3>

      {complete.length === 0 ? (
        <p className="ccrm-panel-empty">
          No organisation here has every role that usually matters recorded.
        </p>
      ) : (
        <ul className="ccrm-item-list">
          {complete.map((entry) => (
            <li key={entry.organisation.id}>
              <Link
                className="ccrm-item"
                to={linkTo(`/crm/organisations/${entry.organisation.id}`)}
              >
                <span className="ccrm-item-main">
                  <span className="ccrm-item-title">{entry.organisation.name}</span>
                  <span className="ccrm-item-context">
                    <Value value={entry.organisation.industry} absent="Industry not recorded" />
                  </span>
                  <span className="ccrm-reason">
                    <span className="ccrm-reason-text">{entry.summary}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Stage4Scaffold>
  );
};
