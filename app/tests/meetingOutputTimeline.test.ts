import { describe, it, expect } from 'bun:test';
import PptxGenJS from 'pptxgenjs';
import {
  checkMeetingTimelineEligibility,
  buildTimelinePayloadFromMeeting,
  buildTimelineFileName,
  renderTimelinePptx,
} from '../src/lib/outputs/timeline';

describe('Meeting Output Action Timeline Integration Tests', () => {
  // Harborview sample meeting fixture matching brief
  const harborviewMeeting = {
    meta: {
      title: 'Harborview Developments: Scope v3 and delivery plan review',
      project: 'Harborview Developments',
      meetingDate: '2026-11-16',
      meetingType: 'Project kick-off',
      organisation: 'Harborview Developments',
    },
    actions: [
      { id: 'A-01', task: 'Send written comments on scope v3', owner: 'Alex Mercer', due: '2026-11-18', status: 'not_started', review: 'proposed' },
      { id: 'A-02', task: 'Confirm site access for the Monday 23 Nov geotechnical walk', owner: 'Priya Kaur', due: '2026-11-20', status: 'not_started', review: 'confirmed' },
      { id: 'A-03', task: 'Raise the purchase order for phases one and two', owner: 'Tom Nguyen', due: '2026-11-20', status: 'not_started', review: 'confirmed' },
      { id: 'A-04', task: 'Send a revised delivery plan with the council feedback window', owner: 'Alex Mercer', due: '2026-11-25', status: 'not_started', review: 'confirmed' },
      { id: 'A-05', task: 'Check whether heritage clearance applies to the perimeter wall', owner: null, due: null, status: 'not_started', review: 'proposed' },
    ],
    nextMeeting: {
      date: '2026-11-30',
      time: '2:00 pm AEDT',
    },
    openItems: [
      { id: 'Q-01', question: 'Does the council need the traffic plan before the pre-application, or at submission?', owner: 'Priya Kaur', review: 'proposed' },
      { id: 'Q-02', question: 'Who signs off changes to scope v3 from here?', owner: null, review: 'proposed' },
    ],
    decisions: [
      { id: 'D-01', statement: 'Adopt scope v3 as the delivery baseline', review: 'confirmed' },
    ],
  };

  it('State 1: Ready - builds timeline with 6 slides for Harborview meeting', async () => {
    const elig = checkMeetingTimelineEligibility(harborviewMeeting.actions, harborviewMeeting.nextMeeting);
    expect(elig.status).toBe('ready');
    expect(elig.openActionsCount).toBe(5);
    expect(elig.datedCount).toBe(4);
    expect(elig.undatedCount).toBe(1);
    expect(elig.hasNextMeetingDate).toBe(true);
    expect(elig.slideCount).toBe(6);
    expect(elig.slides).toEqual(['cover', 'road', 'weeks', 'horizon', 'attention', 'nextMeeting']);

    const payload = buildTimelinePayloadFromMeeting(harborviewMeeting);
    expect(payload.isMeetingMode).toBe(true);
    expect(payload.meetingDate).toBe('2026-11-16');
    expect(payload.actions.length).toBe(5);
    expect(payload.openQuestions?.length).toBe(2);

    const { pptx, slideCount } = await renderTimelinePptx(PptxGenJS, payload);
    expect(slideCount).toBe(6);
  });

  it('State 2: Not needed - 0 actions agreed', () => {
    const elig = checkMeetingTimelineEligibility([], { date: '2026-11-30' });
    expect(elig.status).toBe('not_needed_no_actions');
    expect(elig.slideCount).toBe(0);
    expect(elig.reason).toContain('No actions were agreed');
  });

  it('State 2: Not needed - actions exist but none dated', () => {
    const undatedActions = [
      { id: 'A-01', task: 'Task 1', owner: 'Alice', due: null },
      { id: 'A-02', task: 'Task 2', owner: 'Bob', due: '' },
    ];
    const elig = checkMeetingTimelineEligibility(undatedActions, undefined);
    expect(elig.status).toBe('not_needed_no_dates');
    expect(elig.slideCount).toBe(0);
    expect(elig.reason).toContain('none has a date');
  });

  it('State 3: Needs one more date - 1 dated action and no next meeting', () => {
    const singleDated = [
      { id: 'A-01', task: 'Task 1', owner: 'Alice', due: '2026-11-20' },
      { id: 'A-02', task: 'Task 2', owner: 'Bob', due: null },
    ];
    const elig = checkMeetingTimelineEligibility(singleDated, undefined);
    expect(elig.status).toBe('needs_one_more_date');
    expect(elig.slideCount).toBe(0);
    expect(elig.reason).toContain('A timeline needs at least two dates');
  });

  it('Edge case: 1 dated action AND a next meeting turns status to ready', () => {
    const singleDated = [
      { id: 'A-01', task: 'Task 1', owner: 'Alice', due: '2026-11-20' },
    ];
    const nextMeeting = { date: '2026-11-27', time: '10:00 am' };
    const elig = checkMeetingTimelineEligibility(singleDated, nextMeeting, { meetingId: 'Edge: 1 dated action and a next meeting' });
    expect(elig.status).toBe('ready');
    expect(elig.slides).toEqual(['cover', 'road', 'nextMeeting']);
    expect(elig.slideCount).toBe(3);
  });

  it('Rule check: Excluded actions in review are never included in timeline', () => {
    const actionsWithExcluded = [
      { id: 'A-01', task: 'Task 1', owner: 'Alice', due: '2026-11-20', review: 'excluded' },
      { id: 'A-02', task: 'Task 2', owner: 'Bob', due: '2026-11-22', review: 'confirmed' },
      { id: 'A-03', task: 'Task 3', owner: 'Charlie', due: '2026-11-25', review: 'proposed' },
    ];
    const elig = checkMeetingTimelineEligibility(actionsWithExcluded, undefined);
    expect(elig.status).toBe('ready');
    expect(elig.openActionsCount).toBe(2); // A-01 excluded
    expect(elig.datedCount).toBe(2);

    const payload = buildTimelinePayloadFromMeeting({
      meta: { title: 'Test Review Exclusions', meetingDate: '2026-11-16' },
      actions: actionsWithExcluded,
    });
    expect(payload.actions.length).toBe(2);
    expect(payload.actions.some((a) => a.id === 'A-01')).toBe(false);
  });

  it('Rule check: Clean dash-free file naming and sanitisation', () => {
    const fileName = buildTimelineFileName('Harborview Developments: Scope v3', '2026-11-16');
    expect(fileName).toBe('Concludo_Timeline_Harborview_Developments_Scope_v3_2026_11_16.pptx');
    expect(fileName).not.toContain('-');
    expect(fileName).not.toContain('\u2013');
    expect(fileName).not.toContain('\u2014');
  });

  it('Slide count calculation: 7 owners creates 2 week continuation slides (Math.ceil(7/5) = 2)', () => {
    const sevenOwnersActions = Array.from({ length: 7 }).map((_, i) => ({
      id: `A-${i + 1}`,
      task: `Task ${i + 1}`,
      owner: `Owner ${i + 1}`,
      due: '2026-11-20',
      review: 'confirmed',
    }));
    const elig = checkMeetingTimelineEligibility(sevenOwnersActions, undefined);
    // slides: cover, road, weeks, horizon (4) + 1 extra weeks chunk = 5 slides
    expect(elig.slideCount).toBe(5);
  });
});
