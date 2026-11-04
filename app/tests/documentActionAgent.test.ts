import { describe, it, expect } from 'bun:test';
import { runDocumentActionAgent } from '../src/lib/actions/documentActionAgent';

describe('Document Action Agent in Action Command Hub', () => {
  it('extracts actions and tasks from document plan text', () => {
    const sampleDoc = `
# Concludo Operations Plan 2026
Author: Anthony Cortez
Version Date: 1 November 2026
Day 1 is Monday 26 October 2026

## Stage 1: Initial Sprint (26 October to 8 November 2026)
### Actions (measurable)
☐ Days 1 to 3: send brief to commercial lawyer regarding standard terms
☐ Days 4 to 7: configure email webhook edge function
☐ Days 8 to 12: prepare presentation for key account review

| Metric | Detail |
| :--- | :--- |
| Decision gate | Pass test: All regulatory checks completed |
| If missed, stop | Pause new enterprise onboarding |
| If exceeded, accelerate | Expand customer invite list |

## Stage 2: Public Launch
### Actions (measurable)
☐ Host launch conference and presentation with founders
☐ Finalise invoice reconciliation
`;

    const result = runDocumentActionAgent(sampleDoc, 'Operations_Plan_2026.md');

    expect(result.success).toBe(true);
    expect(result.actions.length).toBe(5);
    expect(result.agentUsed.name).toBe('Document Intelligence Agent');

    // Check anchor date calculations for Day 1 is Monday 26 Oct 2026
    const action1 = result.actions[0];
    expect(action1.title).toContain('send brief to commercial lawyer');
    expect(action1.dueDate).toBe('2026-10-28'); // Days 1 to 3 -> 26 + 3 - 1 = 28
    expect(action1.addToCalendar).toBe(true);

    // Check event categorization
    const launchEvent = result.actions.find((a) => a.title.includes('Host launch conference'));
    expect(launchEvent).toBeDefined();
    expect(launchEvent?.kind).toBe('event');

    // Check gates count
    expect(result.gatesCount).toBe(1);
  });

  it('flags undated actions and prepares prompt for user date selection', () => {
    const undatedDoc = `
## Next steps
* Review quarterly subscription pricing
* Update terms of service documentation
`;
    const result = runDocumentActionAgent(undatedDoc, 'Pricing_Update.txt');
    expect(result.success).toBe(true);
    expect(result.actions.length).toBe(2);
    expect(result.missingDateCount).toBe(2);
    expect(result.actions[0].dueDate).toBe('');
    expect(result.actions[0].addToCalendar).toBe(false);
  });
});
