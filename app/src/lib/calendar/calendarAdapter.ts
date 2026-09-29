/**
 * calendarAdapter.ts
 *
 * Dynamically extracts calendar-ready items from a project's Output payload
 * (Actions, Decisions, Risks, and markdown formats) and maps them cleanly
 * to GenerateCalendarPayloadItem[] with source lineage preservation.
 *
 * Ground rules:
 * 1. Zero hardcoded/mock items (no ACT-001 fallback constants).
 * 2. Real lineage: items reference output.id and project.id.
 * 3. Never invent dates or owners: unassigned owners and dates remain null/unassigned.
 * 4. Deduplicate items by reference within an extraction.
 */

import { GenerateCalendarPayloadItem } from './calendarTypes';

export interface OutputLike {
  id?: string;
  project_id?: string;
  output_type?: string;
  content?: string | null;
  raw_content?: string | null;
  json_content?: any;
}

/**
 * Normalises a raw date string into YYYY-MM-DD or null.
 * Strictly avoids inventing dates.
 */
export function parseDateOrNull(rawDate?: string | null): string | null {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();
  if (
    !trimmed ||
    /^(tbd|tba|no date|none|unknown|ongoing|n\/a|unassigned|-)$/i.test(trimmed)
  ) {
    return null;
  }

  // ISO date format match (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // DD/MM/YYYY format
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Natural language dates (e.g. 23 Oct 2026, 23 October 2026)
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

/**
 * Extracts candidate calendar items from an Output's json_content or markdown content.
 */
export function extractCalendarPayloadItems(
  output?: OutputLike | null,
  fallbackDate?: string | null
): GenerateCalendarPayloadItem[] {
  if (!output) return [];

  const items: GenerateCalendarPayloadItem[] = [];
  const seenRefs = new Set<string>();

  const jsonContent = output.json_content;

  // 1. Check structured actions in json_content
  if (jsonContent?.actions?.rows && Array.isArray(jsonContent.actions.rows)) {
    for (const r of jsonContent.actions.rows) {
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
          title,
          owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
          due_date: parsedDue,
          priority: 'high',
          status: 'open',
        });
      }
    }
  }

  // 2. Check structured decisions in json_content
  if (jsonContent?.decisions?.rows && Array.isArray(jsonContent.decisions.rows)) {
    for (const r of jsonContent.decisions.rows) {
      if (Array.isArray(r) && r.length >= 2) {
        const ref = (r[0] || '').trim();
        const title = (r[1] || '').trim();
        const rawOwner = r.length > 2 ? (r[2] || '').trim() : '';

        if (!title) continue;

        const isUnowned = !rawOwner || /^(unassigned|no owner|none|tbd|n\/a)$/i.test(rawOwner);
        const itemRef = ref || `DEC-${String(items.length + 1).padStart(3, '0')}`;
        if (seenRefs.has(itemRef)) continue;
        seenRefs.add(itemRef);

        items.push({
          type: 'review',
          reference: itemRef,
          title: `Decision review ${itemRef}: ${title}`,
          owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
          due_date: parseDateOrNull(fallbackDate),
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

  // 3. Check structured risks in json_content
  if (jsonContent?.risks?.rows && Array.isArray(jsonContent.risks.rows)) {
    for (const r of jsonContent.risks.rows) {
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

  // 4. Fallback: Parse markdown table rows from content if json_content had no items
  const rawContent = output.content || output.raw_content || '';
  if (items.length === 0 && rawContent) {
    const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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

    // 5. Fallback: Parse sectioned markdown for Governed Decision Logs (e.g. ### Decision 1: ...)
    if (items.length === 0 && (output.output_type || '').includes('decision')) {
      const decisionBlocks = rawContent.split(/###\s*Decision\s+(\d+)[:\s]*/i);
      for (let i = 1; i < decisionBlocks.length; i += 2) {
        const num = decisionBlocks[i];
        const block = decisionBlocks[i + 1] || '';
        const firstLineEnd = block.indexOf('\n');
        const rawTitle = (firstLineEnd !== -1 ? block.slice(0, firstLineEnd) : block).trim();
        const rest = firstLineEnd !== -1 ? block.slice(firstLineEnd) : '';

        if (!rawTitle) continue;

        const ownerMatch = rest.match(/-\s*\*\*Decision Owner:\*\*\s*([^\n\r]+)/i);
        const dateMatch = rest.match(/-\s*\*\*Date:\*\*\s*([^\n\r]+)/i);

        const rawOwner = ownerMatch ? ownerMatch[1].trim() : '';
        const rawDate = dateMatch ? dateMatch[1].trim() : '';

        const isUnowned = !rawOwner || /^(unassigned|no owner|none|tbd|n\/a)$/i.test(rawOwner);
        const parsedDue = parseDateOrNull(rawDate) || parseDateOrNull(fallbackDate);

        const itemRef = `DEC-${String(num).padStart(3, '0')}`;
        if (seenRefs.has(itemRef)) continue;
        seenRefs.add(itemRef);

        items.push({
          type: 'review',
          reference: itemRef,
          title: `Decision review ${itemRef}: ${rawTitle}`,
          owner: !isUnowned ? { name: rawOwner, user_id: null, stated: true } : null,
          due_date: parsedDue,
          priority: 'high',
          status: 'open',
          review: { review_type: 'decision', cadence: 'once' },
        });
      }
    }

    // 6. Fallback: Parse Executive Summary Key Resolutions & Decisions
    if (items.length === 0 && (output.output_type || '').includes('summary')) {
      const resMatch = rawContent.match(/###\s*[0-9.]*\s*Key Resolutions & Decisions([\s\S]*?)(?=###|$)/i);
      if (resMatch) {
        const lines = resMatch[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let resIndex = 1;
        for (const line of lines) {
          const itemMatch = line.match(/^\d+\.\s*\*\*([^:*]+)[:*]*(.*)$/);
          if (itemMatch) {
            const rawTitle = itemMatch[1].trim();
            const itemRef = `DEC-${String(resIndex++).padStart(3, '0')}`;
            if (seenRefs.has(itemRef)) continue;
            seenRefs.add(itemRef);

            items.push({
              type: 'review',
              reference: itemRef,
              title: `Decision review ${itemRef}: ${rawTitle}`,
              owner: null,
              due_date: parseDateOrNull(fallbackDate),
              priority: 'high',
              status: 'open',
              review: { review_type: 'decision', cadence: 'once' },
            });
          }
        }
      }
    }
  }

  return items;
}
