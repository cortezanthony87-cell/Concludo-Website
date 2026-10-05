import React from 'react';
import { WorkflowDefinition, WorkflowStep } from '../../lib/workflows/schemas';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface WorkflowStepsOutlineProps {
  definition: WorkflowDefinition;
  selectedStepKey: string | null;
  onSelectStep: (stepKey: string) => void;
  stepTestStatuses?: Record<string, 'passed' | 'failed' | 'skipped' | 'running'>;
  unconnectedStepKeys?: Set<string>;
}

export const WorkflowStepsOutline: React.FC<WorkflowStepsOutlineProps> = ({
  definition,
  selectedStepKey,
  onSelectStep,
  stepTestStatuses = {},
  unconnectedStepKeys = new Set(),
}) => {
  return (
    <div
      className="wb-steps-outline"
      style={{
        padding: '24px',
        maxWidth: '720px',
        margin: '0 auto',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontFamily: 'var(--font-h)', margin: '0 0 4px 0', color: 'var(--light)' }}>
          Steps in Execution Order
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--sub)', margin: 0 }}>
          Accessible run-order breakdown of triggers, actions, and human sign-off gates.
        </p>
      </div>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {definition.steps.map((step, idx) => {
          const isSelected = selectedStepKey === step.key;
          const isApproval = step.stepType === 'approval' || step.approvalRequirement?.required;
          const isTrigger = step.stepType === 'trigger';
          const testStatus = stepTestStatuses[step.key];
          const isUnconnected = unconnectedStepKeys.has(step.key);

          let typeWord = 'ACTION';
          if (isTrigger) typeWord = 'STARTS WHEN';
          else if (isApproval) typeWord = 'APPROVAL';
          else if (step.stepType === 'logic' || step.stepType === 'branch') typeWord = 'CONDITION';
          else if (step.stepType === 'wait') typeWord = 'WAIT';
          else if (step.stepType === 'ai_agent' || (step.name && step.name.toLowerCase().includes('ai'))) typeWord = 'AI';

          const isBuiltIn =
            !step.application ||
            step.application.startsWith('concludo_') ||
            step.application === 'logic' ||
            step.application === 'system';

          return (
            <li
              key={step.key}
              onClick={() => onSelectStep(step.key)}
              tabIndex={0}
              role="button"
              aria-selected={isSelected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStep(step.key);
                }
              }}
              style={{
                background: isSelected ? 'var(--navy)' : 'var(--surface)',
                border: isSelected ? '2px solid var(--gold)' : '1px solid var(--navy2)',
                borderRadius: '8px',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--navy2)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                  fontFamily: 'var(--font-m)',
                  color: 'var(--sub)',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-m)',
                      fontSize: '10px',
                      color: isTrigger ? 'var(--blue)' : isApproval ? 'var(--warn)' : 'var(--sub)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {typeWord}
                  </span>
                  {isApproval && (
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--warn)',
                        fontFamily: 'var(--font-m)',
                      }}
                    >
                      Sign-off
                    </span>
                  )}
                  {isUnconnected && (
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--warn)',
                        fontFamily: 'var(--font-m)',
                      }}
                    >
                      Needs Connection
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--light)', fontFamily: 'var(--font-h)' }}>
                  {step.name || step.displayName}
                </div>

                <div style={{ fontSize: '11.5px', color: 'var(--sub)', marginTop: '2px', lineHeight: 1.4 }}>
                  {step.userFacingExplanation}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {isBuiltIn ? (
                  <span style={{ fontSize: '11px', color: 'var(--sub)', fontFamily: 'var(--font-m)' }}>
                    Built into Concludo
                  </span>
                ) : (
                  <IntegrationIcon slug={step.application} size={20} />
                )}

                {testStatus === 'passed' && (
                  <span title="Passed" style={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle2 size={16} color="var(--ok)" />
                  </span>
                )}
                {testStatus === 'skipped' && (
                  <span style={{ fontSize: '10px', color: 'var(--sub)', fontFamily: 'var(--font-m)' }}>
                    Skipped in test
                  </span>
                )}
                {testStatus === 'failed' && (
                  <span title="Failed" style={{ display: 'flex', alignItems: 'center' }}>
                    <AlertCircle size={16} color="var(--bad)" />
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
