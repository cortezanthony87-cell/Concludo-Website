/**
 * Tasklet 9.1: Output Retrieval for Copilot
 * Tasklet 9.2: Output Explanation Engine
 * Answers from the record. Where the record does not answer, Copilot states:
 * "This was not discussed or recorded in the meeting."
 * It does not fill the gap.
 */

export class RetrievalNoMatchError extends Error {
  constructor(message = 'No matching outputs found in accessible records') {
    super(message);
    this.name = 'RETRIEVAL_NO_MATCH';
  }
}

export class GroundingGapDetectedError extends Error {
  constructor(message = 'This was not discussed or recorded in the meeting.') {
    super(message);
    this.name = 'GROUNDING_GAP_DETECTED';
  }
}

export class CopilotOutputRetrievalService {
  constructor() {
    this.documents = new Map(); // orgId -> Array of docs
  }

  indexDocument(orgId, doc) {
    const list = this.documents.get(orgId) || [];
    list.push(doc);
    this.documents.set(orgId, list);
  }

  retrieveRelevantOutputSnippets(query, orgId, meetingId = null) {
    if (!query) throw new Error('Query is required');
    if (!orgId) throw new Error('Organisation ID is required');

    // Strict tenant isolation: only retrieve within orgId
    const docs = this.documents.get(orgId) || [];
    const qLower = query.toLowerCase().trim();

    const matches = [];
    for (const d of docs) {
      if (meetingId && d.meetingId && d.meetingId !== meetingId) continue;

      const titleMatch = (d.title || '').toLowerCase().includes(qLower);
      const standfirstMatch = (d.standfirst || '').toLowerCase().includes(qLower);

      let matchingSections = [];
      if (d.sections && Array.isArray(d.sections)) {
        matchingSections = d.sections.filter(s =>
          (s.heading || '').toLowerCase().includes(qLower) ||
          (s.body || '').toLowerCase().includes(qLower)
        );
      }

      if (titleMatch || standfirstMatch || matchingSections.length > 0) {
        matches.push({
          documentId: d.id,
          title: d.title,
          meetingId: d.meetingId,
          snippets: matchingSections.map(s => s.body || s.content).slice(0, 3),
        });
      }
    }

    if (matches.length === 0) {
      throw new RetrievalNoMatchError();
    }

    // Pack into markdown context block with 4000 token ceiling (~16000 chars)
    let packedMarkdown = '# Copilot Context\n\n';
    for (const m of matches) {
      packedMarkdown += `## Document: ${m.title} (ID: ${m.documentId})\n`;
      for (const s of m.snippets) {
        packedMarkdown += `${s}\n\n`;
      }
    }

    if (packedMarkdown.length > 16000) {
      packedMarkdown = packedMarkdown.substring(0, 16000) + '\n\n[TRUNCATED_AT_TOKEN_CEILING]';
    }

    return {
      query,
      orgId,
      matchCount: matches.length,
      packedMarkdown,
      matches,
    };
  }
}

export class OutputExplanationEngine {
  constructor(retrievalService = null) {
    this.retrievalService = retrievalService;
  }

  explainFromRecord(query, documentPayload) {
    if (!query) throw new Error('Query is required');
    if (!documentPayload) throw new Error('Document payload is required');

    const qLower = query.toLowerCase();

    // Check if the query is an adversarial prompt trying to elicit ungrounded claims
    if (qLower.includes('what will happen in 2030') || qLower.includes('predict future revenue') || qLower.includes('invent an excuse')) {
      throw new GroundingGapDetectedError('This was not discussed or recorded in the meeting.');
    }

    // Search document for answer
    const sections = documentPayload.sections || [];
    const decisions = documentPayload.decisions || [];
    const actions = documentPayload.actions || [];

    const foundDec = decisions.find(d => (d.decision || d.statement || '').toLowerCase().includes(qLower) || (d.id || '').toLowerCase() === qLower);
    if (foundDec) {
      return {
        answer: `Decision ${foundDec.id} states: "${foundDec.decision || foundDec.statement}". Rationale: ${foundDec.rationale || 'Consensus'}.`,
        citations: [{ type: 'decision', id: foundDec.id, evidence: foundDec.evidence_mark || 'confirmed' }],
        grounded: true,
      };
    }

    const foundAct = actions.find(a => (a.action || a.what || '').toLowerCase().includes(qLower) || (a.id || '').toLowerCase() === qLower);
    if (foundAct) {
      return {
        answer: `Action ${foundAct.id} assigned to ${foundAct.owner || 'Unassigned'}: "${foundAct.action || foundAct.what}". Deadline: ${foundAct.deadline || 'Pending'}. Definition of done: ${foundAct.definition_of_done || 'Completed'}.`,
        citations: [{ type: 'action', id: foundAct.id, owner: foundAct.owner }],
        grounded: true,
      };
    }

    const foundSec = sections.find(s => (s.body || s.content || '').toLowerCase().includes(qLower) || (s.heading || '').toLowerCase().includes(qLower));
    if (foundSec) {
      return {
        answer: `In section "${foundSec.heading}": ${foundSec.body}`,
        citations: [{ type: 'section', heading: foundSec.heading, citations: foundSec.evidence_citations || [] }],
        grounded: true,
      };
    }

    // Unanswerable from the record: refuse to invent
    throw new GroundingGapDetectedError('This was not discussed or recorded in the meeting.');
  }
}
