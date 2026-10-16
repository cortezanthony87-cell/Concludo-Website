/**
 * Reports, six of them, one per role.
 *
 * THE RULE THIS VIEW EXISTS TO HOLD.
 *
 * Concludo measures work, records and relationships, never employee
 * performance. A reports page is where that line gets crossed, because "count
 * by owner" is one small step from "who is winning", and a CRM that ships a
 * per-person chart has made a product decision whether or not anybody meant to.
 *
 * The rule is held structurally rather than editorially. The report builders in
 * `stage8/reports.ts` return work, not people: no function there takes a list
 * of users and returns a number per user, and the test asserts that no report
 * output contains a per-person aggregate. Ownership appears as a FILTER, which
 * is "show me mine", and never as a GROUPING, which is "show me everyone's,
 * ordered".
 *
 * WHY SIX AND NOT ONE WITH A FILTER. The six roles the brief names want
 * different things, not different slices of the same thing. An owner-operator
 * wants to know what to do today. An executive wants to know whether the
 * business is concentrated on one customer. A single page with a role dropdown
 * over one set of numbers would serve neither, and it is how reporting pages
 * end up as a wall of figures nobody reads.
 *
 * A LINE CAN BE BLANK. Where a figure is genuinely not available, the line
 * shows nothing and says why, because a zero reads as "nothing is wrong" and
 * the truth is sometimes "nobody has looked".
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, currentActingRole } from '../../components/crm/Stage5Pieces';
import {
  NOT_RANKED_NOTE,
  REPORT_ROLES,
  REPORT_TITLES,
  ReportRole,
  buildReport,
} from '../../lib/crm/stage8/reports';

export const CrmReportsPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const [role, setRole] = React.useState<ReportRole>('owner_operator');

  // The acting role matters here: the service lead's report withholds case
  // detail from somebody whose role would not let them open the case, so the
  // report is built for whoever is reading it.
  const actingRole = currentActingRole();
  const report = React.useMemo(
    () => buildReport(role, data, now, actingRole),
    [role, data, now, actingRole]
  );

  const lines = report.lines;

  return (
    <Stage4Scaffold
      title="Reports"
      description="Six views, one per role. Every figure counts work, records or relationships. None of them counts a person."
      loadingLabel="the reports"
      emptyTitle="Nothing is recorded in this workspace yet"
      emptyBody="Figures appear here as records are added."
      resultCount={lines.length}
      totalCount={lines.length}
      toolbar={
        <>
          <RolePicker />
          <div className="ccrm-role-picker">
          <label className="ccrm-workspace-label" htmlFor="ccrm-report-role">
            Report
          </label>
          <select
            id="ccrm-report-role"
            className="form-select ccrm-workspace-select"
            value={role}
            onChange={(event) => setRole(event.target.value as ReportRole)}
          >
            {REPORT_ROLES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {REPORT_TITLES[candidate]}
              </option>
            ))}
            </select>
          </div>
        </>
      }
    >
      <p className="ccrm-not-ranked ccrm-policy" role="note">
        {NOT_RANKED_NOTE}
      </p>

      <h3 className="ccrm-group-title">{report.title}</h3>
      <p className="ccrm-section-description">{report.description}</p>

      <div className="ccrm-panel-grid">
        {lines.map((line) => (
          <section className="ccrm-panel" key={line.label} aria-labelledby={`rep-${line.label}`}>
            <div className="ccrm-panel-head">
              <div>
                <h4 className="ccrm-panel-title" id={`rep-${line.label}`}>
                  {line.label}
                </h4>
                <p className="ccrm-panel-description">{line.meaning}</p>
              </div>
              <span className="ccrm-answer-count">
                {line.count === null ? 'Not available' : line.count}
              </span>
            </div>

            {line.items && line.items.length > 0 ? (
              <ul className="ccrm-item-list">
                {line.items.map((item) => (
                  <li key={item.id}>
                    <span className="ccrm-item">
                      <span className="ccrm-item-main">
                        <span className="ccrm-item-title">
                          {item.path ? (
                            <Link className="ccrm-text-link" to={linkTo(item.path)}>
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </span>
                        <span className="ccrm-item-context">{item.context}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {line.path ? (
              <p className="ccrm-panel-footer">
                <Link className="ccrm-text-link" to={linkTo(line.path)}>
                  Open the work behind this figure
                </Link>
              </p>
            ) : null}
          </section>
        ))}
      </div>

      <p className="ccrm-policy" role="note">
        Figures are drawn from this workspace&rsquo;s own records and nothing else. Concludo holds no
        benchmark, no industry average and no comparison against other businesses, so nothing here
        is presented as one.
      </p>
    </Stage4Scaffold>
  );
};
