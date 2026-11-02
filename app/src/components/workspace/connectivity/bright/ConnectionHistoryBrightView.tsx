import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrightIcon } from './BrightIcons';
import '../../../../styles/connectivity-bright.css';

export interface HistoryEventItem {
  when: string;
  app: string;
  event: string;
  status: 'ok' | 'failed' | 'warn';
  statusText: string;
  items: string;
  duration: string;
}

export const ConnectionHistoryBrightView: React.FC = () => {
  const navigate = useNavigate();

  const [events] = useState<HistoryEventItem[]>([
    {
      when: 'Today 10:42',
      app: 'Microsoft To Do',
      event: 'Export actions',
      status: 'ok',
      statusText: 'Completed',
      items: '3 of 3 items exported',
      duration: '1.2 s',
    },
    {
      when: 'Today 10:31',
      app: 'Outlook Calendar',
      event: 'Token refresh',
      status: 'ok',
      statusText: 'Refreshed',
      items: 'Session extended',
      duration: '0.4 s',
    },
    {
      when: 'Yesterday',
      app: 'Slack',
      event: 'Export brief',
      status: 'warn',
      statusText: 'Post blocked by app',
      items: 'Channel permissions needed',
      duration: '0.8 s',
    },
    {
      when: '28 Oct',
      app: 'Google Tasks',
      event: 'Export actions',
      status: 'ok',
      statusText: 'Completed',
      items: '5 of 5 items exported',
      duration: '1.5 s',
    },
  ]);

  return (
    <div className="cn-shell">
      {/* Header */}
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div className="mono eyebrow" style={{ color: 'var(--blue)', marginBottom: '4px' }}>Connectivity</div>
          <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBottom: '6px' }}>Connection history</h1>
          <p className="sub" style={{ color: 'var(--slate)', maxWidth: '62ch', fontSize: '14.5px' }}>
            Every connection event, token refresh, and export dispatch in one place. Nothing here contains a password or key.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn ghost" onClick={() => navigate('/integrations')}>
            <BrightIcon name="plug" />
            <span>Back to apps</span>
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
        <Link to="/webhooks">
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

      {/* Events Panel */}
      <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
        <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
          <h2 style={{ fontSize: '17px', margin: 0 }}>Recent connection events</h2>
          <span className="chip ok" style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: '#E4F4EB', color: 'var(--green)' }}>
            Audit verified
          </span>
        </div>
        <div className="pb" style={{ padding: '0' }}>
          <table className="tbl stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--light)' }}>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>When</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Application</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Event</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Status</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Details</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line2)' }}>
                  <td data-l="When" style={{ padding: '14px 18px', color: 'var(--slate)', fontSize: '13px' }}>
                    {ev.when}
                  </td>
                  <td data-l="App" style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--navy)' }}>
                    {ev.app}
                  </td>
                  <td data-l="Event" style={{ padding: '14px 18px', color: 'var(--navy2)', fontSize: '13px' }}>
                    {ev.event}
                  </td>
                  <td data-l="Status" style={{ padding: '14px 18px' }}>
                    <span
                      className={`chip ${ev.status}`}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '99px',
                        background: ev.status === 'ok' ? '#E4F4EB' : '#FDF1D4',
                        color: ev.status === 'ok' ? 'var(--green)' : 'var(--amber)',
                      }}
                    >
                      {ev.statusText}
                    </span>
                  </td>
                  <td data-l="Details" style={{ padding: '14px 18px', color: 'var(--slate)', fontSize: '13px' }}>
                    {ev.items}
                  </td>
                  <td data-l="Duration" style={{ padding: '14px 18px', color: 'var(--slate)', fontSize: '12.5px', fontFamily: '"IBM Plex Mono", monospace' }}>
                    {ev.duration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <div className="foot" style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid var(--line2)', color: 'var(--slate)', fontSize: '12.5px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.6 }}>
        Concludo is an independent product. It is not affiliated with, endorsed by, or sponsored by Microsoft, Google, Notion, Slack, Xero, Wix, or any other integration partner. All trademarks belong to their respective owners.
      </div>
    </div>
  );
};
