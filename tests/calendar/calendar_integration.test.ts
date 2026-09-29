import { describe, expect, it } from "bun:test";
import { extractCalendarPayloadItems, parseDateOrNull } from "../../app/src/lib/calendar/calendarAdapter";
import { computeSummaryCounts, getLocalMockCalendarItems, generateToCalendar } from "../../app/src/lib/calendar/calendarClient";
import { CalendarItem, GenerateCalendarPayload } from "../../app/src/lib/calendar/calendarTypes";

describe("Calendar Adapter & Lineage Suite", () => {
  it("parses valid dates and returns null for unconfirmed or relative placeholders", () => {
    expect(parseDateOrNull("2026-10-15")).toBe("2026-10-15");
    expect(parseDateOrNull("TBD")).toBeNull();
    expect(parseDateOrNull("n/a")).toBeNull();
    expect(parseDateOrNull("-")).toBeNull();
    expect(parseDateOrNull("")).toBeNull();
    expect(parseDateOrNull(null)).toBeNull();
  });

  it("extracts real items from output json_content with exact actions, decisions, and risks", () => {
    const mockOutput = {
      id: "out-test-1",
      output_type: "decision_log",
      content: "# Decision Log",
      json_content: {
        actions: {
          rows: [
            ["ACT-001", "Finalise commercial contract", "Anthony Cortez", "2026-10-15", "Open"],
            ["ACT-002", "Establish risk matrix", "Unassigned", "TBD", "Open"],
          ],
        },
        decisions: {
          rows: [
            ["DEC-001", "Approve strategic timeline", "Anthony Cortez", "2026-09-29", "Verified"],
          ],
        },
        risks: {
          rows: [
            ["RSK-001", "Contractual penalty clause", "Legal Counsel"],
          ],
        },
      },
    };

    const items = extractCalendarPayloadItems(mockOutput, "2026-09-29");
    expect(items.length).toBe(4);

    const act1 = items.find((i) => i.reference === "ACT-001");
    expect(act1).toBeDefined();
    expect(act1?.title).toBe("Finalise commercial contract");
    expect(act1?.owner?.name).toBe("Anthony Cortez");
    expect(act1?.due_date).toBe("2026-10-15");

    const act2 = items.find((i) => i.reference === "ACT-002");
    expect(act2).toBeDefined();
    expect(act2?.owner).toBeNull(); // Rule 3: unassigned remains null
    expect(act2?.due_date).toBeNull(); // Rule 3: undated remains null

    const dec1 = items.find((i) => i.reference === "DEC-001");
    expect(dec1).toBeDefined();
    expect(dec1?.type).toBe("review");
    expect(dec1?.title).toContain("Approve strategic timeline");

    const rsk1 = items.find((i) => i.reference === "RSK-001");
    expect(rsk1).toBeDefined();
    expect(rsk1?.type).toBe("review");
    expect(rsk1?.priority).toBe("critical");
  });

  it("never returns invented legacy items or mock data", () => {
    const mockItems = getLocalMockCalendarItems("user-123");
    expect(mockItems.length).toBe(0);
  });

  it("computes summary counts accurately according to Concludo rules", () => {
    const items: CalendarItem[] = [
      {
        id: "1",
        creator_id: "u1",
        type: "task",
        title: "Task 1",
        status: "open",
        visibility: "private",
        created_at: "2026-09-28T00:00:00Z",
        updated_at: "2026-09-28T00:00:00Z",
        due_date: "2026-09-20", // overdue
        owner_name: null, // unowned
      },
      {
        id: "2",
        creator_id: "u1",
        type: "review",
        review_type: "decision",
        title: "Review 1",
        status: "open",
        visibility: "private",
        created_at: "2026-09-28T00:00:00Z",
        updated_at: "2026-09-28T00:00:00Z",
        due_date: null, // undated
        owner_name: "Priya Raman",
      },
      {
        id: "3",
        creator_id: "u1",
        type: "task",
        title: "Task 3",
        status: "completed",
        visibility: "private",
        created_at: "2026-09-28T00:00:00Z",
        updated_at: "2026-09-28T00:00:00Z",
      },
    ];

    const counts = computeSummaryCounts(items);
    expect(counts.totalOpen).toBe(2);
    expect(counts.overdue).toBe(1);
    expect(counts.unowned).toBe(1);
    expect(counts.undated).toBe(1);
    expect(counts.reviewsDue).toBe(1);
  });

  it("extracts meeting sources as event items and distinguishes them from action tasks", () => {
    const mockOutputWithSources = {
      id: "out-multi-source",
      output_type: "action_plan",
      content: "# Action Plan",
      sources: [
        {
          id: "src-1",
          kind: "meeting" as const,
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

  it("extracts decisions and actions from markdown content fallback", () => {
    const mdDecisionLog = {
      id: "test-dec-log",
      output_type: "decision_log",
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
    expect(items[0].reference).toBe("DEC-001");
    expect(items[0].title).toBe("Decision review DEC-001: Proceed with cloud deployment");
    expect(items[0].owner?.name).toBe("Sarah Jenkins");
    expect(items[0].due_date).toBe("2026-10-15");
    expect(items[1].reference).toBe("DEC-002");
    expect(items[1].owner).toBeNull();
  });
});

describe("Calendar Smart Scan & Deduplication Suite", () => {
  it("scans existing project calendar items, skips recorded events, preserves unticked actions, and adds only new items", async () => {
    const existingItems = [
      {
        id: "evt-uuid-1",
        reference: "EVT-001",
        title: "Meeting Session: Kickoff Meeting",
        status: "completed",
        type: "event",
        idempotency_key: "proj-governance_EVT-001",
      },
      {
        id: "act-uuid-1",
        reference: "ACT-001",
        title: "Finalize Scope & Deliverables",
        status: "completed",
        type: "task",
        idempotency_key: "proj-governance_ACT-001",
      },
      {
        id: "act-uuid-2",
        reference: "ACT-002",
        title: "Deploy Cloud Architecture",
        status: "open",
        type: "task",
        idempotency_key: "proj-governance_ACT-002",
      },
    ];

    let upsertedPayload: any[] = [];
    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "calendar_generations") {
          return {
            insert: async () => ({ error: null }),
          };
        }
        if (table === "calendar_items") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: async () => ({ data: existingItems, error: null }),
                }),
              }),
            }),
            upsert: (rows: any[], _options: any) => {
              upsertedPayload = rows;
              return {
                select: async () => ({ data: rows, error: null }),
              };
            },
          };
        }
        if (table === "audit_logs") {
          return {
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
    };

    const incomingPayload: GenerateCalendarPayload = {
      source: {
        type: "project",
        id: "proj-governance",
        title: "Digital Transformation Project",
        project_id: "proj-governance",
      },
      items: [
        {
          reference: "EVT-001",
          type: "event",
          title: "Meeting Session: Kickoff Meeting",
          due_date: "2026-09-20",
          status: "completed",
        },
        {
          reference: "ACT-001",
          type: "task",
          title: "Finalize Scope & Deliverables",
          due_date: "2026-09-25",
          status: "open",
        },
        {
          reference: "ACT-002",
          type: "task",
          title: "Deploy Cloud Architecture",
          due_date: "2026-10-05",
          status: "open",
        },
        {
          reference: "ACT-003",
          type: "task",
          title: "Conduct Security Vulnerability Audit",
          due_date: "2026-10-12",
          status: "open",
        },
        {
          reference: "EVT-002",
          type: "event",
          title: "Meeting Session: Mid-Stage Review",
          due_date: "2026-10-15",
          status: "completed",
        },
      ],
    };

    const result = await generateToCalendar(mockSupabase, "user-test-uuid", incomingPayload);

    // 1 event skipped (EVT-001) + 1 completed action skipped (ACT-001) = 2 skipped
    expect(result.itemsSkipped).toBe(2);
    // 1 unticked action updated (ACT-002)
    expect(result.itemsUpdated).toBe(1);
    // 2 new items created (ACT-003 and EVT-002)
    expect(result.itemsCreated).toBe(2);
    expect(result.error).toBeNull();

    // Total rows sent to DB must be 3 (1 updated unticked + 2 newly created)
    expect(upsertedPayload.length).toBe(3);

    // Check unticked action preserves open status and stable idempotency key
    const updatedAction = upsertedPayload.find((r) => r.reference === "ACT-002");
    expect(updatedAction).toBeDefined();
    expect(updatedAction.status).toBe("open");
    expect(updatedAction.idempotency_key).toBe("proj-governance_ACT-002");

    // Check new items
    const newAction = upsertedPayload.find((r) => r.reference === "ACT-003");
    expect(newAction).toBeDefined();
    expect(newAction.type).toBe("task");

    const newEvent = upsertedPayload.find((r) => r.reference === "EVT-002");
    expect(newEvent).toBeDefined();
    expect(newEvent.type).toBe("event");
  });
});
