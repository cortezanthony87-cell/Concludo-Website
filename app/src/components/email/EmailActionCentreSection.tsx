import React, { useState } from 'react';
import {
  Inbox,
  Mail,
  Flag,
  AlertCircle,
  Building2,
  Users,
  Send,
  FileText,
  Bookmark,
  Archive,
  Calendar,
  Clock,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { EmailActionNav, CollabEmailItem } from '../../lib/collaboration/collaborationTypes';
import { collaborationStore, useCollaboration } from '../../lib/collaboration/collaborationStore';

export const EmailActionCentreSection: React.FC = () => {
  const store = useCollaboration();
  const [activeNav, setActiveNav] = useState<EmailActionNav>('awaiting_action');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const allEmails = store.getEmails();

  const filteredEmails = allEmails.filter((email) => {
    if (email.isArchived) return activeNav === 'archive';
    if (activeNav === 'unread') return email.isUnread;
    if (activeNav === 'flagged') return email.isFlagged;
    if (activeNav === 'awaiting_action') return email.needsResponse || email.isActionRequired || email.isApprovalRequest;
    if (activeNav === 'customers') return !email.isSharedOrg && email.organisation !== 'Kestrel Advisory';
    if (activeNav === 'internal') return email.organisation === 'Kestrel Advisory';
    if (activeNav === 'shared_orgs') return email.isSharedOrg;
    if (activeNav === 'inbox') return !email.isArchived;
    return true;
  });

  // Prioritise: Customer responses -> Approval requests -> Escalations -> Follow-ups -> Flagged -> Unread
  const sortedQueue = [...filteredEmails].sort((a, b) => {
    const priorityScore = (item: CollabEmailItem) => {
      let score = 0;
      if (item.isEscalation) score += 50;
      if (item.isApprovalRequest) score += 40;
      if (item.needsResponse) score += 30;
      if (item.isFollowUp) score += 20;
      if (item.isFlagged) score += 10;
      if (item.isUnread) score += 5;
      return score;
    };
    return priorityScore(b) - priorityScore(a);
  });

  const handleConvert = (
    emailId: string,
    target: 'crm_conversation' | 'task' | 'calendar_event' | 'opportunity' | 'service_request' | 'project_discussion'
  ) => {
    const res = store.convertEmailToCrm(emailId, target);
    setOpenDropdownId(null);
    setActionSuccess(res.label);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleAddToCalendar = (emailId: string) => {
    const event = store.addEmailInviteToCalendar(emailId);
    if (event) {
      setActionSuccess(`Added "${event.title}" to Calendar and CRM Timeline.`);
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  const navItems: { id: EmailActionNav; label: string; icon: React.ReactNode }[] = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox size={14} /> },
    { id: 'unread', label: 'Unread', icon: <Mail size={14} /> },
    { id: 'flagged', label: 'Flagged', icon: <Flag size={14} /> },
    { id: 'awaiting_action', label: 'Awaiting Action', icon: <AlertCircle size={14} /> },
    { id: 'customers', label: 'Customers', icon: <Building2 size={14} /> },
    { id: 'internal', label: 'Internal', icon: <Users size={14} /> },
    { id: 'shared_orgs', label: 'Shared Organisations', icon: <Users size={14} /> },
    { id: 'sent', label: 'Sent', icon: <Send size={14} /> },
    { id: 'drafts', label: 'Drafts', icon: <FileText size={14} /> },
    { id: 'templates', label: 'Templates', icon: <Bookmark size={14} /> },
    { id: 'archive', label: 'Archive', icon: <Archive size={14} /> },
  ];

  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #D9DFE9',
        borderRadius: '10px',
        marginTop: '24px',
        padding: '20px',
        boxShadow: '0 4px 16px rgba(13, 22, 38, 0.04)',
        fontFamily: 'Inter, sans-serif',
      }}
      aria-label="Email Action Centre"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Mail size={18} color="#D4AF37" />
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#16263F', fontFamily: 'Poppins, sans-serif' }}>
              Email Action Centre
            </h3>
            <span
              style={{
                background: 'var(--cws-gold, #E2B53C)',
                color: '#0D1626',
                borderRadius: '999px',
                padding: '1px 8px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {store.getBadgeCounts().email}
            </span>
            <span style={{ fontSize: '11px', background: '#FEF8EA', border: '1px solid #F6E2B3', borderRadius: '4px', padding: '2px 8px', color: '#8A6A1C', fontWeight: 600 }}>
              Synthetic demonstration data
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#5A6478' }}>
            Unified management across Microsoft 365, Outlook, Exchange, Google Workspace, and Gmail.
          </p>
        </div>

        {actionSuccess && (
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#166534',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>{actionSuccess}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          borderBottom: '1px solid #EDF2F7',
          paddingBottom: '8px',
          marginBottom: '16px',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px', /* Icon -> Text = 8px */
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? '#16263F' : 'transparent',
                color: isActive ? '#FFFFFF' : '#5A6478',
                fontSize: '12.5px',
                fontWeight: isActive ? 650 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Follow-up Intelligence Notice */}
      <div
        style={{
          background: '#FEF8EA',
          border: '1px solid #F6E2B3',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#8A6A1C',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={15} color="#D4AF37" />
          <span>
            <strong>Follow-Up Intelligence Active:</strong> Auto-monitoring 24h, 48h, and 72h response thresholds. Escalations and pending responses automatically prioritised.
          </span>
        </div>
        <span style={{ fontWeight: 650, color: '#16263F' }}>Zero em dashes standard</span>
      </div>

      {/* Awaiting Action Queue Table / Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sortedQueue.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8898AA' }}>
            No email items in this queue.
          </div>
        ) : (
          sortedQueue.map((item) => {
            const isDropdownOpen = openDropdownId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid #EDF2F7',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  background: item.isUnread ? '#FAFBFD' : '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: item.priority === 'urgent' ? '#FEE2E2' : item.priority === 'high' ? '#FEF3C7' : '#E2E8F0',
                        color: item.priority === 'urgent' ? '#991B1B' : item.priority === 'high' ? '#92400E' : '#334155',
                      }}
                    >
                      {item.priority}
                    </span>
                    <strong style={{ fontSize: '13.5px', color: '#16263F' }}>{item.sender}</strong>
                    <span style={{ fontSize: '12px', color: '#8898AA' }}>· {item.organisation}</span>
                    {item.crmRecord && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 7px',
                          borderRadius: '4px',
                          background: '#E8EDF5',
                          color: '#16263F',
                          fontWeight: 600,
                        }}
                      >
                        {item.crmRecord.label}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#5A6478' }}>
                    {item.dueDate && <span>Due: <strong>{item.dueDate}</strong></span>}
                    {item.followUpAgeHours && (
                      <span style={{ color: '#D4AF37', fontWeight: 650 }}>
                        Waiting {item.followUpAgeHours}h
                      </span>
                    )}
                    <span style={{ textTransform: 'capitalize' }}>Status: {item.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                    {item.subject}
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#5A6478', lineHeight: 1.4 }}>
                    {item.preview}
                  </p>
                </div>

                {/* Action Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid #F1F5F9',
                    gap: '12px', /* Button -> Button = 12px */
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {item.meetingInvite && (
                      <button
                        type="button"
                        onClick={() => handleAddToCalendar(item.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          color: '#166534',
                          borderRadius: '5px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: 650,
                          cursor: 'pointer',
                        }}
                      >
                        <Calendar size={13} />
                        <span>Add To Calendar (1 Click)</span>
                      </button>
                    )}

                    {/* Convert to CRM Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setOpenDropdownId(isDropdownOpen ? null : item.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#FFFFFF',
                          border: '1px solid #D9DFE9',
                          color: '#16263F',
                          borderRadius: '5px',
                          padding: '5px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles size={13} color="#D4AF37" />
                        <span>Convert Email To...</span>
                        <ChevronDown size={12} />
                      </button>

                      {isDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            zIndex: 100,
                            marginTop: '4px',
                            background: '#FFFFFF',
                            border: '1px solid #D9DFE9',
                            borderRadius: '6px',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                            width: '210px',
                            padding: '4px 0',
                          }}
                        >
                          {[
                            { id: 'crm_conversation', label: 'CRM Conversation' },
                            { id: 'task', label: 'Task' },
                            { id: 'calendar_event', label: 'Calendar Event' },
                            { id: 'opportunity', label: 'Opportunity' },
                            { id: 'service_request', label: 'Service Request' },
                            { id: 'project_discussion', label: 'Project Discussion' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleConvert(item.id, opt.id as any)}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 14px',
                                border: 'none',
                                background: 'transparent',
                                fontSize: '12px',
                                color: '#16263F',
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => store.markEmailRead(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#8898AA',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      }}
                    >
                      {item.isUnread ? 'Mark as read' : 'Read'}
                    </button>
                    <button
                      type="button"
                      onClick={() => store.completeEmail(item.id)}
                      style={{
                        background: '#F1F5F9',
                        border: '1px solid #D9DFE9',
                        color: '#16263F',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
