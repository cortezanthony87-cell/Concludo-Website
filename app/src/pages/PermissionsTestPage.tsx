import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Lock,
  Unlock,
  Check,
  X,
  Server,
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import {
  ALL_FEATURE_KEYS,
  FEATURE_LABELS,
  PLAN_PERMISSIONS,
  FEATURE_TIER_BADGES,
  PlanType,
  FeatureKey,
} from '../lib/permissions/types';

export const PermissionsTestPage: React.FC = () => {
  const { profile, session } = useAuth();

  const currentPlan: PlanType = (profile?.plan as PlanType) || 'free_preview';
  const [selectedPlanView, setSelectedPlanView] = useState<PlanType>(currentPlan);

  // Live API test state
  const [testFeature, setTestFeature] = useState<FeatureKey>('saved_projects');
  const [apiTesting, setApiTesting] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any>(null);

  const testPlans: PlanType[] = ['free_preview', 'starter', 'pro', 'team', 'admin'];

  const runLiveApiCheck = async () => {
    setApiTesting(true);
    setApiResponse(null);

    try {
      const token = session?.access_token;
      const res = await fetch('/api/features/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ feature: testFeature }),
      });

      const data = await res.json();
      setApiResponse({
        statusCode: res.status,
        ok: res.ok,
        data,
      });
    } catch (err: any) {
      setApiResponse({
        statusCode: 500,
        ok: false,
        data: { error: 'client_error', message: err.message },
      });
    } finally {
      setApiTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px' }}>
      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>DEVELOPER DIAGNOSTICS</span>
        </div>
        <h1 className="page-title">Feature Permissions & Server Access Matrix</h1>
        <p className="page-subtitle">
          Verify server-authoritative feature gating, plan permissions, and locked states.
        </p>
      </div>

      {/* Current User Session Status */}
      <div className="content-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active User Session
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
              {profile?.email || 'Authenticated User'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Database Profile Plan:</span>
            <span
              style={{
                background: 'rgba(226, 181, 60, 0.2)',
                color: '#f3c958',
                border: '1px solid rgba(226, 181, 60, 0.4)',
                padding: '4px 12px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '0.82rem',
                textTransform: 'uppercase',
              }}
            >
              {currentPlan}
            </span>
          </div>
        </div>
      </div>

      {/* Live Server Endpoint Test */}
      <div className="content-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Server size={20} color="#f3c958" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Test Live Backend API Protection</h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
          Calls <code>POST /api/features/check</code> with your session bearer token. The backend authoritatively verifies your plan against the database and returns HTTP 200 or HTTP 403 Forbidden.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
          <select
            className="form-select"
            value={testFeature}
            onChange={(e) => setTestFeature(e.target.value as FeatureKey)}
            style={{ maxWidth: '280px' }}
          >
            {ALL_FEATURE_KEYS.map((key) => (
              <option key={key} value={key}>
                {FEATURE_LABELS[key]} ({key})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-gold"
            onClick={runLiveApiCheck}
            disabled={apiTesting}
            style={{ padding: '9px 18px' }}
          >
            {apiTesting ? (
              <>
                <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Verify Access on Server</span>
              </>
            )}
          </button>
        </div>

        {apiResponse && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '10px',
              background: apiResponse.ok ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${apiResponse.ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {apiResponse.ok ? (
                <CheckCircle2 size={18} color="#22c55e" />
              ) : (
                <AlertCircle size={18} color="#ef4444" />
              )}
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: apiResponse.ok ? '#86efac' : '#fca5a5',
                }}
              >
                HTTP {apiResponse.statusCode} {apiResponse.ok ? 'OK (Allowed)' : 'Forbidden (Denied)'}
              </span>
            </div>
            <pre
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                color: '#e2e8f0',
                overflowX: 'auto',
                margin: 0,
              }}
            >
              {JSON.stringify(apiResponse.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Plan Permission Matrix Viewer */}
      <div className="content-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Plan Permission Matrix</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '2px' }}>
              Inspect feature accessibility across tiers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {testPlans.map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => setSelectedPlanView(plan)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: selectedPlanView === plan ? '1px solid #e2b53c' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: selectedPlanView === plan ? 'rgba(226, 181, 60, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: selectedPlanView === plan ? '#f3c958' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Feature Key</th>
                <th style={{ padding: '10px 12px' }}>Label</th>
                <th style={{ padding: '10px 12px' }}>Tier Badge</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>
                  Status on <span style={{ color: '#f3c958', textTransform: 'uppercase' }}>{selectedPlanView}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ALL_FEATURE_KEYS.map((key) => {
                const isAllowedOnPlan = PLAN_PERMISSIONS[selectedPlanView]?.includes(key);
                const badge = FEATURE_TIER_BADGES[key] || 'Upgrade required';

                return (
                  <tr
                    key={key}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isAllowedOnPlan ? 'transparent' : 'rgba(239, 68, 68, 0.02)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                      {key}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 500 }}>
                      {FEATURE_LABELS[key]}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: badge === 'Available on Team' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(226, 181, 60, 0.15)',
                          color: badge === 'Available on Team' ? '#60a5fa' : '#f3c958',
                          border: `1px solid ${badge === 'Available on Team' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(226, 181, 60, 0.3)'}`,
                        }}
                      >
                        {badge}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {isAllowedOnPlan ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#4ade80',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                          }}
                        >
                          <Unlock size={14} />
                          <span>Allowed</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#f87171',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                          }}
                        >
                          <Lock size={14} />
                          <span>Locked</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
