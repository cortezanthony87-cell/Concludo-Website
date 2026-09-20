import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..');

export const EXTRACT_PATH = join(ROOT, 'registry', 'registry.t1.json');
export const FULL_REGISTRY_PATH = join(ROOT, 'registry', 'Concludo_Output_Registry_v1.json');

/** The T1 extract. Derived from the full registry, which is authoritative. */
export const registry = JSON.parse(readFileSync(EXTRACT_PATH, 'utf8'));

/** The full registry, when it has been placed in registry/. Null otherwise. */
export function loadFullRegistry() {
  if (!existsSync(FULL_REGISTRY_PATH)) return null;
  return JSON.parse(readFileSync(FULL_REGISTRY_PATH, 'utf8'));
}

export const schema = JSON.parse(
  readFileSync(join(ROOT, 'schema', 'meeting_record.v1_1.schema.json'), 'utf8')
);

export const ENGINE_VERSION = 'concludo-t1-0.1.0';
