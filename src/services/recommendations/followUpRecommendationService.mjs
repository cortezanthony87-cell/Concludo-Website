/**
 * Tasklet 4.7: Follow-Up Recommendation Engine
 * 
 * Identify follow-up actions, second-order discussions, and subsequent meetings.
 * Detects: "tabled for next time", "take offline", "parked", "circle back".
 */

export const DEFERRAL_PATTERNS = [
  /tabled for next time/i,
  /take (?:.+? )?offline/i,
  /park(?:ed)? (?:.+? )?for next time/i,
  /park(?:ed)? (?:this|the topic)/i,
  /circle back/i,
  /discuss separately/i
];

export function detectFollowUpItems(transcriptLines = []) {
  const followUps = [];

  transcriptLines.forEach((line, idx) => {
    const text = typeof line === 'string' ? line : line.text || '';
    for (const pat of DEFERRAL_PATTERNS) {
      if (pat.test(text)) {
        followUps.push({
          type: 'FOLLOW_UP_AGENDA',
          detected_phrase: text.match(pat)[0],
          context: text,
          suggested_agenda_topic: `Follow-up review on deferred discussion item (Line ${idx + 1})`,
          recommended_attendees: 'Key stakeholders involved in initial deferral'
        });
        break;
      }
    }
  });

  return followUps;
}
