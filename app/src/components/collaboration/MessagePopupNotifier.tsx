import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare, Mail, ExternalLink } from 'lucide-react';
import { ActivePopupNotification } from '../../lib/collaboration/collaborationTypes';
import { collaborationStore } from '../../lib/collaboration/collaborationStore';

export const MessagePopupNotifier: React.FC = () => {
  const [popups, setPopups] = useState<ActivePopupNotification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const update = () => {
      setPopups([...collaborationStore.getActivePopups()]);
    };
    update();
    return collaborationStore.subscribe(update);
  }, []);

  if (popups.length === 0) return null;

  const handleOpen = (popup: ActivePopupNotification) => {
    collaborationStore.openPopup(popup.id);
    navigate(popup.targetUrl);
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    collaborationStore.dismissPopup(id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 72px))',
        right: '24px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
      aria-live="polite"
    >
      {popups.map((popup) => (
        <div
          key={popup.id}
          style={{
            width: 'min(320px, calc(100vw - 32px))',
            background: '#FFFFFF',
            border: '1px solid #D9DFE9',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(13, 22, 38, 0.18)',
            padding: '14px 16px',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
            animation: 'slideInRight 0.3s ease-out, fadeOutPopup 0.5s ease-in 9.5s forwards',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            {/* Sender Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#16263F',
                color: '#D4AF37',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {popup.senderInitials}
            </div>

            {/* Message Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                <strong style={{ fontSize: '13px', color: '#16263F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {popup.senderName}
                </strong>
                <span style={{ fontSize: '10.5px', color: '#8898AA', flexShrink: 0, marginLeft: '6px' }}>
                  now
                </span>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#D4AF37',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '6px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {popup.kind === 'email' ? <Mail size={11} /> : <MessageSquare size={11} />}
                <span>{popup.roomOrOrg}</span>
              </div>

              {popup.subject && (
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 650, color: '#16263F' }}>
                  {popup.subject}
                </p>
              )}

              <p
                style={{
                  margin: '0 0 10px 0',
                  fontSize: '12px',
                  color: '#5A6478',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {popup.preview}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={(e) => handleDismiss(popup.id, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8898AA',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '8px 10px',
                    minHeight: '44px',
                  }}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(popup)}
                  style={{
                    background: '#16263F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    minHeight: '44px',
                  }}
                >
                  <span>Open</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Close Cross */}
            <button
              type="button"
              onClick={(e) => handleDismiss(popup.id, e)}
              aria-label="Dismiss notification"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#8898AA',
                cursor: 'pointer',
                padding: '10px',
                margin: '-4px -4px 0 0',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
