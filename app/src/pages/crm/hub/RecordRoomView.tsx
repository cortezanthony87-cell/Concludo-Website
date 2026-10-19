import React, { useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import { HUB_MESSAGES, HUB_MEMBERS, HUB_RECORD_ROOMS } from '../../../lib/crm/hub/data';
import { CommMessage } from '../../../lib/crm/hub/types';
import { useCrmWrite, setActingRole, currentActingRole } from '../../../components/crm/Stage5Pieces';
import { createHubMessage, proposeHubUpdate } from '../../../lib/crm/hub/hubWrites';
import { decideProposal } from '../../../lib/crm/stage5/writes';
import { FileSharingModal } from '../../../components/collaboration/FileSharingModal';
import { CreateCalendarItemModal } from '../../../components/collaboration/CreateCalendarItemModal';
import { CalendarInvitationCard } from '../../../components/collaboration/CalendarInvitationCard';
import { collaborationStore, useCollaboration } from '../../../lib/collaboration/collaborationStore';

interface RecordRoomViewProps {
  roomId?: string;
  onSendMessage?: (text: string) => void;
  onReviewProposal?: () => void;
  onToggleIntel?: () => void;
  onSelectRoom?: (roomId: string) => void;
  isIntelOpen?: boolean;
}

export const RecordRoomView: React.FC<RecordRoomViewProps> = ({
  roomId = 'room-northbridge-account',
  onSendMessage,
  onReviewProposal,
  onToggleIntel,
  onSelectRoom,
  isIntelOpen = false,
}) => {
  const [messages, setMessages] = useState<CommMessage[]>(HUB_MESSAGES);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [proposalReviewed, setProposalReviewed] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    sizePhrase: string;
    versionPhrase: string;
    accessPhrase: string;
    type: 'pdf' | 'doc' | 'xls' | 'ppt' | 'file';
    dataUrl?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const write = useCrmWrite();
  const store = useCollaboration();
  const storeCalendarEvents = store.getCalendarEvents();

  const room =
    HUB_RECORD_ROOMS.find((r) => r.id === roomId) || HUB_RECORD_ROOMS[0];

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const detectFileType = (fileName: string, mime: string): 'pdf' | 'doc' | 'xls' | 'ppt' | 'file' => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
    if (lower.endsWith('.doc') || lower.endsWith('.docx') || mime.includes('word')) return 'doc';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv') || mime.includes('spreadsheet') || mime.includes('excel')) return 'xls';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx') || mime.includes('presentation') || mime.includes('powerpoint')) return 'ppt';
    return 'file';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingAttachment({
        name: file.name,
        sizePhrase: formatBytes(file.size),
        versionPhrase: 'uploaded device file',
        accessPhrase: 'internal team review',
        type: detectFileType(file.name, file.type),
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = () => {
    if (!inputVal.trim() && !pendingAttachment) return;
    const text = inputVal.trim() || (pendingAttachment ? `Shared file: ${pendingAttachment.name}` : '');

    // All writes go through existing commit() path
    const result = write.run('Post message to record room', (context, workspace) => {
      return createHubMessage({
        context,
        data: workspace,
        conversationId: room.id,
        body: text,
        authorName: 'Maya Chen',
        authorInitials: 'MC',
        fileAttachment: pendingAttachment || undefined,
      });
    });

    if (result) {
      setMessages([...HUB_MESSAGES]);
      if (onSendMessage) onSendMessage(text);
      setInputVal('');
      setPendingAttachment(null);
    }
  };

  const handleCalendarEventCreated = (event: any) => {
    const inviteMsg: CommMessage = {
      id: `msg-${Date.now()}`,
      crmWorkspaceId: 'ws-kestrel-advisory',
      conversationId: roomId,
      authorKind: 'user',
      authorId: 'usr-maya-chen',
      authorName: 'Maya Chen',
      authorInitials: 'MC',
      authorOrg: 'Kestrel Advisory',
      isExternal: false,
      body: `Calendar item created: ${event.title} on ${event.date} at ${event.startTime}.`,
      bodyFormat: 'plain',
      invitationId: event.id,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, inviteMsg]);
  };

  const handleReviewProposal = () => {
    // Rule 1: commit() path; Rule 2: Copilot writes only to crm_proposals
    const result = write.run('Decide proposed update from conversation', (context, workspace) => {
      let proposal = workspace.proposals.find((p) => p.headline.includes('revised scope'));
      if (!proposal) {
        proposal = proposeHubUpdate({
          context,
          data: workspace,
          headline: 'Tom Reyes sends revised scope by Friday 31 October',
          rationale: 'Quoted from Tom Reyes, 9:34 am in Northbridge account room.',
          changes: [
            {
              field: 'title',
              from: null,
              to: 'Send revised scope to Priya Nair',
            },
          ],
        });
      }
      if (proposal && proposal.state === 'awaiting_confirmation') {
        return decideProposal(context, workspace, proposal.id, 'confirmed', 'Confirmed in account room');
      }
      return proposal;
    });

    if (result) {
      setProposalReviewed(true);
      if (onReviewProposal) onReviewProposal();
    }
  };

  return (
    <div className="hub-centre">
      {/* Header */}
      <div className="hub-chead">
        <div className="hub-tlitem-icon" style={{ borderRadius: '6px', width: '32px', height: '32px', background: '#E8EDF5' }}>
          <Icons.Hash size={18} color="var(--hub-navy2)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="hub-chead-title">{room.title}</h2>
            <span className="hub-demo-badge" style={{ fontSize: '10px', padding: '1px 6px' }}>
              Screen S03: Internal room
            </span>
          </div>
          <div className="hub-chead-meta">
            Internal record room · Linked to <span style={{ fontWeight: 600, color: 'var(--hub-navy)' }}>Northbridge Industrial</span>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {HUB_MEMBERS.map((m, idx) => (
              <span
                key={m.id}
                className={`hub-avatar ${idx === 1 ? 'g' : ''}`}
                style={{ width: '28px', height: '28px', marginLeft: idx > 0 ? '-6px' : 0, fontSize: '10px', border: '2px solid #FFFFFF' }}
                title={`${m.name} (${m.orgName})`}
              >
                {m.initials}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="hub-btn-out"
            style={{ height: '30px', padding: '0 10px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setIsFilesModalOpen(true)}
            title="File Sharing and Collaboration"
          >
            <Icons.Folder size={13} />
            <span>Files</span>
          </button>
          <button
            type="button"
            className="hub-btn-out"
            style={{
              height: '30px',
              padding: '0 12px',
              background: isIntelOpen ? '#E8EDF5' : '#FFFFFF',
              borderColor: isIntelOpen ? 'var(--hub-navy)' : 'var(--hub-hair)',
              color: 'var(--hub-navy)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={onToggleIntel}
            title="Toggle Copilot intelligence panel"
          >
            <Icons.Sparkles size={13} color="var(--hub-gold2)" />
            <span>Copilot (3)</span>
          </button>
          <button className="hub-btn-out" style={{ height: '30px', padding: '0 8px' }} aria-label="Room options">
            <Icons.MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Mobile room selector pills (visible on narrow viewports) */}
      <div className="hub-mobile-room-selector" style={{ display: 'flex', gap: '8px' }}>
        {HUB_RECORD_ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`hub-room-pill ${r.id === room.id ? 'active' : ''}`}
            onClick={() => onSelectRoom && onSelectRoom(r.id)}
          >
            <Icons.Hash size={12} />
            <span>{r.title}</span>
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="hub-feed">
        {/* Pinned banner */}
        <div className="hub-pinned-banner">
          <div className="hub-pinned-content">
            <Icons.Pin size={14} color="var(--hub-gold2)" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: 'var(--hub-ink)' }}>Pinned:</span>
            <span style={{ color: '#22324B' }}>Board meets 6 November. Revised scope due Friday 31 October.</span>
          </div>
          <div className="hub-pinned-meta">Pinned by Maya Chen</div>
        </div>

        <div className="hub-daysep">Tuesday 21 October</div>

        {/* Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className="hub-msg">
            <span className={`hub-avatar ${msg.authorInitials === 'TR' ? 'g' : ''}`}>
              {msg.authorInitials}
            </span>
            <div className="hub-msg-body">
              <div className="hub-msg-who">
                <span>{msg.authorName}</span>
                <span>{msg.authorOrg}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p>{msg.body}</p>

              {/* Record Chips */}
              {msg.recordChips && msg.recordChips.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  {msg.recordChips.map((chip) => (
                    <span key={chip.id} className="hub-chip light" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      <Icons.Target size={11} />
                      {chip.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Reactions */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  {msg.reactions.map((r, i) => (
                    <span key={i} style={{ border: '1px solid var(--hub-hair)', background: '#FFFFFF', borderRadius: '12px', padding: '1px 7px', fontSize: '11px' }}>
                      {r.emoji} {r.count}
                    </span>
                  ))}
                </div>
              )}

              {/* File attachment */}
              {msg.fileAttachment && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center', background: '#FFFFFF', border: '1px solid var(--hub-hair)', borderRadius: '8px', padding: '8px 12px', maxWidth: '420px' }}>
                  <div style={{ width: '32px', height: '36px', borderRadius: '4px', background: '#E8EDF5', color: 'var(--hub-navy2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                    {msg.fileAttachment.type || 'FILE'}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={msg.fileAttachment.name}>
                      {msg.fileAttachment.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--hub-slate)' }}>
                      {msg.fileAttachment.sizePhrase} · {msg.fileAttachment.versionPhrase} · {msg.fileAttachment.accessPhrase}
                    </div>
                  </div>
                  {msg.fileAttachment.dataUrl ? (
                    <a
                      href={msg.fileAttachment.dataUrl}
                      download={msg.fileAttachment.name}
                      style={{ marginLeft: 'auto', color: 'var(--hub-slate)', display: 'inline-flex', padding: 4 }}
                      title={`Download ${msg.fileAttachment.name}`}
                      aria-label={`Download ${msg.fileAttachment.name}`}
                    >
                      <Icons.Download size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer', padding: 4 }}
                      title={`Download ${msg.fileAttachment.name}`}
                      aria-label="Download attachment"
                      onClick={() => alert(`Downloading ${msg.fileAttachment?.name}`)}
                    >
                      <Icons.Download size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Calendar Invitation Card if linked */}
              {msg.invitationId && (
                (() => {
                  const ev = storeCalendarEvents.find((e) => e.id === msg.invitationId);
                  return ev ? (
                    <CalendarInvitationCard event={ev} />
                  ) : null;
                })()
              )}
            </div>
          </div>
        ))}

        {/* Concludo Proposal Card */}
        <div className="hub-proposal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Icons.Sparkles size={14} color="var(--hub-gold2)" />
            <span style={{ fontWeight: 700, fontSize: '12.5px' }}>
              Concludo proposes 1 CRM update from this conversation
            </span>
            <span className="hub-state hub-st-mut" style={{ marginLeft: '6px' }}>
              <Icons.Lock size={10} style={{ marginRight: '3px' }} />
              Visible to Kestrel Advisory only
            </span>
            <button
              className="hub-btn-navy"
              style={{ marginLeft: 'auto', height: '26px', fontSize: '11px' }}
              onClick={handleReviewProposal}
            >
              {proposalReviewed ? 'Confirmed' : 'Review'}
            </button>
          </div>
          <div style={{ marginTop: '6px', color: '#33435C', fontSize: '12px' }}>
            Commitment: Tom Reyes sends revised scope by Friday 31 October.
            <span style={{ color: 'var(--hub-slate)', marginLeft: '6px' }}>
              Quoted from Tom Reyes, 9:34 am. (Writes strictly to crm_proposals)
            </span>
          </div>
        </div>

        {/* Refusal Notice */}
        {write.last && !write.last.ok && (
          <div style={{ padding: '8px 12px', background: '#FDF3F2', border: '1px solid #F5C6CB', borderRadius: '6px', color: '#721C24', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{write.last.message}</span>
            {write.last.message.includes('approver role') && (
              <button
                className="hub-btn-navy"
                style={{ marginLeft: 'auto', height: '24px', fontSize: '11px', padding: '0 8px' }}
                onClick={() => {
                  setActingRole('crm_approver');
                  write.clearLast();
                }}
              >
                Switch to Approver
              </button>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="hub-composer">
        {/* Hidden device file picker */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Pending attachment preview pill */}
        {pendingAttachment && (
          <div style={{ margin: '8px 12px 0', padding: '6px 10px', background: '#F1F4F9', border: '1px solid var(--hub-hair)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <Icons.FileText size={14} color="var(--hub-navy2)" />
            <span style={{ fontWeight: 600, color: 'var(--hub-navy)' }}>{pendingAttachment.name}</span>
            <span style={{ color: 'var(--hub-slate)', fontSize: '11px' }}>({pendingAttachment.sizePhrase})</span>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: 'var(--hub-slate)', cursor: 'pointer', padding: 2 }}
              title="Remove file"
              aria-label="Remove attachment"
            >
              <Icons.X size={13} />
            </button>
          </div>
        )}

        <textarea
          placeholder="Message Northbridge account room..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="hub-composer-tools" style={{ gap: '16px', display: 'flex', alignItems: 'center' }}>
          <button className="hub-btn-out" style={{ border: 0, padding: 6, cursor: 'pointer' }} aria-label="Mention colleague" title="Mention colleague (@)">
            <Icons.AtSign size={15} color="var(--hub-slate)" />
          </button>
          <button className="hub-btn-out" style={{ border: 0, padding: 6, cursor: 'pointer' }} aria-label="Link record" title="Link CRM record (#)">
            <Icons.Hash size={15} color="var(--hub-slate)" />
          </button>
          <button className="hub-btn-out" style={{ border: 0, padding: 6, cursor: 'pointer' }} aria-label="Add emoji" title="Add emoji (😊)">
            <Icons.Smile size={15} color="var(--hub-slate)" />
          </button>
          <button
            type="button"
            className="hub-btn-out"
            style={{ border: 0, padding: '6px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            aria-label="Create Calendar Item"
            title="Schedule calendar event or meeting invitation"
            onClick={() => setIsCalendarModalOpen(true)}
          >
            <Icons.Calendar size={15} color="var(--hub-navy)" />
            <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--hub-navy)' }}>Calendar</span>
          </button>
          <button
            type="button"
            className="hub-btn-out"
            style={{ border: 0, padding: 6, cursor: 'pointer' }}
            aria-label="Ask Copilot"
            title="Ask Copilot (✨)"
            onClick={onToggleIntel}
          >
            <Icons.Sparkles size={15} color="var(--hub-gold2)" />
          </button>

          <span style={{ fontSize: '11px', color: 'var(--hub-slate)', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <Icons.Eye size={12} />
            Visible to internal team (Kestrel Advisory)
          </span>

          <button
            className="hub-btn-navy"
            style={{ marginLeft: 'auto' }}
            onClick={handleSend}
            aria-label="Send message"
          >
            <Icons.Send size={13} />
            Send
          </button>
        </div>
      </div>

      {/* Create Calendar Item Modal */}
      <CreateCalendarItemModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        conversationId={roomId}
        defaultCrmLink={`${room.title} · S03: Account Room`}
        onCreated={handleCalendarEventCreated}
      />

      {/* File Sharing Modal */}
      <FileSharingModal
        isOpen={isFilesModalOpen}
        onClose={() => setIsFilesModalOpen(false)}
        roomName={room.title}
      />
    </div>
  );
};
