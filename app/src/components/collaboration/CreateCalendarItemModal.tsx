import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, Users, Link2, Check, AlertCircle } from 'lucide-react';
import { CalendarEventType, CalendarParticipant, ParticipantCategory } from '../../lib/collaboration/collaborationTypes';
import { collaborationStore } from '../../lib/collaboration/collaborationStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  defaultCrmLink?: string;
  onCreated?: (event: any) => void;
}

const AVAILABLE_PARTICIPANTS: CalendarParticipant[] = [
  { id: 'usr-maya', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
  { id: 'usr-tom', name: 'Tom Reyes', category: 'user', orgName: 'Kestrel Advisory' },
  { id: 'usr-anthony', name: 'Anthony Cortez', category: 'user', orgName: 'Concludo Pty Ltd' },
  { id: 'usr-priya', name: 'Priya Nair', category: 'user', orgName: 'Northbridge Industrial' },
  { id: 'team-sales', name: 'Sales and Solutions Team', category: 'team', orgName: 'Kestrel Advisory' },
  { id: 'team-ops', name: 'Operations Team', category: 'team', orgName: 'Kestrel Advisory' },
  { id: 'team-exec', name: 'Executive Leadership', category: 'team', orgName: 'Kestrel Advisory' },
  { id: 'dept-adv', name: 'Client Advisory Department', category: 'department', orgName: 'Kestrel Advisory' },
  { id: 'dept-eng', name: 'Engineering Department', category: 'department', orgName: 'Kestrel Advisory' },
  { id: 'org-kestrel', name: 'Entire Kestrel Advisory Organisation', category: 'entire_organization', orgName: 'Kestrel Advisory' },
  { id: 'org-concludo', name: 'Entire Concludo Organisation', category: 'entire_organization', orgName: 'Concludo Pty Ltd' },
  { id: 'room-members', name: 'Northbridge Account Room Members', category: 'room_members', orgName: 'Kestrel Advisory' },
  { id: 'shared-northbridge', name: 'Northbridge Industrial (Shared Org)', category: 'shared_org', orgName: 'Northbridge Industrial' },
  { id: 'shared-sovereign', name: 'Sovereign Health (Shared Org)', category: 'shared_org', orgName: 'Sovereign Health' },
  { id: 'cust-northbridge', name: 'Northbridge Industrial Services', category: 'customer_org', orgName: 'Northbridge Industrial' },
];

const TODAY_STR = new Date().toISOString().split('T')[0];

export const CreateCalendarItemModal: React.FC<Props> = ({
  isOpen,
  onClose,
  conversationId,
  defaultCrmLink = 'Northbridge Industrial · S03: Account Room',
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('meeting');
  const [date, setDate] = useState(TODAY_STR);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('Melbourne HQ / Microsoft Teams');
  const [description, setDescription] = useState('');
  const [crmLink, setCrmLink] = useState(defaultCrmLink);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([
    'usr-maya',
    'usr-tom',
  ]);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const participants = AVAILABLE_PARTICIPANTS.filter((p) =>
      selectedParticipants.includes(p.id)
    );

    const event = collaborationStore.createCalendarItem({
      title: title.trim(),
      eventType,
      date,
      startTime,
      endTime,
      location,
      description,
      participants,
      crmLink,
      conversationId,
      creatorName: 'Maya Chen',
    });

    setSubmitted(true);
    if (onCreated) onCreated(event);

    setTimeout(() => {
      setSubmitted(false);
      setTitle('');
      setDescription('');
      onClose();
    }, 600);
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
        zIndex: 9999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          width: '540px',
          maxWidth: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
          boxSizing: 'border-box',
          border: '1px solid #D9DFE9',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#D4AF37" />
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#16263F',
                margin: 0,
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              Create New Calendar Item
            </h3>
            <span style={{ fontSize: '10.5px', background: '#FEF8EA', border: '1px solid #F6E2B3', borderRadius: '4px', padding: '1px 6px', color: '#8A6A1C', fontWeight: 600 }}>
              Synthetic demonstration
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
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
              borderRadius: '4px',
              color: '#5A6478',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              background: '#F0F9F4',
              borderRadius: '8px',
              border: '1px solid #A7E0C0',
            }}
          >
            <Check size={32} color="#15803D" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#15803D', margin: '0 0 6px' }}>
              Calendar Item Created
            </h4>
            <p style={{ fontSize: '13px', color: '#16263F', margin: 0 }}>
              Notifications, invitation cards, message alerts, and timeline entries generated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Client review with Harding"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D9DFE9',
                  fontSize: '13.5px',
                  color: '#16263F',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as CalendarEventType)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #D9DFE9',
                    fontSize: '13.5px',
                    color: '#16263F',
                    boxSizing: 'border-box',
                    background: '#FFFFFF',
                  }}
                >
                  <option value="meeting">Meeting</option>
                  <option value="task">Task</option>
                  <option value="reminder">Reminder</option>
                  <option value="workshop">Workshop</option>
                  <option value="review">Review</option>
                  <option value="sign_off">Sign-Off</option>
                  <option value="appointment">Appointment</option>
                  <option value="milestone">Milestone</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #D9DFE9',
                    fontSize: '13.5px',
                    color: '#16263F',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #D9DFE9',
                    fontSize: '13.5px',
                    color: '#16263F',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #D9DFE9',
                    fontSize: '13.5px',
                    color: '#16263F',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                Location / Channel
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#8898AA' }} />
                <input
                  type="text"
                  placeholder="e.g. Melbourne HQ Boardroom / Microsoft Teams"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    borderRadius: '6px',
                    border: '1px solid #D9DFE9',
                    fontSize: '13.5px',
                    color: '#16263F',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                CRM Record Link
              </label>
              <div style={{ position: 'relative' }}>
                <Link2 size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#8898AA' }} />
                <input
                  type="text"
                  placeholder="Linked CRM Record"
                  value={crmLink}
                  onChange={(e) => setCrmLink(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    borderRadius: '6px',
                    border: '1px solid #D9DFE9',
                    fontSize: '13.5px',
                    color: '#16263F',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                Participants & Collaboration Scope
              </label>
              <div
                style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  border: '1px solid #D9DFE9',
                  borderRadius: '6px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: '#F9FAFC',
                }}
              >
                {AVAILABLE_PARTICIPANTS.map((p) => {
                  const isSelected = selectedParticipants.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleParticipant(p.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: isSelected ? '1px solid #D4AF37' : '1px solid transparent',
                        background: isSelected ? '#FEF8EA' : '#FFFFFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '12.5px',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#16263F' }}>{p.name}</strong>
                        <span style={{ color: '#8898AA', marginLeft: '6px', fontSize: '11px' }}>
                          ({p.category.replace(/_/g, ' ')}) · {p.orgName}
                        </span>
                      </div>
                      {isSelected && <Check size={14} color="#D4AF37" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', display: 'block', marginBottom: '4px' }}>
                Description / Agenda Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Additional context or talking points..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D9DFE9',
                  fontSize: '13px',
                  color: '#16263F',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px', /* Button -> Button = 12px per Spacing standard */
                marginTop: '8px',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#F4F6FA',
                  border: '1px solid #D9DFE9',
                  color: '#16263F',
                  padding: '10px 18px',
                  minHeight: '44px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  background: '#16263F',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 22px',
                  minHeight: '44px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 650,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(22, 38, 63, 0.2)',
                }}
              >
                Create Item
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
