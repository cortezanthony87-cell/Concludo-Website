import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutDashboard,
  Calendar as CalendarIcon,
  FolderKanban,
  Search,
  FileText,
  Mail,
  BrainCircuit,
  CheckSquare,
  Settings,
  ChevronDown,
  User,
  LogOut,
  Building2,
  Zap,
  Database,
  Shield,
  Trash2,
  Loader2,
  Lightbulb,
  BarChart3,
  FileBarChart,
  Users,
  Contact,
  FileSpreadsheet,
  Scale,
  KeyRound,
  Share2,
  Webhook as WebhookIcon,
  Code2,
  Layers,
  Bot,
  Workflow,
  CheckCircle,
  Gauge,
  TrendingUp,
  Clock,
  Compass,
  Sparkles,
  Cpu,
  Sliders,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS } from '../lib/profiles/types';
import { resetAllScrollPositions } from './ScrollToTop';
import { WorkspaceSidebar } from './workspace/WorkspaceSidebar';

export const WorkspaceLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, authStatus } = useAuth();
  const location = useLocation();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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
          {/* Plan badge reading dynamically from user profile */}
          <div className="plan-badge-placeholder" title={`Current Subscription: ${planBadgeText}`}>
            <span className="plan-badge-dot" />
            <Zap size={12} />
            <span>{planBadgeText}</span>
          </div>

          {/* Account menu */}
          <div className="account-menu-container" ref={accountMenuRef}>
            <button
              type="button"
              className="account-menu-button"
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              aria-expanded={accountMenuOpen}
              aria-label="Account menu"
            >
              <div className="account-avatar">{userInitial}</div>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#f8fafc',
                  maxWidth: '180px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={userEmail}
              >
                {displayName}
              </span>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {accountMenuOpen && (
              <div className="account-dropdown">
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
          onOpenSearch={() => navigate("/search")}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
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
          to="/calendar"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <CalendarIcon size={19} />
          <span>Calendar</span>
        </NavLink>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <LayoutDashboard size={19} />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <FolderKanban size={19} />
          <span>Projects</span>
        </NavLink>
        <NavLink
          to="/copilot"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <Sparkles size={19} />
          <span>Copilot</span>
        </NavLink>
        <NavLink
          to="/actions"
          className={({ isActive }) =>
            isActive ? 'mobile-nav-item active' : 'mobile-nav-item'
          }
        >
          <CheckSquare size={19} />
          <span>Actions</span>
        </NavLink>
        <button
          type="button"
          className={`mobile-nav-item ${mobileSidebarOpen ? 'active' : ''}`}
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          aria-label="More sections"
        >
          <Menu size={19} />
          <span>Menu</span>
        </button>
      </nav>
      )}
    </div>
  );
};
