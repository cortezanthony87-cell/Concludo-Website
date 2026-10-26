import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { EmailViewState } from '../../lib/email/types';
import { destinationForPath } from '../../lib/email/moduleNav';

export interface EmailModuleContext {
  accountId: string;
  refreshToken: number;
  linkTo: (path: string) => string;
  viewState?: EmailViewState;
  setViewState?: (patch: Partial<EmailViewState>) => void;
}

export const EmailModuleLayout: React.FC = () => {
  const location = useLocation();

  const viewTarget = useMemo(() => {
    const path = location.pathname;
    if (path === '/email/needs-attention') return 'subnav-needs-attention';
    if (path === '/email/reply-queue') return 'subnav-reply-queue';
    if (path === '/email/actions-deadlines') return 'subnav-actions';
    if (path === '/email/waiting') return 'subnav-waiting';
    if (path === '/email/quick-wins') return 'subnav-quick-wins';
    if (path === '/email/clear-backlog') return 'subnav-backlog';
    if (path === '/email/all' || path.startsWith('/email/thread')) return 'workspace-view';
    if (path === '/email/outputs') return 'subnav-outputs';
    if (path === '/email/security-review') return 'subnav-security';
    if (path === '/email/settings') return 'subnav-settings';
    if (path === '/email/overview') return 'subnav-overview';
    // Default to full 3-panel workspace thread view
    return 'workspace-view';
  }, [location.pathname]);

  const search = location.search ? `&${location.search.replace(/^\?/, '')}` : '';
  const iframeSrc = `/modules/ecc/ecc-thread-view.html?view=${viewTarget}${search}`;

  return (
    <div
      className="module-content-slot ecc-thread-view-container"
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
    >
      <iframe
        key={viewTarget}
        src={iframeSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          flex: 1,
        }}
        title="Email Command Centre"
      />
    </div>
  );
};

export { destinationForPath };
