/**
 * Speaker label detection for Concludo Workspace transcripts.
 *
 * Basic detection rule:
 * If the transcript contains multiple lines that begin with a short speaker name or label
 * followed by a colon, treat speaker labels as detected.
 *
 * Examples that should count:
 * - Anthony: We need to confirm the next step.
 * - Client: That sounds right.
 * - Speaker 1: I can send that tomorrow.
 * - Sarah Jones: Let’s move this to Friday.
 *
 * Examples that should not count:
 * - Paragraph text without names
 * - A normal sentence with a colon inside it
 * - One isolated colon only
 */
export function detectSpeakerLabels(rawText: string): boolean {
  if (!rawText || typeof rawText !== 'string') {
    return false;
  }

  const lines = rawText.split(/\r?\n/);
  let speakerLineCount = 0;

  // Regex breakdown:
  // Matches line starting with:
  // - "Speaker 1", "Speaker A", "Participant 1", etc.
  // - Or a short name (1 to 28 characters) beginning with uppercase letter, containing alphanumeric/spaces/dots/hyphens
  // Followed by colon ":" and at least one space and dialogue text.
  const speakerLabelRegex = /^\s*(?:(?:Speaker\s*[0-9A-Za-z]+)|(?:Participant\s*[0-9A-Za-z]+)|(?:[A-Z][A-Za-z0-9\s._'-]{0,27}))\s*:\s+\S+/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Discard lines that look like web URLs (e.g. https://...)
    if (/^https?:\/\//i.test(trimmed)) continue;

    // Discard lines that start with timecode formats (e.g. 09:30 or 00:15:20)
    if (/^\d{1,2}:\d{2}(?::\d{2})?/.test(trimmed)) continue;

    if (speakerLabelRegex.test(trimmed)) {
      speakerLineCount++;
      if (speakerLineCount >= 2) {
        return true;
      }
    }
  }

  return false;
}
