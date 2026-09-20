/**
 * Step 4 of Appendix A: put one real meeting through one template, end to end,
 * before authoring the other fifteen.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../src/pipeline.mjs';
import { ROOT } from '../src/registry.mjs';
import { baseRecord, sparseRecord, clientPresentRecord, restrictedRecord } from '../fixtures/build.mjs';

const OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const at = new Date('2026-09-15T04:00:00.000Z');
const cases = [
  ['meeting-report-internal', baseRecord()],
  ['meeting-report-client-safe', clientPresentRecord()],
  ['meeting-report-sparse', sparseRecord()],
  ['meeting-report-restricted', restrictedRecord()],
];

for (const [name, record] of cases) {
  const r = run(record, { generatedAt: at });
  if (!r.ok) {
    console.log(`${name}: did not validate. ${r.degraded.blocking.map((b) => b.code).join(', ')}`);
    continue;
  }
  writeFileSync(join(OUT, `${name}.html`), r.html, 'utf8');
  writeFileSync(join(OUT, `${name}.plan.json`), JSON.stringify({ plan: r.plan, health: r.health }, null, 2), 'utf8');
  const score = r.health.scored ? `${r.health.health.total}/100 ${r.health.health.band}` : 'not scored';
  console.log(
    `${name.padEnd(34)} variant=${r.plan.variant.padEnd(12)} outputs=${String(r.plan.outputs.length).padStart(2)}  omitted=${String(r.plan.stated_omissions.length).padStart(2)}  health=${score}`
  );
}
console.log(`\nWritten to ${OUT}`);
