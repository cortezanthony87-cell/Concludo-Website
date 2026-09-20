/**
 * Tasklet 14.11: Complaint and Dispute Register
 *
 * Implements ISO 10002 complaint handling:
 * 1. Automatic reference generation.
 * 2. Statutory deadlines: acknowledgment within 2 days, resolution within 30 days.
 * 3. Cannot close without a documented outcome and resolution reasoning.
 */

const complaintsLedger = new Map();

export class ComplaintError extends Error {
  constructor(message, code = 'COMPLAINT_ERROR') {
    super(message);
    this.name = 'ComplaintError';
    this.code = code;
  }
}

/**
 * Files a formal complaint.
 * @param {object} input
 * @param {'privacy' | 'refund' | 'accessibility' | 'service' | 'billing' | 'content' | 'other'} input.complaintType
 * @param {string} input.complainantEmail
 * @param {string} input.detail
 * @param {string} [input.organisationId]
 */
export function fileComplaint(input) {
  if (!input.complaintType || !input.complainantEmail || !input.detail) {
    throw new ComplaintError('Missing required complaint fields', 'MISSING_FIELDS');
  }

  const id = crypto.randomUUID();
  const reference = `CMP-${new Date().getUTCFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const now = new Date();
  const ackDue = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
  const respDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const complaint = {
    id,
    reference,
    complaint_type: input.complaintType,
    complainant_email: input.complainantEmail,
    organisation_id: input.organisationId || null,
    detail: input.detail,
    status: 'ACKNOWLEDGED',
    acknowledged_at: now.toISOString(),
    resolved_at: null,
    outcome: null,
    escalated_to: null,
    received_at: now.toISOString(),
    acknowledge_due_at: ackDue.toISOString(),
    respond_due_at: respDue.toISOString(),
    acknowledgement_message: `Thank you for contacting Concludo Pty Ltd. Your complaint has been received and logged under reference ${reference}. Our team will review and provide a formal response within 30 days.`,
  };

  complaintsLedger.set(id, complaint);
  complaintsLedger.set(reference, complaint);
  return complaint;
}

/**
 * Resolves a complaint. Mandatory outcome required.
 * @param {string} idOrRef
 * @param {string} outcome
 */
export function resolveComplaint(idOrRef, outcome) {
  const complaint = complaintsLedger.get(idOrRef);
  if (!complaint) {
    throw new ComplaintError('Complaint not found', 'NOT_FOUND');
  }
  if (!outcome || outcome.trim().length < 10) {
    throw new ComplaintError(
      'Complaints cannot be closed without a documented outcome and rationale.',
      'MANDATORY_OUTCOME_MISSING'
    );
  }

  complaint.status = 'RESOLVED';
  complaint.resolved_at = new Date().toISOString();
  complaint.outcome = outcome;
  return complaint;
}

export function _clearComplaints() {
  complaintsLedger.clear();
}
