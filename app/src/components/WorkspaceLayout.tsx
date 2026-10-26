import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation, NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  User,
  LogOut,
  CreditCard,
  Settings,
  Shield,
  Loader2,
  Trash2,
  Database,
  Users,
  Bell,
  Sparkles,
  LayoutDashboard,
  Calendar as CalendarIcon,
  Mail,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS } from '../lib/profiles/types';
import { resetAllScrollPositions } from './ScrollToTop';
import { WorkspaceSidebar } from './workspace/WorkspaceSidebar';
import { useBadgeCounts, useCollaboration } from '../lib/collaboration/collaborationStore';
import { useAccountNotifications } from '../lib/notifications/useAccountNotifications';
import { isDemoWorkspace } from '../lib/crm/hub/featureFlag';
import { NotificationCentreModal } from './collaboration/NotificationCentreModal';
import { MessagePopupNotifier } from './collaboration/MessagePopupNotifier';

export const WorkspaceLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, authStatus } = useAuth();
  const location = useLocation();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isNotificationCentreOpen, setIsNotificationCentreOpen] = useState(false);

  // Authenticated real notifications
  const accountNotifs = useAccountNotifications();

  // Demo fallback strictly when in demo workspace
  const store = useCollaboration();
  const badgeCounts = useBadgeCounts();
  const isDemo = Boolean(user && isDemoWorkspace(user.id));

  // STRICT PRIVACY GUARANTEE:
  // On an authenticated account, unread count comes purely from public.user_notifications.
  // Synthetic demonstration data never appears in any notification on a real account.
  const effectiveUnreadNotifsCount = isDemo
    ? store.getNotifications().filter((n) => !n.isRead).length
    : accountNotifs.unreadCount;

  // Sidebar badge counts:
  // - "Communicate" under Work is removed from sidebar; its count is shown inside CRM tab only.
  // - Calendar and Email badge counts only show active items when in demo mode or when authenticated items exist.
  const sidebarCounts = isDemo
    ? {
        '/calendar': badgeCounts.calendar,
        '/email': badgeCounts.email,
      }
    : {
        '/calendar': 0,
        '/email': 0,
      };

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('concludo.sidebar.collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('concludo.sidebar.collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Reset scroll and close mobile sidebar whenever route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const mainArea = document.querySelector('.main-content-area');
    if (mainArea) {
      mainArea.scrollTop = 0;
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    setAccountMenuOpen(false);
    await signOut();
    setLoggingOut(false);
    navigate('/login', { replace: true });
  };

  const userEmail = user?.email || 'User';
  const fullName = profile?.full_name?.trim();
  const displayName = fullName || userEmail;
  const userInitial = (fullName ? fullName[0] : userEmail[0]).toUpperCase();

  const currentPlan = profile?.plan || 'free_preview';
  const planBadgeText = PLAN_LABELS[currentPlan] || 'Free Preview';

  return (
    <div className="app-container">
      {/* Top navigation */}
      <header className="top-navbar">
        <div className="nav-brand-group">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            aria-label={mobileSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileSidebarOpen}
          >
            {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/dashboard" className="brand-logo-link" aria-label="Concludo Workspace Dashboard">
            <img
              src="/brand/Concludo_logo_horizontal_reversed_for_dark.png"
              alt="Concludo"
              className="brand-logo-img"
            />
            <span className="brand-title-badge">WORKSPACE</span>
          </Link>
        </div>

        <div className="nav-right-group">
          {/* Real-time Notifications Bell */}
          <button
            type="button"
            className="top-navbar-bell-btn"
            onClick={() => setIsNotificationCentreOpen(true)}
            aria-label="Open notifications centre"
            title="Notifications Centre"
            style={{
              position: 'relative',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F8FAFC',
              cursor: 'pointer',
              marginRight: '8px',
            }}
          >
            <Bell size={18} />
            {effectiveUnreadNotifsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--cws-gold, #E2B53C)',
                  color: '#0D1626',
                  fontSize: '10px',
                  fontWeight: 700,
                  height: '18px',
                  minWidth: '18px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                }}
              >
                {effectiveUnreadNotifsCount}
              </span>
            )}
          </button>

          {/* Plan badge reading dynamically from user profile */}
          <div className="plan-badge-placeholder" title={`Current Subscription: ${planBadgeText}`}>
            <span className="plan-badge-dot" />
            <Zap size={12} />
            <span>{planBadgeText}</span>
          </div>

          {/* User Account Menu */}
          <div className="account-menu-container" ref={accountMenuRef}>
            <button
              type="button"
              className="account-menu-button"
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              aria-label="User account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="true"
            >
              <span className="user-avatar-initial" aria-hidden="true">
                {userInitial}
              </span>
              <span className="user-display-name">{displayName}</span>
            </button>

            {accountMenuOpen && (
              <div
                className="account-dropdown-menu"
                role="menu"
                aria-label="User options"
              >
                <div className="dropdown-user-header">
                  {fullName && (
                    <div
                      style={{
                        fontWeight: 700,
                        color: '#f8fafc',
                        fontSize: '0.92rem',
                        marginBottom: '2px',
                      }}
                    >
                      {fullName}
                    </div>
                  )}
                  <div
                    className="dropdown-user-email"
                    style={{
                      wordBreak: 'break-all',
                      fontWeight: 500,
                      color: fullName ? '#94a3b8' : '#f8fafc',
                      fontSize: '0.84rem',
                    }}
                  >
                    {userEmail}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.75rem',
                      color: '#e2b53c',
                      marginTop: '6px',
                    }}
                  >
                    <Shield size={12} />
                    <span>{planBadgeText} • {profile?.role === 'admin' ? 'Admin' : 'Member'}</span>
                  </div>
                </div>
                <Link
                  to="/account"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <User size={16} />
                  <span>Account</span>
                </Link>
                <Link
                  to="/checkout"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <CreditCard size={16} />
                  <span>Packages & Billing</span>
                </Link>
                {(profile?.plan === 'team' || profile?.plan === 'admin' || profile?.role === 'admin') && (
                  <Link
                    to="/team/settings"
                    className="dropdown-link"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Users size={16} />
                    <span>Team Settings</span>
                  </Link>
                )}
                {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.role === 'admin') && (
                  <Link
                    to="/admin"
                    className="dropdown-link"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <Shield size={16} />
                    <span>Enterprise Admin</span>
                  </Link>
                )}
                <Link
                  to="/settings"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </Link>
                <Link
                  to="/settings/deleted"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Trash2 size={16} />
                  <span>Recently Deleted</span>
                </Link>
                <Link
                  to="/test-connection"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Database size={16} />
                  <span>Supabase Diagnostics</span>
                </Link>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-link"
                  onClick={handleLogout}
                  disabled={loggingOut || authStatus === 'signing_out'}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {loggingOut ? (
                    <>
                      <Loader2 size={16} className="spin-animation" color="#f87171" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut size={16} color="#f87171" />
                      <span>Log out</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* App body: Left sidebar + Main content area */}
      <div className="app-shell-body">
        {/* Left sidebar */}
        <WorkspaceSidebar
          counts={sidebarCounts}
          onOpenSearch={() => navigate("/search")}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* Main content area */}
        <main className="main-content-area">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation Bar (hidden on full-screen workflow builder) */}
      {!location.pathname.startsWith('/workflows/builder') && (
        <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        <NavLink
          to="/copilot"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active mobile-nav-copilot' : 'mobile-nav-item mobile-nav-copilot'
          }
        >
          <Sparkles size={19} color="#e2b53c" style={{ filter: 'drop-shadow(0 0 6px rgba(226, 181, 60, 0.75))' }} />
          <span>Copilot</span>
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <CalendarIcon size={19} />
          <span>Calendar</span>
        </NavLink>
        <NavLink
          to="/email"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <Mail size={19} />
          <span>Email</span>
        </NavLink>
        <NavLink
          to="/crm"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <User size={19} />
          <span>CRM</span>
        </NavLink>
        <button
          type="button"
          className="mobile-nav-item mobile-nav-menu-btn"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open full navigation menu"
        >
          <Menu size={19} />
          <span>Menu</span>
        </button>
      </nav>
      )}

      {/* Real-time Notifications Modal */}
      <NotificationCentreModal
        isOpen={isNotificationCentreOpen}
        onClose={() => setIsNotificationCentreOpen(false)}
      />

      {/* Bottom-right 10-second popup alerts */}
      <MessagePopupNotifier />
    </div>
  );
};
