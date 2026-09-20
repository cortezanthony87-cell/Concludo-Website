/**
 * E9 Document Rendering, template T2 Meeting Report.
 * Specification 5.1 and 5.T2, plus the print rules in 7.4 (A4, 15mm, repeating headers).
 *
 * Pure function of (record, plan, health, variant). Reads the MeetingRecord only.
 * Never reads the transcript. Never receives a value the record does not contain.
 */
import { registry } from './../registry.mjs';
import { NOT_A_BENCHMARK } from './../health.mjs';

const B = registry.brand;
const F = registry.footer;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const named = (p) => (p && p.status === 'stated' && p.name ? p.name : null);
const who = (p) => named(p) ?? '<span class="gap">not stated</span>';
const dash = (v) => (v == null || v === '' ? '<span class="gap">not stated</span>' : esc(v));

const STATUS_CHIP = {
  decided: ['good', 'Decided'],
  open: ['warning', 'Open'],
  parked: ['not_rated', 'Parked'],
  escalated: ['serious', 'Escalated'],
};

const EVIDENCE_MARK = {
  confirmed: '',
  proposed: '<span class="ev ev-proposed" title="Proposed, not confirmed">proposed</span>',
  inferred: '<span class="ev ev-inferred" title="Inferred by Concludo, not stated">inferred</span>',
  unknown: '<span class="ev ev-unknown" title="Not established">unknown</span>',
};

function css() {
  return `
@page { size: A4; margin: 15mm; }
:root{
  --navy:${B.navy_primary}; --navy2:${B.navy_secondary};
  --gold:${B.gold_primary}; --gold-dark:${B.gold_dark}; --light:${B.light};
  --ink:#1b2430; --muted:#5B6B7F; --rule:#d9dfe8;
  --good:#1F7A4D; --warning:#B8860B; --serious:#C2561E; --critical:#B3261E; --not_rated:#5B6B7F;
}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);
  font-family:Inter,"Helvetica Neue",Arial,sans-serif;font-size:10.5pt;line-height:1.5}
.page{max-width:180mm;margin:0 auto;padding:0 4mm}
h1,h2,h3{font-family:Poppins,"Segoe UI",Arial,sans-serif;color:var(--navy);margin:0 0 .35em}
h1{font-size:19pt;line-height:1.2}
h2{font-size:13pt;margin-top:1.6em;padding-bottom:.25em;border-bottom:2px solid var(--navy)}
h3{font-size:11pt;color:var(--navy2);margin-top:1.1em}
.masthead{border-top:5px solid var(--navy);padding-top:10px;margin-bottom:6px}
.eyebrow{font-family:Poppins,Arial,sans-serif;font-size:8.5pt;letter-spacing:.14em;
  text-transform:uppercase;color:var(--gold-dark);font-weight:600}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(38mm,1fr));gap:6px 14px;
  background:var(--light);border:1px solid var(--rule);border-radius:4px;padding:10px 12px;margin:10px 0 4px}
.meta div{font-size:9pt}
.meta dt{color:var(--muted);font-size:8pt;text-transform:uppercase;letter-spacing:.06em;margin:0}
.meta dd{margin:1px 0 0;font-weight:600}
.answer{border-left:4px solid var(--gold);background:#fffdf6;padding:10px 14px;margin:12px 0}
.answer p{margin:0}
table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-size:9.5pt}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{text-align:left;background:var(--navy);color:#fff;font-family:Poppins,Arial,sans-serif;
  font-weight:600;font-size:8.5pt;letter-spacing:.03em;padding:6px 8px;vertical-align:bottom}
td{padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top}
tbody tr:nth-child(even) td{background:#fbfcfe}
.reg td:first-child{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--muted);font-weight:600}
.chip{display:inline-block;font-size:8pt;font-weight:600;padding:1px 7px;border-radius:9px;
  border:1px solid currentColor;white-space:nowrap}
.chip::before{content:"\\25CF";margin-right:4px;font-size:7pt}
.chip.good{color:var(--good)} .chip.warning{color:var(--warning)}
.chip.serious{color:var(--serious)} .chip.critical{color:var(--critical)}
.chip.not_rated{color:var(--not_rated)}
.chip.not_rated::before{content:"\\25A1"}
.chip.serious::before,.chip.critical::before{content:"\\25B2"}
.gap{color:var(--muted);font-style:italic}
.ev{display:inline-block;font-size:7.5pt;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  padding:0 5px;margin-left:5px;border-radius:3px;border:1px dashed var(--muted);color:var(--muted)}
.ev-inferred{border-style:solid;background:repeating-linear-gradient(45deg,#f2f4f8,#f2f4f8 3px,#e6eaf1 3px,#e6eaf1 6px)}
.panel{border:1px solid var(--rule);border-left:4px solid var(--navy2);border-radius:4px;
  padding:10px 14px;margin:10px 0;background:#fcfdff;page-break-inside:avoid}
.panel.gapblock{border-left-color:var(--gold-dark);background:#fffdf6}
.panel h3{margin-top:0}
.panel ul{margin:.3em 0 0;padding-left:1.1em}
.panel li{margin:.25em 0}
.concludo{border-left-color:var(--gold)}
.concludo .attrib{font-size:8pt;color:var(--muted);margin-top:8px}
footer{margin-top:22px;padding-top:9px;border-top:1px solid var(--rule);
  font-size:8pt;color:var(--muted);line-height:1.45}
footer strong{color:var(--navy2)}
@media print{ .page{max-width:none;padding:0} body{font-size:10pt} }
@media (max-width:520px){ .meta{grid-template-columns:1fr} table{font-size:9pt} }
`;
}

export function renderMeetingReport({ record, plan, health, generatedAt = new Date() }) {
  const m = record.meeting;
  const s = record.statistics;
  const variant = plan.variant;
  const clientSafe = variant === 'client_safe';
  const has = (id) => plan.outputs.some((o) => o.output_id === id);

  const participants = m.participants
    .map((p) => {
      const n = named(p);
      const role = p.role ? ` <span class="gap">(${esc(p.role)})</span>` : '';
      return n ? `${esc(n)}${role}` : '<span class="gap">unnamed participant</span>';
    })
    .join(', ');

  const topicsRows = record.topics.map((t) => {
    const [cls, label] = STATUS_CHIP[t.status] ?? ['not_rated', t.status];
    return `<tr><td><strong>${esc(t.topic)}</strong><br>${esc(t.summary)}</td>
      <td><span class="chip ${cls}">${label}</span></td></tr>`;
  }).join('');

  const decisionRows = record.decisions.map((d) => `<tr>
      <td>${esc(d.id)}</td>
      <td>${esc(d.decision)}${EVIDENCE_MARK[d.evidence] ?? ''}</td>
      <td>${who(d.approver)}</td>
      <td>${dash(d.rationale)}</td>
      <td>${(d.options_rejected ?? []).length ? esc(d.options_rejected.join('; ')) : '<span class="gap">none recorded</span>'}</td>
      <td>${Array.isArray(d.dissent) ? (d.dissent.length ? d.dissent.map((x) => `${esc(x.position)} (${who(x.raised_by)})`).join('; ') : 'None expressed') : '<span class="gap">not assessed</span>'}</td>
    </tr>`).join('');

  const fiveField = (a) => named(a.owner) && a.due_date && a.definition_of_done && a.confirmation_method;
  const realActions = record.actions.filter(fiveField);
  const notYetActions = record.actions.filter((a) => !fiveField(a));

  const actionRows = realActions.map((a) => `<tr>
      <td>${esc(a.id)}</td><td>${esc(a.action)}</td><td>${who(a.owner)}</td>
      <td>${esc(a.due_date)}</td><td>${esc(a.definition_of_done)}</td><td>${esc(a.confirmation_method)}</td>
    </tr>`).join('');

  const notYetList = notYetActions.map((a) => {
    const missing = [];
    if (!named(a.owner)) missing.push('no owner');
    if (!a.due_date) missing.push(a.due_date_raw ? `no resolved date (recorded as "${esc(a.due_date_raw)}")` : 'no date');
    if (!a.definition_of_done) missing.push('no definition of done');
    if (!a.confirmation_method) missing.push('no confirmation method');
    return `<li><strong>${esc(a.id)}</strong> ${esc(a.action.replace(/\s*\.\s*$/, ''))}. <span class="gap">Missing: ${missing.join(', ')}.</span></li>`;
  }).join('');

  const questionRows = record.open_questions.map((q) => `<tr>
      <td>${esc(q.id)}</td><td>${esc(q.question)}</td>
      <td>${esc(q.why_it_matters)}</td><td>${who(q.expected_resolver)}</td>
      <td>${dash(q.needed_by ?? q.needed_by_raw)}</td>
    </tr>`).join('');

  const riskRows = record.risks.map((r) => `<tr>
      <td>${esc(r.id)}</td><td>${esc(r.risk)}</td>
      <td>${r.likelihood_stated ? esc(r.likelihood_stated) : '<span class="chip not_rated">Not rated</span>'}</td>
      <td>${dash(r.consequence_stated)}</td><td>${who(r.owner)}</td>
      <td>${dash(r.mitigation)}</td><td>${dash(r.escalation_trigger)}</td>
    </tr>`).join('');

  const omissions = plan.stated_omissions.map((o) => `<li>
      <strong>${esc(o.output_name)}</strong> was not produced. Gate: ${esc(o.gate_failed.replace(/_/g, ' '))}.
      What was missing: ${esc(o.missing_evidence)}.
      Next time: ${esc(o.what_would_be_needed_next_time)}</li>`).join('');

  const inferred = [...record.decisions, ...record.actions, ...record.risks, ...record.open_questions]
    .filter((x) => x.evidence === 'inferred' || x.evidence === 'unknown');
  const inferredList = inferred.length
    ? inferred.map((x) => `<li><strong>${esc(x.id)}</strong> is labelled ${esc(x.evidence)}. Basis: ${esc(x.source_basis ?? 'not recorded')}</li>`).join('')
    : '<li>Nothing in this report is inferred. Every entry resolves to something said.</li>';

  const qualityList = (record.quality_notes ?? []).length
    ? record.quality_notes.map((q) => `<li><strong>${esc(q.code.replace(/_/g, ' '))}</strong>: ${esc(q.note)}</li>`).join('')
    : '<li>No quality notes were raised.</li>';

  // Health content is excluded from every client safe output. Specification 8.4.
  const healthBlock = (!clientSafe && has('OUT-09') && health?.scored)
    ? `<div class="panel concludo">
        <h3>How the meeting itself went</h3>
        <p><strong>${health.health.total} out of 100. ${esc(health.health.band)}.</strong>
        ${health.health.partial_label ? `<br><span class="gap">${esc(health.health.partial_label)}</span>` : ''}</p>
        <p class="attrib">${esc(NOT_A_BENCHMARK)}</p>
        <p class="attrib">The full Meeting Performance Report is a separate artefact with a different reader. It is never attached to a follow up and never sent to attendees automatically.</p>
      </div>`
    : '';

  const restrictedNotice = variant === 'restricted'
    ? `<div class="panel gapblock">
        <h3>This record is private to you</h3>
        <p style="margin:0">${esc(registry.restricted_path.notice)}</p>
        <p style="margin:.5em 0 0;font-size:9pt">No performance report, no client facing output and no distribution ready format is produced from this record, and it is excluded from every cross meeting pattern, aggregate and analytic.</p>
      </div>`
    : '';

  const title = `${m.title}: Meeting Report`;

  return `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<style>${css()}</style>
</head><body><div class="page">

<div class="masthead">
  <div class="eyebrow">Concludo ${'·'} Meeting Report ${'·'} ${esc(variant.replace('_', ' '))}</div>
  <h1>${esc(m.title)}</h1>
</div>

<div class="meta">
  <div><dt>Date</dt><dd>${dash(m.date)}</dd></div>
  <div><dt>Purpose</dt><dd>${dash(m.purpose)}</dd></div>
  <div><dt>Record</dt><dd>${esc(m.record_type.replace(/_/g, ' '))}, ${esc(m.record_quality)}</dd></div>
  <div><dt>Speaker labels</dt><dd>${esc(s.speaker_label_quality)}</dd></div>
  <div><dt>Completeness</dt><dd>${esc(s.record_completeness)}</dd></div>
  <div><dt>Evidence quality</dt><dd>${s.evidence_quality_index_pct == null ? '<span class="gap">not computed</span>' : s.evidence_quality_index_pct + '%'}</dd></div>
</div>
<p style="font-size:9pt;margin:.4em 0 0"><strong>Participants.</strong> ${participants}</p>

${restrictedNotice}

<div class="answer"><p><strong>${esc(m.outcome_one_line || 'No outcome was stated at the close of this meeting.')}</strong></p>
<p style="margin-top:.5em">${esc(record.executive_summary)}</p></div>

<h2>Discussion by topic</h2>
<table><thead><tr><th style="width:80%">Topic</th><th>Status</th></tr></thead>
<tbody>${topicsRows || '<tr><td colspan="2"><span class="gap">No topic structure was captured in this record.</span></td></tr>'}</tbody></table>

<h2>Decisions</h2>
${has('OUT-02')
    ? `<table class="reg"><thead><tr><th>ID</th><th>Decision</th><th>Approver</th><th>Rationale</th><th>Options rejected</th><th>Dissent</th></tr></thead><tbody>${decisionRows}</tbody></table>`
    : `<p class="gap">No decision was recorded from confirmed or proposed evidence. A decision is never inferred.</p>`}

<h2>Actions</h2>
${realActions.length
    ? `<table class="reg"><thead><tr><th>ID</th><th>Action</th><th>Owner</th><th>Due</th><th>Definition of done</th><th>Confirmed by</th></tr></thead><tbody>${actionRows}</tbody></table>`
    : '<p class="gap">No action in this record carries all five fields of the Delegation Standard.</p>'}

${notYetActions.length ? `<div class="panel gapblock">
  <h3>These are not yet actions</h3>
  <p style="margin:0 0 .3em;font-size:9pt">Each is missing a field the Delegation Standard requires. Until it is supplied, the item is a hope with good grammar.</p>
  <ul>${notYetList}</ul></div>` : ''}

<h2>Open questions</h2>
<table class="reg"><thead><tr><th>ID</th><th>Question</th><th>Why it matters</th><th>Resolver</th><th>Needed by</th></tr></thead>
<tbody>${questionRows || '<tr><td colspan="5"><span class="gap">None recorded.</span></td></tr>'}</tbody></table>

<h2>Risks and blockers</h2>
${has('OUT-05')
    ? `<table class="reg"><thead><tr><th>ID</th><th>Risk</th><th>Likelihood</th><th>Consequence</th><th>Owner</th><th>Mitigation</th><th>Trigger</th></tr></thead><tbody>${riskRows}</tbody></table>
       <p style="font-size:8.5pt;color:#5B6B7F;margin:.2em 0 0">Likelihood and consequence are shown only where the room stated them. An unrated risk is shown as unrated, never positioned by inference.</p>`
    : '<p class="gap">No risk or blocker was raised in this meeting, and the risk index is below the threshold that would make the register mandatory. That absence is itself worth noting.</p>'}

<div class="panel gapblock">
  <h3>What this meeting did not establish</h3>
  ${omissions ? `<ul>${omissions}</ul>` : '<p style="margin:0">Every output the spine attempts was supported by this record.</p>'}
</div>

${healthBlock}

<h2>Evidence and inference appendix</h2>
<div class="panel">
  <h3>What was inferred</h3><ul>${inferredList}</ul>
  <h3>Quality notes on the record</h3><ul>${qualityList}</ul>
</div>

<footer>
  <strong>${esc(F.entity)}</strong><br>
  ${esc(F.independence)}<br>
  ${esc(F.not_advice)}<br>
  Generated ${generatedAt.toISOString().slice(0, 10)} from a ${esc(m.record_type.replace(/_/g, ' '))} of ${esc(m.record_quality)} quality, ${esc(s.record_completeness)}.
  This is a working record produced from a meeting record. It is not minutes and it is not a governance instrument.
</footer>

</div></body></html>`;
}
