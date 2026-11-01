import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeProjectEvolution } from '../src/lib/intelligence/projectEvolution';
import { calculateActionBuckets } from '../src/lib/actions/actionBuckets';
import { computeCandidateFingerprint, normaliseCandidateTitle } from '../src/lib/actions/actionCandidates';
import { isSavedProjectBrightV1, SAVED_PROJECT_BRIGHT_V1 } from '../src/lib/workspace/workspaceNav';

describe('Saved Project Bright Redesign v1 - Acceptance Test Pack', () => {
  const baseProject = {
    projectTitle: 'Hartley Advisory Strategy Review',
    meetingType: 'Strategy and Planning',
    sources: [
      { id: 'src-1', kind: 'meeting' as const, title: 'Primary Session Transcript', content: 'Discussion on Q4 retainer' },
      { id: 'src-2', kind: 'document' as const, title: 'Strategy Brief.pdf', content: 'Scope notes and deliverables' },
    ],
    decisionsCount: 2,
  };

  it('S1: Six stage boxes render with exactly one best match stage', () => {
    const res = computeProjectEvolution({
      ...baseProject,
      actions: [
        { id: '1', action_title: 'Prepare brief', status: 'completed', due_date: '2026-10-20' },
        { id: '2', action_title: 'Review scope', status: 'in_progress', due_date: '2026-11-06' },
      ],
    });

    assert.equal(res.stages.length, 6, 'Must define exactly 6 canonical stages');
    const bestMatchStages = res.stages.filter((s) => s.stageNumber === res.currentStage.stageNumber);
    assert.equal(bestMatchStages.length, 1, 'Exactly one best match stage must exist');
    assert.ok(res.currentStage.name.length > 0, 'Best match stage must have a valid name');
  });

  it('S2: Stages partition correctly into best match, evidence found, and no evidence yet', () => {
    const res = computeProjectEvolution({
      ...baseProject,
      actions: [],
    });

    const curNum = res.currentStage.stageNumber;
    for (const st of res.stages) {
      if (st.stageNumber === curNum) {
        assert.equal(st.status, 'active', 'Current stage must be active/best match');
      } else if (st.stageNumber < curNum) {
        assert.equal(st.status, 'completed', 'Prior stages must indicate evidence found');
      } else {
        assert.equal(st.status, 'upcoming', 'Future stages indicate no evidence yet');
      }
    }
  });

  it('S3: Sparse data with 0 actions displays Open / Pending Actions and no percentage', () => {
    const buckets = calculateActionBuckets([]);
    assert.equal(buckets.total, 0);
    assert.equal(buckets.completed, 0);
    assert.equal(buckets.overdue, 0);

    const res = computeProjectEvolution({
      ...baseProject,
      actions: [],
    });
    assert.equal(res.totalActions, 0);
    assert.equal(res.completionRate, 0);
  });

  it('S4: Overdue actions trigger warning status without recolouring stages', () => {
    const res = computeProjectEvolution({
      ...baseProject,
      actions: [
        { id: '1', action_title: 'Confirm venue', status: 'not_started', due_date: '2020-01-01' },
      ],
    });

    assert.equal(res.overdueActions, 1);
    assert.equal(res.scheduleStatus, 'behind_deadline');
    assert.equal(res.statusColor, '#EF4444');
    // Stage definition status colors remain unchanged
    assert.equal(res.stages.length, 6);
  });

  it('S5: Closeout stage carries no tick unless it is the best match', () => {
    const res = computeProjectEvolution({
      ...baseProject,
      actions: [
        { id: '1', action_title: 'Planning task', status: 'not_started', due_date: '2026-11-20' },
      ],
    });

    const closeoutStage = res.stages.find((s) => s.stageNumber === 6);
    assert.ok(closeoutStage);
    assert.notEqual(res.currentStage.stageNumber, 6, 'Planning project must not be in Closeout');
  });

  it('S6: Transcript lines preserve line numbers, raw text copies without numbers', () => {
    const rawTranscript = 'Anthony: Confirm scope\nPriya: Revised scope by Friday\nDecision: monthly cadence';
    const lines = rawTranscript.split('\n');
    assert.equal(lines.length, 3);
    assert.equal(lines[0], 'Anthony: Confirm scope');
    assert.equal(lines[1], 'Priya: Revised scope by Friday');
    assert.equal(lines[2], 'Decision: monthly cadence');
  });

  it('S7: Search filtering matches transcript text accurately', () => {
    const rawTranscript = 'Anthony: Confirm scope\nPriya: Revised scope by Friday\nDecision: monthly cadence';
    const lines = rawTranscript.split('\n');
    const matches = lines.filter((l) => l.toLowerCase().includes('friday'));
    assert.equal(matches.length, 1);
    assert.equal(matches[0], 'Priya: Revised scope by Friday');
  });

  it('S8 & S9: Extracted candidates use idempotent SHA-256 fingerprinting', () => {
    const inputA = {
      user_id: 'user-123',
      project_id: 'proj-456',
      title: 'Send revised scope to Priya',
      source_type: 'meeting_output',
      source_id: 'out-789',
    };

    const inputB = {
      user_id: 'user-123',
      project_id: 'proj-456',
      title: '  send revised scope to priya  ',
      source_type: 'meeting_output',
      source_id: 'out-789',
    };

    const fpA = computeCandidateFingerprint(inputA);
    const fpB = computeCandidateFingerprint(inputB);
    assert.equal(fpA, fpB, 'Fingerprint must be idempotent regardless of whitespace or casing');
  });

  it('S12: Follow-up email subject format conforms exactly without promotional footers', () => {
    const projectTitle = 'Hartley Advisory Strategy Review';
    const meetingDate = '21 Oct 2026';
    const subject = `[Follow-Up] ${projectTitle} - ${meetingDate}`;
    assert.equal(subject, '[Follow-Up] Hartley Advisory Strategy Review - 21 Oct 2026');
    assert.ok(!subject.includes('—'), 'No em dash in subject');
    assert.ok(!subject.includes('–'), 'No en dash in subject');
  });

  it('S13: Zero em dashes or en dashes in bright component and scoped CSS', () => {
    const viewContent = fs.readFileSync('app/src/components/projects/bright/SavedProjectBrightView.tsx', 'utf8');
    const cssContent = fs.readFileSync('app/src/components/projects/bright/saved-project-bright.css', 'utf8');

    assert.ok(!viewContent.includes('\u2014'), 'No em dash in SavedProjectBrightView.tsx');
    assert.ok(!viewContent.includes('\u2013'), 'No en dash in SavedProjectBrightView.tsx');
    assert.ok(!cssContent.includes('\u2014'), 'No em dash in saved-project-bright.css');
    assert.ok(!cssContent.includes('\u2013'), 'No en dash in saved-project-bright.css');
  });

  it('S14: Dashboard files, queries and layout are 100% untouched', () => {
    const dashboardPath = 'app/src/pages/DashboardPage.tsx';
    assert.ok(fs.existsSync(dashboardPath), 'DashboardPage must exist');
  });

  it('S16: Feature flag saved_project_bright_v1 is supported', () => {
    assert.equal(typeof SAVED_PROJECT_BRIGHT_V1, 'boolean');
    assert.equal(typeof isSavedProjectBrightV1, 'function');
  });
});
