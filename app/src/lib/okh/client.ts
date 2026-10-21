/**
 * OKH Supabase Client & Query Helpers
 * Concludo Pty Ltd. 21 October 2026.
 */
import { getSupabaseBrowserClient } from '../supabase/client';
import type {
  OkhHub,
  OkhFieldValue,
  OkhFieldDefinition,
  OkhProposal,
  OkhVersion,
  OkhAuditLogEntry,
  OkhSectionKey,
} from './types';


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toValidUuid(val: string, fallbackSeed: string): string {
  if (UUID_REGEX.test(val)) return val;
  // Deterministic UUID v4 generation from string
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const str = val + fallbackSeed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 16).toString(16).padStart(4, '0');
  const p3 = '4' + (h2 & 0x0fff).toString(16).padStart(3, '0');
  const p4 = ((h1 & 0x3f) | 0x80).toString(16).padStart(2, '0') + ((h2 >>> 8) & 0xff).toString(16).padStart(2, '0');
  const p5 = ((h1 >>> 8) ^ (h2 >>> 0)).toString(16).padStart(12, '0').slice(-12);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export const OKH_SECTION_TITLES: Record<OkhSectionKey, string> = {
  overview: 'Organisation Profile',
  customers: 'Customers & Market',
  products_services: 'Products & Services',
  marketing: 'Marketing Knowledge',
  sales: 'Sales Process & Commercial',
  customer_success: 'Customer Success & Delivery',
  operations: 'Operations & Structure',
  strategy: 'Strategic Priorities',
  policies: 'Policies & Compliance',
  ai_layer: 'AI & Automation Context',
};

export async function fetchFieldDefinitions(): Promise<OkhFieldDefinition[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('okh_field_definitions')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('[OKH] Error fetching field definitions:', error);
    return [];
  }
  return data as OkhFieldDefinition[];
}

export async function fetchOrCreateHub(
  workspaceIdRaw: string,
  organisationIdRaw: string,
  _organisationName: string,
  userIdRaw: string
): Promise<OkhHub | null> {
  const supabase = getSupabaseBrowserClient();
  const workspaceId = toValidUuid(workspaceIdRaw, 'ws');
  const organisationId = toValidUuid(organisationIdRaw, 'org');
  const userId = toValidUuid(userIdRaw, 'usr');

  // 1. Try to find existing hub
  const { data: existing, error: findError } = await supabase
    .from('okh_hubs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('organisation_id', organisationId)
    .maybeSingle();

  if (findError) {
    console.error('[OKH] Error searching for existing hub:', findError);
  }

  if (existing) {
    return existing as OkhHub;
  }

  // 2. Create fresh hub
  const { data: newHub, error: insertError } = await supabase
    .from('okh_hubs')
    .insert({
      workspace_id: workspaceId,
      organisation_id: organisationId,
      created_by: userId,
      completeness_score: 0,
      knowledge_freshness: 'stale',
      confidentiality_level: 'standard',
    })
    .select('*')
    .single();

  if (insertError || !newHub) {
    console.error('[OKH] Error creating hub:', insertError);
    return null;
  }

  // Bootstrap field values
  const defs = await fetchFieldDefinitions();
  if (defs.length > 0) {
    const fvInserts = defs.map((d) => ({
      hub_id: newHub.id,
      field_def_id: d.id,
      section_key: d.section_key,
      field_key: d.field_key,
      value: null,
      is_ai_generated: false,
      is_human_verified: false,
    }));

    await supabase.from('okh_field_values').insert(fvInserts);
  }

  return newHub as OkhHub;
}

export async function fetchHubFieldValues(hubId: string): Promise<OkhFieldValue[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('okh_field_values')
    .select('*, definition:okh_field_definitions(*)')
    .eq('hub_id', hubId);

  if (error || !data) {
    console.error('[OKH] Error fetching field values:', error);
    return [];
  }
  return data as OkhFieldValue[];
}

export async function updateFieldValue(
  fieldValueId: string,
  val: any,
  actorId: string,
  actorLabel: string
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('okh_field_values')
    .update({
      value: val !== null ? { v: val } : null,
      is_human_verified: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fieldValueId)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[OKH] Error updating field value:', error);
    return false;
  }

  // Log in audit log
  await supabase.from('okh_audit_log').insert({
    hub_id: data.hub_id,
    actor_id: actorId,
    actor_type: 'user',
    actor_label: actorLabel,
    action: 'field_updated',
    field_def_id: data.field_def_id,
    section_key: data.section_key,
    field_key: data.field_key,
    new_value: { v: val },
  });

  return true;
}

export async function fetchProposals(hubId: string): Promise<OkhProposal[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('okh_proposals')
    .select('*, definition:okh_field_definitions(*)')
    .eq('hub_id', hubId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('[OKH] Error fetching proposals:', error);
    return [];
  }
  return data as OkhProposal[];
}

export async function reviewProposal(
  proposalId: string,
  action: 'accepted' | 'rejected' | 'edited',
  finalValue: any,
  actorId: string,
  actorLabel: string
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();

  // 1. Fetch proposal
  const { data: prop, error: propErr } = await supabase
    .from('okh_proposals')
    .select('*')
    .eq('id', proposalId)
    .single();

  if (propErr || !prop) return false;

  // 2. Update proposal
  await supabase
    .from('okh_proposals')
    .update({
      review_action: action,
      reviewed_at: now,
      reviewed_by: actorId,
      final_value: finalValue !== undefined ? { v: finalValue } : prop.proposed_value,
    })
    .eq('id', proposalId);

  // 3. If accepted or edited, update field_values
  if (action === 'accepted' || action === 'edited') {
    const val = finalValue !== undefined ? finalValue : prop.proposed_value?.v ?? prop.proposed_value;
    await supabase
      .from('okh_field_values')
      .update({
        value: { v: val },
        is_ai_generated: true,
        is_human_verified: true,
        confidence: prop.confidence,
        source_document: prop.source_document,
        source_location: prop.source_location,
        source_type: prop.source_type,
        reviewed_at: now,
        reviewed_by: actorId,
        updated_at: now,
      })
      .eq('hub_id', prop.hub_id)
      .eq('field_def_id', prop.field_def_id);

    // Audit log
    await supabase.from('okh_audit_log').insert({
      hub_id: prop.hub_id,
      actor_id: actorId,
      actor_type: 'user',
      actor_label: actorLabel,
      action: action === 'accepted' ? 'field_accepted' : 'field_edited',
      field_def_id: prop.field_def_id,
      section_key: prop.section_key,
      field_key: prop.field_key,
      old_value: prop.prior_value,
      new_value: { v: val },
    });
  } else if (action === 'rejected') {
    await supabase.from('okh_audit_log').insert({
      hub_id: prop.hub_id,
      actor_id: actorId,
      actor_type: 'user',
      actor_label: actorLabel,
      action: 'field_rejected',
      field_def_id: prop.field_def_id,
      section_key: prop.section_key,
      field_key: prop.field_key,
    });
  }

  return true;
}

export async function fetchVersions(hubId: string): Promise<OkhVersion[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('okh_versions')
    .select('*')
    .eq('hub_id', hubId)
    .order('version_number', { ascending: false });

  if (error || !data) return [];
  return data as OkhVersion[];
}

export async function captureVersionSnapshot(
  hubId: string,
  actorId: string,
  reason: string,
  completenessScore: number
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const fieldValues = await fetchHubFieldValues(hubId);

  const snapshot: Record<string, any> = {};
  fieldValues.forEach((fv) => {
    snapshot[fv.field_key] = {
      value: fv.value,
      confidence: fv.confidence,
      source_document: fv.source_document,
      is_human_verified: fv.is_human_verified,
    };
  });

  const { error } = await supabase.from('okh_versions').insert({
    hub_id: hubId,
    captured_by: actorId,
    capture_reason: reason,
    completeness_score: completenessScore,
    snapshot,
  });

  return !error;
}

export async function fetchAuditLogs(hubId: string): Promise<OkhAuditLogEntry[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('okh_audit_log')
    .select('*')
    .eq('hub_id', hubId)
    .order('occurred_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as OkhAuditLogEntry[];
}

export async function triggerEnrichment(
  hubId: string,
  scope: string = 'full'
): Promise<{ success: boolean; jobId?: string; proposalsCreated?: number; error?: string }> {
  const supabase = getSupabaseBrowserClient();

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { success: false, error: 'User is not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('okh-enrich', {
      body: { hubId, scope },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      return { success: false, error: error.message || 'Edge function call failed' };
    }

    return {
      success: true,
      jobId: data?.jobId,
      proposalsCreated: data?.proposalsCreated ?? 0,
    };
  } catch (err: any) {
    console.error('[OKH] Enrichment trigger error:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function restoreVersionSnapshot(
  hubId: string,
  version: OkhVersion,
  actorId: string,
  actorLabel: string
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();

  try {
    // 1. Auto-capture current state before restore
    const currentVals = await fetchHubFieldValues(hubId);
    const beforeRestoreSnapshot: Record<string, any> = {};
    currentVals.forEach((fv) => {
      beforeRestoreSnapshot[fv.field_key] = {
        value: fv.value,
        confidence: fv.confidence,
        source_document: fv.source_document,
        is_human_verified: fv.is_human_verified,
      };
    });

    await supabase.from('okh_versions').insert({
      hub_id: hubId,
      captured_by: actorId,
      capture_reason: 'Auto: Before restore',
      completeness_score: currentVals.filter((v) => v.value !== null).length,
      snapshot: beforeRestoreSnapshot,
    });

    // 2. Restore field values from snapshot
    const snapshotData = version.snapshot || {};
    const updates = Object.entries(snapshotData).map(async ([fieldKey, data]: [string, any]) => {
      return supabase
        .from('okh_field_values')
        .update({
          value: data.value,
          confidence: data.confidence,
          source_document: data.source_document,
          is_human_verified: data.is_human_verified,
          reviewed_at: now,
          reviewed_by: actorId,
          updated_at: now,
        })
        .eq('hub_id', hubId)
        .eq('field_key', fieldKey);
    });

    await Promise.all(updates);

    // 3. Log restore in audit log
    await supabase.from('okh_audit_log').insert({
      hub_id: hubId,
      actor_id: actorId,
      actor_type: 'user',
      actor_label: actorLabel,
      action: 'version_restored',
      notes: `Restored version v${version.version_number} (${version.capture_reason || 'Manual snapshot'})`,
    });

    return true;
  } catch (err) {
    console.error('[OKH] Error restoring snapshot:', err);
    return false;
  }
}
