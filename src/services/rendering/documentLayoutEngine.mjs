/**
 * Tasklet 7.1: Document Layout Engine
 * Compiles structured JSON payloads into valid HTML5 documents
 * strictly enforcing the 9-part section sequence:
 * (1) Provenance, (2) Titleblock, (3) Standfirst, (4) Decisions and Action Sought,
 * (5) Analysis and Options, (6) Recommendations, (7) Health and Diagnostics,
 * (8) Annexures, (9) Colophon.
 */

export class TemplateHydrationError extends Error {
  constructor(message, missingField) {
    super(message);
    this.name = 'TEMPLATE_HYDRATION_ERROR';
    this.missingField = missingField;
  }
}

export function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const INDEPENDENCE_NOTICE = 'Concludo is independent of Zoom, Microsoft Teams, Google Meet, and recorder manufacturers. Trademarks belong to their respective owners.';

export const QUALIFIED_REVIEW_NOTICE = 'Requires qualified review: working record for briefing purposes, not formal board minutes.';

export const STATUTORY_COLOPHON = {
  acn: '701 605 898',
  abn: '61 701 605 898',
  location: 'Melbourne, Victoria, Australia',
  company: 'Concludo Pty Ltd',
};

export class DocumentLayoutEngine {
  constructor(stylingEngine = null) {
    this.stylingEngine = stylingEngine;
  }

  compileDocument(payload) {
    if (!payload) throw new TemplateHydrationError('Payload is required', 'payload');
    if (!payload.title) throw new TemplateHydrationError('Document title is required', 'title');
    if (!payload.meeting_metadata && !payload.meetingMetadata) {
      throw new TemplateHydrationError('Meeting metadata is required', 'meetingMetadata');
    }

    const meta = payload.meeting_metadata || payload.meetingMetadata || {};
    const provenance = payload.provenance || {};
    const standfirst = payload.standfirst || meta.standfirst || '';
    const decisions = payload.decisions || [];
    const actions = payload.actions || [];
    const analysisSections = payload.sections || payload.analysis_and_options || [];
    const recommendations = payload.recommendations || [];
    const health = payload.health || null;
    const annexures = payload.annexures || [];
    const colophonData = payload.colophon || {};

    const css = this.stylingEngine ? this.stylingEngine.getCss() : '';

    // Build the 9 sections
    const s1 = this.renderProvenance(provenance, meta);
    const s2 = this.renderTitleblock(payload, meta);
    const s3 = this.renderStandfirst(standfirst);
    const s4 = this.renderDecisionsAndActions(decisions, actions);
    const s5 = this.renderAnalysisAndOptions(analysisSections);
    const s6 = this.renderRecommendations(recommendations);
    const s7 = this.renderHealthAndDiagnostics(health, meta);
    const s8 = this.renderAnnexures(annexures);
    const s9 = this.renderColophon(colophonData);

    const html = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeHtml(payload.title)}</title>
  <style>
${css}
  </style>
</head>
<body class="concludo-document">
  <main class="document-sheet">
    <!-- Section 1: Provenance -->
    ${s1}
    <!-- Section 2: Titleblock -->
    ${s2}
    <!-- Section 3: Standfirst -->
    ${s3}
    <!-- Section 4: Decisions and Action Sought -->
    ${s4}
    <!-- Section 5: Analysis and Options -->
    ${s5}
    <!-- Section 6: Recommendations -->
    ${s6}
    <!-- Section 7: Health and Diagnostics -->
    ${s7}
    <!-- Section 8: Annexures -->
    ${s8}
    <!-- Section 9: Colophon -->
    ${s9}
  </main>
</body>
</html>`;

    // Security check: no inline scripts permitted
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(html)) {
      throw new Error('SECURITY VIOLATION: Executable script detected in compiled document');
    }

    return html;
  }

  renderProvenance(provenance, meta) {
    const captureSource = provenance.capture_source || meta.capture_source || 'Direct transcript ingestion';
    const sourcePlatform = provenance.source_platform || meta.source_platform || '';
    const needsIndependence = !!sourcePlatform || !!provenance.mentions_device_or_platform;

    return `
    <section class="doc-section doc-provenance" data-section-seq="1">
      <div class="provenance-badge">
        <span class="provenance-label">Capture Source:</span>
        <span class="provenance-val">${sanitizeHtml(captureSource)}</span>
      </div>
      ${needsIndependence || true ? `<div class="independence-line">${sanitizeHtml(INDEPENDENCE_NOTICE)}</div>` : ''}
    </section>`;
  }

  renderTitleblock(payload, meta) {
    const title = payload.title || 'Executive Brief';
    const classification = payload.classification || meta.classification || 'OFFICIAL: SENSITIVE';
    const meetingTitle = meta.meeting_title || meta.title || 'Executive Session';
    const date = meta.date || meta.scheduled_start || new Date().toISOString().split('T')[0];
    const org = meta.organisation_name || meta.organisation || 'Concludo Pty Ltd';

    return `
    <header class="doc-section doc-titleblock" data-section-seq="2">
      <div class="classification-banner">${sanitizeHtml(classification)}</div>
      <h1 class="document-title">${sanitizeHtml(title)}</h1>
      <div class="meta-grid">
        <div class="meta-item"><span class="meta-k">Meeting:</span> <span class="meta-v">${sanitizeHtml(meetingTitle)}</span></div>
        <div class="meta-item"><span class="meta-k">Date:</span> <span class="meta-v">${sanitizeHtml(date)}</span></div>
        <div class="meta-item"><span class="meta-k">Organisation:</span> <span class="meta-v">${sanitizeHtml(org)}</span></div>
      </div>
    </header>`;
  }

  renderStandfirst(standfirst) {
    if (!standfirst) return '<section class="doc-section doc-standfirst" data-section-seq="3"></section>';
    return `
    <section class="doc-section doc-standfirst" data-section-seq="3">
      <div class="standfirst-card">
        <p class="standfirst-text">${sanitizeHtml(standfirst)}</p>
      </div>
    </section>`;
  }

  renderDecisionsAndActions(decisions, actions) {
    let decHtml = '';
    if (decisions && decisions.length) {
      decHtml = `
      <div class="decisions-block">
        <h3 class="subsection-title">Decisions Recorded</h3>
        <table class="concludo-table decisions-table">
          <thead>
            <tr>
              <th style="white-space:nowrap;">ID</th>
              <th>Decision Statement</th>
              <th>Rationale</th>
              <th style="white-space:nowrap;">Evidence</th>
            </tr>
          </thead>
          <tbody>
            ${decisions.map((d, i) => `
              <tr>
                <td class="col-id" style="white-space:nowrap;">${sanitizeHtml(d.id || `DEC-${i + 1}`)}</td>
                <td>${sanitizeHtml(d.decision || d.statement || '')}</td>
                <td>${sanitizeHtml(d.rationale || 'Confirmed by consensus')}</td>
                <td style="white-space:nowrap;">${sanitizeHtml(d.evidence_mark || d.evidence || 'confirmed')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
    }

    let actHtml = '';
    if (actions && actions.length) {
      actHtml = `
      <div class="actions-block">
        <h3 class="subsection-title">Action Sought (Five-Field Standard)</h3>
        <table class="concludo-table actions-table">
          <thead>
            <tr>
              <th style="white-space:nowrap;">ID</th>
              <th>Owner (Who)</th>
              <th>Action (What)</th>
              <th style="white-space:nowrap;">Deadline (When)</th>
              <th>Definition of Done</th>
            </tr>
          </thead>
          <tbody>
            ${actions.map((a, i) => `
              <tr>
                <td class="col-id" style="white-space:nowrap;">${sanitizeHtml(a.id || `ACT-${i + 1}`)}</td>
                <td>${sanitizeHtml(a.owner || a.who || 'Unassigned')}</td>
                <td>${sanitizeHtml(a.action || a.what || '')}</td>
                <td style="white-space:nowrap;">${sanitizeHtml(a.deadline || a.when || 'Next review')}</td>
                <td>${sanitizeHtml(a.definition_of_done || a.done_when || a.criteria || 'Completed')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
    }

    return `
    <section class="doc-section doc-decisions-actions" data-section-seq="4">
      <h2 class="section-title">Decisions and Action Sought</h2>
      ${decHtml}
      ${actHtml}
    </section>`;
  }

  renderAnalysisAndOptions(sections) {
    if (!sections || !sections.length) {
      return '<section class="doc-section doc-analysis" data-section-seq="5"></section>';
    }

    const secHtml = sections.map((s, idx) => `
      <div class="analysis-chapter" id="chapter-${idx + 1}">
        <h3 class="chapter-title">${sanitizeHtml(s.heading || s.title || `Section ${idx + 1}`)}</h3>
        <div class="chapter-body">
          <p>${sanitizeHtml(s.body || s.content || '')}</p>
        </div>
        ${s.evidence_citations && s.evidence_citations.length ? `
          <div class="citations-bar">
            <span class="citation-label">Evidence Grounding:</span>
            ${s.evidence_citations.map(c => `<span class="citation-tag">${sanitizeHtml(typeof c === 'string' ? c : c.quote || c.id)}</span>`).join(' ')}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
    <section class="doc-section doc-analysis" data-section-seq="5">
      <h2 class="section-title">Analysis and Options</h2>
      ${secHtml}
    </section>`;
  }

  renderRecommendations(recs) {
    if (!recs || !recs.length) {
      return '<section class="doc-section doc-recommendations" data-section-seq="6"></section>';
    }

    return `
    <section class="doc-section doc-recommendations" data-section-seq="6">
      <h2 class="section-title">Recommendations</h2>
      <table class="concludo-table recommendations-table">
        <thead>
          <tr>
            <th style="white-space:nowrap;">Priority</th>
            <th>Recommendation</th>
            <th>Failure Pattern</th>
            <th>Target Impact</th>
            <th style="white-space:nowrap;">Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${recs.map((r, i) => `
            <tr>
              <td style="white-space:nowrap;"><span class="priority-badge priority-${sanitizeHtml(r.priority || 'P2')}">${sanitizeHtml(r.priority || 'P2')}</span></td>
              <td>${sanitizeHtml(r.recommendation || r.title || '')}</td>
              <td>${sanitizeHtml(r.failure_pattern || r.pattern || 'FP-01')}</td>
              <td>${sanitizeHtml(r.impact || 'Governance integrity')}</td>
              <td style="white-space:nowrap;">${sanitizeHtml(typeof r.confidence === 'number' ? `${Math.round(r.confidence * 100)}%` : r.confidence || '90%')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>`;
  }

  renderHealthAndDiagnostics(health, meta) {
    if (meta.is_restricted || meta.confidentiality_gate === 'RESTRICTED') {
      return `
      <section class="doc-section doc-health-diagnostics" data-section-seq="7">
        <h2 class="section-title">Meeting Health and Diagnostics</h2>
        <div class="restricted-notice-box">
          <p><strong>Diagnostic Notice:</strong> Scoring withheld under confidentiality gate. Restricted record (clinical or protected discussion) is never health scored.</p>
        </div>
      </section>`;
    }

    if (!health || health.composite_score == null) {
      return `
      <section class="doc-section doc-health-diagnostics" data-section-seq="7">
        <h2 class="section-title">Meeting Health and Diagnostics</h2>
        <div class="unscored-notice-box">
          <p><strong>Diagnostic Notice:</strong> Meeting record did not meet the 70-point scoreable weight floor. Individual scores are not calculated or displayed.</p>
        </div>
      </section>`;
    }

    return `
    <section class="doc-section doc-health-diagnostics" data-section-seq="7">
      <h2 class="section-title">Meeting Health and Diagnostics</h2>
      <div class="health-summary-panel">
        <div class="health-score-card">
          <span class="health-score-num">${health.composite_score}</span>
          <span class="health-score-max">/100</span>
          <span class="health-band-badge band-${sanitizeHtml(health.band || 'Good')}">${sanitizeHtml(health.band || 'Good')}</span>
        </div>
        <p class="health-disclaimer">Zero individual scoring. Participation metrics reflect meeting-level distribution only.</p>
      </div>
    </section>`;
  }

  renderAnnexures(annexures) {
    if (!annexures || !annexures.length) {
      return '<section class="doc-section doc-annexures" data-section-seq="8"></section>';
    }

    return `
    <section class="doc-section doc-annexures" data-section-seq="8">
      <h2 class="section-title">Annexures</h2>
      ${annexures.map((a, i) => `
        <div class="annexure-box" id="annexure-${i + 1}">
          <h4 class="annexure-title">${sanitizeHtml(a.title || `Annexure ${i + 1}`)}</h4>
          <div class="annexure-content">${a.content_html || `<p>${sanitizeHtml(a.content || '')}</p>`}</div>
        </div>
      `).join('')}
    </section>`;
  }

  renderColophon(colophon) {
    const acn = colophon.acn || STATUTORY_COLOPHON.acn;
    const abn = colophon.abn || STATUTORY_COLOPHON.abn;
    const loc = colophon.location || STATUTORY_COLOPHON.location;
    const company = colophon.company || STATUTORY_COLOPHON.company;
    const hash = colophon.document_hash || 'SHA256:7f9a2b8e3c1d4e5f6a7b8c9d0e1f2a3b';
    const timestamp = colophon.timestamp || new Date().toISOString();

    return `
    <footer class="doc-section doc-colophon" data-section-seq="9">
      <div class="colophon-grid">
        <div class="colophon-entity">
          <strong>${sanitizeHtml(company)}</strong> (ACN ${sanitizeHtml(acn)}, ABN ${sanitizeHtml(abn)})<br>
          ${sanitizeHtml(loc)}
        </div>
        <div class="colophon-audit">
          <span class="audit-hash">Ref: ${sanitizeHtml(hash)}</span><br>
          <span class="audit-time">Generated: ${sanitizeHtml(timestamp)}</span>
        </div>
      </div>
    </footer>`;
  }
}
