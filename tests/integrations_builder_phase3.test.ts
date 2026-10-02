import { describe, it, expect } from 'bun:test';
import { interpolateVariables, resolveTokenPath, ExpressionContext } from '../app/src/lib/workflows/expressions';
import { executeWorkflow } from '../app/src/lib/workflows/executionEngine';
import { WorkflowDefinition } from '../app/src/lib/workflows/schemas';
import { INTEGRATION_PROVIDERS_CATALOG } from '../app/src/lib/integrations/hubRegistry';

describe('Integrations Hub & Workflow Builder — Phase 3 Verification', () => {
  it('correctly resolves and interpolates cross-step variables without code execution', () => {
    const context: ExpressionContext = {
      trigger: {
        customerEmail: 'anthony@concludo.com.au',
        customerName: 'Anthony Cortez',
        deal: {
          value: 45000,
          currency: 'AUD',
        },
      },
      steps: {
        create_hubspot_contact: {
          output: {
            contactId: 'hs_cnt_9021',
            status: 'active',
          },
        },
        create_xero_invoice: {
          output: {
            invoiceNumber: 'INV-2026-089',
            totalAmount: 45000,
          },
        },
      },
    };

    // Literal token evaluation
    expect(interpolateVariables('{{trigger.customerEmail}}', context)).toBe('anthony@concludo.com.au');
    expect(interpolateVariables('{{trigger.deal.value}}', context)).toBe(45000);
    expect(interpolateVariables('{{steps.create_hubspot_contact.output.contactId}}', context)).toBe('hs_cnt_9021');

    // String template evaluation
    const emailBody = 'Hi {{trigger.customerName}}, invoice {{steps.create_xero_invoice.output.invoiceNumber}} has been generated for {{trigger.deal.currency}} ${{trigger.deal.value}}.';
    const resolvedBody = interpolateVariables(emailBody, context);
    expect(resolvedBody).toBe('Hi Anthony Cortez, invoice INV-2026-089 has been generated for AUD $45000.');
  });

  it('handles missing or null variable paths safely without crashing', () => {
    const context: ExpressionContext = {
      trigger: { id: 'trg_1' },
      steps: {},
    };

    expect(interpolateVariables('{{trigger.nonExistentField}}', context)).toBe('');
    expect(interpolateVariables('Invoice for {{steps.missing_step.output.total}}', context)).toBe('Invoice for ');
  });

  it('simulates workflow execution through connected business applications with dynamic inputs', async () => {
    const testWorkflow: WorkflowDefinition = {
      workflowKey: 'wf_customer_acquisition_test',
      name: 'Customer Acquisition Pipeline',
      version: 1,
      description: 'HubSpot enquiry to Xero invoice and Teams broadcast',
      steps: [
        {
          key: 'trigger_form_enquiry',
          displayName: 'New Enquiry Form',
          stepType: 'trigger',
          purpose: 'Receive enquiry payload',
          application: 'microsoft_forms',
          inputMapping: {},
          outputSchema: {},
          configuration: {},
        },
        {
          key: 'action_create_xero_invoice',
          displayName: 'Generate Xero Sales Invoice',
          stepType: 'action',
          purpose: 'Create tax invoice for client in AUD',
          application: 'xero',
          inputMapping: {
            contactName: '{{trigger.customerName}}',
            total: '{{trigger.amount}}',
          },
          outputSchema: {},
          configuration: {
            actionKey: 'create_invoice',
          },
        },
        {
          key: 'action_notify_teams_channel',
          displayName: 'Notify Operations Channel',
          stepType: 'action',
          purpose: 'Broadcast invoice creation to Microsoft Teams',
          application: 'microsoft_teams',
          inputMapping: {
            message: 'New invoice generated for {{trigger.customerName}} via Xero: {{steps.action_create_xero_invoice.output.invoiceId}}',
          },
          outputSchema: {},
          configuration: {
            actionKey: 'send_channel_message',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          sourceStepKey: 'trigger_form_enquiry',
          destinationStepKey: 'action_create_xero_invoice',
          edgeType: 'success',
        },
        {
          id: 'e2',
          sourceStepKey: 'action_create_xero_invoice',
          destinationStepKey: 'action_notify_teams_channel',
          edgeType: 'success',
        },
      ],
    };

    const runResult = await executeWorkflow({
      workflow: testWorkflow,
      inputs: {
        customerName: 'Melbourne Logistics Pty Ltd',
        amount: 8800,
      },
      isDryRun: true,
      userId: 'usr_test_anthony',
    });

    expect(runResult.status).toBe('completed');
    expect(runResult.stepResults.trigger_form_enquiry.status).toBe('succeeded');
    expect(runResult.stepResults.action_create_xero_invoice.status).toBe('succeeded');
    expect(runResult.stepResults.action_create_xero_invoice.output.invoiceId).toContain('INV-DRY');
    expect(runResult.stepResults.action_notify_teams_channel.status).toBe('succeeded');
    expect(runResult.stepResults.action_notify_teams_channel.output.posted).toBe(true);
  });

  it('guarantees that all Tier 1 action-capable applications have valid action input schemas ready for variable mapping', () => {
    const actionApps = INTEGRATION_PROVIDERS_CATALOG.filter((p) => p.isTier1 && p.actions.length > 0);
    expect(actionApps.length).toBeGreaterThanOrEqual(20);

    for (const app of actionApps) {
      for (const action of app.actions) {
        expect(action.inputSchema).toBeDefined();
        expect(typeof action.inputSchema).toBe('object');
      }
    }
  });
});
