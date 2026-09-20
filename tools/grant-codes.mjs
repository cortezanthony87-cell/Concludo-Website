#!/usr/bin/env node
/**
 * Concludo access grant code generator.
 *
 * Produces single-use access codes for Concludo staff and invited holders.
 * Each code is one artefact in two halves:
 *
 *   CONCLUDO-<public id>-<secret>
 *
 * The public id is stored in plaintext and indexed, so redemption is one
 * indexed lookup rather than a hash comparison against every row. The secret
 * is never stored. Only a scrypt hash of it is, with a per-code salt. If the
 * database is stolen, the codes in it cannot be redeemed.
 *
 * The plaintext code is printed once, here, and never again. Concludo cannot
 * recover a lost code, only revoke it and issue another. That is the point.
 *
 * Usage:
 *   node tools/grant-codes.mjs --count 5 --label "staff" --tier team --days 365
 *   node tools/grant-codes.mjs --count 1 --label "pilot: Acme" --tier pro_subscription --days 90
 *
 * Output:
 *   out/grant-codes-<timestamp>.txt   the plaintext codes. Hand these out, then delete the file.
 *   out/grant-codes-<timestamp>.sql   the INSERT statements. Safe to keep. Contains no secret.
 *
 * Never commit either file. Never paste a plaintext code into a document,
 * an issue, a chat log or an AI prompt.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Crockford base32 without I, L, O and U. No character can be misread as
 * another when a code is read aloud over the phone or copied off a screen.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Unbiased random string over ALPHABET. Rejection sampling, not modulo. */
function randomCode(length) {
  const out = [];
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < 248) {           // 248 = 31 * 8, the largest multiple of 32 under 256
        out.push(ALPHABET[b % 32]);
        if (out.length === length) break;
      }
    }
  }
  return out.join('');
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function hashSecret(secret, saltHex) {
  return scryptSync(secret, Buffer.from(saltHex, 'hex'), SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
  }).toString('hex');
}

/** Exported for the verification path. Constant time, so a wrong code leaks no timing signal. */
export function verifySecret(secret, saltHex, expectedHex) {
  const got = Buffer.from(hashSecret(secret, saltHex), 'hex');
  const want = Buffer.from(expectedHex, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli();
}

function runCli() {
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const count = Math.max(1, Math.min(200, parseInt(arg('count', '5'), 10)));
const label = arg('label', 'unlabelled');
const tier = arg('tier', 'team');
const days = Math.max(1, Math.min(3650, parseInt(arg('days', '365'), 10)));

const VALID_TIERS = new Set(['starter', 'pro_subscription', 'team']);
if (!VALID_TIERS.has(tier)) {
  console.error(`Invalid tier "${tier}". Valid: ${[...VALID_TIERS].join(', ')}.`);
  console.error('There is no Enterprise tier. Governance features are capability flags, granted alongside the tier.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const rows = [];
const plain = [];

for (let i = 0; i < count; i++) {
  const publicId = randomCode(8);       // ~40 bits, indexed, not secret
  const secret = randomCode(20);        // ~100 bits of entropy, never stored
  const salt = randomBytes(16).toString('hex');
  const hash = hashSecret(secret, salt);
  const code = `CONCLUDO-${publicId}-${secret.slice(0, 5)}-${secret.slice(5, 10)}-${secret.slice(10, 15)}-${secret.slice(15, 20)}`;

  plain.push(code);
  rows.push(
    `INSERT INTO public.access_grant_codes\n` +
    `  (public_id, secret_hash, secret_salt, hash_params, grants_tier, grants_capabilities,\n` +
    `   label, max_redemptions, expires_at)\n` +
    `VALUES\n` +
    `  ('${publicId}', '${hash}', '${salt}',\n` +
    `   '{"algorithm":"scrypt","N":${SCRYPT.N},"r":${SCRYPT.r},"p":${SCRYPT.p},"keylen":${SCRYPT.keylen}}'::jsonb,\n` +
    `   '${tier}', ARRAY['governance_policy','legal_hold','audit_log']::TEXT[],\n` +
    `   ${JSON.stringify(label).replace(/'/g, "''").replace(/^"|"$/g, "'")}, 1, now() + interval '${days} days');`
  );
}

mkdirSync(join(process.cwd(), 'out'), { recursive: true });
const txtPath = join(process.cwd(), 'out', `grant-codes-${stamp}.txt`);
const sqlPath = join(process.cwd(), 'out', `grant-codes-${stamp}.sql`);

writeFileSync(txtPath,
  `Concludo access grant codes\n` +
  `Generated ${new Date().toISOString()}\n` +
  `Label: ${label}\n` +
  `Grants: ${tier} plus governance_policy, legal_hold and audit_log capability flags\n` +
  `Single use. Expires in ${days} days. Binds to the first workspace that redeems it.\n\n` +
  plain.map((c, i) => `${String(i + 1).padStart(2, '0')}.  ${c}`).join('\n') +
  `\n\nHand each code to exactly one person. Delete this file once they are handed out.\n` +
  `Concludo cannot recover a lost code. Revoke it and issue another.\n`
);

writeFileSync(sqlPath,
  `-- Concludo access grant codes, seed statements.\n` +
  `-- Contains no secret. The plaintext codes exist only in the .txt file and\n` +
  `-- in the hands of the people you gave them to.\n` +
  `-- Label: ${label}   Tier: ${tier}   Expires: ${days} days   Count: ${count}\n\n` +
  rows.join('\n\n') + '\n'
);

console.log(`\n${count} code(s) generated.\n`);
console.log(`  Plaintext (hand out, then delete):  ${txtPath}`);
console.log(`  Seed SQL (safe to keep):            ${sqlPath}\n`);
console.log('The plaintext is printed once. It is not recoverable from the database.\n');

}
