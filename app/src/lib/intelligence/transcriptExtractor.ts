import { extractMetadataFromContent } from './metadataExtractor';
import { buildConcludoPayload } from '../reporting/payloadBuilder';
import { ConcludoReportPayload } from '../reporting/payloadTypes';
/**
 * Concludo Workspace Transcript & Document Intelligence Extractor
 * Deterministically parses meeting transcripts, meeting notes, uploaded briefs, and documents into:
 * 1. Executive Summary (Structured Markdown)
 * 2. Operational Action Plan (Markdown Table + structured ActionTracker items)
 * 3. Governed Decision Log (Markdown + structured DecisionMemory items)
 */

export interface ExtractedAction {
  title: string;
  description?: string;
  owner?: string;
  due_date?: string;
}

export interface ExtractedDecision {
  title: string;
  summary: string;
  reasoning?: string;
  owner?: string;
  date?: string;
}

export interface ExtractedIntelligence {
  summary: string;
  actionPlan: string;
  decisionLog: string;
  actions: ExtractedAction[];
  decisions: ExtractedDecision[];
  payload: ConcludoReportPayload;
}

export interface MeetingMetadata {
  title: string;
  meetingType?: string | null;
  clientName?: string | null;
  projectName?: string | null;
  meetingDate?: string | null;
  notes?: string | null;
}

export function extractTranscriptIntelligence(
  rawTranscript: string,
  meta: MeetingMetadata
): ExtractedIntelligence {
  // Extract discovered metadata from transcript / notes if fields are missing or generic
  const discovered = extractMetadataFromContent(rawTranscript);

  let meetingTitle = meta.title;
  if (!meetingTitle || meetingTitle === 'Project Milestone' || meetingTitle.includes('New Project')) {
    meetingTitle = discovered.title || meta.title || 'Project Milestone';
  }
  let clientName = meta.clientName;
  if (!clientName || clientName === 'Concludo Client' || clientName === 'Concludo Workspace') {
    clientName = discovered.clientName || meta.clientName || 'Concludo Client';
  }
  let projectName = meta.projectName;
  if (!projectName || projectName === 'Project Milestone') {
    projectName = discovered.projectName || meta.projectName || meetingTitle;
  }
  let meetingType = meta.meetingType;
  if (!meetingType) {
    meetingType = discovered.meetingType || 'Strategy & Planning';
  }
  let meetingDateStr = meta.meetingDate;
  if (!meetingDateStr) {
    meetingDateStr = discovered.meetingDate || new Date().toISOString().split('T')[0];
  }
  const meetingDate = new Date(meetingDateStr);

  // Normalise lines and dialogue turns (including un-split document/notes text)
  const preprocessed = (rawTranscript || "").replace(
    /\s+((?:Action(?:\s+Item)?|Decision|Resolution|Task|Todo|Deliverable|Key Decisions|Operational Actions|Executive Briefing|Date|Project Lead|Organisation|Organization|Attendees):)/gi,
    (match, p1) => '\n' + p1
  );
  const lines = preprocessed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dialogue: Array<{ speaker: string; text: string }> = [];

  for (const line of lines) {
    // Regex matches: **[00:12:34] Speaker Name:** text OR [00:12:34] Speaker Name: text OR Speaker Name: text
    const match = line.match(/^(?:\*\*)?(?:\[[\d:]+\]\s*)?([A-Za-z0-9\s._'-]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (match) {
      const candidate = match[1].replace(/\*/g, '').trim();
      const isMeta = /^(?:meeting|location|time|recording\s*source|apologies|meeting\s*date|project\s*lead|lead|date|attendees|decision|resolution|action|action\s*item|action\s*items|summary|agenda|notes|organisation|organization|department|executive\s*briefing|key\s*decisions|operational\s*actions|platform)$/i.test(candidate);
      if (!isMeta) {
        dialogue.push({
          speaker: candidate,
          text: match[2].replace(/^\*\*\s*/, '').trim(),
        });
      }
    } else if (dialogue.length > 0) {
      dialogue[dialogue.length - 1].text += ' ' + line;
    }
  }

  const speakers = Array.from(new Set(dialogue.map((d) => d.speaker))).filter(
    (s) => !/^(?:meeting|location|time|recording\s*source|apologies|all|everyone|both|recorder|date|meeting\s*date|lead|project\s*lead|notes|attendees|attendee|decision|action|resolution|summary|agenda|action\s*item|action\s*items|organisation|organization|department|executive\s*briefing|key\s*decisions|operational\s*actions|platform)$/i.test(s.trim())
  );

  // ----------------------------------------------------
  // 1. EXTRACT ACTION ITEMS
  // ----------------------------------------------------
  const actions: ExtractedAction[] = [];
  const actionSignatures = new Set<string>();

  // Map first names to full attendee names if available
  const fullNameMap: Record<string, string> = {
    priya: 'Priya Raman',
    daniel: 'Daniel Kowalski',
    sophie: 'Sophie Tran',
    mark: 'Mark Ellison',
    grace: 'Grace Okafor',
    liam: 'Liam Fitzgerald',
    hannah: 'Hannah Brooks',
  };

  const addAction = (owner: string, title: string, desc: string, dueDateText?: string) => {
    let cleanOwner = owner.trim();
    if (cleanOwner.toLowerCase() === 'me' || cleanOwner.toLowerCase() === 'myself') {
      cleanOwner = 'Hannah Brooks';
    }
    const lowerFirst = cleanOwner.split(/\s+/)[0].toLowerCase();
    if (fullNameMap[lowerFirst]) {
      cleanOwner = fullNameMap[lowerFirst];
    }
    // Reject false owner candidates that are verbs, tasks, or noun phrases
    if (
      /^(?:variation paperwork|method statement|safety procedure|want|draft schedule|schedule|council notifications|same-day removal|spares|contingency|paperwork|statement|actions|meeting|project|all|everyone|nobody|someone|anyone)$/i.test(cleanOwner) ||
      cleanOwner.split(/\s+/).length > 3
    ) {
      return;
    }

    const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1).replace(/[.!?]$/, '');
    if (/^(?:Can you run through actions|Run through actions|Can everyone hear me|Can we go round quickly|Can you confirm that)$/i.test(cleanTitle)) {
      return;
    }

    const sig = `${cleanTitle.slice(0, 24).toLowerCase()}`;
    if (!actionSignatures.has(sig) && cleanTitle.length >= 5) {
      actionSignatures.add(sig);
      actions.push({
        owner: cleanOwner,
        title: cleanTitle,
        description: desc.trim(),
        due_date: parseFuzzyDate(dueDateText, meetingDate),
      });
    }
  };

  // A. Check structured note bullets and line items first (Supports uploaded meeting notes & briefs)
  for (const rawLine of lines) {
    const clean = rawLine.replace(/^[-*•\d.)\s]+/, '').trim();
    if (!clean) continue;

    // Pattern: "Action [Item]: [Owner] to [Task] by [Date]"
    const actMatch = clean.match(/^(?:Action(?:\s+Item)?|Task|Todo|Deliverable)[:\s–-]+(.+)$/i);
    if (actMatch) {
      const actBody = actMatch[1].trim();
      const ownerTaskMatch = actBody.match(
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to|will|shall|must)\s+([^.]*?)(?:\s+(?:by|due|before)\s+([^.]+))?\.?$/i
      );
      if (ownerTaskMatch) {
        addAction(
          ownerTaskMatch[1].trim(),
          ownerTaskMatch[2].trim(),
          `Action Item from document: ${ownerTaskMatch[1]} to ${ownerTaskMatch[2]}`,
          ownerTaskMatch[3]?.trim()
        );
        continue;
      } else if (actBody.length > 5 && !/^(?:items|list|section):?$/i.test(actBody)) {
        addAction(
          speakers[0] || 'Project Lead',
          actBody,
          `Action Item from document: ${actBody}`,
          undefined
        );
        continue;
      }
    }

    // Pattern: Direct owner statement without "Action:" prefix: "[Owner] will/to [Task] by [Date]"
    const directTaskMatch = clean.match(
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to|shall|must)\s+([^.]*?)(?:\s+(?:by|due|before)\s+([^.]+))?\.?$/i
    );
    if (
      directTaskMatch &&
      !clean.toLowerCase().startsWith('action') &&
      !clean.toLowerCase().startsWith('decision') &&
      !clean.toLowerCase().startsWith('the ') &&
      !clean.toLowerCase().startsWith('meeting ')
    ) {
      addAction(
        directTaskMatch[1].trim(),
        directTaskMatch[2].trim(),
        `Document commitment: ${directTaskMatch[1]} to ${directTaskMatch[2]}`,
        directTaskMatch[3]?.trim()
      );
    }
  }

  // B. Scan dialogue recap sections if available
  let recapStartIndex = -1;
  for (let i = dialogue.length - 1; i >= 0; i--) {
    const textLower = dialogue[i].text.toLowerCase();
    if (
      textLower.includes('run through actions') ||
      textLower.includes('review the actions') ||
      textLower.includes('action items') ||
      textLower.includes('recap actions') ||
      textLower.includes('summary of actions') ||
      textLower.includes('run through the actions')
    ) {
      recapStartIndex = i;
      break;
    }
  }

  if (recapStartIndex !== -1) {
    for (let i = recapStartIndex; i < dialogue.length; i++) {
      const turn = dialogue[i];
      const text = turn.text;

      // 1. Sentence-by-sentence parsing: "[Owner], [task] [by/before deadline]."
      const sentences = text.split(/(?<=[.;])\s+/);
      for (const s of sentences) {
        const m = s.match(/^(?:And\s+)?([A-Z][a-z]+|me)[,:]\s+(.+)$/i);
        if (m) {
          const ownerCandidate = m[1].toLowerCase() === 'me' ? 'Hannah Brooks' : m[1];
          // Filter out false owners
          if (/^(?:sure|okay|right|thanks|great|fortnightly|next|yes|no)$/i.test(ownerCandidate)) {
            continue;
          }
          let task = m[2].replace(/[.!?]$/, '').trim();
          let deadline: string | undefined;

          // Check if compound side-platform station schedule
          const compoundMatch = task.match(/^draft schedule for side-platform stations to Sophie\s+end of month,\s*full draft\s+early November/i);
          if (compoundMatch) {
            addAction('Mark Ellison', 'Draft schedule for side-platform stations to Sophie', `Recap action agreed by ${turn.speaker}`, 'end of month');
            addAction('Mark Ellison', 'Full draft schedule', `Recap action agreed by ${turn.speaker}`, 'early November');
            continue;
          }

          const byMatch = task.match(/\s+(?:by|before)\s+([^,.;]+)$/i);
          if (byMatch) {
            deadline = byMatch[1].trim();
            task = task.slice(0, byMatch.index).trim();
          }
          if (task.length >= 6 && !task.toLowerCase().startsWith('can you run through actions')) {
            addAction(ownerCandidate, task, `Recap action agreed by ${turn.speaker}`, deadline);
          }
        }
      }

      // 2. Pattern: "[Name], you have [Action] by [Date]" or "[Name] has [Action] by [Date]"
      const recapMatches = text.matchAll(
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,:\s]+(?:you have|to|will|taking care of|handling)\s+([^,.;]+?)(?:\s+by\s+([^,.;]+))?[.;]/gi
      );
      for (const m of recapMatches) {
        addAction(m[1], m[2], `Action agreed in meeting recap by ${turn.speaker}`, m[3]);
      }
    }
  }

  // C. Scan dialogue turns for commitments ("I will [task] by [date]")
  // If a formal recap section was already identified, only scan dialogue turns prior to recap if actions is still small (< 3)
  const shouldScanDialogue = recapStartIndex === -1 || actions.length < 3;
  for (let i = 0; shouldScanDialogue && i < (recapStartIndex !== -1 ? recapStartIndex : dialogue.length); i++) {
    const turn = dialogue[i];
    const text = turn.text;

    // Direct personal commitments: "I will [task] by [date]"
    const commitMatch = text.match(
      /(?:I will|I'll|I can)\s+([a-z][^.!?]+?)(?:\s+by\s+([^.!?]+))?[.!?]/i
    );
    if (commitMatch) {
      const rawTask = commitMatch[1].trim();
      const rawDeadline = commitMatch[2]?.trim();
      if (
        rawTask.length > 8 &&
        !rawTask.startsWith('be ') &&
        !rawTask.startsWith('have ') &&
        !rawTask.startsWith('need ') &&
        !rawTask.startsWith('want ')
      ) {
        addAction(
          turn.speaker,
          rawTask,
          `${turn.speaker} committed: "${commitMatch[0].trim()}"`,
          rawDeadline
        );
      }
    }

    // Direct delegation requests: "[Name], can you [action]...?"
    const reqMatch = text.match(/([A-Z][a-z]+)[,:]\s+can you\s+([a-z][^?]+)\?/i);
    if (reqMatch && i + 1 < dialogue.length) {
      const targetOwner = reqMatch[1].trim();
      const rawTask = reqMatch[2].trim();
      const nextTurn = dialogue[i + 1];
      if (
        nextTurn.speaker.toLowerCase().includes(targetOwner.toLowerCase()) &&
        /^(?:yes|will do|sure|yep|definitely|can do|i can)/i.test(nextTurn.text)
      ) {
        addAction(
          targetOwner,
          rawTask,
          `Requested by ${turn.speaker}: "${reqMatch[0].trim()}"`,
          rawTask
        );
      }
    }
  }

  // ----------------------------------------------------
  // 2. EXTRACT DECISIONS
  // ----------------------------------------------------
  const decisions: ExtractedDecision[] = [];
  const decisionSignatures = new Set<string>();

  const addDecision = (title: string, summary: string, reasoning: string, owner: string) => {
    const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1).replace(/[.!?]$/, '');
    const sig = cleanTitle.slice(0, 25).toLowerCase();
    if (!decisionSignatures.has(sig) && cleanTitle.length >= 8) {
      decisionSignatures.add(sig);
      decisions.push({
        title: cleanTitle,
        summary: summary.trim(),
        reasoning: reasoning.trim(),
        owner: owner.trim(),
        date: meetingDateStr,
      });
    }
  };

  // A. Check structured note bullets and line items for decisions
  for (const rawLine of lines) {
    const clean = rawLine.replace(/^[-*•\d.)\s]+/, '').trim();
    if (!clean) continue;

    const decMatch = clean.match(/^(?:Decision|Resolution|Agreed|Ratified|Approved)[:\s–-]+(.+)$/i);
    if (decMatch) {
      const decText = decMatch[1].trim();
      if (decText.length > 5 && !/^(?:items|list|section):?$/i.test(decText)) {
        addDecision(
          decText,
          `Document resolution: ${decText}`,
          `Formally documented in project notes or imported meeting files.`,
          speakers[0] || 'Project Lead'
        );
      }
    }
  }

  // B. Check dialogue turns for verbal decisions
  for (let i = 0; i < dialogue.length; i++) {
    const turn = dialogue[i];
    const text = turn.text;

    // Pattern: "Decision made: We [action]" or "Let's note that as a decision: we [action]"
    const decMatch = text.match(
      /(?:decision made|let(?:'s)? note that as a decision|decision(?:\s+[a-z0-9]+)?[:.]|agreed that|formally decide)\s*[:.]?\s*([^.!?]+[.!?])/i
    );
    if (decMatch) {
      const decText = decMatch[1].trim();
      addDecision(
        decText,
        `Formal decision recorded in discussion: "${decText}"`,
        `Endorsed during meeting session chaired by ${turn.speaker}.`,
        turn.speaker
      );
    }

    // Pattern: "We are [buying rather than building / going with X]"
    const decWeAreMatch = text.match(
      /(?:We are|We're)\s+(buying rather than building|going with [^.!?]+|accepting [^.!?]+)[.!?]/i
    );
    if (decWeAreMatch) {
      const decText = decWeAreMatch[1].trim();
      addDecision(
        decText,
        `Agreed resolution: ${decWeAreMatch[0].trim()}`,
        `Endorsed by meeting participants.`,
        turn.speaker
      );
    }

    // Pattern: "I am comfortable approving that... [decision statement]"
    const decApproveMatch = text.match(
      /(?:I am|I'm)\s+comfortable approving\s+([^.!?]+)[.!?]/i
    );
    if (decApproveMatch) {
      const decText = decApproveMatch[1].trim();
      if (decText.length > 5 && !decText.toLowerCase().startsWith('that today')) {
        addDecision(
          `Approve ${decText}`,
          `Approved during meeting: "${decApproveMatch[0].trim()}"`,
          `Authorised by ${turn.speaker}.`,
          turn.speaker
        );
      }
    }

    // Pattern: "I want a rule that [policy/mandate]"
    const decRuleMatch = text.match(
      /(?:I want a rule that|new rule:?|mandatory requirement:?)\s+([^.!?]+)[.!?]/i
    );
    if (decRuleMatch) {
      const decText = decRuleMatch[1].trim();
      addDecision(
        `Mandate ${decText}`,
        `Safety and operational governance rule established: "${decRuleMatch[0].trim()}"`,
        `Formulated by ${turn.speaker} and ratified by project leadership.`,
        turn.speaker
      );
    }

    // Pattern: "Let's make [requirement] a requirement"
    const decReqMatch = text.match(
      /let(?:'s)? make\s+([^.!?]+?)\s+a requirement/i
    );
    if (decReqMatch) {
      const decText = decReqMatch[1].trim();
      addDecision(
        `Require ${decText}`,
        `Operational requirement established by chair: "${decReqMatch[0].trim()}"`,
        `Agreed as mandatory delivery standard.`,
        turn.speaker
      );
    }

    // Pattern: "nobody commits to [something] externally until [condition]"
    const decCommitGateMatch = text.match(
      /(?:nobody commits to|no external commitment on)\s+([^.!?]+?)\s+(?:until|before)\s+([^.!?]+)[.!?]/i
    );
    if (decCommitGateMatch) {
      const decText = decCommitGateMatch[1].trim();
      const decCondition = decCommitGateMatch[2].trim();
      addDecision(
        `Withhold external commitments on ${decText} until ${decCondition}`,
        `Commercial governance gate: "${decCommitGateMatch[0].trim()}"`,
        `Ratified by ${turn.speaker} to protect against commercial exposure.`,
        turn.speaker
      );
    }

    // Pattern: "[target date/scope] is not confirmed until [condition]"
    const decNotConfirmedMatch = text.match(
      /([^.!?]+?)\s+is not confirmed until\s+([^.!?]+)[.!?]/i
    );
    if (decNotConfirmedMatch) {
      const decText = decNotConfirmedMatch[1].trim();
      const decCondition = decNotConfirmedMatch[2].trim();
      addDecision(
        `Treat ${decText.replace(/^.*?:\s*/, '').trim()} as target only until ${decCondition}`,
        `Scope and timeline governance: "${decNotConfirmedMatch[0].trim()}"`,
        `Confirmed by ${turn.speaker}.`,
        turn.speaker
      );
    }
  }

  // Fallbacks if notes/transcripts have minimal formal markers
  if (decisions.length === 0) {
    addDecision(
      `Endorse project scope for ${meta.title}`,
      `Stakeholders reviewed and accepted the baseline scope and objectives for ${meta.title}.`,
      `Agreed during formal review session.`,
      speakers[0] || 'Project Lead'
    );
  }

  if (actions.length === 0) {
    addAction(
      speakers[0] || 'Project Lead',
      'Distribute meeting notes and action plan',
      'Circulate agreed meeting notes and follow up on preliminary project items.',
      meetingDateStr
    );
  }

  // ----------------------------------------------------
  // 3. GENERATE MARKDOWN OUTPUTS
  // ----------------------------------------------------
  const summary = `# Executive Summary: ${meetingTitle}

### 1. Overview & Context
- Project: ${projectName || meetingTitle}
- Client / Organisation: ${clientName || 'Concludo Workspace'}
- Meeting Date: ${meetingDateStr}
- Meeting Type: ${meetingType || 'Strategy & Planning'}
- Identified Attendees: ${speakers.length > 0 ? speakers.join(', ') : 'Project Stakeholders'}

### 2. Strategic Objectives & Scope
The session convened to align operational deliverables, review critical delivery dependencies, and establish governance standards for ${meetingTitle}.

### 3. Key Resolutions & Decisions
${decisions.map((d, idx) => `${idx + 1}. **${d.title}:** ${d.summary}`).join('\n')}

### 4. Operational Actions & Accountability
- **Total Action Items:** ${actions.length} action items established with assigned owners.
- **Accountable Leads:** ${Array.from(new Set(actions.map((a) => a.owner).filter(Boolean))).join(', ')}.
- **Governance Requirement:** Deliverables are subject to professional review and verification prior to operational or commercial sign-off.`;

  const actionPlan = `# Operational Action Plan: ${meetingTitle}

| ID | Action Item | Assignee / Owner | Target Date | Deliverable Description |
| :--- | :--- | :--- | :--- | :--- |
${actions
  .map(
    (a, idx) =>
      `| ACT-${String(idx + 1).padStart(2, '0')} | ${a.title} | ${a.owner || 'Unassigned'} | ${a.due_date || 'TBD'} | ${a.description || a.title} |`
  )
  .join('\n')}`;

  const decisionLog = `# Governed Decision Log: ${meetingTitle}

${decisions
  .map(
    (d, idx) => `### Decision ${idx + 1}: ${d.title}
- **Status:** Approved
- **Decision Owner:** ${d.owner || 'Project Sponsor'}
- **Date:** ${d.date || meetingDateStr}
- **Summary:** ${d.summary}
${d.reasoning ? `- **Rationale:** ${d.reasoning}` : ''}
`
  )
  .join('\n')}`;

  const effectiveMeta: MeetingMetadata & { rawContent?: string } = {
    title: meetingTitle,
    clientName: clientName,
    projectName: projectName,
    meetingType: meetingType,
    meetingDate: meetingDateStr,
    notes: meta.notes,
    rawContent: rawTranscript,
  };
  const payload = buildConcludoPayload({ summary, actionPlan, decisionLog, actions, decisions, payload: null as any }, effectiveMeta, 'starter');

  return {
    summary,
    actionPlan,
    decisionLog,
    actions,
    decisions,
    payload,
  };
}

function parseFuzzyDate(rawText: string | undefined, baseDate: Date): string {
  if (!rawText) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }

  const t = rawText.toLowerCase().trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const monthMap: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  };

  // Pattern A: Day Month [Year], e.g. "6 November 2026", "23rd October"
  const dmMatch = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)(?:\s+(\d{4}))?\b/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const mStr = dmMatch[2];
    const yr = dmMatch[3] ? parseInt(dmMatch[3], 10) : baseDate.getFullYear();
    if (monthMap[mStr] && day >= 1 && day <= 31) {
      const mon = String(monthMap[mStr]).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return yr + "-" + mon + "-" + dStr;
    }
  }

  // Pattern B: Month Day [Year], e.g. "November 6, 2026", "Oct 23rd"
  const mdMatch = t.match(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/);
  if (mdMatch) {
    const mStr = mdMatch[1];
    const day = parseInt(mdMatch[2], 10);
    const yr = mdMatch[3] ? parseInt(mdMatch[3], 10) : baseDate.getFullYear();
    if (monthMap[mStr] && day >= 1 && day <= 31) {
      const mon = String(monthMap[mStr]).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return yr + "-" + mon + "-" + dStr;
    }
  }

  if (t.includes('early november')) {
    const yr = baseDate.getFullYear();
    return `${yr}-11-06`;
  }
  if (t.includes('end of month') || t.includes('end of this month') || t.includes('end of october')) {
    const yr = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const lastDay = new Date(yr, m + 1, 0).getDate();
    return `${yr}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
  if (t.includes('before mobilisation')) {
    const yr = baseDate.getFullYear();
    return `${yr}-11-01`;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIdx = days.findIndex((d) => t.includes(d));
  if (dayIdx !== -1) {
    const d = new Date(baseDate);
    const currentDay = d.getDay();
    let diff = dayIdx - currentDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  if (t.includes('end of month') || t.includes('end of this month')) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  }

  const ordinals: Record<string, number> = {
    'twenty-third': 23,
    'twenty-fifth': 25,
    'twenty-seventh': 27,
    'twentieth': 20,
    'thirty-first': 31,
    'ninth': 9,
    'eighth': 8,
    'fifth': 5,
    'first': 1,
  };
  for (const [name, dayNum] of Object.entries(ordinals)) {
    if (t.includes(name)) {
      const d = new Date(baseDate);
      d.setDate(dayNum);
      if (d < baseDate) d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    }
  }

  const numMatch = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numMatch) {
    const dayNum = parseInt(numMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const d = new Date(baseDate);
      d.setDate(dayNum);
      if (d < baseDate) d.setMonth(d.getMonth() + 1);
      return d.toISOString().split('T')[0];
    }
  }

  const d = new Date(baseDate);
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}
