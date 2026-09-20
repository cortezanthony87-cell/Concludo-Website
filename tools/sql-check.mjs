#!/usr/bin/env node
/**
 * Roadmap SQL check.
 *
 * Extracts every ```sql block from a roadmap or tasklet document and executes it
 * against a real PostgreSQL server. Reading SQL does not find an ambiguous column
 * reference, a circular foreign key, or a CONCURRENTLY refresh with no unique
 * index. Running it does, in about four seconds.
 *
 * Blocks are retried in passes so that a forward reference (a table created in a
 * later tasklet) resolves on a subsequent pass rather than failing the run. Each
 * block runs in a single transaction, so a partial failure leaves nothing behind.
 * A block that never succeeds is reported with its first error.
 *
 * Usage:
 *   node tools/sql-check.mjs <file.md> [...more files]
 *
 * Env:
 *   PGHOST, PGPORT, PGUSER, PGDATABASE  standard libpq variables
 *   CONCLUDO_SQL_PRELUDE                path to a .sql file creating the stub
 *                                       base objects the roadmap references
 *                                       (auth.users, auth.uid(), organisations,
 *                                       organisation_memberships, meetings,
 *                                       transcripts, knowledge_nodes/edges,
 *                                       the authenticated and service_role roles)
 *
 * Exit: 0 when every block applied, 1 otherwise.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const defaultFiles = [
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/handover/01_Implementation_Roadmap_v2_0.md',
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/handover/02_Brief_Access_Grants_Phase12.md',
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/handover/03_Brief_Legal_Defences_Phase14.md',
  '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/concludo-security-phase15/02_Brief_Security_Phase15.md',
].filter((f) => existsSync(f));

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles;
if (!files.length) {
  console.log('Usage: node tools/sql-check.mjs <file.md> [...]');
  process.exit(0);
}

function psql(sql, singleTransaction = true) {
  const p = join(tmpdir(), `concludo-sql-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(p, sql);
  const args = ['-q', '-v', 'ON_ERROR_STOP=1', '-f', p];
  if (singleTransaction) args.unshift('-1');
  try {
    execFileSync('psql', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    return { ok: true, err: '' };
  } catch (e) {
    return { ok: false, err: String(e.stderr || e.message).trim() };
  } finally {
    unlinkSync(p);
  }
}

// Optional prelude: the stub objects the roadmap's DDL references but does not create.
const prelude = process.env.CONCLUDO_SQL_PRELUDE || (existsSync('tools/sql-prelude.sql') ? 'tools/sql-prelude.sql' : null);
if (prelude) {
  if (!existsSync(prelude)) {
    console.error(`Prelude not found: ${prelude}`);
    process.exit(1);
  }
  const r = psql(readFileSync(prelude, 'utf8'), false);
  if (!r.ok) {
    console.error('Prelude failed to apply:\n' + r.err);
    process.exit(1);
  }
}

/** Every fenced sql block, tagged with the tasklet it sits under. */
function blocks(file) {
  const text = readFileSync(file, 'utf8');
  const out = [];
  // Split on tasklet headings so each block can be reported by tasklet number.
  const parts = text.split(/^### Tasklet ([\d.]+)[^\n]*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const tid = parts[i];
    for (const m of parts[i + 1].matchAll(/```sql\n([\s\S]*?)```/g)) {
      out.push({ file, tid, sql: m[1] });
    }
  }
  // Blocks before the first tasklet heading still count.
  for (const m of parts[0].matchAll(/```sql\n([\s\S]*?)```/g)) {
    out.push({ file, tid: '(preamble)', sql: m[1] });
  }
  return out;
}

const all = files.flatMap(blocks);
console.log(`\nConcludo SQL check: ${all.length} block(s) across ${files.length} file(s).\n`);

let pending = all;
let pass = 0;
const appliedOnPass = new Map();

while (pending.length && pass < 8) {
  pass += 1;
  const next = [];
  for (const b of pending) {
    const r = psql(b.sql);
    if (r.ok) {
      if (!appliedOnPass.has(pass)) appliedOnPass.set(pass, new Set());
      appliedOnPass.get(pass).add(b.tid);
    } else {
      next.push(b);
    }
  }
  if (next.length === pending.length) {
    console.log(`${next.length} block(s) never applied. First error for each:\n`);
    for (const b of next) {
      const { err } = psql(b.sql);
      const first = err.split('\n').find((l) => l.includes('ERROR')) || err.split('\n')[0];
      console.log(`  Tasklet ${b.tid}  ${first.replace(/^psql:[^:]+:\d+:\s*/, '')}`);
    }
    console.log('\nA block that never applies is a migration that will not run. Fix the document, not the check.\n');
    process.exit(1);
  }
  pending = next;
}

for (const [p, ids] of [...appliedOnPass].sort((a, b) => a[0] - b[0])) {
  if (p === 1) continue;
  console.log(`Pass ${p} (forward reference, applied once its dependency existed): ${[...ids].sort().join(', ')}`);
}
console.log(`\nAll ${all.length} block(s) applied in ${pass} pass(es). Zero unresolved.\n`);
process.exit(0);
