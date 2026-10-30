import React from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Pillar, activeTab } from '../../lib/intel/pillarRoutes';
import '../../styles/intel-bright.css';

/** Pillar shell: a pillar label, a tab bar, and the tab's page (which owns the single h1) in the Outlet. */
export const PillarShell: React.FC<{ pillar: Pillar; canUse?: (feature: string) => boolean }> = ({ pillar, canUse }) => {
  const { pathname } = useLocation();
  if (pathname === pillar.path || pathname === pillar.path + '/') return <Navigate to={pillar.defaultTab} replace />;
  const visible = pillar.tabs.filter((t) => !canUse || canUse(t.feature));
  const current = activeTab(pillar, pathname);
  return (
    <div className="ib">
      <p className="ib-pillar" title={pillar.purpose}>{pillar.title}</p>
      <nav className="ib-tabs" aria-label={`${pillar.title} sections`}>
        {visible.map((t) => (
          <NavLink key={t.id} to={t.to} className={({ isActive }) => 'ib-tab' + (isActive ? ' ib-tab--on' : '')} aria-current={current?.id === t.id ? 'page' : undefined}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
};
