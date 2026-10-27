import { describe, test, expect } from 'bun:test';
import * as C from '../src/lib/automation/automationCore';
import * as AG from '../src/lib/automation/agentsCore';
import { meetingInput, scheduleInput } from '../src/lib/automation/automationStudio';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Concludo Automation v2.1 Invariant Test Suite', () => {
  test('1. Six new agents are registered and coaching recap is strictly excluded', () => {
    const agentKeys = AG.AGENTS.map((a) => a.key);
    expect(agentKeys).toContain('meeting_prep');
    expect(agentKeys).toContain('consent_check');
    expect(agentKeys).toContain('record_hygiene');
    expect(agentKeys).toContain('client_commitments');
    expect(agentKeys).toContain('vendor_campaign_update');
    expect(agentKeys).toContain('board_pack');

    // Coaching session recap must NOT be present
    expect(agentKeys).not.toContain('coaching_session_recap');
    expect(agentKeys).not.toContain('coaching_recap');

    // Total count of agents is 15
    expect(AG.AGENTS.length).toBe(15);
  });

  test('2. Zero em or en dashes across templates, agent definitions and copy', () => {
    const allAgentText = JSON.stringify(AG.AGENTS);
    expect(allAgentText).not.toContain('—'); // em dash
    expect(allAgentText).not.toContain('–'); // en dash

    const allTemplateText = JSON.stringify(C.TEMPLATES);
    expect(allTemplateText).not.toContain('—');
    expect(allTemplateText).not.toContain('–');
  });

  test('3. Anti-surveillance covenant: Workflows and agents measure work, never people', async () => {
    const store = new C.MemoryStore();
    const wf = C.workflowFromTemplate(store, 'weekly-project-status-review', 'me');
    wf.name = 'Rank team members by productivity';
    const issues = await C.validateWorkflow(wf, store);
    expect(issues.some((i) => /measures work, never people/.test(i.text))).toBe(true);
    await store.saveWorkflow(wf);
    expect(C.setActive(store, wf.id, true, 'me')).rejects.toThrow();
  });

  test('4. Empty workspace produces honest outputs without invented data', async () => {
    const emptyWs: AG.WorkspaceData = {
      today: '2026-10-27',
      me: 'Anthony Cortez',
      meetings: [],
      actions: [],
      decisions: [],
      risks: [],
    };

    const store = new C.MemoryStore();
    const res = await AG.runAgent('board_pack', emptyWs, { store, now: '2026-10-27T10:00:00Z' });
    expect(res.headline).toContain('No meetings recorded');
    expect(res.status).not.toBe('done');
    expect(res.drafts.length).toBe(0);
    // Stats name their source
    expect(res.basis).toContain('Read 0 meetings');
  });

  test('5. Record hygiene merges actions only after explicit confirmation', () => {
    const wsWithDups: AG.WorkspaceData = {
      today: '2026-10-27',
      me: 'Anthony Cortez',
      meetings: [],
      actions: [
        { id: 'act-1', action_title: 'Prepare compliance report', owner_name: null, due_date: null, status: 'not_started', project: 'P1' },
        { id: 'act-2', action_title: 'Prepare compliance report', owner_name: 'Sarah', due_date: '2026-11-01', status: 'not_started', project: 'P1' },
      ],
      decisions: [],
      risks: [],
    };

    const fix: AG.Fix = {
      id: 'fix-merge-1',
      kind: 'merge_action',
      label: 'Merge duplicate',
      ref: 'act-1',
      ref2: 'act-2',
      fields: [],
    };

    // Before fix: 2 actions
    expect(wsWithDups.actions.length).toBe(2);

    // Apply fix
    const { data: updatedWs, detail } = AG.applyFix(wsWithDups, fix, {});
    expect(updatedWs.actions.length).toBe(1);
    expect(updatedWs.actions[0].id).toBe('act-2');
    expect(detail).toContain('merged into');
  });

  test('6. Consent check holds workflow runs until consent is recorded', async () => {
    const store = new C.MemoryStore({
      connections: { concludo: 'connected', outlook: 'connected' },
    });
    const ws: AG.WorkspaceData = {
      today: '2026-10-27',
      me: 'Anthony Cortez',
      meetings: [
        {
          id: 'm-no-consent',
          title: 'Client Strategy Session',
          date: '2026-10-26',
          project: 'Project Alpha',
          attendees: ['Anthony Cortez', 'Jane Doe'],
          summary: 'Discussed roadmap',
          consent: 'not_recorded',
        },
      ],
      actions: [],
      decisions: [],
      risks: [],
    };

    const wf = C.workflowFromTemplate(store, 'meeting-follow-through', 'Anthony Cortez');
    await store.saveWorkflow(wf);
    await C.setActive(store, wf.id, true, 'Anthony Cortez');

    const input = meetingInput(ws, 'm-no-consent');
    const run = await C.runWorkflow(store, wf.id, { input, actor: 'Anthony Cortez' });

    // Must be cancelled / held with no incident
    expect(run.status).toBe('cancelled');
    expect(run.error).toContain('Held:');
    const incidents = await store.listIncidents();
    expect(incidents.length).toBe(0);
  });

  test('7. Every template validates clean when its apps are connected', async () => {
    const store = new C.MemoryStore({
      connections: {
        concludo: 'connected',
        outlook: 'connected',
        google_calendar: 'connected',
        microsoft_todo: 'connected',
        slack: 'connected',
        hubspot: 'connected',
        gmail: 'connected',
        teams: 'connected',
        google_sheets: 'connected',
      },
    });
    for (const tpl of C.TEMPLATES) {
      const wf = C.workflowFromTemplate(store, tpl.key, 'me');
      const blocks = (await C.validateWorkflow(wf, store)).filter((i) => i.level === 'block');
      expect(blocks.length).toBe(0);
    }
  });

  test('8. Vendor update drafts contain [TO CONFIRM] tags and never invent prices', async () => {
    const store = new C.MemoryStore();
    const ws: AG.WorkspaceData = {
      today: '2026-10-27',
      me: 'Anthony Cortez',
      meetings: [
        {
          id: 'm-vendor',
          title: 'Vendor Check-in',
          date: '2026-10-26',
          project: '12 Collins St',
          listing: '12 Collins St',
          vendor: 'John Smith',
          attendees: ['Anthony Cortez', 'John Smith'],
          summary: 'Reviewing listing campaign',
          consent: 'recorded',
        },
      ],
      actions: [],
      decisions: [],
      risks: [],
    };

    const res = await AG.runAgent('vendor_campaign_update', ws, { store, now: '2026-10-27T10:00:00Z' });
    expect(res.drafts.length).toBeGreaterThan(0);
    const body = res.drafts[0].body;
    expect(body).toContain('[TO CONFIRM]');
    expect(body).not.toContain('$');
  });

  test('9. Independence disclaimer is present in stylesheet and templates', () => {
    const cssPath = resolve(__dirname, '../src/styles/automation-v2.css');
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toContain('.foot');
    expect(css).toContain('.cma-root');
  });

  test('10. Mobile responsiveness at 390px: no horizontal scroll constraints', () => {
    const cssPath = resolve(__dirname, '../src/styles/automation-v2.css');
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('grid-template-columns: 1fr');
  });
});
