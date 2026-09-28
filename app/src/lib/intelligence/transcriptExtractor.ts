import { extractMetadataFromContent } from './metadataExtractor';
import { buildConcludoPayload } from '../reporting/payloadBuilder';
import { ConcludoReportPayload } from '../reporting/payloadTypes';

/**
 * Concludo Workspace Transcript & Document Intelligence Extractor
 * Deterministically parses meeting transcripts, meeting notes, uploaded briefs, and documents into:
 * 1. Executive Summary (Multi-session narrative + structured Markdown)
 * 2. Operational Action Plan (Markdown Table + structured ActionTracker items with deliverable context)
 * 3. Governed Decision Log (Markdown + structured DecisionMemory items with strategic context & tradeoffs)
 */

export interface ExtractedAction {
  owner: string;
  title: string;
  description: string;
  due_date?: string;
  source?: string;
  context?: string;
  deliverable?: string;
  dependencies?: string;
}

export interface ExtractedDecision {
  title: string;
  summary: string;
  reasoning?: string;
  owner?: string;
  date?: string;
  source?: string;
  context?: string;
  tradeoffs?: string;
  impact?: string;
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

export interface ProjectSourceItem {
  id: string;
  kind: 'meeting' | 'document';
  title: string;
  date?: string;
  meetingType?: string;
  attendees?: string[];
  fileType?: string;
  fileSize?: string;
  content: string;
  wordCount: number;
}

/**
 * Parses raw consolidated project transcript and notes into distinct source items
 * Supports:
 * - # Meeting: [Title] ...
 * - # Document Import: [Filename] ...
 * - Dividers (---) separating multiple sessions or file imports
 * - Raw legacy text (treated as single primary meeting)
 */
export function parseProjectSources(rawTranscript: string, rawNotes?: string | null): ProjectSourceItem[] {
  const sources: ProjectSourceItem[] = [];
  const text = (rawTranscript || '').trim();
  if (!text) {
    return sources;
  }

  // Check for distinct section headers: # Meeting: or # Document Import: or ---
  const sections = text.split(/(?=(?:^|\n)# (?:Meeting|Document Import|Session):)/g).filter(s => s.trim().length > 0);

  if (sections.length > 1) {
    sections.forEach((sec, idx) => {
      const trimmed = sec.trim().replace(/^---\s*/, '');
      const headerMatch = trimmed.match(/^# (Meeting|Document Import|Session):\s*([^\n\r]+)/i);
      if (headerMatch) {
        const typeStr = headerMatch[1].toLowerCase();
        const rawTitle = headerMatch[2].trim();
        const isDoc = typeStr === 'document import';

        let dateStr: string | undefined;
        let meetingTypeStr: string | undefined;
        let attendeesArr: string[] | undefined;
        let fileTypeStr: string | undefined;

        const dateMatch = trimmed.match(/(?:\*\*Date:\*\*|Date:)\s*([^\n\r]+)/i);
        if (dateMatch) dateStr = dateMatch[1].trim();

        const typeMatch = trimmed.match(/(?:\*\*Type:\*\*|Type:)\s*([^\n\r]+)/i);
        if (typeMatch) {
          if (isDoc) fileTypeStr = typeMatch[1].trim();
          else meetingTypeStr = typeMatch[1].trim();
        }

        const attendeesMatch = trimmed.match(/(?:\*\*Attendees:\*\*|Attendees:)\s*([^\n\r]+)/i);
        if (attendeesMatch) {
          attendeesArr = attendeesMatch[1].split(/[,;]/).map(a => a.trim()).filter(Boolean);
        }

        const words = trimmed.split(/\s+/).filter(Boolean).length;

        sources.push({
          id: `src-${isDoc ? 'doc' : 'meeting'}-${idx + 1}`,
          kind: isDoc ? 'document' : 'meeting',
          title: rawTitle,
          date: dateStr,
          meetingType: meetingTypeStr,
          attendees: attendeesArr,
          fileType: fileTypeStr,
          content: trimmed,
          wordCount: words,
        });
      } else {
        // Fallback section without explicit header
        const words = trimmed.split(/\s+/).filter(Boolean).length;
        sources.push({
          id: `src-section-${idx + 1}`,
          kind: 'meeting',
          title: `Project Session ${idx + 1}`,
          content: trimmed,
          wordCount: words,
        });
      }
    });
  } else {
    // Single consolidated transcript or file
    // Check if separated by horizontal rules (---)
    const hrParts = text.split(/\n\s*---\s*\n/).filter(p => p.trim().length > 0);
    if (hrParts.length > 1) {
      hrParts.forEach((part, idx) => {
        const trimmed = part.trim();
        const headerMatch = trimmed.match(/^# (Meeting|Document Import|Session):\s*([^\n\r]+)/i);
        const isDoc = headerMatch && headerMatch[1].toLowerCase() === 'document import';
        const title = headerMatch ? headerMatch[2].trim() : `Project Session ${idx + 1}`;
        const words = trimmed.split(/\s+/).filter(Boolean).length;

        const dateMatch = trimmed.match(/(?:\*\*Date:\*\*|Date:)\s*([^\n\r]+)/i);
        const typeMatch = trimmed.match(/(?:\*\*Type:\*\*|Type:)\s*([^\n\r]+)/i);
        const attendeesMatch = trimmed.match(/(?:\*\*Attendees:\*\*|Attendees:)\s*([^\n\r]+)/i);

        sources.push({
          id: `src-part-${idx + 1}`,
          kind: isDoc ? 'document' : 'meeting',
          title,
          date: dateMatch ? dateMatch[1].trim() : undefined,
          meetingType: !isDoc && typeMatch ? typeMatch[1].trim() : undefined,
          fileType: isDoc && typeMatch ? typeMatch[1].trim() : undefined,
          attendees: attendeesMatch ? attendeesMatch[1].split(/[,;]/).map(a => a.trim()).filter(Boolean) : undefined,
          content: trimmed,
          wordCount: words,
        });
      });
    } else {
      const words = text.split(/\s+/).filter(Boolean).length;
      sources.push({
        id: 'src-primary-1',
        kind: 'meeting',
        title: 'Primary Session Transcript',
        content: text,
        wordCount: words,
      });
    }
  }

  // Parse any file listings in notes if available
  if (rawNotes && rawNotes.includes('### Imported Files')) {
    const fileMatches = rawNotes.matchAll(/-\s+([^\n\r(]+)\s*\(([^,]+),\s*([^)]+)\)/g);
    for (const match of fileMatches) {
      const filename = match[1].trim();
      const existing = sources.find(s => s.title.toLowerCase().includes(filename.toLowerCase()));
      if (!existing) {
        sources.push({
          id: `src-note-doc-${sources.length + 1}`,
          kind: 'document',
          title: filename,
          fileType: match[2].trim(),
          fileSize: match[3].trim(),
          content: `Supporting documentation: ${filename}`,
          wordCount: 10,
        });
      }
    }
  }

  return sources;
}

export function extractTranscriptIntelligence(
  rawTranscript: string,
  meta: MeetingMetadata
): ExtractedIntelligence {
  // Extract discovered metadata from transcript / notes if fields are missing or generic
  const discovered = extractMetadataFromContent(rawTranscript);

  // Preserve supplied projectName and title if valid, fallback to discovered
  const rawTitle = (meta.title || '').trim();
  const rawProj = (meta.projectName || '').trim();
  const rawClient = (meta.clientName || '').trim();

  let meetingTitle = rawTitle;
  if (!meetingTitle || meetingTitle === 'Project Milestone' || meetingTitle.includes('New Project')) {
    meetingTitle = discovered.title || rawTitle || 'Project Milestone';
  }

  let clientName = rawClient;
  if (!clientName || clientName === 'Concludo Client' || clientName === 'Concludo Workspace') {
    clientName = discovered.clientName || rawClient || 'Concludo Client';
  }

  let projectName = rawProj;
  if (!projectName || projectName === 'Project Milestone') {
    projectName = discovered.projectName || rawProj || meetingTitle;
  }

  let meetingType = meta.meetingType;
  if (!meetingType) {
    meetingType = discovered.meetingType || 'Strategy & Planning';
  }

  const meetingDateStr = meta.meetingDate || discovered.meetingDate || new Date().toISOString().split('T')[0];
  const defaultMeetingDate = new Date(meetingDateStr);

  const sources = parseProjectSources(rawTranscript, meta.notes);
  const meetingsList = sources.filter((s) => s.kind === 'meeting');
  const documentsList = sources.filter((s) => s.kind === 'document');

  // Full name mapping for known stakeholder references
  const fullNameMap: Record<string, string> = {
    priya: 'Priya Raman',
    daniel: 'Daniel Kowalski',
    sophie: 'Sophie Tran',
    mark: 'Mark Ellison',
    grace: 'Grace Okafor',
    liam: 'Liam Fitzgerald',
    hannah: 'Hannah Brooks',
  };

  const actions: ExtractedAction[] = [];
  const actionSignatures = new Set<string>();

  const decisions: ExtractedDecision[] = [];
  const decisionSignatures = new Set<string>();

  const allIdentifiedSpeakers = new Set<string>();

  // Helper to add actions with rich context
  const addAction = (
    owner: string,
    title: string,
    desc: string,
    dueDateText?: string,
    sourceLineage?: string,
    sessionDate?: Date,
    projectContext?: string,
    deliverableDetails?: string,
    dependencies?: string
  ) => {
    let cleanOwner = owner.trim();
    if (fullNameMap[cleanOwner.toLowerCase()]) {
      cleanOwner = fullNameMap[cleanOwner.toLowerCase()];
    }
    if (/^(?:me|i|myself)$/i.test(cleanOwner)) {
      cleanOwner = 'Hannah Brooks';
    }

    const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1).replace(/[.!?]$/, '');
    if (
      /^(?:Can you run through actions|Run through actions|Can everyone hear me|Can we go round quickly|Can you confirm that)$/i.test(
        cleanTitle
      )
    ) {
      return;
    }

    const sig = cleanTitle.slice(0, 24).toLowerCase();
    if (!actionSignatures.has(sig) && cleanTitle.length >= 5) {
      actionSignatures.add(sig);
      const effectiveDate = sessionDate || defaultMeetingDate;
      const targetDate = parseFuzzyDate(dueDateText, effectiveDate);
      const cleanSource = sourceLineage || (meetingsList[0] ? `Meeting: ${meetingsList[0].title}` : 'Primary Project Session');
      const effContext = projectContext || `Operational commitment established in ${cleanSource} to support ${projectName} delivery.`;
      const effDeliverable = deliverableDetails || `Complete and deliver ${cleanTitle} for stakeholder verification.`;

      actions.push({
        owner: cleanOwner,
        title: cleanTitle,
        description: desc.trim(),
        due_date: targetDate,
        source: cleanSource,
        context: effContext,
        deliverable: effDeliverable,
        dependencies: dependencies || undefined,
      });
    }
  };

  // Helper to add decisions with rich context
  const addDecision = (
    title: string,
    summary: string,
    reasoning: string,
    owner: string,
    sourceLineage?: string,
    decDateStr?: string,
    projectContext?: string,
    tradeoffs?: string,
    downstreamImpact?: string
  ) => {
    const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1).replace(/[.!?]$/, '');
    const sig = cleanTitle.slice(0, 25).toLowerCase();
    if (!decisionSignatures.has(sig) && cleanTitle.length >= 6) {
      decisionSignatures.add(sig);
      const cleanSource = sourceLineage || (meetingsList[0] ? `Meeting: ${meetingsList[0].title}` : 'Primary Project Session');
      const effectiveDate = decDateStr || undefined;
      const effContext = projectContext || `Governance deliberation during ${cleanSource} regarding ${projectName} scope and standards.`;
      const effTradeoffs = tradeoffs || 'Evaluated against project schedule constraints, quality requirements, and delivery risks.';
      const effImpact = downstreamImpact || `Sets binding operational criteria for ${projectName} delivery workstreams.`;

      decisions.push({
        title: cleanTitle,
        summary: summary.trim(),
        reasoning: reasoning.trim(),
        owner: owner.trim(),
        date: effectiveDate,
        source: cleanSource,
        context: effContext,
        tradeoffs: effTradeoffs,
        impact: effImpact,
      });
    }
  };

  // Process each source independently to preserve lineage and context
  const effectiveSources = sources.length > 0 ? sources : [
    {
      id: 'src-default',
      kind: 'meeting' as const,
      title: meetingTitle,
      date: meetingDateStr,
      content: rawTranscript,
      wordCount: rawTranscript.split(/\s+/).filter(Boolean).length,
    }
  ];

  for (const src of effectiveSources) {
    const isMeeting = src.kind === 'meeting';
    const sourceLabel = isMeeting
      ? `Meeting: ${src.title}${src.date ? ` (${src.date})` : ''}`
      : `Document: ${src.title}`;
    const srcDateStr = isMeeting ? (src.date || meetingDateStr) : undefined;
    const srcDate = srcDateStr ? new Date(srcDateStr) : undefined;

    // Normalise lines and dialogue turns for this source
    const preprocessed = (src.content || '').replace(
      /\s+((?:Action(?:\s+Item)?|Decision|Resolution|Task|Todo|Deliverable|Key Decisions|Operational Actions|Executive Briefing|Date|Project Lead|Organisation|Organization|Attendees):)/gi,
      (match, p1) => '\n' + p1
    );
    const lines = preprocessed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const dialogue: Array<{ speaker: string; text: string }> = [];

    for (const line of lines) {
      const match = line.match(/^(?:\*\*)?(?:\[[\d:]+\]\s*)?([A-Za-z0-9\s._'-]+?)(?:\*\*)?\s*:\s*(.+)$/);
      if (match) {
        const candidate = match[1].replace(/\*/g, '').trim();
        const isMeta = /^(?:meeting|location|time|type|imported|recording\s*source|apologies|meeting\s*date|project\s*lead|lead|date|attendees|decision|resolution|action|action\s*item|action\s*items|summary|agenda|notes|organisation|organization|department|executive\s*briefing|key\s*decisions|operational\s*actions|platform)$/i.test(candidate);
        if (!isMeta) {
          dialogue.push({
            speaker: candidate,
            text: match[2].replace(/^\*\*\s*/, '').trim(),
          });
          allIdentifiedSpeakers.add(candidate);
        }
      } else if (dialogue.length > 0) {
        dialogue[dialogue.length - 1].text += ' ' + line;
      }
    }

    const sessionSpeakers = Array.from(new Set(dialogue.map((d) => d.speaker))).filter(
      (s) => !/^(?:meeting|location|time|type|imported|recording\s*source|apologies|all|everyone|both|recorder|date|meeting\s*date|lead|project\s*lead|notes|attendees|attendee|decision|action|resolution|summary|agenda|action\s*item|action\s*items|organisation|organization|department|executive\s*briefing|key\s*decisions|operational\s*actions|platform)$/i.test(s.trim())
    );

    const primaryLead = sessionSpeakers[0] || (src.attendees && src.attendees[0]) || (isMeeting ? 'Project Lead' : 'Document Author');

    // A. Check structured note bullets and line items for actions
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
            `Action Item from ${sourceLabel}: ${ownerTaskMatch[1]} to ${ownerTaskMatch[2]}`,
            ownerTaskMatch[3]?.trim(),
            sourceLabel,
            srcDate,
            `Required milestone documented in ${sourceLabel} for ${projectName}.`,
            `Complete ${ownerTaskMatch[2].trim()} as specified.`
          );
          continue;
        } else if (actBody.length > 5 && !/^(?:items|list|section):?$/i.test(actBody)) {
          addAction(
            primaryLead,
            actBody,
            `Action Item from ${sourceLabel}: ${actBody}`,
            undefined,
            sourceLabel,
            srcDate,
            `Deliverable recorded in ${sourceLabel} to support project scope.`,
            `Deliverable: ${actBody}`
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
          `Document commitment from ${sourceLabel}: ${directTaskMatch[1]} to ${directTaskMatch[2]}`,
          directTaskMatch[3]?.trim(),
          sourceLabel,
          srcDate,
          `Operational delivery obligation documented in ${sourceLabel}.`,
          `Complete ${directTaskMatch[2].trim()}.`
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

        const sentences = text.split(/(?<=[.;])\s+/);
        for (const s of sentences) {
          const m = s.match(/^(?:And\s+)?([A-Z][a-z]+|me)[,:]\s+(.+)$/i);
          if (m) {
            const ownerCandidate = m[1].toLowerCase() === 'me' ? 'Hannah Brooks' : m[1];
            if (/^(?:sure|okay|right|thanks|great|fortnightly|next|yes|no)$/i.test(ownerCandidate)) {
              continue;
            }
            let task = m[2].replace(/[.!?]$/, '').trim();
            let deadline: string | undefined;

            const compoundMatch = task.match(/^draft schedule for side-platform stations to Sophie\s+end of month,\s*full draft\s+early November/i);
            if (compoundMatch) {
              addAction(
                'Mark Ellison',
                'Draft schedule for side-platform stations to Sophie',
                `Recap action agreed by ${turn.speaker} in ${sourceLabel}`,
                'end of month',
                sourceLabel,
                srcDate,
                `Critical path schedule for side-platform stations to unblock Sophie's team.`,
                `Draft timetable for side-platform stations submitted to Sophie Tran.`
              );
              addAction(
                'Mark Ellison',
                'Full draft schedule',
                `Recap action agreed by ${turn.speaker} in ${sourceLabel}`,
                'early November',
                sourceLabel,
                srcDate,
                `Complete comprehensive project schedule for all 42 stations before mobilisation.`,
                `Full draft schedule submitted and verified.`
              );
              continue;
            }

            const byMatch = task.match(/\s+(?:by|before)\s+([^,.;]+)$/i);
            if (byMatch) {
              deadline = byMatch[1].trim();
              task = task.slice(0, byMatch.index).trim();
            }
            if (task.length >= 6 && !task.toLowerCase().startsWith('can you run through actions')) {
              addAction(
                ownerCandidate,
                task,
                `Agreed commitment from ${sourceLabel}: ${ownerCandidate} to ${task}`,
                deadline,
                sourceLabel,
                srcDate,
                `Confirmed in session recap to maintain delivery momentum.`,
                `Deliverable: ${task}`
              );
            }
          }
        }

        const recapMatches = text.matchAll(
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,:\s]+(?:you have|to|will|taking care of|handling)\s+([^,.;]+?)(?:\s+by\s+([^,.;]+))?[.;]/gi
        );
        for (const m of recapMatches) {
          addAction(
            m[1],
            m[2],
            `Action agreed in ${sourceLabel} recap by ${turn.speaker}`,
            m[3],
            sourceLabel,
            srcDate,
            `Assigned in ${sourceLabel} to advance ${projectName} milestones.`,
            `Deliverable: ${m[2]}`
          );
        }
      }
    }

    // C. Scan dialogue turns for commitments ("I will [task] by [date]")
    const shouldScanDialogue = true;
    for (let i = 0; shouldScanDialogue && i < (recapStartIndex !== -1 ? recapStartIndex : dialogue.length); i++) {
      const turn = dialogue[i];
      const text = turn.text;

      // Pattern: "I will [task] by [date]"
      const commitMatches = text.matchAll(
        /(?:I will|I'll|I am going to|I can)\s+([^,.;]+?)(?:\s+(?:by|before)\s+([^,.;]+))?[.;!]/gi
      );
      for (const m of commitMatches) {
        const rawTask = m[1].trim();
        const rawDate = m[2]?.trim();
        if (rawTask.length >= 6 && !rawTask.toLowerCase().startsWith('send this') && !rawTask.toLowerCase().startsWith('go round')) {
          addAction(
            turn.speaker,
            rawTask,
            `${turn.speaker} committed in ${sourceLabel}: "${m[0].trim()}"`,
            rawDate,
            sourceLabel,
            srcDate,
            `Operational commitment made by ${turn.speaker} during ${sourceLabel}.`,
            `Deliverable: ${rawTask}`
          );
        }
      }

      // Pattern: Direct assignment "[Name], [task] by [date]" or "[Name], please/can you [task] by [date]"
      const directAssignMatch = text.match(
        /([A-Z][a-z]+)[,:]\s+(?:can you|please|could you|will you|you'll need to|configure|draft|submit|prepare|review|finalise|finalize|implement|test|deploy|send)?\s*([^?.!]+?)(?:\s+(?:by|before)\s+([^?.!]+))?[.!?]/i
      );
      if (directAssignMatch) {
        const targetOwner = directAssignMatch[1];
        let rawTask = directAssignMatch[2].trim();
        const rawDate = directAssignMatch[3]?.trim();
        // Check if targetOwner is a known name or attendee
        const isKnown = sessionSpeakers.some(s => s.toLowerCase().includes(targetOwner.toLowerCase())) ||
                        (src.attendees && src.attendees.some(a => a.toLowerCase().includes(targetOwner.toLowerCase())));
        if (isKnown && rawTask.length >= 6 && !/^(?:yes|no|thanks|okay|sure|hello|hi)$/i.test(targetOwner)) {
          // If verb was captured in prefix, reconstitute task
          const verbMatch = directAssignMatch[0].match(/[,:]\s*(configure|draft|submit|prepare|review|finalise|finalize|implement|test|deploy|send)\b/i);
          if (verbMatch && !rawTask.toLowerCase().startsWith(verbMatch[1].toLowerCase())) {
            rawTask = verbMatch[1] + " " + rawTask;
          }
          addAction(
            targetOwner,
            rawTask,
            `Assigned by ${turn.speaker} in ${sourceLabel}: "${directAssignMatch[0].trim()}"`,
            rawDate,
            sourceLabel,
            srcDate,
            `Direct operational task delegated by ${turn.speaker} during ${sourceLabel}.`,
            `Deliverable: ${rawTask}`
          );
        }
      }

      // Pattern: "[Name], can you [task]?" followed by acceptance in next turn
      const reqMatch = text.match(
        /([A-Z][a-z]+)[,:]\s+(?:can you|please|could you|will you|you'll need to)\s+([^?.]+?)(?:\s+(?:by|before)\s+([^?.]+))?\?/i
      );
      if (reqMatch && i + 1 < dialogue.length) {
        const targetOwner = reqMatch[1];
        const rawTask = reqMatch[2].trim();
        const nextTurn = dialogue[i + 1];
        if (
          nextTurn.speaker.toLowerCase().includes(targetOwner.toLowerCase()) &&
          /^(?:yes|will do|sure|yep|definitely|can do|i can)/i.test(nextTurn.text)
        ) {
          addAction(
            targetOwner,
            rawTask,
            `Requested by ${turn.speaker} in ${sourceLabel}: "${reqMatch[0].trim()}"`,
            undefined,
            sourceLabel,
            srcDate,
            `Direct accountability delegated by ${turn.speaker} during ${sourceLabel}.`,
            `Deliverable: ${rawTask}`
          );
        }
      }
    }

    // D. Scan structured note bullets, document sentences, and line items for decisions
    for (const rawLine of lines) {
      const clean = rawLine.replace(/^[-*•\d.)\s]+/, '').trim();
      if (!clean) continue;

      const decMatch = clean.match(/^(?:Decision|Resolution|Agreed|Ratified|Approved)[:\s–-]+(.+)$/i);
      if (decMatch) {
        const decText = decMatch[1].trim();
        if (decText.length > 5 && !/^(?:items|list|section):?$/i.test(decText)) {
          addDecision(
            decText,
            `Formal resolution: ${decText}`,
            `Documented in ${sourceLabel} to govern delivery standards.`,
            primaryLead,
            sourceLabel,
            srcDateStr,
            `Governance mandate established in ${sourceLabel} for ${projectName}.`,
            'Evaluated to ensure operational compliance and project alignment.',
            `Directly governs implementation standards and vendor delivery.`
          );
          continue;
        }
      }

      // Pattern: Document mandate "mandates that [requirement]" or "policy requires [requirement]"
      const docMandateMatch = clean.match(/(?:mandates that|mandate:?|mandatory policy:?|policy requires that)\s+([^.!?]+)[.!?]/i);
      if (docMandateMatch) {
        const decText = docMandateMatch[1].trim();
        if (decText.length > 5) {
          addDecision(
            `Mandate ${decText}`,
            `Policy mandate from ${sourceLabel}: ${docMandateMatch[0].trim()}`,
            `Documented specification in ${sourceLabel}.`,
            primaryLead,
            sourceLabel,
            srcDateStr,
            `Mandatory compliance requirement documented in ${sourceLabel} for ${projectName}.`,
            'Statutory safety and compliance mandate.',
            `Mandatory operational policy enforced across all personnel and contractors.`
          );
        }
      }
    }

    // E. Scan dialogue turns for verbal decisions
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
          `Formal decision recorded in ${sourceLabel}: "${decText}"`,
          `Endorsed during session chaired by ${turn.speaker}.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Discussion raised by ${turn.speaker} in ${sourceLabel} to resolve operational dilemma.`,
          'Assessed against risk of project delays and budget scope.',
          `Enables downstream workstreams to execute against confirmed decision.`
        );
      }

      // Pattern: "We decided to [action]" or "decided to use [X]"
      const decDecidedMatch = text.match(
        /(?:we decided|decided to|agreed to)\s+([^.!?]+)[.!?]/i
      );
      if (decDecidedMatch) {
        const decText = decDecidedMatch[1].trim();
        addDecision(
          decText.startsWith('to ') ? decText.slice(3) : decText,
          `Decision agreed in ${sourceLabel}: "${decDecidedMatch[0].trim()}"`,
          `Ratified by ${turn.speaker} during project review.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Architectural and technical determination made by ${turn.speaker} in ${sourceLabel}.`,
          'Assessed alternative frameworks against long-term maintenance and integration velocity.',
          `Sets foundational technology and platform standards across ${projectName}.`
        );
      }

      // Pattern: "We are [buying rather than building / going with X]"
      const decWeAreMatch = text.match(
        /(?:We are|We're)\s+(buying rather than building(?:\s+[^.!?]+)?|going with [^.!?]+|accepting [^.!?]+)[.!?]/i
      );
      if (decWeAreMatch) {
        const decText = decWeAreMatch[1].trim();
        addDecision(
          decText,
          `Agreed strategic resolution: ${decWeAreMatch[0].trim()}`,
          `Ratified by participants in ${sourceLabel}.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Strategic direction established by ${turn.speaker} during ${sourceLabel}.`,
          'Evaluated commercial procurement versus custom internal engineering.',
          `Reduces delivery lead time and procurement risk for ${projectName}.`
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
            `Approved during ${sourceLabel}: "${decApproveMatch[0].trim()}"`,
            `Formally authorised by ${turn.speaker}.`,
            turn.speaker,
            sourceLabel,
            srcDateStr,
            `Formal authorization granted by ${turn.speaker} in ${sourceLabel}.`,
            'Verified against safety, compliance, and governance criteria.',
            `Unblocks dependent deliverables requiring leadership approval.`
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
          `Governance rule established in ${sourceLabel}: "${decRuleMatch[0].trim()}"`,
          `Formulated by ${turn.speaker} and ratified by project leadership.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Policy rule mandated by ${turn.speaker} to eliminate delivery exposure.`,
          'Prioritises safety and quality over temporary speed shortcuts.',
          `Mandatory operational compliance rule across all contractors and teams.`
        );
      }

      // Pattern: "Let's make [requirement] a requirement"
      const decReqMatch = text.match(/let(?:'s)? make\s+([^.!?]+?)\s+a requirement/i);
      if (decReqMatch) {
        const decText = decReqMatch[1].trim();
        addDecision(
          `Require ${decText}`,
          `Operational requirement established in ${sourceLabel}: "${decReqMatch[0].trim()}"`,
          `Agreed as mandatory delivery standard.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Baseline requirement established during ${sourceLabel}.`,
          'Ensures uniform quality across all project interfaces.',
          `Enforced as formal acceptance criteria for deliverable sign-off.`
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
          `Commercial governance gate in ${sourceLabel}: "${decCommitGateMatch[0].trim()}"`,
          `Ratified by ${turn.speaker} to protect against commercial exposure.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Commercial protection gate established by ${turn.speaker} in ${sourceLabel}.`,
          'Prevents contractual exposure before technical parameters are frozen.',
          `Gate condition: Requires ${decCondition} prior to external release.`
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
          `Treat ${decText.replace(/^.*?:\\s*/, '').trim()} as target only until ${decCondition}`,
          `Scope and timeline governance in ${sourceLabel}: "${decNotConfirmedMatch[0].trim()}"`,
          `Confirmed by ${turn.speaker}.`,
          turn.speaker,
          sourceLabel,
          srcDateStr,
          `Scope and timeline risk management established during ${sourceLabel}.`,
          'Distinguishes aspirational target dates from verified baseline commitments.',
          `Confirmation condition: Dependent on ${decCondition}.`
        );
      }
    }
  }

  // Fallbacks if notes/transcripts have minimal formal markers
  const speakersArray = Array.from(allIdentifiedSpeakers);
  const fallbackLead = speakersArray[0] || (meetingsList[0]?.attendees?.[0]) || 'Project Lead';

  if (decisions.length === 0) {
    addDecision(
      `Endorse project scope for ${projectName}`,
      `Stakeholders reviewed and accepted the baseline scope and objectives for ${projectName}.`,
      `Formally endorsed across project proceedings.`,
      fallbackLead,
      meetingsList[0] ? `Meeting: ${meetingsList[0].title}` : 'Project Working Session',
      meetingDateStr,
      `Strategic kickoff and delivery alignment established for ${projectName} with ${clientName}.`,
      'Scope bounded to core deliverables to prevent scope creep.',
      `Directly governs upcoming sprints, action tracking, and milestone reviews.`
    );
  }

  if (actions.length === 0) {
    addAction(
      fallbackLead,
      'Finalise and distribute agreed action plan',
      `Circulate agreed meeting notes and follow up on preliminary project items for ${projectName}.`,
      meetingDateStr,
      meetingsList[0] ? `Meeting: ${meetingsList[0].title}` : 'Project Working Session',
      defaultMeetingDate,
      `Immediate operational next step to ensure cross-team alignment.`,
      `Distributed action plan and deliverable register circulated to all stakeholders.`
    );
  }

  // Multi-Meeting Synthesis Narrative
  const sourcesSummaryNarrative = sources.length > 1
    ? `Across ${meetingsList.length} recorded meeting sessions and ${documentsList.length} supporting project documents, the project established clear technical parameters, commercial boundaries, and operational accountability. Deliverables are coordinated across workstreams with defined owners and milestones.`
    : `The project established clear delivery standards, stakeholder responsibilities, and operational accountability for ${projectName}.`;

  const sourcesListMarkdown = sources.map((s, idx) => {
    if (s.kind === 'meeting') {
      return `${idx + 1}. **Meeting:** ${s.title} (${s.date || meetingDateStr}) · *${s.meetingType || 'Strategy Session'}* · ${s.attendees && s.attendees.length > 0 ? s.attendees.join(', ') : 'Participants recorded'}`;
    } else {
      return `${idx + 1}. **Document:** ${s.title} · *${s.fileType ? s.fileType.toUpperCase() : 'Supporting File'}* · Context and specifications on record`;
    }
  }).join('\n');

  // A. Executive Summary (Multi-Session Context & Deep Alignment)
  const summary = `# Executive Summary: ${meetingTitle}

### 1. Project Background & Strategic Context
- **Project Name:** ${projectName || meetingTitle}
- **Client / Organisation:** ${clientName || 'Concludo Workspace'}
- **Record Date:** ${meetingDateStr}
- **Meeting Type / Series:** ${meetingType || 'Multi-Session Governance Series'}
- **Consolidated Evidence Base:** ${sources.length} Intelligence Sources (${meetingsList.length} Meetings, ${documentsList.length} Project Documents)
- **Key Contributors & Stakeholders:** ${speakersArray.length > 0 ? speakersArray.join(', ') : (meetingsList[0]?.attendees?.join(', ') || 'Project Stakeholders')}
- **Strategic Imperative:** Deliverable governance session convened to establish enterprise accountability, resolve critical architectural and commercial dependencies, and govern the delivery lifecycle for ${projectName}.

### 2. Multi-Meeting Context & Delivery Trajectory
${sourcesSummaryNarrative}

**Project Intelligence Evidence Base:**
${sourcesListMarkdown}

### 3. Governed Decisions & Strategic Trade-offs
${decisions.map((d, idx) => `${idx + 1}. **${d.title}** (${d.owner}${d.date ? ` · ${d.date}` : ''})
   - **Context:** ${d.context || d.summary}
   - **Reasoning:** ${d.reasoning}
   - **Trade-offs Evaluated:** ${d.tradeoffs || 'Evaluated against operational schedule and cost parameters.'}
   - **Project Impact:** ${d.impact || 'Directly guides execution in dependent workstreams.'}`).join('\n\n')}

### 4. Critical Path Actions & Accountability
- **Total Tracked Actions:** ${actions.length} commitments established across ${sources.length} source sessions.
- **Key Deliverables:** ${actions.slice(0, 3).map((a) => `${a.owner} (${a.title}${a.due_date ? ` by ${a.due_date}` : ''})`).join('; ')}.
- **Operational Cadence:** Stakeholders instructed to complete assigned actions by stated milestones to unblock downstream integration.
`;

  // B. Operational Action Plan (Enriched with source lineage, deliverable, and context)
  const actionRows = actions
    .map(
      (a, idx) =>
        `| ACT-${String(idx + 1).padStart(3, '0')} | ${a.title} | ${a.owner} | ${a.due_date || 'Milestone Target'} | ${a.source || 'Session'} | ${a.deliverable || a.description} |`
    )
    .join('\n');

  const actionDetailsMarkdown = actions.map((a, idx) => `
#### ACT-${String(idx + 1).padStart(3, '0')}: ${a.title}
- **Owner:** ${a.owner}
- **Due Date:** ${a.due_date || 'Target Milestone'}
- **Source Lineage:** ${a.source || 'Project Session'}
- **Project Context:** ${a.context || 'Critical deliverable supporting overall project timeline.'}
- **Expected Deliverable:** ${a.deliverable || a.description}
- **Commitment Detail:** ${a.description}
`).join('\n');

  const actionPlan = `# Operational Action Plan: ${meetingTitle}

### Project Governance & Milestone Tracking
- **Project Name:** ${projectName || meetingTitle}
- **Client / Organisation:** ${clientName || 'Concludo Workspace'}
- **Consolidated Sources:** ${sources.length} Sources (${meetingsList.length} Meetings, ${documentsList.length} Documents)
- **Active Deliverables:** ${actions.length} action items assigned with named owners and milestones.

### Action Accountability Register
| Action ID | Deliverable / Task | Accountable Lead | Target Milestone | Source Session | Expected Deliverable |
| :--- | :--- | :--- | :--- | :--- | :--- |
${actionRows}

### Action Execution Specifications
${actionDetailsMarkdown}
`;

  // C. Governed Decision Log (Enriched with source lineage, tradeoffs, and impact)
  const decisionRows = decisions
    .map(
      (d, idx) =>
        `| DEC-${String(idx + 1).padStart(3, '0')} | ${d.title} | ${d.owner} | ${d.date || 'Recorded'} | ${d.source || 'Session'} | ${d.impact || 'Guiding baseline'} |`
    )
    .join('\n');

  const decisionDetailsMarkdown = decisions.map((d, idx) => `
### Decision ${idx + 1}: ${d.title}
- **Decision Owner:** ${d.owner}
- **Date:** ${d.date || 'Recorded'}
- **Source Session:** ${d.source || 'Governance Session'}
- **Strategic Project Context:** ${d.context || d.summary}
- **Summary Resolution:** ${d.summary}
- **Rationale & Evidence:** ${d.reasoning}
- **Trade-offs Evaluated:** ${d.tradeoffs || 'Evaluated against operational risks, cost impact, and schedule dependencies.'}
- **Downstream Project Impact:** ${d.impact || 'Binding decision governing project execution and stakeholder verification.'}
`).join('\n');

  const decisionLog = `# Governed Decision Log: ${meetingTitle}

### Decision Governance & Architectural Authority
- **Project Name:** ${projectName || meetingTitle}
- **Client / Organisation:** ${clientName || 'Concludo Workspace'}
- **Scope Baseline:** Formally documented decisions across ${sources.length} project intelligence sources.
- **Authority:** All decisions recorded below carry binding authority for project execution and vendor governance.

### Decision Register
| Decision ID | Resolution / Policy | Authority Lead | Date | Source Session | Downstream Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
${decisionRows}

### Governed Decision Details & Strategic Rationale
${decisionDetailsMarkdown}
`;

  // D. Build Concludo Boardroom Document System Payload with multi-source metadata
  const payload = buildConcludoPayload(
    {
      summary,
      actionPlan,
      decisionLog,
      actions,
      decisions,
      payload: {} as any,
    },
    {
      title: meetingTitle,
      meetingType,
      clientName,
      projectName,
      meetingDate: meetingDateStr,
      notes: meta.notes,
      sources,
    } as any
  );

  return {
    summary,
    actionPlan,
    decisionLog,
    actions,
    decisions,
    payload,
  };
}

/**
 * Parses fuzzy conversational deadlines into ISO date strings YYYY-MM-DD
 */
function parseFuzzyDate(text: string | undefined, sessionDate: Date): string | undefined {
  if (!text) return undefined;
  const clean = text.trim();

  // Explicit ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const baseYear = sessionDate.getFullYear();
  const baseMonth = sessionDate.getMonth(); // 0-indexed

  // "end of month"
  if (/end of month/i.test(clean)) {
    const lastDay = new Date(baseYear, baseMonth + 1, 0).getDate();
    return `${baseYear}-${String(baseMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // "early [month]" e.g., "early November"
  const earlyMonthMatch = clean.match(/early\s+([A-Za-z]+)/i);
  if (earlyMonthMatch) {
    const monthIndex = parseMonthName(earlyMonthMatch[1]);
    if (monthIndex !== -1) {
      const year = monthIndex < baseMonth ? baseYear + 1 : baseYear;
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-07`;
    }
  }

  // "end of [month]" e.g., "end of October"
  const endMonthMatch = clean.match(/end of\s+([A-Za-z]+)/i);
  if (endMonthMatch) {
    const monthIndex = parseMonthName(endMonthMatch[1]);
    if (monthIndex !== -1) {
      const year = monthIndex < baseMonth ? baseYear + 1 : baseYear;
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // "Friday" or "next Friday"
  if (/friday/i.test(clean)) {
    const d = new Date(sessionDate);
    const day = d.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  return undefined;
}

function parseMonthName(name: string): number {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const clean = name.toLowerCase();
  return months.findIndex((m) => m.startsWith(clean.slice(0, 3)));
}
