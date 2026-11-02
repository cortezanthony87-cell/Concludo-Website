import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrightIcon } from './BrightIcons';
import '../../../../styles/connectivity-bright.css';

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: 'active' | 'revoked';
}

export const ApiAccessBrightView: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    {
      id: 'k_1',
      name: 'Executive Reporting Script',
      prefix: 'cnc_live_9f2a',
      createdAt: '12 Oct 2026',
      lastUsedAt: 'Today 09:15',
      status: 'active',
    },
    {
      id: 'k_2',
      name: 'Staging CI Tester',
      prefix: 'cnc_test_41c0',
      createdAt: '28 Sep 2026',
      lastUsedAt: '3 days ago',
      status: 'active',
    },
  ]);

  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    const randomHex = Math.random().toString(36).substring(2, 10);
    const fullKey = `cnc_live_${randomHex}${Math.random().toString(36).substring(2, 18)}`;
    setKeys((prev) => [
      ...prev,
      {
        id: 'k_' + Date.now(),
        name: newKeyName,
        prefix: `cnc_live_${randomHex.substring(0, 4)}`,
        createdAt: 'Just now',
        lastUsedAt: 'Never',
        status: 'active',
      },
    ]);
    setGeneratedKey(fullKey);
    setNewKeyName('');
  };

  const endpoints = [
    ['projects', 'Projects and conversation transcripts metadata'],
    ['outputs', 'Finished meeting summaries, executive briefs and reports'],
    ['decisions', 'Authoritative decision log records'],
    ['actions', 'Action tracker items, assignees, due dates and status'],
    ['reports', 'Generated endpoint executive health reports'],
    ['insights', 'Aggregated collaboration diagnostic findings'],
  ];

  return (
    <div className="cn-shell">
      {/* Header */}
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div className="mono eyebrow" style={{ color: 'var(--blue)', marginBottom: '4px' }}>Developer platform</div>
          <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBottom: '6px' }}>Public API and keys</h1>
          <p className="sub" style={{ color: 'var(--slate)', maxWidth: '62ch', fontSize: '14.5px' }}>
            Read your own Concludo data from your own internal systems. Keys are SHA-256 hashed and isolated to your organisation.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="tabs" aria-label="Connectivity sections" style={{ marginBottom: '22px' }}>
        <Link to="/integrations">
          <BrightIcon name="plug" />
          <span>Connect App</span>
        </Link>
        <Link to="/automation-export">
          <BrightIcon name="send" />
          <span>Automation Export</span>
          <span className="tag">Pro / Team</span>
        </Link>
        <Link to="/webhooks">
          <BrightIcon name="hook" />
          <span>Webhooks</span>
          <span className="tag">Pro / Team</span>
        </Link>
        <Link to="/api" className="on">
          <BrightIcon name="key" />
          <span>Public API</span>
          <span className="tag">Pro / Team</span>
        </Link>
        <Link to="/endpoint-report">
          <BrightIcon name="doc" />
          <span>Endpoint Report</span>
          <span className="tag">Pro / Team</span>
        </Link>
      </nav>

      {/* New Key Notice */}
      {generatedKey && (
        <div className="box good" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', background: '#F3FAF6', border: '1px solid var(--green)', borderRadius: '16px', padding: '18px 20px', marginBottom: '24px' }}>
          <div style={{ color: 'var(--green)', marginTop: '2px' }}>
            <BrightIcon name="check" style={{ width: '22px', height: '22px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '15px', color: 'var(--green)', margin: '0 0 4px 0' }}>New API Key generated</h4>
            <p style={{ color: 'var(--navy)', fontSize: '13.5px', margin: '0 0 10px 0' }}>
              Copy your key now. Concludo stores only the SHA-256 hash and cannot show this secret to you again.
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <code style={{ background: '#fff', border: '1px solid var(--line2)', padding: '6px 12px', borderRadius: '8px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: 'var(--navy)', flex: 1, maxWidth: '480px' }}>
                {generatedKey}
              </code>
              <button
                type="button"
                className="btn gold"
                style={{ padding: '6px 14px', fontSize: '12.5px' }}
                onClick={() => {
                  navigator.clipboard?.writeText(generatedKey);
                  showToast('API key copied to clipboard');
                }}
              >
                Copy key
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '6px 14px', fontSize: '12.5px' }}
                onClick={() => setGeneratedKey(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys Table Panel */}
      <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
        <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
          <h2 style={{ fontSize: '17px', margin: 0 }}>Your keys</h2>
          <span className="chip ok" style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: '#E4F4EB', color: 'var(--green)' }}>
            {keys.length} active
          </span>
        </div>
        <div className="pb" style={{ padding: '0' }}>
          <table className="tbl stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--light)' }}>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Name</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Key prefix</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Created</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Last used</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} style={{ borderTop: '1px solid var(--line2)' }}>
                  <td data-l="Name" style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--navy)' }}>
                    {k.name}
                  </td>
                  <td data-l="Prefix" style={{ padding: '14px 18px' }}>
                    <code style={{ background: 'var(--light)', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: 'var(--slate)' }}>
                      {k.prefix}...
                    </code>
                  </td>
                  <td data-l="Created" style={{ padding: '14px 18px', color: 'var(--slate)', fontSize: '13px' }}>
                    {k.createdAt}
                  </td>
                  <td data-l="Last used" style={{ padding: '14px 18px', color: 'var(--slate)', fontSize: '13px' }}>
                    {k.lastUsedAt}
                  </td>
                  <td data-l="Action" style={{ padding: '14px 18px' }}>
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--red)' }}
                      onClick={() => {
                        setKeys((prev) => prev.filter((item) => item.id !== k.id));
                        showToast(`Revoked key: ${k.name}`);
                      }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two columns: Create new key and Try a request */}
      <div className="two" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Create Key Form */}
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
          <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
            <h2 style={{ fontSize: '17px', margin: 0 }}>Create API key</h2>
          </div>
          <form onSubmit={handleCreateKey} className="pb" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="kv">
              <label htmlFor="key-name" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy2)', marginBottom: '6px' }}>
                Key label or service name
              </label>
              <input
                id="key-name"
                className="inp"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. BI Dashboard, Python CLI Sync"
                required
                style={{ width: '100%', minHeight: '44px', border: '1px solid var(--line)', borderRadius: '12px', padding: '10px 14px' }}
              />
            </div>
            <button type="submit" className="btn gold" style={{ marginTop: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600 }}>
              <BrightIcon name="key" />
              <span>Generate key</span>
            </button>
          </form>
        </section>

        {/* Curl Tester */}
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
          <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
            <h2 style={{ fontSize: '17px', margin: 0 }}>Try a request</h2>
          </div>
          <div className="pb" style={{ padding: '18px 20px' }}>
            <div className="codeblock" style={{ background: 'var(--navy)', color: '#E8EEF8', padding: '16px 18px', borderRadius: '14px', fontSize: '12px', fontFamily: '"IBM Plex Mono", monospace', lineHeight: 1.6 }}>
              <div><span style={{ color: 'var(--gold)' }}>curl</span> https://app.concludo.com.au/api/v1/decisions \</div>
              <div>  -H <span style={{ color: '#A1C2FA' }}>&quot;Authorization: Bearer cnc_live_...&quot;</span></div>
            </div>
            <p className="help" style={{ color: 'var(--slate)', fontSize: '12.5px', marginTop: '10px' }}>
              Returns standard JSON with cursor-based pagination and ISO 8601 timestamps.
            </p>
          </div>
        </section>
      </div>

      {/* Endpoints Documentation */}
      <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)', marginTop: '24px' }}>
        <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
          <h2 style={{ fontSize: '17px', margin: 0 }}>Available endpoints</h2>
        </div>
        <div className="pb" style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {endpoints.map(([ep, desc]) => (
            <div key={ep} style={{ border: '1px solid var(--line2)', borderRadius: '12px', padding: '12px 14px', background: 'var(--light)' }}>
              <code style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>/api/v1/{ep}</code>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--slate)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Toast */}
      {toastMessage && (
        <div
          className="toast on"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '24px',
            transform: 'translateX(-50%)',
            background: 'var(--navy)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(22,38,63,.25)',
            zIndex: 100,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Footer */}
      <div className="foot" style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid var(--line2)', color: 'var(--slate)', fontSize: '12.5px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.6 }}>
        Concludo is an independent product. It is not affiliated with, endorsed by, or sponsored by Microsoft, Google, Notion, Slack, Xero, Wix, or any other integration partner. All trademarks belong to their respective owners.
      </div>
    </div>
  );
};
