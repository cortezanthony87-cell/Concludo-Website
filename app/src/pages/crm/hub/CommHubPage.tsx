import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { isHubR0Enabled, isDemoWorkspace, setHubR0Enabled } from '../../../lib/crm/hub/featureFlag';
import { useCrmViewState } from '../../../lib/crm/useCrmViewState';
import { HUB_RECORD_ROOMS, HUB_INBOX_ITEMS } from '../../../lib/crm/hub/data';
import { CustomerWorkspaceView } from './CustomerWorkspaceView';
import { RecordRoomView } from './RecordRoomView';
import { InboxView } from './InboxView';
import { IntelligencePanel } from './IntelligencePanel';
import { SearchModal } from './SearchModal';
import '../../../styles/concludo-comm-hub.css';

export const CommHubPage: React.FC = () => {
  const { viewState } = useCrmViewState();
  const currentWorkspaceId = viewState?.workspaceId || 'ws-kestrel-advisory';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<'inbox' | 'customer' | 'room' | 'messages' | 'email' | 'spaces' | 'files' | 'partners' | 'projects' | 'templates' | 'invitations' | 'notifications' | 'archive'>('customer');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-northbridge-account');
  const [intelCollapsed, setIntelCollapsed] = useState<boolean>(false);
  const [mobileIntelOpen, setMobileIntelOpen] = useState<boolean>(false);

  // Strict Gate 2: If this is a real customer workspace, refuse completely
  if (!isDemoWorkspace(currentWorkspaceId)) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '640px', margin: '40px auto', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--hub-hair)', boxShadow: '0 4px 12px rgba(22, 38, 63, 0.05)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FDF3F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icons.ShieldAlert size={24} color="#C53030" />
        </div>
        <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '20px', fontWeight: 600, color: 'var(--hub-navy)', margin: '0 0 8px 0' }}>
          Communication Hub Restricted
        </h2>
        <p style={{ fontSize: '13.5px', color: '#33435C', lineHeight: 1.6, margin: '0 0 20px 0' }}>
          The Concludo Communication Hub is strictly restricted to synthetic demonstration workspaces under Release 0 governance. It cannot be enabled for real customer workspaces without written director authorisation.
        </p>
        <div style={{ fontSize: '11px', color: 'var(--hub-slate)' }}>
          Current workspace: <code>{currentWorkspaceId}</code> (Non-demo workspace blocked)
        </div>
      </div>
    );
  }

  // Gate check: behind feature flag hub_r0, off by default
  const enabled = isHubR0Enabled(currentWorkspaceId);

  if (!enabled) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '640px', margin: '40px auto', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--hub-hair)', boxShadow: '0 4px 12px rgba(22, 38, 63, 0.05)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#E8EDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icons.ShieldAlert size={24} color="var(--hub-navy)" />
        </div>
        <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '20px', fontWeight: 600, color: 'var(--hub-navy)', margin: '0 0 8px 0' }}>
          Communication Hub (Release 0 Demo)
        </h2>
        <p style={{ fontSize: '13.5px', color: '#33435C', lineHeight: 1.6, margin: '0 0 20px 0' }}>
          The Concludo Communication Hub is deployed dark behind the <code>hub_r0</code> feature flag. In accordance with release governance, it is off by default for all customer workspaces.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            className="hub-btn-gold"
            onClick={() => {
              setHubR0Enabled(true);
              window.location.reload();
            }}
          >
            Preview synthetic demonstration
          </button>
        </div>
        <div style={{ marginTop: '20px', fontSize: '11px', color: 'var(--hub-slate)' }}>
          Governed by Release 0 criteria. Synthetic demonstration data only.
        </div>
      </div>
    );
  }

  const unreadInboxCount = HUB_INBOX_ITEMS.filter((i) => i.unread).length;

  return (
    <div className="hub-container">
      {/* Navy Band */}
      <div className="hub-band">
        <div className="hub-band-row">
          <div>
            <div className="hub-crumb">CRM · COMMUNICATE</div>
            <h1 className="hub-title">
              {activeNav === 'customer'
                ? 'Customer Workspace'
                : activeNav === 'room'
                ? 'Record Room'
                : activeNav === 'inbox'
                ? 'Inbox'
                : 'Communication Hub'}
            </h1>
          </div>

          {/* Global Search Bar */}
          <div className="hub-search-box" onClick={() => setIsSearchOpen(true)}>
            <Icons.Search size={15} />
            <input
              type="text"
              readOnly
              placeholder="Search records, record rooms, timeline items..."
            />
            <span className="hub-kbd">Ctrl K</span>
          </div>

          {/* Demo Badge */}
          <div className="hub-demo-badge">
            <Icons.Info size={13} />
            <span>Synthetic demonstration data</span>
          </div>

          {/* Notification Bell */}
          <button
            className="hub-btn-out"
            style={{ background: 'transparent', borderColor: '#3A5680', color: '#FFFFFF', padding: '0 10px' }}
            aria-label="Notifications"
            onClick={() => setActiveNav('inbox')}
          >
            <Icons.Bell size={15} />
            {unreadInboxCount > 0 && (
              <span style={{ background: 'var(--hub-gold)', color: 'var(--hub-navy)', borderRadius: '8px', padding: '0 4px', fontSize: '9px', fontWeight: 700 }}>
                {unreadInboxCount}
              </span>
            )}
          </button>

          {/* One Gold Action Per Screen */}
          <button
            className="hub-btn-gold"
            onClick={() => {
              setActiveNav('room');
              setSelectedRoomId('room-northbridge-account');
            }}
          >
            <Icons.Plus size={15} />
            <span>New</span>
          </button>

          {/* User Avatar */}
          <div className="hub-avatar" style={{ background: 'var(--hub-navy2)', border: '2px solid #2E4A72' }}>
            MC
          </div>
        </div>
      </div>

      {/* Main Hub Grid */}
      <div className={`hub-grid ${intelCollapsed ? 'collapsed-intel' : ''} ${mobileIntelOpen ? 'show-mobile-intel' : ''}`}>
        {/* Left 248px Navigation */}
        <div className="hub-nav">
          <div className="hub-nav-lbl">Hub navigation</div>

          <button
            className={`hub-nav-link ${activeNav === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveNav('inbox')}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <Icons.Inbox size={15} />
            <span>Inbox</span>
            {unreadInboxCount > 0 && <span className="hub-nav-count">{unreadInboxCount}</span>}
          </button>

          <button
            className={`hub-nav-link ${activeNav === 'customer' ? 'active' : ''}`}
            onClick={() => setActiveNav('customer')}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <Icons.Building2 size={15} />
            <span>Customers</span>
            <span className="hub-nav-count">1</span>
          </button>

          <button
            className={`hub-nav-link ${activeNav === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveNav('messages')}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <Icons.MessageSquare size={15} />
            <span>Messages</span>
          </button>

          <button
            className={`hub-nav-link ${activeNav === 'email' ? 'active' : ''}`}
            onClick={() => setActiveNav('email')}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <Icons.Mail size={15} />
            <span>Email</span>
          </button>

          <button
            className={`hub-nav-link ${activeNav === 'spaces' ? 'active' : ''}`}
            onClick={() => setActiveNav('spaces')}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <Icons.Network size={15} />
            <span>Shared spaces</span>
          </button>

          <button
            className={`hub-nav-link ${activeNav === 'files' ? 'active' : ''}`}
            onClick={() => setActiveNav('files')}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <Icons.Folder size={15} />
            <span>Files</span>
          </button>

          <div className="hub-nav-lbl" style={{ marginTop: '10px' }}>Pinned conversations</div>
          <button
            className={`hub-nav-link ${activeNav === 'room' && selectedRoomId === 'room-northbridge-account' ? 'active' : ''}`}
            onClick={() => {
              setSelectedRoomId('room-northbridge-account');
              setActiveNav('room');
            }}
            style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
          >
            <span style={{ fontWeight: 700, color: 'var(--hub-navy)' }}>#</span>
            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>Northbridge account room</span>
            <span className="hub-nav-dot" />
          </button>

          <div className="hub-nav-lbl" style={{ marginTop: '10px' }}>Recent record rooms</div>
          {HUB_RECORD_ROOMS.map((room) => (
            <button
              key={room.id}
              className={`hub-nav-link ${activeNav === 'room' && selectedRoomId === room.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedRoomId(room.id);
                setActiveNav('room');
              }}
              style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
            >
              <span style={{ fontWeight: 700, color: 'var(--hub-navy)' }}>#</span>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{room.title}</span>
            </button>
          ))}
        </div>

        {/* Centre View */}
        {activeNav === 'customer' && (
          <CustomerWorkspaceView
            onOpenRoom={(roomId) => {
              setSelectedRoomId(roomId);
              setActiveNav('room');
            }}
          />
        )}

        {activeNav === 'room' && (
          <RecordRoomView
            roomId={selectedRoomId}
            onReviewProposal={() => {
              // Open intelligence or confirm proposal
            }}
          />
        )}

        {activeNav === 'inbox' && (
          <InboxView
            onSelectRoom={(roomId) => {
              setSelectedRoomId(roomId);
              setActiveNav('room');
            }}
          />
        )}

        {activeNav === 'messages' && (
          <div className="hub-centre" style={{ padding: '36px', textAlign: 'center' }}>
            <div className="hub-card" style={{ maxWidth: '520px', margin: '20px auto', textAlign: 'left' }}>
              <h4>Direct and group messaging</h4>
              <p style={{ fontSize: '13px', color: '#33435C', lineHeight: 1.5 }}>
                Internal direct messaging and general channels ship in Release 1. In Release 0, conversations are hosted in internal record rooms linked to accounts and opportunities.
              </p>
              <button
                className="hub-btn-navy"
                style={{ marginTop: '12px' }}
                onClick={() => {
                  setSelectedRoomId('room-northbridge-account');
                  setActiveNav('room');
                }}
              >
                Open Northbridge account room
              </button>
            </div>
          </div>
        )}

        {activeNav === 'email' && (
          <div className="hub-centre" style={{ padding: '36px', textAlign: 'center' }}>
            <div className="hub-card" style={{ maxWidth: '520px', margin: '20px auto', textAlign: 'left' }}>
              <h4>Email integration</h4>
              <p style={{ fontSize: '13px', color: '#33435C', lineHeight: 1.5 }}>
                Email inside the Communication Hub ships in Release 2 following Microsoft publisher verification and 14 days of sync testing.
              </p>
            </div>
          </div>
        )}

        {activeNav === 'spaces' && (
          <div className="hub-centre" style={{ padding: '36px', textAlign: 'center' }}>
            <div className="hub-card" style={{ maxWidth: '520px', margin: '20px auto', textAlign: 'left' }}>
              <h4>External shared spaces</h4>
              <p style={{ fontSize: '13px', color: '#33435C', lineHeight: 1.5 }}>
                Shared spaces with external guests ship in Release 3, gated by converted Team pilots and lawyer reviewed data processing agreements.
              </p>
            </div>
          </div>
        )}

        {activeNav === 'files' && (
          <div className="hub-centre" style={{ padding: '36px', textAlign: 'center' }}>
            <div className="hub-card" style={{ maxWidth: '520px', margin: '20px auto', textAlign: 'left' }}>
              <h4>Document library</h4>
              <p style={{ fontSize: '13px', color: '#33435C', lineHeight: 1.5 }}>
                File preview, versioning, and sharing ship in Release 1. In Release 0, document records are browsed in the customer workspace Files tab.
              </p>
              <button
                className="hub-btn-navy"
                style={{ marginTop: '12px' }}
                onClick={() => setActiveNav('customer')}
              >
                Go to customer files
              </button>
            </div>
          </div>
        )}

        {/* Right Intelligence Panel */}
        {!intelCollapsed ? (
          <IntelligencePanel />
        ) : (
          <div
            style={{ background: 'var(--hub-white)', borderLeft: '1px solid var(--hub-hair)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', cursor: 'pointer' }}
            onClick={() => setIntelCollapsed(false)}
            title="Expand intelligence panel"
          >
            <Icons.Sparkles size={18} color="var(--hub-gold2)" />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation (m1 wireframe) */}
      <div className="hub-mobile-tabs">
        <button
          className={`hub-mobile-tab-btn ${activeNav === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveNav('inbox')}
        >
          <Icons.Inbox size={18} />
          <span>Inbox</span>
        </button>
        <button
          className={`hub-mobile-tab-btn ${activeNav === 'customer' ? 'active' : ''}`}
          onClick={() => setActiveNav('customer')}
        >
          <Icons.Building2 size={18} />
          <span>Accounts</span>
        </button>
        <button
          className={`hub-mobile-tab-btn ${activeNav === 'room' ? 'active' : ''}`}
          onClick={() => {
            setSelectedRoomId('room-northbridge-account');
            setActiveNav('room');
          }}
        >
          <Icons.MessageSquare size={18} />
          <span>Room</span>
        </button>
        <button
          className={`hub-mobile-tab-btn ${mobileIntelOpen ? 'active' : ''}`}
          onClick={() => setMobileIntelOpen(!mobileIntelOpen)}
        >
          <Icons.Sparkles size={18} color="var(--hub-gold2)" />
          <span>Copilot</span>
        </button>
      </div>

      {/* Search Modal (S22) */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={(res) => {
          if (res.category === 'Records' || res.category === 'Timeline items') {
            setActiveNav('customer');
          } else if (res.category === 'Record rooms' || res.category === 'Messages') {
            setSelectedRoomId('room-northbridge-account');
            setActiveNav('room');
          }
        }}
      />
    </div>
  );
};
