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
  const [activeTab, setActiveTab] = useState<'rooms' | 'customer' | 'inbox' | 'intel'>('rooms');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-northbridge-account');
  const [isIntelDrawerOpen, setIsIntelDrawerOpen] = useState<boolean>(false);

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
              {activeTab === 'customer'
                ? 'Customer Workspace'
                : activeTab === 'rooms'
                ? 'Record Rooms'
                : activeTab === 'inbox'
                ? 'Inbox'
                : activeTab === 'intel'
                ? 'Intelligence and Copilot'
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
            onClick={() => setActiveTab('inbox')}
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
              setActiveTab('rooms');
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

      {/* Top Sub-Navigation Tabs */}
      <div className="hub-top-tabs">
        <button
          className={`hub-top-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Icons.MessageSquare size={16} />
          <span>Record Rooms</span>
        </button>

        <button
          className={`hub-top-tab-btn ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer')}
        >
          <Icons.Building2 size={16} />
          <span>Customer Workspace</span>
          <span className="hub-tab-chip">Northbridge Industrial</span>
        </button>

        <button
          className={`hub-top-tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveTab('inbox')}
        >
          <Icons.Inbox size={16} />
          <span>Inbox</span>
          {unreadInboxCount > 0 && <span className="hub-tab-chip gold">{unreadInboxCount}</span>}
        </button>

        <button
          className={`hub-top-tab-btn ${activeTab === 'intel' ? 'active' : ''}`}
          onClick={() => setActiveTab('intel')}
        >
          <Icons.Sparkles size={16} color="var(--hub-gold2)" />
          <span>Copilot Intelligence</span>
          <span className="hub-tab-chip red">3 alerts</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="hub-content-area">
        {activeTab === 'rooms' && (
          <div className="hub-room-layout">
            {/* Left compact room channels list */}
            <div className="hub-room-nav">
              <div className="hub-nav-lbl">Pinned conversations</div>
              <button
                className={`hub-nav-link ${selectedRoomId === 'room-northbridge-account' ? 'active' : ''}`}
                onClick={() => setSelectedRoomId('room-northbridge-account')}
                style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
              >
                <span style={{ fontWeight: 700, color: 'var(--hub-navy)' }}>#</span>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>Northbridge account room</span>
                <span className="hub-nav-dot" />
              </button>

              <div className="hub-nav-lbl" style={{ marginTop: '12px' }}>Recent record rooms</div>
              {HUB_RECORD_ROOMS.map((room) => (
                <button
                  key={room.id}
                  className={`hub-nav-link ${selectedRoomId === room.id ? 'active' : ''}`}
                  onClick={() => setSelectedRoomId(room.id)}
                  style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--hub-navy)' }}>#</span>
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{room.title}</span>
                </button>
              ))}

              <div className="hub-nav-lbl" style={{ marginTop: '12px' }}>Account views</div>
              <button
                className="hub-nav-link"
                onClick={() => setActiveTab('customer')}
                style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
              >
                <Icons.Building2 size={14} />
                <span>Customer Workspace</span>
              </button>
              <button
                className="hub-nav-link"
                onClick={() => setActiveTab('intel')}
                style={{ width: '100%', border: 0, textAlign: 'left', background: 'transparent' }}
              >
                <Icons.Sparkles size={14} color="var(--hub-gold2)" />
                <span>Account Intelligence</span>
              </button>
            </div>

            {/* Center conversation */}
            <div className="hub-room-main">
              <RecordRoomView
                roomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
                onToggleIntel={() => setIsIntelDrawerOpen(!isIntelDrawerOpen)}
                isIntelOpen={isIntelDrawerOpen}
              />
            </div>

            {/* Docked intelligence sidebar for wide desktop screens (>= 1400px) */}
            {isIntelDrawerOpen && (
              <div className="hub-room-docked-intel">
                <IntelligencePanel mode="panel" onClose={() => setIsIntelDrawerOpen(false)} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'customer' && (
          <CustomerWorkspaceView
            onOpenRoom={(roomId) => {
              setSelectedRoomId(roomId);
              setActiveTab('rooms');
            }}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxView
            onSelectRoom={(roomId) => {
              setSelectedRoomId(roomId);
              setActiveTab('rooms');
            }}
          />
        )}

        {activeTab === 'intel' && (
          <IntelligencePanel mode="full" />
        )}
      </div>

      {/* Floating slide-out drawer on smaller screens (< 1400px) when opened from room */}
      {isIntelDrawerOpen && activeTab === 'rooms' && (
        <div className="hub-drawer-overlay" onClick={() => setIsIntelDrawerOpen(false)}>
          <div className="hub-drawer-content" onClick={(e) => e.stopPropagation()}>
            <IntelligencePanel mode="panel" onClose={() => setIsIntelDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Search Modal (S22) */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={(res) => {
          if (res.category === 'Records' || res.category === 'Timeline items') {
            setActiveTab('customer');
          } else if (res.category === 'Record rooms' || res.category === 'Messages') {
            setSelectedRoomId('room-northbridge-account');
            setActiveTab('rooms');
          }
        }}
      />
    </div>
  );
};
