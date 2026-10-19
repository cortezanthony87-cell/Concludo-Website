/**
 * Types for the Concludo Communication Hub (Release 0 Demo).
 *
 * Follows all Concludo principles:
 * - No columns ending in _score, _ranking, or _per_user
 * - Attention figure is an integer count of met conditions (0 to 11)
 * - Australian English throughout
 * - No em dashes or en dashes in interface text
 */

export type CommConversationKind =
  | 'dm'
  | 'group'
  | 'channel'
  | 'record_room'
  | 'space_room';

export interface CommConversation {
  id: string;
  crmWorkspaceId: string;
  kind: CommConversationKind;
  title: string;
  recordTable?: string;
  recordId?: string;
  spaceId?: string;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  unreadCount?: number;
  memberCount?: number;
  externalMemberCount?: number;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
}

export interface CommConversationMember {
  id: string;
  crmWorkspaceId: string;
  conversationId: string;
  memberKind: 'user' | 'space_member';
  memberId: string;
  name: string;
  initials: string;
  role: 'owner' | 'member';
  isExternal: boolean;
  orgName: string;
  joinedAt: string;
  leftAt: string | null;
  muted: boolean;
}

export interface CommMessage {
  id: string;
  crmWorkspaceId: string;
  conversationId: string;
  parentMessageId?: string | null;
  authorKind: 'user' | 'space_member' | 'system';
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorOrg?: string;
  isExternal?: boolean;
  body: string;
  bodyFormat: 'plain' | 'markdown';
  recordChips?: { table: string; id: string; label: string }[];
  reactions?: { emoji: string; count: number }[];
  threadRepliesCount?: number;
  lastReplyAt?: string;
  fileAttachment?: {
    name: string;
    sizePhrase: string;
    versionPhrase: string;
    accessPhrase: string;
    type: 'pdf' | 'doc' | 'xls' | 'ppt';
  };
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export type CommTimelineItemType =
  | 'email'
  | 'message'
  | 'meeting'
  | 'file_shared'
  | 'task'
  | 'comment'
  | 'opportunity_change'
  | 'customer_activity'
  | 'ai_proposal';

export interface CommTimelineItem {
  id: string;
  crmWorkspaceId: string;
  recordTable: string;
  recordId: string;
  eventAt: string;
  timeLabel: string;
  dateGroup: 'Today' | 'Earlier this month' | 'Last month';
  itemType: CommTimelineItemType;
  title: string;
  actorKind: 'user' | 'space_member' | 'system';
  actorId?: string;
  actorName?: string;
  sourceTable: string;
  sourceId: string;
  sourceLabel: string;
  visibility: 'internal' | string;
  summary?: string;
  stateTag?: { label: string; tone: 'open' | 'wait' | 'review' | 'stated' | 'mut' };
  hasLeftGoldRule?: boolean;
  detail?: Record<string, unknown>;
  deletedAt: string | null;
  createdAt: string;
}

export interface CommAttentionCondition {
  id: string;
  conditionSentence: string;
  evidenceLink: string;
  evidenceSentence: string;
  whatWouldClearIt: string;
  status: 'met' | 'dismissed';
  badgeTone: 'review' | 'wait' | 'open';
  badgeLabel: string;
  dismissedUntil?: string | null;
  dismissedReason?: string | null;
}

export interface CommCopilotProposal {
  id: string;
  label: string;
  statement: string;
  sources: string[];
  status: 'proposed' | 'accepted' | 'dismissed';
  visibleTo: string;
}

export interface CommInboxItem {
  id: string;
  kind: 'mention' | 'approval';
  title: string;
  snippet: string;
  sourceRoom: string;
  timeLabel: string;
  unread: boolean;
  actorName: string;
  actorInitials: string;
  badgeLabel?: string;
  badgeTone?: 'open' | 'wait' | 'review' | 'mut';
}

export interface CommSearchResult {
  id: string;
  category: 'Records' | 'Record rooms' | 'Timeline items' | 'Messages';
  title: string;
  snippet: string;
  targetPath: string;
  matchedPhrase?: string;
}
