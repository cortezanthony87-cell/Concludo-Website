/**
 * The invention suite and its companions. Specification 10.9.
 *
 * This is the build blocking gate:
 * - Criteria 1 to 7 of tasklet 1.9 (Invention Suite)
 * - Phase 1 Core Output Foundation suite (Tasklets 1.1 to 1.11)
 * - Phase 2 Meeting Health Intelligence suite (Tasklets 2.1 to 2.10)
 * - Phase 3 Concludo Insight Engine suite (Tasklets 3.1 to 3.12)
 * - Phase 4 Concludo Recommendation Engine suite (Tasklets 4.1 to 4.10)
 * - Phase 5 Business Document Generation suite (Tasklets 5.1 to 5.17)
 * - Phase 6 Visualisation Engine suite (Tasklets 6.1 to 6.12)
 * - Phase 12 Entitlement & Access Grants suite (Tasklets 12.1 to 12.5)
 * - Phase 14 Legal Defences suite (Tasklets 14.1 to 14.12)
 *
 * Exit code 1 on any failure. Nothing here is a warning.
 */
import { run } from '../src/pipeline.mjs';
import { validateRecord } from '../src/validate.mjs';
import { scoreHealth } from '../src/health.mjs';
import { selectOutputs } from '../src/gates.mjs';
import { checkGeneratedText, checkIdentifier } from '../src/language.mjs';
import {
  baseRecord, sparseRecord, injectionRecord, clientPresentRecord,
  restrictedRecord, guessedAttributionRecord, inferredDecisionRecord,
  contradictoryStatsRecord,
} from '../fixtures/build.mjs';
import { runPhase1Tests } from './phase1.test.mjs';
import { runPhase2Tests } from './phase2.test.mjs';
import { runPhase3Tests } from './phase3.test.mjs';
import { runPhase4Tests } from './phase4.test.mjs';
import { runPhase5Tests } from './phase5.test.mjs';
import { runPhase6Tests } from './phase6.test.mjs';
import { runPhase7Tests } from './phase7.test.mjs';
import { runPhase8Tests } from './phase8.test.mjs';
import { runPhase9Tests } from './phase9.test.mjs';
import { runPhase10Tests } from './phase10.test.mjs';
import { runPhase11Tests } from './phase11.test.mjs';
import { runPhase12Tests } from './phase12.test.mjs';
import { runPhase14Tests } from './phase14.test.mjs';

let pass = 0;
const failures = [];

function check(suite, name, condition, detail = '') {
  if (condition) { pass++; return; }
  failures.push(`[${suite}] ${name}${detail ? ` :: ${detail}` : ''}`);
}

const hasCode = (list, code) => list.some((x) => x.code === code);

// ---------------------------------------------------------------- 1. Extraction fidelity
{
  const v = validateRecord(baseRecord());
  check('fidelity', 'the gold record validates', v.ok, JSON.stringify(v.blocking));

  const inf = validateRecord(inferredDecisionRecord());
  check('fidelity', 'an inferred decision is build blocking', !inf.ok && hasCode(inf.blocking, 'inferred_decision'));

  const guessed = validateRecord(guessedAttributionRecord());
  check('fidelity', 'attribution is refused when speaker labels are limited',
    !guessed.ok && hasCode(guessed.blocking, 'attribution_unsupported'));

  const contra = validateRecord(contradictoryStatsRecord());
  check('fidelity', 'statistics that do not reconcile are build blocking',
    !contra.ok && hasCode(contra.blocking, 'statistics_contradiction'));
}

// ---------------------------------------------------------------- 2. Invention
{
  const sparse = sparseRecord();
  const v = validateRecord(sparse);
  check('invention', 'a sparse record still validates rather than being padded', v.ok, JSON.stringify(v.blocking));

  const plan = selectOutputs(sparse, { healthScoreable: false, scoreableWeight: 0 });
  const produced = plan.outputs.map((o) => o.output_id);
  check('invention', 'no decision log is produced from a record with no decisions', !produced.includes('OUT-02'));
  check('invention', 'no action register is produced from a record with no actions', !produced.includes('OUT-03'));
  check('invention', 'no risk register is produced from a record with no risks', !produced.includes('OUT-05'));
  check('invention', 'no next best action is produced when none is supportable', !produced.includes('OUT-08'));
  check('invention', 'the spine still produces the summary, questions, follow up and appendix',
    ['OUT-01', 'OUT-04', 'OUT-06', 'OUT-10'].every((id) => produced.includes(id)));

  const out = run(sparse);
  check('invention', 'a sparse record renders without inventing a figure',
    out.ok && !/\b\d+%\s*(?:of the market|industry)/i.test(out.html));
}

// ---------------------------------------------------------------- 3. Instruction shaped content
{
  const undeclared = validateRecord(injectionRecord({ declared: false }));
  check('injection', 'undeclared instruction shaped content is build blocking',
    !undeclared.ok && hasCode(undeclared.blocking, 'instruction_shaped_content_undeclared'));

  const declared = injectionRecord({ declared: true });
  const v = validateRecord(declared);
  check('injection', 'declared instruction shaped content validates', v.ok, JSON.stringify(v.blocking));

  const out = run(declared);
  check('injection', 'the instruction is reported, not followed',
    out.ok && out.html.includes('instruction shaped content') && !/^\s*approved\s*$/i.test(out.html));
  check('injection', 'the decisions survive the injection attempt',
    out.ok && out.html.includes('Re-baseline the Riverstone delivery schedule'));
}

// ---------------------------------------------------------------- 4. Gates and stated omissions
{
  const plan = selectOutputs(sparseRecord(), { healthScoreable: false, scoreableWeight: 0 });
  check('gates', 'every suppressed output is stated, not silent', plan.stated_omissions.length > 0);
  const fields = ['output_name', 'gate_failed', 'missing_evidence', 'what_would_be_needed_next_time'];
  check('gates', 'every stated omission carries all four fields',
    plan.stated_omissions.every((o) => fields.every((f) => typeof o[f] === 'string' && o[f].length > 0)));
  check('gates', 'the evidence gate fires on the sparse record',
    plan.stated_omissions.some((o) => o.gate_failed === 'evidence_sufficiency'));

  const restrictedPlan = selectOutputs(restrictedRecord(), { restricted: true, healthScoreable: false, scoreableWeight: 0 });
  check('gates', 'the confidentiality gate fires on the restricted record',
    restrictedPlan.stated_omissions.some((o) => o.gate_failed === 'confidentiality'));
}

// ---------------------------------------------------------------- 5. Confidentiality
{
  const cs = run(clientPresentRecord());
  check('confidentiality', 'client_safe is selected and is not overridable',
    cs.ok && cs.plan.variant === 'client_safe' && cs.plan.variant_user_overridable === false);
  check('confidentiality', 'no health content reaches a client safe output',
    cs.ok && !cs.html.includes('How the meeting itself went') && !cs.html.includes('out of 100'));
  check('confidentiality', 'the performance report is omitted with a stated reason',
    cs.plan.stated_omissions.some((o) => o.output_id === 'OUT-09' && o.gate_failed === 'confidentiality'));

  const r = run(restrictedRecord());
  check('confidentiality', 'a restricted record produces no performance report',
    r.ok && !r.plan.outputs.some((o) => o.output_id === 'OUT-09'));
  check('confidentiality', 'a restricted record is not scored at all',
    r.ok && r.health.scored === false && r.health.health === null);
  check('confidentiality', 'a restricted record produces no follow up email draft',
    r.ok && !r.plan.outputs.some((o) => o.output_id === 'OUT-06'));
  check('confidentiality', 'the restricted path is an allowlist, so nothing outside it is produced',
    r.ok && r.plan.outputs.every((o) => ['OUT-01', 'OUT-03', 'OUT-04', 'OUT-07', 'OUT-10'].includes(o.output_id)));
  check('confidentiality', 'the restricted notice renders on the record',
    r.ok && r.html.includes('This record is private to you'));
}

// ---------------------------------------------------------------- 6. Individual scoring
{
  const out = run(baseRecord());
  check('governance', 'health carries no individual scores',
    out.ok && out.health.health.individual_scores === null);
  const bad = baseRecord();
  bad.health = { dimensions: [], scoreable_weight: 0, total: null, band: null, not_a_benchmark: true, individual_scores: { 'Sam Okonkwo': 3 } };
  const v = validateRecord(bad);
  check('governance', 'a record carrying individual scores fails the schema or the validator', !v.ok);
}

// ---------------------------------------------------------------- 7. Health scoring behaviour
{
  const good = scoreHealth(baseRecord(), { objective: 'decide' });
  check('health', 'the gold record scores', good.scored && typeof good.health.total === 'number');
  check('health', 'the score sits inside 0 to 100', good.health.total >= 0 && good.health.total <= 100);
  check('health', 'no dimension is scored zero merely because it could not be observed',
    good.health.dimensions.every((d) => d.scoreable || d.raw === null));

  const thin = scoreHealth(sparseRecord(), { objective: 'inform' });
  check('health', 'below the 70 point floor there is no total',
    thin.health.scoreable_weight < 70 ? thin.health.total === null : true);
  check('health', 'unscoreable dimensions carry a reason',
    thin.health.dimensions.filter((d) => !d.scoreable).every((d) => typeof d.unscoreable_reason === 'string'));

  // The facilitator credibility test. A divergent workshop that closed nothing has not failed.
  const workshop = baseRecord();
  workshop.decisions = [];
  workshop.statistics.decisions_confirmed = 0;
  workshop.meeting_context.objective = 'explore';
  const w = scoreHealth(workshop, { objective: 'explore' });
  const d3 = w.health.dimensions.find((d) => d.id === 'D3');
  check('health', 'decision closure is not penalised for an explore objective', d3.raw !== 0, `D3 raw was ${d3.raw}`);

  const decideNoDecision = baseRecord();
  decideNoDecision.decisions = [];
  decideNoDecision.statistics.decisions_confirmed = 0;
  const dn = scoreHealth(decideNoDecision, { objective: 'decide' });
  check('health', 'a decide meeting with no decision scores D3 at zero',
    dn.health.dimensions.find((d) => d.id === 'D3').raw === 0);
}

// ---------------------------------------------------------------- 8. Brand and language
{
  const out = run(baseRecord());
  check('language', 'the rendered report passes the brand and language suite',
    out.language.ok, JSON.stringify(out.language.failures));

  check('language', 'an em dash in generated text fails',
    !checkGeneratedText('The decision — which was material — stands.').ok);
  check('language', 'US spelling fails', !checkGeneratedText('We will organize the workstream.').ok);
  check('language', 'a benchmark claim fails', !checkGeneratedText('This is 30% above the industry average.').ok);
  check('language', 'a savings claim fails', !checkGeneratedText('Concludo will save you $4,000 a year.').ok);
  check('language', 'naming a consulting firm fails', !checkGeneratedText('This is what McKinsey would recommend.').ok);
  check('language', 'bare Pro fails', !checkGeneratedText('Upgrade to Pro for the full report.').ok);
  check('language', 'Pro subscription passes', checkGeneratedText('Upgrade to the Pro subscription for the full report.').ok);
  check('language', 'Pro Edition passes', checkGeneratedText('The Pro Edition is an organisation licence.').ok);
  check('language', 'the pro enum value fails', !checkIdentifier('pro').ok);
  check('language', 'the enterprise tier value fails', !checkIdentifier('enterprise').ok);
  check('language', 'pro_subscription passes', checkIdentifier('pro_subscription').ok);
}

// ---------------------------------------------------------------- 9. Reproducibility
{
  const at = new Date('2026-09-15T04:00:00.000Z');
  const a = run(baseRecord(), { generatedAt: at }).html;
  const b = run(baseRecord(), { generatedAt: at }).html;
  check('reproducibility', 'the deterministic stages produce byte identical output', a === b);
}

// ---------------------------------------------------------------- 10. Not a benchmark
{
  const out = run(baseRecord());
  check('benchmark', 'the not a benchmark statement renders with the score',
    out.html.includes('Not a benchmark.'));
  check('benchmark', 'nothing in the report compares the meeting with another organisation',
    !/compared (?:to|with) (?:other|similar)/i.test(out.html));
}

// ---------------------------------------------------------------- 11. Phase 1 Core Output Foundation Suite
runPhase1Tests(check);

// ---------------------------------------------------------------- 12. Phase 2 Meeting Health Intelligence Suite
runPhase2Tests(check);

// ---------------------------------------------------------------- 13. Phase 3 Concludo Insight Engine Suite
runPhase3Tests(check);

// ---------------------------------------------------------------- 14. Phase 4 Concludo Recommendation Engine Suite
runPhase4Tests(check);

// ---------------------------------------------------------------- 15. Phase 5 Business Document Generation Suite
runPhase5Tests(check);

// ---------------------------------------------------------------- 16. Phase 6 Visualisation Engine Suite
runPhase6Tests(check);

// ---------------------------------------------------------------- 17. Phase 7 Document Rendering Engine Suite
await runPhase7Tests(check);

// ---------------------------------------------------------------- 18. Phase 8 Output JSON Schema Framework Suite
await runPhase8Tests(check);

// ---------------------------------------------------------------- 19. Phase 9 Copilot Consumption Suite
await runPhase9Tests(check);

// ---------------------------------------------------------------- 20. Phase 10 Agent Consumption Suite
await runPhase10Tests(check);

// ---------------------------------------------------------------- 21. Phase 11 Enterprise Readiness Suite
await runPhase11Tests(check);

// ---------------------------------------------------------------- 22. Phase 12 Entitlement & Access Grants Suite
await runPhase12Tests(check);

// ---------------------------------------------------------------- 23. Phase 14 Legal Defences Suite
runPhase14Tests(check);

// ---------------------------------------------------------------- report
const total = pass + failures.length;
console.log(`\nConcludo Suite: ${pass} of ${total} checks passed.\n`);
if (failures.length) {
  console.log('FAILURES, build blocked:\n');
  for (const f of failures) console.log('  ' + f);
  console.log('');
  process.exit(1);
}
console.log('ALL PHASES VERIFIED: Invention suite, Phase 1 Core Output Foundation, Phase 2 Meeting Health Intelligence, Phase 3 Insight Engine, Phase 4 Recommendation Engine, Phase 5 Business Document Generation, Phase 6 Visualisation Engine, Phase 7 Document Rendering, Phase 8 Output JSON Schema Framework, Phase 9 Copilot Consumption, Phase 10 Agent Consumption, Phase 11 Enterprise Readiness, Phase 12 Entitlement & Access Grants, and Phase 14 Legal Defences all 100% passed.\n');
