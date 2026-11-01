import { describe, it, expect } from 'bun:test';
import {
  analyseMeeting,
  resolveDue,
  followUpEmail,
} from '../src/lib/intelligence/meetingEngine';

describe('Meeting Engine Fixes v1 (F1 - F9 Independent Unit Tests)', () => {
  it('F1: Dates - stated day of month wins, next week calculation, and no trailing prepositions', () => {
    const baseDate = '2026-10-27'; // Tuesday
    // Stated ordinal wins over nearest Thursday
    const due1 = resolveDue('submit the audit by Thursday the twenty-sixth', baseDate);
    expect(due1?.iso).toBe('2026-11-26');

    // Wednesday next week from Thursday 29 October is 4 November
    const thursDate = '2026-10-29';
    const due2 = resolveDue('prepare the briefing Wednesday next week', thursDate);
    expect(due2?.iso).toBe('2026-11-04');

    // Mismatched weekday and ordinal day should not pick one silently
    // 12 Nov 2026 is a Thursday, not a Tuesday
    const dueMismatch = resolveDue('finalize the policy by Tuesday the twelfth', baseDate);
    expect(dueMismatch?.iso).toBeUndefined();
    expect(dueMismatch?.uncertain).toBe(true);

    // Trailing preposition should be stripped and not left dangling
    const m = analyseMeeting([
      {
        name: 'transcript.txt',
        kind: 'transcript',
        text: 'Marcus Vance: I will follow up with the regulatory liaison by the end of November.',
      },
    ], { meetingDate: baseDate });
    expect(m.actions.length).toBe(1);
    expect(m.actions[0].task).not.toMatch(/\s+(?:by|before|due|on|until|at|ahead of|by the end of)$/i);
    expect(m.actions[0].task).toBe('Follow up with the regulatory liaison');
  });

  it('F2: Resolve "that", "it" and plain assent from previous turn', () => {
    const transcript = [
      'Sarah Connor: Why don\'t we switch our cloud storage provider to Sydney next quarter?',
      'Kyle Reese: Works for me.',
      'Sarah Connor: Can you audit the database permissions before Friday?',
      'Kyle Reese: I can do that tonight.',
    ].join('\n');

    const m = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcript },
    ], { meetingDate: '2026-10-27' });

    // Assent in turn 2 should resolve proposal in turn 1 as decision
    expect(m.decisions.length).toBeGreaterThanOrEqual(1);
    const d = m.decisions[0];
    expect(d.statement).toBe('Switch our cloud storage provider to Sydney next quarter');
    expect(d.statement).not.toBe('Works for me');

    // Action with bare pronoun "do that" should resolve to request in turn 3
    expect(m.actions.length).toBeGreaterThanOrEqual(1);
    const a = m.actions.find(act => act.owner === 'Kyle Reese');
    expect(a).toBeDefined();
    expect(a!.task).toBe('Audit the database permissions');
    expect(a!.task).not.toBe('Do that');
  });

  it('F3: Person asked owns the action', () => {
    const transcript = [
      'David Brent: Elena, I\'ll need the regional sales projections from you by Monday.',
      'Elena Fisher: Sure, I\'ll get them across to you.',
    ].join('\n');

    const m = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcript },
    ], { meetingDate: '2026-10-27' });

    expect(m.actions.length).toBe(1);
    expect(m.actions[0].owner).toBe('Elena Fisher');
    expect(m.actions[0].owner).not.toBe('David Brent');
    expect(m.actions[0].due).toBe('2026-11-02');
  });

  it('F4: Open questions extracted with deferrals and without immediate decision', () => {
    const transcript = [
      'Carol Danvers: Should we upgrade our cybersecurity insurance coverage limits for overseas staff?',
      'Bruce Banner: Not sure, let me check with our underwriter by Friday.',
    ].join('\n');

    const m = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcript },
    ], { meetingDate: '2026-10-27' });

    expect(m.openItems.length).toBeGreaterThanOrEqual(1);
    const q = m.openItems[0];
    expect(q.question).toContain('Should we upgrade our cybersecurity insurance coverage limits for overseas staff');
    expect(q.raisedBy).toBe('Carol Danvers');
  });

  it('F5: Next meeting extraction handles date, time and agreed agenda; ignores casual phone calls', () => {
    const transcriptWithMeeting = [
      'Alice Walker: Let\'s meet same time next Thursday at 3:00 pm to finalize the joint venture agreement.',
      'Bob Stone: Agreed, see you then.',
    ].join('\n');

    const m1 = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcriptWithMeeting },
    ], { meetingDate: '2026-10-27' }); // Tuesday

    expect(m1.nextMeeting).toBeDefined();
    expect(m1.nextMeeting?.date).toBe('2026-11-05');
    expect(m1.nextMeeting?.time).toBe('3:00 pm');
    expect(m1.nextMeeting?.mustProduce).toContain('finalize the joint venture agreement');

    // Phone call promise should NOT be treated as a next meeting
    const transcriptWithPhone = [
      'Alice Walker: I will give you a call tomorrow afternoon.',
      'Bob Stone: Sounds good, talk then.',
    ].join('\n');

    const m2 = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcriptWithPhone },
    ], { meetingDate: '2026-10-27' });

    expect(m2.nextMeeting).toBeUndefined();
    const email = followUpEmail(m2);
    expect(email.body).toContain('NEXT MEETING\nNo next meeting set');
  });

  it('F6: Decisions & risk cues, contradictions', () => {
    const transcript = [
      'Rachel Green: Scrap the custom frontend rebuild, we will go with the open source portal instead.',
      'Ross Geller: My concern is that if the security audit slips we could miss our retail launch date.',
    ].join('\n');

    const m = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcript },
    ], { meetingDate: '2026-10-27' });

    expect(m.decisions.length).toBeGreaterThanOrEqual(1);
    expect(m.decisions[0].statement).toContain('open source portal');
    expect(m.flags).toContain('contradiction');

    expect(m.risks.length).toBeGreaterThanOrEqual(1);
    expect(m.risks[0].risk).toContain('security audit slips');
  });

  it('F7: Formats - typed minutes with RESOLVED and ACTION lines, and generic speaker turns', () => {
    const minutes = [
      '# Annual General Meeting',
      'Date: 28 October 2026',
      'Attendees: Nathan Drake (Chair), Chloe Frazer (Secretary)',
      '',
      '- RESOLVED: Adopt the updated charter for the governance committee.',
      '- ACTION: Chloe - draft the media statement by Friday.',
    ].join('\n');

    const mMinutes = analyseMeeting([
      { name: 'minutes.md', kind: 'notes', text: minutes },
    ], { meetingDate: '2026-10-28' });

    expect(mMinutes.decisions.length).toBe(1);
    expect(mMinutes.decisions[0].calledBy).toBe('Nathan Drake'); // Chair
    expect(mMinutes.actions.length).toBe(1);
    expect(mMinutes.actions[0].owner).toBe('Chloe Frazer'); // Resolved from first name Chloe
    expect(mMinutes.actions[0].due).toBe('2026-10-30');

    // Generic speaker label
    const genericTranscript = [
      'Speaker 1 (01:45): We have unanimously decided to freeze new hiring for Q1.',
      'Speaker 2 (02:10): I will send the memorandum to department heads by tomorrow.',
    ].join('\n');

    const mGeneric = analyseMeeting([
      { name: 'call.txt', kind: 'transcript', text: genericTranscript },
    ], { meetingDate: '2026-10-28' });

    expect(mGeneric.decisions.length).toBe(1);
    expect(mGeneric.flags).toContain('speaker_ambiguity');
  });

  it('F8: Quality flags raised appropriately and never leak into client email', () => {
    const transcriptWithSensitive = [
      'Peter Parker: The temporary password is SecretKey2026 for the staging database.',
      'Norman Osborn: Understood, delete that note.',
    ].join('\n');

    const m = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: transcriptWithSensitive },
    ], { meetingDate: '2026-10-28' });

    expect(m.flags).toContain('sensitive_content_withheld');

    const clientMail = followUpEmail(m, { audience: 'client' });
    expect(clientMail.body).not.toContain('sensitive_content_withheld');
    expect(clientMail.body).not.toContain('SecretKey2026');
    expect(clientMail.body).not.toContain('FLAGS');
  });

  it('F9: Email template formatting rules', () => {
    const m = analyseMeeting([
      {
        name: 'notes.md',
        kind: 'notes',
        text: '# Executive Strategy Review\nDate: 29 October 2026\n- Decision: Approve expansion into regional Victoria\n- Action: Luke to prepare logistics model by 10 November',
      },
    ], { meetingDate: '2026-10-29' });

    const mail = followUpEmail(m);

    // Title ending in review should not duplicate: "Executive Strategy Review Review"
    expect(mail.subject).not.toMatch(/Review\s+Review/i);

    // Context line ends in single full stop (double full stops removed)
    const contextMatch = mail.body.match(/CONTEXT\n([^\n]+)/);
    expect(contextMatch).not.toBeNull();
    expect(contextMatch![1]).toMatch(/\.$/);
    expect(contextMatch![1]).not.toMatch(/\.\.$/);

    // Confirmed by column is removed unless confirmation method is stated
    expect(mail.body).not.toContain('Confirmed by');
    expect(mail.body).toContain('| Action | Owner | By');
  });
});

  it('Template Fixes 1-5: Attendees cleaned, focus recomputed, open questions formatted, dangling headline trimmed', () => {
    const rawTranscript = [
      'Harry Bolt  0: Morning all.',
      'Callum Reid  0: Let\'s agree on the brake repair.',
      'Harry Bolt  1: On it.',
    ].join('\n');

    const m = analyseMeeting([
      { name: 'transcript.txt', kind: 'transcript', text: rawTranscript }
    ], {
      title: 'Summer season readiness meeting',
      meetingType: 'Meeting',
      meetingDate: '2026-11-20',
      organisation: 'Tourism Operator'
    });

    // Manually add participants with trailing timestamps to simulate raw extractor
    m.participants = [
      { name: 'Harry Bolt  0', present: true },
      { name: 'Harry Bolt  1', present: true }, // duplicate
      { name: 'Callum Reid  0', present: true },
    ];

    m.decisions = [
      {
        id: 'D01',
        statement: 'Repair bus two rather than replace it this season of the three', // has dangling words at 60 chars
        status: 'agreed',
        confidence: 'explicit',
        evidence: [],
        review: 'confirmed'
      }
    ];

    m.actions = [
      {
        id: 'A01',
        task: 'Book the brake repair for bus two',
        owner: 'Harry Bolt',
        due: '2026-11-23',
        dueApprox: false,
        evidence: [],
        gaps: [],
        horizon: 'now',
        confidence: 'explicit',
        review: 'confirmed'
      }
    ];

    m.openItems = [
      {
        id: 'Q01',
        question: 'Can Mei Lin\'s bonus be counted?',
        kind: 'unresolved',
        resolver: 'Priya Shah',
        neededBy: 'Fri 6 Nov',
        evidence: [],
        review: 'confirmed'
      },
      {
        id: 'Q02',
        question: 'Should part of the loan be fixed',
        kind: 'unresolved',
        evidence: [],
        review: 'confirmed'
      }
    ];

    const mail = followUpEmail(m, { audience: 'client' });

    // Fix 1: Attendees cleaned and deduplicated
    expect(mail.body).toContain('Harry Bolt, Callum Reid');
    expect(mail.body).not.toContain('Harry Bolt  0');
    expect(mail.body).not.toContain('Callum Reid  0');

    // Fix 2 & 3: Focus line dynamically computed from confirmed items, no double full stops
    expect(mail.body).toContain('Focus: The meeting made one decision:');
    expect(mail.body).not.toContain('No decision was recorded');
    expect(mail.body).not.toMatch(/\.\./);

    // Fix 4: Open questions formatting
    expect(mail.body).toContain('Q01 Can Mei Lin\'s bonus be counted? Priya Shah will check, by Fri 6 Nov.');
    expect(mail.body).toContain('Q02 Should part of the loan be fixed? Owner to be agreed.');
    expect(mail.body).not.toContain('Who will own this?, by Can you confirm a date?.');

    // Fix 5: Headline trimmed without dangling words
    expect(mail.subject).not.toContain('of the three');
  });
