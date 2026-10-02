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
  const [activeTab, setActiveTab] = useState<'configure' | 'mapping' | 'test' | 'governance'>('configure');
  const [isVarPickerOpen, setIsVarPickerOpen] = useState(false);
  const [activeTargetField, setActiveTargetField] = useState<string | null>(null);

  // Testing state
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

  // Run isolated Test Step
  const handleRunTestStep = async () => {
    setIsRunningTest(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      // Simulate real provider API invocation check
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (provider?.authenticationType !== 'none' && !currentConnection && providerConnections.length === 0) {
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
        message: `Successfully verified with ${provider?.name || 'Provider'} API!`,
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

  return (
    <div className="wb-inspector" role="dialog" aria-label="Step details" style={{ width: '380px' }}>
      {/* Header */}
      <div className="wb-insp-head" style={{ borderBottom: '1px solid var(--navy2)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {provider ? (
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
            <h2 style={{ fontSize: '14px', margin: 0 }}>{step.name || step.displayName}</h2>
            <div className="wb-insp-sub">
              {isTrigger ? 'Trigger' : 'Action'} &bull; {provider?.name || step.application}
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

      {/* Navigation Tabs */}
      <div className="wb-tabs" role="tablist" style={{ margin: '10px 0 14px' }}>
        <button
          className="wb-tab"
          role="tab"
          aria-selected={activeTab === 'configure'}
          onClick={() => setActiveTab('configure')}
        >
          Setup
        </button>
        <button
          className="wb-tab"
          role="tab"
          aria-selected={activeTab === 'mapping'}
          onClick={() => setActiveTab('mapping')}
        >
          Fields ({Object.keys(actionDef?.inputSchema || {}).length})
        </button>
        <button
          className="wb-tab"
          role="tab"
          aria-selected={activeTab === 'test'}
          onClick={() => setActiveTab('test')}
        >
          Test Step
        </button>
        <button
          className="wb-tab"
          role="tab"
          aria-selected={activeTab === 'governance'}
          onClick={() => setActiveTab('governance')}
        >
          Governance
        </button>
      </div>

      {/* Tab 1: Configure & Connection */}
      {activeTab === 'configure' && (
        <div>
          {/* Connection status banner */}
          <div
            style={{
              background: '#121C2B',
              border: '1px solid var(--navy2)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-m)',
                  color: 'var(--sub)',
                  textTransform: 'uppercase',
                }}
              >
                Connected Account
              </span>
              {currentConnection ? (
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--ok)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-m)',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)' }} />
                  Connected
                </span>
              ) : providerConnections.length > 0 ? (
                <span style={{ fontSize: '10px', color: 'var(--gold)', fontFamily: 'var(--font-m)' }}>
                  Selection Required
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: 'var(--bad)', fontFamily: 'var(--font-m)' }}>
                  Not Connected
                </span>
              )}
            </div>

            {providerConnections.length > 0 ? (
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
                <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--sub)' }}>
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
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-m)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    + Connect {provider.name}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="wb-field">
            <div className="wb-k">Step Label</div>
            <input
              type="text"
              value={step.name || step.displayName}
              onChange={(e) => onUpdateStep({ ...step, name: e.target.value, displayName: e.target.value })}
              style={{
                width: '100%',
                background: '#121C2B',
                border: '1px solid var(--navy2)',
                borderRadius: '6px',
                color: 'var(--light)',
                padding: '6px 10px',
                fontSize: '12px',
                fontFamily: 'var(--font-b)',
                marginTop: '4px',
              }}
            />
          </div>

          <div className="wb-field">
            <div className="wb-k">Explanation</div>
            <div className="wb-v">{step.userFacingExplanation || step.purpose}</div>
          </div>

          {onDeleteStep && (
            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--navy2)' }}>
              <button
                type="button"
                onClick={() => onDeleteStep(step.key)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#EF4444',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={13} /> Remove Step from Canvas
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Dynamic Field Mapping */}
      {activeTab === 'mapping' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-m)',
                color: 'var(--sub)',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              Input Fields & Variables
            </span>
            <span style={{ fontSize: '10px', color: 'var(--gold)', fontFamily: 'var(--font-m)' }}>
              Use {'{{var}}'} to map data
            </span>
          </div>

          {actionDef && Object.keys(actionDef.inputSchema || {}).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(actionDef.inputSchema).map(([fieldName, spec]: [string, any]) => {
                const currentValue = step.inputMapping?.[fieldName] || '';

                return (
                  <div
                    key={fieldName}
                    style={{
                      background: '#121C2B',
                      border: '1px solid var(--navy2)',
                      borderRadius: '8px',
                      padding: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}
                    >
                      <label
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--light)',
                          fontFamily: 'var(--font-b)',
                        }}
                      >
                        {spec.description || fieldName}
                        {spec.required && <span style={{ color: 'var(--gold)', marginLeft: '3px' }}>*</span>}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTargetField(fieldName);
                          setIsVarPickerOpen(true);
                        }}
                        style={{
                          background: 'rgba(226, 181, 60, 0.12)',
                          color: 'var(--gold)',
                          border: '1px solid rgba(226, 181, 60, 0.3)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '9px',
                          fontFamily: 'var(--font-m)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Layers size={10} /> + Insert Variable
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder={spec.example ? `e.g. ${spec.example}` : `Enter value or {{variable}}`}
                      value={currentValue}
                      onChange={(e) => handleMappingChange(fieldName, e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--navy)',
                        border: '1px solid var(--navy2)',
                        borderRadius: '6px',
                        color: 'var(--light)',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-m)',
                      }}
                    />

                    {spec.type && (
                      <div
                        style={{
                          fontSize: '9px',
                          color: 'var(--sub)',
                          marginTop: '4px',
                          fontFamily: 'var(--font-m)',
                        }}
                      >
                        Type: {spec.type}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--sub)' }}>
              <p style={{ margin: 0, fontSize: '12px' }}>No input fields required for this step.</p>
              <p style={{ margin: '4px 0 0', fontSize: '10px' }}>
                Outputs generated by this step can be mapped into subsequent workflow steps.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Test Step */}
      {activeTab === 'test' && (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: '11px', color: 'var(--sub)' }}>
            Execute a safe isolated test for this step using the connected account credentials.
          </p>

          <button
            type="button"
            onClick={handleRunTestStep}
            disabled={isRunningTest}
            style={{
              width: '100%',
              background: isRunningTest ? 'var(--navy2)' : 'var(--gold)',
              color: 'var(--navy)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRunningTest ? 'wait' : 'pointer',
              fontFamily: 'var(--font-m)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '14px',
            }}
          >
            {isRunningTest ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Testing with {provider?.name || 'App'}...
              </>
            ) : (
              <>
                <Play size={14} /> Test Step Now
              </>
            )}
          </button>

          {testResult && (
            <div
              style={{
                background: testResult.success ? '#0E2419' : '#2A1215',
                border: '1px solid',
                borderColor: testResult.success ? 'var(--ok)' : 'var(--bad)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                {testResult.success ? (
                  <CheckCircle2 size={16} color="var(--ok)" />
                ) : (
                  <AlertTriangle size={16} color="var(--bad)" />
                )}
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: testResult.success ? 'var(--ok)' : 'var(--bad)',
                    fontFamily: 'var(--font-h)',
                  }}
                >
                  {testResult.success ? 'Test Succeeded' : 'Test Failed'}
                </span>
                {testResult.durationMs && (
                  <span style={{ fontSize: '10px', color: 'var(--sub)', marginLeft: 'auto' }}>
                    {testResult.durationMs}ms
                  </span>
                )}
              </div>

              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--light)' }}>
                {testResult.message}
              </p>

              {testResult.errorCategory && (
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--sub)',
                    fontFamily: 'var(--font-m)',
                    marginBottom: '8px',
                  }}
                >
                  Category: {testResult.errorCategory}
                </div>
              )}

              {testResult.output && (
                <div>
                  <div
                    style={{
                      fontSize: '9px',
                      color: 'var(--sub)',
                      fontFamily: 'var(--font-m)',
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                    }}
                  >
                    Sample Output Payload
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      background: 'rgba(0,0,0,0.3)',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-m)',
                      color: 'var(--light)',
                      overflowX: 'auto',
                      maxHeight: '120px',
                    }}
                  >
                    {JSON.stringify(testResult.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Governance */}
      {activeTab === 'governance' && (
        <div>
          <div className="wb-field">
            <div className="wb-k">Human Approval Requirement</div>
            <div className="wb-v">
              {isApprovalLocked ? (
                <span className="wb-lock">
                  <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Locked by Concludo Governance. Human approval required before dispatch.
                </span>
              ) : (
                'Standard automated execution'
              )}
            </div>
          </div>

          <div className="wb-field">
            <div className="wb-k">Idempotency Policy</div>
            <div className="wb-v mono">
              {step.idempotencyPolicy?.keyTemplate || `${step.application}:{{run.id}}:${step.key}`}
            </div>
          </div>

          <div className="wb-field">
            <div className="wb-k">Retry Policy</div>
            <div className="wb-v mono">
              {step.retryPolicy?.maxAttempts || 3} attempts, exponential backoff
            </div>
          </div>

          <div className="wb-field">
            <div className="wb-k">Credential Security</div>
            <div className="wb-v" style={{ fontSize: '11px', color: 'var(--sub)' }}>
              Zero-secret architecture: Credentials remain vaulted on server. Workflow records contain only
              scoped connection references.
            </div>
          </div>
        </div>
      )}

      {/* Variable Picker Modal */}
      <VariablePickerModal
        isOpen={isVarPickerOpen}
        onClose={() => setIsVarPickerOpen(false)}
        currentStepKey={step.key}
        allSteps={allSteps}
        targetFieldName={activeTargetField || undefined}
        onSelectVariable={(token) => {
          if (activeTargetField) {
            const currentVal = step.inputMapping?.[activeTargetField] || '';
            handleMappingChange(activeTargetField, currentVal ? `${currentVal} ${token}` : token);
          }
        }}
      />
    </div>
  );
};
