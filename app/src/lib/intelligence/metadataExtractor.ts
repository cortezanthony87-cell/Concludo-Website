import { COMMON_MEETING_TYPES } from '../projects/types';

export interface ExtractedMeetingMetadata {
  title?: string;
  meetingType?: string;
  clientName?: string;
  projectName?: string;
  meetingDate?: string;
}

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Normalises human date strings into HTML5 standard format YYYY-MM-DD
 */
export function normalizeDateToISO(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();

  // Pattern: YYYY-MM-DD
  const isoMatch = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
  }

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slashMatch) {
    return `${slashMatch[3]}-${String(slashMatch[2]).padStart(2, '0')}-${String(slashMatch[1]).padStart(2, '0')}`;
  }

  // Pattern: Day Month Year (e.g. Tuesday 13 October 2026 or 13 October 2026)
  const dmyMatch = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s*,?\s*(\d{4}))?\b/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monStr = dmyMatch[2];
    const yr = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : new Date().getFullYear();
    if (MONTH_MAP[monStr] && day >= 1 && day <= 31) {
      return `${yr}-${String(MONTH_MAP[monStr]).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern: Month Day Year (e.g. October 13, 2026)
  const mdyMatch = t.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/);
  if (mdyMatch) {
    const monStr = mdyMatch[1];
    const day = parseInt(mdyMatch[2], 10);
    const yr = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : new Date().getFullYear();
    if (MONTH_MAP[monStr] && day >= 1 && day <= 31) {
      return `${yr}-${String(MONTH_MAP[monStr]).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return undefined;
}

/**
 * Automatically inspects transcript dialogue, meeting notes, or document text to extract:
 * - project title
 * - client name
 * - project name
 * - meeting type
 * - meeting date
 */
export function extractMetadataFromContent(rawText: string): ExtractedMeetingMetadata {
  if (!rawText || rawText.trim().length < 10) {
    return {};
  }

  const result: ExtractedMeetingMetadata = {};
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Scan top 40 lines for explicit labels and metadata blocks
  for (const line of lines.slice(0, 40)) {
    // 1. Meeting Title / Topic
    const meetMatch = line.match(
      /^(?:#+\s*)?(?:\*{0,2})(?:Meeting(?:\s+(?:Title|Notes|Topic))?|Session(?:\s+Title)?|Subject)(?:\*{0,2})\s*:\s*(.+)$/i
    );
    if (meetMatch && !result.title) {
      const clean = meetMatch[1].replace(/[*_#]/g, '').trim();
      if (clean && !/^(?:notes|transcript|minutes)$/i.test(clean)) {
        result.title = clean;
        continue;
      }
    }

    // 2. Client / Project Combined format (e.g. Client / Project: Metro / PID Upgrade)
    const clientProjMatch = line.match(
      /^(?:#+\s*)?(?:\*{0,2})(?:Client\s*(?:[/&|]|and)\s*Project)\*{0,2}\s*:\s*([^/|]+)\s*[/|]\s*(.+)$/i
    );
    if (clientProjMatch) {
      if (!result.clientName) result.clientName = clientProjMatch[1].replace(/[*_#]/g, '').trim();
      if (!result.projectName) result.projectName = clientProjMatch[2].replace(/[*_#]/g, '').trim();
      continue;
    }

    // 3. Client Name / Organisation
    const orgMatch = line.match(
      /^(?:#+\s*)?(?:\*{0,2})(?:Organisation|Organization|Client(?:\s+Name)?|Company|Customer)(?:\*{0,2})\s*:\s*(.+)$/i
    );
    if (orgMatch && !result.clientName) {
      const clean = orgMatch[1].replace(/[*_#]/g, '').trim();
      if (clean) {
        result.clientName = clean;
        continue;
      }
    }

    // 4. Project Name
    const projMatch = line.match(
      /^(?:#+\s*)?(?:\*{0,2})(?:Project(?:\s+Name)?)(?:\*{0,2})\s*:\s*(.+)$/i
    );
    if (projMatch && !result.projectName) {
      const clean = projMatch[1].replace(/[*_#]/g, '').trim();
      if (clean) {
        result.projectName = clean;
        continue;
      }
    }

    // 5. Meeting Type
    const typeMatch = line.match(
      /^(?:#+\s*)?(?:\*{0,2})(?:Meeting\s+Type|Type\s+of\s+Meeting|Category)(?:\*{0,2})\s*:\s*(.+)$/i
    );
    if (typeMatch && !result.meetingType) {
      const clean = typeMatch[1].replace(/[*_#]/g, '').trim();
      if (clean) {
        result.meetingType = clean;
        continue;
      }
    }

    // 6. Meeting Date
    const dateMatch = line.match(
      /^(?:#+\s*)?(?:\*{0,2})(?:Date|Meeting\s+Date)(?:\*{0,2})\s*:\s*(.+)$/i
    );
    if (dateMatch && !result.meetingDate) {
      const normalized = normalizeDateToISO(dateMatch[1]);
      if (normalized) {
        result.meetingDate = normalized;
        continue;
      }
    }
  }

  // If no title found via label, check top Markdown Heading 1 or Heading 2
  if (!result.title) {
    for (const line of lines.slice(0, 10)) {
      if (line.startsWith('#') && !/sample|transcript|fictional|template|document\s+import|meeting\s+notes/i.test(line)) {
        const clean = line.replace(/^#+\s*/, '').replace(/[*_]/g, '').trim();
        if (clean.length > 5) {
          result.title = clean;
          break;
        }
      }
    }
  }

  // If title was found but projectName was not, derive projectName from title
  if (result.title && !result.projectName) {
    // If title has comma or colon separation e.g. "Project Kick-off, PID Upgrade, Stage 2"
    const commaParts = result.title.split(',').map((p) => p.trim()).filter(Boolean);
    if (commaParts.length >= 2 && /kick-off|kickoff|meeting|sync|review|session|briefing/i.test(commaParts[0])) {
      result.projectName = commaParts.slice(1).join(', ');
    } else {
      const colonParts = result.title.split(':').map((p) => p.trim()).filter(Boolean);
      if (colonParts.length >= 2 && /kick-off|kickoff|meeting|sync|review|session|briefing/i.test(colonParts[0])) {
        result.projectName = colonParts.slice(1).join(': ');
      } else {
        result.projectName = result.title;
      }
    }
  } else if (!result.title && result.projectName) {
    result.title = result.projectName;
  }

  // If dialogue opening has welcome greeting: "Welcome everyone to the [Title] for [Client]"
  if (!result.title) {
    for (const line of lines.slice(0, 15)) {
      const welcomeMatch = line.match(
        /welcome (?:everyone )?to (?:the )?([A-Za-z0-9\s,&'-]+?)(?:\s+(?:for|at)\s+([A-Za-z0-9\s,&'-]+?))?[.!?]/i
      );
      if (welcomeMatch) {
        const extractedTitle = welcomeMatch[1].trim();
        if (extractedTitle.length > 6) {
          result.title = extractedTitle;
          if (!result.projectName) result.projectName = extractedTitle;
          if (welcomeMatch[2] && !result.clientName) {
            result.clientName = welcomeMatch[2].trim();
          }
          break;
        }
      }
    }
  }

  // Infer meetingType from context if not explicitly labeled
  if (!result.meetingType) {
    const combined = ((result.title || '') + ' ' + (result.projectName || '') + ' ' + rawText.slice(0, 2000)).toLowerCase();
    if (/(?:executive review|board meeting|steering committee|governance review|leadership review)/i.test(combined)) {
      result.meetingType = 'Executive Review';
    } else if (/(?:quarterly business review|qbr|quarterly review)/i.test(combined)) {
      result.meetingType = 'Quarterly Business Review';
    } else if (/(?:client consultation|consultation|consulting|customer discovery|client check-in)/i.test(combined)) {
      result.meetingType = 'Client Consultation';
    } else if (/(?:operational sync|standup|daily|status update|weekly sync|operational)/i.test(combined)) {
      result.meetingType = 'Operational Sync';
    } else if (/(?:workshop|design sprint|brainstorming|working session|interactive session)/i.test(combined)) {
      result.meetingType = 'Workshop Session';
    } else if (/(?:1:1|one-on-one|one on one|1-on-1|performance check-in)/i.test(combined)) {
      result.meetingType = 'One-on-One Check-in';
    } else if (/(?:kick-off|kickoff|planning|strategy|strategic|roadmap|scope|initiatives)/i.test(combined)) {
      result.meetingType = 'Strategy & Planning';
    } else {
      result.meetingType = 'Strategy & Planning';
    }
  }

  // Ensure inferred meetingType matches valid options or falls back gracefully
  if (result.meetingType && !COMMON_MEETING_TYPES.includes(result.meetingType as any)) {
    // Check fuzzy match
    const matched = COMMON_MEETING_TYPES.find((t) =>
      result.meetingType!.toLowerCase().includes(t.toLowerCase()) ||
      t.toLowerCase().includes(result.meetingType!.toLowerCase())
    );
    if (matched) {
      result.meetingType = matched;
    }
  }

  return result;
}
