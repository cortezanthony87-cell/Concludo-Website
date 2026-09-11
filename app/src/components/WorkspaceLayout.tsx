import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  BrainCircuit,
  CheckSquare,
  Settings,
  ChevronDown,
  User,
  LogOut,
  Building2,
} from 'lucide-react';

export const WorkspaceLayout: React.FC = () => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="app-container">
      {/* Top navigation */}
      <header className="top-navbar">
        <div className="nav-brand-group">
          <Link to="/dashboard" className="brand-logo-link">
            <span className="brand-gold-dot"></span>
            <span>Concludo Workspace</span>
          </Link>
        </div>

        <div className="nav-right-group">
          {/* Plan badge placeholder */}
          <div className="plan-badge-placeholder">
            <span>Starter Plan</span>
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
              <div className="account-avatar">AC</div>
              <span style={{ fontSize: '0.88rem', fontWeight: 500, color: '#f1f5f9' }}>
                Anthony Cortez
              </span>
              <ChevronDown size={15} />
            </button>

            {accountMenuOpen && (
              <div className="account-dropdown">
                <div className="dropdown-user-header">
                  <div className="dropdown-user-name">Anthony Cortez</div>
                  <div className="dropdown-user-email">hello@concludo.au</div>
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
                  to="/settings"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </Link>
                <div className="dropdown-divider" />
                <Link
                  to="/login"
                  className="dropdown-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </Link>
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
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
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
              to="/projects/new"
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <FileText size={18} />
              <span>New Transcript</span>
            </NavLink>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Building2 size={14} color="#e2b53c" />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Concludo Pty Ltd</span>
            </div>
            <div>Melbourne, Australia</div>
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
