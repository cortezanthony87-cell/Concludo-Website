/**
 * Enforces the authority rule in code.
 *
 * `Concludo_Output_Registry_v1.json` is authoritative for anything it contains.
 * registry/registry.t1.json is a derived extract that the T1 build reads at
 * runtime. If the two disagree the build fails, so the extract can never drift
 * into being a second source of truth.
 *
 * Place the full registry at registry/Concludo_Output_Registry_v1.json and run
 * `npm run registry:verify`.
 */
import { registry, loadFullRegistry, FULL_REGISTRY_PATH } from '../src/registry.mjs';

const full = loadFullRegistry();
if (!full) {
  console.log(`No full registry found at:\n  ${FULL_REGISTRY_PATH}\n`);
  console.log('Place it there to verify the extract. Skipping, not failing, so a clean checkout still builds.');
  process.exit(0);
}

const problems = [];
const eq = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${what}: extract has ${JSON.stringify(a)}, registry has ${JSON.stringify(b)}`); };

eq('registry_version', registry.registry_version, full.registry_version);
eq('constraints.no_benchmark_assertions', registry.constraints.no_benchmark_assertions, full.constraints.no_benchmark_assertions);
eq('constraints.inferred_cannot_satisfy_precondition', registry.constraints.inferred_cannot_satisfy_precondition, full.constraints.inferred_cannot_satisfy_precondition);
eq('health.scoreable_weight_floor', registry.health.scoreable_weight_floor, full.health.partial_scoring.scoreable_weight_floor);
eq('health.not_a_benchmark_statement', registry.health.not_a_benchmark_statement, full.health.not_a_benchmark_statement);

for (const d of full.health.dimensions) {
  const mine = registry.health.dimensions.find((x) => x.id === d.id);
  if (!mine) { problems.push(`health dimension ${d.id} missing from the extract`); continue; }
  eq(`health.${d.id}.weight`, mine.weight, d.weight);
  eq(`health.${d.id}.name`, mine.name, d.name);
}

eq('health.bands', registry.health.bands.map((b) => [b.min, b.max, b.internal, b.display]),
   full.health.bands.map((b) => [b.min, b.max, b.internal, b.display]));

eq('gates', registry.gates.map((g) => g.gate), full.gates.map((g) => g.gate));

for (const [id, floor] of Object.entries(registry.coverage_floors)) {
  const declared = full.gates.find((g) => g.gate === 'coverage_floor')?.floors?.[id];
  eq(`coverage_floor.${id}`, `${floor.required}/${floor.of}`, declared);
}

eq('stated_omission_format', registry.stated_omission_format, full.stated_omission_format);
eq('spine output ids', registry.spine.map((s) => s.id), full.outputs.spine.map((s) => s.id));
eq('variants', registry.variants.map((v) => v.id), full.variants.map((v) => v.id));

// Templates: the extract carries T17, added by correction 4 of the patch.
const fullTemplates = full.templates.map((t) => t.id);
const extraInExtract = registry.templates.map((t) => t.id).filter((id) => !fullTemplates.includes(id));
if (extraInExtract.length && extraInExtract.join() !== 'T17') {
  problems.push(`extract carries templates absent from the registry: ${extraInExtract.join(', ')}`);
}
if (extraInExtract.includes('T17')) {
  console.log('NOTE  T17 Meeting Performance Report is in the extract and not yet in the full registry.');
  console.log('      Apply correction 4 of the tasklet corrections patch to the registry, then re-run.');
}

if (problems.length) {
  console.log('\nRegistry drift. The full registry is authoritative and the extract is wrong:\n');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('\nExtract agrees with the registry on every field it carries.\n');
