/**
 * Tasklet 3.10: Insight Prioritisation and Selection Engine
 * 
 * Rank and select top insights for delivery, enforcing strict channel caps.
 * Caps: INS-A (5), INS-B (4), INS-C (3), INS-D (2), INS-E (6), INS-F (3), INS-G (3), INS-H (2).
 * Tier T2: INS-A, INS-E, INS-F active. Other channels dormant.
 * Tier T3+: All 8 channels active.
 */

export const CHANNEL_CAPS = {
  'INS-A': 5,
  'INS-B': 4,
  'INS-C': 3,
  'INS-D': 2,
  'INS-E': 6,
  'INS-F': 3,
  'INS-G': 3,
  'INS-H': 2
};

export const TIER_ENABLED_CHANNELS = {
  'T1': [],
  'T2': ['INS-A', 'INS-E', 'INS-F'],
  'T3': ['INS-A', 'INS-B', 'INS-C', 'INS-D', 'INS-E', 'INS-F', 'INS-G', 'INS-H'],
  'T4': ['INS-A', 'INS-B', 'INS-C', 'INS-D', 'INS-E', 'INS-F', 'INS-G', 'INS-H']
};

function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return (2 * intersection) / (wordsA.size + wordsB.size);
}

export function curateTopInsights(meetingId, allFindings = [], limit = 15, tier = 'T2') {
  const enabledChannels = new Set(TIER_ENABLED_CHANNELS[tier] || TIER_ENABLED_CHANNELS['T2']);
  const channelCounts = {};

  // Filter by enabled channels
  const filtered = allFindings.filter(f => enabledChannels.has(f.channel_id));

  // Deduplicate and cap per channel
  const curated = [];
  for (const finding of filtered) {
    const ch = finding.channel_id;
    const currentCount = channelCounts[ch] || 0;
    const maxCap = CHANNEL_CAPS[ch] || 3;

    if (currentCount >= maxCap) continue;

    // Check similarity with already accepted findings in same channel
    const text = finding.observation_text || finding.question_text || '';
    const isDuplicate = curated.some(c => c.channel_id === ch && textSimilarity(text, c.observation_text || c.question_text) >= 0.85);

    if (!isDuplicate) {
      curated.push(finding);
      channelCounts[ch] = currentCount + 1;
    }

    if (curated.length >= limit) break;
  }

  return curated;
}
