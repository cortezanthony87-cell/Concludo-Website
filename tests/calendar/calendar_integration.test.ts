import { describe, expect, it } from 'bun:test';
import { extractCalendarPayloadItems, parseDateOrNull } from '../../app/src/lib/calendar/calendarAdapter';
import { computeSummaryCounts, getLocalMockCalendarItems } from '../../app/src/lib/calendar/calendarClient';
import { CalendarItem } from '../../app/src/lib/calendar/calendarTypes';

describe('Calendar Adapter & Lineage Suite', () => {
  it('parses valid dates and returns null for unconfirmed or relative placeholders', () => {
    expect(parseDateOrNull('2026-10-15')).toBe('2026-10-15');
    expect(parseDateOrNull('TBD')).toBeNull();
    expect(parseDateOrNull('n/a')).toBeNull();
    expect(parseDateOrNull('-')).toBeNull();
    expect(parseDateOrNull('')).toBeNull();
    expect(parseDateOrNull(null)).toBeNull();
  });

  it('extracts real items from output json_content with exact actions, decisions, and risks', () => {
    const mockOutput = {
      id: 'out-test-1',
      output_type: 'decision_log',
      content: '# Decision Log',
      json_content: {
        actions: {
          rows: [
            ['ACT-001', 'Finalise commercial contract', 'Anthony Cortez', '2026-10-15', 'Open'],
            ['ACT-002', 'Establish risk matrix', 'Unassigned', 'TBD', 'Open'],
          ],
        },
        decisions: {
          rows: [
            ['DEC-001', 'Approve strategic timeline', 'Anthony Cortez', '2026-09-29', 'Verified'],
          ],
        },
        risks: {
          rows: [
            ['RSK-001', 'Contractual penalty clause', 'Legal Counsel'],
          ],
        },
      },
    };

    const items = extractCalendarPayloadItems(mockOutput, '2026-09-29');
    expect(items.length).toBe(4);

    const act1 = items.find((i) => i.reference === 'ACT-001');
    expect(act1).toBeDefined();
    expect(act1?.title).toBe('Finalise commercial contract');
    expect(act1?.owner?.name).toBe('Anthony Cortez');
    expect(act1?.due_date).toBe('2026-10-15');

    const act2 = items.find((i) => i.reference === 'ACT-002');
    expect(act2).toBeDefined();
    expect(act2?.owner).toBeNull(); // Rule 3: unassigned remains null
    expect(act2?.due_date).toBeNull(); // Rule 3: undated remains null

    const dec1 = items.find((i) => i.reference === 'DEC-001');
    expect(dec1).toBeDefined();
    expect(dec1?.type).toBe('review');
    expect(dec1?.title).toContain('Approve strategic timeline');

    const rsk1 = items.find((i) => i.reference === 'RSK-001');
    expect(rsk1).toBeDefined();
    expect(rsk1?.type).toBe('review');
    expect(rsk1?.priority).toBe('critical');
  });

  it('never returns invented legacy items or mock data', () => {
    const mockItems = getLocalMockCalendarItems('user-123');
    expect(mockItems.length).toBe(0);
  });

  it('computes summary counts accurately according to Concludo rules', () => {
    const items: CalendarItem[] = [
      {
        id: '1',
        creator_id: 'u1',
        type: 'task',
        title: 'Task 1',
        status: 'open',
        visibility: 'private',
        created_at: '2026-09-28T00:00:00Z',
        updated_at: '2026-09-28T00:00:00Z',
        due_date: '2026-09-20', // overdue
        owner_name: null, // unowned
      },
      {
        id: '2',
        creator_id: 'u1',
        type: 'review',
        review_type: 'decision',
        title: 'Review 1',
        status: 'open',
        visibility: 'private',
        created_at: '2026-09-28T00:00:00Z',
        updated_at: '2026-09-28T00:00:00Z',
        due_date: null, // undated
        owner_name: 'Priya Raman',
      },
      {
        id: '3',
        creator_id: 'u1',
        type: 'task',
        title: 'Task 3',
        status: 'completed',
        visibility: 'private',
        created_at: '2026-09-28T00:00:00Z',
        updated_at: '2026-09-28T00:00:00Z',
      },
    ];

    const counts = computeSummaryCounts(items);
    expect(counts.totalOpen).toBe(2);
    expect(counts.overdue).toBe(1);
    expect(counts.unowned).toBe(1);
    expect(counts.undated).toBe(1);
    expect(counts.reviewsDue).toBe(1);
  });
});
  it("extracts meeting sources as event items and distinguishes them from action tasks", () => {
    const mockOutputWithSources = {
      id: "out-multi-source",
      output_type: "action_plan",
      content: "# Action Plan",
      sources: [
        {
          id: "src-1",
          kind: "meeting",
          title: "Executive Kickoff",
          date: "2026-09-27",
          meetingType: "Steering Committee",
          attendees: ["Anthony Cortez", "Sarah Jenkins"],
        },
      ],
      json_content: {
        actions: {
          rows: [
            ["ACT-01", "Deliver Stage 2 Architecture", "Anthony Cortez", "2026-10-15", "Open"],
          ],
        },
      },
    };

    const items = extractCalendarPayloadItems(mockOutputWithSources);
    expect(items.length).toBe(2);

    const eventItem = items.find((i) => i.type === "event");
    expect(eventItem).toBeDefined();
    expect(eventItem?.reference).toBe("EVT-001");
    expect(eventItem?.title).toContain("Executive Kickoff");
    expect(eventItem?.status).toBe("completed"); // Historical record

    const actionItem = items.find((i) => i.type === "task");
    expect(actionItem).toBeDefined();
    expect(actionItem?.reference).toBe("ACT-01");
    expect(actionItem?.status).toBe("open"); // Action task to be completed
  });

  it('extracts decisions and actions from markdown content fallback', () => {
    const mdDecisionLog = {
      id: 'test-dec-log',
      output_type: 'decision_log',
      content: `# Governed Decision Log
### Decision 1: Proceed with cloud deployment
- **Status:** Approved
- **Decision Owner:** Sarah Jenkins
- **Date:** 2026-10-15
- **Summary:** Approved migration.

### Decision 2: Defer secondary integration
- **Status:** Approved
- **Decision Owner:** TBD
- **Date:** 2026-10-20
- **Summary:** Secondary postponed.`,
    };

    const items = extractCalendarPayloadItems(mdDecisionLog);
    expect(items.length).toBe(2);
    expect(items[0].reference).toBe('DEC-001');
    expect(items[0].title).toBe('Decision review DEC-001: Proceed with cloud deployment');
    expect(items[0].owner?.name).toBe('Sarah Jenkins');
    expect(items[0].due_date).toBe('2026-10-15');
    expect(items[1].reference).toBe('DEC-002');
    expect(items[1].owner).toBeNull();
  });
