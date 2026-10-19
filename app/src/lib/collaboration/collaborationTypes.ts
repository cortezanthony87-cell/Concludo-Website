/**
 * Concludo Collaboration, Communication Hub, Calendar & Email Types.
 *
 * Australian English spelling throughout. Zero em dashes or en dashes.
 * Governed by: "Concludo proposes; a person disposes" and "Measure work, never people".
 */

export type ConversationKind =
  | 'direct_message'
  | 'internal_team'
  | 'department'
  | 'external_org'
  | 'shared_org'
  | 'record_room'
  | 'project_conversation'
  | 'customer_conversation';

export interface CollabConversation {
  id: string;
  title: string;
  kind: ConversationKind;
  subtitle?: string;
  recordTable?: string;
  recordId?: string;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  lastMessageSnippet: string;
  lastMessageAt: string;
  membersCount: number;
  avatarUrl?: string;
  orgName?: string;
}

export interface CollabMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderAvatar?: string;
  senderOrg: string;
  body: string;
  createdAt: string;
  isUnread: boolean;
  isDeleted?: boolean;
  invitationId?: string;
  recordChips?: { table: string; id: string; label: string }[];
  reactions?: { emoji: string; count: number }[];
}

export type CalendarEventType =
  | 'meeting'
  | 'task'
  | 'reminder'
  | 'workshop'
  | 'review'
  | 'sign_off'
  | 'appointment'
  | 'milestone'
  | 'custom';

export type ParticipantCategory =
  | 'user'
  | 'team'
  | 'department'
  | 'entire_organization'
  | 'room_members'
  | 'shared_org'
  | 'customer_org';

export interface CalendarParticipant {
  id: string;
  name: string;
  category: ParticipantCategory;
  email?: string;
  orgName?: string;
}

export interface CollabCalendarEvent {
  id: string;
  title: string;
  eventType: CalendarEventType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  description?: string;
  participants: CalendarParticipant[];
  crmLink?: string;
  crmRecordId?: string;
  crmRecordTable?: string;
  creatorId: string;
  creatorName: string;
  status: 'pending' | 'accepted' | 'declined' | 'tentative' | 'completed' | 'cancelled';
  statusReason?: string;
  addedToPersonalCalendar: boolean;
  addedToTeamCalendar: boolean;
  addedToCrmTimeline: boolean;
  createdAt: string;
  deletedAt?: string | null;
}

export type EmailActionNav =
  | 'inbox'
  | 'unread'
  | 'flagged'
  | 'awaiting_action'
  | 'customers'
  | 'internal'
  | 'shared_orgs'
  | 'sent'
  | 'drafts'
  | 'templates'
  | 'archive';

export interface CollabEmailItem {
  id: string;
  sender: string;
  senderEmail: string;
  organisation: string;
  subject: string;
  preview: string;
  date: string;
  isUnread: boolean;
  isFlagged: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  isSpam: boolean;
  isClosed: boolean;
  isCompleted: boolean;
  needsResponse: boolean;
  isApprovalRequest: boolean;
  isEscalation: boolean;
  isFollowUp: boolean;
  isActionRequired: boolean;
  isSharedOrg: boolean;
  priority: 'urgent' | 'high' | 'normal';
  crmRecord?: { id: string; label: string; table: string };
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'waiting' | 'completed';
  followUpAgeHours?: number; // 24, 48, 72
  meetingInvite?: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
  };
}

export type NotificationKind =
  | 'message'
  | 'email'
  | 'invitation'
  | 'approval'
  | 'task'
  | 'calendar_invitation'
  | 'shared_org_request'
  | 'system_alert';

export interface CollabNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  summary: string;
  sourceRoom?: string;
  senderName?: string;
  senderAvatar?: string;
  targetUrl: string;
  createdAt: string;
  isRead: boolean;
  calendarEventId?: string;
  emailId?: string;
}

export interface ActivePopupNotification {
  id: string;
  kind: 'message' | 'email';
  senderName: string;
  senderAvatar?: string;
  senderInitials: string;
  roomOrOrg: string;
  preview: string;
  subject?: string;
  targetUrl: string;
  referenceId: string;
  createdAt: number;
}

export interface BadgeCounts {
  communicate: number;
  calendar: number;
  email: number;
}
