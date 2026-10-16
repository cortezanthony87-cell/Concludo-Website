/**
 * Today: the CRM's landing page.
 *
 * Its job is one question: what do I need to know or do next. Everything on it
 * earns its place by answering that, and nothing on it is a number with no
 * destination.
 *
 * READING ORDER, TOP TO BOTTOM
 *
 * 1. **Twelve cards**, as one quiet rail. Each is a count, the reason the count
 *    matters and a way into the view that holds it. They are deliberately
 *    understated: they are an index, not the content.
 * 2. **Handle first**, alone and weighted. One item from each of the places
 *    that most often needs a person, rather than the top four of one list,
 *    because the first four things in a morning are rarely four of a kind.
 * 3. **Nine more panels**, each capped at four rows, each saying its true total
 *    so nothing is hidden by the cap.
 *
 * Every row carries its reason, which is the brief's rule and the thing that
 * separates a working list from a list of demands.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { composeToday } from '../../lib/crm/today';
import { ViewScaffold, useCrmView } from '../../components/crm/ViewScaffold';
import { ReasonLine, StatusMark } from '../../components/crm/viewPrimitives';

export const CrmTodayPage: React.FC = () => {
  const { dataset, viewState, linkTo } = useCrmView();
  const composition = React.useMemo(
    () => composeToday(dataset, viewState),
    [dataset, viewState]
  );

  const [lead, ...rest] = composition.panels;

  return (
    <ViewScaffold
      title="Today"
      description="What is recommended today, and why each item is here."
      loadingLabel="today"
      emptyTitle="Nothing is waiting on you"
      emptyBody="No commitment is due, no work is sitting still, and nothing is awaiting confirmation."
      resultCount={composition.allClear ? 0 : 1}
      totalCount={1}
    >
      <ul className="ccrm-card-rail">
        {composition.cards.map((card) => (
          <li key={card.key}>
            <Link
              className={`ccrm-card ccrm-card-${card.tone}`}
              to={linkTo(card.destination)}
              aria-label={`${card.label}: ${card.count}. ${card.note}`}
            >
              <span className="ccrm-card-count">{card.count}</span>
              <span className="ccrm-card-label">{card.label}</span>
              <span className="ccrm-card-note">{card.note}</span>
            </Link>
          </li>
        ))}
      </ul>

      {lead ? <Panel panel={lead} linkTo={linkTo} lead /> : null}

      <div className="ccrm-panel-grid">
        {rest.map((panel) => (
          <Panel key={panel.key} panel={panel} linkTo={linkTo} />
        ))}
      </div>
    </ViewScaffold>
  );
};

const Panel: React.FC<{
  panel: ReturnType<typeof composeToday>['panels'][number];
  linkTo: (path: string) => string;
  lead?: boolean;
}> = ({ panel, linkTo, lead }) => {
  const notShown = panel.total - panel.items.length - panel.alreadyShown;

  return (
    <section className={lead ? 'ccrm-panel ccrm-panel-lead' : 'ccrm-panel'}>
      <div className="ccrm-panel-head">
        <div>
          <h3 className="ccrm-panel-title">{panel.title}</h3>
          <p className="ccrm-panel-description">{panel.description}</p>
        </div>
        <Link className="ccrm-text-link" to={linkTo(panel.destination)}>
          Open
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      {panel.items.length === 0 ? (
        <p className="ccrm-panel-empty">{panel.emptyMessage}</p>
      ) : (
        <ul className="ccrm-item-list">
          {panel.items.map((item) => (
            <li key={item.id}>
              <Link className="ccrm-item" to={linkTo(item.destination)}>
                <span className="ccrm-item-main">
                  <span className="ccrm-item-title">{item.title}</span>
                  <span className="ccrm-item-context">{item.context}</span>
                  <ReasonLine standing={item.standing} reason={item.reason} />
                </span>
                <StatusMark shape={item.statusShape} label={item.statusLabel} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {notShown > 0 || panel.alreadyShown > 0 ? (
        <p className="ccrm-panel-more">
          {panel.alreadyShown > 0
            ? `${panel.alreadyShown} shown in Handle first above. `
            : ''}
          {notShown > 0 ? `${notShown} more not shown here. ` : ''}
          <Link className="ccrm-text-link" to={linkTo(panel.destination)}>
            See all {panel.total}
          </Link>
        </p>
      ) : null}
    </section>
  );
};
