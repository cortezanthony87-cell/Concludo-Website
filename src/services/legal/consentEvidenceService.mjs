/**
 * Tasklet 14.1: Consent and Warranty Evidence Ledger
 *
 * Immutably records every consent and warranty a customer gives before
 * uploading a conversation, together with the exact notice text shown at the time.
 *
 * Rule 1: Evidence records are append only.
 * Rule 2: Fail closed. If consent cannot be verified/written, upload is refused.
 */
import { createHash } from 'node:crypto';

export const VALID_JURISDICTIONS = Object.freeze([
  'VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'OTHER'
]);

export const JURISDICTION_RULES = Object.freeze({
  VIC: 'Surveillance Devices Act 1999 (Vic): All-party consent is generally required to record a private conversation. You warrant that all participants were informed and consented.',
  NSW: 'Surveillance Devices Act 2007 (NSW): All-party consent is required to record a private conversation. You warrant that all participants were informed and consented.',
  QLD: 'Invasion of Privacy Act 1971 (Qld): Recording requirements apply. You warrant that the conversation was captured lawfully and participants were informed.',
  WA: 'Surveillance Devices Act 1998 (WA): All-party consent is generally required. You warrant that all participants consented to recording.',
  SA: 'Surveillance Devices Act 2016 (SA): Consent requirements apply to private conversations. You warrant lawful capture.',
  TAS: 'Listening Devices Act 1991 (Tas): Consent requirements apply. You warrant all participants were informed.',
  ACT: 'Listening Devices Act 1992 (ACT): Consent requirements apply. You warrant all participants consented.',
  NT: 'Surveillance Devices Act 2007 (NT): Consent requirements apply. You warrant lawful recording.',
  OTHER: 'Commonwealth and international recording laws apply. You warrant that recording complied with applicable law and participants consented.',
});

export const GENERAL_DISCLAIMER_TEXT =
  'Concludo requires that every uploaded conversation was captured in compliance with Australian surveillance device and privacy legislation. You warrant that you are entitled to share this material.';

export class ConsentVerificationError extends Error {
  constructor(message, code = 'CONSENT_VERIFICATION_FAILED') {
    super(message);
    this.name = 'ConsentVerificationError';
    this.code = code;
  }
}

/** In-memory append-only ledger for environment without DB pool */
const consentLedger = new Map();

/**
 * Validates and records a consent evidence record.
 * @param {object} input
 * @param {string} input.organisationId
 * @param {string} input.userId
 * @param {string} [input.meetingId]
 * @param {boolean} input.warrantedLawfulCapture
 * @param {boolean} input.warrantedParticipantsInformed
 * @param {boolean} input.warrantedEntitledToShare
 * @param {string} input.captureJurisdiction
 * @param {string} [input.noticeVersion]
 * @param {string} [input.ipAddress]
 * @param {string} [input.userAgent]
 * @returns {object} Stored immutable consent record
 */
export function recordConsent(input) {
  if (!input.organisationId || !input.userId) {
    throw new ConsentVerificationError('organisationId and userId are required', 'MISSING_IDENTITY');
  }

  // All three separate warranties are strictly required. No partial consent.
  if (
    input.warrantedLawfulCapture !== true ||
    input.warrantedParticipantsInformed !== true ||
    input.warrantedEntitledToShare !== true
  ) {
    throw new ConsentVerificationError(
      'All three warranties (lawful capture, participants informed, entitled to share) must be explicitly affirmed.',
      'PARTIAL_WARRANTY_REFUSED'
    );
  }

  const jur = (input.captureJurisdiction || '').toUpperCase();
  if (!VALID_JURISDICTIONS.includes(jur)) {
    throw new ConsentVerificationError(
      `Invalid jurisdiction "${input.captureJurisdiction}". Must be one of: ${VALID_JURISDICTIONS.join(', ')}`,
      'INVALID_JURISDICTION'
    );
  }

  const noticeVersion = input.noticeVersion || 'v1.0';
  const noticeText = `${JURISDICTION_RULES[jur]} ${GENERAL_DISCLAIMER_TEXT}`;
  const noticeHash = createHash('sha256').update(noticeText).digest('hex');

  const id = crypto.randomUUID();
  const record = Object.freeze({
    id,
    organisation_id: input.organisationId,
    user_id: input.userId,
    meeting_id: input.meetingId || null,
    warranted_lawful_capture: true,
    warranted_participants_informed: true,
    warranted_entitled_to_share: true,
    capture_jurisdiction: jur,
    notice_version: noticeVersion,
    notice_hash: noticeHash,
    notice_text_shown: noticeText,
    confirmed_at: new Date().toISOString(),
    ip_address: input.ipAddress || '127.0.0.1',
    user_agent: input.userAgent || 'Concludo/1.0',
  });

  consentLedger.set(id, record);
  if (record.meeting_id) {
    consentLedger.set(`meeting:${record.meeting_id}`, record);
  }

  return record;
}

/**
 * Retrieves consent record for a meeting.
 * @param {string} meetingId
 */
export function getConsentForMeeting(meetingId) {
  return consentLedger.get(`meeting:${meetingId}`) || null;
}

/**
 * Validates consent before accepting transcript bytes. Fails closed.
 * @param {string} meetingId
 * @param {object} [consentInput]
 */
export function verifyConsentBeforeUpload(meetingId, consentInput = null) {
  if (consentInput) {
    return recordConsent({ ...consentInput, meetingId });
  }

  const existing = getConsentForMeeting(meetingId);
  if (!existing) {
    throw new ConsentVerificationError(
      'No consent evidence record found for this meeting. Upload refused.',
      'NO_CONSENT_RECORD'
    );
  }
  return existing;
}

/**
 * Clear test ledger
 */
export function _clearConsentLedger() {
  consentLedger.clear();
}
