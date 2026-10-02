import { describe, it, expect, beforeEach } from 'bun:test';
import { defaultExecutionEngine } from '../app/src/lib/workflows/executionEngine';
import { providerRateLimiter } from '../app/src/lib/integrations/rateLimiter';
import { IntegrationExecutionLogService } from '../app/src/lib/integrations/integrationExecutionLogService';
import { WorkflowDefinition } from '../app/src/lib/workflows/schemas';

describe('Phase 4: Execution Engine Integration, Rate Limits & Audit History', () => {
  beforeEach(() => {
    IntegrationExecutionLogService.clearBuffer();
    providerRateLimiter.resetThrottle('microsoft_outlook');
    providerRateLimiter.resetThrottle('xero');
    providerRateLimiter.resetThrottle('hubspot');
  });

  it('records structured zero-secret execution logs in public.integration_execution_logs buffer', async () => {
    const testWorkflow: WorkflowDefinition = {
      workflowKey: 'wf_customer_onboarding_test',
      version: 1,
      name: 'Customer Onboarding with Xero & Teams',
      description: 'Creates client record in Xero and dispatches Teams announcement',
      trigger: {
        key: 'new_client_enquiry',
        type: 'webhook',
        name: 'Website Enquiry Webhook',
      },
      steps: [
        {
          key: 'create_xero_contact',
          name: 'Create Xero Customer',
          stepType: 'action',
          application: 'xero',
          actionKey: 'create_contact',
          connectionId: 'conn_test_xero_123',
          inputMapping: {
            contactName: 'Melbourne Logistics Pty Ltd',
            email: 'accounts@melbournelogistics.com.au',
          },
        },
        {
          key: 'send_teams_alert',
          name: 'Send Operations Alert',
          stepType: 'action',
          application: 'microsoft_teams',
          actionKey: 'send_channel_message',
          connectionId: 'conn_test_teams_456',
          inputMapping: {
            channel: 'Client Operations',
            message: 'New customer onboarding completed for {{steps.create_xero_contact.output.contactName}}',
          },
        },
      ],
      organizationId: 'org_test_melbourne',
    };

    const runResult = await defaultExecutionEngine.execute(
      testWorkflow,
      { client: 'Melbourne Logistics' },
      { isDryRun: false, organizationId: 'org_test_melbourne', actorId: 'user_anthony' }
    );

    expect(runResult.status).toBe('completed');
    expect(runResult.stepResults['create_xero_contact'].status).toBe('succeeded');
    expect(runResult.stepResults['send_teams_alert'].status).toBe('succeeded');

    // Verify structured logs recorded via IntegrationExecutionLogService
    const logs = await IntegrationExecutionLogService.getLogsByRun(runResult.id);
    expect(logs.length).toBe(2);

    const xeroLog = logs.find(l => l.workflowStepId === 'create_xero_contact');
    expect(xeroLog).toBeDefined();
    expect(xeroLog?.providerId).toBe('xero');
    expect(xeroLog?.actionOrTriggerKey).toBe('create_contact');
    expect(xeroLog?.status).toBe('succeeded');
    expect(xeroLog?.safeInputSummary.contactName).toBe('Melbourne Logistics Pty Ltd');
    expect(xeroLog?.safeOutputSummary.currency).toBe('AUD');

    const teamsLog = logs.find(l => l.workflowStepId === 'send_teams_alert');
    expect(teamsLog).toBeDefined();
    expect(teamsLog?.providerId).toBe('microsoft_teams');
    expect(teamsLog?.status).toBe('succeeded');
    expect(teamsLog?.safeInputSummary.message).toContain('Melbourne Logistics Pty Ltd');
  });

  it('guarantees zero-secret storage in execution logs by redacting tokens, keys and auth headers', async () => {
    await IntegrationExecutionLogService.recordLog({
      workflowRunId: 'run_audit_security_001',
      workflowStepId: 'step_api_call',
      providerId: 'generic_http',
      actionOrTriggerKey: 'http_post',
      status: 'succeeded',
      inputData: {
        endpoint: 'https://api.external.com/v1/customers',
        apiKey: 'dummy_key_mock_val_0000000000',
        authorization: 'Bearer mock_oauth_access_sample_token',
        customerName: 'Safe Customer Ltd',
      },
      outputData: {
        refreshToken: 'mock_refresh_sample_val_1234',
        status: 200,
        id: 'cust_998',
      },
    });

    const logs = await IntegrationExecutionLogService.getLogsByRun('run_audit_security_001');
    expect(logs.length).toBe(1);
    const log = logs[0];

    // Verify secrets are redacted
    expect(log.safeInputSummary.apiKey).toBe('[REDACTED_SECRET]');
    expect(log.safeInputSummary.authorization).toBe('[REDACTED_SECRET]');
    expect(log.safeInputSummary.customerName).toBe('Safe Customer Ltd');
    expect(log.safeOutputSummary.refreshToken).toBe('[REDACTED_SECRET]');
    expect(log.safeOutputSummary.id).toBe('cust_998');
  });

  it('respects provider rate limits and throttles requests when provider returns 429', async () => {
    expect(providerRateLimiter.isThrottled('hubspot')).toBe(false);

    // Simulate 429 from HubSpot with 3 seconds backoff
    const waitMs = providerRateLimiter.recordThrottle('hubspot', 3);
    expect(waitMs).toBe(3000);
    expect(providerRateLimiter.isThrottled('hubspot')).toBe(true);

    const state = providerRateLimiter.getThrottleState('hubspot');
    expect(state.isThrottled).toBe(true);
    expect(state.retryAfterMs).toBeGreaterThan(0);
    expect(state.retryAfterMs).toBeLessThanOrEqual(3000);

    // Reset throttle
    providerRateLimiter.resetThrottle('hubspot');
    expect(providerRateLimiter.isThrottled('hubspot')).toBe(false);
  });
});
