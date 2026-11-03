import {
  SourceInput,
  MeetingMetaInput,
  MeetingModel,
  Action,
  Evidence,
  Basis,
  Review,
  GateRecord,
  ExcludedItem,
  CoverageRecord,
  todayIso,
} from './meetingEngine';

export type { GateRecord, ExcludedItem, CoverageRecord };

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const GROUP_OWNERS = new Set([
  'team', 'all staff', 'we', 'everyone', 'board', 'committee', 'department', 'practice team', 'all'
]);

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function detectSourceType(inputs: SourceInput[], metaIn?: MeetingMetaInput): 'transcript' | 'minutes' | 'document' {
  if (metaIn?.sourceType) return metaIn.sourceType;
  if (inputs.length > 0 && inputs.every((s) => s.kind === 'document')) return 'document';

  const fullText = inputs.map((s) => s.text).join('\n');

  // Transcript cues: timestamped turns or alternating Name: turns
  const hasTranscriptTurns = /^\s*(?:\[\d{1,2}:\d{2}\]|\d{1,2}:\d{2})\s+[A-Z][a-z]+/m.test(fullText) ||
    /^(?:Speaker \d+|<v [^>]+>|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*\(?\d*:\d*\)?\s*:)/m.test(fullText);

  if (hasTranscriptTurns) {
    return 'transcript';
  }

  const hasMinutesMarkers = /^(?:[-*•]\s*)?(?:RESOLVED|Resolved)\s*:/m.test(fullText) ||
    /\bAttendees:\s*.*\(Chair\)/i.test(fullText);
  if (hasMinutesMarkers) {
    return 'minutes';
  }

  // Checkbox glyphs or explicit document indicators
  const hasCheckboxes = /[☐☑]|\[\s*\]|\[x\]/.test(fullText);
  const hasDayAnchor = /Day 1 is \b/i.test(fullText);
  const hasActionTable = /\|\s*(?:ID\s*\|)?\s*(?:Action|Task)\s*\|\s*(?:Owner|Who|Due|When|Done)/i.test(fullText);
  const hasPhaseHeadings = /##\s*(?:Phase|Stage)\s+\d+/i.test(fullText);
  const hasStageHeaders = /\|\s*(?:First\s+\d+\s+days|Days\s+\d+\s+to\s+\d+|Months?\s+\d+\s+to\s+\d+|Years?\s+\d+)/i.test(fullText);

  if (hasCheckboxes || hasDayAnchor || hasActionTable || hasPhaseHeadings || hasStageHeaders) {
    return 'document';
  }

  return 'transcript';
}

function parseStageEnd(sStr: string): { date: string; precision: 'day' | 'month' } | null {
  // Day precision: to 24 November 2026, 9 to 24 November 2026, 4 to 15 May 2026
  const mDay = sStr.match(/(?:to|-|–)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (mDay) {
    const d = parseInt(mDay[1], 10);
    const mS = mDay[2].slice(0, 3).toLowerCase();
    const y = mDay[3];
    if (MONTH_MAP[mS]) {
      return { date: `${y}-${MONTH_MAP[mS]}-${String(d).padStart(2, '0')}`, precision: 'day' };
    }
  }
  // Month precision: to April 2027, to October 2028, to Dec 2029
  const mMon = sStr.match(/(?:to|-|–)\s*([A-Za-z]+)\s+(\d{4})/i);
  if (mMon) {
    const mS = mMon[1].slice(0, 3).toLowerCase();
    const y = mMon[2];
    if (MONTH_MAP[mS]) {
      return { date: `${y}-${MONTH_MAP[mS]}`, precision: 'month' };
    }
  }
  return null;
}

function resolveTableDue(cellText: string, baseYear = 2026): { date: string | null; raw: string | null } {
  const raw = cellText.trim();
  if (!raw) return { date: null, raw: null };

  const m = raw.match(/(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+)?(?:by\s+the\s+end\s+of\s+)?(\d{1,2})?\s*([A-Za-z]+)(?:\s+(\d{4}))?/i);
  if (m) {
    const d = m[1];
    const monStr = m[2].slice(0, 3).toLowerCase();
    const y = m[3] || String(baseYear);
    if (MONTH_MAP[monStr]) {
      const mm = MONTH_MAP[monStr];
      if (d) {
        return { date: `${y}-${mm}-${String(parseInt(d, 10)).padStart(2, '0')}`, raw };
      } else if (/end of/i.test(raw)) {
        const lastDays: Record<string, number> = {
          '01': 31, '02': 28, '03': 31, '04': 30, '05': 31, '06': 30,
          '07': 31, '08': 31, '09': 30, '10': 31, '11': 30, '12': 31,
        };
        const ld = lastDays[mm] || 30;
        return { date: `${y}-${mm}-${ld}`, raw };
      } else {
        return { date: `${y}-${mm}`, raw };
      }
    }
  }
  return { date: null, raw };
}

export function analyseDocumentMode(inputs: SourceInput[], metaIn: MeetingMetaInput = {}): MeetingModel {
  const fullText = inputs.map((s) => s.text).join('\n');
  const sourceName = inputs[0]?.name || 'Document';

  // 1. Day 1 Anchor
  let anchorDate: string | null = null;
  const anchorM = fullText.match(/Day 1 is (?:[A-Za-z]+,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (anchorM) {
    const parts = anchorM[1].split(/\s+/);
    const d = parseInt(parts[0], 10);
    const mS = parts[1].slice(0, 3).toLowerCase();
    const y = parts[2];
    if (MONTH_MAP[mS]) {
      anchorDate = `${y}-${MONTH_MAP[mS]}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Document Date
  let docDate: string | null = null;
  const vM = fullText.match(/(?:version\s+\d+(?:\.\d+)?\.?\s+.*?|source document\s+·\s+)(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (vM) {
    const parts = vM[1].split(/\s+/);
    const d = parseInt(parts[0], 10);
    const mS = parts[1].slice(0, 3).toLowerCase();
    const y = parts[2];
    if (MONTH_MAP[mS]) {
      docDate = `${y}-${MONTH_MAP[mS]}-${String(d).padStart(2, '0')}`;
    }
  }
  if (!docDate) {
    const dM = fullText.match(/\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/);
    if (dM) {
      const parts = dM[1].split(/\s+/);
      const d = parseInt(parts[0], 10);
      const mS = parts[1].slice(0, 3).toLowerCase();
      const y = parts[2];
      if (MONTH_MAP[mS]) {
        docDate = `${y}-${MONTH_MAP[mS]}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  const baseYear = docDate ? parseInt(docDate.split('-')[0], 10) : 2026;
  const meetingDate = metaIn.meetingDate || docDate || todayIso();

  // 3. Document Title
  let docTitle = metaIn.title;
  if (!docTitle) {
    const tM = fullText.match(/^#\s+(.+)$/m);
    if (tM) docTitle = tM[1].trim();
  }
  if (!docTitle) {
    docTitle = sourceName.replace(/\.[^.]+$/, '');
  }

  const actions: Action[] = [];
  const excludedItems: ExcludedItem[] = [];
  const gates: GateRecord[] = [];

  let currentStageName: string | undefined;
  let currentStageEnd: string | null = null;
  let currentStagePrec: 'day' | 'month' | null = null;
  let currentStageNo = 0;

  const lines = fullText.split(/\r?\n/);
  let inMarkdownTable = false;
  let colMap: Record<string, number | undefined> = {};

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // A. Detect Stage Header (General pattern)
    const stM = cleanLine.match(/^(?:\|\s*)?(?:##\s*)?((?:(?:Phase|Stage)\s+\d+|(?:First\s+\d+\s+days|Days\s+\d+\s+to\s+\d+|Months?\s+\d+\s+to\s+\d+|Years?\s+\d+(?:\s+(?:and|to)\s+\d+)?))[^|\n]*)/i);
    if (stM && !/\|\s*\d+\s*\|\s*\d+\s*\|/.test(cleanLine)) {
      const candidateSt = stM[1].trim().replace(/^\|\s*|\s*\|$/g, '');
      const endD = parseStageEnd(candidateSt);
      if (endD) {
        currentStageName = candidateSt;
        currentStageEnd = endD.date;
        currentStagePrec = endD.precision;
        currentStageNo += 1;
      }
    }

    // B. Detect Decision Gate (D5)
    const gateM = cleanLine.match(/\|\s*Decision gate\s*\|\s*([^|]+)\|/i);
    if (gateM) {
      const gateDesc = gateM[1].trim();
      let stopRule: string | undefined;
      let accelRule: string | undefined;
      for (let lookahead = lineIdx + 1; lookahead < Math.min(lines.length, lineIdx + 12); lookahead++) {
        const lTxt = lines[lookahead];
        if (/If missed/i.test(lTxt)) {
          const stopM = lTxt.match(/\|\s*If missed(?:,\s*stop)?\s*\|\s*([^|]+)\|/i);
          if (stopM) stopRule = stopM[1].trim();
        }
        if (/If (?:exceeded|beaten)/i.test(lTxt)) {
          const accM = lTxt.match(/\|\s*If (?:exceeded(?:,\s*accelerate)?|beaten)\s*\|\s*([^|]+)\|/i);
          if (accM) accelRule = accM[1].trim();
        }
      }
      gates.push({
        stage: currentStageName,
        date: currentStageEnd || undefined,
        passTest: gateDesc,
        ifMissedStop: stopRule,
        ifExceededAccelerate: accelRule,
      });
    }

    // C. Purpose Clause / Non-Action Exclusions (D4: General linguistic patterns)
    const isPurposeClause = /\b(?:each\s+(?:[a-z]+(?:\s+[a-z]+)?)\s+has\s+a\s+(?:job|purpose|goal|role|mitigation)|(?:the|our|its|this|each)?\s*(?:aim|goal|purpose|objective|intent|principle|mission)\s+(?:of\s+[a-z\s]+)?(?:is|was)\s+(?:to|for)|(?:is|are)\s+intended\s+to|in\s+order\s+to|so\s+that)\b/i.test(cleanLine);
    const isPolicyDescription = /\b(?:this\s+(?:statement|document|policy|section)\s+describes|is\s+a\s+description,\s+not\s+a\s+work\s+plan|the\s+policy\s+will\s+be\s+reviewed|staff\s+are\s+expected\s+to|values\s+plain\s+language)\b/i.test(cleanLine);
    const isOpenGap = /\b(?:nobody\s+has\s+yet\s+been\s+asked\s+to|has\s+not\s+yet\s+been\s+assigned|unresolved\s+gap)\b/i.test(cleanLine);

    if (isPurposeClause || isPolicyDescription || isOpenGap) {
      excludedItems.push({
        text: cleanLine.replace(/^\|\s*|\s*\|$/g, ''),
        reason: isPurposeClause ? 'purpose clause' : isOpenGap ? 'unassigned gap' : 'policy description',
        sourceLine: lineNum,
      });
      // If this line is purely descriptive, do not treat as an action candidate
      if (!cleanLine.match(/[☐☑]|\[\s*\]|\[x\]/)) {
        return;
      }
    }

    // D. Action Candidates (D2)

    // D2.1 Checkbox Action Line
    const cbM = cleanLine.match(/(?:^|\|\s*|[-*•]\s*)(?:[☐☑]|\[\s*\]|\[x\])\s*(.+?)(?=\s*\|?\s*$)/i);
    if (cbM) {
      const rawContent = cbM[1].trim();
      const dayM = rawContent.match(/^(Day\s+\d+|Days\s+\d+\s+to\s+\d+)[:\s-]+(.*)$/i);
      const inlineDayM = rawContent.match(/\bby\s+(Day\s+\d+)\b/i);

      let dueRaw: string | undefined;
      let dueDate: string | undefined;
      let dueBasis: 'stated' | 'stage_end' | 'none' | null = null;
      let taskText = rawContent;

      if (dayM) {
        dueRaw = dayM[1];
        taskText = dayM[2].trim();
        if (anchorDate) {
          const nums = dueRaw.match(/\d+/g)?.map(Number) || [1];
          const targetDay = nums[nums.length - 1];
          dueDate = addDays(anchorDate, targetDay - 1);
          dueBasis = 'stated';
        }
      } else if (inlineDayM && anchorDate) {
        dueRaw = inlineDayM[1];
        const nums = dueRaw.match(/\d+/g)?.map(Number) || [1];
        const targetDay = nums[nums.length - 1];
        dueDate = addDays(anchorDate, targetDay - 1);
        dueBasis = 'stated';
      } else if (currentStageEnd) {
        dueRaw = undefined;
        dueDate = currentStageEnd;
        dueBasis = 'stage_end';
      }

      actions.push({
        id: `X${String(actions.length + 1).padStart(2, '0')}`,
        task: taskText,
        owner: undefined,
        ownerBasis: 'none',
        ownerRaw: undefined,
        suggestedOwner: undefined,
        due: dueDate,
        dueRaw: dueRaw,
        dueText: dueRaw,
        dueBasis: dueBasis,
        dueApprox: false,
        horizon: 'undated',
        doneDefinition: undefined,
        doneWhen: undefined,
        stage: currentStageName,
        stageNo: currentStageNo,
        evidence: [
          {
            sourceId: 'S1',
            sourceName,
            line: lineNum,
            quote: cleanLine.replace(/^\|\s*|\s*\|$/g, ''),
          },
        ],
        confidence: 'explicit',
        gaps: ['owner', 'definition_of_done'],
        review: 'proposed',
        sourceLine: lineNum,
        sourceQuote: cleanLine,
      });
      return;
    }

    // D2.3 Markdown Table Action Row
    if (cleanLine.includes('|')) {
      const cells = cleanLine.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 3) {
        const headerNames = cells.map((c) => c.toLowerCase());
        const hasActionHeader = headerNames.some((h) => h.includes('action') || h.includes('task'));
        const hasMetaHeader = headerNames.some((h) => h.includes('due') || h.includes('owner') || h.includes('when'));
        if (hasActionHeader && hasMetaHeader) {
          inMarkdownTable = true;
          colMap = {
            id: headerNames.findIndex((h) => h.includes('id')),
            action: headerNames.findIndex((h) => h.includes('action') || h.includes('task')),
            owner: headerNames.findIndex((h) => h.includes('owner') || h.includes('who')),
            due: headerNames.findIndex((h) => h.includes('due') || (h.includes('when') && !h.includes('done'))),
            done: headerNames.findIndex((h) => h.includes('done')),
          };
          return;
        } else if (inMarkdownTable && !cells.every((c) => c.replace(/-/g, '').trim() === '')) {
          const actIdx = colMap.action;
          if (actIdx !== undefined && actIdx !== -1 && actIdx < cells.length) {
            const task = cells[actIdx].trim();
            const rawOwner = (colMap.owner !== undefined && colMap.owner !== -1 && colMap.owner < cells.length) ? cells[colMap.owner].trim() : '';
            const rawDue = (colMap.due !== undefined && colMap.due !== -1 && colMap.due < cells.length) ? cells[colMap.due].trim() : '';
            const rawDone = (colMap.done !== undefined && colMap.done !== -1 && colMap.done < cells.length) ? cells[colMap.done].trim() : '';

            let owner: string | undefined;
            let ownerRaw: string | undefined;
            if (rawOwner) {
              if (GROUP_OWNERS.has(rawOwner.toLowerCase())) {
                owner = undefined;
                ownerRaw = rawOwner;
              } else {
                owner = rawOwner;
              }
            }

            const { date: tableDueDate, raw: tableDueRaw } = resolveTableDue(rawDue, baseYear);

            actions.push({
              id: `X${String(actions.length + 1).padStart(2, '0')}`,
              task,
              owner,
              ownerBasis: owner ? 'stated' : 'none',
              ownerRaw,
              suggestedOwner: undefined,
              due: tableDueDate || undefined,
              dueRaw: tableDueRaw || undefined,
              dueText: tableDueRaw || undefined,
              dueBasis: tableDueDate ? 'stated' : null,
              dueApprox: false,
              horizon: 'undated',
              doneDefinition: rawDone || undefined,
              doneWhen: rawDone || undefined,
              stage: currentStageName,
              stageNo: currentStageNo,
              evidence: [
                {
                  sourceId: 'S1',
                  sourceName,
                  line: lineNum,
                  quote: cleanLine.replace(/^\|\s*|\s*\|$/g, ''),
                },
              ],
              confidence: 'explicit',
              gaps: [
                ...(owner ? [] : ['owner']),
                ...(tableDueDate ? [] : ['due']),
                ...(rawDone ? [] : ['definition_of_done']),
              ],
              review: 'proposed',
              sourceLine: lineNum,
              sourceQuote: cleanLine,
            });
            return;
          }
        }
      }
    } else {
      inMarkdownTable = false;
    }

    // D2.4 Named Person Commitment in Prose
    if (!cleanLine.includes('|')) {
      const commitM = cleanLine.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will)\s+(send|prepare|audit|deliver|update|draft|publish|review|complete|book|contact|email|submit|produce|present|run|conduct|write|circulate)\b\s+([^.]+)/);
      if (commitM && !/^(?:policy|document|plan|team|studio|clinic)$/i.test(commitM[1])) {
        const person = commitM[1];
        const verb = commitM[2];
        const rest = commitM[3];
        let fullTask = `${verb} ${rest}`;

        let dueDate: string | undefined;
        let dueRaw: string | undefined;
        let dueBasis: 'stated' | 'stage_end' | 'none' | null = null;

        const dueM = fullTask.match(/\bby\s+((?:[A-Za-z]+,?\s+)?(?:\d{1,2}\s+[A-Za-z]+|[A-Za-z]+\s+\d{1,2}))/i);
        if (dueM) {
          dueRaw = dueM[1].trim();
          const rDue = resolveTableDue(dueRaw, baseYear);
          dueDate = rDue.date || undefined;
          dueBasis = dueDate ? 'stated' : null;
          fullTask = fullTask.slice(0, dueM.index).trim();
        }

        actions.push({
          id: `X${String(actions.length + 1).padStart(2, '0')}`,
          task: fullTask,
          owner: person,
          ownerBasis: 'stated',
          ownerRaw: person,
          suggestedOwner: undefined,
          due: dueDate,
          dueRaw: dueRaw,
          dueText: dueRaw,
          dueBasis,
          dueApprox: false,
          horizon: 'undated',
          doneDefinition: undefined,
          doneWhen: undefined,
          stage: currentStageName,
          stageNo: currentStageNo,
          evidence: [
            {
              sourceId: 'S1',
              sourceName,
              line: lineNum,
              quote: cleanLine,
            },
          ],
          confidence: 'explicit',
          gaps: [
            ...(dueDate ? [] : ['due']),
            'definition_of_done',
          ],
          review: 'proposed',
          sourceLine: lineNum,
          sourceQuote: cleanLine,
        });
      }
    }
  });

  // Next meeting in prose check (e.g. F3: "The committee agreed to meet again on Tuesday 2 June to review progress.")
  let nextMeeting: MeetingModel['nextMeeting'] = undefined;
  const nextMeetM = fullText.match(/\b(?:agreed to meet again|meet again|next meeting)\s+(?:on\s+)?((?:Tuesday|Wednesday|Thursday|Friday|Monday|Saturday|Sunday)?,?\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)/i);
  if (nextMeetM) {
    const rawMeet = nextMeetM[1].trim();
    const rDue = resolveTableDue(rawMeet, baseYear);
    if (rDue.date) {
      nextMeeting = {
        date: rDue.date,
        rawText: rawMeet,
      };
    }
  }

  // Horizon Bucketing
  actions.forEach((a) => {
    if (a.stageNo) {
      if (a.stageNo <= 4) a.horizon = 'now';
      else if (a.stageNo <= 6) a.horizon = 'next';
      else a.horizon = 'later';
    }
  });

  const model: MeetingModel = {
    version: '2.0',
    meta: {
      title: docTitle,
      meetingType: 'Plan document',
      meetingDate,
      organisation: metaIn.organisation,
      project: metaIn.project,
      chair: undefined,
      duration: undefined,
    },
    sources: inputs.map((src, i) => ({
      id: `S${i + 1}`,
      name: src.name,
      kind: src.kind,
      words: src.text.split(/\s+/).filter(Boolean).length,
      lines: src.text.split(/\r?\n/).filter((l) => l.trim()).length,
      speakers: 0,
    })),
    participants: [],
    decisions: [],
    actions,
    risks: [],
    openItems: [],
    figures: [],
    recommendations: [],
    health: { dimensions: [], notScored: ['clarity', 'ownership', 'dating', 'mitigation', 'balance'] },
    gate: { status: 'Ready to circulate', checks: [] },
    bottomLine: `${actions.length} actions came out of this document. ${actions.filter((a) => a.dueBasis === 'stated').length} carry their own date and ${actions.filter((a) => a.dueBasis === 'stage_end').length} inherit the end date of their stage. ${actions.filter((a) => a.owner).length ? `${actions.filter((a) => a.owner).length} have an owner.` : 'None has a named owner yet.'}${gates.length ? ` The next gate is ${gates[0].stage || 'Stage 1'}.` : ''}`,
    stats: {
      decisions: 0,
      actions: actions.length,
      owned: actions.filter((a) => a.owner).length,
      dated: actions.filter((a) => a.due).length,
      openItems: 0,
      risks: 0,
      highRisks: 0,
    },
    warnings: [],
    signals: { balance: null, speakers: 0, dateConfirmed: !!docDate },
    sourceType: 'document',
    documentMeta: {
      title: docTitle,
      versionDate: docDate || undefined,
      anchor: anchorDate ? { label: 'Day 1', date: anchorDate } : undefined,
    },
    gates,
    excludedItems,
    coverage: {
      candidates: actions.length + excludedItems.length,
      extracted: actions.length,
      excluded: excludedItems.length,
      needsAttention: 0,
      unresolved: [],
    },
    nextMeeting,
  };

  return model;
}

export function toDocumentModeRecord(m: MeetingModel) {
  return {
    source_type: m.sourceType || 'document',
    document: {
      title: m.documentMeta?.title || m.meta.title || '',
      version_date: m.documentMeta?.versionDate || m.meta.meetingDate,
      anchor: m.documentMeta?.anchor || null,
    },
    actions: m.actions.map((a) => ({
      id: a.id,
      text: a.task,
      owner: a.owner || null,
      owner_raw: a.ownerRaw || null,
      suggested_owner: a.suggestedOwner || null,
      due_raw: a.dueRaw || a.dueText || null,
      due_date: a.due || null,
      due_basis: a.dueBasis || (a.due ? 'stated' : null),
      done_when: a.doneWhen || a.doneDefinition || null,
      stage: a.stage || null,
      stage_no: a.stageNo || null,
      evidence: m.sourceType === 'document' ? 'Planned in source' : 'Confirmed',
      source_line: a.sourceLine || (a.evidence && a.evidence[0] ? a.evidence[0].line : 0),
      source_quote: a.sourceQuote || (a.evidence && a.evidence[0] ? a.evidence[0].quote : ''),
    })),
    gates: (m.gates || []).map((g) => ({
      stage: g.stage,
      date: g.date,
      pass_test: g.passTest,
      if_missed_stop: g.ifMissedStop,
      if_exceeded_accelerate: g.ifExceededAccelerate,
    })),
    excluded: (m.excludedItems || []).map((e) => ({
      text: e.text,
      reason: e.reason,
      source_line: e.sourceLine,
    })),
    coverage: m.coverage || {
      candidates: m.actions.length,
      extracted: m.actions.length,
      excluded: m.excludedItems ? m.excludedItems.length : 0,
      needs_attention: 0,
      unresolved: [],
    },
    flags: m.flags || [],
  };
}
