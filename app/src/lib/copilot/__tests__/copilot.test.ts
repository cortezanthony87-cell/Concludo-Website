import { describe, expect, test } from 'bun:test';
import { CopilotEngine } from '../copilotEngine';
import { persistExecutionDraft } from '../copilotClient';
import { parsePeriod, asksToRankPeople, resolveEntity } from '../understanding';
import { buildEntities, normaliseStatus } from '../evidence';
import { melbourneToday, inRange } from '../dates';
import { fakeSupabase } from './fakeSupabase';
import { NOW, TODAY, workspace } from './fixtures';
import type { CopilotResponse } from '../types';

const ask = async (q: string, extra: Partial<Parameters<CopilotEngine['processQuery']>[1]> = {}, tables = workspace(), user = 'u1') => {
  const fake = fakeSupabase(tables, { user });
  const res = await new CopilotEngine(fake.client).processQuery(q, { userId: user, now: NOW, ...extra });
  return { res, fake };
};
const allText = (r: CopilotResponse) => [r.answer, ...(r.sections || []).flatMap((s) => [s.title, ...s.items.map((i) => i.text)]), ...(r.notices || []).map((n) => n.text)].join('\n');
const ids = (r: CopilotResponse) => r.sourceRecords.map((s) => s.id);

describe('dates and periods', () => {
  test('Melbourne calendar date does not shift with UTC', () => {
    expect(melbourneToday(new Date('2026-10-28T14:30:00Z'))).toBe('2026-10-29'); // 01:30 next day in Melbourne
    expect(melbourneToday(new Date('2026-10-28T12:30:00Z'))).toBe('2026-10-28'); // 23:30 in Melbourne
  });
  test('explicit period is inclusive at both ends', () => {
    const p = parsePeriod('between 1 September and 30 September', TODAY)!;
    expect(p.from).toBe('2026-09-01');
    expect(p.to).toBe('2026-09-30');
    expect(inRange('2026-09-30', p.from, p.to)).toBe(true);
    expect(inRange('2026-10-01', p.from, p.to)).toBe(false);
  });
  test('last quarter, last month and this week resolve to calendar bounds', () => {
    expect(parsePeriod('last quarter', TODAY)).toMatchObject({ from: '2026-07-01', to: '2026-09-30' });
    expect(parsePeriod('last month', TODAY)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(parsePeriod('this week', TODAY)).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
  });
});

describe('project context (earlier meetings, decisions, actions, risks)', () => {
  test('Atlas summary is chronological, scoped, cited and does not include other projects', async () => {
    const { res } = await ask('Summarise earlier meetings, current decisions, open actions and risks for Atlas');
    expect(res.evidenceStatus).not.toBe('none');
    const t = allText(res);
    expect(t).toContain('Atlas kickoff');
    expect(t).not.toMatch(/Harbour|Northwind|Beach Road|Marlo/);
    expect(res.scope?.projectName).toBe('Atlas');
    // chronological: kickoff before planning before retro
    expect(t.indexOf('Atlas kickoff')).toBeLessThan(t.indexOf('Atlas planning'));
    // every recorded item is traceable to a source
    for (const s of res.sections || []) for (const i of s.items) if (i.basis === 'recorded') expect(i.sourceIds.length).toBeGreaterThan(0);
    // a record with no date says so; a date is never invented
    for (const s of res.sourceRecords) expect(s.recordDate || /No due date recorded/.test(s.snippet)).toBeTruthy();
    expect(res.sourceRecords.find((s) => s.id === 'a3')!.recordDate).toBeNull();
    expect(t).not.toMatch(/undefined|NaN/);
  });

  test('a changed decision shows both, labelled as inferred, never silently reconciled', async () => {
    const { res } = await ask('Why did we move the Atlas go-live date?');
    const t = allText(res);
    expect(ids(res)).toContain('d2');
    expect(ids(res)).toContain('d3');
    expect(t).toContain('12 November');
    expect(t).toContain('19 November');
    expect(t).toMatch(/Possibly replaced|Possibly superseded|Inferred/i);
    const section = res.sections!.find((s) => s.kind === 'discrepancy')!;
    expect(section.items[0].basis).toBe('inferred');
    expect(res.sourceRecords.find((s) => s.id === 'd2')!.status).toMatch(/superseded/i);
  });

  test('a topic with no record returns "not recorded", never an unrelated decision', async () => {
    const { res } = await ask('What did we decide about Zebra Corp licensing?');
    expect(res.evidenceStatus).toBe('none');
    expect(res.sourceRecords.length).toBe(0);
    expect(res.confidenceScore).toBeLessThanOrEqual(10);
    expect(allText(res)).not.toMatch(/Northwind|Atlas/);
  });

  test('evidence strength is derived, explained, and differs between strong and weak answers', async () => {
    const strong = (await ask('Summarise Atlas')).res;
    const weak = (await ask('What did we decide about Zebra Corp licensing?')).res;
    expect(strong.confidenceScore).toBeGreaterThan(weak.confidenceScore);
    expect(strong.confidenceScore).not.toBe(88);
    expect(strong.strengthFactors!.length).toBeGreaterThan(1);
    expect(strong.confidenceExplanation).toMatch(/not the chance that the answer is correct/);
  });
});

describe('names are never merged', () => {
  test('two similar project names produce a question, not an answer', async () => {
    const { res, fake } = await ask('What actions are open for Harbour?');
    expect(res.evidenceStatus).toBe('ambiguous');
    expect(res.clarification!.options.map((o) => o.label).sort()).toEqual(['Harbour Rebrand', 'Harbour Refit']);
    expect(res.sourceRecords.length).toBe(0);
    // only the two name queries ran; no record tables were read
    expect(fake.log.some((l) => l.table === 'action_tracker')).toBe(false);
  });
  test('an explicit scope from the interface resolves the ambiguity', async () => {
    const { res } = await ask('What actions are open for Harbour?', { scope: { projectKey: 'harbour refit' } });
    expect(res.scope?.projectName).toBe('Harbour Refit');
    expect(allText(res)).toContain('Marlo signage proof');
    expect(allText(res)).not.toContain('Marlowe rebrand brief');
  });
  test('Marlo and Marlowe stay separate for client commitments', () => {
    const ents = buildEntities(workspace().projects as any);
    const r = resolveEntity('what do we owe Marlo', ents);
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.entity.display).toBe('Marlo');
  });
});

describe('actions owed to a client', () => {
  test('Linwood only', async () => {
    const { res } = await ask('What outstanding actions are owed to Linwood?');
    expect(ids(res)).toEqual(['a1']);
    expect(allText(res)).not.toMatch(/Marlo|signage|rebrand/i);
  });
  test('Marlo does not pick up Marlowe', async () => {
    const { res } = await ask('What actions are owed to Marlo?');
    expect(ids(res)).toEqual(['a2']);
    expect(allText(res)).not.toContain('rebrand brief');
  });
  test('a client with nothing marked says so and does not borrow other work', async () => {
    const t = workspace();
    t.agent_memory = t.agent_memory.filter((m) => m.memory_key !== 'action:a6');
    const { res } = await ask('What actions are owed to Marlowe?', {}, t);
    expect(res.evidenceStatus).toBe('none');
    expect(allText(res)).toContain('No open action is marked as owed to Marlowe');
  });
});

describe('campaign meetings tagged to a listing', () => {
  test('keeps the listing relationship and nothing else', async () => {
    const { res } = await ask('Show the campaign meetings for 12 Beach Rd and the decisions made');
    const t = allText(res);
    expect(t).toContain('Beach Road campaign review');
    expect(t).toContain('Vendor update cadence set to weekly');
    expect(t).toContain('Collect photos for 12 Beach Rd');
    expect(t).not.toMatch(/Atlas|Northwind/);
  });
});

describe('time periods', () => {
  test('September is inclusive on both ends and excludes 1 October', async () => {
    const { res } = await ask('Summarise meetings, decisions, actions and risks between 1 September and 30 September');
    const t = allText(res);
    expect(res.intent).toBe('period_summary');
    expect(t).toContain('Atlas kickoff'); // 1 Sep
    expect(t).toContain('Atlas retro'); // 30 Sep
    expect(t).not.toContain('Atlas follow-up'); // 1 Oct
    expect(t).not.toContain('Atlas UAT review'); // 13 Oct
    expect(res.scope?.period?.label).toMatch(/inclusive/);
  });
});

describe('overdue calculation uses calendar dates', () => {
  test('due today is not overdue; due yesterday is', async () => {
    const { res } = await ask('Which actions are overdue?');
    expect(ids(res)).toContain('a1');
    expect(ids(res)).toContain('a2');
    expect(ids(res)).not.toContain('a9'); // due 2026-10-29 = today
    expect(normaliseStatus('Done')).toBe('completed');
  });
  test('missing owner and due date are stated, never invented', async () => {
    const { res } = await ask('Which open actions have no owner?');
    const t = allText(res);
    expect(t).toContain('Atlas UAT sign-off');
    expect(t).toContain('No owner recorded');
    expect(t).toContain('no due date recorded');
  });
});

describe('consent', () => {
  test('a meeting with no consent basis is withheld and the interface says so', async () => {
    const { res } = await ask('Summarise Atlas and its risks');
    const t = allText(res);
    expect(t).toMatch(/no consent basis recorded/i);
    expect(t).not.toContain('confidential commercial detail');
    expect(t).not.toContain('UAT scope unclear');
    expect(res.notices!.some((n) => n.kind === 'consent') || res.sections!.some((s) => s.kind === 'held')).toBe(true);
    expect(res.evidenceStatus).toBe('partial');
  });
  test('consent status lists the meeting that needs a basis', async () => {
    const { res } = await ask('Which meetings are missing consent?');
    expect(res.intent).toBe('consent_status');
    expect(ids(res)).toContain('m3');
  });
});

describe('risks traced to actions and decisions', () => {
  test('risk raised in planning links to the action recorded with it and to the later decision', async () => {
    const { res } = await ask('What risks were raised for Atlas and what followed?');
    const t = allText(res);
    expect(t).toContain('Test environment not ready');
    expect(t).toContain('Prepare the Atlas test environment'); // same source output o2
    expect(t).toContain('Later decisions on the same project');
    expect(ids(res)).toContain('a4');
    // risks come from meetings, not from a fixed formula
    expect(t).not.toMatch(/\bscore\b.*\/100/);
  });
  test('no risk recorded gives an honest gap', async () => {
    const { res } = await ask('What risks were raised for Harbour Refit?');
    expect(res.evidenceStatus).toBe('none');
    expect(allText(res)).toContain('No risks are recorded');
  });
});

describe('workflow runs, approvals and incidents', () => {
  test('failed, pending and open items are listed; nothing is executed', async () => {
    const { res, fake } = await ask('Explain failed workflow runs, pending approvals and incidents');
    const t = allText(res);
    expect(t).toContain('Connector timed out');
    expect(t).toContain('Weekly vendor update, 12 Beach Rd');
    expect(t).toContain('An outgoing email step could not complete');
    expect(t).toContain('Copilot cannot approve');
    expect(fake.log.filter((l) => l.op === 'insert').length).toBe(0);
  });
});

describe('approvals: the staged card is real or it is not shown as staged', () => {
  test('engine returns a draft preview, never "pending approval"', async () => {
    const { res } = await ask('Prepare an executive briefing for Atlas');
    expect(res.executionDraft?.status).toBe('draft');
    expect(res.executionDraft?.payload.organizationId).not.toBe('org_current');
    expect(res.executionDraft?.preview!.join(' ')).toMatch(/Nothing is sent/);
    expect(res.executionDraft?.payload.recordIds.meetings).not.toContain('m3'); // no consent
  });
  test('persisting queues one approval row, and a repeat does not duplicate it', async () => {
    const { res, fake } = await ask('Prepare an executive briefing for Atlas');
    const first = await persistExecutionDraft(fake.client, 'u1', res.executionDraft!, 'Test User');
    expect(first.status).toBe('pending_approval');
    expect(first.approvalId).toBeTruthy();
    const second = await persistExecutionDraft(fake.client, 'u1', res.executionDraft!, 'Test User');
    expect(second.approvalId).toBe(first.approvalId);
    expect(fake.db.workflow_approvals.filter((r) => r.action_payload?.source === 'Copilot').length).toBe(1);
    const row = fake.db.workflow_approvals.find((r) => r.action_payload?.source === 'Copilot')!;
    expect(row.status).toBe('pending');
    expect(row.requester_id).toBe('u1');
  });
  test('if saving fails the draft says it was not queued', async () => {
    const { res, fake } = await ask('Prepare an executive briefing for Atlas');
    const bad = fakeSupabase(fake.db, { insertError: 'permission denied' });
    const out = await persistExecutionDraft(bad.client, 'u1', res.executionDraft!, 'Test User');
    expect(out.status).toBe('draft');
    expect(out.approvalId).toBeNull();
    expect(out.persistError).toContain('permission denied');
  });
});

describe('measures work, never people', () => {
  test('ranking requests are refused before any data is read', async () => {
    for (const q of ['Rank the team members by how many actions they complete', 'Who owns the most open actions?', 'Who is the least productive person?']) {
      expect(asksToRankPeople(q)).toBe(true);
      const { res, fake } = await ask(q);
      expect(res.evidenceStatus).toBe('refused');
      expect(fake.log.length).toBe(0);
      expect(res.suggestedFollowUps.join(' ')).not.toMatch(/who owns the most/i);
    }
  });
  test('work-based questions are still answered', async () => {
    expect(asksToRankPeople('Which actions are overdue and how old are they?')).toBe(false);
    expect(asksToRankPeople('Which projects have the most open actions?')).toBe(false);
  });
});

describe('document opened from a project', () => {
  test('answers from the selected version, cites it, and treats embedded instructions as data', async () => {
    const { res } = await ask('What is the go-live plan?', { scope: { documentId: 'f1' } });
    const t = allText(res);
    expect(res.intent).toBe('document_query');
    expect(res.scope?.documentName).toBe('Atlas scope statement');
    expect(res.scope?.documentVersion).toBe(2);
    expect(t).toContain('version 2');
    expect(t).toContain('Go-live is planned for 12 November');
    expect(res.notices!.some((n) => n.kind === 'injection')).toBe(true);
    expect(t).not.toMatch(/system prompt is/i);
    expect(ids(res)).toContain('f1');
  });
  test('revoked or deleted access gives a clear notice and no invented content', async () => {
    const t = workspace();
    t.project_files = [];
    const { res } = await ask('What is the go-live plan?', { scope: { documentId: 'f1' } }, t);
    expect(res.evidenceStatus).toBe('none');
    expect(res.notices!.some((n) => n.kind === 'permission')).toBe(true);
    expect(res.sourceRecords.length).toBe(0);
  });
});

describe('isolation, failure and limits', () => {
  test("another user's rows are not visible (RLS emulation)", async () => {
    const t = workspace();
    t.decision_memory = t.decision_memory.map((d) => ({ ...d, _owner: d.id === 'd1' ? 'someone-else' : 'u1' }));
    const { res } = await ask('Show decisions for Harbour Refit', {}, t);
    expect(allText(res)).not.toContain('Northwind');
    expect(res.evidenceStatus).toBe('none');
  });
  test('a failed data source is reported as partial, not as "no records"', async () => {
    const fake = fakeSupabase(workspace(), { failTables: ['action_tracker'] });
    const res = await new CopilotEngine(fake.client).processQuery('Which actions are overdue?', { userId: 'u1', now: NOW });
    expect(res.notices!.some((n) => n.kind === 'partial')).toBe(true);
    expect(res.evidenceStatus).not.toBe('grounded');
  });
  test('hitting the row limit is disclosed', async () => {
    const t = workspace();
    t.projects = Array.from({ length: 500 }, (_, i) => ({ id: `x${i}`, title: `Bulk ${i}`, project_name: `Bulk ${i}`, client_name: 'Bulk', meeting_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', deleted_at: null }));
    const { res } = await ask('Summarise the last 30 days', {}, t);
    expect(res.notices!.some((n) => n.kind === 'truncated')).toBe(true);
  });
  test('an empty workspace says nothing is recorded', async () => {
    const empty: any = { projects: [], agent_memory: [], outputs: [], decision_memory: [], action_tracker: [], project_files: [], workflow_approvals: [], workflow_executions: [], workflow_incidents: [] };
    const { res } = await ask('Give me an executive briefing', {}, empty);
    expect(res.evidenceStatus).toBe('none');
    expect(allText(res)).not.toMatch(/undefined|\/100|momentum/i);
  });
});

describe('executive and forecast answers show their basis', () => {
  test('executive status is counted from records, with recommendations labelled', async () => {
    const { res } = await ask('Give me an executive briefing');
    const t = allText(res);
    expect(t).not.toMatch(/undefined|\/100|Business Momentum|ROI/i);
    const rec = res.sections!.find((s) => s.kind === 'next_steps')!;
    expect(rec.items.every((i) => i.basis === 'recommended')).toBe(true);
    expect(rec.title).toMatch(/rule based/i);
  });
  test('forecast with too little history refuses to give a date', async () => {
    const { res } = await ask('Forecast the completion rate for Atlas');
    expect(res.sections!.some((s) => s.kind === 'gaps')).toBe(true);
    expect(allText(res)).toMatch(/does not give one/);
  });
});

describe('speed and style', () => {
  test('a typical question needs at most 6 database round trips (it was 19)', async () => {
    const { fake } = await ask('Summarise Atlas');
    expect(fake.log.length).toBeLessThanOrEqual(6);
  });
  test('no em or en dashes in any composed text', async () => {
    for (const q of ['Summarise Atlas', 'Which actions are overdue?', 'Give me an executive briefing', 'What risks were raised for Atlas?', 'Why did we move the Atlas go-live date?']) {
      const { res } = await ask(q);
      expect(/[\u2012-\u2015]/.test(allText(res))).toBe(false);
    }
  });
});

describe('request routing and honest status', () => {
  test('"draft a report ... send it to the board" is an approval preview, not a status answer', async () => {
    const { res, fake } = await ask('Draft a report of overdue actions and send it to the board');
    expect(res.intent).toBe('action_execution_request');
    expect(res.executionDraft?.status).toBe('draft');
    expect(fake.log.filter((l) => l.op === 'insert')).toHaveLength(0);
  });
  test('a partial answer always carries a notice that says why', async () => {
    const { res } = await ask('Summarise earlier meetings, current decisions, open actions and risks for Atlas');
    if (res.evidenceStatus === 'partial') expect((res.notices || []).length).toBeGreaterThan(0);
  });
  test('the workspace overview is not labelled partial just because no scope was chosen', async () => {
    const t = workspace();
    t.agent_memory.push({ agent_type: 'consent_check', memory_key: 'meeting:m3', memory_value: { basis: 'all_agreed' }, deleted_at: null });
    const { res } = await ask('hello', {}, t);
    expect(res.evidenceStatus).toBe('grounded');
  });
});
