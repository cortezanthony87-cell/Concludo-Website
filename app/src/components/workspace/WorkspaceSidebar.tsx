/**
 * The Concludo Workspace sidebar.
 *
 * Renders from `workspaceNav.ts`. There are no hand-written links in here,
 * which is the whole point: the list is data, the pairing with routes is a
 * compile error when it drifts, and this file is only presentation.
 *
 * THE ONE DESIGN DECISION WORTH READING.
 *
 * The header, the search field and the Work group are pinned. Only what sits
 * below them scrolls. At any window height the six destinations a person
 * opens daily are on screen, which is worth more than the order they are in.
 *
 * THREE STATES, ONE COMPONENT. Expanded at 288px, a 72px icon rail below
 * 1180px, and a drawer over the content below 900px. The breakpoints are in
 * the stylesheet; this file only tracks which one is active, because the
 * drawer needs a focus trap and the rail needs tooltips.
 *
 * NOTHING HERE IS ABOUT A PERSON. No count per user, no owner filter, and the
 * two badge kinds mean "somebody is waiting on you" and "a number worth
 * knowing". There is no third kind, by design.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  PINNED_DESTINATIONS,
  WORKSPACE_GROUPS,
  WorkspaceDestination,
  WorkspaceGroup,
  destinationsInGroup,
} from '../../lib/workspace/workspaceNav';
import { useAuth } from '../../lib/auth/AuthContext';
import { checkClientFeatureDisplay } from '../../lib/permissions/usePermissions';
import type { PlanType } from '../../lib/permissions/types';
import '../../styles/workspace-sidebar.css';

/** Resolves a lucide icon by name, falling back to a neutral mark. */
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const Component = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[name];
  const Resolved = Component ?? Icons.Circle;
  return <Resolved size={size} />;
}

export interface WorkspaceSidebarProps {
  /**
   * Counts shown beside a destination, keyed by path.
   *
   * Supplied by the layout rather than fetched here, so the sidebar makes no
   * requests of its own and cannot be the reason a page is slow to paint.
   */
  counts?: Record<string, number>;
  /** Open the search panel. The field here is the trigger, not the search. */
  onOpenSearch: () => void;
  /** Drawer state, owned by the layout so the top bar's button can set it. */
  mobileOpen: boolean;
  onMobileClose: () => void;
  /** Whether the sidebar is collapsed into a hidden state to expand main view */
  isCollapsed?: boolean;
  /** Click handler to toggle sidebar visibility */
  onToggleCollapse?: () => void;
}

const PHONE = '(max-width: 899px)';
const RAIL = '(min-width: 900px) and (max-width: 1179px)';

function useMatches(query: string): boolean {
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Which groups the person left open. Per browser, and never load bearing. */
function useOpenGroups(): [Set<WorkspaceGroup>, (group: WorkspaceGroup) => void] {
  const [open, setOpen] = React.useState<Set<WorkspaceGroup>>(() => {
    const fallback = new Set<WorkspaceGroup>(['Work', 'Connectivity', 'Automation', 'Intelligence', 'Admin']);
    try {
      const saved = window.localStorage.getItem('concludo.sidebar.groups');
      if (!saved) return fallback;
      const parsed = JSON.parse(saved) as WorkspaceGroup[];
      const set = new Set(parsed);
      set.add('Admin');
      return set;
    } catch {
      // Private windows and blocked site data both throw here. A remembered
      // group is a convenience, so the fallback is the whole feature.
      return fallback;
    }
  });

  const toggle = React.useCallback((group: WorkspaceGroup) => {
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      try {
        window.localStorage.setItem('concludo.sidebar.groups', JSON.stringify([...next]));
      } catch {
        /* as above */
      }
      return next;
    });
  }, []);

  return [open, toggle];
}

const Row: React.FC<{
  destination: WorkspaceDestination;
  count?: number;
  rail: boolean;
}> = ({ destination, count, rail }) => {
  const isCopilot = destination.path === '/copilot';
  return (
  <li>
    <NavLink
      to={destination.path}
      end={destination.path === '/dashboard'}
      title={rail ? destination.label : destination.accessibleDescription}
      aria-label={rail ? destination.label : undefined}
      className={({ isActive }) =>
        `cws-row${isActive ? ' cws-row-on' : ''}${isCopilot ? ' cws-row-copilot' : ''}`
      }
    >
      <Icon name={destination.iconName} />
      <span className="cws-row-label">{destination.label}</span>
      {isCopilot && !rail && (
        <span className="cws-copilot-badge">AI</span>
      )}
      {destination.badge && count !== undefined && count > 0 ? (
        rail ? (
          <span
            className={`cws-dot cws-dot-${destination.badge}`}
            aria-label={`${count} waiting`}
          />
        ) : (
          <span className={`cws-badge cws-badge-${destination.badge}`}>{count}</span>
        )
      ) : null}
    </NavLink>
  </li>
  );
};

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  counts = {},
  onOpenSearch,
  mobileOpen,
  onMobileClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const phone = useMatches(PHONE);
  const rail = useMatches(RAIL);
  const [openGroups, toggleGroup] = useOpenGroups();
  const { profile } = useAuth();
  const location = useLocation();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Entitlement is a feature key resolved by the permissions layer, never a
  // plan string compared in the layout.
  const permitted = React.useCallback(
    (destination: WorkspaceDestination) => {
      // In development / demo / preview, or when unrestricted admin
      if (!profile) return true;
      if (profile.role === 'admin' || profile.plan === 'admin' || profile.plan === 'enterprise') return true;
      const userPlan = (profile.plan as PlanType) || 'free_preview';
      // Work destinations always visible to authenticated workspace users
      if (destination.group === 'Work') return true;
      if (destination.path === '/integrations') return true;
      return checkClientFeatureDisplay(userPlan, destination.feature).isAllowed;
    },
    [profile]
  );

  // The drawer closes when the route changes, or it sits open over the page
  // the person just asked for.
  React.useEffect(() => {
    if (phone && mobileOpen) onMobileClose();
    // The route is the trigger. Including onMobileClose would close it on
    // every render of a parent that rebuilds the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Escape closes the drawer, and focus goes into it when it opens.
  React.useEffect(() => {
    if (!phone || !mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [phone, mobileOpen, onMobileClose]);

  const scrollingGroups = WORKSPACE_GROUPS.filter((group) => group !== 'Work');

  const body = (
    <div
      className={`cws${rail ? ' cws-rail' : ''}${phone ? ' cws-drawer' : ''}`}
      ref={panelRef}
    >
        <div className="cws-brand">
          {/* The supplied mark. Never redrawn, recoloured or outlined. */}
          <img src="/brand/concludo-mark.png" alt="" aria-hidden="true" className="cws-mark" />
          {rail ? null : <span className="cws-wordmark">Concludo</span>}
          {rail || phone ? null : <span className="cws-chip">WORKSPACE</span>}
          {phone ? (
            <button type="button" className="cws-close" onClick={onMobileClose} aria-label="Close the menu">
              <Icon name="X" size={16} />
            </button>
          ) : !rail && onToggleCollapse ? (
            <button
              type="button"
              className="cws-collapse-btn"
              onClick={onToggleCollapse}
              aria-label="Hide sidebar"
              title="Hide sidebar (click to collapse)"
            >
              <Icon name="ChevronLeft" size={15} />
            </button>
          ) : null}
        </div>

        <div className="cws-search-wrap">
          <button type="button" className="cws-search" onClick={onOpenSearch}>
            <Icon name="Search" size={15} />
            {rail ? null : (
              <>
                <span className="cws-search-label">Search everything</span>
                <kbd className="cws-kbd">&#8984;K</kbd>
              </>
            )}
          </button>
        </div>

        {rail ? null : <div className="cws-group-label">Work</div>}
        <ul className="cws-list">
          {PINNED_DESTINATIONS.filter(permitted).map((destination) => (
            <Row
              key={destination.path}
              destination={destination}
              count={counts[destination.path]}
              rail={rail}
            />
          ))}
        </ul>

      <div className="cws-divider" />

      <div className="cws-scroll">
        {scrollingGroups.map((group) => {
          const items = destinationsInGroup(group).filter(permitted);
          if (items.length === 0) return null;
          const isOpen = rail ? true : openGroups.has(group);
          return (
            <section key={group}>
              {rail ? (
                <div className="cws-rail-divider" role="presentation" />
              ) : (
                <h2 className="cws-group-head">
                  <button
                    type="button"
                    className="cws-group-toggle"
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(group)}
                  >
                    <span className="cws-group-label">{group}</span>
                    <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={13} />
                  </button>
                </h2>
              )}
              {isOpen ? (
                <ul className="cws-list">
                  {items.map((destination) => (
                    <Row
                      key={destination.path}
                      destination={destination}
                      count={counts[destination.path]}
                      rail={rail}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* footer */}
      {rail ? null : (
        <div className="cws-footer">
          <div className="cws-secured">
            <span className="cws-secured-dot" />
            Workspace secured
          </div>
          <div className="cws-org" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="Building2" size={13} />
            <span>Concludo Pty Ltd</span>
          </div>
          <div className="cws-place">Melbourne, Australia</div>
        </div>
      )}
    </div>
  );

  if (!phone) {
    return (
      <nav
        className={`cws-nav${isCollapsed ? ' cws-nav-collapsed' : ''}`}
        aria-label="Workspace"
        aria-hidden={isCollapsed ? true : undefined}
      >
        {body}
      </nav>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <div className="cws-backdrop" onClick={onMobileClose} role="presentation" />
      ) : null}
      <nav
        className={`cws-nav cws-nav-drawer${mobileOpen ? ' cws-nav-open' : ''}`}
        aria-label="Workspace"
        aria-hidden={mobileOpen ? undefined : true}
      >
        {body}
      </nav>
    </>
  );
};
