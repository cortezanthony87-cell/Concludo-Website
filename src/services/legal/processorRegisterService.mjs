/**
 * Tasklet 14.8: Processor Register and Region Enforcement
 *
 * Tracks every sub-processor handling personal data under Australian Privacy Principle 8.
 * Enforces Australian data residency with a loud startup assertion.
 */

export const AUTHORISED_DATA_PROCESSORS = Object.freeze([
  {
    processor_name: 'Supabase Inc (AWS ap-southeast-2 Sydney)',
    purpose: 'Primary database, authentication, and encrypted document storage',
    data_categories: ['Account profiles', 'Meeting transcripts', 'Generated outputs'],
    country: 'Australia',
    is_overseas: false,
    dpa_in_place: true,
  },
  {
    processor_name: 'Anthropic PBC',
    purpose: 'Zero-retention model extraction and deterministic summarisation',
    data_categories: ['Meeting transcript excerpts'],
    country: 'United States',
    is_overseas: true,
    dpa_in_place: true,
  },
]);

export class DataResidencyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataResidencyError';
    this.code = 'DATA_RESIDENCY_VIOLATION';
  }
}

/**
 * Asserts that the configured database region is an Australian region (Sydney ap-southeast-2).
 * Fails loudly if configured outside Australia.
 * @param {string} region
 */
export function assertAustralianDataResidency(region = 'ap-southeast-2') {
  const australianRegions = ['ap-southeast-2', 'sydney', 'australia-southeast1'];
  const normalized = (region || '').toLowerCase().trim();

  if (!australianRegions.includes(normalized)) {
    const errorMsg = `CRITICAL DATA RESIDENCY VIOLATION: Database region is configured as "${region}", which is NOT an Australian region. All customer personal information must reside in Australia.`;
    console.error(errorMsg);
    throw new DataResidencyError(errorMsg);
  }
  return true;
}

/**
 * Validates that an outbound integration is formally registered.
 * @param {string} integrationName
 */
export function isProcessorRegistered(integrationName) {
  return AUTHORISED_DATA_PROCESSORS.some((p) =>
    p.processor_name.toLowerCase().includes(integrationName.toLowerCase())
  );
}

/**
 * Returns public processor list for legal disclosures.
 */
export function getPublicProcessors() {
  return AUTHORISED_DATA_PROCESSORS.map((p) => ({
    name: p.processor_name,
    purpose: p.purpose,
    country: p.country,
    is_overseas: p.is_overseas,
    dpa_in_place: p.dpa_in_place,
  }));
}
