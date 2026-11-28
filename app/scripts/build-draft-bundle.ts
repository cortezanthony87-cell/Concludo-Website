/**
 * Builds the single JS file the Supabase function imports.
 * The browser client keeps MODEL_ROUTE_ENABLED = false. Only this server bundle flips it, by
 * rewriting that one constant while bundling. No source file is changed.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const out = '../supabase/functions/draft-meeting-record/engine.bundle.js';
const res = await Bun.build({
  entrypoints: ['src/lib/intelligence/serverDraft.ts'],
  target: 'node',
  format: 'esm',
  minify: false,
  plugins: [
    {
      name: 'enable-model-route',
      setup(b) {
        b.onLoad({ filter: /modelDraftClient\.ts$/ }, async (a) => {
          const src = await Bun.file(a.path).text();
          const flipped = src.replace('export const MODEL_ROUTE_ENABLED: boolean = false;', 'export const MODEL_ROUTE_ENABLED: boolean = true;');
          if (flipped === src) throw new Error('MODEL_ROUTE_ENABLED constant not found');
          return { contents: flipped, loader: 'ts' };
        });
      },
    },
  ],
});
if (!res.success) { console.error(res.logs); process.exit(1); }
const code = await res.outputs[0].text();
writeFileSync(out, code);
console.log('bundle', out, code.length, 'bytes sha256', createHash('sha256').update(readFileSync(out)).digest('hex'));
