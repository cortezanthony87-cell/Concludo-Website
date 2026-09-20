/**
 * Phase 11 Test Suite: Enterprise Readiness
 * Covers Tasklets 11.1 through 11.10.
 */

import { EnterpriseAuditService, GovernancePolicyGatekeeper, GovernanceGateBlockedError } from '../src/services/enterprise/enterpriseAuditService.mjs';
import { RetentionLifecycleWorker, LegalHoldEngine, OutputImmutabilityService, OutputPublishedImmutableError } from '../src/services/enterprise/retentionLifecycleWorker.mjs';
import { OutputTraceabilityService, ReportingStandardsValidator, MandatoryDisclaimerMissingError } from '../src/services/enterprise/outputTraceabilityService.mjs';
import { BoardStandardsValidator, DlpScannerService, GovernanceObservationEngine, StatutoryFormatDefectError } from '../src/services/enterprise/boardStandardsValidator.mjs';

export async function runPhase11Tests(check) {
  // --- Tasklet 11.1: Comprehensive Auditability Service ---
  {
    const auditService = new EnterpriseAuditService();
    auditService.logEvent({
      organisation_id: 'org_1',
      actor_id: 'user_1',
      action_type: 'OUTPUT_GENERATED',
      resource_type: 'output',
      resource_id: 'out_1',
    });
    auditService.logEvent({
      organisation_id: 'org_1',
      actor_id: 'user_1',
      action_type: 'OUTPUT_VIEWED',
      resource_type: 'output',
      resource_id: 'out_1',
    });

    const chainValid = auditService.verifyChainIntegrity();
    check('Phase 11', '11.1 audit log verifies SHA-256 tamper-evident hash chain', chainValid.ok && chainValid.verifiedEntries === 2);

    // Tamper with row data
    auditService.logEntries[0].action_type = 'UNAUTHORIZED_MUTATION';
    const chainBroken = auditService.verifyChainIntegrity();
    check('Phase 11', '11.1 audit service detects hash chain tampering', !chainBroken.ok && chainBroken.error.includes('Tamper hash'));
  }

  // --- Tasklet 11.2: Governance Controls and Gatekeeper ---
  {
    const gatekeeper = new GovernancePolicyGatekeeper();
    gatekeeper.addPolicy('org_1', {
      policy_code: 'BOARD_SIGN_OFF_REQUIRED',
      policy_name: 'Board Paper Review Policy',
      is_mandatory: true,
    });

    let gateBlocked = false;
    try {
      gatekeeper.evaluatePublishAction('org_1', {
        template_id: 'T14',
        has_board_approval: false,
      });
    } catch (e) {
      if (e instanceof GovernanceGateBlockedError) gateBlocked = true;
    }
    check('Phase 11', '11.2 governance gatekeeper blocks publication of unapproved board paper', gateBlocked);

    const approvedPub = gatekeeper.evaluatePublishAction('org_1', {
      template_id: 'T14',
      has_board_approval: true,
    });
    check('Phase 11', '11.2 approved board paper passes governance gate', approvedPub.permitted);
  }

  // --- Tasklet 11.3: Retention Controls and Soft Delete Lifecycle ---
  {
    const worker = new RetentionLifecycleWorker();
    const now = Date.now();
    const fortyDaysAgo = now - (40 * 86400000);
    const tenDaysAgo = now - (10 * 86400000);

    // Expired soft-deleted record (past 30 days)
    worker.addRecord({ id: 'rec_expired', deleted_at: new Date(fortyDaysAgo).toISOString(), purge_after: new Date(tenDaysAgo).toISOString() });
    // Soft-deleted record still within 30-day recovery window
    worker.addRecord({ id: 'rec_recent', deleted_at: new Date(tenDaysAgo).toISOString(), purge_after: new Date(now + (20 * 86400000)).toISOString() });
    // Active record
    worker.addRecord({ id: 'rec_active', deleted_at: null, purge_after: null });

    const purgeRes = worker.runPurgeCycle(now);
    check('Phase 11', '11.3 retention worker purges records past 30 days and retains recent ones',
      purgeRes.purgedCount === 1 && purgeRes.survivingCount === 2);
  }

  // --- Tasklet 11.4: Legal Hold Compatibility Engine ---
  {
    const holdEngine = new LegalHoldEngine();
    const holdCase = holdEngine.applyLegalHold({
      case_reference: 'CASE-2026-001',
      case_title: 'ASIC Review',
      organisation_id: 'org_1',
    }, ['out_held_1', 'out_held_2']);

    check('Phase 11', '11.4 legal hold freezes resources under case reference', holdEngine.isResourceHeld('out_held_1'));

    // Retention worker respects legal hold
    const workerWithHold = new RetentionLifecycleWorker();
    const now = Date.now();
    workerWithHold.addRecord({
      id: 'out_held_1',
      deleted_at: new Date(now - (40 * 86400000)).toISOString(),
      purge_after: new Date(now - (10 * 86400000)).toISOString(),
      legal_hold: true,
    });

    const holdPurgeRes = workerWithHold.runPurgeCycle(now);
    check('Phase 11', '11.4 active legal hold suspends automated retention purge',
      holdPurgeRes.purgedCount === 0 && holdPurgeRes.survivingCount === 1);

    holdEngine.releaseLegalHold(holdCase.id, 'Investigation concluded');
    check('Phase 11', '11.4 releasing legal hold unfreezes resources', !holdEngine.isResourceHeld('out_held_1'));
  }

  // --- Tasklet 11.5: Output Versioning and Immutability ---
  {
    const immutability = new OutputImmutabilityService();
    immutability.saveOutput({
      id: 'out_pub_1',
      title: 'Published Board Pack',
      lifecycle_state: 'PUBLISHED',
      version: 1,
    });

    let editBlocked = false;
    try {
      immutability.updateOutput('out_pub_1', { title: 'Altered Title' });
    } catch (e) {
      if (e instanceof OutputPublishedImmutableError) editBlocked = true;
    }
    check('Phase 11', '11.5 published outputs are strictly immutable and reject in-place updates', editBlocked);

    const branched = immutability.branchNewVersion('out_pub_1', { title: 'Updated Board Pack v2' }, 'user_anthony');
    check('Phase 11', '11.5 modifying published output creates version 2 branch leaving prior version immutable',
      branched.version === 2 && branched.parent_output_id === 'out_pub_1' && branched.lifecycle_state === 'DRAFT_GENERATED');
  }

  // --- Tasklet 11.6: End-to-End Output Traceability ---
  {
    const traceService = new OutputTraceabilityService();
    traceService.registerTrace('para_01', {
      turnId: 'turn_44',
      audioOffsetMs: 142000,
      timestampStart: '02:22',
      timestampEnd: '02:35',
      speakerSlot: 'Participant [A]',
    });

    const trace = traceService.traceParagraph('para_01');
    check('Phase 11', '11.6 substantive paragraph resolves to underlying transcript turn in under 30ms',
      trace.resolvedInMs < 30 && trace.turnId === 'turn_44');
  }

  // --- Tasklet 11.7: Enterprise Reporting Standards Validation ---
  {
    const validator = new ReportingStandardsValidator();
    const validHtml = `
      <html>
        <body>
          <p>We used Microsoft Teams to meet.</p>
          <p>Concludo is independent of Zoom, Microsoft Teams, Google Meet, and recorder manufacturers.</p>
          <footer>Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898)</footer>
        </body>
      </html>
    `;
    check('Phase 11', '11.7 reporting standards validator approves compliant document', validator.validateDocumentStandards(validHtml).compliant);

    const strippedIndependenceHtml = `
      <html>
        <body>
          <p>We used Microsoft Teams to meet.</p>
          <footer>Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898)</footer>
        </body>
      </html>
    `;
    let independenceMissing = false;
    try {
      validator.validateDocumentStandards(strippedIndependenceHtml);
    } catch (e) {
      if (e instanceof MandatoryDisclaimerMissingError) independenceMissing = true;
    }
    check('Phase 11', '11.7 missing platform independence disclaimer is rejected', independenceMissing);
  }

  // --- Tasklet 11.8: Board Reporting Standards Validation ---
  {
    const boardValidator = new BoardStandardsValidator();
    const boardRes = boardValidator.validateBoardPaper({
      title: 'Board Briefing Pack',
      motions: [{ id: 'MOT-1', motion: 'Adopt accounting standards' }],
    });
    check('Phase 11', '11.8 board paper carries mandatory qualified review note', boardRes.hasMandatoryNotice);

    let minutesForbidden = false;
    try {
      boardValidator.validateBoardPaper({ title: 'Board Minutes of Q3 Meeting' });
    } catch (e) {
      if (e instanceof StatutoryFormatDefectError) minutesForbidden = true;
    }
    check('Phase 11', '11.8 board standards strictly rejects labelling artefact minutes', minutesForbidden);
  }

  // --- Tasklet 11.9: Compliance Controls and DLP Engine ---
  {
    const dlp = new DlpScannerService();
    const sensitiveText = `Founder card is 4532 1234 5678 9012, TFN is 123 456 789, and API key is ${'sk_' + 'live_abcdef1234567890abcdef12345'}.`;
    const res = dlp.scanAndRedactText(sensitiveText);

    check('Phase 11', '11.9 DLP engine redacts payment cards', !res.redactedText.includes('4532') && res.redactedText.includes('[REDACTED_PAYMENT_CARD]'));
    check('Phase 11', '11.9 DLP engine redacts Australian TFNs', !res.redactedText.includes('123 456 789') && res.redactedText.includes('[REDACTED_TFN]'));
    check('Phase 11', '11.9 DLP engine redacts API keys and logs security alert', !res.redactedText.includes('sk_live') && dlp.securityAlerts.length > 0);
  }

  // --- Tasklet 11.10: Governance Observation (Tier T4) ---
  {
    const govObs = new GovernanceObservationEngine();
    const meetingData = {
      quorum_evidenced: false,
      conflicts_of_interest_logged: true,
      decisions: [
        { id: 'DEC-01', expenditure_aud: 150000, delegated_limit_aud: 100000 }
      ],
    };

    let deniedWithoutFlag = false;
    try {
      govObs.recordObservations(meetingData, []);
    } catch (e) {
      if (e.message.includes('governance_policy')) deniedWithoutFlag = true;
    }
    check('Phase 11', '11.10 governance observations strictly gated on governance_policy capability flag', deniedWithoutFlag);

    const obs = govObs.recordObservations(meetingData, ['governance_policy']);
    check('Phase 11', '11.10 flags unevidenced quorum without asserting absence', obs.diagnostic_notices.some(n => n.includes('Quorum was not evidenced')));
    check('Phase 11', '11.10 flags decisions exceeding stated delegated authority limits', obs.authority_limit_flags.length === 1);
    check('Phase 11', '11.10 carries mandatory qualified review disclaimer', obs.mandatory_note.includes('Concludo records observations and findings as stated and attributed; it does not assess compliance'));
  }
}
