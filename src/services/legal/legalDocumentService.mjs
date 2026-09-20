/**
 * Tasklet 14.2: Versioned Legal Document Service
 *
 * Manages versioned terms, privacy policy, acceptable use, and refund policies.
 * Records user acceptances with immutable content hashing and timestamps.
 */
import { createHash } from 'node:crypto';

export const VALID_DOCUMENT_TYPES = Object.freeze([
  'terms',
  'privacy',
  'acceptable_use',
  'refund',
  'organisation_licence',
  'data_processing',
]);

const documentsLedger = new Map();
const acceptancesLedger = new Map();

export class LegalDocumentError extends Error {
  constructor(message, code = 'LEGAL_DOCUMENT_ERROR') {
    super(message);
    this.name = 'LegalDocumentError';
    this.code = code;
  }
}

/**
 * Publishes a new version of a legal document.
 * @param {string} documentType
 * @param {string} version
 * @param {string} content
 * @param {string} [publishedBy]
 */
export function publishDocument(documentType, version, content, publishedBy = null) {
  if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
    throw new LegalDocumentError(`Invalid document type: ${documentType}`, 'INVALID_DOCUMENT_TYPE');
  }
  if (!version || !content) {
    throw new LegalDocumentError('Version and content are required', 'MISSING_CONTENT');
  }

  const contentHash = createHash('sha256').update(content).digest('hex');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Supersede previous current version
  for (const doc of documentsLedger.values()) {
    if (doc.document_type === documentType && !doc.superseded_at) {
      doc.superseded_at = now;
    }
  }

  const docRecord = {
    id,
    document_type: documentType,
    version,
    content,
    content_hash: contentHash,
    effective_from: now,
    superseded_at: null,
    published_by: publishedBy,
    created_at: now,
  };

  documentsLedger.set(id, Object.freeze(docRecord));
  return docRecord;
}

/**
 * Gets the current active version of a legal document.
 * @param {string} documentType
 */
export function getCurrentDocument(documentType) {
  for (const doc of documentsLedger.values()) {
    if (doc.document_type === documentType && !doc.superseded_at) {
      return doc;
    }
  }
  return null;
}

/**
 * Records an immutable user acceptance of a legal document.
 * @param {object} input
 * @param {string} input.legalDocumentId
 * @param {string} input.organisationId
 * @param {string} input.userId
 * @param {string} [input.acceptanceMethod]
 * @param {string} [input.ipAddress]
 * @param {string} [input.userAgent]
 */
export function recordAcceptance(input) {
  const doc = documentsLedger.get(input.legalDocumentId);
  if (!doc) {
    throw new LegalDocumentError('Referenced legal document does not exist', 'DOCUMENT_NOT_FOUND');
  }
  if (!input.organisationId || !input.userId) {
    throw new LegalDocumentError('organisationId and userId are required', 'MISSING_IDENTITY');
  }

  const id = crypto.randomUUID();
  const acceptanceRecord = Object.freeze({
    id,
    legal_document_id: input.legalDocumentId,
    document_type: doc.document_type,
    version_accepted: doc.version,
    content_hash: doc.content_hash,
    organisation_id: input.organisationId,
    user_id: input.userId,
    accepted_at: new Date().toISOString(),
    ip_address: input.ipAddress || '127.0.0.1',
    user_agent: input.userAgent || 'Concludo/1.0',
    acceptance_method: input.acceptanceMethod || 'clickwrap',
  });

  acceptancesLedger.set(id, acceptanceRecord);
  return acceptanceRecord;
}

/**
 * Checks if a user has accepted the current version of a document type.
 * @param {string} userId
 * @param {string} documentType
 */
export function hasAcceptedCurrent(userId, documentType) {
  const current = getCurrentDocument(documentType);
  if (!current) return true; // None published yet

  for (const acc of acceptancesLedger.values()) {
    if (acc.user_id === userId && acc.legal_document_id === current.id) {
      return true;
    }
  }
  return false;
}

/**
 * Clears test ledger
 */
export function _clearLegalLedger() {
  documentsLedger.clear();
  acceptancesLedger.clear();
}
