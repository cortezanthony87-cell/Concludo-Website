/**
 * Central Collaboration and Real-time Store for Concludo.
 *
 * Unifies:
 * - Communication Hub (DMs, Team, Room, Shared Org, Project, Customer conversations)
 * - Calendar Integration & Event Invitation Workflow (Create -> Notification, Invitation, Alert, Timeline)
 * - Email Action Centre & Awaiting Action Queue
 * - Real-Time Badge Counters (Communicate, Calendar, Email)
 * - Bottom-Right Message/Email Popup Notifications (10s auto fade-out)
 * - AI Copilot Assistance
 * - File Sharing & Permissions
 *
 * Adheres strictly to Melbourne brand standards and Australian English. Zero em dashes.
 */

import {
  ActivePopupNotification,
  BadgeCounts,
  CalendarParticipant,
  CollabCalendarEvent,
  CollabConversation,
  CollabEmailItem,
  CollabMessage,
  CollabNotification,
} from './collaborationTypes';

type Listener = () => void;

const TODAY_STR = new Date().toISOString().split('T')[0];

class CollaborationStore {
  private listeners: Set<Listener> = new Set();

  private conversations: CollabConversation[] = [
    {
      id: 'room-northbridge-account',
      title: 'Northbridge account room',
      kind: 'record_room',
      subtitle: 'Internal record room linked to Northbridge Industrial',
      recordTable: 'crm_organisations',
      recordId: 'org-northbridge-ind',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isDeleted: false,
      lastMessageSnippet: 'Tom: Yes. Draft to Priya by Thursday 30 October.',
      lastMessageAt: '2026-10-21T09:34:00Z',
      membersCount: 2,
      orgName: 'Kestrel Advisory',
    },
    {
      id: 'room-operations-review-phase2',
      title: 'Operations review, phase 2',
      kind: 'record_room',
      subtitle: 'Opportunity in Proposal stage. Value $94,000',
      recordTable: 'crm_opportunities',
      recordId: 'opp-ops-phase2',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isDeleted: false,
      lastMessageSnippet: 'Scope document revised for two sites.',
      lastMessageAt: '2026-10-20T16:15:00Z',
      membersCount: 2,
      orgName: 'Kestrel Advisory',
    },
    {
      id: 'dm-tom-reyes',
      title: 'Tom Reyes',
      kind: 'direct_message',
      subtitle: 'Senior Consultant · Operations',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isDeleted: false,
      lastMessageSnippet: 'Do you need the cost breakdown before the 2pm standup?',
      lastMessageAt: '2026-10-21T10:15:00Z',
      membersCount: 2,
      orgName: 'Kestrel Advisory',
    },
    {
      id: 'team-sales-solutions',
      title: 'Sales and Solutions Team',
      kind: 'internal_team',
      subtitle: 'Weekly pipeline, proposal coordination and resource allocation',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isDeleted: false,
      lastMessageSnippet: 'Sarah: Updated proposal deck uploaded for review.',
      lastMessageAt: '2026-10-21T08:45:00Z',
      membersCount: 6,
      orgName: 'Kestrel Advisory',
    },
    {
      id: 'shared-northbridge-steering',
      title: 'Northbridge Steering Committee',
      kind: 'shared_org',
      subtitle: 'Shared workspace with Northbridge leadership team',
      unreadCount: 1,
      isMuted: false,
      isArchived: false,
      isDeleted: false,
      lastMessageSnippet: 'Priya Nair: Board pre-briefing notes uploaded.',
      lastMessageAt: '2026-10-21T11:05:00Z',
      membersCount: 5,
      orgName: 'Northbridge Industrial',
    },
    {
      id: 'proj-facility-automation',
      title: 'Facility Automation Rollout',
      kind: 'project_conversation',
      subtitle: 'Site 1 and 2 modernization roadmap',
      unreadCount: 0,
      isMuted: false,
      isArchived: false,
      isDeleted: false,
      lastMessageSnippet: 'Timeline synchronized with procurement leads.',
      lastMessageAt: '2026-10-19T14:20:00Z',
      membersCount: 4,
      orgName: 'Northbridge Industrial',
    },
  ];

  private messages: CollabMessage[] = [
    {
      id: 'msg-01',
      conversationId: 'room-northbridge-account',
      senderId: 'usr-maya-chen',
      senderName: 'Maya Chen',
      senderInitials: 'MC',
      senderOrg: 'Kestrel Advisory',
      body: 'Briefing from Northbridge session: their board meets on 6 November, so we need the revised scope to Priya Nair by Friday 31 October. Can you own the draft, Tom? Linked to Operations review, phase 2.',
      createdAt: '2026-10-21T09:20:00Z',
      isUnread: false,
      recordChips: [{ table: 'crm_opportunities', id: 'opp-ops-phase2', label: 'Operations review, phase 2' }],
      reactions: [{ emoji: '👍', count: 2 }, { emoji: '✓', count: 1 }],
    },
    {
      id: 'msg-02',
      conversationId: 'room-northbridge-account',
      senderId: 'usr-tom-reyes',
      senderName: 'Tom Reyes',
      senderInitials: 'TR',
      senderOrg: 'Kestrel Advisory',
      body: 'Yes, on it. I will have the draft ready for review by Thursday 30 October. Attaching Tuesday internal decision log.',
      createdAt: '2026-10-21T09:34:00Z',
      isUnread: true,
    },
  ];

  private calendarEvents: CollabCalendarEvent[] = [
    {
      id: 'evt-01',
      title: 'Northbridge Board Review Briefing',
      eventType: 'meeting',
      date: TODAY_STR,
      startTime: '10:00',
      endTime: '11:00',
      location: 'Melbourne HQ / Teams',
      description: 'Review final scope presentation before board meeting.',
      participants: [
        { id: 'usr-maya', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
        { id: 'usr-tom', name: 'Tom Reyes', category: 'user', orgName: 'Kestrel Advisory' },
      ],
      crmLink: 'Northbridge Industrial · S03: Account Room',
      creatorId: 'usr-maya-chen',
      creatorName: 'Maya Chen',
      status: 'accepted',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: true,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T10:00:00Z',
    },
    {
      id: 'evt-02',
      title: 'Operations Scope Milestone Delivery',
      eventType: 'milestone',
      date: TODAY_STR,
      startTime: '14:00',
      endTime: '14:30',
      location: 'Client Advisory Desk',
      description: 'Formal release of draft 2 to client steering committee.',
      participants: [
        { id: 'team-ops', name: 'Operations Team', category: 'team', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-tom-reyes',
      creatorName: 'Tom Reyes',
      status: 'pending',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: true,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T11:00:00Z',
    },
    {
      id: 'evt-03',
      title: 'Risk Workshop with Engineering',
      eventType: 'workshop',
      date: TODAY_STR,
      startTime: '15:30',
      endTime: '16:30',
      location: 'Level 4 Workshop Lab',
      description: 'Cross-functional dependency and security analysis.',
      participants: [
        { id: 'dept-eng', name: 'Engineering Department', category: 'department', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-maya-chen',
      creatorName: 'Maya Chen',
      status: 'accepted',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: true,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T12:00:00Z',
    },
    {
      id: 'evt-04',
      title: 'Client Sign-Off on Phase 1 Acceptance',
      eventType: 'sign_off',
      date: TODAY_STR,
      startTime: '16:45',
      endTime: '17:15',
      location: 'Boardroom A',
      description: 'Formal sign-off of initial plant floor discovery documentation.',
      participants: [
        { id: 'cust-nb', name: 'Northbridge Industrial', category: 'customer_org', orgName: 'Northbridge Industrial' },
      ],
      creatorId: 'usr-maya-chen',
      creatorName: 'Maya Chen',
      status: 'accepted',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: true,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T13:00:00Z',
    },
    {
      id: 'evt-05',
      title: 'Daily Action Checklist Review',
      eventType: 'task',
      date: TODAY_STR,
      startTime: '09:00',
      endTime: '09:30',
      location: 'Workspace Dashboard',
      description: 'Audit unassigned tasks and unanswered client queries.',
      participants: [
        { id: 'usr-maya', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-maya-chen',
      creatorName: 'Maya Chen',
      status: 'pending',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: false,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T08:00:00Z',
    },
    {
      id: 'evt-06',
      title: 'Client Advisory Appointment',
      eventType: 'appointment',
      date: TODAY_STR,
      startTime: '11:30',
      endTime: '12:00',
      location: 'Executive Suite',
      description: 'Governance consultation with managing director.',
      participants: [
        { id: 'usr-tom', name: 'Tom Reyes', category: 'user', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-tom-reyes',
      creatorName: 'Tom Reyes',
      status: 'accepted',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: true,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T09:30:00Z',
    },
    {
      id: 'evt-07',
      title: 'Reminder: Submit Commercial Proposal',
      eventType: 'reminder',
      date: TODAY_STR,
      startTime: '13:00',
      endTime: '13:15',
      location: 'Online',
      description: 'Send pricing summary to procurement team.',
      participants: [
        { id: 'usr-maya', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-maya-chen',
      creatorName: 'Maya Chen',
      status: 'pending',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: false,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T09:45:00Z',
    },
    {
      id: 'evt-08',
      title: 'Technical Implementation Review',
      eventType: 'review',
      date: TODAY_STR,
      startTime: '17:30',
      endTime: '18:00',
      location: 'Engineering Hub',
      description: 'Walkthrough of endpoint security and sync logs.',
      participants: [
        { id: 'team-eng', name: 'Engineering Team', category: 'team', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-tom-reyes',
      creatorName: 'Tom Reyes',
      status: 'accepted',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: true,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T10:15:00Z',
    },
    {
      id: 'evt-09',
      title: 'Follow-up Task on Customer Introduction',
      eventType: 'task',
      date: TODAY_STR,
      startTime: '18:15',
      endTime: '18:45',
      location: 'CRM Work Desk',
      description: 'Check introduction email from Priya Nair.',
      participants: [
        { id: 'usr-maya', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
      ],
      creatorId: 'usr-maya-chen',
      creatorName: 'Maya Chen',
      status: 'pending',
      addedToPersonalCalendar: true,
      addedToTeamCalendar: false,
      addedToCrmTimeline: true,
      createdAt: '2026-10-20T10:30:00Z',
    },
  ];

  private emails: CollabEmailItem[] = [
    {
      id: 'eml-01',
      sender: 'Daniel Okafor',
      senderEmail: 'daniel.okafor@northbridge.com.au',
      organisation: 'Northbridge Industrial',
      subject: 'Procurement timeline and revised scope request',
      preview: 'Could you confirm the milestone dates for the phase 2 rollout before our Thursday board committee meeting?',
      date: '2026-10-21T11:48:00Z',
      isUnread: true,
      isFlagged: true,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: true,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'urgent',
      crmRecord: { id: 'org-northbridge-ind', label: 'Northbridge Industrial', table: 'crm_organisations' },
      dueDate: '2026-10-22',
      status: 'pending',
      followUpAgeHours: 24,
      meetingInvite: {
        title: 'Northbridge Procurement Alignment Call',
        date: TODAY_STR,
        startTime: '13:30',
        endTime: '14:00',
        location: 'Microsoft Teams',
      },
    },
    {
      id: 'eml-02',
      sender: 'Priya Nair',
      senderEmail: 'priya.nair@northbridge.com.au',
      organisation: 'Northbridge Industrial',
      subject: 'Board Agenda Pre-briefing',
      preview: 'We have slotted Kestrel Advisory into the morning agenda. Please confirm participant attendees.',
      date: '2026-10-21T09:15:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: true,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: true,
      priority: 'high',
      crmRecord: { id: 'org-northbridge-ind', label: 'Northbridge Industrial', table: 'crm_organisations' },
      dueDate: '2026-10-23',
      status: 'pending',
    },
    {
      id: 'eml-03',
      sender: 'Marcus Chen',
      senderEmail: 'm.chen@kestreladvisory.com.au',
      organisation: 'Kestrel Advisory',
      subject: 'Approval required: Service Level Agreement update',
      preview: 'The legal review concluded on schedule. Please sign off on the standard liability cap.',
      date: '2026-10-21T08:30:00Z',
      isUnread: false,
      isFlagged: true,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: true,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'high',
      crmRecord: { id: 'opp-ops-phase2', label: 'Operations review, phase 2', table: 'crm_opportunities' },
      dueDate: '2026-10-22',
      status: 'pending',
      followUpAgeHours: 48,
    },
    {
      id: 'eml-04',
      sender: 'Sarah Jenkins',
      senderEmail: 'sarah.jenkins@sovereignhealth.com.au',
      organisation: 'Sovereign Health',
      subject: 'Escalation: Integration security clearance pending',
      preview: 'The hospital network architecture group requires our mutual OAuth scopes verified by midday.',
      date: '2026-10-21T07:45:00Z',
      isUnread: true,
      isFlagged: true,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: true,
      isFollowUp: true,
      isActionRequired: true,
      isSharedOrg: true,
      priority: 'urgent',
      crmRecord: { id: 'org-sovereign-health', label: 'Sovereign Health', table: 'crm_organisations' },
      dueDate: '2026-10-21',
      status: 'pending',
      followUpAgeHours: 72,
    },
    {
      id: 'eml-05',
      sender: "Liam O'Connor",
      senderEmail: 'liam@apexlogistics.com.au',
      organisation: 'Apex Logistics',
      subject: 'Follow-up on enterprise migration proposal',
      preview: 'Checking in on the diagnostic timeline we discussed last Wednesday.',
      date: '2026-10-20T15:20:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: true,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'normal',
      crmRecord: { id: 'org-apex-logistics', label: 'Apex Logistics', table: 'crm_organisations' },
      dueDate: '2026-10-24',
      status: 'in_progress',
    },
    {
      id: 'eml-06',
      sender: 'Rachel Kim',
      senderEmail: 'rachel.kim@hardingengineering.com.au',
      organisation: 'Harding Engineering',
      subject: 'Review comments on equipment diagnostic report',
      preview: 'Please confirm whether the workshop findings can be incorporated into the final appendix.',
      date: '2026-10-21T06:30:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'high',
      status: 'pending',
    },
    {
      id: 'eml-07',
      sender: 'Finance Operations',
      senderEmail: 'finance@kestreladvisory.com.au',
      organisation: 'Kestrel Advisory',
      subject: 'Approval request: Q4 software subscription renewals',
      preview: 'Authorisation requested for standard engineering workstation tooling.',
      date: '2026-10-21T06:15:00Z',
      isUnread: false,
      isFlagged: true,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: true,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'high',
      status: 'pending',
    },
    {
      id: 'eml-08',
      sender: 'Greg Henderson',
      senderEmail: 'greg.h@northbridge.com.au',
      organisation: 'Northbridge Industrial',
      subject: 'Escalation: Plant telemetry feed latency',
      preview: 'Site 2 sensors reported a 4 minute delay during morning startup check.',
      date: '2026-10-21T05:50:00Z',
      isUnread: true,
      isFlagged: true,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: true,
      isFollowUp: true,
      isActionRequired: true,
      isSharedOrg: true,
      priority: 'urgent',
      status: 'pending',
      followUpAgeHours: 24,
    },
    {
      id: 'eml-09',
      sender: 'Chloe Miller',
      senderEmail: 'chloe.miller@sovereignhealth.com.au',
      organisation: 'Sovereign Health',
      subject: 'Follow-up on hospital executive briefing format',
      preview: 'Verifying if the slides will be sent 24 hours prior to Friday session.',
      date: '2026-10-20T17:00:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: true,
      isActionRequired: true,
      isSharedOrg: true,
      priority: 'normal',
      status: 'pending',
      followUpAgeHours: 48,
    },
    {
      id: 'eml-10',
      sender: 'Legal Compliance',
      senderEmail: 'legal@kestreladvisory.com.au',
      organisation: 'Kestrel Advisory',
      subject: 'Action required: Annual data protection audit checklist',
      preview: 'Standard governance confirmation required before 31 October.',
      date: '2026-10-20T16:10:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'normal',
      status: 'pending',
    },
    {
      id: 'eml-11',
      sender: 'Steering Secretariat',
      senderEmail: 'steerco@northbridge.com.au',
      organisation: 'Northbridge Industrial',
      subject: 'Shared Organisation: November joint council pack',
      preview: 'Distribution of pre reading material for joint steering committee.',
      date: '2026-10-20T14:30:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: true,
      priority: 'high',
      status: 'pending',
    },
    {
      id: 'eml-12',
      sender: 'Elena Rostova',
      senderEmail: 'e.rostova@meridianconsulting.com.au',
      organisation: 'Meridian Consulting',
      subject: 'Contract milestone 3 acceptance schedule',
      preview: 'Milestone sign off documents are ready for our reciprocal review.',
      date: '2026-10-20T13:45:00Z',
      isUnread: false,
      isFlagged: true,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'normal',
      status: 'pending',
    },
    {
      id: 'eml-13',
      sender: 'David Vance',
      senderEmail: 'dvance@clientpartners.com.au',
      organisation: 'Client Partners Australia',
      subject: 'Inquiry regarding workflow integration scope',
      preview: 'We would like to understand whether Microsoft 365 syncing is supported.',
      date: '2026-10-20T12:00:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: false,
      isSharedOrg: false,
      priority: 'normal',
      status: 'pending',
    },
    {
      id: 'eml-14',
      sender: 'Simon Patel',
      senderEmail: 'spatel@northbridge.com.au',
      organisation: 'Northbridge Industrial',
      subject: 'Action required: Commercial fee schedule confirmation',
      preview: 'Please confirm agreed hourly rates for advisory phase 2.',
      date: '2026-10-20T11:20:00Z',
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: true,
      isSharedOrg: true,
      priority: 'urgent',
      status: 'pending',
    },
    {
      id: 'eml-archived',
      sender: 'Old Newsletter',
      senderEmail: 'news@industryupdates.com.au',
      organisation: 'Industry Updates',
      subject: 'Weekly technology digest',
      preview: 'September roundup of technology trends.',
      date: '2026-09-15T10:00:00Z',
      isUnread: false,
      isFlagged: false,
      isArchived: true, // EXCLUDED
      isDeleted: false,
      isSpam: false,
      isClosed: true,
      isCompleted: true,
      needsResponse: false,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: false,
      isActionRequired: false,
      isSharedOrg: false,
      priority: 'normal',
      status: 'completed',
    },
  ];

  private notifications: CollabNotification[] = [
    {
      id: 'notif-01',
      kind: 'message',
      title: 'Tom Reyes mentioned you',
      summary: 'Can you own the draft, Tom? Linked to Operations review, phase 2.',
      sourceRoom: 'Northbridge account room',
      senderName: 'Tom Reyes',
      targetUrl: '/crm/communicate',
      createdAt: '2026-10-21T09:34:00Z',
      isRead: false,
    },
    {
      id: 'notif-02',
      kind: 'calendar_invitation',
      title: 'Calendar Invitation: Northbridge Board Review Briefing',
      summary: 'Today at 10:00 am (1 hr) with Maya Chen and Tom Reyes.',
      sourceRoom: 'Northbridge account room',
      senderName: 'Maya Chen',
      targetUrl: '/calendar',
      createdAt: '2026-10-21T09:10:00Z',
      isRead: false,
      calendarEventId: 'evt-01',
    },
    {
      id: 'notif-03',
      kind: 'approval',
      title: 'Copilot update proposed',
      summary: 'Commitment extracted: Tom Reyes delivers revised scope by 31 Oct.',
      sourceRoom: 'Northbridge account room',
      senderName: 'Concludo Copilot',
      targetUrl: '/crm/proposals',
      createdAt: '2026-10-21T09:12:00Z',
      isRead: false,
    },
  ];

  private activePopups: ActivePopupNotification[] = [];

  // Subscribe to changes
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public completeEmail(emailId: string): void {
    const email = this.emails.find((e) => e.id === emailId);
    if (email) {
      email.isCompleted = true;
      email.isUnread = false;
      email.needsResponse = false;
      email.isActionRequired = false;
      this.emitChange();
    }
  }

  private cachedBadgeCounts: BadgeCounts | null = null;
  private version: number = 0;

  private emitChange(): void {
    this.version += 1;
    this.cachedBadgeCounts = this.computeBadgeCounts();
    for (const listener of this.listeners) {
      listener();
    }
  }

  // =========================================================================
  // BADGE COUNTERS (Real-Time Rules)
  // =========================================================================

  private computeBadgeCounts(): BadgeCounts {
    // Communicate Count:
    // Unread Direct Messages, Team Messages, CRM Room Messages,
    // Shared Organisation Messages, Project Conversations, Customer Conversations.
    // Do NOT count: Archived, Deleted, Muted.
    const communicate = this.conversations
      .filter((c) => !c.isArchived && !c.isDeleted && !c.isMuted)
      .reduce((sum, c) => sum + Math.max(0, c.unreadCount), 0);

    // Calendar Count:
    // Today's Meetings, Tasks, Reminders, Workshops, Reviews, Sign-Offs, Appointments, Milestones.
    // Active (not completed and not cancelled) and not deleted.
    const calendar = this.calendarEvents.filter(
      (e) =>
        !e.deletedAt &&
        e.date === TODAY_STR &&
        e.status !== 'completed' &&
        e.status !== 'cancelled'
    ).length;

    // Email Count:
    // Unread Emails, Flagged Emails, Customer Emails Awaiting Response,
    // Approval Requests, Escalations, Follow-Ups, Action Required Emails,
    // Shared Organisation Emails.
    // Do NOT count: Archived, Deleted, Spam, Closed Threads, Completed Responses.
    const email = this.emails.filter((e) => {
      if (e.isArchived || e.isDeleted || e.isSpam || e.isClosed || e.isCompleted) {
        return false;
      }
      return (
        e.isUnread ||
        e.isFlagged ||
        e.needsResponse ||
        e.isApprovalRequest ||
        e.isEscalation ||
        e.isFollowUp ||
        e.isActionRequired ||
        e.isSharedOrg
      );
    }).length;

    return {
      communicate,
      calendar,
      email,
    };
  }

  public getBadgeCounts(): BadgeCounts {
    if (!this.cachedBadgeCounts) {
      this.cachedBadgeCounts = this.computeBadgeCounts();
    }
    return this.cachedBadgeCounts;
  }

  public getVersion(): number {
    return this.version;
  }

  // =========================================================================
  // CONVERSATIONS & MESSAGES
  // =========================================================================

  public getConversations(): CollabConversation[] {
    return [...this.conversations].filter((c) => !c.isDeleted);
  }

  public getMessages(conversationId: string): CollabMessage[] {
    return this.messages.filter((m) => m.conversationId === conversationId && !m.isDeleted);
  }

  public sendMessage(conversationId: string, body: string, senderName = 'Maya Chen'): CollabMessage {
    const newMsg: CollabMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'usr-maya-chen',
      senderName,
      senderInitials: senderName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      senderOrg: 'Kestrel Advisory',
      body,
      createdAt: new Date().toISOString(),
      isUnread: false,
    };
    this.messages.push(newMsg);

    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessageSnippet = `${senderName.split(' ')[0]}: ${body.slice(0, 50)}`;
      conv.lastMessageAt = newMsg.createdAt;
    }

    this.emitChange();
    return newMsg;
  }

  public triggerIncomingMessage(
    conversationId: string,
    senderName: string,
    body: string,
    senderAvatar?: string
  ): void {
    const conv = this.conversations.find((c) => c.id === conversationId);
    const newMsg: CollabMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: `usr-${senderName.toLowerCase().replace(/\s+/g, '-')}`,
      senderName,
      senderInitials: senderName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      senderAvatar,
      senderOrg: conv?.orgName || 'Kestrel Advisory',
      body,
      createdAt: new Date().toISOString(),
      isUnread: true,
    };
    this.messages.push(newMsg);

    if (conv) {
      conv.unreadCount += 1;
      conv.lastMessageSnippet = `${senderName.split(' ')[0]}: ${body.slice(0, 50)}`;
      conv.lastMessageAt = newMsg.createdAt;
    }

    // Show 10-second Bottom-Right Message Popup
    this.addPopupNotification({
      id: `popup-${Date.now()}`,
      kind: 'message',
      senderName,
      senderAvatar,
      senderInitials: newMsg.senderInitials,
      roomOrOrg: conv?.title || 'CRM Record Room',
      preview: body,
      targetUrl: `/crm/communicate`,
      referenceId: newMsg.id,
      createdAt: Date.now(),
    });

    this.emitChange();
  }

  public markConversationRead(conversationId: string): void {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0;
      for (const m of this.messages) {
        if (m.conversationId === conversationId) {
          m.isUnread = false;
        }
      }
      this.emitChange();
    }
  }

  public toggleConversationMute(conversationId: string): void {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.isMuted = !conv.isMuted;
      this.emitChange();
    }
  }

  public toggleConversationArchive(conversationId: string): void {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.isArchived = !conv.isArchived;
      this.emitChange();
    }
  }

  // =========================================================================
  // CALENDAR INTEGRATION & INVITATION WORKFLOW
  // =========================================================================

  public getCalendarEvents(): CollabCalendarEvent[] {
    return [...this.calendarEvents].filter((e) => !e.deletedAt);
  }

  /**
   * Select Calendar Icon -> Open Create Calendar Item Modal.
   * When event created:
   * 1. Notification
   * 2. Calendar Invitation
   * 3. Message Centre Alert
   * 4. CRM Timeline Entry
   * Recipients receive: Accept / Decline / Tentative.
   */
  public createCalendarItem(params: {
    title: string;
    eventType: CollabCalendarEvent['eventType'];
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
    participants: CalendarParticipant[];
    crmLink?: string;
    conversationId?: string;
    creatorName?: string;
  }): CollabCalendarEvent {
    const creatorName = params.creatorName || 'Maya Chen';
    const eventId = `evt-${Date.now()}`;

    const newEvent: CollabCalendarEvent = {
      id: eventId,
      title: params.title,
      eventType: params.eventType,
      date: params.date || TODAY_STR,
      startTime: params.startTime || '09:00',
      endTime: params.endTime || '10:00',
      location: params.location || 'Melbourne HQ / Teams',
      description: params.description || '',
      participants: params.participants,
      crmLink: params.crmLink || 'Northbridge Industrial · S03: Account Room',
      creatorId: 'usr-current',
      creatorName,
      status: 'pending',
      addedToPersonalCalendar: false,
      addedToTeamCalendar: false,
      addedToCrmTimeline: true, // Step 4: CRM Timeline Entry
      createdAt: new Date().toISOString(),
    };

    this.calendarEvents.unshift(newEvent);

    // Step 1: Create Notification
    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      kind: 'calendar_invitation',
      title: `Calendar Invitation: ${params.title}`,
      summary: `Scheduled for ${params.date} at ${params.startTime} (${params.eventType}).`,
      sourceRoom: params.conversationId ? 'CRM Record Room' : 'Calendar',
      senderName: creatorName,
      targetUrl: '/calendar',
      createdAt: new Date().toISOString(),
      isRead: false,
      calendarEventId: eventId,
    });

    // Step 2 & 3: Calendar Invitation card in Room + Message Centre Alert
    if (params.conversationId) {
      const inviteMsg: CollabMessage = {
        id: `msg-inv-${Date.now()}`,
        conversationId: params.conversationId,
        senderId: 'usr-current',
        senderName: creatorName,
        senderInitials: creatorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
        senderOrg: 'Kestrel Advisory',
        body: `📅 Calendar Invitation: ${params.title}\nDate: ${params.date} from ${params.startTime} to ${params.endTime}\nLocation: ${params.location || 'Online'}\nParticipants: ${params.participants.map((p) => p.name).join(', ')}`,
        createdAt: new Date().toISOString(),
        isUnread: true,
        invitationId: eventId,
      };
      this.messages.push(inviteMsg);
    }

    this.emitChange();
    return newEvent;
  }

  /**
   * Event Acceptance:
   * If Accepted: Automatically add event to Personal Calendar, Team Calendar, CRM Timeline.
   */
  public respondToCalendarInvitation(
    eventId: string,
    response: 'accepted' | 'declined' | 'tentative'
  ): void {
    const event = this.calendarEvents.find((e) => e.id === eventId);
    if (event) {
      event.status = response;
      if (response === 'accepted') {
        event.addedToPersonalCalendar = true;
        event.addedToTeamCalendar = true;
        event.addedToCrmTimeline = true;
      }
      this.emitChange();
    }
  }

  public completeTask(eventId: string): void {
    const event = this.calendarEvents.find((e) => e.id === eventId);
    if (event) {
      event.status = 'completed';
      this.emitChange();
    }
  }

  public deleteCalendarItem(eventId: string): void {
    const event = this.calendarEvents.find((e) => e.id === eventId);
    if (event) {
      event.deletedAt = new Date().toISOString();
      this.emitChange();
    }
  }

  // =========================================================================
  // EMAIL ACTION CENTRE & INTEGRATIONS
  // =========================================================================

  public getEmails(): CollabEmailItem[] {
    return [...this.emails].filter((e) => !e.isDeleted);
  }

  public triggerIncomingEmail(email: Partial<CollabEmailItem>): void {
    const newEmail: CollabEmailItem = {
      id: `eml-${Date.now()}`,
      sender: email.sender || 'Alex Ward',
      senderEmail: email.senderEmail || 'alex.ward@clientgroup.com.au',
      organisation: email.organisation || 'Client Solutions Group',
      subject: email.subject || 'Quarterly Strategy Follow-up',
      preview: email.preview || 'Following up on our discussed milestone schedule and deliverables.',
      date: new Date().toISOString(),
      isUnread: true,
      isFlagged: false,
      isArchived: false,
      isDeleted: false,
      isSpam: false,
      isClosed: false,
      isCompleted: false,
      needsResponse: true,
      isApprovalRequest: false,
      isEscalation: false,
      isFollowUp: true,
      isActionRequired: true,
      isSharedOrg: false,
      priority: 'high',
      status: 'pending',
      ...email,
    };

    this.emails.unshift(newEmail);

    // Show 10-second Bottom-Right Email Popup
    this.addPopupNotification({
      id: `popup-${Date.now()}`,
      kind: 'email',
      senderName: newEmail.sender,
      senderInitials: newEmail.sender.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      roomOrOrg: newEmail.organisation,
      subject: newEmail.subject,
      preview: newEmail.preview,
      targetUrl: `/email`,
      referenceId: newEmail.id,
      createdAt: Date.now(),
    });

    this.emitChange();
  }

  public markEmailRead(emailId: string): void {
    const email = this.emails.find((e) => e.id === emailId);
    if (email && email.isUnread) {
      email.isUnread = false;
      this.emitChange();
    }
  }

  public convertEmailToCrm(
    emailId: string,
    target: 'crm_conversation' | 'task' | 'calendar_event' | 'opportunity' | 'service_request' | 'project_discussion'
  ): { success: boolean; label: string } {
    const email = this.emails.find((e) => e.id === emailId);
    if (!email) return { success: false, label: 'Email not found' };

    if (target === 'calendar_event' || target === 'task') {
      this.createCalendarItem({
        title: `${target === 'task' ? 'Task from Email' : 'Meeting from Email'}: ${email.subject}`,
        eventType: target === 'task' ? 'task' : 'meeting',
        date: TODAY_STR,
        startTime: '10:00',
        endTime: '10:30',
        description: `Created from email from ${email.sender} (${email.organisation}): ${email.preview}`,
        participants: [{ id: 'usr-sender', name: email.sender, category: 'user', email: email.senderEmail, orgName: email.organisation }],
        crmLink: email.crmRecord ? `${email.crmRecord.label}` : 'Northbridge Industrial',
      });
    } else if (target === 'crm_conversation') {
      const newConv: CollabConversation = {
        id: `conv-email-${Date.now()}`,
        title: `${email.organisation} · ${email.subject.slice(0, 30)}`,
        kind: 'customer_conversation',
        subtitle: `Converted from email from ${email.sender}`,
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
        isDeleted: false,
        lastMessageSnippet: `${email.sender}: ${email.preview.slice(0, 45)}`,
        lastMessageAt: new Date().toISOString(),
        membersCount: 2,
        orgName: email.organisation,
      };
      this.conversations.unshift(newConv);
    }

    email.status = 'in_progress';
    this.emitChange();
    return { success: true, label: `Converted to ${target.replace(/_/g, ' ')}` };
  }

  /**
   * One-Click "Add To Calendar" for Meeting Invitations in Email.
   * Automatically creates: Calendar Event, CRM Link, Attendees, Timeline Entry.
   */
  public addEmailInviteToCalendar(emailId: string): CollabCalendarEvent | null {
    const email = this.emails.find((e) => e.id === emailId);
    if (!email || !email.meetingInvite) return null;

    const inv = email.meetingInvite;
    const event = this.createCalendarItem({
      title: inv.title,
      eventType: 'meeting',
      date: inv.date,
      startTime: inv.startTime,
      endTime: inv.endTime,
      location: inv.location,
      description: `One-click calendar integration from email invitation sent by ${email.sender}.`,
      participants: [
        { id: 'usr-sender', name: email.sender, category: 'user', email: email.senderEmail, orgName: email.organisation },
        { id: 'usr-maya', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
      ],
      crmLink: email.crmRecord ? email.crmRecord.label : 'Northbridge Industrial',
    });

    event.status = 'accepted';
    event.addedToPersonalCalendar = true;
    event.addedToTeamCalendar = true;
    event.addedToCrmTimeline = true;

    this.emitChange();
    return event;
  }

  // =========================================================================
  // POPUP NOTIFICATIONS (Bottom-Right 320px, 10s auto fade-out)
  // =========================================================================

  public getActivePopups(): ActivePopupNotification[] {
    return this.activePopups;
  }

  public addPopupNotification(popup: ActivePopupNotification): void {
    this.activePopups.push(popup);
    this.emitChange();

    // Auto fade out after 10 seconds
    setTimeout(() => {
      this.dismissPopup(popup.id);
    }, 10000);
  }

  public dismissPopup(popupId: string): void {
    const idx = this.activePopups.findIndex((p) => p.id === popupId);
    if (idx !== -1) {
      this.activePopups.splice(idx, 1);
      this.emitChange();
    }
  }

  public openPopup(popupId: string): ActivePopupNotification | undefined {
    const popup = this.activePopups.find((p) => p.id === popupId);
    if (popup) {
      if (popup.kind === 'message') {
        const msg = this.messages.find((m) => m.id === popup.referenceId);
        if (msg) msg.isUnread = false;
        const conv = this.conversations.find(
          (c) => c.title === popup.roomOrOrg || c.id === msg?.conversationId
        );
        if (conv && conv.unreadCount > 0) {
          conv.unreadCount = Math.max(0, conv.unreadCount - 1);
        }
      } else if (popup.kind === 'email') {
        const eml = this.emails.find((e) => e.id === popup.referenceId);
        if (eml) eml.isUnread = false;
      }
      this.dismissPopup(popupId);
      this.emitChange();
    }
    return popup;
  }

  // =========================================================================
  // NOTIFICATIONS CENTRE
  // =========================================================================

  public getNotifications(): CollabNotification[] {
    return this.notifications;
  }

  public markNotificationRead(id: string): void {
    const n = this.notifications.find((notif) => notif.id === id);
    if (n) {
      n.isRead = true;
      this.emitChange();
    }
  }
}

export const collaborationStore = new CollaborationStore();

/** Hook to subscribe to collaboration store updates in any component */
import { useSyncExternalStore } from 'react';

export function useCollaboration(): CollaborationStore {
  useSyncExternalStore(
    (onStoreChange) => collaborationStore.subscribe(onStoreChange),
    () => collaborationStore.getVersion()
  );
  return collaborationStore;
}

export function useBadgeCounts(): BadgeCounts {
  return useSyncExternalStore(
    (onStoreChange) => collaborationStore.subscribe(onStoreChange),
    () => collaborationStore.getBadgeCounts()
  );
}
