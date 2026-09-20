/**
 * Phase 10 Test Suite: Agent Consumption
 * Covers Tasklets 10.1 through 10.8.
 */

import { AgentOutputConsumptionService, HealthEventDispatcher, AgentTokenInvalidError } from '../src/services/agent/agentOutputConsumptionService.mjs';
import { RecommendationAgentService, InsightAgentStream, RecommendationNotAcceptedError } from '../src/services/agent/recommendationAgentService.mjs';
import { OutputReuseService, ReportReuseEngine, CircularOutputLineageError, SeriesHasSingleMeetingError } from '../src/services/agent/outputReuseService.mjs';
import { WorkflowWebhookDispatcher, GovernanceBarrierService, SsrfBlockedError, ApprovalExpiredError } from '../src/services/agent/workflowWebhookDispatcher.mjs';

export async function runPhase10Tests(check) {
  // --- Tasklet 10.1: Agent Output Consumption Interface ---
  {
    const agentSdk = new AgentOutputConsumptionService();
    agentSdk.registerAgentToken('token_agent_1', 'agent_worker_1', 'org_concludo');
    agentSdk.storeOutput('out_101', 'org_concludo', {
      title: 'Action Log',
      actions: [{ id: 'ACT-1', what: 'Deploy' }],
    });

    const payload = agentSdk.getOutputPayload('out_101', 'token_agent_1');
    check('Phase 10', '10.1 agent SDK consumes output payload within tenant org', payload.title === 'Action Log');

    const filtered = agentSdk.getOutputPayload('out_101', 'token_agent_1', 'actions');
    check('Phase 10', '10.1 agent SDK supports section filtering', Array.isArray(filtered.data) && filtered.data.length === 1);

    let invalidTokenBlocked = false;
    try {
      agentSdk.getOutputPayload('out_101', 'invalid_token');
    } catch (e) {
      if (e instanceof AgentTokenInvalidError) invalidTokenBlocked = true;
    }
    check('Phase 10', '10.1 invalid agent token is rejected', invalidTokenBlocked);
  }

  // --- Tasklet 10.2: Meeting Health Consumption by Agents ---
  {
    const dispatcher = new HealthEventDispatcher();
    dispatcher.addSubscriptionRule({
      id: 'rule_1',
      organisation_id: 'org_1',
      rule_name: 'Low Health Score Alert',
      condition_metric: 'composite_score',
      threshold_value: 50,
      operator: '<',
      target_agent_id: 'agent_alert',
      is_active: true,
    });

    const lowRun = { composite_score: 45, distribution_index: 0.2 };
    const alerts = dispatcher.evaluateHealthRun('org_1', lowRun);
    check('Phase 10', '10.2 health rule triggers on threshold breach', alerts.length === 1 && alerts[0].ruleName === 'Low Health Score Alert');

    const nullRun = { composite_score: null };
    const nullAlerts = dispatcher.evaluateHealthRun('org_1', nullRun);
    check('Phase 10', '10.2 null composite score triggers zero subscription rules', nullAlerts.length === 0);

    let perPersonBlocked = false;
    try {
      dispatcher.addSubscriptionRule({
        id: 'rule_bad',
        condition_metric: 'speaker_individual_talk_time',
        threshold_value: 10,
        operator: '>',
      });
    } catch (e) {
      if (e.message.includes('PROHIBITED_METRIC')) perPersonBlocked = true;
    }
    check('Phase 10', '10.2 per-person metric subscription is strictly rejected', perPersonBlocked);
  }

  // --- Tasklet 10.3: Recommendation Consumption by Agents ---
  {
    const recAgent = new RecommendationAgentService();
    const acceptedRec = {
      status: 'ACCEPTED',
      title: 'Review backup procedures',
      priority: 'P1',
      failure_pattern: 'FP-04',
      owner: 'Ops Lead',
    };

    const draftTicket = recAgent.draftExecutionTicket(acceptedRec, 'agent_jira', 'org_1');
    check('Phase 10', '10.3 accepted recommendation converted to draft execution ticket', draftTicket.is_draft && draftTicket.requires_human_approval);

    let unacceptedBlocked = false;
    try {
      recAgent.draftExecutionTicket({ status: 'PENDING', title: 'Unapproved rec' }, 'agent_jira', 'org_1');
    } catch (e) {
      if (e instanceof RecommendationNotAcceptedError) unacceptedBlocked = true;
    }
    check('Phase 10', '10.3 unaccepted recommendation cannot be drafted for execution', unacceptedBlocked);
  }

  // --- Tasklet 10.4: Insight Consumption by Agents ---
  {
    const stream = new InsightAgentStream();
    const dispatched = stream.streamInsight('org_1', {
      channel: 'INS-C',
      text: 'Has the data migration schedule been confirmed',
      is_absence: true,
    }, 'RiskRegister');

    check('Phase 10', '10.4 absence questions streamed to external systems end with ?', dispatched.insight_text.endsWith('?'));
    check('Phase 10', '10.4 insight outbound sync records audit entry', stream.auditLog.length === 1);
  }

  // --- Tasklet 10.5: Output Reuse Framework ---
  {
    const reuseService = new OutputReuseService();
    reuseService.registerOutput('out_src_1', 'org_1', 'meet_1', {
      decisions: [{ id: 'DEC-01', decision: 'Target Sydney and Melbourne', evidence_mark: 'confirmed' }],
    });

    reuseService.linkPrecursorOutput('out_src_1', 'meet_2', 'org_1', 'PRIOR_DECISION_BASE');
    const precursors = reuseService.getPrecursorOutputs('meet_2', 'org_1');

    check('Phase 10', '10.5 precursor output linked as context to subsequent meeting', precursors.length === 1);
    check('Phase 10', '10.5 precursor decision preserves original evidence mark and source citation',
      precursors[0].decisions[0].evidence_mark === 'confirmed' && precursors[0].decisions[0].carried_from_meeting === 'meet_1');

    let circularBlocked = false;
    try {
      reuseService.linkPrecursorOutput('out_src_1', 'meet_1', 'org_1');
    } catch (e) {
      if (e instanceof CircularOutputLineageError) circularBlocked = true;
    }
    check('Phase 10', '10.5 circular output lineage linking is prevented', circularBlocked);
  }

  // --- Tasklet 10.6: Report Reuse Framework ---
  {
    const reportReuse = new ReportReuseEngine();
    reportReuse.addSeriesMeeting('org_1', 'series_monthly', {
      decisions: [{ id: 'D1' }],
      actions: [{ id: 'A1', status: 'DONE' }, { id: 'A2', status: 'OPEN' }],
    });

    let singleMeetingBlocked = false;
    try {
      reportReuse.compileSeriesReport('org_1', 'series_monthly');
    } catch (e) {
      if (e instanceof SeriesHasSingleMeetingError) singleMeetingBlocked = true;
    }
    check('Phase 10', '10.6 series report requires a minimum of 2 meetings', singleMeetingBlocked);

    reportReuse.addSeriesMeeting('org_1', 'series_monthly', {
      decisions: [{ id: 'D2' }],
      actions: [{ id: 'A3', status: 'OPEN' }],
    });

    const seriesReport = reportReuse.compileSeriesReport('org_1', 'series_monthly');
    check('Phase 10', '10.6 series report synthesises period actions and includes canonical disclaimer',
      seriesReport.meetingCount === 2 && seriesReport.closedActionsCount === 1 && seriesReport.openActionsCount === 2 &&
      seriesReport.canonicalDisclaimer.includes('Not a benchmark. Historical comparison is within this organisation'));
  }

  // --- Tasklet 10.7: Workflow Consumption Integration ---
  {
    const dispatcher = new WorkflowWebhookDispatcher();
    const targetUrl = 'https://api.external-system.com/webhook';
    const secret = 'secret_key_12345';
    const delivery = dispatcher.dispatchSignedWebhook(targetUrl, secret, { event: 'output.published' });

    check('Phase 10', '10.7 webhook dispatch includes HMAC SHA-256 signature', typeof delivery.signature === 'string' && delivery.signature.length === 64);

    let ssrfLocalBlocked = false;
    try {
      dispatcher.dispatchSignedWebhook('http://localhost:8080/internal', secret, {});
    } catch (e) {
      if (e instanceof SsrfBlockedError) ssrfLocalBlocked = true;
    }
    check('Phase 10', '10.7 SSRF guard blocks localhost webhook destinations', ssrfLocalBlocked);

    let ssrfMetaBlocked = false;
    try {
      dispatcher.dispatchSignedWebhook('http://169.254.169.254/latest/meta-data', secret, {});
    } catch (e) {
      if (e instanceof SsrfBlockedError) ssrfMetaBlocked = true;
    }
    check('Phase 10', '10.7 SSRF guard blocks cloud metadata endpoints', ssrfMetaBlocked);
  }

  // --- Tasklet 10.8: Approval Integration and Governance Barrier ---
  {
    const barrier = new GovernanceBarrierService();
    const req = barrier.submitActionRequest({
      organisation_id: 'org_1',
      requesting_agent: 'agent_jira',
      action_type: 'CREATE_TICKET',
      proposed_payload: { summary: 'Update DNS' },
    });

    check('Phase 10', '10.8 agent action intercepted into pending approval queue', req.status === 'PENDING');

    let selfApproveBlocked = false;
    try {
      barrier.reviewRequest(req.id, 'agent_jira', 'APPROVE');
    } catch (e) {
      if (e.message.includes('Agents cannot self-approve')) selfApproveBlocked = true;
    }
    check('Phase 10', '10.8 agent self-approval is strictly prohibited', selfApproveBlocked);

    const approveRes = barrier.reviewRequest(req.id, 'user_anthony_cortez', 'APPROVE');
    check('Phase 10', '10.8 human review approves action execution with authenticated user id', approveRes.status === 'APPROVED' && approveRes.executed);

    const expiredReq = barrier.submitActionRequest({
      organisation_id: 'org_1',
      requesting_agent: 'agent_email',
      action_type: 'DISPATCH_EMAIL',
      proposed_payload: { to: 'client@example.com' },
    });
    expiredReq.expires_at = Date.now() - 1000; // Past 48 hours

    let expiredBlocked = false;
    try {
      barrier.reviewRequest(expiredReq.id, 'user_anthony_cortez', 'APPROVE');
    } catch (e) {
      if (e instanceof ApprovalExpiredError) expiredBlocked = true;
    }
    check('Phase 10', '10.8 unreviewed actions expire after 48 hours and cannot be executed', expiredBlocked);
  }
}
