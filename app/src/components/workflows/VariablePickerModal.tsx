import React, { useState, useMemo } from 'react';
import { Search, X, Layers, CornerDownRight, Check, Database, Zap, FileText } from 'lucide-react';
import { WorkflowStep } from '../../lib/workflows/schemas';
import { INTEGRATION_PROVIDERS_CATALOG } from '../../lib/integrations/hubRegistry';

export interface AvailableVariable {
  token: string;
  label: string;
  sourceStepKey: string;
  sourceStepName: string;
  sourceApp: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  description?: string;
  exampleValue?: string;
}

export interface VariablePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVariable: (variableToken: string) => void;
  currentStepKey: string;
  allSteps: WorkflowStep[];
  targetFieldName?: string;
}

export const VariablePickerModal: React.FC<VariablePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectVariable,
  currentStepKey,
  allSteps,
  targetFieldName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Discover all preceding steps before the current step in topological order
  const availableVariables = useMemo(() => {
    const vars: AvailableVariable[] = [];
    const currentIndex = allSteps.findIndex((s) => s.key === currentStepKey);
    const priorSteps = currentIndex > 0 ? allSteps.slice(0, currentIndex) : allSteps.filter((s) => s.key !== currentStepKey);

    // 1. Trigger variables
    const triggerStep = allSteps.find((s) => s.stepType === 'trigger') || allSteps[0];
    if (triggerStep) {
      const app = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === triggerStep.application);
      const triggerDef = app?.triggers.find((t) => t.key === (triggerStep.configuration?.triggerKey || triggerStep.key));
      
      if (triggerDef?.outputSchema) {
        Object.entries(triggerDef.outputSchema).forEach(([key, spec]: [string, any]) => {
          vars.push({
            token: `{{trigger.${key}}}`,
            label: spec.description || key,
            sourceStepKey: triggerStep.key,
            sourceStepName: triggerStep.name || triggerStep.displayName || 'Trigger Event',
            sourceApp: triggerStep.application,
            dataType: spec.type || 'string',
            description: `From ${triggerStep.name || 'Trigger'}: ${key}`,
            exampleValue: spec.example || spec.default,
          });
        });
      } else {
        // Fallback default trigger tokens
        ['id', 'title', 'email', 'name', 'timestamp', 'summary', 'payload'].forEach((k) => {
          vars.push({
            token: `{{trigger.${k}}}`,
            label: `Trigger ${k.charAt(0).toUpperCase() + k.slice(1)}`,
            sourceStepKey: triggerStep.key,
            sourceStepName: triggerStep.name || triggerStep.displayName || 'Trigger Event',
            sourceApp: triggerStep.application,
            dataType: k === 'timestamp' ? 'date' : 'string',
            description: `Raw data received by ${triggerStep.name}`,
          });
        });
      }
    }

    // 2. Variables from prior action / agent steps
    priorSteps.forEach((step) => {
      if (step.stepType === 'trigger') return;
      const app = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === step.application);
      const actionDef = app?.actions.find((a) => a.key === (step.configuration?.actionKey || step.key));

      if (actionDef?.outputSchema) {
        Object.entries(actionDef.outputSchema).forEach(([key, spec]: [string, any]) => {
          vars.push({
            token: `{{steps.${step.key}.${key}}}`,
            label: spec.description || key,
            sourceStepKey: step.key,
            sourceStepName: step.name || step.displayName,
            sourceApp: step.application,
            dataType: spec.type || 'string',
            description: `Output from Step: ${step.name || step.displayName}`,
            exampleValue: spec.example,
          });
        });
      } else {
        // Standard generic outputs
        ['id', 'status', 'output', 'created_at', 'url', 'result'].forEach((k) => {
          vars.push({
            token: `{{steps.${step.key}.${k}}}`,
            label: `${step.name || step.displayName} ${k}`,
            sourceStepKey: step.key,
            sourceStepName: step.name || step.displayName,
            sourceApp: step.application,
            dataType: 'string',
            description: `Output attribute '${k}' from step ${step.key}`,
          });
        });
      }
    });

    return vars;
  }, [allSteps, currentStepKey]);

  const filteredVariables = useMemo(() => {
    let list = availableVariables;
    if (selectedCategory !== 'all') {
      list = list.filter((v) => v.sourceStepKey === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          v.token.toLowerCase().includes(q) ||
          v.sourceStepName.toLowerCase().includes(q) ||
          v.sourceApp.toLowerCase().includes(q)
      );
    }
    return list;
  }, [availableVariables, selectedCategory, searchQuery]);

  // Unique source steps for filter pills
  const stepFilters = useMemo(() => {
    const map = new Map<string, string>();
    availableVariables.forEach((v) => map.set(v.sourceStepKey, v.sourceStepName));
    return Array.from(map.entries());
  }, [availableVariables]);

  if (!isOpen) return null;

  return (
    <div className="wb-scrim" role="dialog" aria-modal="true" aria-labelledby="var-picker-title">
      <div
        style={{
          background: 'var(--navy)',
          border: '1px solid var(--gold)',
          borderRadius: '12px',
          width: '92%',
          maxWidth: '680px',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'wbFadeIn .15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--navy2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(22, 38, 63, 0.95)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--gold)" />
              <h2
                id="var-picker-title"
                style={{
                  fontFamily: 'var(--font-h)',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--light)',
                  margin: 0,
                }}
              >
                Insert Dynamic Variable
              </h2>
            </div>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '11px',
                color: 'var(--sub)',
                fontFamily: 'var(--font-m)',
              }}
            >
              {targetFieldName ? `Map incoming data into "${targetFieldName}"` : 'Select variable from previous workflow steps'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--sub)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--navy2)', background: '#111A29' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--navy)',
              border: '1px solid var(--navy2)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '10px',
            }}
          >
            <Search size={15} color="var(--sub)" />
            <input
              type="text"
              placeholder="Search variables by name, step, or field token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--light)',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'var(--font-b)',
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--sub)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                fontFamily: 'var(--font-m)',
                fontSize: '10px',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: selectedCategory === 'all' ? 'var(--gold)' : 'var(--navy2)',
                background: selectedCategory === 'all' ? 'rgba(226, 181, 60, 0.15)' : 'transparent',
                color: selectedCategory === 'all' ? 'var(--gold)' : 'var(--sub)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              All Steps ({availableVariables.length})
            </button>
            {stepFilters.map(([key, name]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                style={{
                  fontFamily: 'var(--font-m)',
                  fontSize: '10px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: selectedCategory === key ? 'var(--gold)' : 'var(--navy2)',
                  background: selectedCategory === key ? 'rgba(226, 181, 60, 0.15)' : 'transparent',
                  color: selectedCategory === key ? 'var(--gold)' : 'var(--sub)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Variables List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {filteredVariables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--sub)' }}>
              <Database size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>No matching variables found</p>
              <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                Add more steps or check previous step output schemas.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredVariables.map((v) => (
                <div
                  key={v.token}
                  onClick={() => {
                    onSelectVariable(v.token);
                    onClose();
                  }}
                  style={{
                    background: '#162233',
                    border: '1px solid var(--navy2)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all .15s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--gold)';
                    e.currentTarget.style.background = '#1D2E45';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--navy2)';
                    e.currentTarget.style.background = '#162233';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-m)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(226, 181, 60, 0.12)',
                          color: 'var(--gold)',
                          border: '1px solid rgba(226, 181, 60, 0.3)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {v.dataType}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--light)',
                          fontFamily: 'var(--font-b)',
                        }}
                      >
                        {v.label}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--sub)',
                          fontFamily: 'var(--font-m)',
                        }}
                      >
                        &bull; {v.sourceStepName}
                      </span>
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--font-m)',
                        fontSize: '11px',
                        color: '#9BB2D1',
                        letterSpacing: '.02em',
                      }}
                    >
                      <code>{v.token}</code>
                    </div>

                    {v.description && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--sub)' }}>
                        {v.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    style={{
                      background: 'rgba(226, 181, 60, 0.15)',
                      color: 'var(--gold)',
                      border: '1px solid var(--gold)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-m)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Insert
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--navy2)',
            background: 'var(--navy)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--sub)',
          }}
        >
          <span>Concludo safely evaluates mapped tokens at runtime.</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--navy2)',
              color: 'var(--light)',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
