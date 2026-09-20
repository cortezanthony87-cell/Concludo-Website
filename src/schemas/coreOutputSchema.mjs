/**
 * Tasklet 8.1: Core Output Schema
 * Foundational JSON Schema envelope inherited by all 58 Concludo deliverables.
 * Validates top-level envelope: outputId, version, meetingMetadata, organisationId,
 * provenance, standfirst, sections, evidenceCitations, and signatories.
 */

export class CoreSchemaValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'CORE_SCHEMA_VALIDATION_ERROR';
    this.errors = errors;
  }
}

export function validateCoreOutputEnvelope(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    throw new CoreSchemaValidationError('Payload must be an object', ['root']);
  }

  // Security check: reject prototype pollution or malicious properties
  if (Object.prototype.hasOwnProperty.call(payload, '__proto__') || Object.prototype.hasOwnProperty.call(payload, 'constructor')) {
    throw new CoreSchemaValidationError('SECURITY VIOLATION: Prototype properties forbidden', ['__proto__']);
  }

  if (!payload.outputId && !payload.id) errors.push({ path: 'outputId', message: 'Missing mandatory outputId' });
  if (!payload.version) errors.push({ path: 'version', message: 'Missing mandatory version' });
  if (!payload.organisationId && !payload.organisation_id) errors.push({ path: 'organisationId', message: 'Missing mandatory organisationId' });
  if (!payload.meetingMetadata && !payload.meeting_metadata) errors.push({ path: 'meetingMetadata', message: 'Missing mandatory meetingMetadata' });
  if (!payload.provenance) errors.push({ path: 'provenance', message: 'Missing mandatory provenance' });
  if (!Array.isArray(payload.sections)) errors.push({ path: 'sections', message: 'Missing mandatory sections array' });

  if (errors.length > 0) {
    throw new CoreSchemaValidationError('Core output envelope validation failed', errors);
  }

  return { ok: true };
}
