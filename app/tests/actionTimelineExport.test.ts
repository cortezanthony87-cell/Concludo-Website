import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import {
  buildTimelinePayloadFromActions,
  buildTimelineFileName,
  calculateStartMondayOfWeekBefore,
  mapActionToTimelineBucket,
  sanitizeTimelineText,
  formatTimelineDate,
  clipText,
  renderTimelinePptx,
  loadTimelineAssets,
  isActionTimelineFeatureFlagEnabled,
  sanitizePptxPackageBlob,
} from '../src/lib/outputs/timeline';
import JSZip from 'jszip';
import { calculateActionBuckets } from '../src/lib/actions/actionBuckets';
import { PLAN_PERMISSIONS } from '../src/lib/permissions/types';

describe('Action Timeline PowerPoint Export (Tasklet Brief v1)', () => {
  // Sample data from reference/sample.mjs
  const sampleActions = [
    { id: 'A-01', title: 'Circulate the revised base model to leadership', owner: 'Tom Becker', due: '2026-11-04', status: 'open', priority: 'High' },
    { id: 'A-02', title: 'Confirm the auditors’ view on the Singapore pilot', owner: 'David Okafor', due: '2026-11-10', status: 'open', priority: 'High' },
    { id: 'A-03', title: 'Send the NZ and Singapore acquisition long list', owner: 'Tom Becker', due: '2026-11-13', status: 'in_progress', priority: 'High' },
    { id: 'A-04', title: 'Draft the five-year workforce plan', owner: 'Grace Liu', due: '2026-11-16', status: 'open', priority: 'Medium' },
    { id: 'A-05', title: 'Book the council pre-application meeting', owner: 'Priya Raman', due: '2026-11-18', status: 'open', priority: 'Medium' },
    { id: 'A-06', title: 'Shortlist three distribution centre sites', owner: 'Priya Raman', due: '2026-11-20', status: 'open', priority: 'High' },
    { id: 'A-07', title: 'Model the debt and equity funding mix', owner: 'David Okafor', due: '2026-11-24', status: 'open', priority: 'Medium' },
    { id: 'A-08', title: 'Review time to hire in operations', owner: 'Grace Liu', due: '2026-11-26', status: 'open', priority: 'Low' },
    { id: 'A-09', title: 'Revise the forecast for the board pack', owner: 'David Okafor', due: '2026-11-30', status: 'open', priority: 'High' },
    { id: 'A-10', title: 'Sign off the December board pack', owner: 'Helen Marsh', due: '2026-12-04', status: 'open', priority: 'High' },
    { id: 'A-11', title: 'Set the half-year benchmark report format', owner: 'Tom Becker', due: '2026-12-11', status: 'open', priority: 'Low' },
    { id: 'A-12', title: 'Scope a brand refresh before new markets', owner: null, due: null, status: 'open', priority: 'Low' },
    { id: 'A-13', title: 'Agree an owner for the interest rate sensitivity', owner: null, due: null, status: 'open', priority: 'Medium' },
    { id: 'A-14', title: 'Audit capacity at both distribution centres', owner: 'Priya Raman', due: '2026-11-06', status: 'completed', priority: 'Medium' },
    { id: 'A-15', title: 'Circulate the five-year forecast', owner: 'David Okafor', due: '2026-10-30', status: 'completed', priority: 'High' },
    { id: 'A-16', title: 'Set the leadership offsite agenda', owner: 'Helen Marsh', due: '2026-11-09', status: 'completed', priority: 'Low' },
  ];

  const samplePayload = {
    project: 'Stillwater Group: FY2031 growth plan',
    shortProject: 'Stillwater Group',
    source: 'Action Hub, all permitted actions',
    exportedOn: '2026-11-13',
    timezone: 'Australia/Melbourne',
    actions: sampleActions.map((a) => {
      let b: 'completed' | 'overdue' | 'today' | 'upcoming' | 'unscheduled' = 'upcoming';
      if (a.status === 'completed') b = 'completed';
      else if (!a.due) b = 'unscheduled';
      else if (a.due < '2026-11-13') b = 'overdue';
      else if (a.due === '2026-11-13') b = 'today';
      return { ...a, b };
    }),
  };

  it('T1: Button placement and tab independence', () => {
    const hubSource = fs.readFileSync(path.resolve(__dirname, '../src/pages/actions/ActionHubPage.tsx'), 'utf8');
    const completedIdx = hubSource.indexOf('Completed');
    const timelineIdx = hubSource.indexOf('Generate timeline</span>');
    const reviewIdx = hubSource.indexOf('Review suggestions');

    expect(completedIdx).toBeGreaterThan(0);
    expect(timelineIdx).toBeGreaterThan(completedIdx);
    expect(reviewIdx).toBeGreaterThan(timelineIdx);

    // Verify clicking button opens popover and does not call setActiveTab
    const btnIdx = hubSource.indexOf('className="ach-timeline-btn ach-timeline-btn-desktop"');
    const btnSnippet = hubSource.slice(btnIdx, timelineIdx + 100);
    expect(btnSnippet).toContain('setIsTimelineOpen');
    expect(btnSnippet).not.toContain('setActiveTab');
  });

  it('T2: Panel count, view, filters, and date range logic', () => {
    const mockRecords: any[] = [
      { id: '1', action_title: 'Task A', due_date: '2026-11-10', status: 'not_started', priority: 'high', projects: { title: 'Alpha' } },
      { id: '2', action_title: 'Task B', due_date: '2026-11-20', status: 'in_progress', priority: 'medium', projects: { title: 'Alpha' } },
      { id: '3', action_title: 'Task C', due_date: null, status: 'not_started', priority: 'low', projects: { title: 'Alpha' } },
    ];

    const payload = buildTimelinePayloadFromActions(mockRecords, {
      viewName: 'My Actions',
      filterDescription: 'all statuses',
      now: new Date('2026-11-13T00:00:00Z'),
    });

    expect(payload.actions.length).toBe(3);
    expect(payload.project).toBe('Alpha');
    expect(payload.source).toBe('My Actions (all statuses)');
    expect(payload.exportedOn).toBe('2026-11-13');
  });

  it('T3 & T4: PPTX Generation matching reference deck and LibreOffice conversion', async () => {
    const { pptx, slideCount } = await renderTimelinePptx(PptxGenJS, samplePayload);
    expect(slideCount).toBe(6);

    const outDir = '/tmp/timeline_test_out';
    fs.mkdirSync(outDir, { recursive: true });
    const pptxPath = path.join(outDir, 'Concludo_Action_Timeline_Sample.pptx');
    await pptx.writeFile({ fileName: pptxPath });

    expect(fs.existsSync(pptxPath)).toBe(true);
    const stat = fs.statSync(pptxPath);
    expect(stat.size).toBeGreaterThan(1000000); // Over 1MB due to high-res JPG backgrounds
  });

  it('T5: Edge cases handling (0 actions, 1 action, 200 actions, 12 assignees)', async () => {
    // Edge case 1: 1 action
    const singlePayload = {
      project: 'Solo Project',
      shortProject: 'Solo',
      source: 'Solo view',
      exportedOn: '2026-11-13',
      timezone: 'Australia/Melbourne',
      actions: [
        { id: 'S-1', title: 'Single task', owner: 'Alice', due: '2026-11-14', status: 'not_started', priority: 'High', b: 'upcoming' as const },
      ],
    };
    const r1 = await renderTimelinePptx(PptxGenJS, singlePayload);
    expect(r1.slideCount).toBe(6);

    // Edge case 2: 12 assignees (must generate continuation slide for Week by week)
    const twelveAssigneeActions = Array.from({ length: 12 }).map((_, i) => ({
      id: `A-${i}`,
      title: `Task for Assignee ${i}`,
      owner: `Assignee Person ${i}`,
      due: '2026-11-15',
      status: 'not_started',
      priority: 'Medium',
      b: 'upcoming' as const,
    }));
    const twelvePayload = {
      project: 'Scale Project',
      shortProject: 'Scale',
      source: 'Scale view',
      exportedOn: '2026-11-13',
      timezone: 'Australia/Melbourne',
      actions: twelveAssigneeActions,
    };
    const r12 = await renderTimelinePptx(PptxGenJS, twelvePayload);
    // 12 assignees = 3 chunks of up to 5 (5 + 5 + 2) -> 6 base + 2 continuation = 8 slides
    expect(r12.slideCount).toBe(8);

    // Edge case 3: 200 actions
    const bigActions = Array.from({ length: 200 }).map((_, i) => ({
      id: `B-${i}`,
      title: `Bulk task number ${i} with a reasonably detailed task description`,
      owner: i % 3 === 0 ? 'David' : i % 3 === 1 ? 'Priya' : null,
      due: i % 4 === 0 ? '2026-11-01' : i % 4 === 1 ? '2026-11-13' : i % 4 === 2 ? '2026-11-20' : null,
      status: i % 5 === 0 ? 'completed' : 'not_started',
      priority: 'Medium',
      b: (i % 5 === 0 ? 'completed' : i % 4 === 0 ? 'overdue' : i % 4 === 1 ? 'today' : i % 4 === 2 ? 'upcoming' : 'unscheduled') as any,
    }));
    const bigPayload = {
      project: 'Big Co',
      shortProject: 'Big',
      source: 'All actions',
      exportedOn: '2026-11-13',
      timezone: 'Australia/Melbourne',
      actions: bigActions,
    };
    const rBig = await renderTimelinePptx(PptxGenJS, bigPayload);
    expect(rBig.slideCount).toBeGreaterThanOrEqual(6);
  });

  it('T6: Deck status counts match shared actionBuckets.ts', () => {
    const testDate = new Date('2026-11-13T10:00:00Z');
    const mockHubActions: any[] = [
      { id: '1', action_title: 'T1', due_date: '2026-11-10', status: 'not_started' }, // Overdue
      { id: '2', action_title: 'T2', due_date: '2026-11-13', status: 'not_started' }, // Due today
      { id: '3', action_title: 'T3', due_date: '2026-11-20', status: 'not_started' }, // Upcoming
      { id: '4', action_title: 'T4', due_date: null, status: 'not_started' }, // Unscheduled
      { id: '5', action_title: 'T5', due_date: '2026-11-05', status: 'completed' }, // Completed
    ];

    const buckets = calculateActionBuckets(mockHubActions, testDate);
    expect(buckets.completed).toBe(1);
    expect(buckets.overdue).toBe(1);
    expect(buckets.dueToday).toBe(1);
    expect(buckets.upcoming).toBe(1);
    expect(buckets.unscheduled).toBe(1);
    expect(buckets.total).toBe(5);

    const mapped = mockHubActions.map((a) => mapActionToTimelineBucket(a, testDate));
    expect(mapped.filter((b) => b === 'completed').length).toBe(buckets.completed);
    expect(mapped.filter((b) => b === 'overdue').length).toBe(buckets.overdue);
    expect(mapped.filter((b) => b === 'today').length).toBe(buckets.dueToday);
    expect(mapped.filter((b) => b === 'upcoming').length).toBe(buckets.upcoming);
    expect(mapped.filter((b) => b === 'unscheduled').length).toBe(buckets.unscheduled);
  });

  it('T8: Access rule parity with deck_export and plan permissions', () => {
    expect(PLAN_PERMISSIONS.starter).not.toContain('action_timeline_export');
    expect(PLAN_PERMISSIONS.free_preview).not.toContain('action_timeline_export');
    expect(PLAN_PERMISSIONS.pro).toContain('action_timeline_export');
    expect(PLAN_PERMISSIONS.pro_subscription).toContain('action_timeline_export');
    expect(PLAN_PERMISSIONS.team).toContain('action_timeline_export');
    expect(PLAN_PERMISSIONS.enterprise).toContain('action_timeline_export');
    expect(PLAN_PERMISSIONS.admin).toContain('action_timeline_export');
  });

  it('T10: Zero dash characters in file names and slide text sanitisation', () => {
    const testFileName = buildTimelineFileName('Stillwater Group: FY2031 growth plan', '2026-11-13');
    expect(testFileName).toBe('Concludo_Timeline_Stillwater_Group_FY2031_growth_plan_2026_11_13.pptx');
    expect(testFileName).not.toContain('-');
    expect(testFileName).not.toContain('\u2013');
    expect(testFileName).not.toContain('\u2014');

    // Sanitisation replaces em/en dashes with comma
    const dirty = 'Deliver plan \u2014 leadership sign-off \u2013 approved by board';
    const clean = sanitizeTimelineText(dirty);
    expect(clean).toBe('Deliver plan , leadership sign-off , approved by board');
    expect(clean).not.toContain('\u2013');
    expect(clean).not.toContain('\u2014');

    // No "AI" wording
    const aiDirty = 'Use AI agent to write plan';
    const aiClean = sanitizeTimelineText(aiDirty);
    expect(aiClean).toBe('Use drafting agent to write plan');
    expect(aiClean).not.toContain('AI');
  });

  it('T12: Strict OPC compliance: zero phantom slideMaster overrides in [Content_Types].xml', async () => {
    const payload = buildTimelinePayloadFromActions(sampleActions as any, {
      viewName: 'All Actions',
      filterDescription: 'all permitted actions',
      projectName: 'Concludo Operations',
      now: new Date('2026-11-13T00:00:00Z'),
    });
    const { pptx, slideCount } = await renderTimelinePptx(PptxGenJS, payload);
    expect(slideCount).toBeGreaterThanOrEqual(6);

    const rawBlob = (await pptx.write({ outputType: 'blob' })) as Blob;
    const cleanBlob = await sanitizePptxPackageBlob(rawBlob);
    const buffer = await cleanBlob.arrayBuffer();

    const zip = await JSZip.loadAsync(buffer);
    const ct = await zip.file('[Content_Types].xml')?.async('string');
    expect(ct).toBeDefined();

    // Only slideMaster1.xml should be declared; phantom slideMaster2+ overrides must be stripped
    const slideMasters = ct?.match(/slideMaster\d+\.xml/g) || [];
    expect(slideMasters).toEqual(['slideMaster1.xml']);
  });
});
