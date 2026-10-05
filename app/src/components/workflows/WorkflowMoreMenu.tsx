import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Layers, PlayCircle, ShieldCheck, CheckSquare, History, RotateCcw, Code } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface WorkflowMoreMenuProps {
  onOpenTemplates: () => void;
  onOpenRawDefinition: () => void;
  onSimulatedTest: () => void;
  onRollback?: () => void;
  canRollback?: boolean;
}

export const WorkflowMoreMenu: React.FC<WorkflowMoreMenuProps> = ({
  onOpenTemplates,
  onOpenRawDefinition,
  onSimulatedTest,
  onRollback,
  canRollback = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="wb-more-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="wb-icon-btn"
        aria-label="More options"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: '1px solid var(--navy2)',
          borderRadius: '6px',
          color: 'var(--sub)',
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '240px',
            background: 'var(--surface)',
            border: '1px solid var(--navy2)',
            borderRadius: '8px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
            zIndex: 100,
            padding: '6px 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onOpenTemplates();
            }}
            style={menuItemStyle}
          >
            <Layers size={14} color="var(--gold)" />
            <span>Templates (20 available)</span>
          </button>

          <Link
            to="/workflows/runs"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            style={{ ...menuItemStyle, textDecoration: 'none' }}
          >
            <History size={14} color="var(--sub)" />
            <span>Workflow runs</span>
          </Link>

          <Link
            to="/approvals"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            style={{ ...menuItemStyle, textDecoration: 'none' }}
          >
            <CheckSquare size={14} color="var(--sub)" />
            <span>Approval Centre</span>
          </Link>

          <Link
            to="/workflows/governance"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            style={{ ...menuItemStyle, textDecoration: 'none' }}
          >
            <ShieldCheck size={14} color="var(--sub)" />
            <span>Governance Centre</span>
          </Link>

          <div style={{ height: '1px', background: 'var(--navy2)', margin: '4px 0' }} />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onSimulatedTest();
            }}
            style={menuItemStyle}
          >
            <PlayCircle size={14} color="var(--sub)" />
            <span>Test with real accounts (Simulated)</span>
          </button>

          {canRollback && onRollback && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onRollback();
              }}
              style={menuItemStyle}
            >
              <RotateCcw size={14} color="var(--warn)" />
              <span>Roll back to previous version</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onOpenRawDefinition();
            }}
            style={menuItemStyle}
          >
            <Code size={14} color="var(--sub)" />
            <span>View raw definition (Advanced)</span>
          </button>
        </div>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  color: 'var(--light)',
  fontSize: '12px',
  fontFamily: 'var(--font-b)',
  textAlign: 'left',
  width: '100%',
  cursor: 'pointer',
};
