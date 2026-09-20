/**
 * Tasklet 11.8: Board Reporting Standards Validation
 * Tasklet 11.9: Compliance Controls and DLP Engine
 * Tasklet 11.10: Governance Observation (Tier T4)
 */

export class StatutoryFormatDefectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'STATUTORY_FORMAT_DEFECT';
  }
}

export class QuorumDeficiencyObservedError extends Error {
  constructor(message = 'Quorum was not evidenced in the meeting record') {
    super(message);
    this.name = 'QUORUM_DEFICIENCY_OBSERVED';
  }
}

export class BoardStandardsValidator {
  constructor() {
    this.mandatoryNotice = 'Requires qualified review: Concludo records observations and findings as stated and attributed; it does not produce board minutes or provide legal advice.';
  }

  validateBoardPaper(boardPayload) {
    if (!boardPayload) throw new Error('Board payload is required');

    // Strict rule: artefact is never labelled minutes
    const title = (boardPayload.title || '').toLowerCase();
    if (title.includes('board minutes') || title.includes('minutes of meeting')) {
      throw new StatutoryFormatDefectError('Artefact cannot be labelled minutes. Concludo produces working records and briefing papers only.');
    }

    const motions = boardPayload.motions || [];
    for (const m of motions) {
      if (!m.motion && !m.text) {
        throw new StatutoryFormatDefectError(`Motion ${m.id || 'unassigned'} missing substantive motion text`);
      }
    }

    return {
      ok: true,
      hasMandatoryNotice: true,
      noticeText: this.mandatoryNotice,
      validatedMotionsCount: motions.length,
    };
  }
}

export class DlpScannerService {
  constructor() {
    this.ccRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/g; // 16 digit cards
    this.tfnRegex = /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g; // 9 digit Australian TFNs
    this.apiKeyRegex = /\b(?:sk_live_[0-9a-zA-Z]{24,}|ey[A-Za-z0-9_-]{30,}|ghp_[0-9a-zA-Z]{36})\b/g;
    this.passwordRegex = /password\s*[:=]\s*["']?([^\s"']{8,})["']?/gi;
    this.securityAlerts = [];
  }

  scanAndRedactText(text) {
    if (!text || typeof text !== 'string') return { redactedText: text, redactionCount: 0 };

    let redacted = text;
    let count = 0;

    // Redact Credit Cards
    if (this.ccRegex.test(redacted)) {
      redacted = redacted.replace(this.ccRegex, '[REDACTED_PAYMENT_CARD]');
      count++;
    }

    // Redact TFN
    if (this.tfnRegex.test(redacted)) {
      redacted = redacted.replace(this.tfnRegex, '[REDACTED_TFN]');
      count++;
    }

    // Redact API Keys
    if (this.apiKeyRegex.test(redacted)) {
      redacted = redacted.replace(this.apiKeyRegex, '[REDACTED_API_KEY]');
      count++;
      this.securityAlerts.push({
        event: 'CRITICAL_CREDENTIAL_LEAKAGE_PREVENTED',
        type: 'API_KEY',
        timestamp: new Date().toISOString(),
      });
    }

    // Redact Passwords
    if (this.passwordRegex.test(redacted)) {
      redacted = redacted.replace(this.passwordRegex, 'password: "[REDACTED_CREDENTIAL]"');
      count++;
      this.securityAlerts.push({
        event: 'CRITICAL_CREDENTIAL_LEAKAGE_PREVENTED',
        type: 'PASSWORD',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      redactedText: redacted,
      redactionCount: count,
      hasRedactions: count > 0,
      readerNotice: count > 0 ? `[Notice: ${count} sensitive item(s) redacted by Concludo DLP Guard]` : null,
    };
  }
}

export class GovernanceObservationEngine {
  constructor() {
    this.mandatoryNotice = 'Requires qualified review: Concludo records observations and findings as stated and attributed; it does not assess compliance, interpret statutory obligations, or rate internal control effectiveness.';
  }

  recordObservations(meetingData, userCapabilities = []) {
    // Strictly gated on the governance_policy capability flag
    if (!userCapabilities.includes('governance_policy')) {
      throw new Error('ACCESS_DENIED: Governance observations require governance_policy capability flag.');
    }

    const quorumEvidenced = !!meetingData.quorum_evidenced;
    const conflictsLogged = !!meetingData.conflicts_of_interest_logged;
    const decisions = meetingData.decisions || [];

    const authorityLimitFlags = [];
    for (const d of decisions) {
      if (d.expenditure_aud && d.delegated_limit_aud && d.expenditure_aud > d.delegated_limit_aud) {
        authorityLimitFlags.push({
          decisionId: d.id,
          expenditure: d.expenditure_aud,
          limit: d.delegated_limit_aud,
          flag: `Expenditure of $${d.expenditure_aud} exceeds stated delegated authority limit of $${d.delegated_limit_aud}.`,
        });
      }
    }

    const diagnosticNotices = [];
    if (!quorumEvidenced) {
      diagnosticNotices.push('Quorum was not evidenced in the meeting record.');
    }

    return {
      quorum_evidenced: quorumEvidenced,
      conflicts_of_interest_logged: conflictsLogged,
      authority_limit_flags_count: authorityLimitFlags.length,
      authority_limit_flags: authorityLimitFlags,
      diagnostic_notices: diagnosticNotices,
      mandatory_note: this.mandatoryNotice,
      tier: 'T4',
    };
  }
}
