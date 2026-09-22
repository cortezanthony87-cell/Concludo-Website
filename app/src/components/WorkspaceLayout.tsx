import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Search,
  FileText,
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

export const WorkspaceLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, authStatus } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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
          <Link to="/dashboard" className="brand-logo-link">
            <div className="brand-emblem">
              <div className="brand-emblem-inner" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>CONCLUDO</span>
              <span className="brand-title-badge">WORKSPACE</span>
            </div>
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
                <Link
                  to="/team/settings"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Users size={16} />
                  <span>Team Settings</span>
                </Link>
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
        <aside className="left-sidebar">
          <div className="sidebar-content">
            <div className="sidebar-category-label">Navigation</div>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            {/* Concludo Copilot (Tasklet 22) */}
            <NavLink
              to="/copilot"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
              style={{
                background: 'linear-gradient(90deg, rgba(226, 181, 60, 0.12) 0%, transparent 100%)',
                borderLeft: '3px solid #e2b53c',
              }}
            >
              <Sparkles size={18} color="#e2b53c" />
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>Concludo Copilot</span>
              <span style={{ fontSize: '0.65rem', background: '#e2b53c', color: '#0f172a', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, marginLeft: 'auto' }}>AI</span>
            </NavLink>

            <NavLink
              to="/projects"
              end
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <FolderKanban size={18} />
              <span>Projects</span>
            </NavLink>

            <NavLink
              to="/search"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Search size={18} />
              <span>Search</span>
            </NavLink>

            <NavLink
              to="/projects/new"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <FileText size={18} />
              <span>New Transcript</span>
            </NavLink>

            <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
              Collaboration
            </div>
            <NavLink
              to="/team"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Users size={18} />
              <span>Team Workspace</span>
            </NavLink>

            <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
              Intelligence
            </div>
            <NavLink
              to="/decision-memory"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <BrainCircuit size={18} />
              <span>Decision Memory</span>
            </NavLink>

            <NavLink
              to="/actions"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <CheckSquare size={18} />
              <span>Actions</span>
            </NavLink>

            <NavLink
              to="/insight"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Lightbulb size={18} />
              <span>Insight</span>
            </NavLink>

            <NavLink
              to="/stats"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <BarChart3 size={18} />
              <span>Stats</span>
            </NavLink>

            <NavLink
              to="/endpoint-report"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <FileBarChart size={18} />
              <span>Endpoint Report</span>
            </NavLink>

            {/* Connectivity & Automation */}
            <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
              Connectivity
            </div>
            <NavLink
              to="/integrations"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Share2 size={18} />
              <span>Integrations</span>
            </NavLink>

            <NavLink
              to="/automation-export"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Layers size={18} />
              <span>Automation Export</span>
            </NavLink>

            <NavLink
              to="/webhooks"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <WebhookIcon size={18} />
              <span>Webhooks</span>
            </NavLink>

            <NavLink
              to="/api"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Code2 size={18} />
              <span>Public API</span>
            </NavLink>

            {/* Tasklet 19 AI Agents & Workflow Orchestration */}
            {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.plan === 'team') && (
              <>
                <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
                  Automation & Agents
                </div>
                <NavLink
                  to="/agents"
                  end
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Bot size={18} />
                  <span>AI Agents</span>
                </NavLink>

                <NavLink
                  to="/workflows"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Workflow size={18} />
                  <span>Workflows</span>
                </NavLink>

                <NavLink
                  to="/approvals"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <CheckCircle size={18} />
                  <span>Approvals</span>
                </NavLink>

                <NavLink
                  to="/agents/dashboard"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Gauge size={18} />
                  <span>Agent Dashboard</span>
                </NavLink>
              </>
            )}

            {/* Tasklet 20 Predictive Intelligence & Strategy */}
            {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.plan === 'team') && (
              <>
                <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
                  Strategic Intelligence
                </div>
                <NavLink
                  to="/predictive-intelligence"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <TrendingUp size={18} />
                  <span>Predictive Intelligence</span>
                </NavLink>

                <NavLink
                  to="/forecasts"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Clock size={18} />
                  <span>Forecasts</span>
                </NavLink>

                <NavLink
                  to="/executive-briefings"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <FileSpreadsheet size={18} />
                  <span>Executive Briefings</span>
                </NavLink>

                {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.role === 'admin') && (
                  <NavLink
                    to="/executive-intelligence"
                    className={({ isActive }) =>
                      isActive ? 'sidebar-link active' : 'sidebar-link'
                    }
                  >
                    <Compass size={18} />
                    <span>Executive Intelligence</span>
                  </NavLink>
                )}
              </>
            )}

            {/* Tasklet 21 Knowledge Network & Organizational Memory */}
            {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.plan === 'team') && (
              <>
                <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
                  Knowledge Network
                </div>
                <NavLink
                  to="/knowledge"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Database size={18} />
                  <span>Knowledge Explorer</span>
                </NavLink>

                <NavLink
                  to="/organizational-memory"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <BrainCircuit size={18} />
                  <span>Organizational Memory</span>
                </NavLink>

                <NavLink
                  to="/knowledge/timeline"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Clock size={18} />
                  <span>Knowledge Timeline</span>
                </NavLink>

                <NavLink
                  to="/knowledge-analytics"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <BarChart3 size={18} />
                  <span>Knowledge Analytics</span>
                </NavLink>
              </>
            )}

            {/* Tasklet 23 Strategic Operations & Command Center */}
            {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.role === 'admin') && (
              <>
                <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
                  Strategic Operations
                </div>
                <NavLink
                  to="/executive-command-center"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Compass size={18} />
                  <span>Command Centre</span>
                </NavLink>

                <NavLink
                  to="/digital-twin"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Cpu size={18} />
                  <span>Digital Twin</span>
                </NavLink>

                <NavLink
                  to="/scenario-modeling"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Sliders size={18} />
                  <span>Scenario Modeling</span>
                </NavLink>

                <NavLink
                  to="/performance"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <BarChart3 size={18} />
                  <span>Performance</span>
                </NavLink>

                <NavLink
                  to="/executive-center"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <FileText size={18} />
                  <span>Executive Center</span>
                </NavLink>
              </>
            )}

            {(profile?.plan === 'enterprise' || profile?.plan === 'admin' || profile?.role === 'admin') && (
              <>
                <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
                  Enterprise
                </div>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Shield size={18} />
                  <span>Enterprise Admin</span>
                </NavLink>
                <NavLink
                  to="/admin/audit"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <FileSpreadsheet size={18} />
                  <span>Audit Logs</span>
                </NavLink>
                <NavLink
                  to="/admin/compliance"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <Scale size={18} />
                  <span>Compliance</span>
                </NavLink>
                <NavLink
                  to="/admin/security"
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                >
                  <KeyRound size={18} />
                  <span>Security</span>
                </NavLink>
              </>
            )}

            <div className="sidebar-category-label" style={{ marginTop: '14px' }}>
              System
            </div>
            <NavLink
              to="/checkout"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <CreditCard size={18} />
              <span>Packages & Plans</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Settings size={18} />
              <span>Settings</span>
            </NavLink>
          </div>

          <div className="sidebar-footer">
            <div className="telemetry-row">
              <span className="live-pulse-dot" />
              <span>WORKSPACE SECURED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <Building2 size={13} color="#e2b53c" />
              <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.8rem' }}>
                Concludo Pty Ltd
              </span>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Melbourne, Australia</div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="main-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
