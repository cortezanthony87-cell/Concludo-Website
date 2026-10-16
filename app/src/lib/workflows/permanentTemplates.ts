/**
 * Permanent Workflow Templates governance and access control.
 * Rule: Only Anthony Cortez and teams created in his Concludo account
 * have access to save and view permanent workflow templates.
 */

import { getSupabaseBrowserClient } from '../supabase/client';
import { WorkflowTemplateMeta } from './templates';
import { WorkflowRecord } from './types';

export const ANTHONY_EMAILS = [
  'anthony@concludo.au',
  'hello@concludo.au',
  'cortez.anthony87@gmail.com',
  'el_cortez87@live.com',
  'anthony.test@concludo.au',
  'anthonycortez@cortezmowinggardenmaintenan.onmicrosoft.com',
];

export const ANTHONY_PRIMARY_USER_ID = '91c086e8-d2d0-4060-9a7c-650e13d2245e';
export const ANTHONY_USER_IDS = [
  ANTHONY_PRIMARY_USER_ID,
  '055812e5-2257-42c5-ad8e-d345e667612f',
  '7c3728b3-29ce-4cfe-b022-67f1cd45bf18',
];

/**
 * Checks whether the user is Anthony Cortez directly OR a member of a team created by Anthony Cortez.
 */
export async function verifyUserIsAuthorized(user: any): Promise<boolean> {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  if (ANTHONY_EMAILS.includes(email)) return true;
  if (ANTHONY_USER_IDS.includes(user.id)) return true;

  // Check database team membership in teams owned by Anthony
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, teams!inner(owner_id)')
      .eq('user_id', user.id);

    if (!error && Array.isArray(data)) {
      const isMemberOfAnthonyTeam = data.some((row: any) =>
        row.teams?.owner_id === ANTHONY_PRIMARY_USER_ID
      );
      if (isMemberOfAnthonyTeam) return true;
    }
  } catch (err) {
    console.warn('Could not verify team membership for permanent templates:', err);
  }

  return false;
}

/**
 * Checks whether the user is Anthony Cortez himself (permitted to save permanent templates).
 */
export function isAnthonyOwner(user: any): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  return ANTHONY_EMAILS.includes(email) || ANTHONY_USER_IDS.includes(user.id);
}

export function isAnthonyOrAuthorizedTeam(user: any, profile?: any): boolean {
  if (!user) return false;
  const email = (user.email || profile?.email || '').toLowerCase().trim();
  if (ANTHONY_EMAILS.includes(email)) return true;
  if (ANTHONY_USER_IDS.includes(user.id)) return true;
  return false;
}

export async function fetchPermanentTemplates(user: any): Promise<WorkflowTemplateMeta[]> {
  if (!user) return [];

  // RLS will enforce whether this user can read rows
  try {
    const { data, error } = await getSupabaseBrowserClient()
      .from('permanent_workflow_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        templateKey: row.template_key,
        name: row.name,
        description: row.description || '',
        category: 'Permanent Templates' as any,
        applicationsRequired: row.applications_required || [],
        concludoServicesRequired: row.concludo_services_required || ['Approval Centre', 'AI Agents'],
        approvalRequired: Boolean(row.approval_required),
        setupTimeCategory: (row.setup_time_category as any) || '5 mins',
        exampleTrigger: row.example_trigger || 'When trigger occurs',
        exampleResult: row.example_result || 'Executes approved actions',
        definition: row.definition || {},
      }));
    }
  } catch (err) {
    console.warn('Error fetching permanent templates from Supabase:', err);
  }

  return [];
}

export async function savePermanentTemplate(
  workflow: WorkflowRecord | { id?: string; name: string; description?: string; definition_json?: any; trigger_type?: string; actions?: any; steps?: any },
  user: any
): Promise<{ success: boolean; error?: string }> {
  if (!user) {
    return { success: false, error: 'User session required.' };
  }

  // Exclusive save rule: Anthony alone can save workflows into permanent templates
  if (!isAnthonyOwner(user)) {
    return {
      success: false,
      error: 'Unauthorized: Saving permanent workflow templates is exclusively restricted to Anthony Cortez.',
    };
  }

  // Verification rule: The workflow must have been built and tested with a completed execution
  const workflowId = (workflow as any).id;
  if (!workflowId) {
    return {
      success: false,
      error: 'Rule: The workflow must be saved and tested before adding to Permanent Templates.',
    };
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const { data: executions, error: execErr } = await supabase
      .from('workflow_executions')
      .select('id, status')
      .eq('workflow_id', workflowId)
      .eq('status', 'completed')
      .limit(1);

    if (execErr || !executions || executions.length === 0) {
      return {
        success: false,
        error: 'Rule: Workflows must be tested and have at least one completed test run before saving into Permanent Templates.',
      };
    }
  } catch (e: any) {
    console.warn('Could not verify workflow executions:', e);
    return {
      success: false,
      error: 'Could not verify test run execution. Ensure the workflow has been tested first.',
    };
  }

  const templateKey = `perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const templateMeta: WorkflowTemplateMeta = {
    templateKey,
    name: workflow.name,
    description: workflow.description || 'Executive workflow saved to permanent templates library.',
    category: 'Permanent Templates' as any,
    applicationsRequired: Array.isArray((workflow as any).definition_json?.steps)
      ? Array.from(new Set((workflow as any).definition_json.steps.map((s: any) => s.application).filter(Boolean)))
      : [],
    concludoServicesRequired: ['Approval Centre', 'AI Agents', 'Workflows'],
    approvalRequired: true,
    setupTimeCategory: '5 mins',
    exampleTrigger: (workflow as any).trigger_type || 'Automated trigger',
    exampleResult: 'Action items dispatched to connected destinations upon human sign-off.',
    definition: (workflow as any).definition_json || {
      name: workflow.name,
      triggerType: (workflow as any).trigger_type,
      actions: (workflow as any).actions,
      steps: (workflow as any).steps,
    },
  };

  // Save to Supabase table protected by RLS
  try {
    const { error: insertErr } = await getSupabaseBrowserClient().from('permanent_workflow_templates').insert({
      template_key: templateKey,
      name: workflow.name,
      description: workflow.description,
      category: 'Permanent Templates',
      applications_required: templateMeta.applicationsRequired,
      concludo_services_required: templateMeta.concludoServicesRequired,
      approval_required: true,
      setup_time_category: '5 mins',
      example_trigger: templateMeta.exampleTrigger,
      example_result: templateMeta.exampleResult,
      definition: templateMeta.definition,
      created_by: user.id,
      created_by_email: user.email,
    });

    if (insertErr) {
      return { success: false, error: `Failed to save permanent template: ${insertErr.message}` };
    }
  } catch (err: any) {
    return { success: false, error: `Database error: ${err.message}` };
  }

  return { success: true };
}
