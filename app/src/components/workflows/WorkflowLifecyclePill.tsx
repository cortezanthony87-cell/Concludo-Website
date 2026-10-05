import React from 'react';

export type WorkflowUiState =
  | 'building'
  | 'testing'
  | 'empty'
  | 'error'
  | 'paused'
  | 'active'
  | 'waiting_sign_off'
  | 'review_changes'
  | 'needs_attention'
  | 'test_failed'
  | 'ready_to_activate'
  | 'ready_to_test';

export interface WorkflowLifecyclePillProps {
  uiState: WorkflowUiState;
  onClick?: () => void;
}

export const WorkflowLifecyclePill: React.FC<WorkflowLifecyclePillProps> = ({ uiState, onClick }) => {
  if (uiState === 'empty') return null;

  let text = 'Draft';
  let bg = 'rgba(148, 163, 184, 0.15)';
  let color = 'var(--sub)';
  let dotColor = 'var(--sub)';

  switch (uiState) {
    case 'building':
      text = 'Building';
      bg = 'rgba(226, 181, 60, 0.15)';
      color = 'var(--gold)';
      dotColor = 'var(--gold)';
      break;
    case 'testing':
      text = 'Testing';
      bg = 'rgba(59, 130, 246, 0.15)';
      color = 'var(--blue)';
      dotColor = 'var(--blue)';
      break;
    case 'error':
      text = 'Needs fixing';
      bg = 'rgba(239, 68, 68, 0.15)';
      color = 'var(--bad)';
      dotColor = 'var(--bad)';
      break;
    case 'paused':
      text = 'Paused';
      bg = 'rgba(148, 163, 184, 0.15)';
      color = 'var(--sub)';
      dotColor = 'var(--sub)';
      break;
    case 'active':
      text = 'Active';
      bg = 'rgba(16, 185, 129, 0.15)';
      color = 'var(--ok)';
      dotColor = 'var(--ok)';
      break;
    case 'waiting_sign_off':
      text = 'Waiting for sign-off';
      bg = 'rgba(245, 158, 11, 0.15)';
      color = 'var(--warn)';
      dotColor = 'var(--warn)';
      break;
    case 'review_changes':
      text = 'Review changes';
      bg = 'rgba(245, 158, 11, 0.15)';
      color = 'var(--warn)';
      dotColor = 'var(--warn)';
      break;
    case 'needs_attention':
      text = 'Needs attention';
      bg = 'rgba(245, 158, 11, 0.15)';
      color = 'var(--warn)';
      dotColor = 'var(--warn)';
      break;
    case 'test_failed':
      text = 'Test failed';
      bg = 'rgba(239, 68, 68, 0.15)';
      color = 'var(--bad)';
      dotColor = 'var(--bad)';
      break;
    case 'ready_to_activate':
      text = 'Test passed';
      bg = 'rgba(16, 185, 129, 0.15)';
      color = 'var(--ok)';
      dotColor = 'var(--ok)';
      break;
    case 'ready_to_test':
    default:
      text = 'Draft';
      bg = 'rgba(148, 163, 184, 0.15)';
      color = 'var(--sub)';
      dotColor = 'var(--sub)';
      break;
  }

  return (
    <span
      role="status"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '999px',
        background: bg,
        color: color,
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-m)',
        letterSpacing: '0.02em',
        border: `1px solid ${color}`,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor,
        }}
        aria-hidden="true"
      />
      {text}
    </span>
  );
};
