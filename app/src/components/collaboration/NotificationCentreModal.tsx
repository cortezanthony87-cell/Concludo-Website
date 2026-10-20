import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, MessageSquare, Mail, Calendar, CheckSquare, Shield, Users, Check, AlertCircle, Loader2 } from 'lucide-react';
import { UserNotificationKind } from '../../lib/notifications/userNotificationsClient';
import { useAccountNotifications } from '../../lib/notifications/useAccountNotifications';
import { useAuth } from '../../lib/auth/AuthContext';
import { isDemoWorkspace } from '../../lib/crm/hub/featureFlag';
import { collaborationStore, useCollaboration } from '../../lib/collaboration/collaborationStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCentreModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | UserNotificationKind>('all');

  // Authenticated real notifications hook
  const accountNotifs = useAccountNotifications();

  // Demo fallback strictly if in explicit demo workspace
  const store = useCollaboration();
  const isDemo = Boolean(user && isDemoWorkspace(user.id));

  if (!isOpen) return null;

  // STRICT PRIVACY RULE:
  // If user is logged into a real account / non-demo workspace, ONLY show authentic accountNotifs.notifications.
  // Synthetic demonstration items are completely excluded and will never appear on a real account.
  const activeList = isDemo
    ? store.getNotifications().map((n) => ({
        id: n.id,
        kind: n.kind as UserNotificationKind,
        title: n.title,
        summary: n.summary,
        source_room: n.sourceRoom,
        sender_name: n.senderName,
        target_url: n.targetUrl,
        is_read: n.isRead,
        created_at: n.createdAt,
      }))
    : accountNotifs.notifications;

  const filteredNotifications = activeList.filter((n) => {
    if (filter === 'all') return true;
    return n.kind === filter;
  });

  const handleItemClick = async (targetUrl: string, id: string) => {
    if (isDemo) {
      store.markNotificationRead(id);
    } else {
      await accountNotifs.markAsRead(id);
    }
    onClose();
    navigate(targetUrl);
  };

  const handleMarkAllRead = async () => {
    if (!isDemo) {
      await accountNotifs.markAllAsRead();
    }
  };

  const getKindIcon = (kind: UserNotificationKind) => {
    switch (kind) {
      case 'message':
        return <MessageSquare size={14} color="#D4AF37" />;
      case 'email':
        return <Mail size={14} color="#3B82F6" />;
      case 'calendar_invitation':
        return <Calendar size={14} color="#10B981" />;
      case 'approval':
        return <CheckSquare size={14} color="#F59E0B" />;
      case 'shared_org_request':
        return <Users size={14} color="#8B5CF6" />;
      default:
        return <Shield size={14} color="#64748B" />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13, 22, 38, 0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          width: '560px',
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
          boxSizing: 'border-box',
          border: '1px solid #D9DFE9',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 20px',
            borderBottom: '1px solid #EDF2F7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#D4AF37" />
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#16263F',
                margin: 0,
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              Notifications Centre
            </h3>
            {isDemo && (
              <span style={{ fontSize: '10.5px', background: '#FEF8EA', border: '1px solid #F6E2B3', borderRadius: '4px', padding: '1px 6px', color: '#8A6A1C', fontWeight: 600 }}>
                Synthetic demonstration
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isDemo && accountNotifs.unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#D4AF37',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 8px',
                  minHeight: '44px',
                }}
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notification centre"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '10px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8898AA',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 16px',
            overflowX: 'auto',
            background: '#F8FAFC',
            borderBottom: '1px solid #EDF2F7',
          }}
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'message', label: 'Messages' },
            { id: 'calendar_invitation', label: 'Invitations' },
            { id: 'approval', label: 'Approvals' },
            { id: 'email', label: 'Emails' },
            { id: 'shared_org_request', label: 'Shared Orgs' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id as any)}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11.5px',
                fontWeight: 600,
                border: filter === item.id ? '1px solid #D4AF37' : '1px solid #D9DFE9',
                background: filter === item.id ? '#D4AF37' : '#FFFFFF',
                color: filter === item.id ? '#16263F' : '#5A6478',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: '34px',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {!isDemo && accountNotifs.loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#8898AA' }}>
              <Loader2 size={20} className="spin-animation" style={{ margin: '0 auto 8px', color: '#D4AF37' }} />
              <span style={{ fontSize: '12px' }}>Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#8898AA' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#16263F', fontWeight: 600 }}>
                No notifications
              </p>
              <p style={{ margin: 0, fontSize: '12px' }}>
                You have no pending notifications in this category.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif.target_url, notif.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  background: notif.is_read ? '#FFFFFF' : '#F9FBFF',
                  border: notif.is_read ? '1px solid #EDF2F7' : '1px solid #BFDBFE',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getKindIcon(notif.kind)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h4
                      style={{
                        margin: '0 0 2px 0',
                        fontSize: '13px',
                        fontWeight: notif.is_read ? 600 : 700,
                        color: '#16263F',
                      }}
                    >
                      {notif.title}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#8898AA', flexShrink: 0, marginLeft: '6px' }}>
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: '#5A6478', lineHeight: '1.4' }}>
                    {notif.summary}
                  </p>
                  {notif.source_room && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#D4AF37',
                        fontWeight: 600,
                        display: 'inline-block',
                        marginTop: '4px',
                      }}
                    >
                      {notif.source_room}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
