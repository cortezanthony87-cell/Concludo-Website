import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { HUB_INBOX_ITEMS } from '../../../lib/crm/hub/data';
import { CommInboxItem } from '../../../lib/crm/hub/types';

interface InboxViewProps {
  onSelectRoom: (roomId: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({ onSelectRoom }) => {
  const [filter, setFilter] = useState<'all' | 'mention' | 'approval'>('all');
  const [items, setItems] = useState<CommInboxItem[]>(HUB_INBOX_ITEMS);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.kind === filter;
  });

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  return (
    <div className="hub-centre">
      {/* Header */}
      <div className="hub-chead">
        <div className="hub-tlitem-icon" style={{ borderRadius: '6px', width: '32px', height: '32px', background: '#E8EDF5' }}>
          <Icons.Inbox size={18} color="var(--hub-navy2)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="hub-chead-title">Inbox</h2>
            <span className="hub-demo-badge" style={{ fontSize: '10px', padding: '1px 6px' }}>
              Screen S01
            </span>
          </div>
          <div className="hub-chead-meta">
            Triage mentions and pending approvals requiring your review
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="hub-btn-out" onClick={markAllRead}>
            <Icons.CheckCheck size={14} />
            Mark all read
          </button>
        </div>
      </div>

      {/* Filters and List */}
      <div style={{ padding: '16px 22px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <button
            onClick={() => setFilter('all')}
            className={`hub-chip ${filter === 'all' ? 'gold' : 'light'}`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setFilter('mention')}
            className={`hub-chip ${filter === 'mention' ? 'gold' : 'light'}`}
          >
            Mentions ({items.filter((i) => i.kind === 'mention').length})
          </button>
          <button
            onClick={() => setFilter('approval')}
            className={`hub-chip ${filter === 'approval' ? 'gold' : 'light'}`}
          >
            Approvals ({items.filter((i) => i.kind === 'approval').length})
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="hub-card"
              style={{
                cursor: 'pointer',
                background: item.unread ? '#FFFFFF' : '#FAFBFD',
                borderLeft: item.unread ? '3px solid var(--hub-open)' : '1px solid var(--hub-hair)',
              }}
              onClick={() => onSelectRoom('room-northbridge-account')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`hub-avatar ${item.actorInitials === 'CC' ? 'g' : ''}`} style={{ width: '28px', height: '28px', fontSize: '10px' }}>
                  {item.actorInitials}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{item.title}</span>
                    {item.badgeLabel && (
                      <span className={`hub-state ${item.badgeTone === 'open' ? 'hub-st-open' : 'hub-st-wait'}`}>
                        {item.badgeLabel}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--hub-slate)' }}>{item.timeLabel}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#33435C', marginTop: '2px' }}>
                    {item.snippet}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--hub-slate)', marginTop: '4px' }}>
                    Source room: {item.sourceRoom}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
