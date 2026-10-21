/**
 * OKH Agent Pre-flight Integration Helper
 * Concludo Pty Ltd. 21 October 2026.
 */
import { getSupabaseBrowserClient } from '../supabase/client';

export interface OkhPreflightResult {
  hubMissing: boolean;
  hubId?: string;
  completenessScore: number;
  knowledgeFreshness: 'current' | 'ageing' | 'stale';
  enrichmentStatus: string;
  policies: {
    confidentialityLevel: string;
    dataSharingConsent: boolean;
    recordingConsent: boolean;
  };
  fields: Record<string, {
    value: unknown;
    confidence: 'high' | 'moderate' | 'low' | null;
    isHumanVerified: boolean;
    isAiGenerated: boolean;
    sourceDocument: string | null;
    sourceType: string | null;
    updatedAt: string;
  }>;
  gaps: Array<{
    fieldKey: string;
    sectionKey: string;
    displayLabel: string;
  }>;
}

export interface OkhPreflightOptions {
  organisationId: string;
  workspaceId: string;
  agentName: string;
  agentRunId?: string;
  sectionsRequired?: string[];
  fieldsRequired?: string[];
  outputType: string;
}

/**
 * Standard pre-flight function for all Concludo AI agents.
 * Call this before generating any agent output that relates to an organisation.
 */
export async function okhAgentPreFlight(
  options: OkhPreflightOptions
): Promise<OkhPreflightResult> {
  const supabase = getSupabaseBrowserClient();

  try {
    const { data: hub } = await supabase
      .from('okh_hubs')
      .select('*')
      .eq('workspace_id', options.workspaceId)
      .eq('organisation_id', options.organisationId)
      .maybeSingle();

    if (!hub) {
      return {
        hubMissing: true,
        completenessScore: 0,
        knowledgeFreshness: 'stale',
        enrichmentStatus: 'idle',
        policies: {
          confidentialityLevel: 'standard',
          dataSharingConsent: false,
          recordingConsent: false,
        },
        fields: {},
        gaps: [],
      };
    }

    // Log query in okh_agent_queries
    await supabase.from('okh_agent_queries').insert({
      hub_id: hub.id,
      agent_name: options.agentName,
      agent_run_id: options.agentRunId,
      sections_requested: options.sectionsRequired as any,
      fields_requested: options.fieldsRequired,
      output_type: options.outputType,
    });

    // Increment agent query count
    await supabase
      .from('okh_hubs')
      .update({
        agent_query_count: (hub.agent_query_count || 0) + 1,
        last_agent_query_at: new Date().toISOString(),
      })
      .eq('id', hub.id);

    // Fetch field values
    const { data: fieldValues } = await supabase
      .from('okh_field_values')
      .select('*, definition:okh_field_definitions(*)')
      .eq('hub_id', hub.id);

    const fields: Record<string, any> = {};
    const gaps: Array<{ fieldKey: string; sectionKey: string; displayLabel: string }> = [];

    (fieldValues || []).forEach((fv: any) => {
      const def = fv.definition;
      const rawVal = fv.value?.v !== undefined ? fv.value.v : fv.value;
      if (rawVal !== null && rawVal !== undefined) {
        fields[fv.field_key] = {
          value: rawVal,
          confidence: fv.confidence,
          isHumanVerified: fv.is_human_verified,
          isAiGenerated: fv.is_ai_generated,
          sourceDocument: fv.source_document,
          sourceType: fv.source_type,
          updatedAt: fv.updated_at,
        };
      } else if (def?.is_required) {
        gaps.push({
          fieldKey: fv.field_key,
          sectionKey: fv.section_key,
          displayLabel: def.display_label || fv.field_key,
        });
      }
    });

    return {
      hubMissing: false,
      hubId: hub.id,
      completenessScore: hub.completeness_score || 0,
      knowledgeFreshness: hub.knowledge_freshness || 'stale',
      enrichmentStatus: hub.enrichment_status || 'idle',
      policies: {
        confidentialityLevel: hub.confidentiality_level || 'standard',
        dataSharingConsent: hub.data_sharing_consent || false,
        recordingConsent: hub.recording_consent || false,
      },
      fields,
      gaps,
    };
  } catch (err) {
    console.warn('[OKH] Pre-flight query error, proceeding gracefully:', err);
    return {
      hubMissing: true,
      completenessScore: 0,
      knowledgeFreshness: 'stale',
      enrichmentStatus: 'idle',
      policies: {
        confidentialityLevel: 'standard',
        dataSharingConsent: false,
        recordingConsent: false,
      },
      fields: {},
      gaps: [],
    };
  }
}

export function okhField<T = unknown>(
  preflight: OkhPreflightResult,
  fieldKey: string
): T | undefined {
  return preflight.fields[fieldKey]?.value as T | undefined;
}

export function okhGapWarning(preflight: OkhPreflightResult): string | null {
  if (preflight.hubMissing) {
    return 'Note: No Organisation Knowledge Hub exists for this account. Some context may be limited to CRM records only.';
  }
  if (preflight.gaps.length === 0) return null;
  const labels = preflight.gaps.slice(0, 5).map((g) => g.displayLabel);
  const more = preflight.gaps.length > 5 ? ` and ${preflight.gaps.length - 5} more` : '';
  return `Note: The following fields are missing from the Organisation Knowledge Hub and may affect output quality: ${labels.join(', ')}${more}. Consider running AI enrichment or completing these fields manually.`;
}
