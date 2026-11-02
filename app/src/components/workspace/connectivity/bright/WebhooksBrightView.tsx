import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrightIcon } from './BrightIcons';
import '../../../../styles/connectivity-bright.css';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  lastDelivery: string;
  status: 'ok' | 'failed' | 'idle';
  latency: string;
}

export const WebhooksBrightView: React.FC = () => {
  const navigate = useNavigate();

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([
    {
      id: 'wh_1',
      name: 'Ops channel',
      url: 'https://example.com.au/hooks/concludo',
      events: ['action_created', 'decision_created'],
      lastDelivery: '2 min ago',
      status: 'ok',
      latency: '180 ms',
    },
    {
      id: 'wh_2',
      name: 'Finance sync',
      url: 'https://example.com.au/hooks/finance',
      events: ['report_generated'],
      lastDelivery: 'Yesterday',
      status: 'ok',
      latency: '240 ms',
    },
  ]);

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['action_created', 'decision_created']);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const allAvailableEvents = [
    'action_created',
    'action_completed',
    'decision_created',
    'report_generated',
    'project_created',
  ];

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    const newSecret = 'whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setEndpoints((prev) => [
      ...prev,
      {
        id: 'wh_' + Date.now(),
        name,
        url,
        events: selectedEvents,
        lastDelivery: 'Just now',
        status: 'ok',
        latency: 'Pending ping',
      },
    ]);
    setCreatedSecret(newSecret);
    setName('');
    setUrl('');
  };

  return (
    <div className="cn-shell">
      {/* Header */}
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div className="mono eyebrow" style={{ color: 'var(--blue)', marginBottom: '4px' }}>Connectivity</div>
          <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBottom: '6px' }}>Webhooks and event streams</h1>
          <p className="sub" style={{ color: 'var(--slate)', maxWidth: '62ch', fontSize: '14.5px' }}>
            Send signed events to your own systems when work is approved. Each delivery is logged so you can see what was sent and what came back.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn ghost" onClick={() => showToast('Documentation link')}>
            <BrightIcon name="doc" />
            <span>Payload docs</span>
          </button>
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
        <Link to="/webhooks" className="on">
          <BrightIcon name="hook" />
          <span>Webhooks</span>
          <span className="tag">Pro / Team</span>
        </Link>
        <Link to="/api">
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

      {/* Secret Notice Modal */}
      {createdSecret && (
        <div
          className="modal"
          style={{
            background: '#fff',
            border: '1px solid var(--gold)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow), var(--glow-gold)',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
            <div className="tile" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(30,122,76,.15)', color: 'var(--green)', display: 'grid', placeItems: 'center' }}>
              <BrightIcon name="shield" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--navy)', margin: 0 }}>Save your webhook signing secret</h3>
              <div style={{ fontSize: '13px', color: 'var(--slate)' }}>
                This secret is shown only once. Store it in your backend environment variables.
              </div>
            </div>
          </div>
          <div className="codeblock" style={{ background: 'var(--navy)', color: '#E8EEF8', padding: '14px 18px', borderRadius: '12px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <code>{createdSecret}</code>
            <button
              type="button"
              className="btn gold"
              style={{ padding: '4px 12px', fontSize: '12px' }}
              onClick={() => {
                navigator.clipboard?.writeText(createdSecret);
                showToast('Secret copied to clipboard');
              }}
            >
              Copy
            </button>
          </div>
          <button className="btn navy" onClick={() => setCreatedSecret(null)} style={{ padding: '8px 16px', fontSize: '13.5px' }}>
            Done, I have saved the secret
          </button>
        </div>
      )}

      {/* Endpoints Table Panel */}
      <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
        <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
          <h2 style={{ fontSize: '17px', margin: 0 }}>Your endpoints</h2>
          <span className="chip ok" style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: '#E4F4EB', color: 'var(--green)' }}>
            {endpoints.length} active
          </span>
        </div>
        <div className="pb" style={{ padding: '0' }}>
          <table className="tbl stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--light)' }}>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Name</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Endpoint</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Events</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Last delivery</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id} style={{ borderTop: '1px solid var(--line2)' }}>
                  <td data-l="Name" style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--navy)' }}>
                    {ep.name}
                  </td>
                  <td data-l="Endpoint" style={{ padding: '14px 18px' }}>
                    <code style={{ background: 'var(--light)', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: 'var(--blue)' }}>
                      {ep.url}
                    </code>
                  </td>
                  <td data-l="Events" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {ep.events.map((ev) => (
                        <span key={ev} className="ev" style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', background: '#EEF2FA', padding: '2px 6px', borderRadius: '4px', color: 'var(--navy)' }}>
                          {ev}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-l="Last delivery" style={{ padding: '14px 18px', color: 'var(--slate)', fontSize: '13px' }}>
                    {ep.lastDelivery}
                  </td>
                  <td data-l="Status" style={{ padding: '14px 18px' }}>
                    <span className="chip ok" style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: '#E4F4EB', color: 'var(--green)' }}>
                      200 OK &bull; {ep.latency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two Columns: Create Form and Signature Guide */}
      <div className="two" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Create Form */}
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
          <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
            <h2 style={{ fontSize: '17px', margin: 0 }}>Create a webhook</h2>
          </div>
          <form onSubmit={handleCreate} className="pb" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="kv">
              <label htmlFor="wh-name" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy2)', marginBottom: '6px' }}>
                Name
              </label>
              <input
                id="wh-name"
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ops channel, Customer sync"
                required
                style={{ width: '100%', minHeight: '44px', border: '1px solid var(--line)', borderRadius: '12px', padding: '10px 14px' }}
              />
            </div>
            <div className="kv">
              <label htmlFor="wh-url" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy2)', marginBottom: '6px' }}>
                Endpoint URL
              </label>
              <input
                id="wh-url"
                type="url"
                className="inp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourdomain.com.au/api/webhook"
                required
                style={{ width: '100%', minHeight: '44px', border: '1px solid var(--line)', borderRadius: '12px', padding: '10px 14px' }}
              />
              <span className="help" style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', display: 'block' }}>
                Must be an HTTPS endpoint capable of responding with a 2xx status code.
              </span>
            </div>
            <div className="kv">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy2)', marginBottom: '6px' }}>
                Events to dispatch
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {allAvailableEvents.map((ev) => {
                  const on = selectedEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      style={{
                        fontFamily: '"IBM Plex Mono", monospace',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: on ? 'var(--gold)' : 'var(--line2)',
                        background: on ? '#FFFBEF' : '#fff',
                        color: on ? 'var(--navy)' : 'var(--slate)',
                      }}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="submit" className="btn gold" style={{ marginTop: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600 }}>
              <BrightIcon name="check" />
              <span>Create and show secret once</span>
            </button>
          </form>
        </section>

        {/* Signing Guide */}
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
          <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
            <h2 style={{ fontSize: '17px', margin: 0 }}>How we sign each delivery</h2>
          </div>
          <div className="pb" style={{ padding: '18px 20px' }}>
            <p className="help" style={{ color: 'var(--slate)', fontSize: '13.5px', marginBottom: '14px' }}>
              Every outgoing HTTP POST request carries signature headers computed using HMAC-SHA256 with your endpoint secret.
            </p>
            <div className="codeblock" style={{ background: 'var(--navy)', color: '#E8EEF8', padding: '16px 18px', borderRadius: '14px', fontSize: '12.5px', fontFamily: '"IBM Plex Mono", monospace' }}>
              <div><span style={{ color: 'var(--gold)' }}>X-Concludo-Signature</span>: sha256=a89f41...</div>
              <div><span style={{ color: 'var(--gold)' }}>X-Concludo-Timestamp</span>: 1793529600</div>
              <div><span style={{ color: 'var(--gold)' }}>X-Concludo-Event</span>: action_created</div>
              <div><span style={{ color: 'var(--gold)' }}>Content-Type</span>: application/json</div>
            </div>
            <div className="box info" style={{ border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 16px', background: '#fff', marginTop: '14px' }}>
              <h4 style={{ fontSize: '14px', color: 'var(--navy)', marginBottom: '4px' }}>Zero sensitive tokens leaked</h4>
              <p className="help" style={{ color: 'var(--slate)', fontSize: '13px', margin: 0 }}>
                Deliveries never contain access tokens or authentication secrets. Payload bodies contain only the approved task, decision, or brief metadata.
              </p>
            </div>
          </div>
        </section>
      </div>

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
