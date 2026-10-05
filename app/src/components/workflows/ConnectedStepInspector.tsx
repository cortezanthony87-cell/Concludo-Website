import React, { useState, useMemo } from 'react';
import {
  X,
  Play,
  Layers,
  ShieldCheck,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Database,
  Trash2,
} from 'lucide-react';
import { WorkflowStep } from '../../lib/workflows/schemas';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  ProviderDefinition,
  IntegrationConnection,
  ActionDefinition,
  TriggerDefinition,
} from '../../lib/integrations/hubRegistry';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import { VariablePickerModal } from './VariablePickerModal';

export interface StepTestResult {
  success: boolean;
  message: string;
  statusCode?: number;
  output?: any;
  durationMs?: number;
  errorCategory?: string;
}

export interface ConnectedStepInspectorProps {
  step: WorkflowStep;
  allSteps: WorkflowStep[];
  connections: IntegrationConnection[];
  onUpdateStep: (updatedStep: WorkflowStep) => void;
  onDeleteStep?: (stepKey: string) => void;
  onClose: () => void;
  onOpenConnectModal?: (provider: ProviderDefinition) => void;
}

export const ConnectedStepInspector: React.FC<ConnectedStepInspectorProps> = ({
  step,
  allSteps,
  connections,
  onUpdateStep,
  onDeleteStep,
  onClose,
  onOpenConnectModal,
}) => {
  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple');
  const [isVarPickerOpen, setIsVarPickerOpen] = useState(false);
  const [activeTargetField, setActiveTargetField] = useState<string | null>(null);

  // Testing state (Advanced)
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<StepTestResult | null>(null);

  // Identify matching provider and action/trigger schema
  const provider = useMemo(() => {
    return INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === step.application);
  }, [step.application]);

  const isTrigger = step.stepType === 'trigger';
  const triggerDef = useMemo(() => {
    return provider?.triggers.find((t) => t.key === (step.configuration?.triggerKey || step.key));
  }, [provider, step]);

  const actionDef = useMemo(() => {
    return provider?.actions.find((a) => a.key === (step.configuration?.actionKey || step.key));
  }, [provider, step]);

  // Current connection if applicable
  const currentConnection = useMemo(() => {
    if (!step.configuration?.connectionId) return null;
    return connections.find((c) => c.id === step.configuration?.connectionId);
  }, [connections, step.configuration?.connectionId]);

  const providerConnections = useMemo(() => {
    if (!provider) return [];
    return connections.filter((c) => c.provider_id === provider.id && c.status === 'connected');
  }, [provider, connections]);

  // Handle field mapping updates
  const handleMappingChange = (fieldName: string, value: string) => {
    const updated = {
      ...step,
      inputMapping: {
        ...(step.inputMapping || {}),
        [fieldName]: value,
      },
    };
    onUpdateStep(updated);
  };

  // Handle configuration updates
  const handleConfigChange = (key: string, value: any) => {
    const updated = {
      ...step,
      configuration: {
        ...(step.configuration || {}),
        [key]: value,
      },
    };
    onUpdateStep(updated);
  };

  // Run isolated Test Step (Honest simulated check)
  const handleRunTestStep = async () => {
    setIsRunningTest(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const isBuiltIn =
        !step.application ||
        step.application.startsWith('concludo_') ||
        step.application === 'logic' ||
        step.application === 'system';

      if (!isBuiltIn && provider?.authenticationType !== 'none' && !currentConnection && providerConnections.length === 0) {
        setTestResult({
          success: false,
          message: `Authentication required: ${provider?.name || 'Provider'} account is not connected.`,
          errorCategory: 'Authentication expired or missing',
          durationMs: Date.now() - startTime,
        });
        return;
      }

      // Check required input fields
      const inputSchema = actionDef?.inputSchema || {};
      const missingRequired: string[] = [];
      Object.entries(inputSchema).forEach(([key, spec]: [string, any]) => {
        if (spec.required && !(step.inputMapping?.[key] || step.configuration?.[key])) {
          missingRequired.push(spec.description || key);
        }
      });

      if (missingRequired.length > 0) {
        setTestResult({
          success: false,
          message: `Missing required field(s): ${missingRequired.join(', ')}`,
          errorCategory: 'Validation error',
          durationMs: Date.now() - startTime,
        });
        return;
      }

      // Output mock simulated safe payload
      const simulatedOutput = actionDef?.outputSchema || triggerDef?.outputSchema || {
        status: 'ok',
        id: `mock_${Date.now()}`,
      };

      setTestResult({
        success: true,
        message: `Simulated check passed for ${provider?.name || 'internal service'}.`,
        statusCode: 200,
        output: simulatedOutput,
        durationMs: Date.now() - startTime,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Provider temporarily unavailable',
        errorCategory: 'Provider connection error',
        durationMs: Date.now() - startTime,
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const isApprovalLocked = step.stepType === 'approval' || step.approvalRequirement?.required;
  const isBuiltIn =
    !step.application ||
    step.application.startsWith('concludo_') ||
    step.application === 'logic' ||
    step.application === 'system';

  return (
    <div className="wb-inspector" role="dialog" aria-label="Step details" style={{ width: '380px' }}>
      {/* Header */}
      <div className="wb-insp-head" style={{ borderBottom: '1px solid var(--navy2)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isBuiltIn ? (
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: 'var(--navy2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--gold)',
                fontFamily: 'var(--font-m)',
                fontWeight: 700,
              }}
            >
              C
            </div>
          ) : provider ? (
            <IntegrationIcon slug={provider.iconSlug} size={30} />
          ) : (
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: 'var(--navy2)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Layers size={16} color="var(--gold)" />
            </div>
          )}
          <div>
            <h2 style={{ fontSize: '14px', margin: 0, fontFamily: 'var(--font-h)' }}>{step.name || step.displayName}</h2>
            <div className="wb-insp-sub" style={{ fontSize: '11px', color: 'var(--sub)' }}>
              {isTrigger ? 'Starts when' : 'Action'} &bull; {isBuiltIn ? 'Built into Concludo' : provider?.name || step.application}
            </div>
          </div>
        </div>
        <button
          className="wb-btn"
          id="closeInsp"
          aria-label="Close"
          onClick={onClose}
          style={{ padding: '4px 8px' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Tabs: Simple vs Advanced */}
      <div className="wb-tabs" role="tablist" style={{ margin: '12px 0 16px' }}>
        <button
          className="wb-tab"
          role="tab"
          aria-selected={activeTab === 'simple'}
          onClick={() => setActiveTab('simple')}
        >
          Simple
        </button>
        <button
          className="wb-tab"
          role="tab"
          aria-selected={activeTab === 'advanced'}
          onClick={() => setActiveTab('advanced')}
        >
          Advanced
        </button>
      </div>

      {/* Tab: Simple */}
      {activeTab === 'simple' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. What this step does */}
          <div>
            <label style={labelStyle}>What this step does</label>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--light)', lineHeight: 1.45 }}>
              {step.userFacingExplanation || 'Executes this step in the automated flow.'}
            </p>
          </div>

          {/* 2. App and account */}
          <div
            style={{
              background: '#121C2B',
              border: '1px solid var(--navy2)',
              borderRadius: '8px',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={labelStyle}>App and Account</span>
              {isBuiltIn ? (
                <span style={{ fontSize: '10.5px', color: 'var(--ok)', fontFamily: 'var(--font-m)' }}>
                  Built into Concludo
                </span>
              ) : currentConnection ? (
                <span style={{ fontSize: '10.5px', color: 'var(--ok)', fontFamily: 'var(--font-m)' }}>
                  Connected
                </span>
              ) : providerConnections.length > 0 ? (
                <span style={{ fontSize: '10.5px', color: 'var(--gold)', fontFamily: 'var(--font-m)' }}>
                  Selection Required
                </span>
              ) : (
                <span style={{ fontSize: '10.5px', color: 'var(--bad)', fontFamily: 'var(--font-m)' }}>
                  Not Connected
                </span>
              )}
            </div>

            {isBuiltIn ? (
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--sub)' }}>
                Runs internally within Concludo workspace governance.
              </p>
            ) : providerConnections.length > 0 ? (
              <select
                value={step.configuration?.connectionId || providerConnections[0].id}
                onChange={(e) => handleConfigChange('connectionId', e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--navy)',
                  border: '1px solid var(--navy2)',
                  borderRadius: '6px',
                  color: 'var(--light)',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-b)',
                }}
              >
                {providerConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.connection_name} ({c.external_account_reference})
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--sub)' }}>
                  Connect your {provider?.name || 'app'} account to authorise this step.
                </p>
                {provider && (
                  <button
                    type="button"
                    onClick={() => onOpenConnectModal && onOpenConnectModal(provider)}
                    style={{
                      width: '100%',
                      background: 'var(--gold)',
                      color: 'var(--navy)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '7px 12px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-m)',
                    }}
                  >
                    + Connect {provider.name}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Information it uses */}
          <div>
            <label style={labelStyle}>Information it uses</label>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--sub)', lineHeight: 1.4 }}>
              {step.inputMapping && Object.keys(step.inputMapping).length > 0
                ? Object.entries(step.inputMapping)
                    .map(([k, v]) => `${k} from ${v}`)
                    .join(', ')
                : 'Takes standard parameters from the starting trigger and previous steps.'}
            </p>
          </div>

          {/* 4. What it produces */}
          <div>
            <label style={labelStyle}>What it produces</label>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--sub)', lineHeight: 1.4 }}>
              Outputs standard step outcome data available for subsequent steps and review cards.
            </p>
          </div>

          {/* 5. Who approves */}
          <div>
            <label style={labelStyle}>Who approves</label>
            {isApprovalLocked ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--warn)',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  color: 'var(--warn)',
                }}
              >
                <Lock size={14} />
                <span>
                  Locked: Human approval required by Concludo policy before actions or messages can proceed.
                </span>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--sub)' }}>
                No mandatory approval required for this individual action step.
              </p>
            )}
          </div>

          {/* 6. If it fails */}
          <div>
            <label style={labelStyle}>If it fails</label>
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--sub)' }}>
              Retries up to 3 times with exponential backoff. If persistent, execution pauses and notifies the workflow owner.
            </p>
          </div>

          {/* Link to Advanced */}
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--navy2)', paddingTop: '10px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('advanced')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--gold)',
                fontSize: '11.5px',
                cursor: 'pointer',
                fontFamily: 'var(--font-m)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View advanced configuration &rarr;</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: Advanced */}
      {activeTab === 'advanced' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Warning banner */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--warn)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '11px',
              color: 'var(--warn)',
              fontFamily: 'var(--font-m)',
            }}
          >
            Changes made here are not checked by the Architect.
          </div>

          {/* Field Mapping */}
          <div>
            <label style={labelStyle}>Field Mapping</label>
            {actionDef?.inputSchema ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(actionDef.inputSchema).map(([fieldKey, spec]: [string, any]) => (
                  <div key={fieldKey}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--light)', fontFamily: 'var(--font-m)' }}>
                        {spec.description || fieldKey} {spec.required && <span style={{ color: 'var(--warn)' }}>*</span>}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={step.inputMapping?.[fieldKey] || ''}
                      onChange={(e) => handleMappingChange(fieldKey, e.target.value)}
                      placeholder={`e.g. {{trigger.${fieldKey}}}`}
                      style={{
                        width: '100%',
                        background: 'var(--navy)',
                        border: '1px solid var(--navy2)',
                        borderRadius: '4px',
                        color: 'var(--light)',
                        padding: '6px 8px',
                        fontSize: '11.5px',
                        fontFamily: 'var(--font-m)',
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--sub)' }}>No input fields for this step.</p>
            )}
          </div>

          {/* Simulated Step Test */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--navy2)',
              borderRadius: '6px',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={labelStyle}>Step Test</span>
              <button
                type="button"
                onClick={handleRunTestStep}
                disabled={isRunningTest}
                style={{
                  background: 'var(--navy2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--light)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-m)',
                  cursor: isRunningTest ? 'not-allowed' : 'pointer',
                }}
              >
                {isRunningTest ? 'Running...' : 'Test Step'}
              </button>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '10.5px', color: 'var(--sub)' }}>
              Simulated check: Concludo does not call the app yet.
            </p>
            {testResult && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '8px',
                  borderRadius: '4px',
                  background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: testResult.success ? 'var(--ok)' : 'var(--bad)',
                  fontSize: '11px',
                }}
              >
                {testResult.message}
              </div>
            )}
          </div>

          {/* Step Actions */}
          {onDeleteStep && (
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => onDeleteStep(step.key)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid var(--bad)',
                  borderRadius: '6px',
                  color: 'var(--bad)',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={13} />
                <span>Delete Step</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10.5px',
  fontFamily: 'var(--font-m)',
  textTransform: 'uppercase',
  color: 'var(--sub)',
  letterSpacing: '0.04em',
  marginBottom: '4px',
};
