/**
 * The synthetic personal inbox.
 *
 * Separate file, separate account, separate dataset. The work and personal
 * accounts are never merged, and keeping their data in different modules is the
 * cheapest way to make an accidental merge obvious in review rather than
 * discoverable only in production.
 *
 * Everything here is invented. All addresses use the reserved .example domain.
 *
 * The personal account is deliberately quieter than the work account. Three
 * threads is what a personal inbox looks like on a Monday morning, and a
 * personal account padded out to match the work one would misrepresent what the
 * account separation is actually protecting.
 */
import { Classification } from '../model';
import { buildPriority, factors } from '../priority';
import { DEMO_NOW } from './clock';
import { ageInDaysAt, analysis, draft, from, person, Scenario, thread } from './builders';

const ACC = 'acct-personal-01';
const SELF = 'you@personal.example';

const me = (role: 'from' | 'to' | 'cc') => person(SELF, 'You', role, { isSelf: true });

function cls(
  threadId: string,
  messageId: string,
  quote: string,
  category: Classification['category'],
  options: { tags?: string[]; isBulk?: boolean } = {}
): Classification {
  return {
    ...from(threadId, messageId, quote),
    category,
    sensitivity: 'standard',
    tags: options.tags ?? [],
    isBulk: options.isBulk ?? false,
  };
}

/* ============================================= 15. a personal email */

const t15 = thread({
  id: 'thr-p-001',
  accountId: ACC,
  accountType: 'personal',
  subject: 'Dad birthday lunch, are we doing the Sunday or the Saturday',
  folder: 'inbox',
  labels: ['family'],
  isRead: false,
  messages: [
    {
      id: 'msg-p-001-1',
      sentAt: '2026-10-11T19:40:00+11:00',
      isRead: false,
      participants: [
        person('ro.santos@personalmail.example', 'Ro Santos', 'from'),
        me('to'),
        person('mel.santos@personalmail.example', 'Mel Santos', 'cc'),
      ],
      subject: 'Dad birthday lunch, are we doing the Sunday or the Saturday',
      body: [
        'Hey,',
        '',
        'Mel can do either but needs to book the table by Wednesday or we will not get',
        'in. Are you right for the Saturday or does the Sunday suit you better?',
        '',
        'Ro',
      ].join('\n'),
    },
  ],
});

const s15: Scenario = (() => {
  const priority = buildPriority(
    factors([
      ['deadline_proximity', 7, 'The table has to be booked by Wednesday.'],
      ['consequence_of_delay', 5, 'No booking means no table for your father birthday.'],
      ['explicit_request', 9, 'A direct question about which day suits you.'],
      ['work_blocked', 6, 'Mel cannot book the table until you answer.'],
      ['sensitivity', 0, ''],
      ['prior_commitment', 0, ''],
      ['unanswered_follow_ups', 0, ''],
      ['relationship_impact', 8, 'Family.'],
      ['ease_of_resolution', 9, 'One word, once you have looked at the weekend.'],
    ]),
    'high'
  ,
    {},
    { ageDays: ageInDaysAt(t15.thread.firstMessageAt, DEMO_NOW), resolved: false }
  );

  return {
    thread: t15.thread,
    messages: t15.messages,
    attachments: [],
    securityAlert: null,
    analysis: analysis({
      threadId: 'thr-p-001',
      accountId: ACC,
      accountType: 'personal',
      subject: t15.thread.subject,
      oneLineSummary: 'Ro needs to know whether Saturday or Sunday suits for your father birthday lunch.',
      whyItMatters: 'Mel cannot book the table until you answer, and it has to be booked by Wednesday.',
      currentStatus: 'waiting_on_user',
      priority,
      replyRequired: true,
      replyReason: 'A direct question with a booking deadline behind it.',
      senderRequest: 'Whether Saturday or Sunday suits you for the lunch.',
      recommendedNextStep: 'Check the weekend and tell Ro which day.',
      draftStatus: 'clarification_required',
      classification: cls('thr-p-001', 'msg-p-001-1', 'Are you right for the Saturday or does the Sunday suit you better?', 'personal', {
        tags: ['family'],
      }),
      estimatedEffortMinutes: 2,
      explicitDeadlines: [
        {
          ...from('thr-p-001', 'msg-p-001-1', 'needs to book the table by Wednesday or we will not get in'),
          id: 'dln-p-001-1',
          description: 'The restaurant booking has to be made by Wednesday.',
          dueAt: '2026-10-14T17:00:00+11:00',
          basis: 'stated',
          consequence: 'No table on the day.',
          ownerIsSelf: false,
        },
      ],
      openQuestions: [
        {
          ...from('thr-p-001', 'msg-p-001-1', 'Are you right for the Saturday or does the Sunday suit you better?'),
          id: 'oqn-p-001-1',
          question: 'Saturday or Sunday?',
          askedBy: 'ro.santos@personalmail.example',
          askedByIsSelf: false,
          askedAt: '2026-10-11T19:40:00+11:00',
          answered: false,
        },
      ],
      confidence: 'high',
    }),
    draft: draft({
      threadId: 'thr-p-001',
      status: 'clarification_required',
      createdAt: '2026-10-12T08:29:00+11:00',
      statusReason: 'Only you know which day you are free.',
      missingInformation: ['Whether you are free on the Saturday or the Sunday.'],
    }),
  };
})();

/* ===================================== personal: appointment confirmation */

const tp2 = thread({
  id: 'thr-p-002',
  accountId: ACC,
  accountType: 'personal',
  subject: 'Service booking confirmed, Thursday 7:30am',
  folder: 'inbox',
  labels: [],
  messages: [
    {
      id: 'msg-p-002-1',
      sentAt: '2026-10-11T14:02:00+11:00',
      participants: [
        person('bookings@kerrisdale-motors.example', 'Kerrisdale Motors', 'from', {
          organisation: 'Kerrisdale Motors',
        }),
        me('to'),
      ],
      subject: 'Service booking confirmed, Thursday 7:30am',
      body: 'Your service is confirmed for Thursday 16 October at 7:30am. Please allow a full day. Reply to this email to change it.',
    },
  ],
});

const sp2: Scenario = (() => {
  const priority = buildPriority(
    factors([
      ['deadline_proximity', 4, 'Thursday 7:30am, and it needs a full day.'],
      ['consequence_of_delay', 3, 'A missed booking usually means a fee and a wait for the next slot.'],
      ['explicit_request', 0, ''],
      ['work_blocked', 0, ''],
      ['sensitivity', 2, ''],
      ['prior_commitment', 0, ''],
      ['unanswered_follow_ups', 0, ''],
      ['relationship_impact', 0, ''],
      ['ease_of_resolution', 2, ''],
    ]),
    'high'
  ,
    {},
    { ageDays: ageInDaysAt(tp2.thread.firstMessageAt, DEMO_NOW), resolved: false }
  );

  return {
    thread: tp2.thread,
    messages: tp2.messages,
    attachments: [],
    securityAlert: null,
    analysis: analysis({
      threadId: 'thr-p-002',
      accountId: ACC,
      accountType: 'personal',
      subject: tp2.thread.subject,
      oneLineSummary: 'The car service is booked for Thursday at 7:30am and takes the full day.',
      whyItMatters: 'It takes a whole working day, so anything booked on Thursday needs checking.',
      currentStatus: 'information_only',
      priority,
      replyRequired: false,
      replyReason: 'A confirmation. Nothing is being asked of you unless you want to change it.',
      recommendedNextStep: 'Check Thursday against your work calendar.',
      draftStatus: 'withheld_for_safety',
      classification: cls('thr-p-002', 'msg-p-002-1', 'Your service is confirmed for Thursday 16 October at 7:30am.', 'notification'),
      estimatedEffortMinutes: 0,
      explicitDeadlines: [
        {
          ...from('thr-p-002', 'msg-p-002-1', 'Thursday 16 October at 7:30am. Please allow a full day.'),
          id: 'dln-p-002-1',
          description: 'Car service appointment, full day.',
          dueAt: '2026-10-16T07:30:00+11:00',
          basis: 'stated',
          consequence: 'A missed booking and a wait for the next slot.',
          ownerIsSelf: true,
        },
      ],
      confidence: 'high',
    }),
    draft: draft({
      threadId: 'thr-p-002',
      status: 'withheld_for_safety',
      createdAt: '2026-10-12T08:29:00+11:00',
      statusReason: 'Nothing has been asked. A reply here would only change the booking.',
    }),
  };
})();

/* ================================================== personal: newsletter */

const tp3 = thread({
  id: 'thr-p-003',
  accountId: ACC,
  accountType: 'personal',
  subject: 'Weekend at the market: what is in season',
  folder: 'inbox',
  labels: ['newsletters'],
  messages: [
    {
      id: 'msg-p-003-1',
      sentAt: '2026-10-11T06:00:00+11:00',
      participants: [
        person('hello@fernvale-growers.example', 'Fernvale Growers', 'from'),
        me('to'),
      ],
      subject: 'Weekend at the market: what is in season',
      body: 'Broad beans, early stone fruit and the last of the citrus. Stall 14, Saturday from 7am.',
    },
  ],
});

const sp3: Scenario = (() => {
  const priority = buildPriority(
    factors([
      ['deadline_proximity', 0, ''],
      ['consequence_of_delay', 0, ''],
      ['explicit_request', 0, ''],
      ['work_blocked', 0, ''],
      ['sensitivity', 0, ''],
      ['prior_commitment', 0, ''],
      ['unanswered_follow_ups', 0, ''],
      ['relationship_impact', 0, ''],
      ['ease_of_resolution', 0, ''],
    ]),
    'high'
  ,
    {},
    { ageDays: ageInDaysAt(tp3.thread.firstMessageAt, DEMO_NOW), resolved: false }
  );

  return {
    thread: tp3.thread,
    messages: tp3.messages,
    attachments: [],
    securityAlert: null,
    analysis: analysis({
      threadId: 'thr-p-003',
      accountId: ACC,
      accountType: 'personal',
      subject: tp3.thread.subject,
      oneLineSummary: 'A weekly market newsletter.',
      whyItMatters: 'It does not.',
      currentStatus: 'information_only',
      priority,
      replyRequired: false,
      replyReason: 'Bulk mail.',
      recommendedNextStep: 'Nothing.',
      draftStatus: 'withheld_for_safety',
      classification: cls('thr-p-003', 'msg-p-003-1', 'Stall 14, Saturday from 7am.', 'newsletter', {
        tags: ['bulk'],
        isBulk: true,
      }),
      estimatedEffortMinutes: 0,
      confidence: 'high',
    }),
    draft: draft({
      threadId: 'thr-p-003',
      status: 'withheld_for_safety',
      createdAt: '2026-10-12T08:29:00+11:00',
      statusReason: 'Nobody replies to a newsletter.',
    }),
  };
})();

export const PERSONAL_SCENARIOS: readonly Scenario[] = [s15, sp2, sp3];
