import { describe, it, expect } from 'bun:test';
import { analyseMeeting, toMarkdown } from '../src/lib/intelligence/meetingEngine';
import { exportStandaloneHtml } from '../src/features/meeting-output/studio';

describe('Meeting Engine v3 P3 Rules & Fictional Fixtures Tests', () => {

  // Fixture A: 3 speakers, Name mm:ss format, no consent line, hypothetical, late joiner
  it('Fixture A: 3 speakers, Name mm:ss format, no consent, hypothetical rejected, late joiner flagged', () => {
    const transcriptA = [
      'Operational Sync',
      'Date: 25 November 2026',
      '',
      'Karin 00:05',
      'Good morning team. We have several operational topics to review today.',
      '',
      'Marcus 00:15',
      'Morning Karin. I am ready to go through the fleet maintenance review.',
      '',
      'Karin 00:30',
      'Maybe if we expanded into northern delivery corridors someday, we could buy extra vans. But for now, let us focus on current repairs.',
      '',
      'Marcus 00:45',
      'Agreed. Let us lock in the quarterly fleet safety inspection for next Monday.',
      '',
      'Karin 01:00',
      'Sounds good, let us do that. I will book the certified inspector by Friday afternoon.',
      '',
      'Elena 08:30',
      'Hi everyone, apologies for joining late, I was delayed with logistics dispatch.',
      '',
      'Elena 08:45',
      'I can verify the spare parts inventory by tomorrow morning.',
      '',
      'Karin 09:10',
      'Thanks Elena. We will meet same time next Wednesday at 10 am to review the audit results.'
    ].join('\n');

    const model = analyseMeeting([{ name: 'sync.txt', kind: 'transcript', text: transcriptA }]);

    expect(model.version).toBe('3.0');
    expect(model.drafting_method).toBe('basic');
    expect(model.participants.length).toBe(3);
    const names = model.participants.map(p => p.name);
    expect(names).toContain('Karin');
    expect(names).toContain('Marcus');
    expect(names).toContain('Elena');

    // Consent was not asked -> risk raised, consent record marked
    expect(model.consent?.asked_by).toBeNull();
    expect(model.consent?.note).toContain('Consent was not recorded');

    // Hypothetical ("maybe if we expanded someday") should not become a decision
    expect(model.decisions.some(d => /northern delivery corridors/i.test(d.statement))).toBe(false);

    // Stated decision locked in
    expect(model.decisions.some(d => /fleet safety inspection/i.test(d.statement))).toBe(true);

    // Actions owned and dated
    const elenaAction = model.actions.find(a => a.owner === 'Elena');
    expect(elenaAction).toBeDefined();
    expect(elenaAction?.source_quote).toBeDefined();
    expect(elenaAction?.source_quote?.length).toBeGreaterThan(10);

    // Next meeting parsed cleanly without guessing PM
    expect(model.next_meeting?.date).toBe('2026-12-02');
    expect(model.next_meeting?.time).toBe('10:00 am');
  });

  // Fixture B: 10+ speakers in [hh:mm:ss] Name: text format, consent asked, hedged claims
  it('Fixture B: 10 or more speakers in [hh:mm:ss] Name: text format, consent recorded, hedged claim to verify', () => {
    const transcriptB = [
      '[09:00:05] Arthur: Welcome everyone to the quarterly regional council briefing. Do you mind if we record our discussion today?',
      '[09:00:15] Beatrice: Yes, fine with me.',
      '[09:00:18] Charles: No problem at all.',
      '[09:00:20] Diana: Agreed.',
      '[09:00:22] Edward: Fine with me.',
      '[09:00:25] Fiona: Yes, all good.',
      '[09:00:28] George: Fine.',
      '[09:00:30] Hannah: Yes, sure.',
      '[09:00:33] Ian: Happy with that.',
      '[09:00:36] Julia: Yes, good.',
      '[09:00:40] Arthur: Wonderful. First item: roughly from memory, our solar infrastructure reduced grid load by 45 per cent last winter, but do not quote me on that exact figure.',
      '[09:01:00] Beatrice: I will audit the official electricity billing statements by next Friday.',
      '[09:01:20] Charles: The civic plaza refurbishment is getting crowded with competing design submissions. We ought to narrow it to three finalists.',
      '[09:01:40] Arthur: That is agreed. Let us limit the tender review to the top three design submissions.',
      '[09:02:00] Diana: Agreed, works for me.'
    ].join('\n');

    const model = analyseMeeting([{ name: 'council.txt', kind: 'transcript', text: transcriptB }]);

    expect(model.participants.length).toBeGreaterThanOrEqual(10);
    expect(model.consent?.asked_by).toBe('Arthur');
    expect(model.consent?.answered_by).toContain('Beatrice');

    // Statement to verify: hedged claim with 45 per cent
    expect(model.statements_to_verify && model.statements_to_verify.length > 0).toBe(true);
    const hedgedStmt = model.statements_to_verify?.find(s => /solar infrastructure/i.test(s.statement));
    expect(hedgedStmt).toBeDefined();
    expect(hedgedStmt?.said_by).toBe('Arthur');

    // Non-organiser insight
    const beatriceOrCharlesInsight = model.insights?.find(ins => ins.who === 'Charles');
    expect(beatriceOrCharlesInsight).toBeDefined();
  });

  // Fixture C: 2-person short call in Name: text format with no timestamps, revised proposal (supersession)
  it('Fixture C: short 2-person call, Name: text format without timestamps, proposal supersession', () => {
    const transcriptC = [
      'David: Hello Sarah, thanks for jumping on.',
      'Sarah: Glad to connect David.',
      'David: How about we hire two junior marketing interns for summer?',
      'Sarah: Actually no, rather than two interns, let us hire one senior digital specialist instead.',
      'David: Agreed, that makes much more sense. Let us lock that in.',
      'Sarah: I will post the job advertisement for the senior digital specialist by Friday.',
      'David: Perfect, thanks Sarah.'
    ].join('\n');

    const model = analyseMeeting([{ name: 'hiring.txt', kind: 'transcript', text: transcriptC }]);

    expect(model.participants.length).toBe(2);
    // Superseded proposal: two interns should NOT be the accepted decision
    expect(model.decisions.some(d => /two junior marketing interns/i.test(d.statement))).toBe(false);
    // Accepted decision: senior specialist
    expect(model.decisions.some(d => /senior digital specialist/i.test(d.statement))).toBe(true);

    // Markdown & HTML export check
    const md = toMarkdown(model);
    expect(md).toContain('Draft record for review. Outcomes have not been confirmed by a person.');
    expect(md).not.toMatch(/[–—]/); // Zero en/em dashes

    const html = exportStandaloneHtml(model);
    expect(html).toContain('Draft record for review. Outcomes have not been confirmed by a person.');
    expect(html).toContain('Commercial in confidence');
  });

});
