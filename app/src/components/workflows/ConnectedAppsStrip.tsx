import React from 'react';
import { IntegrationConnection } from '../../lib/integrations/hubRegistry';
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
    <div
      className="wb-connected-apps-strip"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-m)',
          color: 'var(--sub)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginRight: '4px',
        }}
      >
        Concludo can use:
      </span>

      {/* Grouped Concludo chip */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--navy2)',
          borderRadius: '999px',
          fontSize: '11.5px',
          color: 'var(--light)',
          fontFamily: 'var(--font-b)',
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
            gap: '6px',
            padding: '4px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--navy2)',
            borderRadius: '999px',
            fontSize: '11.5px',
            color: 'var(--light)',
            fontFamily: 'var(--font-b)',
          }}
          title={`${c.connection_name} (${c.external_account_reference || ''}) · ${c.status}`}
        >
          <IntegrationIcon slug={c.provider_id} size={16} />
          <span>{c.connection_name}</span>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background:
                c.status === 'connected'
                  ? 'var(--ok)'
                  : c.status === 'needs_reauth'
                  ? 'var(--warn)'
                  : 'var(--bad)',
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
          gap: '4px',
          padding: '4px 10px',
          background: 'transparent',
          border: '1px dashed var(--gold)',
          borderRadius: '999px',
          fontSize: '11px',
          color: 'var(--gold)',
          fontFamily: 'var(--font-m)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Plus size={12} />
        <span>Connect another app</span>
      </button>
    </div>
  );
};
