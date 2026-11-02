import React from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FolderKanban,
  CheckCircle2,
  BrainCircuit,
  Lightbulb,
  BarChart3,
  Settings,
} from 'lucide-react';

export const DashboardQuickActionsToolbar: React.FC = () => {
  const navItems = [
    { to: '/projects', icon: <FolderKanban size={16} />, label: 'Projects' },
    { to: '/work/actions', icon: <CheckCircle2 size={16} />, label: 'Actions' },
    { to: '/memory/decisions', icon: <BrainCircuit size={16} />, label: 'Decisions' },
    { to: '/insight', icon: <Lightbulb size={16} />, label: 'Insight' },
    { to: '/insight/stats', icon: <BarChart3 size={16} />, label: 'Stats' },
    { to: '/settings', icon: <Settings size={16} />, label: 'Settings' },
  ];

  return (
    <div
      className="dashboard-quick-actions-toolbar"
      data-testid="dashboard-quick-actions-toolbar"
      role="toolbar"
      aria-label="Dashboard quick actions"
    >
      <span className="quick-action-label">Quick actions:</span>

      <Link
        to="/projects/new"
        className="quick-action-primary-btn"
        aria-label="Create New Project"
      >
        <PlusCircle size={16} />
        <span>New Project</span>
      </Link>

      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="quick-action-nav-link"
          aria-label={item.label}
        >
          <span className="quick-action-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
};
