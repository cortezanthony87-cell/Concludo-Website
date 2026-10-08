import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Plus,
  Zap,
  ArrowRight,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  INTEGRATION_CATEGORIES,
  ProviderDefinition,
  TriggerDefinition,
  ActionDefinition,
  IntegrationCategory,
  IntegrationConnection,
  integrationsHubService,
} from '../../lib/integrations/hubRegistry';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import { WorkflowStep } from '../../lib/workflows/schemas';
import { isUsable } from '../../lib/integrations/connectionStatus';

export interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStep: (step: Partial<WorkflowStep>) => void;
  onConnectProvider?: (provider: ProviderDefinition) => void;
  connections: IntegrationConnection[];
  existingStepsCount: number;
}

export const AddStepModal: React.FC<AddStepModalProps> = ({
  isOpen,
  onClose,
  onAddStep,
  onConnectProvider,
  connections,
  existingStepsCount,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory>('All Apps');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderDefinition | null>(null);
  const [selectedType, setSelectedType] = useState<'action' | 'trigger'>('action');
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');

  const catalog = useMemo(() => INTEGRATION_PROVIDERS_CATALOG, []);

  const filteredProviders = useMemo(() => {
    let list = catalog;
    if (selectedCategory !== 'All Apps') {
      if (selectedCategory === 'Connected') {
        const connectedProviderIds = new Set(
          connections.filter((c) => isUsable({ status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result })).map((c) => c.provider_id)
        );
        list = list.filter((p) => connectedProviderIds.has(p.id));
      } else {
        list = list.filter((p) => p.category === selectedCategory);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [catalog, selectedCategory, searchQuery, connections]);

  // Available connections for selected provider
  const providerConnections = useMemo(() => {
    if (!selectedProvider) return [];
    return connections.filter(
      (c) => c.provider_id === selectedProvider.id && isUsable({ status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result })
    );
  }, [selectedProvider, connections]);

  const handleSelectProvider = (prov: ProviderDefinition) => {
    setSelectedProvider(prov);
    // If workflow has 0 steps, default to trigger; otherwise default to action
    if (existingStepsCount === 0 && prov.triggers.length > 0) {
      setSelectedType('trigger');
      setSelectedItemKey(prov.triggers[0].key);
    } else if (prov.actions.length > 0) {
      setSelectedType('action');
      setSelectedItemKey(prov.actions[0].key);
    } else if (prov.triggers.length > 0) {
      setSelectedType('trigger');
      setSelectedItemKey(prov.triggers[0].key);
    }

    const conns = connections.filter(
      (c) => c.provider_id === prov.id && isUsable({ status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result })
    );
    if (conns.length > 0) {
      setSelectedConnectionId(conns[0].id);
    } else {
      setSelectedConnectionId('');
    }
  };

  const handleConfirmAdd = () => {
    if (!selectedProvider || !selectedItemKey) return;

    const isTrigger = selectedType === 'trigger';
    const triggerDef = selectedProvider.triggers.find((t) => t.key === selectedItemKey);
    const actionDef = selectedProvider.actions.find((a) => a.key === selectedItemKey);

    const stepName = isTrigger ? (triggerDef?.name || 'Trigger') : (actionDef?.name || 'Action');
    const stepDescription = isTrigger
      ? (triggerDef?.description || `Triggers on ${selectedProvider.name} event`)
      : (actionDef?.description || `Executes ${selectedProvider.name} action`);

    const stepKey = `${selectedProvider.id}_${selectedItemKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36).slice(-4)}`;

    const newStep: Partial<WorkflowStep> = {
      key: stepKey,
      displayName: stepName,
      name: `${selectedProvider.name}: ${stepName}`,
      purpose: stepDescription,
      application: selectedProvider.id,
      service: selectedProvider.id,
      stepType: isTrigger ? 'trigger' : 'action',
      userFacingExplanation: stepDescription,
      position: { x: existingStepsCount * 240 + 40, y: 60 },
      inputMapping: {},
      outputSchema: isTrigger ? (triggerDef?.outputSchema || {}) : (actionDef?.outputSchema || {}),
      configuration: {
        providerId: selectedProvider.id,
        connectionId: selectedConnectionId || undefined,
        triggerKey: isTrigger ? selectedItemKey : undefined,
        actionKey: !isTrigger ? selectedItemKey : undefined,
        requiredScopes: !isTrigger ? (actionDef?.requiredScopes || []) : [],
      },
      retryPolicy: {
        maxAttempts: 3,
        initialIntervalMs: 1000,
        backoffFactor: 2,
      },
      idempotencyPolicy: {
        enabled: true,
        keyTemplate: `${selectedProvider.id}:{{run.id}}:${stepKey}`,
      },
    };

    onAddStep(newStep);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="wb-scrim" role="dialog" aria-modal="true" aria-labelledby="add-step-title">
      <div
        style={{
          background: 'var(--navy)',
          border: '1px solid var(--gold)',
          borderRadius: '12px',
          width: '94%',
          maxWidth: '860px',
          height: '84vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: 'wbFadeIn .15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--navy2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(22, 38, 63, 0.98)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} color="var(--gold)" />
              <h2
                id="add-step-title"
                style={{
                  fontFamily: 'var(--font-h)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--light)',
                  margin: 0,
                }}
              >
                Add Workflow Step
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
              Choose a connected application, select a trigger or action, and link it into your execution canvas.
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

        {/* Modal Body: Split App Selection and Configuration */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left Column: Apps Catalog */}
          <div
            style={{
              width: '45%',
              borderRight: '1px solid var(--navy2)',
              display: 'flex',
              flexDirection: 'column',
              background: '#0E1724',
            }}
          >
            {/* Search and Category Filters */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--navy2)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--navy)',
                  border: '1px solid var(--navy2)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  marginBottom: '8px',
                }}
              >
                <Search size={14} color="var(--sub)" />
                <input
                  type="text"
                  placeholder="Search apps (e.g. Outlook, Xero, Slack)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--light)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                {(['All Apps', 'Connected', 'Accounting & Finance', 'CRM & Sales', 'Productivity', 'Communication'] as IntegrationCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        fontFamily: 'var(--font-m)',
                        fontSize: '9px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        border: '1px solid',
                        borderColor: selectedCategory === cat ? 'var(--gold)' : 'var(--navy2)',
                        background: selectedCategory === cat ? 'rgba(226, 181, 60, 0.15)' : 'transparent',
                        color: selectedCategory === cat ? 'var(--gold)' : 'var(--sub)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Apps List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {selectedCategory === 'Connected' && filteredProviders.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--sub)', fontSize: '12px' }}>
                  No apps are connected and verified yet.
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredProviders.map((p) => {
                  const isConn = connections.some(
                    (c) => c.provider_id === p.id && isUsable({ status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result })
                  );
                  const isSelected = selectedProvider?.id === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProvider(p)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: isSelected ? '#1E314D' : '#141F30',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--gold)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all .12s ease-out',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <IntegrationIcon slug={p.iconSlug} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--light)',
                              fontFamily: 'var(--font-h)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'var(--sub)',
                              fontFamily: 'var(--font-m)',
                            }}
                          >
                            {p.category}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isConn ? (
                          <span
                            style={{
                              fontSize: '9px',
                              color: 'var(--ok)',
                              fontFamily: 'var(--font-m)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--ok)' }} />
                            Connected
                          </span>
                        ) : p.availability === 'coming_soon' ? (
                          <span
                            style={{
                              fontSize: '9px',
                              color: 'var(--sub)',
                              background: 'rgba(255,255,255,0.06)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-m)',
                            }}
                          >
                            Coming soon
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '9px',
                              color: 'var(--sub)',
                              fontFamily: 'var(--font-m)',
                            }}
                          >
                            Available
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>

          {/* Right Column: Step Configuration (Trigger / Action / Connection) */}
          <div
            style={{
              width: '55%',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--navy)',
              padding: '16px 20px',
              overflowY: 'auto',
            }}
          >
            {selectedProvider ? (
              <div>
                {/* App summary */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '14px',
                    borderBottom: '1px solid var(--navy2)',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <IntegrationIcon slug={selectedProvider.iconSlug} size={36} />
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          color: 'var(--light)',
                          fontFamily: 'var(--font-h)',
                        }}
                      >
                        {selectedProvider.name}
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--sub)' }}>
                        {selectedProvider.description}
                      </p>
                    </div>
                  </div>

                  {/* Connect / Manage button if no connection */}
                  {providerConnections.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onConnectProvider && onConnectProvider(selectedProvider)}
                      style={{
                        background: 'var(--gold)',
                        color: 'var(--navy)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-m)',
                      }}
                    >
                      + Connect Account
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--ok)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'var(--font-m)',
                      }}
                    >
                      <CheckCircle2 size={14} /> Ready
                    </span>
                  )}
                </div>

                {/* Connection Account Selector */}
                {providerConnections.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: 'var(--sub)',
                        fontFamily: 'var(--font-m)',
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '.06em',
                      }}
                    >
                      Select Connected Account
                    </label>
                    <select
                      value={selectedConnectionId}
                      onChange={(e) => setSelectedConnectionId(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#121C2B',
                        border: '1px solid var(--navy2)',
                        borderRadius: '6px',
                        color: 'var(--light)',
                        padding: '8px 10px',
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
                  </div>
                )}

                {/* Type Selector (Trigger vs Action) */}
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      background: '#121C2B',
                      padding: '3px',
                      borderRadius: '8px',
                      border: '1px solid var(--navy2)',
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedType('action');
                        if (selectedProvider.actions.length > 0) {
                          setSelectedItemKey(selectedProvider.actions[0].key);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        border: 'none',
                        borderRadius: '6px',
                        background: selectedType === 'action' ? 'var(--gold)' : 'transparent',
                        color: selectedType === 'action' ? 'var(--navy)' : 'var(--sub)',
                        fontFamily: 'var(--font-m)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Actions ({selectedProvider.actions.length})
                    </button>
                    <button
                      onClick={() => {
                        setSelectedType('trigger');
                        if (selectedProvider.triggers.length > 0) {
                          setSelectedItemKey(selectedProvider.triggers[0].key);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        border: 'none',
                        borderRadius: '6px',
                        background: selectedType === 'trigger' ? 'var(--gold)' : 'transparent',
                        color: selectedType === 'trigger' ? 'var(--navy)' : 'var(--sub)',
                        fontFamily: 'var(--font-m)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Triggers ({selectedProvider.triggers.length})
                    </button>
                  </div>
                </div>

                {/* List of Triggers or Actions */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--sub)',
                      fontFamily: 'var(--font-m)',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                    }}
                  >
                    Choose {selectedType === 'trigger' ? 'Trigger Event' : 'Action'}
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(selectedType === 'trigger' ? selectedProvider.triggers : selectedProvider.actions).map(
                      (item: any) => {
                        const isChosen = selectedItemKey === item.key;
                        return (
                          <div
                            key={item.key}
                            onClick={() => setSelectedItemKey(item.key)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isChosen ? 'var(--gold)' : 'var(--navy2)',
                              background: isChosen ? '#1F304B' : '#141D2C',
                              cursor: 'pointer',
                              transition: 'all .12s ease-out',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '2px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: 'var(--light)',
                                  fontFamily: 'var(--font-h)',
                                }}
                              >
                                {item.name}
                              </span>
                              {isChosen && <CheckCircle2 size={14} color="var(--gold)" />}
                            </div>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--sub)' }}>
                              {item.description}
                            </p>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--sub)',
                }}
              >
                <Layers size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>Select an application from the left</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                  Choose Microsoft, Google, Xero, Slack, or any business connector.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--navy2)',
            background: 'var(--navy)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--sub)', fontFamily: 'var(--font-m)' }}>
            {selectedProvider && selectedItemKey ? (
              <span>
                Adding <strong>{selectedProvider.name}</strong> &rarr;{' '}
                {selectedType === 'trigger' ? 'Trigger' : 'Action'}
              </span>
            ) : (
              'Choose an app and operation to add to canvas'
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--navy2)',
                color: 'var(--light)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              disabled={!selectedProvider || !selectedItemKey}
              onClick={handleConfirmAdd}
              style={{
                background: selectedProvider && selectedItemKey ? 'var(--gold)' : 'var(--navy2)',
                color: selectedProvider && selectedItemKey ? 'var(--navy)' : 'var(--sub)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 18px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: selectedProvider && selectedItemKey ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-m)',
              }}
            >
              Add Step to Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
