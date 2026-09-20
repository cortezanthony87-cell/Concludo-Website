/**
 * Validation layer. Specification 10.2 and 10.9.
 *
 * Two classes of result, and the difference is the whole point:
 *   blocking  - the record is wrong in a way that would put an invented or
 *               unsupported claim in front of a reader. Never repaired by
 *               guessing. One repair pass, then degrade.
 *   note      - the record is thin. Degrade visibly and say so.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './registry.mjs';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/** Text that looks like an instruction to a model. Never behaviour, always content. */
const INSTRUCTION_SHAPED = [
  /\bignore (?:all )?(?:the )?(?:previous|prior|above) instructions?\b/i,
  /\byou are (?:now )?(?:an? )?(?:AI|assistant|language model)\b/i,
  /\bsystem prompt\b/i,
  /\bdisregard (?:the )?(?:rules|constraints|guidelines)\b/i,
  /\bact as\b.{0,30}\binstead\b/i,
  /\boutput only\b/i,
];

const namedPerson = (p) => Boolean(p && p.status === 'stated' && p.name);

export function validateRecord(record) {
  /** @type {{code:string, message:string, ids?:string[]}[]} */
  const blocking = [];
  const notes = [];
  const fail = (code, message, ids) => blocking.push({ code, message, ids });
  const note = (code, message, ids) => notes.push({ code, message, ids });

  // 1. Schema.
  if (!validateSchema(record)) {
    for (const e of validateSchema.errors ?? []) {
      fail('schema', `${e.instancePath || '/'} ${e.message}`);
    }
    return { ok: false, blocking, notes };
  }

  const stats = record.statistics;
  const labelsLimited = stats.speaker_label_quality === 'limited';

  // 2. Evidence discipline. Every assertion resolves to the record or is labelled.
  for (const d of record.decisions) {
    if (!d.source_basis || !d.source_basis.trim()) {
      fail('citation_missing', `Decision ${d.id} has no source basis.`, [d.id]);
    }
    if (d.evidence === 'inferred' || d.evidence === 'unknown') {
      fail('inferred_decision', `Decision ${d.id} is ${d.evidence}. A decision is never inferred. Record it as an open question instead.`, [d.id]);
    }
    if (labelsLimited && namedPerson(d.approver)) {
      fail('attribution_unsupported', `Decision ${d.id} names an approver while speaker label quality is limited. Attribution may not be guessed.`, [d.id]);
    }
  }

  for (const a of record.actions) {
    if (!a.source_basis || !a.source_basis.trim()) {
      fail('citation_missing', `Action ${a.id} has no source basis.`, [a.id]);
    }
    if (labelsLimited && namedPerson(a.owner)) {
      fail('attribution_unsupported', `Action ${a.id} names an owner while speaker label quality is limited. Unowned actions become open questions.`, [a.id]);
    }
    const missing = [];
    if (!namedPerson(a.owner)) missing.push('owner');
    if (!a.due_date) missing.push('date');
    if (!a.definition_of_done) missing.push('definition of done');
    if (!a.confirmation_method) missing.push('confirmation method');
    if (missing.length) {
      note('delegation_standard_gap', `Action ${a.id} is not yet an action. Missing: ${missing.join(', ')}.`, [a.id]);
    }
  }

  // 3. Recommendations are Concludo's, cited, and never binding.
  for (const r of record.recommendations) {
    if (r.binding !== false) fail('binding_recommendation', `Recommendation ${r.id} is marked binding.`, [r.id]);
    if (!r.because_ids?.length) fail('citation_missing', `Recommendation ${r.id} cites nothing.`, [r.id]);
  }

  // 4. Insight findings name their comparison and cite the record.
  for (const i of record.insights_v2 ?? []) {
    if (!i.comparison_basis?.trim()) {
      fail('no_comparison_basis', `Finding ${i.id} does not name the comparison it came from.`, [i.id]);
    }
    if (!i.evidence_ids?.length) {
      fail('citation_missing', `Finding ${i.id} cites no record location.`, [i.id]);
    }
    if (i.about_an_individual === true) {
      fail('finding_about_a_person', `Finding ${i.id} characterises an individual. Findings are about the meeting and the work, never the person.`, [i.id]);
    }
  }

  // 5. No silent outbound writes.
  for (const r of record.routing) {
    if (r.human_check_required !== true) {
      fail('silent_routing', `Routing to ${r.destination} does not require a human check.`);
    }
  }

  // 6. Individual scoring is structurally impossible, not merely switched off.
  if (record.health && record.health.individual_scores != null) {
    fail('individual_scoring', 'Individual scores are present. Prohibited at every tier under every setting.');
  }

  // 7. Statistics must reconcile with the arrays they describe.
  const recount = {
    actions_committed: record.actions.length,
    actions_with_owner: record.actions.filter((a) => namedPerson(a.owner)).length,
    actions_with_due_date: record.actions.filter((a) => a.due_date).length,
    actions_with_definition_of_done: record.actions.filter((a) => a.definition_of_done).length,
    open_questions_count: record.open_questions.length,
    risks_count: record.risks.length,
  };
  for (const [k, v] of Object.entries(recount)) {
    if (stats[k] !== v) {
      fail('statistics_contradiction', `statistics.${k} states ${stats[k]}, the record contains ${v}.`);
    }
  }

  // 8. Injection screen, re-run at validation. Content to report, never behaviour to adopt.
  const body = record.transcript?.body ?? '';
  if (body && INSTRUCTION_SHAPED.some((re) => re.test(body))) {
    const declared = (record.quality_notes ?? []).some((q) => q.code === 'instruction_shaped_content');
    if (!declared) {
      fail('instruction_shaped_content_undeclared',
        'The record contains instruction shaped text and no instruction_shaped_content quality note was raised.');
    }
  }

  // 9. The self check from Workbook chapter 10, applied to Concludo.
  const substantial = (record.transcript?.word_count ?? 0) >= 400;
  const noLooseEnds =
    record.open_questions.length === 0 &&
    (record.quality_notes ?? []).length === 0 &&
    ![...record.decisions, ...record.actions].some((x) => x.evidence === 'inferred');
  if (substantial && noLooseEnds) {
    note('extraction_with_no_loose_ends',
      'A substantial record produced no open questions, no inferences and no quality notes. Real meetings produce ambiguity. An output showing none has hidden some.');
  }

  return { ok: blocking.length === 0, blocking, notes };
}

export { INSTRUCTION_SHAPED };
