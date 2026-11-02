import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BRIGHT_APPS, BRIGHT_CATS, BrightApp } from '../../../../lib/integrations/brightCatalogueData';
import { BrightIcon } from './BrightIcons';
import '../../../../styles/connectivity-bright.css';

export interface ConnectAppBrightViewProps {
  onOpenConnectModal?: (app: BrightApp) => void;
}

export const ConnectAppBrightView: React.FC<ConnectAppBrightViewProps> = ({
  onOpenConnectModal,
}) => {
  const navigate = useNavigate();

  // Filter & Search states
  const [filt, setFilt] = useState<string>('All apps');
  const [mode, setMode] = useState<'all' | 'connected' | 'attention' | 'ready' | 'soon'>('all');
  const [q, setQ] = useState<string>('');
  const [dense, setDense] = useState<boolean>(false);

  // Drawer state
  const [selectedApp, setSelectedApp] = useState<BrightApp | null>(null);
  const [drawerState, setDrawerState] = useState<string>('idle');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Keyboard shortcut for quick search ('/') and Escape for drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        const input = document.getElementById('q');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  // Statistics
  const cnt = (k: string) =>
    BRIGHT_APPS.filter((a) => a.s === k || (k === 'ok' && a.s === 'multi')).length;
  const attn = cnt('reauth') + cnt('perm');
  const ready = cnt('idle');
  const soon = cnt('soon');

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return BRIGHT_APPS.filter((a) => {
      // Category filter
      const catMatch =
        filt === 'All apps'
          ? true
          : filt === 'Connected'
          ? a.s === 'ok' || a.s === 'multi'
          : a.c === filt;

      // Status filter
      const statusMatch =
        mode === 'all'
          ? true
          : mode === 'connected'
          ? a.s === 'ok' || a.s === 'multi'
          : mode === 'attention'
          ? a.s === 'reauth' || a.s === 'perm'
          : mode === 'ready'
          ? a.s === 'idle'
          : a.s === 'soon';

      // Search query
      const searchMatch =
        !q ||
        (a.n + ' ' + a.c + ' ' + a.d + ' ' + (a.g || ''))
          .toLowerCase()
          .includes(q.toLowerCase());

      return catMatch && statusMatch && searchMatch;
    });
  }, [filt, mode, q]);

  // Grouped sections
  const GORDER = [
    'Microsoft 365',
    'Google Workspace',
    'Social Media',
    'Productivity',
    'Communication',
    'CRM & Sales',
    'Accounting & Finance',
    'Project Management',
    'File Storage',
    'Forms & Data Collection',
    'E-commerce',
    'Marketing',
    'Customer Support',
    'HR & People',
    'Developer / API',
    'AI',
  ];

  const grouped = useMemo(() => {
    const map = new Map<string, BrightApp[]>();
    for (const a of filteredApps) {
      const g = a.g || a.c;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    return map;
  }, [filteredApps]);

  const handleOpenDrawer = (app: BrightApp, initialStatus: string = 'idle') => {
    setSelectedApp(app);
    setDrawerState(initialStatus);
    setIsDrawerOpen(true);
  };

  const STAT: Record<string, [string, string]> = {
    multi: ['4 accounts connected', 'ok'],
    ok: ['Connected and verified', 'ok'],
    reauth: ['Reconnect required', 'warn'],
    perm: ['More access requested', 'warn'],
    idle: ['Ready to connect', 'idle'],
    soon: ['Coming soon', 'idle'],
  };

  return (
    <div className="cn-shell">
      {/* Header */}
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div className="mono eyebrow" style={{ color: 'var(--blue)', marginBottom: '4px' }}>Connectivity</div>
          <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBottom: '6px' }}>Connect your apps</h1>
          <p className="sub" style={{ color: 'var(--slate)', maxWidth: '62ch', fontSize: '14.5px' }}>
            Sign in on each app’s own page, approve what Concludo asks for, and verify what came back. Nothing leaves Concludo until you approve it.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn ghost" onClick={() => navigate('/integrations/history')}>
            <BrightIcon name="clock" />
            <span>Connection history</span>
          </button>
        </div>
      </div>

      {/* Connectivity Navigation Tabs */}
      <nav className="tabs" aria-label="Connectivity sections" style={{ marginBottom: '22px' }}>
        <Link to="/integrations" className="on">
          <BrightIcon name="plug" />
          <span>Connect App</span>
          <span className="tag">{cnt('ok')} connected</span>
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

      {/* Trust & Governance Banner */}
      <div className="trust" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', background: '#fff', border: '1px solid var(--line)', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', boxShadow: 'var(--shadow)' }}>
        <div style={{ color: 'var(--blue)', marginTop: '2px' }}>
          <BrightIcon name="shield" style={{ width: '22px', height: '22px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '15px', marginBottom: '2px' }}>
            Concludo proposes. You approve.
          </div>
          <p style={{ color: 'var(--slate)', fontSize: '13.5px', margin: 0 }}>
            Every action, meeting brief, and report is shown to you for explicit confirmation. Concludo never sends drafts or modifies connected systems without human review.
          </p>
        </div>
      </div>

      {/* 4 Stat Tiles */}
      <div className="stats">
        <div className="stat g" onClick={() => setMode('connected')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className="n" style={{ color: 'var(--green)' }}>{cnt('ok')}</div>
          <div className="l">Connected and verified</div>
        </div>
        <div className="stat a" onClick={() => setMode('attention')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className="n" style={{ color: attn > 0 ? 'var(--amber)' : 'var(--slate)' }}>{attn}</div>
          <div className="l">Need your attention</div>
        </div>
        <div className="stat" onClick={() => setMode('ready')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className="n">{ready}</div>
          <div className="l">Ready to connect</div>
        </div>
        <div className="stat" onClick={() => setMode('soon')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className="n" style={{ color: 'var(--slate)' }}>{soon}</div>
          <div className="l">Coming soon</div>
        </div>
      </div>

      {/* Search & Mode Segment Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div className="find" style={{ flex: '1 1 320px' }}>
          <BrightIcon name="search" style={{ color: 'var(--slate)' }} />
          <input
            id="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 76 apps by name, category, or capability... (press / to focus)"
            aria-label="Search apps"
          />
          {q ? (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search">
              <BrightIcon name="x" style={{ width: '16px', height: '16px', color: 'var(--slate)' }} />
            </button>
          ) : (
            <kbd style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--light)', border: '1px solid var(--line2)', fontSize: '11px', color: 'var(--slate)' }}>/</kbd>
          )}
        </div>

        {/* View Segment (All, Connected, Attention, Ready, Soon) */}
        <div className="seg" role="tablist">
          <button
            type="button"
            className={mode === 'all' ? 'on' : ''}
            onClick={() => setMode('all')}
          >
            All ({BRIGHT_APPS.length})
          </button>
          <button
            type="button"
            className={mode === 'connected' ? 'on' : ''}
            onClick={() => setMode('connected')}
          >
            Connected ({cnt('ok')})
          </button>
          <button
            type="button"
            className={mode === 'attention' ? 'on' : ''}
            onClick={() => setMode('attention')}
          >
            Attention ({attn})
          </button>
          <button
            type="button"
            className={mode === 'ready' ? 'on' : ''}
            onClick={() => setMode('ready')}
          >
            Ready ({ready})
          </button>
          <button
            type="button"
            className={mode === 'soon' ? 'on' : ''}
            onClick={() => setMode('soon')}
          >
            Soon ({soon})
          </button>
        </div>

        {/* Dense Toggle */}
        <button
          type="button"
          className="btn ghost"
          onClick={() => setDense(!dense)}
          style={{ padding: '8px 14px', fontSize: '13px' }}
        >
          <BrightIcon name="grid" />
          <span>{dense ? 'Grouped view' : 'Compact view'}</span>
        </button>
      </div>

      {/* Category Pills Bar */}
      <div className="cats" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px' }}>
        {BRIGHT_CATS.map((c) => (
          <button
            key={c}
            type="button"
            className={`cat ${filt === c ? 'on' : ''}`}
            onClick={() => setFilt(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredApps.length === 0 && (
        <div className="empty" style={{ display: 'block', padding: '60px 24px', textAlign: 'center', background: '#fff', border: '1px dashed var(--gold)', borderRadius: '18px', margin: '20px 0' }}>
          <div className="tile t-gold" style={{ margin: '0 auto 16px auto', width: '56px', height: '56px', borderRadius: '16px', display: 'grid', placeItems: 'center', background: 'rgba(226,181,60,.15)', color: 'var(--amber)' }}>
            <BrightIcon name="search" style={{ width: '28px', height: '28px' }} />
          </div>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>No matching apps found</h3>
          <p style={{ color: 'var(--slate)', maxWidth: '420px', margin: '0 auto 18px auto', fontSize: '14px' }}>
            We could not find any apps matching &quot;{q}&quot; in this category.
          </p>
          <button
            className="btn gold"
            onClick={() => {
              setQ('');
              setFilt('All apps');
              setMode('all');
            }}
          >
            Reset search and filters
          </button>
        </div>
      )}

      {/* App Cards List: Either Compact Dense or Grouped */}
      {filteredApps.length > 0 && (
        <div id="list">
          {dense ? (
            <div className="grid dense" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {filteredApps.map((a) => (
                <AppCardItem
                  key={a.id}
                  app={a}
                  stat={STAT[a.s]}
                  onOpenDrawer={handleOpenDrawer}
                  onOpenConnectModal={onOpenConnectModal}
                />
              ))}
            </div>
          ) : (
            GORDER.map((groupName) => {
              const list = grouped.get(groupName);
              if (!list || list.length === 0) return null;
              return (
                <div key={groupName} style={{ marginBottom: '32px' }}>
                  <div className="gh" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <h2 style={{ fontSize: '18px', color: 'var(--navy)' }}>{groupName}</h2>
                    <span className="c" style={{ fontSize: '12px', fontWeight: 600, background: '#fff', border: '1px solid var(--line)', borderRadius: '99px', padding: '2px 10px', color: 'var(--navy2)' }}>
                      {list.length}
                    </span>
                    <div className="rule" style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--line), transparent)' }} />
                  </div>
                  <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {list.map((a) => (
                      <AppCardItem
                        key={a.id}
                        app={a}
                        stat={STAT[a.s]}
                        onOpenDrawer={handleOpenDrawer}
                        onOpenConnectModal={onOpenConnectModal}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Connection Drawer */}
      {selectedApp && (
        <>
          <div
            id="scrim"
            className={`scrim ${isDrawerOpen ? 'on' : ''}`}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(22,38,63,.45)',
              backdropFilter: 'blur(3px)',
              zIndex: 49,
              display: isDrawerOpen ? 'block' : 'none',
            }}
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside
            id="drawer"
            className={`drawer ${isDrawerOpen ? 'on' : ''}`}
            aria-label="Connect drawer"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(540px, 100%)',
              background: '#fff',
              zIndex: 50,
              transform: isDrawerOpen ? 'none' : 'translateX(100%)',
              transition: 'transform .24s cubic-bezier(.2, .8, .2, 1)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 32px rgba(22,38,63,.15)',
            }}
          >
            <div className="dh" style={{ padding: '20px 22px 14px', display: 'flex', gap: '14px', alignItems: 'center', borderBottom: '1px solid var(--line2)' }}>
              <div className="tile" style={{ width: '48px', height: '48px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: '#F4F6FA' }}>
                {selectedApp.svg ? (
                  <span className="lg" style={{ display: 'block', width: '32px', height: '32px' }} dangerouslySetInnerHTML={{ __html: selectedApp.svg }} />
                ) : (
                  <BrightIcon name="plug" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', color: 'var(--navy)' }}>
                  {drawerState === 'manage' ? `Manage ${selectedApp.n}` : `Connect ${selectedApp.n}`}
                </h3>
                <div style={{ color: 'var(--slate)', fontSize: '13px' }}>{selectedApp.c}</div>
              </div>
              <button
                type="button"
                className="x"
                aria-label="Close drawer"
                onClick={() => setIsDrawerOpen(false)}
                style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1px solid var(--line2)', display: 'grid', placeItems: 'center', color: 'var(--slate)' }}
              >
                <BrightIcon name="x" />
              </button>
            </div>

            <div className="db" style={{ padding: '20px 22px', flex: 1, overflowY: 'auto' }}>
              {/* Stepper */}
              <div className="steps" aria-label="Progress" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                {['Choose', 'Sign in', 'Check', 'Done'].map((st, i) => {
                  const stepNum = drawerState === 'ok' ? 4 : drawerState === 'verifying' ? 2 : drawerState === 'waiting' ? 1 : 0;
                  const isBad = ['blocked', 'cancel', 'admin', 'server', 'session'].includes(drawerState) && i === 1;
                  const isDone = i < stepNum;
                  const isNow = i === stepNum;
                  return (
                    <React.Fragment key={st}>
                      <div className={`step ${isBad ? 'bad' : isDone ? 'done' : isNow ? 'now' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                        <span className="d" style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', border: '2px solid currentColor' }}>
                          {isDone ? <BrightIcon name="check" style={{ width: '14px', height: '14px' }} /> : i + 1}
                        </span>
                        <span>{st}</span>
                      </div>
                      {i < 3 && <div className={`bar-l ${i < stepNum ? 'done' : ''}`} style={{ flex: 1, height: '2px', background: i < stepNum ? 'var(--green)' : 'var(--line2)', margin: '0 8px' }} />}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* State Preview Switches for testing all 9 states from mockups */}
              <div className="states" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px', padding: '10px', background: 'var(--light)', borderRadius: '12px' }}>
                <span className="mono" style={{ width: '100%', color: 'var(--slate)', marginBottom: '4px' }}>Lifecycle state previews</span>
                {[
                  ['idle', 'Ready'],
                  ['waiting', 'Waiting'],
                  ['verifying', 'Checking'],
                  ['ok', 'Success'],
                  ['blocked', 'Popup blocked'],
                  ['cancel', 'Closed early'],
                  ['admin', 'Admin approval'],
                  ['server', 'App unreachable'],
                  ['session', 'Session expired'],
                ].map(([stKey, stLabel]) => (
                  <button
                    key={stKey}
                    type="button"
                    className={drawerState === stKey ? 'on' : ''}
                    onClick={() => setDrawerState(stKey)}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--line2)',
                      background: drawerState === stKey ? 'var(--navy)' : '#fff',
                      color: drawerState === stKey ? '#fff' : 'var(--navy)',
                    }}
                  >
                    {stLabel}
                  </button>
                ))}
              </div>

              {/* Drawer Body by State */}
              {drawerState === 'idle' && (
                <>
                  <div className="box info" style={{ border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 16px', marginBottom: '14px', background: '#fff' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '6px', color: 'var(--navy)' }}>How this works</h4>
                    <p className="help" style={{ color: 'var(--navy)', fontSize: '13.5px', margin: 0 }}>
                      {selectedApp.auth === 'API key'
                        ? 'Enter a read-only or scoped key from your provider console. Concludo encrypts it in secure storage.'
                        : `We open ${selectedApp.n}’s official sign-in page in a secure window. You sign in there and choose what to share.`}
                    </p>
                  </div>
                  <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="box good" style={{ border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 16px', background: '#F3FAF6' }}>
                      <h4 style={{ fontSize: '14px', marginBottom: '6px', color: 'var(--green)' }}>Concludo will be able to</h4>
                      <ul style={{ paddingLeft: '18px', color: 'var(--navy)', fontSize: '13.5px', margin: 0 }}>
                        <li>Read approved conversation metadata and project briefs</li>
                        <li>Export actions and decisions when you click export</li>
                        <li>Check connection status on your instruction</li>
                      </ul>
                    </div>
                    <div className="box info" style={{ border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 16px', background: '#fff' }}>
                      <h4 style={{ fontSize: '14px', marginBottom: '6px', color: 'var(--navy)' }}>Concludo will never</h4>
                      <ul style={{ paddingLeft: '18px', color: 'var(--slate)', fontSize: '13.5px', margin: 0 }}>
                        <li>Send messages without your explicit confirmation</li>
                        <li>Read unrelated personal emails or documents</li>
                        <li>Store or reveal your password</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {drawerState === 'waiting' && (
                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <div className="spin" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '4px solid #E7EFFD', borderTopColor: 'var(--blue)', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Finish signing in at {selectedApp.n}</h3>
                  <p style={{ color: 'var(--slate)', maxWidth: '380px', margin: '0 auto 18px auto', fontSize: '14px' }}>
                    We opened a secure window for you. If you do not see it, check whether your browser blocked the pop-up.
                  </p>
                  <button className="btn ghost" onClick={() => setDrawerState('blocked')}>
                    Window did not open?
                  </button>
                </div>
              )}

              {drawerState === 'verifying' && (
                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <div className="spin" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '4px solid #E7EFFD', borderTopColor: 'var(--blue)', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Verifying your connection</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '14px' }}>
                    Sending a test ping to verify permissions and tenant isolation.
                  </p>
                </div>
              )}

              {drawerState === 'ok' && (
                <div className="box good" style={{ textAlign: 'center', padding: '36px 20px', background: '#F3FAF6', border: '1px solid var(--green)', borderRadius: '16px' }}>
                  <div className="tile t-green" style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(30,122,76,.15)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 14px auto' }}>
                    <BrightIcon name="check" style={{ width: '28px', height: '28px' }} />
                  </div>
                  <h3 style={{ fontSize: '18px', color: 'var(--green)', marginBottom: '6px' }}>
                    Connected and verified
                  </h3>
                  <p style={{ color: 'var(--navy)', fontSize: '14px', maxWidth: '380px', margin: '0 auto 18px auto' }}>
                    {selectedApp.n} is ready to receive approved exports.
                  </p>
                  <button className="btn gold" onClick={() => setIsDrawerOpen(false)}>
                    Done
                  </button>
                </div>
              )}

              {/* Graceful Error States */}
              {drawerState === 'blocked' && (
                <div className="box badb" style={{ border: '1px solid #E9B7B3', background: '#FEF6F5', borderRadius: '14px', padding: '16px 18px' }}>
                  <h4 style={{ color: 'var(--red)', fontSize: '15px', marginBottom: '6px' }}>Your browser blocked the sign-in window</h4>
                  <p style={{ color: 'var(--navy)', fontSize: '13.5px', marginBottom: '14px' }}>
                    Nothing was connected and nothing was changed.
                  </p>
                  <button className="btn ghost" onClick={() => setDrawerState('waiting')}>
                    Allow pop-ups and try again
                  </button>
                </div>
              )}

              {drawerState === 'cancel' && (
                <div className="box badb" style={{ border: '1px solid #E9B7B3', background: '#FEF6F5', borderRadius: '14px', padding: '16px 18px' }}>
                  <h4 style={{ color: 'var(--red)', fontSize: '15px', marginBottom: '6px' }}>Sign-in was closed before it finished</h4>
                  <p style={{ color: 'var(--navy)', fontSize: '13.5px', marginBottom: '14px' }}>
                    Closing the window early is completely fine. Nothing was connected.
                  </p>
                  <button className="btn gold" onClick={() => setDrawerState('idle')}>
                    Try again
                  </button>
                </div>
              )}

              {drawerState === 'admin' && (
                <div className="box badb" style={{ border: '1px solid #E9B7B3', background: '#FEF6F5', borderRadius: '14px', padding: '16px 18px' }}>
                  <h4 style={{ color: 'var(--red)', fontSize: '15px', marginBottom: '6px' }}>Your administrator needs to approve Concludo</h4>
                  <p style={{ color: 'var(--navy)', fontSize: '13.5px', marginBottom: '14px' }}>
                    Microsoft 365 or Google Workspace requires tenant admin consent. We prepared instructions you can send to your IT administrator.
                  </p>
                  <button className="btn ghost" onClick={() => showToast('Admin copy text copied to clipboard')}>
                    Copy admin instructions
                  </button>
                </div>
              )}

              {drawerState === 'server' && (
                <div className="box badb" style={{ border: '1px solid #E9B7B3', background: '#FEF6F5', borderRadius: '14px', padding: '16px 18px' }}>
                  <h4 style={{ color: 'var(--red)', fontSize: '15px', marginBottom: '6px' }}>Concludo could not reach the app just now</h4>
                  <p style={{ color: 'var(--navy)', fontSize: '13.5px', marginBottom: '14px' }}>
                    This is on our side or the provider’s side, not yours. Nothing was changed.
                  </p>
                  <button className="btn ghost" onClick={() => setDrawerState('verifying')}>
                    Retry connection
                  </button>
                </div>
              )}

              {drawerState === 'session' && (
                <div className="box badb" style={{ border: '1px solid #E9B7B3', background: '#FEF6F5', borderRadius: '14px', padding: '16px 18px' }}>
                  <h4 style={{ color: 'var(--red)', fontSize: '15px', marginBottom: '6px' }}>Your Concludo session has expired</h4>
                  <p style={{ color: 'var(--navy)', fontSize: '13.5px', marginBottom: '14px' }}>
                    For your security, you were signed out of Concludo. The app was not connected.
                  </p>
                  <button className="btn navy" onClick={() => navigate('/login')}>
                    Sign in again
                  </button>
                </div>
              )}
            </div>

            <div className="df" style={{ padding: '16px 22px', borderTop: '1px solid var(--line2)', display: 'flex', gap: '10px', background: 'var(--light)' }}>
              {drawerState === 'idle' && (
                <>
                  <button
                    className="btn gold"
                    onClick={() => {
                      if (onOpenConnectModal && selectedApp) {
                        setIsDrawerOpen(false);
                        onOpenConnectModal(selectedApp);
                      } else {
                        setDrawerState('waiting');
                      }
                    }}
                  >
                    <BrightIcon name="plug" />
                    <span>{selectedApp.auth === 'API key' ? 'Add API key' : `Continue to ${selectedApp.n}`}</span>
                  </button>
                  <button className="btn ghost" onClick={() => setIsDrawerOpen(false)}>
                    Cancel
                  </button>
                </>
              )}
              {drawerState !== 'idle' && (
                <button className="btn ghost" onClick={() => setIsDrawerOpen(false)}>
                  Close
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Toast */}
      {toastMessage && (
        <div
          id="toast"
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

      {/* Footer Independence Line */}
      <div className="foot" style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid var(--line2)', color: 'var(--slate)', fontSize: '12.5px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.6 }}>
        Concludo is an independent product. It is not affiliated with, endorsed by, or sponsored by Microsoft, Google, Notion, Slack, Xero, Wix, or any other integration partner. All trademarks belong to their respective owners.
      </div>
    </div>
  );
};

// Subcomponent: App Card
interface AppCardItemProps {
  app: BrightApp;
  stat?: [string, string];
  onOpenDrawer: (app: BrightApp, initialStatus?: string) => void;
  onOpenConnectModal?: (app: BrightApp) => void;
}

const AppCardItem: React.FC<AppCardItemProps> = ({
  app,
  stat = ['Ready to connect', 'idle'],
  onOpenDrawer,
  onOpenConnectModal,
}) => {
  const [lab, tone] = stat;
  const isConnected = app.s === 'ok' || app.s === 'multi';
  const isAttention = app.s === 'reauth' || app.s === 'perm';
  const isSoon = app.s === 'soon';

  return (
    <div
      className={`card ${isConnected ? 'connected' : isAttention ? 'attention' : isSoon ? 'soon' : ''}`}
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: '18px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        boxShadow: isConnected ? 'var(--shadow), var(--glow-green)' : 'var(--shadow)',
      }}
    >
      <div className="row1" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div
          className="tile"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            background: '#F4F6FA',
            flexShrink: 0,
          }}
        >
          {app.svg ? (
            <span className="lg" style={{ display: 'block', width: '28px', height: '28px' }} dangerouslySetInnerHTML={{ __html: app.svg }} />
          ) : (
            <BrightIcon name="plug" />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: '16px', lineHeight: 1.25, color: 'var(--navy)', marginBottom: '3px' }}>{app.n}</h3>
          <div className="cat-l" style={{ color: 'var(--slate)', fontSize: '11.5px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {app.c}
          </div>
        </div>
        <span
          className={`chip ${tone}`}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '99px',
            background: tone === 'ok' ? '#E4F4EB' : tone === 'warn' ? '#FDF1D4' : '#EEF1F6',
            color: tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--amber)' : 'var(--slate)',
          }}
        >
          {lab}
        </span>
      </div>

      <p className="desc" style={{ color: 'var(--slate)', fontSize: '13.5px', flex: 1, margin: 0, lineHeight: 1.5 }}>
        {app.d}
      </p>

      {/* Multi-account specimen row */}
      {app.s === 'multi' && (
        <div className="accts" style={{ border: '1px solid var(--line2)', borderRadius: '10px', padding: '8px 12px', background: 'var(--light)', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>hello@yourbusiness.com.au</div>
          <span style={{ color: 'var(--blue)', fontWeight: 600, cursor: 'pointer' }} onClick={() => onOpenDrawer(app, 'manage')}>Manage</span>
        </div>
      )}

      {/* Needs attention notice */}
      {app.s === 'reauth' && (
        <p className="help" style={{ color: 'var(--amber)', fontSize: '12.5px', margin: 0 }}>
          Your sign-in expired. Reconnect to restore sync.
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
        {app.s === 'idle' && (
          <button
            className="btn gold"
            onClick={() => {
              if (onOpenConnectModal) onOpenConnectModal(app);
              else onOpenDrawer(app, 'idle');
            }}
            style={{ padding: '7px 14px', fontSize: '13px' }}
          >
            <BrightIcon name="plug" style={{ width: '15px', height: '15px' }} />
            <span>Connect</span>
          </button>
        )}
        {isConnected && (
          <>
            <button
              className="btn ghost"
              onClick={() => onOpenDrawer(app, 'verifying')}
              style={{ padding: '7px 14px', fontSize: '13px' }}
            >
              <BrightIcon name="refresh" style={{ width: '15px', height: '15px' }} />
              <span>Test</span>
            </button>
            <button
              className="btn ghost"
              onClick={() => onOpenDrawer(app, 'idle')}
              style={{ padding: '7px 14px', fontSize: '13px' }}
            >
              Manage
            </button>
          </>
        )}
        {isAttention && (
          <button
            className="btn gold"
            onClick={() => onOpenDrawer(app, 'idle')}
            style={{ padding: '7px 14px', fontSize: '13px' }}
          >
            <BrightIcon name="refresh" style={{ width: '15px', height: '15px' }} />
            <span>Reconnect</span>
          </button>
        )}
        {isSoon && (
          <button className="btn ghost" disabled style={{ padding: '7px 14px', fontSize: '13px', opacity: 0.65 }}>
            Coming soon
          </button>
        )}
      </div>
    </div>
  );
};
