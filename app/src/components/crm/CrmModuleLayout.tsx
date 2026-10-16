/**
 * The CRM module shell.
 *
 * One sidebar entry leads here. The fourteen destinations are tabs, grouped
 * into four clusters so the row reads as four things rather than fourteen.
 *
 * WHY THE TAB ROW IS A `nav` AND NOT AN ARIA TABLIST.
 *
 * Each tab changes the URL and loads a different view. A tablist promises a
 * screen reader that arrow keys move between panels that are already present,
 * and that pressing one reveals a panel rather than navigating. Neither is true
 * here. So this is a `nav` of links with `aria-current="page"` on the active
 * one, which is what it actually is. Panes inside a single view that do not
 * change the URL are a different matter and would be a real tablist.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  CRM_MODULE_DESTINATIONS,
  CRM_TAB_GROUPS,
  crmDestinationsInGroup,
} from '../../lib/crm/moduleNav';
import { useLocation } from 'react-router-dom';
import { useCrmScrollMemory, useCrmViewState } from '../../lib/crm/useCrmViewState';
import { crmDestinationForPath } from '../../lib/crm/moduleNav';
import { CRM_DATASET } from '../../lib/crm/data/workspace';
import { sessionWorkspace } from '../../lib/crm/stage5/session';
import { planningEnabled } from '../../lib/crm/stage6/visibility';
import { composeToday } from '../../lib/crm/today';
import { CrmHeader } from './CrmHeader';
import '../../styles/concludo-crm.css';

/** Resolves a lucide icon by name, falling back to a neutral mark. */
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Resolved = Component ?? Icons.Circle;
  return <Resolved size={size} />;
}

export interface CrmModuleContext {
  linkTo: (path: string) => string;
  refreshToken: number;
}

/**
 * The destinations that exist only where account planning is on.
 *
 * One entry, deliberately. The stakeholder map, the whitespace grid, the joint
 * plan and the review are all reached from the plan rather than from the tab
 * row, because a feature that adds five tabs to everybody's navigation has not
 * been kept out of the way of the people who do not need it.
 */
const PLANNING_DESTINATIONS = ['/crm/account-plans'];

/** The one breakpoint the module treats as a phone. */
const PHONE_WIDTH = '(max-width: 900px)';

function isPhoneWidth(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PHONE_WIDTH).matches;
}

export const CrmModuleLayout: React.FC = () => {
  const { viewState, setViewState, linkTo } = useCrmViewState();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  useCrmScrollMemory(scrollRef as React.RefObject<HTMLElement>);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  /**
   * HIDDEN BY DEFAULT, in the one place that decides what is on screen.
   *
   * Account planning is off for a workspace until somebody turns it on, and
   * "off" means the destination is not in the row at all: not greyed, not
   * locked, not an empty page with an upgrade prompt. A sole trader with
   * eleven customers should never learn that a SWOT exists.
   *
   * Filtering here rather than in each page is deliberate. A page that hides
   * its own contents still leaves a tab somebody can press, and the tab is the
   * part they have to read every time.
   */
  const planningIsOn = planningEnabled(sessionWorkspace(viewState.workspaceId));
  const visibleHere = useCallback(
    (destination: { path: string }) =>
      planningIsOn || !PLANNING_DESTINATIONS.includes(destination.path),
    [planningIsOn]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshToken((token) => token + 1);
      setRefreshing(false);
    }, 450);
  }, []);

  // The header's proposals indicator needs one number from the composition.
  // Computing the whole composition here and once more on Today is cheap on a
  // workspace this size and keeps the two from disagreeing.
  const awaitingConfirmation = useMemo(
    () => composeToday(CRM_DATASET, viewState).awaitingConfirmation,
    [viewState]
  );

  /**
   * The tab row collapses on a phone.
   *
   * Fourteen tabs in four labelled groups is right on a desktop and wrong on a
   * 390 pixel screen: measured, it pushed the first line of page content to
   * 814 pixels down an 844 pixel viewport, so a person opening the CRM on a
   * phone saw the navigation and none of the content.
   *
   * Below 900 pixels the same fourteen sit behind a disclosure that names the
   * view they are currently on, which is the collapsible submenu the brief
   * allows for exactly this. It is the same markup either way, so there is one
   * navigation rather than two.
   */
  const [sectionsOpen, setSectionsOpen] = useState(() => !isPhoneWidth());
  const onSectionsToggle = useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    setSectionsOpen(event.currentTarget.open);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_WIDTH);
    const onChange = (event: MediaQueryListEvent) => setSectionsOpen(!event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Choosing a destination on a phone closes the menu again, so the person
  // lands on the view rather than on the menu they just used.
  const currentDestination = crmDestinationForPath(location.pathname);
  React.useEffect(() => {
    if (isPhoneWidth()) setSectionsOpen(false);
  }, [location.pathname]);

  const context: CrmModuleContext = { linkTo, refreshToken };

  return (
    <div className="ccrm-module">
      <a href="#ccrm-main" className="ccrm-skip-link">
        Skip to the CRM
      </a>

      <CrmHeader
        dataset={CRM_DATASET}
        viewState={viewState}
        setViewState={setViewState}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        awaitingConfirmation={awaitingConfirmation}
        linkTo={linkTo}
      />

      <nav aria-label="CRM sections">
        <details className="ccrm-tabs-shell" open={sectionsOpen} onToggle={onSectionsToggle}>
          <summary className="ccrm-tabs-summary">
            <span className="ccrm-tabs-summary-label">Sections</span>
            <span className="ccrm-tabs-summary-state">{currentDestination.label}</span>
          </summary>
          <div className="ccrm-tabs">
        {CRM_TAB_GROUPS.map((group) => (
          <div className="ccrm-tab-group" key={group}>
            <p className="ccrm-tab-group-label" id={`ccrm-group-${group}`}>
              {group}
            </p>
            <ul className="ccrm-tab-list" aria-labelledby={`ccrm-group-${group}`}>
              {crmDestinationsInGroup(group)
                .filter(visibleHere)
                .map((destination) => (
                <li key={destination.path}>
                  <NavLink
                    to={linkTo(destination.path)}
                    end={destination.path === '/crm'}
                    className={({ isActive }) => (isActive ? 'ccrm-tab ccrm-tab-active' : 'ccrm-tab')}
                    title={destination.accessibleDescription}
                  >
                    <Icon name={destination.iconName} />
                    <span>{destination.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
          </div>
        </details>
      </nav>

      <div className="ccrm-main" id="ccrm-main" ref={scrollRef} tabIndex={-1}>
        <Outlet context={context} />
      </div>

      <p className="ccrm-foot-note">
        Concludo proposes; a person disposes. This module reads and recommends. It never sends a
        message, changes a customer record or merges anything without a person confirming it. What
        you change here is held in this browser tab against synthetic records and is put back when
        the tab closes; nothing is written to any customer system. Prices referenced anywhere in
        Concludo remain indicative until validated with real buyers.
      </p>
    </div>
  );
};

export { CRM_MODULE_DESTINATIONS };
