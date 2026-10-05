import React from 'react';
import { WorkflowUiState } from './WorkflowLifecyclePill';

export interface PrimaryActionButtonProps {
  uiState: WorkflowUiState;
  isHighOrRestrictedRisk: boolean;
  onAction: (actionType: string) => void;
  disabled?: boolean;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  uiState,
  isHighOrRestrictedRisk,
  onAction,
  disabled = false,
}) => {
  let label = 'Test workflow';
  let actionType = 'test';
  let isPrimaryGold = true;
  let isBtnDisabled = disabled;

  switch (uiState) {
    case 'building':
      label = 'Stop';
      actionType = 'stop_building';
      isPrimaryGold = false;
      break;
    case 'testing':
      label = 'Testing...';
      actionType = 'testing';
      isBtnDisabled = true;
      break;
    case 'empty':
      label = 'Build workflow';
      actionType = 'build';
      break;
    case 'error':
      label = 'Fix';
      actionType = 'fix_error';
      isPrimaryGold = false;
      break;
    case 'paused':
      label = 'Resume';
      actionType = 'resume';
      break;
    case 'active':
      label = 'Pause';
      actionType = 'pause';
      isPrimaryGold = false;
      break;
    case 'waiting_sign_off':
      label = 'View request';
      actionType = 'view_request';
      isPrimaryGold = false;
      break;
    case 'review_changes':
      label = 'Keep changes';
      actionType = 'keep_changes';
      break;
    case 'needs_attention':
      label = 'Fix next issue';
      actionType = 'fix_issue';
      isPrimaryGold = false;
      break;
    case 'test_failed':
      label = 'Fix and retest';
      actionType = 'fix_and_retest';
      isPrimaryGold = false;
      break;
    case 'ready_to_activate':
      label = isHighOrRestrictedRisk ? 'Request activation' : 'Activate';
      actionType = 'activate';
      break;
    case 'ready_to_test':
    default:
      label = 'Test workflow';
      actionType = 'test';
      break;
  }

  return (
    <button
      type="button"
      className="wb-btn"
      onClick={() => onAction(actionType)}
      disabled={isBtnDisabled}
      style={{
        background: isPrimaryGold ? 'var(--gold)' : 'var(--navy2)',
        color: isPrimaryGold ? 'var(--navy)' : 'var(--light)',
        fontWeight: 700,
        fontSize: '12.5px',
        fontFamily: 'var(--font-m)',
        padding: '7px 16px',
        borderRadius: '6px',
        border: 'none',
        cursor: isBtnDisabled ? 'not-allowed' : 'pointer',
        opacity: isBtnDisabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {label}
    </button>
  );
};
