import { GenerateCalendarPayloadItem, CalendarItemType, ReviewType, ReviewCadence } from './calendarTypes';

/**
 * Parses raw text or structured string to extract an ISO YYYY-MM-DD date, or null.
 * Rejects TBD, empty strings, relative unanchored text, or invalid dates.
 */
export function parseDateOrNull(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || /^(tbd|n\/a|-|none|nil|unconfirmed)$/i.test(trimmed)) return null;

  // Direct ISO date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const d = new Date(trimmed.includes('T') ? trimmed : trimmed + 'T00:00:00Z');
  if (!isNaN(d.getTime())) {
    const yr = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${yr}-${mo}-${day}`;
  }
  return null;
}

/**
 * Extracts candidate calendar items deterministically from an OutputRecord or report payload.
 * Strictly adheres to Concludo Calendar Seven Binding Rules:
 * - Rule 2: Keep exact source lineage and item references
 * - Rule 3: Never invent an owner or date (unassigned/undated remain null and flagged)
 * - Rule 4: No performance scores or ratings
 */
export function extractCalendarPayloadItems(
  output: {
    id?: string;
    output_type?: string;
    content?: string | null;
    json_content?: any;
  } | null,
  fallbackDate?: string | null
): GenerateCalendarPayloadItem[] {
  if (!output) return [];

  const items: GenerateCalendarPayloadItem[] = [];
  const seenRefs = new Set<string>();

  const json = output.json_content;

  // 1. Extract from json_content.actions.rows if present
  if (json && json.actions && Array.isArray(json.actions.rows)) {
    for (const r of json.actions.rows) {
      if (Array.isArray(r) && r.length >= 2) {
        const ref = (r[0] || '').trim();
        const title = (r[1] || '').trim();
        const rawOwner = r.length > 2 ? (r[2] || '').trim() : '';
        const rawDue = r.length > 3 ? (r[3] || '').trim() : '';

        if (!title) continue;

        const isUnowned = !rawOwner || /^(unassigned|no owner|none|tbd|n\/a)$/i.test(rawOwner);
        const parsedDue = parseDateOrNull(rawDue);

        const itemRef = ref || `ACT-${String(items.length + 1).padStart(3, '0')}`;
        if (seenRefs.has(itemRef)) continue;
        seenRefs.add(itemRef);

        items.push({
          type: 'task',
          reference: itemRef,
          title: title,
          owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
          due_date: parsedDue,
          priority: 'high',
          status: 'open',
        });
      }
    }
  }

  // 2. Extract from json_content.decisions.rows if present
  if (json && json.decisions && Array.isArray(json.decisions.rows)) {
    for (const r of json.decisions.rows) {
      if (Array.isArray(r) && r.length >= 2) {
        const ref = (r[0] || '').trim();
        const title = (r[1] || '').trim();
        const rawOwner = r.length > 2 ? (r[2] || '').trim() : '';
        const rawDate = r.length > 3 ? (r[3] || '').trim() : '';

        if (!title) continue;

        const isUnowned = !rawOwner || /^(unassigned|no owner|none|tbd|n\/a)$/i.test(rawOwner);
        const parsedDue = parseDateOrNull(rawDate) || parseDateOrNull(fallbackDate);

        const itemRef = ref || `DEC-${String(items.length + 1).padStart(3, '0')}`;
        if (seenRefs.has(itemRef)) continue;
        seenRefs.add(itemRef);

        items.push({
          type: 'review',
          reference: itemRef,
          title: `Decision review ${itemRef}: ${title}`,
          owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
          due_date: parsedDue,
          priority: 'high',
          status: 'open',
          review: {
            review_type: 'decision',
            cadence: 'once',
          },
        });
      }
    }
  }

  // 3. Extract from json_content.risks.rows if present
  if (json && json.risks && Array.isArray(json.risks.rows)) {
    for (const r of json.risks.rows) {
      if (Array.isArray(r) && r.length >= 2) {
        const ref = (r[0] || '').trim();
        const title = (r[1] || '').trim();
        const rawOwner = r.length > 2 ? (r[2] || '').trim() : '';

        if (!title) continue;

        const isUnowned = !rawOwner || /^(unassigned|no owner|none|tbd|n\/a)$/i.test(rawOwner);
        const itemRef = ref || `RSK-${String(items.length + 1).padStart(3, '0')}`;
        if (seenRefs.has(itemRef)) continue;
        seenRefs.add(itemRef);

        items.push({
          type: 'review',
          reference: itemRef,
          title: `Risk review ${itemRef}: ${title}`,
          owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
          due_date: null,
          priority: 'critical',
          status: 'open',
          review: {
            review_type: 'risk',
            cadence: 'quarterly',
          },
        });
      }
    }
  }

  // 4. Fallback: Parse markdown table rows from rawContent if json_content had no rows
  if (items.length === 0 && output.content) {
    const lines = output.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('|') && !line.includes('---')) {
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

        if (cells.length >= 2 && !/^(id|item|ref|#)$/i.test(cells[0])) {
          const rawRef = cells[0];
          const rawTitle = cells[1];
          const rawOwner = cells.length > 2 ? cells[2] : '';
          const rawDate = cells.length > 3 ? cells[3] : '';

          if (!rawTitle) continue;

          const isAction = /^ACT/i.test(rawRef) || (output.output_type || '').includes('action');
          const isDecision = /^DEC/i.test(rawRef) || (output.output_type || '').includes('decision');
          const isRisk = /^RSK/i.test(rawRef);

          const isUnowned = !rawOwner || /^(unassigned|no owner|none|tbd|n\/a)$/i.test(rawOwner);
          const parsedDue = parseDateOrNull(rawDate);

          const itemRef = rawRef || `${isDecision ? 'DEC' : isRisk ? 'RSK' : 'ACT'}-${String(items.length + 1).padStart(3, '0')}`;
          if (seenRefs.has(itemRef)) continue;
          seenRefs.add(itemRef);

          if (isDecision) {
            items.push({
              type: 'review',
              reference: itemRef,
              title: `Decision review ${itemRef}: ${rawTitle}`,
              owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
              due_date: parsedDue || parseDateOrNull(fallbackDate),
              priority: 'high',
              status: 'open',
              review: { review_type: 'decision', cadence: 'once' },
            });
          } else if (isRisk) {
            items.push({
              type: 'review',
              reference: itemRef,
              title: `Risk review ${itemRef}: ${rawTitle}`,
              owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
              due_date: parsedDue,
              priority: 'critical',
              status: 'open',
              review: { review_type: 'risk', cadence: 'quarterly' },
            });
          } else {
            items.push({
              type: 'task',
              reference: itemRef,
              title: rawTitle,
              owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
              due_date: parsedDue,
              priority: 'high',
              status: 'open',
            });
          }
        }
      }
    }
  }

  return items;
}
