/**
 * Tasklet 7.6: Report Export Engine
 * Exports compiled deliverables in secondary formats:
 * Microsoft Word (.docx), Markdown (.md), and raw JSON.
 * Pro subscription required for DOCX; Starter includes PDF and Markdown.
 */

export class ConversionError extends Error {
  constructor(message, format) {
    super(message);
    this.name = 'CONVERSION_ERROR';
    this.format = format;
  }
}

export class ReportExportService {
  constructor(options = {}) {
    this.entitlementResolver = options.entitlementResolver || null;
  }

  canExportDocx(tier) {
    // Pro subscription and Team subscription can export DOCX; Starter cannot
    return tier === 'pro_subscription' || tier === 'team';
  }

  exportMarkdown(payload) {
    if (!payload) throw new ConversionError('Payload required for Markdown export', 'markdown');

    const meta = payload.meeting_metadata || payload.meetingMetadata || {};
    const title = payload.title || 'Executive Brief';
    const lines = [];

    lines.push(`# ${title}`);
    lines.push(`**Meeting:** ${meta.meeting_title || 'Executive Session'} | **Date:** ${meta.date || new Date().toISOString().split('T')[0]}`);
    lines.push(`**Classification:** ${payload.classification || 'OFFICIAL: SENSITIVE'}`);
    lines.push('');

    if (payload.standfirst) {
      lines.push(`> ${payload.standfirst}`);
      lines.push('');
    }

    if (payload.decisions && payload.decisions.length) {
      lines.push('## Decisions Recorded');
      lines.push('| ID | Decision Statement | Rationale | Evidence |');
      lines.push('|---|---|---|---|');
      for (const d of payload.decisions) {
        lines.push(`| ${d.id || 'DEC'} | ${d.decision || d.statement || ''} | ${d.rationale || 'Consensus'} | ${d.evidence_mark || 'confirmed'} |`);
      }
      lines.push('');
    }

    if (payload.actions && payload.actions.length) {
      lines.push('## Action Sought (Five-Field Standard)');
      lines.push('| ID | Owner (Who) | Action (What) | Deadline (When) | Definition of Done |');
      lines.push('|---|---|---|---|---|');
      for (const a of payload.actions) {
        lines.push(`| ${a.id || 'ACT'} | ${a.owner || a.who || 'Unassigned'} | ${a.action || a.what || ''} | ${a.deadline || a.when || 'Next review'} | ${a.definition_of_done || 'Completed'} |`);
      }
      lines.push('');
    }

    if (payload.sections && payload.sections.length) {
      lines.push('## Analysis and Options');
      for (const s of payload.sections) {
        lines.push(`### ${s.heading || s.title}`);
        lines.push(s.body || s.content || '');
        if (s.evidence_citations && s.evidence_citations.length) {
          lines.push(`*Evidence:* ${s.evidence_citations.join(', ')}`);
        }
        lines.push('');
      }
    }

    if (payload.recommendations && payload.recommendations.length) {
      lines.push('## Recommendations');
      lines.push('| Priority | Recommendation | Pattern | Impact |');
      lines.push('|---|---|---|---|');
      for (const r of payload.recommendations) {
        lines.push(`| ${r.priority || 'P2'} | ${r.recommendation || r.title || ''} | ${r.failure_pattern || 'FP-01'} | ${r.impact || 'Governance'} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*Requires qualified review: working record for briefing purposes, not formal board minutes.*');
    lines.push('*Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898) | Melbourne, Victoria, Australia*');

    return lines.join('\n');
  }

  exportDocx(payload, userTier = 'starter') {
    if (!this.canExportDocx(userTier)) {
      throw new Error(`SUBSCRIPTION REQUIRED: DOCX export requires a Pro subscription or Team subscription. Current tier: ${userTier}`);
    }
    if (!payload) throw new ConversionError('Payload required for DOCX export', 'docx');

    // Deterministic XML-based WordprocessingML generation
    const md = this.exportMarkdown(payload);
    const escapedXml = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${escapedXml.replace(/\n/g, '</w:t></w:r></w:p><w:p><w:r><w:t>')}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

    return Buffer.from(docxXml, 'utf8');
  }

  exportJson(payload) {
    if (!payload) throw new ConversionError('Payload required for JSON export', 'json');
    return JSON.stringify(payload, null, 2);
  }
}
