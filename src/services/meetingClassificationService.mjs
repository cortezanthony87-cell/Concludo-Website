/**
 * Tasklet 1.3: Meeting Classification Consumption
 *
 * Ingests the meeting classification taxonomy from Stage 7 and maps meetings
 * to archetypes, intents, and recommended candidate output packages.
 */
import { loadFullRegistry, registry } from '../registry.mjs';

export function getMeetingTaxonomy() {
  const full = loadFullRegistry();
  return {
    types: full?.taxonomy?.types ?? [],
    families: full?.taxonomy?.families ?? [],
    objectives: full?.taxonomy?.objectives ?? [],
    bundles: full?.bundles ?? [],
  };
}

export function classifyMeeting(meetingId, metadata = {}) {
  const taxonomy = getMeetingTaxonomy();
  const rawType = metadata.meeting_type || metadata.type_primary;
  
  // Find matching archetype
  const matchedType = taxonomy.types.find(
    (t) => t.id === rawType || t.name.toLowerCase() === String(rawType || '').toLowerCase()
  ) || taxonomy.types[0] || {
    id: 'MT-A01',
    name: 'Executive Strategy Session',
    family: 'A',
    default_objective: 'decide',
    restricted: false,
  };

  const objective = metadata.objective || matchedType.default_objective || 'decide';
  
  // Find candidate scenario bundle (out of 34 standard scenarios)
  const bundle = taxonomy.bundles.find(
    (b) => b.type === matchedType.id && b.objective === objective
  ) || taxonomy.bundles.find((b) => b.type === matchedType.id) || taxonomy.bundles[0];

  const isRestricted = Boolean(
    matchedType.restricted ||
    (metadata.restricted_categories && metadata.restricted_categories.length > 0) ||
    registry.restricted_path.applies_to_types.includes(matchedType.id)
  );

  return {
    meeting_id: meetingId,
    archetype_id: matchedType.id,
    archetype_name: matchedType.name,
    family: matchedType.family,
    objective,
    restricted: isRestricted,
    recommended_bundle: {
      scenario: bundle?.scenario ?? 'S01',
      mandatory_outputs: bundle?.mandatory ?? ['OUT-01'],
      conditional_outputs: bundle?.conditional ?? [],
      visuals: bundle?.visuals ?? [],
      primary_reader: bundle?.primary_reader ?? 'team',
    },
    classified_at: new Date().toISOString(),
  };
}
