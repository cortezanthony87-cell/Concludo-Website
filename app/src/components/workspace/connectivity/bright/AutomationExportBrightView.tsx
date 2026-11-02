import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrightIcon } from './BrightIcons';
import '../../../../styles/connectivity-bright.css';

export interface AutomationExportBrightViewProps {
  onExport?: (data: any) => Promise<void>;
}

export const AutomationExportBrightView: React.FC<AutomationExportBrightViewProps> = () => {
  const navigate = useNavigate();

  // Selected records for export (Record type, title, destination suggestion, checked)
  const [records, setRecords] = useState<[string, string, string, boolean][]>([
    ['Decision', 'Move launch review to Friday', 'Teams, Notion', true],
    ['Action', 'Send revised scope to client (Priya)', 'Outlook, To Do', true],
    ['Action', 'Book follow-up with finance', 'Outlook Calendar', false],
    ['Summary', 'Client kick-off notes, 12 Nov', 'Google Drive, OneDrive', true],
  ]);

  const [destination, setDestination] = useState<string>('Microsoft To Do (connected)');
  const [includeLineage, setIncludeLineage] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const toggleRecord = (index: number) => {
    setRecords((prev) =>
      prev.map((r, i) => (i === index ? [r[0], r[1], r[2], !r[3]] : r))
    );
  };

  const selectedCount = records.filter((r) => r[3]).length;

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast(`Exported ${selectedCount} items to ${destination}`);
    }, 1200);
  };

  return (
    <div className="cn-shell">
      {/* Header */}
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
        <div>
          <div className="mono eyebrow" style={{ color: 'var(--blue)', marginBottom: '4px' }}>Connectivity</div>
          <h1 style={{ fontSize: '28px', color: 'var(--navy)', marginBottom: '6px' }}>Automation Export</h1>
          <p className="sub" style={{ color: 'var(--slate)', maxWidth: '62ch', fontSize: '14.5px' }}>
            Choose finished work, choose where it goes, review it, then confirm. Nothing leaves Concludo until you approve it.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn ghost" onClick={() => navigate('/webhooks')}>
            <BrightIcon name="hook" />
            <span>Manage webhooks</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <nav className="tabs" aria-label="Connectivity sections" style={{ marginBottom: '22px' }}>
        <Link to="/integrations">
          <BrightIcon name="plug" />
          <span>Connect App</span>
        </Link>
        <Link to="/automation-export" className="on">
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

      {/* Trust banner */}
      <div className="approve" style={{ display: 'flex', gap: '14px', alignItems: 'center', background: 'linear-gradient(90deg, #FFF8E0, #fff)', border: '1px solid var(--gold)', borderRadius: '16px', padding: '16px 20px', marginBottom: '22px', boxShadow: 'var(--shadow)' }}>
        <div style={{ color: 'var(--amber)' }}>
          <BrightIcon name="shield" style={{ width: '22px', height: '22px' }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '15px' }}>
            Concludo proposes. You approve.
          </div>
          <div className="help" style={{ color: 'var(--slate)', fontSize: '13px' }}>
            Every export is shown below with the exact items and the destination system before it leaves.
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="steps" style={{ maxWidth: '680px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="step done" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--green)' }}>
          <span className="d" style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--green)', color: '#fff' }}>
            <BrightIcon name="check" style={{ width: '14px', height: '14px' }} />
          </span>
          <span>1. Choose work</span>
        </div>
        <div className="bar-l done" style={{ flex: 1, height: '2px', background: 'var(--green)', margin: '0 8px' }} />
        <div className="step done" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--green)' }}>
          <span className="d" style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--green)', color: '#fff' }}>
            <BrightIcon name="check" style={{ width: '14px', height: '14px' }} />
          </span>
          <span>2. Destination</span>
        </div>
        <div className="bar-l done" style={{ flex: 1, height: '2px', background: 'var(--green)', margin: '0 8px' }} />
        <div className="step now" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy)' }}>
          <span className="d" style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', border: '2px solid var(--blue)', color: 'var(--blue)' }}>
            3
          </span>
          <span>3. Review and export</span>
        </div>
      </div>

      {/* Two Column Layout: Records & Destination */}
      <div className="two" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
        {/* Panel 1: Records */}
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
          <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
            <h2 style={{ fontSize: '17px', margin: 0 }}>1. Records to export</h2>
            <span className="chip idle" style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: '#EEF1F6', color: 'var(--slate)' }}>
              {selectedCount} selected
            </span>
          </div>
          <div className="pb" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.map((r, i) => (
              <div
                key={i}
                className={`check ${r[3] ? 'on' : ''}`}
                onClick={() => toggleRecord(i)}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  border: r[3] ? '1px solid var(--gold)' : '1px solid var(--line2)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: r[3] ? '#FFFBEF' : '#fff',
                  cursor: 'pointer',
                  boxShadow: r[3] ? '0 0 14px rgba(226,181,60,.25)' : 'none',
                }}
              >
                <span
                  className="cb"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: '2px solid',
                    borderColor: r[3] ? 'var(--navy)' : '#C9D0DC',
                    background: r[3] ? 'var(--navy)' : 'transparent',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {r[3] && <BrightIcon name="check" style={{ width: '12px', height: '12px' }} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--navy)', marginBottom: '2px' }}>
                    {r[1]}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate)' }}>
                    Type: {r[0]} &bull; Suggested: {r[2]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Panel 2: Destination */}
        <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)' }}>
          <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
            <h2 style={{ fontSize: '17px', margin: 0 }}>2. Destination</h2>
          </div>
          <div className="pb" style={{ padding: '18px 20px' }}>
            <div className="kv" style={{ marginBottom: '16px' }}>
              <label htmlFor="dest-select" style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--navy2)', marginBottom: '6px' }}>
                Send to
              </label>
              <select
                id="dest-select"
                className="sel"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                style={{ width: '100%', minHeight: '44px', border: '1px solid var(--line)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}
              >
                <option value="Microsoft To Do (connected)">Microsoft To Do (connected)</option>
                <option value="Microsoft Planner">Microsoft Planner</option>
                <option value="Trello (connected)">Trello (connected)</option>
                <option value="Notion">Notion</option>
                <option value="Slack">Slack</option>
                <option value="Raw JSON / CSV download">Raw JSON / CSV download</option>
              </select>
            </div>

            <div className="box good" style={{ border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 16px', background: '#F3FAF6', marginBottom: '14px' }}>
              <h4 style={{ fontSize: '14px', color: 'var(--green)', marginBottom: '4px' }}>
                {destination.includes('connected') ? 'Destination is connected and verified' : 'Selected destination'}
              </h4>
              <p className="help" style={{ color: 'var(--navy)', fontSize: '13px', margin: 0 }}>
                Exports write new tasks or records into your account. Existing records are never overwritten.
              </p>
            </div>

            <div className="check on" style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', background: '#F4F6FA', borderRadius: '10px' }}>
              <input
                type="checkbox"
                id="lineage"
                checked={includeLineage}
                onChange={(e) => setIncludeLineage(e.target.checked)}
              />
              <label htmlFor="lineage" style={{ fontSize: '13px', color: 'var(--navy)', cursor: 'pointer' }}>
                Include source meeting date and conversation reference for audit lineage
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Panel 3: Review Table before dispatch */}
      <section className="panel" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '18px', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
        <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--line2)' }}>
          <h2 style={{ fontSize: '17px', margin: 0 }}>3. Review before it goes</h2>
        </div>
        <div className="pb" style={{ padding: '18px 20px' }}>
          <table className="tbl stack" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', paddingBottom: '12px' }}>Item</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', paddingBottom: '12px' }}>Destination</th>
                <th style={{ textAlign: 'left', fontSize: '11.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--slate)', paddingBottom: '12px' }}>Creates</th>
              </tr>
            </thead>
            <tbody>
              {records
                .filter((r) => r[3])
                .map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line2)' }}>
                    <td data-l="Item" style={{ padding: '13px 16px', color: 'var(--navy)', fontWeight: 500 }}>
                      {r[1]}
                    </td>
                    <td data-l="Destination" style={{ padding: '13px 16px', color: 'var(--slate)' }}>
                      {destination}
                    </td>
                    <td data-l="Creates" style={{ padding: '13px 16px', color: 'var(--slate)' }}>
                      1 task item in default list
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button
              className="btn gold"
              disabled={selectedCount === 0 || isExporting}
              onClick={handleExport}
              style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
            >
              <BrightIcon name="send" />
              <span>{isExporting ? 'Exporting...' : `Export ${selectedCount} items`}</span>
            </button>
            <button className="btn ghost" onClick={() => navigate('/integrations')} style={{ padding: '10px 18px', fontSize: '14px' }}>
              Cancel
            </button>
          </div>
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

      {/* Independence footer */}
      <div className="foot" style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid var(--line2)', color: 'var(--slate)', fontSize: '12.5px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.6 }}>
        Concludo is an independent product. It is not affiliated with, endorsed by, or sponsored by Microsoft, Google, Notion, Slack, Xero, Wix, or any other integration partner. All trademarks belong to their respective owners.
      </div>
    </div>
  );
};
