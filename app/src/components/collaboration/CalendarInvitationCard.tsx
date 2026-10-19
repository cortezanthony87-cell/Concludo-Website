import React from 'react';
import { Calendar, Clock, MapPin, Check, X, HelpCircle, Users } from 'lucide-react';
import { CollabCalendarEvent } from '../../lib/collaboration/collaborationTypes';
import { collaborationStore } from '../../lib/collaboration/collaborationStore';

interface Props {
  event: CollabCalendarEvent;
  onResponded?: () => void;
}

export const CalendarInvitationCard: React.FC<Props> = ({ event, onResponded }) => {
  const handleResponse = (response: 'accepted' | 'declined' | 'tentative') => {
    collaborationStore.respondToCalendarInvitation(event.id, response);
    if (onResponded) onResponded();
  };

  const statusTone =
    event.status === 'accepted'
      ? { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', label: 'Accepted' }
      : event.status === 'declined'
      ? { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', label: 'Declined' }
      : event.status === 'tentative'
      ? { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', label: 'Tentative' }
      : { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569', label: 'Response Needed' };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #D9DFE9',
        borderRadius: '8px',
        padding: '14px 16px',
        marginTop: '8px',
        marginBottom: '8px',
        maxWidth: '520px',
        boxShadow: '0 2px 6px rgba(13, 22, 38, 0.04)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'rgba(212, 175, 55, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={15} color="#D4AF37" />
          </div>
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#D4AF37',
              }}
            >
              Calendar Invitation · {event.eventType.toUpperCase()}
            </span>
            <h4 style={{ margin: '1px 0 0 0', fontSize: '13.5px', fontWeight: 650, color: '#16263F' }}>
              {event.title}
            </h4>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 650,
            padding: '3px 8px',
            borderRadius: '999px',
            background: statusTone.bg,
            border: `1px solid ${statusTone.border}`,
            color: statusTone.text,
          }}
        >
          {statusTone.label}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#5A6478', margin: '8px 0 10px 0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={13} color="#8898AA" />
          {event.date} · {event.startTime} to {event.endTime}
        </span>
        {event.location && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={13} color="#8898AA" />
            {event.location}
          </span>
        )}
        {event.participants.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Users size={13} color="#8898AA" />
            {event.participants.length} invited ({event.participants.map((p) => p.name).slice(0, 2).join(', ')}
            {event.participants.length > 2 ? ` +${event.participants.length - 2}` : ''})
          </span>
        )}
      </div>

      {event.description && (
        <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#16263F', lineHeight: '1.4' }}>
          {event.description}
        </p>
      )}

      {event.status === 'pending' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '6px', borderTop: '1px solid #EDF2F7' }}>
          <button
            type="button"
            onClick={() => handleResponse('accepted')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#15803D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '5px',
              padding: '8px 14px',
              minHeight: '44px',
              fontSize: '12px',
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            <Check size={13} />
            Accept
          </button>
          <button
            type="button"
            onClick={() => handleResponse('tentative')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              color: '#475569',
              border: '1px solid #D9DFE9',
              borderRadius: '5px',
              padding: '8px 12px',
              minHeight: '44px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <HelpCircle size={13} />
            Tentative
          </button>
          <button
            type="button"
            onClick={() => handleResponse('declined')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              color: '#DC2626',
              border: '1px solid #FECACA',
              borderRadius: '5px',
              padding: '8px 12px',
              minHeight: '44px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <X size={13} />
            Decline
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '11.5px', color: '#166534', paddingTop: '4px' }}>
          ✓ Added to Personal Calendar, Team Calendar, and CRM Timeline.
        </div>
      )}
    </div>
  );
};
