/**
 * The T1 pipeline, Appendix A steps 1 to 4.
 *
 *   record -> validate -> health -> select (four gates) -> render
 *
 * Validation can degrade. It can never invent. If the repair pass fails the
 * system produces less and says so.
 */
import { validateRecord } from './validate.mjs';
import { scoreHealth } from './health.mjs';
import { selectOutputs, resolveVariant } from './gates.mjs';
import { renderMeetingReport } from './render/t2-meeting-report.mjs';
import { checkGeneratedText } from './language.mjs';
import { registry, ENGINE_VERSION } from './registry.mjs';

export function run(record, opts = {}) {
  const validation = validateRecord(record);
  if (!validation.ok) {
    return {
      ok: false,
      stage: 'validation',
      validation,
      degraded: {
        message:
          'Extraction did not validate. The source record and a stated failure are returned. No partial document is produced silently.',
        blocking: validation.blocking,
      },
    };
  }

  const variant = resolveVariant(record, opts);
  const restricted = variant.variant === 'restricted';

  const health = scoreHealth(record, { restricted });

  const plan = selectOutputs(record, {
    restricted,
    healthScoreable: health.scored,
    scoreableWeight: health.health?.scoreable_weight ?? 0,
  });

  const html = renderMeetingReport({ record, plan, health, generatedAt: opts.generatedAt ?? new Date() });

  // The brand and language suite runs on rendered text, not on the template source.
  const text = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  const language = checkGeneratedText(text, { namesPlatformOrDevice: false });

  return {
    ok: true,
    validation,
    health,
    plan,
    html,
    language,
    provenance: {
      registry_version: registry.registry_version,
      engine_version: ENGINE_VERSION,
      deterministic_stages: ['validation', 'health', 'selection', 'rendering'],
    },
  };
}
