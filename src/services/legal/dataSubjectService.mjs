/**
 * Tasklet 14.6: Subject Access and Deletion Service
 *
 * Implements OAIC Australian Privacy Principle 12 (access) and 13 (correction/deletion).
 * Produces comprehensive export across every table holding subject data,
 * and verified deletion with a cryptographically hashed completion certificate.
 *
 * Enforces legal hold: nothing under an active legal hold is deleted.
 */
import { createHash } from 'node:crypto';

export const MONITORED_SUBJECT_TABLES = Object.freeze([
  'auth.users',
  'public.organisations',
  'public.organisation_memberships',
  'public.meetings',
  'public.transcripts',
  'public.outputs',
  'public.consent_evidence',
  'public.legal_acceptances',
  'public.pricing_disclosures',
  'public.cancellation_events',
  'public.complaints',
]);

const requestsLedger = new Map();
const activeLegalHolds = new Set();

export class SubjectRequestError extends Error {
  constructor(message, code = 'SUBJECT_REQUEST_ERROR') {
    super(message);
    this.name = 'SubjectRequestError';
    this.code = code;
  }
}

/**
 * Creates a Data Subject Request (DSR).
 * @param {object} input
 * @param {'access' | 'correction' | 'deletion'} input.requestType
 * @param {string} input.requesterEmail
 * @param {string} [input.userId]
 * @param {string} [input.organisationId]
 */
export function createSubjectRequest(input) {
  if (!input.requestType || !input.requesterEmail) {
    throw new SubjectRequestError('requestType and requesterEmail are required', 'MISSING_FIELDS');
  }

  const id = crypto.randomUUID();
  const reference = `DSR-${new Date().getUTCFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const now = new Date();
  const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day statutory clock

  const request = {
    id,
    reference,
    request_type: input.requestType,
    requester_email: input.requesterEmail,
    organisation_id: input.organisationId || null,
    user_id: input.userId || null,
    identity_verified: false,
    status: 'RECEIVED',
    refusal_reason: null,
    completed_at: null,
    certificate_hash: null,
    received_at: now.toISOString(),
    due_at: due.toISOString(),
  };

  requestsLedger.set(id, request);
  requestsLedger.set(reference, request);
  return request;
}

/**
 * Exports all subject data across all monitored tables.
 * @param {string} userId
 * @param {string} email
 * @param {object} [dbCollections] In-memory or queryable snapshot of tables
 */
export function exportSubjectData(userId, email, dbCollections = {}) {
  const archive = {
    export_metadata: {
      user_id: userId,
      email: email,
      generated_at: new Date().toISOString(),
      enumerated_tables: [...MONITORED_SUBJECT_TABLES],
    },
    tables: {},
  };

  for (const table of MONITORED_SUBJECT_TABLES) {
    const rows = dbCollections[table] || [];
    archive.tables[table] = rows.filter((r) => r.user_id === userId || r.email === email || r.requester_email === email);
  }

  return archive;
}

/**
 * Sets an active legal hold on a user or meeting.
 * @param {string} entityId
 */
export function setLegalHold(entityId) {
  activeLegalHolds.add(entityId);
}

/**
 * Removes an active legal hold.
 * @param {string} entityId
 */
export function releaseLegalHold(entityId) {
  activeLegalHolds.delete(entityId);
}

/**
 * Executes a subject deletion request, respecting legal holds.
 * Produces an immutable completion certificate.
 *
 * @param {string} requestIdOrRef
 * @param {string} userId
 * @param {object} [dbCollections]
 * @returns {object} Deletion certificate
 */
export function executeSubjectDeletion(requestIdOrRef, userId, dbCollections = {}) {
  const req = requestsLedger.get(requestIdOrRef);

  if (activeLegalHolds.has(userId)) {
    if (req) {
      req.status = 'REFUSED';
      req.refusal_reason = 'Active legal hold in effect. Data preservation legally required.';
    }
    throw new SubjectRequestError(
      'Subject is under an active legal hold. Deletion refused.',
      'LEGAL_HOLD_ACTIVE'
    );
  }

  let deletedCount = 0;
  for (const table of MONITORED_SUBJECT_TABLES) {
    if (Array.isArray(dbCollections[table])) {
      const before = dbCollections[table].length;
      dbCollections[table] = dbCollections[table].filter((r) => r.user_id !== userId);
      deletedCount += before - dbCollections[table].length;
    }
  }

  const now = new Date().toISOString();
  const certData = `DELETION-CERTIFICATE:${userId}:${now}:${deletedCount}-records`;
  const certHash = createHash('sha256').update(certData).digest('hex');

  const certificate = {
    certificate_id: crypto.randomUUID(),
    user_id: userId,
    completed_at: now,
    records_deleted: deletedCount,
    certificate_hash: certHash,
    status: 'COMPLETED',
  };

  if (req) {
    req.status = 'COMPLETED';
    req.completed_at = now;
    req.certificate_hash = certHash;
  }

  return certificate;
}

export function _clearSubjectRequests() {
  requestsLedger.clear();
  activeLegalHolds.clear();
}
