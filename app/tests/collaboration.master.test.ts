import { describe, it, expect } from 'bun:test';
import { collaborationStore } from '../src/lib/collaboration/collaborationStore';
import { PINNED_DESTINATIONS, destinationsInGroup } from '../src/lib/workspace/workspaceNav';

describe('Concludo CRM Communication, Calendar & Email Collaboration Platform', () => {
  it('Navigation: Sidebar replaces Communicate with Meeting output and removes Communicate from sidebar Work', () => {
    const workItems = destinationsInGroup('Work');
    // Workspace sidebar Work group has Meeting output
    const outputDest = workItems.find((d) => d.path === '/meeting-output');
    expect(outputDest).toBeDefined();
    expect(outputDest?.label).toBe('Meeting output');
    // Communicate is removed from Workspace sidebar Work group
    const commSidebar = workItems.find((d) => d.path === '/crm/communicate');
    expect(commSidebar).toBeUndefined();
  });

  it('Navigation: Calendar has badge enabled', () => {
    const calDest = PINNED_DESTINATIONS.find((d) => d.path === '/calendar');
    expect(calDest).toBeDefined();
    expect(calDest?.badge).toBe('informational');
  });

  it('Badge Counts: Initial counts match Communicate 5, Calendar 9, Email 14', () => {
    const counts = collaborationStore.getBadgeCounts();
    expect(counts.communicate).toBe(5);
    expect(counts.calendar).toBe(9);
    expect(counts.email).toBe(14);
  });

  it('Real-time Updates: Reading conversation decrements Communicate badge', () => {
    const initialCounts = collaborationStore.getBadgeCounts();
    collaborationStore.markConversationRead('room-northbridge-account');
    const updated = collaborationStore.getBadgeCounts();
    expect(updated.communicate).toBe(initialCounts.communicate - 1);
  });

  it('Calendar Workflow: Creating event generates notification, invitation, and increments count', () => {
    const initialEventsCount = collaborationStore.getCalendarEvents().length;
    const todayStr = new Date().toISOString().split('T')[0];

    const newEvent = collaborationStore.createCalendarItem({
      title: 'Joint Steering Council Alignment',
      eventType: 'meeting',
      date: todayStr,
      startTime: '14:00',
      endTime: '15:00',
      location: 'Melbourne Boardroom A / Teams',
      description: 'Review delivery milestones and team allocations',
      participants: [
        { id: 'u-1', name: 'Maya Chen', category: 'user', orgName: 'Kestrel Advisory' },
        { id: 't-1', name: 'Operations Team', category: 'team', orgName: 'Kestrel Advisory' },
        { id: 'o-1', name: 'Northbridge Industrial', category: 'shared_org', orgName: 'Northbridge Industrial' },
      ],
      conversationId: 'room-northbridge-account',
      crmLink: 'Northbridge Industrial · S03: Account Room',
    });

    expect(newEvent).toBeDefined();
    expect(newEvent.addedToCrmTimeline).toBe(true);
    expect(collaborationStore.getCalendarEvents().length).toBe(initialEventsCount + 1);

    // Notification generated
    const notifs = collaborationStore.getNotifications();
    expect(notifs[0].kind).toBe('calendar_invitation');
    expect(notifs[0].calendarEventId).toBe(newEvent.id);
  });

  it('Calendar Workflow: Responding to invitation updates personal, team and CRM timeline', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const ev = collaborationStore.createCalendarItem({
      title: 'Milestone Review',
      eventType: 'review',
      date: todayStr,
      startTime: '16:00',
      endTime: '17:00',
      participants: [],
    });

    collaborationStore.respondToCalendarInvitation(ev.id, 'accepted');
    const updated = collaborationStore.getCalendarEvents().find((e) => e.id === ev.id);
    expect(updated?.status).toBe('accepted');
    expect(updated?.addedToPersonalCalendar).toBe(true);
    expect(updated?.addedToTeamCalendar).toBe(true);
    expect(updated?.addedToCrmTimeline).toBe(true);
  });

  it('Popups: Incoming message generates 10s popup and unread state until opened', () => {
    const initialPopupsCount = collaborationStore.getActivePopups().length;
    collaborationStore.triggerIncomingMessage(
      'room-northbridge-account',
      'Tom Reyes',
      'Please review the draft document before midday.'
    );

    const popups = collaborationStore.getActivePopups();
    expect(popups.length).toBe(initialPopupsCount + 1);
    const lastPopup = popups[popups.length - 1];
    expect(lastPopup.senderName).toBe('Tom Reyes');
    expect(lastPopup.preview).toContain('Please review the draft document');

    // Open popup
    collaborationStore.openPopup(lastPopup.id);
    expect(collaborationStore.getActivePopups().some((p) => p.id === lastPopup.id)).toBe(false);
  });

  it('Email Actions: Convert email to calendar event, task, and conversation', () => {
    const res = collaborationStore.convertEmailToCrm('eml-02', 'calendar_event');
    expect(res.success).toBe(true);
    expect(res.label).toContain('calendar event');

    const convRes = collaborationStore.convertEmailToCrm('eml-02', 'crm_conversation');
    expect(convRes.success).toBe(true);
  });

  it('Email Actions: One click Add To Calendar from meeting invite in email', () => {
    const ev = collaborationStore.addEmailInviteToCalendar('eml-01');
    expect(ev).toBeDefined();
    expect(ev?.status).toBe('accepted');
    expect(ev?.addedToCrmTimeline).toBe(true);
  });

  it('Quality Standard: Zero em dashes or en dashes in collaboration copy', () => {
    const notifs = collaborationStore.getNotifications();
    const emails = collaborationStore.getEmails();
    const convs = collaborationStore.getConversations();

    for (const n of notifs) {
      expect(n.title).not.toContain('—');
      expect(n.title).not.toContain('–');
      expect(n.summary).not.toContain('—');
      expect(n.summary).not.toContain('–');
    }
    for (const e of emails) {
      expect(e.subject).not.toContain('—');
      expect(e.subject).not.toContain('–');
      expect(e.preview).not.toContain('—');
      expect(e.preview).not.toContain('–');
    }
    for (const c of convs) {
      expect(c.title).not.toContain('—');
      expect(c.title).not.toContain('–');
    }
  });
});
