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
  'anthony.test@concludo.au',
  'anthonycortez@cortezmowinggardenmaintenan.onmicrosoft.com',
  'el_cortez87@live.com',
  'cortez.anthony87@gmail.com',
];

export const ANTHONY_USER_IDS = [
  '91c086e8-d2d0-4060-9a7c-650e13d2245e',
  '055812e5-2257-42c5-ad8e-d345e667612f',
  '7c3728b3-29ce-4cfe-b022-67f1cd45bf18',
];

export function isAnthonyOrAuthorizedTeam(user: any, profile?: any): boolean {
  if (!user) return false;
  const email = (user.email || profile?.email || '').toLowerCase().trim();
  if (ANTHONY_EMAILS.includes(email)) return true;
  if (ANTHONY_USER_IDS.includes(user.id)) return true;
  const fullName = (user.user_metadata?.full_name || profile?.full_name || '').toLowerCase();
  if (fullName.includes('anthony cortez')) return true;
  return false;
}

const LOCAL_STORAGE_KEY = 'concludo_permanent_workflow_templates';

export async function fetchPermanentTemplates(user: any): Promise<WorkflowTemplateMeta[]> {
  if (!isAnthonyOrAuthorizedTeam(user)) {
    return [];
  }

  // 1. Try fetching from Supabase
  try {
    const { data, error } = await getSupabaseBrowserClient()
      .from('permanent_workflow_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
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
    console.warn('Error fetching permanent templates from Supabase, falling back to local storage:', err);
  }

  // 2. Fallback to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Could not read permanent templates from localStorage:', e);
  }

  return [];
}

export async function savePermanentTemplate(
  workflow: WorkflowRecord | { name: string; description?: string; definition_json?: any; trigger_type?: string; actions?: any; steps?: any },
  user: any
): Promise<{ success: boolean; error?: string }> {
  if (!isAnthonyOrAuthorizedTeam(user)) {
    return { success: false, error: 'Unauthorized: Permanent workflow templates are restricted to Anthony Cortez and his account teams.' };
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

  // 1. Save to Supabase
  try {
    await getSupabaseBrowserClient().from('permanent_workflow_templates').insert({
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
  } catch (err) {
    console.warn('Failed to insert into permanent_workflow_templates in Supabase:', err);
  }

  // 2. Persist in localStorage
  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: WorkflowTemplateMeta[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.unshift(templateMeta);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }

  return { success: true };
}
