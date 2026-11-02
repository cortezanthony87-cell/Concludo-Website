import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrightIcon } from './BrightIcons';
import '../../../../styles/connectivity-bright.css';

export interface EndpointReportBrightViewProps {
  isStarterTier?: boolean;
}

export const EndpointReportBrightView: React.FC<EndpointReportBrightViewProps> = ({
  isStarterTier = false,
}) => {
  const [period, setPeriod] = useState<string>('All time');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      showToast('New executive endpoint report compiled');
    }, 1200);
  };

  return (
    <div className="cn-shell">
      {/* Header */}
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div className="mono eyebrow" style={{ color: 'var(--blue)', marginBottom: '4px' }}>Connectivity</div>
          <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBottom: '6px' }}>Endpoint reports</h1>
          <p className="sub" style={{ color: 'var(--slate)', maxWidth: '62ch', fontSize: '14.5px' }}>
            Boardroom-ready reports built from your approved work, for any period you choose.
          </p>
        </div>
        {!isStarterTier && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn gold"
              disabled={isGenerating}
              onClick={handleGenerate}
              style={{ padding: '10px 18px', fontSize: '14px', fontWeight: 600 }}
            >
              <BrightIcon name="chart" />
              <span>{isGenerating ? 'Compiling report...' : 'Generate report'}</span>
            </button>
          </div>
        )}
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
        <Link to="/endpoint-report" className="on">
          <BrightIcon name="doc" />
          <span>Endpoint Report</span>
          <span className="tag">Pro / Team</span>
        </Link>
      </nav>

      {/* If Starter tier: Render the authentic upgrade gate card from mockup 09 */}
      {isStarterTier ? (
        <div
          className="gate"
          style={{
            maxWidth: '640px',
            margin: '36px auto',
            textAlign: 'center',
            background: '#fff',
            border: '1px solid var(--gold)',
            borderRadius: '20px',
            padding: '38px 30px',
            boxShadow: 'var(--shadow), var(--glow-gold)',
          }}
        >
          <div
            className="ring"
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              margin: '0 auto 16px',
              display: 'grid',
              placeItems: 'center',
              background: '#FFF8E0',
              border: '2px solid var(--gold)',
              color: 'var(--amber)',
            }}
          >
            <BrightIcon name="lock" style={{ width: '28px', height: '28px' }} />
          </div>
          <span
            className="chip soon"
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '99px',
              background: '#EEF1F6',
              color: 'var(--slate)',
              marginBottom: '12px',
            }}
          >
            Included in Pro and Team
          </span>
          <h2 style={{ fontSize: '22px', color: 'var(--navy)', marginBottom: '8px' }}>
            Boardroom-ready executive reports
          </h2>
          <p style={{ color: 'var(--slate)', maxWidth: '440px', margin: '0 auto 20px auto', fontSize: '14px', lineHeight: 1.5 }}>
            Automate weekly or monthly reporting packs across all connected departments. Never hand-assemble status reports again.
          </p>
          <Link
            to="/pricing"
            className="btn gold"
            style={{ display: 'inline-flex', padding: '10px 22px', fontSize: '14px', fontWeight: 600 }}
          >
            Upgrade to Pro
          </Link>
        </div>
      ) : (
        /* If Pro or Team: Render the full boardroom report view from mockup 19 */
        <>
          {/* Period selector */}
          <div
            className="per"
            role="group"
            aria-label="Period"
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '12px',
              marginBottom: '20px',
            }}
          >
            {['All time', 'This month', 'Last 30 days', 'This quarter', 'Year to date'].map((p) => (
              <button
                key={p}
                type="button"
                className={`cat ${period === p ? 'on' : ''}`}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '99px',
                  background: period === p ? 'var(--gold)' : '#fff',
                  border: '1px solid',
                  borderColor: period === p ? 'var(--gold2)' : 'var(--line2)',
                  color: 'var(--navy)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Stats tiles */}
          <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '22px' }}>
            <div className="stat">
              <div className="n" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--navy)' }}>24</div>
              <div className="l" style={{ color: 'var(--slate)', fontSize: '13px' }}>Total sessions</div>
            </div>
            <div className="stat">
              <div className="n" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--blue)' }}>38</div>
              <div className="l" style={{ color: 'var(--slate)', fontSize: '13px' }}>Decisions logged</div>
            </div>
            <div className="stat g">
              <div className="n" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--green)' }}>71</div>
              <div className="l" style={{ color: 'var(--slate)', fontSize: '13px' }}>Actions completed</div>
            </div>
            <div className="stat a">
              <div className="n" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--amber)' }}>4</div>
              <div className="l" style={{ color: 'var(--slate)', fontSize: '13px' }}>Blocked items</div>
            </div>
          </div>

          {/* Action progress distribution */}
          <div className="two" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
              <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
                <h2 style={{ fontSize: '17px', margin: 0 }}>Key decisions this period</h2>
              </div>
              <div className="pb" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ borderLeft: '3px solid var(--blue)', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--navy)' }}>
                    Move launch review to Friday
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate)' }}>
                    Commercial launch readiness confirmed
                  </div>
                </div>
                <div style={{ borderLeft: '3px solid var(--blue)', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--navy)' }}>
                    Adopt Australian English spelling across all customer touchpoints
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate)' }}>
                    Organisation-wide brand directive
                  </div>
                </div>
              </div>
            </section>

            <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
              <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
                <h2 style={{ fontSize: '17px', margin: 0 }}>Where actions stand</h2>
              </div>
              <div className="pb" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>Completed</span>
                    <span>71% (54 items)</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '99px', background: 'var(--line2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '71%', background: 'var(--green)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--blue)', fontWeight: 600 }}>In progress</span>
                    <span>24% (18 items)</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '99px', background: 'var(--line2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '24%', background: 'var(--blue)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Blocked / Needs review</span>
                    <span>5% (4 items)</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '99px', background: 'var(--line2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '5%', background: 'var(--amber)' }} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Saved reports table */}
          <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
            <div className="ph" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
              <h2 style={{ fontSize: '17px', margin: 0 }}>Saved executive reports</h2>
            </div>
            <div className="pb" style={{ padding: '0' }}>
              <table className="tbl stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--light)' }}>
                    <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Report Name</th>
                    <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Period</th>
                    <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Generated</th>
                    <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', padding: '12px 18px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: '1px solid var(--line2)' }}>
                    <td data-l="Name" style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--navy)' }}>
                      October 2026 Executive Summary
                    </td>
                    <td data-l="Period" style={{ padding: '14px 18px', color: 'var(--slate)' }}>
                      1 Oct - 31 Oct 2026
                    </td>
                    <td data-l="Generated" style={{ padding: '14px 18px', color: 'var(--slate)' }}>
                      1 Nov 2026
                    </td>
                    <td data-l="Actions" style={{ padding: '14px 18px' }}>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                        onClick={() => showToast('Opening report preview...')}
                      >
                        View pack
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

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
