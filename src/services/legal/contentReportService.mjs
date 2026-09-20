/**
 * Tasklet 14.5: Content Refusal and Takedown Service
 *
 * Provides fast, recorded refusal and takedown for material reported as unlawfully
 * obtained or infringing.
 *
 * Public intake requires no account.
 * Reported content enters a mandatory preservation hold and is suspended from all access.
 */

const reportsLedger = new Map();
const suspendedMeetings = new Set();

export class ContentReportError extends Error {
  constructor(message, code = 'CONTENT_REPORT_ERROR') {
    super(message);
    this.name = 'ContentReportError';
    this.code = code;
  }
}

/**
 * Files a content report from public intake. No account required.
 * @param {object} input
 * @param {string} input.reportType 'unlawful_capture' | 'no_consent' | 'confidential_material' | 'other'
 * @param {string} input.reportDetail
 * @param {string} [input.reportedByEmail]
 * @param {boolean} [input.reporterIsParticipant]
 * @param {string} [input.meetingId]
 * @param {string} [input.organisationId]
 */
export function fileContentReport(input) {
  if (!input.reportType || !input.reportDetail) {
    throw new ContentReportError('reportType and reportDetail are required', 'MISSING_REPORT_FIELDS');
  }

  const validTypes = ['unlawful_capture', 'no_consent', 'confidential_material', 'other'];
  if (!validTypes.includes(input.reportType)) {
    throw new ContentReportError(`Invalid report type: ${input.reportType}`, 'INVALID_REPORT_TYPE');
  }

  const id = crypto.randomUUID();
  const reference = `CR-${new Date().getUTCFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const report = {
    id,
    reference,
    organisation_id: input.organisationId || null,
    meeting_id: input.meetingId || null,
    reported_by_email: input.reportedByEmail || null,
    reporter_is_participant: Boolean(input.reporterIsParticipant),
    report_type: input.reportType,
    report_detail: input.reportDetail,
    status: 'RECEIVED',
    assessed_by: null,
    assessed_at: null,
    outcome_reason: null,
    content_suspended_at: null,
    preservation_hold: true, // Default true: never purged by retention
    received_at: new Date().toISOString(),
  };

  reportsLedger.set(id, report);
  reportsLedger.set(reference, report);

  // Automatically suspend immediately upon unlawful capture report pending review
  if (input.meetingId && (input.reportType === 'unlawful_capture' || input.reportType === 'no_consent')) {
    suspendMeeting(input.meetingId, `Automated safety suspension following intake report ${reference}`);
    report.content_suspended_at = new Date().toISOString();
    report.status = 'SUSPENDED';
  }

  return report;
}

/**
 * Suspends a meeting and its outputs from all read, export, and search paths.
 * @param {string} meetingId
 * @param {string} reason
 */
export function suspendMeeting(meetingId, reason = 'Reported content under assessment') {
  suspendedMeetings.add(meetingId);
}

/**
 * Checks if a meeting is suspended.
 * @param {string} meetingId
 */
export function isMeetingSuspended(meetingId) {
  return suspendedMeetings.has(meetingId);
}

/**
 * Resolves a content report with mandatory outcome and reasoning.
 * @param {string} reportIdOrRef
 * @param {object} resolution
 * @param {string} resolution.status 'UPHELD' | 'DISMISSED'
 * @param {string} resolution.outcomeReason
 * @param {string} resolution.assessedBy
 */
export function resolveContentReport(reportIdOrRef, resolution) {
  const report = reportsLedger.get(reportIdOrRef);
  if (!report) {
    throw new ContentReportError('Report not found', 'REPORT_NOT_FOUND');
  }
  if (!resolution.outcomeReason || resolution.outcomeReason.trim().length < 5) {
    throw new ContentReportError('outcomeReason is mandatory when closing a report', 'MANDATORY_REASONING_MISSING');
  }
  if (!['UPHELD', 'DISMISSED'].includes(resolution.status)) {
    throw new ContentReportError('status must be UPHELD or DISMISSED', 'INVALID_STATUS');
  }

  report.status = resolution.status;
  report.outcome_reason = resolution.outcomeReason;
  report.assessed_by = resolution.assessedBy || 'compliance-officer';
  report.assessed_at = new Date().toISOString();

  if (resolution.status === 'UPHELD' && report.meeting_id) {
    suspendedMeetings.add(report.meeting_id);
  } else if (resolution.status === 'DISMISSED' && report.meeting_id) {
    suspendedMeetings.delete(report.meeting_id);
  }

  return report;
}

/**
 * Checks if a meeting has an active preservation hold (retention purge worker must skip).
 * @param {string} meetingId
 */
export function hasPreservationHold(meetingId) {
  for (const r of reportsLedger.values()) {
    if (r.meeting_id === meetingId && r.preservation_hold) {
      return true;
    }
  }
  return false;
}

export function _clearReports() {
  reportsLedger.clear();
  suspendedMeetings.clear();
}
