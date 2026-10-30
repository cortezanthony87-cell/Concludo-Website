/**
 * Fictional sample for the deck. Every name, organisation and figure is
 * invented. Used by the sample button and the tests.
 */
import type { DeckPayload } from '../../lib/outputs/deck/deckPayload';

export const DECK_SAMPLE: DeckPayload = {
  schema: 'concludo.deck/1.0',
  audience: 'client',
  meeting: {
    recordId: 'KV-2026-10-28',
    version: 1,
    title: 'Phase one strategy review',
    client: 'Kestrel and Vale',
    kind: 'Client meeting record',
    outcomeLine: 'Phased rollout approved, starting in Geelong',
    dateISO: '2026-10-28',
    durationMinutes: 45,
    format: 'Video call',
  },
  preparedBy: { name: 'Sam Ortiz', organisation: 'Ortiz Advisory' },
  approval: { by: 'Sam Ortiz', atISO: '2026-10-28T05:12:00Z' },
  classification: 'Commercial in confidence',
  summary: {
    headline: 'Kestrel and Vale will run a phased rollout, beginning with the Geelong office in November',
    body: 'Phase one budget is capped at AU$42,000, provisional until two supplier quotes are on file. The weekly check-in moves to Thursdays at 9:30 am.',
  },
  decisions: [
    { id: 'D-01', review: 'confirmed', text: 'Proceed with Option B, the phased rollout, starting in Geelong', decidedBy: 'Jo Han', decidedByOrg: 'Kestrel and Vale', conditions: null, source: { line: 112, time: '14:05', quote: "Let's go with B and start in Geelong" } },
    { id: 'D-02', review: 'confirmed', text: 'Cap phase one budget at AU$42,000', decidedBy: 'Jo Han', decidedByOrg: 'Kestrel and Vale', conditions: 'Provisional until two supplier quotes are received', source: { line: 140, time: '18:22' } },
    { id: 'D-03', review: 'confirmed', text: 'Move the weekly check-in to Thursdays, 9:30 am', decidedBy: 'Jo Han and Sam Ortiz', decidedByOrg: null, conditions: null, source: { line: 171, time: '23:50' } },
  ],
  actions: [
    { id: 'A-01', review: 'confirmed', text: 'Send revised phase one scope', owner: 'Sam Ortiz', clientSide: false, dueISO: '2026-11-04', doneWhen: 'Scope signed by Jo Han', source: { line: 131, time: '16:40' } },
    { id: 'A-02', review: 'confirmed', text: 'Provide current Geelong staff roster', owner: 'Jo Han', clientSide: true, dueISO: '2026-11-06', doneWhen: 'Roster in shared folder', source: { line: 135 } },
    { id: 'A-03', review: 'confirmed', text: 'Request two supplier quotes', owner: 'Sam Ortiz', clientSide: false, dueISO: '2026-11-11', doneWhen: 'Two quotes on file', source: { line: 152 } },
    { id: 'A-04', review: 'confirmed', text: 'Confirm IT access for the pilot team', owner: 'Lee Marsh', clientSide: true, dueISO: null, doneWhen: null, source: { line: 160 } },
    { id: 'A-05', review: 'confirmed', text: 'Book the phase one kickoff', owner: 'Sam Ortiz', clientSide: false, dueISO: '2026-11-13', doneWhen: 'Invite accepted by all', source: { line: 176 } },
  ],
  openQuestions: [
    { id: 'Q-01', review: 'confirmed', text: 'Does phase one include the Ballarat team?', resolver: 'Jo Han', neededByISO: '2026-11-06', source: { line: 158, time: '21:12' } },
    { id: 'Q-02', review: 'confirmed', text: 'Who signs the supplier contract?', resolver: null, neededByISO: null, source: { line: 166 } },
  ],
  risks: [
    { id: 'R-01', review: 'confirmed', text: 'Supplier lead times could push kickoff past 20 November', raisedBy: 'Lee Marsh', mitigationIds: ['A-03'], source: { line: 149 } },
  ],
  nothingLeftOpenConfirmed: false,
  nextMeeting: { dateISO: '2026-11-05', timeLabel: '9:30 am', mustProduce: 'A signed phase one scope and an answer on Ballarat', bringIds: ['A-01', 'A-02'] },
  correctionDeadline: { label: '12 pm Thursday 29 October', contact: 'Sam Ortiz' },
};
