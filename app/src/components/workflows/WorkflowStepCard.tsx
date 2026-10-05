import React from 'react';
import { WorkflowStep } from '../../lib/workflows/schemas';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export interface WorkflowStepCardProps {
  step: WorkflowStep;
  index: number;
  isSelected: boolean;
  isProposed?: boolean;
  testStatus?: 'passed' | 'failed' | 'skipped' | 'running';
  missingConnection?: boolean;
  validationError?: string;
  onClick: (stepKey: string, target: HTMLElement) => void;
}

export const WorkflowStepCard: React.FC<WorkflowStepCardProps> = ({
  step,
  index,
  isSelected,
  isProposed = false,
  testStatus,
  missingConnection = false,
  validationError,
  onClick,
}) => {
  const isApproval = step.stepType === 'approval' || step.approvalRequirement?.required;
  const isTrigger = step.stepType === 'trigger';

  let typeWord = 'ACTION';
  let typeClass = 'action';
  if (isTrigger) {
    typeWord = 'STARTS WHEN';
    typeClass = 'trigger';
  } else if (step.stepType === 'ai_agent' || (step.name && step.name.toLowerCase().includes('ai'))) {
    typeWord = 'AI';
    typeClass = 'ai';
  } else if (isApproval) {
    typeWord = 'APPROVAL';
    typeClass = 'approval';
  } else if (step.stepType === 'logic' || step.stepType === 'branch') {
    typeWord = 'CONDITION';
    typeClass = 'condition';
  } else if (step.stepType === 'wait') {
    typeWord = 'WAIT';
    typeClass = 'wait';
  }

  const isBuiltIn =
    !step.application ||
    step.application.startsWith('concludo_') ||
    step.application === 'logic' ||
    step.application === 'system';

  const posX = step.position?.x ?? (index * 240 + 40);
  const posY = step.position?.y ?? 60;

  // Attention line: only when something is wrong
  let attentionText = '';
  let attentionColor = 'var(--warn)';
  if (validationError) {
    attentionText = `Fix: ${validationError}`;
    attentionColor = 'var(--bad)';
  } else if (missingConnection && !isBuiltIn) {
    const appName = step.application.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    attentionText = `Connect ${appName}`;
    attentionColor = 'var(--warn)';
  } else if (testStatus === 'failed') {
    attentionText = 'Failed in test';
    attentionColor = 'var(--bad)';
  }

  return (
    <div
      className={`wb-node ${isSelected ? 'selected' : ''} ${isProposed ? 'proposed' : ''}`}
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
        border: isSelected
          ? '2px solid var(--gold)'
          : isProposed
          ? '2px dashed var(--gold)'
          : '1px solid var(--navy2)',
        position: 'absolute',
      }}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      aria-label={`${typeWord} step. ${step.name || step.displayName}. ${step.userFacingExplanation || ''}${
        isApproval ? ' Sign-off required.' : ''
      }`}
      onClick={(e) => onClick(step.key, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(step.key, e.currentTarget);
        }
      }}
    >
      {/* Top row: App logo (22px) + Tags */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isBuiltIn ? (
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                background: 'var(--navy)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--gold)',
                fontFamily: 'var(--font-m)',
                fontSize: '11px',
                fontWeight: 700,
                border: '1px solid var(--navy2)',
              }}
              title="Built into Concludo"
            >
              C
            </div>
          ) : (
            <IntegrationIcon slug={step.application} size={22} />
          )}

          <span
            style={{
              fontFamily: 'var(--font-m)',
              fontSize: '9.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: typeClass === 'trigger' ? 'var(--blue)' : typeClass === 'approval' ? 'var(--warn)' : 'var(--sub)',
            }}
          >
            {typeWord}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isProposed && (
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-m)',
                color: 'var(--gold)',
                background: 'rgba(226, 181, 60, 0.15)',
                padding: '2px 4px',
                borderRadius: '3px',
                fontWeight: 700,
              }}
            >
              PROPOSED
            </span>
          )}
          {isApproval && (
            <span
              className="wb-tag signoff"
              style={{
                fontSize: '9.5px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--warn)',
                fontWeight: 600,
              }}
            >
              Sign-off
            </span>
          )}
          {testStatus === 'passed' && (
            <span title="Passed in test" style={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircle2 size={14} color="var(--ok)" />
            </span>
          )}
          {testStatus === 'skipped' && (
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-m)',
                color: 'var(--sub)',
              }}
              title="Skipped in test. A person will approve when it runs for real."
            >
              Skipped
            </span>
          )}
          {testStatus === 'running' && (
            <Clock size={13} color="var(--gold)" className="spin" />
          )}
        </div>
      </div>

      {/* Title: Poppins 12.5px semibold */}
      <h3
        style={{
          fontSize: '12.5px',
          fontFamily: 'var(--font-h)',
          fontWeight: 600,
          margin: '0 0 6px 0',
          color: 'var(--light)',
          lineHeight: 1.3,
        }}
      >
        {step.name || step.displayName}
      </h3>

      {/* Description: Inter 11px */}
      <p
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-b)',
          color: 'var(--sub)',
          margin: 0,
          lineHeight: 1.45,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {step.userFacingExplanation}
      </p>

      {/* Attention Line: only if something is wrong */}
      {attentionText && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '10.5px',
            fontFamily: 'var(--font-m)',
            color: attentionColor,
          }}
        >
          <AlertCircle size={12} color={attentionColor} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attentionText}
          </span>
        </div>
      )}
    </div>
  );
};
