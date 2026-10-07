import React from 'react';
import { IntegrationConnection } from '../../lib/integrations/hubRegistry';
import { isUsable, describeStatus, ConnectionEvidence } from '../../lib/integrations/connectionStatus';
import { IntegrationIcon } from '../integrations/IntegrationIcon';
import { Plus } from 'lucide-react';

export interface ConnectedAppsStripProps {
  connections: IntegrationConnection[];
  onConnectAnotherApp: () => void;
}

export const ConnectedAppsStrip: React.FC<ConnectedAppsStripProps> = ({
  connections,
  onConnectAnotherApp,
}) => {
  // Filter active connections
  const activeConnections = connections.filter((c) => c.status !== 'disconnected');

  return (
    <div className="wb-connected-apps-strip" style={{ width: '100%' }}>
      <div
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-m)',
          color: 'var(--sub)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '10px',
        }}
      >
        Concludo can use
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px 10px',
        }}
      >
        {/* Grouped Concludo chip */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--navy2)',
            borderRadius: '999px',
            fontSize: '12px',
            color: 'var(--light)',
            fontFamily: 'var(--font-b)',
            lineHeight: 1.4,
          }}
          title="Internal services: Projects, Calendar, and Approval Centre"
        >
          <span
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--navy)',
              color: 'var(--gold)',
              fontSize: '10px',
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-m)',
            }}
          >
            C
          </span>
          <span>Concludo: Projects, Calendar, Approvals</span>
        </div>

        {/* Real connected user accounts */}
        {activeConnections.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--navy2)',
              borderRadius: '999px',
              fontSize: '12px',
              color: 'var(--light)',
              fontFamily: 'var(--font-b)',
              lineHeight: 1.4,
            }}
            title={(() => {
            const ev = { status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result };
            const meta = describeStatus(ev);
            const accountLabel = (c as any).account_label || 'Account not confirmed';
            return `${c.connection_name} (${accountLabel}) · ${meta.label}`;
          })()}
          >
            <IntegrationIcon slug={c.provider_id} size={16} />
            <span>{c.connection_name}</span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background:
                  (() => {
                    const meta = describeStatus({ status: c.status, verified_at: (c as any).verified_at, last_test_at: (c as any).last_test_at, last_test_result: (c as any).last_test_result });
                    return meta.tone === 'ok' ? 'var(--ok)' : meta.tone === 'attention' ? 'var(--warn)' : 'var(--bad)';
                  })(),
              }}
            />
          </div>
        ))}

        {/* Connect another app link */}
        <button
          type="button"
          onClick={onConnectAnotherApp}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            background: 'transparent',
            border: '1px dashed var(--gold)',
            borderRadius: '999px',
            fontSize: '11.5px',
            color: 'var(--gold)',
            fontFamily: 'var(--font-m)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={13} />
          <span>Connect another app</span>
        </button>
      </div>
    </div>
  );
};
