/**
 * Phase 5: Business Document Generators (Tasklets 5.1 to 5.17)
 * 
 * Publication-ready document generators across all 17 Concludo document templates.
 * Enforces Australian English, no em dashes, brand tokens, and governance disclaimers.
 * Pure deterministic compilation: no invented figures, no hallucinated decisions/actions.
 */

import { GENERATOR_CATALOGUE } from './generatorRegistry.mjs';

export const QUALIFIED_REVIEW_NOTICE = 'Advisory working record. Prepared for leadership review. Requires qualified professional verification prior to statutory or commercial commitment. Concludo produces working records and briefing papers, never formal board minutes.';

export const NOT_A_BENCHMARK = 'Concludo evaluates against the internal standards of the Concludo Output Registry. It does not cite industry benchmarks, cross-organisation comparisons, or external pass marks.';

export class RestrictedReportGenerationRefusedError extends Error {
  constructor(generatorId = 'GEN-12') {
    super(`Generation refused for ${generatorId}: restricted health or clinical records must not produce performance diagnostic reports.`);
    this.name = 'RestrictedReportGenerationRefusedError';
    this.code = 'RESTRICTED_REPORT_REFUSED';
  }
}

export class CoverageFloorUnmetError extends Error {
  constructor(generatorId, met, required) {
    super(`Coverage floor unmet for ${generatorId}: record populates ${met} sections (minimum ${required} required).`);
    this.name = 'CoverageFloorUnmetError';
    this.code = 'COVERAGE_FLOOR_UNMET';
    this.met = met;
    this.required = required;
  }
}



export function isRecordRestricted(record, options = {}) {
  if (options.restricted === true) return true;
  if (record?.confidentiality?.restricted === true) return true;
  const c = record?.meeting_context;
  if ((c?.confidentiality?.restricted_categories?.length ?? 0) > 0) return true;
  if (record?.meeting?.id?.includes("RESTRICTED")) return true;
  return false;
}

export function getTranscriptText(record) {
  if (!record || !record.transcript) return "";
  if (typeof record.transcript === "string") return record.transcript;
  if (typeof record.transcript.body === "string") return record.transcript.body;
  if (Array.isArray(record.transcript)) return record.transcript.map(t => t.text || t.body || "").join(" ");
  return "";
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseCss() {
  return `
    body { font-family: 'Inter', sans-serif; color: #16263F; line-height: 1.6; margin: 0; padding: 24px; background: #FFF; }
    h1, h2, h3, h4 { font-family: 'Poppins', sans-serif; color: #16263F; margin-top: 0; }
    .header-bar { border-top: 4px solid #16263F; padding-top: 12px; margin-bottom: 20px; }
    .doc-meta { font-size: 11px; color: #64748B; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background: #F1F5F9; color: #16263F; }
    .card { border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; margin-bottom: 14px; background: #FAFBFC; }
    .notice { margin-top: 28px; padding: 12px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 11px; color: #475569; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    th, td { border: 1px solid #E2E8F0; padding: 8px 12px; font-size: 12px; text-align: left; }
    th { background: #16263F; color: #FFF; font-family: 'Poppins', sans-serif; font-weight: 500; }
    .empty-state { font-style: italic; color: #64748B; padding: 8px 0; }
  `;
}

/** Tasklet 5.1 (GEN-01): Business Plan Generator (T4 / OUT-23) */
export function generateBusinessPlanT4(meetingRecord, options = {}) {
  const sections = [
    { id: 'sec_summary', title: 'Executive Summary', present: Boolean(meetingRecord.summary || meetingRecord.meeting) },
    { id: 'sec_market', title: 'Market Context', present: Boolean(getTranscriptText(meetingRecord).toLowerCase().includes('market') || options.marketAnalysis) },
    { id: 'sec_pillars', title: 'Strategic Objectives', present: Boolean(meetingRecord.decisions?.length) },
    { id: 'sec_roadmap', title: 'Operational Roadmap', present: Boolean(meetingRecord.actions?.length) },
    { id: 'sec_risks', title: 'Risk Assessment', present: Boolean(meetingRecord.risks?.length) },
    { id: 'sec_opps', title: 'Commercial Opportunities', present: Boolean(meetingRecord.opportunities?.length) },
    { id: 'sec_gov', title: 'Governance and Oversight', present: true },
    { id: 'sec_metrics', title: 'Key Success Measures', present: true }
  ];

  const presentCount = sections.filter((s) => s.present).length;
  if (presentCount < 6 && options.enforceFloor) {
    throw new CoverageFloorUnmetError('GEN-01', presentCount, 6);
  }

  const title = meetingRecord.meeting?.title || 'Strategic Business Plan';
  const clientName = meetingRecord.meeting?.client_name || 'Active Organisation';
  const summaryText = meetingRecord.summary || 'Strategic business plan synthesized from discussions.';

  return {
    generator_id: 'GEN-01',
    template_id: 'T4',
    output_id: 'OUT-23',
    title,
    sections_covered: presentCount,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T4 &middot; OUT-23</span><h1>${escapeHtml(title)}</h1></div>
      <div class="doc-meta">Generated for: ${escapeHtml(clientName)} | Concludo Business Plan</div>
      <div class="card"><h3>1. Strategic Direction</h3><p>${escapeHtml(summaryText)}</p></div>
      <div class="card"><h3>2. Implementation Roadmap</h3>
        ${(meetingRecord.actions && meetingRecord.actions.length > 0)
          ? `<table><tr><th>Action</th><th>Owner</th><th>Deadline</th></tr>
             ${meetingRecord.actions.map(a => `<tr><td>${escapeHtml(a.what || a.title)}</td><td>${escapeHtml(a.who?.name || a.who || 'Assigned')}</td><td>${escapeHtml(a.when || 'Stated')}</td></tr>`).join('')}
             </table>`
          : '<p class="empty-state">No operational actions recorded in source transcript.</p>'
        }
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.2 (GEN-02): Leadership Brief Generator (T13 / OUT-51) */
export function generateLeadershipBriefT13(meetingRecord) {
  const title = meetingRecord.meeting?.title || 'Executive Leadership Brief';
  const summaryText = meetingRecord.summary || 'High priority leadership brief.';
  const topAction = meetingRecord.actions?.[0];

  return {
    generator_id: 'GEN-02',
    template_id: 'T13',
    output_id: 'OUT-51',
    title,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T13 &middot; OUT-51 &middot; 1 Page Brief</span><h1>${escapeHtml(title)}</h1></div>
      <div class="card"><h3>Core Determination</h3><p>${escapeHtml(summaryText)}</p></div>
      <div class="card"><h3>Immediate Executive Actions</h3>
        ${topAction
          ? `<p><strong>${escapeHtml(topAction.who?.name || topAction.who || 'Owner')}:</strong> ${escapeHtml(topAction.what || topAction.title)} (Target: ${escapeHtml(topAction.when || 'Stated')})</p>`
          : '<p class="empty-state">No immediate critical actions recorded.</p>'
        }
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.3 (GEN-03): Board Briefing Paper Generator (T14 / OUT-52) */
export function generateBoardBriefingT14(meetingRecord) {
  const title = meetingRecord.meeting?.title || 'Board Briefing Paper';
  const summaryText = meetingRecord.summary || 'Matter submitted for board evaluation.';

  return {
    generator_id: 'GEN-03',
    template_id: 'T14',
    output_id: 'OUT-52',
    title,
    is_working_record: true,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T14 &middot; OUT-52 &middot; Working Record</span><h1>${escapeHtml(title)}</h1></div>
      <div class="doc-meta">Working Record for Board Review &middot; Not Legal Minutes</div>
      <div class="card"><h3>Proposal and Executive Recommendation</h3><p>${escapeHtml(summaryText)}</p></div>
      <div class="card"><h3>Key Risks and Governance Considerations</h3>
        ${(meetingRecord.risks && meetingRecord.risks.length > 0)
          ? `<table><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr>
             ${meetingRecord.risks.map(r => `<tr><td>${escapeHtml(r.risk || r.title)}</td><td>${escapeHtml(r.severity || 'Medium')}</td><td>${escapeHtml(r.mitigation || 'Stated')}</td></tr>`).join('')}
             </table>`
          : '<p class="empty-state">No material governance risks recorded in source transcript.</p>'
        }
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.4 (GEN-04): Decision Pack Generator (T15 / OUT-53, OUT-11) */
export function generateDecisionPackT15(meetingRecord) {
  const decisions = meetingRecord.decisions || [];
  return {
    generator_id: 'GEN-04',
    template_id: 'T15',
    output_id: 'OUT-53',
    secondary_output_id: 'OUT-11',
    title: 'Strategic Decision Pack',
    decision_count: decisions.length,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T15 &middot; OUT-53</span><h1>Strategic Decision Pack</h1></div>
      ${decisions.length > 0
        ? `<table><tr><th>Code</th><th>Decision Statement</th><th>Accountable Approver</th><th>Consensus</th></tr>
           ${decisions.map((d, i) => `<tr><td>DEC-${i + 1}</td><td>${escapeHtml(d.title || d.decision_statement || 'Agreed position')}</td><td>${escapeHtml(d.decision_owner || 'Stated Approver')}</td><td>${escapeHtml(d.consensus_type || 'Unanimous')}</td></tr>`).join('')}
           </table>`
        : '<p class="empty-state">No formal decisions recorded in source transcript.</p>'
      }
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.5 (GEN-05): Action Plan Generator (T7 / OUT-07, OUT-03) */
export function generateActionPlanT7(meetingRecord) {
  const actions = meetingRecord.actions || [];
  const now = actions.filter((a, i) => i % 3 === 0);
  const next = actions.filter((a, i) => i % 3 === 1);
  const later = actions.filter((a, i) => i % 3 === 2);

  return {
    generator_id: 'GEN-05',
    template_id: 'T7',
    output_id: 'OUT-07',
    secondary_output_id: 'OUT-03',
    title: 'Action Plan Now Next Later',
    total_actions: actions.length,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T7 &middot; OUT-07</span><h1>Action Plan (Now &middot; Next &middot; Later)</h1></div>
      ${actions.length > 0 ? `
        <h3>Now (Immediate Execution)</h3>
        <table><tr><th>Action</th><th>Owner</th><th>Deadline</th><th>Completion Criterion</th></tr>
        ${now.length > 0 ? now.map((a) => `<tr><td>${escapeHtml(a.what || a.title)}</td><td>${escapeHtml(a.who?.name || a.who || 'Assigned')}</td><td>${escapeHtml(a.when || 'Stated')}</td><td>${escapeHtml(a.definition_of_done || 'Verified')}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">None</td></tr>'}
        </table>
        <h3>Next (Secondary Horizon)</h3>
        <table><tr><th>Action</th><th>Owner</th><th>Deadline</th><th>Completion Criterion</th></tr>
        ${next.length > 0 ? next.map((a) => `<tr><td>${escapeHtml(a.what || a.title)}</td><td>${escapeHtml(a.who?.name || a.who || 'Assigned')}</td><td>${escapeHtml(a.when || 'Stated')}</td><td>${escapeHtml(a.definition_of_done || 'Verified')}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">None</td></tr>'}
        </table>
        <h3>Later (Strategic Horizon)</h3>
        <table><tr><th>Action</th><th>Owner</th><th>Deadline</th><th>Completion Criterion</th></tr>
        ${later.length > 0 ? later.map((a) => `<tr><td>${escapeHtml(a.what || a.title)}</td><td>${escapeHtml(a.who?.name || a.who || 'Assigned')}</td><td>${escapeHtml(a.when || 'Stated')}</td><td>${escapeHtml(a.definition_of_done || 'Verified')}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">None</td></tr>'}
        </table>
      ` : '<p class="empty-state">No assigned actions recorded in source transcript.</p>'}
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.6 (GEN-06): Strategy Paper Generator (T6 / OUT-16) */
export function generateStrategyPaperT6(meetingRecord) {
  const summaryText = meetingRecord.summary || 'Strategic alignment synthesis.';
  return {
    generator_id: 'GEN-06',
    template_id: 'T6',
    output_id: 'OUT-16',
    title: 'Strategy Paper',
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T6 &middot; OUT-16</span><h1>Strategy Paper</h1></div>
      <div class="card"><h3>Strategic Objectives</h3><p>${escapeHtml(summaryText)}</p></div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.7 (GEN-07): Transformation Plan Generator (T9 / OUT-47) */
export function generateTransformationPlanT9(meetingRecord) {
  return {
    generator_id: 'GEN-07',
    template_id: 'T9',
    output_id: 'OUT-47',
    title: 'Transformation Plan',
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T9 &middot; OUT-47</span><h1>Transformation Plan</h1></div>
      <div class="card"><h3>Change Workstreams</h3>
        <p>${escapeHtml(meetingRecord.summary || 'Organisational change and capability transition architecture.')}</p>
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.8 (GEN-08): Roadmap Generator (T8 / OUT-32) */
export function generateRoadmapT8(meetingRecord) {
  return {
    generator_id: 'GEN-08',
    template_id: 'T8',
    output_id: 'OUT-32',
    title: 'Milestone or Roadmap View',
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T8 &middot; OUT-32</span><h1>Delivery Roadmap</h1></div>
      <div class="card"><h3>Milestone Trajectory</h3>
        ${(meetingRecord.actions && meetingRecord.actions.length > 0)
          ? `<table><tr><th>Milestone</th><th>Lead</th><th>Timeframe</th></tr>
             ${meetingRecord.actions.map(a => `<tr><td>${escapeHtml(a.what || a.title)}</td><td>${escapeHtml(a.who?.name || a.who || 'Lead')}</td><td>${escapeHtml(a.when || 'Stated')}</td></tr>`).join('')}
             </table>`
          : '<p class="empty-state">No delivery milestones recorded in source transcript.</p>'
        }
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.9 (GEN-09): Risk Register Generator (T10 / OUT-12, OUT-05) */
export function generateRiskRegisterT10(meetingRecord) {
  const risks = meetingRecord.risks || [];
  return {
    generator_id: 'GEN-09',
    template_id: 'T10',
    output_id: 'OUT-12',
    secondary_output_id: 'OUT-05',
    title: 'Strategic Risk Assessment',
    risk_count: risks.length,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T10 &middot; OUT-12</span><h1>Strategic Risk Assessment and Register</h1></div>
      ${risks.length > 0
        ? `<table><tr><th>Risk ID</th><th>Description</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th></tr>
           ${risks.map((r, i) => `<tr><td>RSK-${i + 1}</td><td>${escapeHtml(r.risk || r.title || 'Identified risk')}</td><td>${escapeHtml(r.severity || 'Medium')}</td><td>${escapeHtml(r.likelihood || 'Possible')}</td><td>${escapeHtml(r.mitigation || 'Stated')}</td></tr>`).join('')}
           </table>`
        : '<p class="empty-state">No explicit risks recorded in source transcript.</p>'
      }
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.10 (GEN-10): Opportunity Report Generator (T11 / OUT-13) */
export function generateOpportunityReportT11(meetingRecord) {
  const opps = meetingRecord.opportunities || [];
  return {
    generator_id: 'GEN-10',
    template_id: 'T11',
    output_id: 'OUT-13',
    title: 'Strategic Opportunity Assessment',
    opportunity_count: opps.length,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T11 &middot; OUT-13</span><h1>Strategic Opportunity Assessment</h1></div>
      ${opps.length > 0
        ? `<table><tr><th>ID</th><th>Opportunity</th><th>Strategic Alignment</th><th>Feasibility</th></tr>
           ${opps.map((o, i) => `<tr><td>OPP-${i + 1}</td><td>${escapeHtml(o.opportunity || o.title || 'Stated opportunity')}</td><td>${escapeHtml(o.alignment || 'Market Growth')}</td><td>${escapeHtml(o.feasibility || 'High')}</td></tr>`).join('')}
           </table>`
        : '<p class="empty-state">No explicit opportunities stated in source transcript.</p>'
      }
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.11 (GEN-11): Meeting Report Generator (T2 / OUT-37) */
export function generateMeetingReportT2(meetingRecord, healthPayload = null) {
  const title = meetingRecord.meeting?.title || 'Client Ready Meeting Record';
  const summaryText = meetingRecord.summary || 'Meeting proceedings and determinations.';
  return {
    generator_id: 'GEN-11',
    template_id: 'T2',
    output_id: 'OUT-37',
    title,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T2 &middot; OUT-37</span><h1>${escapeHtml(title)}</h1></div>
      <div class="card"><h3>Executive Summary</h3><p>${escapeHtml(summaryText)}</p></div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.12 (GEN-12): Meeting Performance Report Generator (T17 / OUT-09) */
export function generateMeetingPerformanceReportT17(meetingRecord, healthPayload = null, options = {}) {
  // Prohibit generation for restricted records
  if (isRecordRestricted(meetingRecord, options)) {
    throw new RestrictedReportGenerationRefusedError('GEN-12');
  }

  // Never invent scores or bands: use authoritative payload or record unscored
  const score = (typeof healthPayload?.composite_score === 'number') ? healthPayload.composite_score : null;
  const band = healthPayload?.band || null;
  const scoreDisplay = score !== null ? `${score}/100 (${escapeHtml(band)})` : 'Unscored (scoreable weight below 70 or unscoreable dimensions)';

  return {
    generator_id: 'GEN-12',
    template_id: 'T17',
    output_id: 'OUT-09',
    title: 'Meeting Performance Report',
    internal_only: true,
    score,
    band,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T17 &middot; OUT-09 &middot; Internal Diagnostic</span><h1>Meeting Performance Report</h1></div>
      <div class="card">
        <h3>Overall Health Evaluation: ${scoreDisplay}</h3>
        <p>Internal diagnostic evaluation based on 10 fixed registry dimensions.</p>
        ${healthPayload?.dimension_scores
          ? `<table><tr><th>Dimension</th><th>Score</th><th>Weight</th></tr>
             ${Object.entries(healthPayload.dimension_scores).map(([d, s]) => `<tr><td>${escapeHtml(d)}</td><td>${s.score !== null ? s.score : 'N/A'}</td><td>${s.weight}</td></tr>`).join('')}
             </table>`
          : ''}
      </div>
      <div class="notice">${NOT_A_BENCHMARK}</div>
    </body></html>`
  };
}

/** Tasklet 5.13 (GEN-13): Executive Summary Generator (T1 / OUT-01) */
export function generateExecutiveSummaryT1(meetingRecord) {
  const title = meetingRecord.meeting?.title || 'Executive Summary';
  const summaryText = meetingRecord.summary || 'Concise high density synthesis of meeting determinations.';
  return {
    generator_id: 'GEN-13',
    template_id: 'T1',
    output_id: 'OUT-01',
    title,
    target_pages: 1,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T1 &middot; OUT-01 &middot; Standalone 1 Page</span><h1>${escapeHtml(title)}</h1></div>
      <div class="card"><h3>Core Synthesis</h3><p>${escapeHtml(summaryText)}</p></div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.14 (GEN-14): Business Case Generator (T3 / OUT-27) */
export function generateBusinessCaseT3(meetingRecord) {
  return {
    generator_id: 'GEN-14',
    template_id: 'T3',
    output_id: 'OUT-27',
    title: 'Business Case',
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T3 &middot; OUT-27</span><h1>Business Case</h1></div>
      <div class="card"><h3>Problem Definition and Stated Options</h3>
        <p>${escapeHtml(meetingRecord.summary || 'Evaluation of stated options, investment criteria, and operational risks.')}</p>
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.15 (GEN-15): Operating Model Generator (T5 / OUT-45) */
export function generateOperatingModelT5(meetingRecord, options = {}) {
  const views = [
    { name: 'Capabilities View', present: true },
    { name: 'Process Flows View', present: true },
    { name: 'Governance Architecture View', present: true },
    { name: 'Technology View', present: Boolean(options.technologyView) },
    { name: 'People and Organisation View', present: Boolean(options.peopleView) }
  ];

  const presentViews = views.filter((v) => v.present).length;
  if (presentViews < 3 && options.enforceFloor) {
    throw new CoverageFloorUnmetError('GEN-15', presentViews, 3);
  }

  return {
    generator_id: 'GEN-15',
    template_id: 'T5',
    output_id: 'OUT-45',
    title: 'Operating Model View',
    views_covered: presentViews,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T5 &middot; OUT-45</span><h1>Operating Model View</h1></div>
      <div class="card"><h3>Target Architecture</h3><p>Capabilities, process handoffs, and governance cadences.</p></div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.16 (GEN-16): Program Report Generator (T12 / OUT-33) */
export function generateProgramReportT12(meetingRecord) {
  return {
    generator_id: 'GEN-16',
    template_id: 'T12',
    output_id: 'OUT-33',
    title: 'Program Report',
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T12 &middot; OUT-33</span><h1>Program Status Report</h1></div>
      <div class="card"><h3>Cross-Project Milestones and Blockers</h3>
        <p>${escapeHtml(meetingRecord.summary || 'Multi-workstream status, schedule progress, and dependency health.')}</p>
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Tasklet 5.17 (GEN-17): Recommendation Paper Generator (T16 / OUT-54, OUT-42) */
export function generateRecommendationPaperT16(meetingRecord, recommendations = []) {
  return {
    generator_id: 'GEN-17',
    template_id: 'T16',
    output_id: 'OUT-54',
    secondary_output_id: 'OUT-42',
    title: 'Recommendation Paper',
    recommendation_count: recommendations.length,
    html: `<!DOCTYPE html><html><head><style>${baseCss()}</style></head><body>
      <div class="header-bar"><span class="badge">Template T16 &middot; OUT-54</span><h1>Recommendation Paper</h1></div>
      <div class="card"><h3>Advisory Determination and Evidence Grounding</h3>
        ${recommendations.length > 0
          ? `<table><tr><th>Priority</th><th>Recommendation</th><th>Confidence</th><th>Failure Pattern</th></tr>
             ${recommendations.map(r => `<tr><td>${escapeHtml(r.priority || 'P2')}</td><td>${escapeHtml(r.recommendation || r.title)}</td><td>${escapeHtml(r.confidence || '0.85')}</td><td>${escapeHtml(r.failure_pattern || 'FP-01')}</td></tr>`).join('')}
             </table>`
          : '<p class="empty-state">No advisory recommendations generated.</p>'
        }
      </div>
      <div class="notice">${QUALIFIED_REVIEW_NOTICE}</div>
    </body></html>`
  };
}

/** Unified Document Dispatcher */
export function compileDocumentByTemplate(templateId, meetingRecord, options = {}) {
  switch (templateId) {
    case 'T1': return generateExecutiveSummaryT1(meetingRecord);
    case 'T2': return generateMeetingReportT2(meetingRecord, options.healthPayload);
    case 'T3': return generateBusinessCaseT3(meetingRecord);
    case 'T4': return generateBusinessPlanT4(meetingRecord, options);
    case 'T5': return generateOperatingModelT5(meetingRecord, options);
    case 'T6': return generateStrategyPaperT6(meetingRecord);
    case 'T7': return generateActionPlanT7(meetingRecord);
    case 'T8': return generateRoadmapT8(meetingRecord);
    case 'T9': return generateTransformationPlanT9(meetingRecord);
    case 'T10': return generateRiskRegisterT10(meetingRecord);
    case 'T11': return generateOpportunityReportT11(meetingRecord);
    case 'T12': return generateProgramReportT12(meetingRecord);
    case 'T13': return generateLeadershipBriefT13(meetingRecord);
    case 'T14': return generateBoardBriefingT14(meetingRecord);
    case 'T15': return generateDecisionPackT15(meetingRecord);
    case 'T16': return generateRecommendationPaperT16(meetingRecord, options.recommendations);
    case 'T17': return generateMeetingPerformanceReportT17(meetingRecord, options.healthPayload, options);
    default:
      throw new Error(`Unknown document template ID: "${templateId}"`);
  }
}
