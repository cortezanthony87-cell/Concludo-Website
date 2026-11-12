import { SupabaseClient } from '@supabase/supabase-js';
import { analyseDocumentMode } from '../intelligence/documentExtractor';
import { createCalendarItem } from '../calendar/calendarClient';
import { toActionOrigin, computeContentHash, checkDuplicateBatch } from './actionImport';

export interface ExtractedDocumentAction {
  id: string;
  title: string;
  description?: string;
  stage?: string;
  owner: string;
  dueDate: string; // 'YYYY-MM-DD' or empty string
  dueRaw: string;
  dueBasis: 'stated' | 'stage_end' | 'user_picked' | 'none';
  doneWhen?: string;
  evidence?: string;
  sourceLine?: number;
  priority: 'high' | 'medium' | 'low';
  kind: 'task' | 'event';
  addToCalendar: boolean;
}

export interface DocumentAgentRunResult {
  success: boolean;
  actions: ExtractedDocumentAction[];
  missingDateCount: number;
  gatesCount: number;
  documentTitle: string;
  versionDate?: string;
  agentUsed: {
    id: string;
    name: string;
    role: string;
  };
  error?: string;
}

/**
 * Runs the Document Intelligence Agent on imported document text.
 * Extracts actions, tasks, decision gates, dates, and owners using
 * deterministic document mode intelligence without inventing facts.
 */
export function runDocumentActionAgent(
  documentText: string,
  documentName: string
): DocumentAgentRunResult {
  try {
    const model = analyseDocumentMode([{ name: documentName, kind: 'document', text: documentText }]);
    const actions: ExtractedDocumentAction[] = (model.actions || []).map((a, idx) => {
      const taskTitle = a.task || (a as any).text || '';
      const isEvent = /meeting|workshop|briefing|conference|roundtable|presentation|ceremony|launch/i.test(taskTitle);
      const isHigh = /urgent|critical|immediately|gate|stop rule|must|statutory|lodgement|lodge/i.test(taskTitle);
      const isLow = /optional|review|monitor|archive|note/i.test(taskTitle);
      const priority: 'high' | 'medium' | 'low' = isHigh ? 'high' : isLow ? 'low' : 'medium';

      const descLines: string[] = [];
      if (a.stage) descLines.push(`Stage: ${a.stage}`);
      const dueRaw = a.dueRaw || (a as any).due_raw || a.dueText || '';
      const dueDate = a.due || (a as any).due_date || '';
      if (dueRaw && dueRaw !== dueDate) descLines.push(`Stated timing: ${dueRaw}`);
      const dueBasis = a.dueBasis || (a as any).due_basis;
      if (dueBasis) descLines.push(`Date source: ${dueBasis === 'stage_end' ? 'Inherited from stage end' : dueBasis}`);
      const doneWhen = a.doneWhen || a.doneDefinition || (a as any).done_when;
      if (doneWhen) descLines.push(`Done when: ${doneWhen}`);
      const quote = a.sourceQuote || (a as any).source_quote;
      if (quote) descLines.push(`Source excerpt: "${quote}"`);

      const hasDate = Boolean(dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate));

      return {
        id: a.id || `A${String(idx + 1).padStart(2, '0')}`,
        title: taskTitle,
        description: descLines.join('\n') || undefined,
        stage: a.stage || undefined,
        owner: a.owner || 'Unassigned',
        dueDate: hasDate ? dueDate : '',
        dueRaw: dueRaw,
        dueBasis: (dueBasis as any) || (hasDate ? 'stated' : 'none'),
        doneWhen: doneWhen || undefined,
        evidence: quote || undefined,
        sourceLine: a.sourceLine || (a as any).source_line || undefined,
        priority,
        kind: isEvent ? 'event' : 'task',
        addToCalendar: hasDate, // default to true if date exists, user can toggle
      };
    });

    const missingDateCount = actions.filter((a) => !a.dueDate).length;
    const gatesCount = (model.gates || []).length;

    return {
      success: true,
      actions,
      missingDateCount,
      gatesCount,
      documentTitle: model.meta?.title || documentName.replace(/\.[^/.]+$/, ''),
      versionDate: model.meta?.meetingDate || undefined,
      agentUsed: {
        id: 'document_intelligence',
        name: 'Document Intelligence Agent',
        role: 'Autonomous Document Analysis & Task Extraction',
      },
    };
  } catch (err: any) {
    return {
      success: false,
      actions: [],
      missingDateCount: 0,
      gatesCount: 0,
      documentTitle: documentName,
      agentUsed: {
        id: 'document_intelligence',
        name: 'Document Intelligence Agent',
        role: 'Autonomous Document Analysis & Task Extraction',
      },
      error: err?.message || 'Failed to extract actions from document',
    };
  }
}

export interface SaveDocumentImportPayload {
  actions: ExtractedDocumentAction[];
  documentName: string;
  documentRawText: string;
  projectId?: string | null;
  addMissingDatesToCalendar?: boolean;
  globalDateOverride?: string; // If user picked a date to apply to all undated actions
}

export interface SaveDocumentImportResult {
  success: boolean;
  batchId: string;
  actionsCount: number;
  calendarCount: number;
  warning?: string;
  error?: string;
}

/**
 * Persists confirmed document actions to public.action_tracker
 * and optionally generates corresponding items in public.calendar_items.
 */
export async function saveDocumentActionsToHub(
  supabase: SupabaseClient,
  userId: string,
  payload: SaveDocumentImportPayload
): Promise<SaveDocumentImportResult> {
  const batchId = crypto.randomUUID();
  const contentHash = await computeContentHash(payload.documentRawText);
  const dupCheck = await checkDuplicateBatch(supabase, userId, contentHash);

  const warning = dupCheck.isDuplicate
    ? `A document with this exact content was already imported on ${dupCheck.importedAt}. Re-importing may create duplicate actions.`
    : undefined;

  // 1. Record batch in import_batches
  try {
    const { error: batchErr } = await supabase.from('import_batches').insert({
      id: batchId,
      user_id: userId,
      project_id: payload.projectId || null,
      source_file: payload.documentName,
      content_hash: contentHash,
      row_count: payload.actions.length,
      created_at: new Date().toISOString(),
    });
    if (batchErr && batchErr.code !== '42P01') {
      console.warn('Could not record import_batches:', batchErr);
    }
  } catch (err) {
    console.warn('import_batches insert caught:', err);
  }

  // 2. Prepare action_tracker records with deterministic UUIDs to link calendar items
  const actionIdMap = new Map<string, string>();
  const actionRecords = payload.actions.map((act) => {
    const actionId = crypto.randomUUID();
    actionIdMap.set(act.id, actionId);
    const finalDue = act.dueDate || (payload.globalDateOverride && /^\d{4}-\d{2}-\d{2}$/.test(payload.globalDateOverride) ? payload.globalDateOverride : null);
    const descParts: string[] = [];
    if (act.stage) descParts.push(`Stage: ${act.stage}`);
    if (act.dueRaw && !finalDue) descParts.push(`Stated timing: ${act.dueRaw}`);
    if (act.doneWhen) descParts.push(`Done when: ${act.doneWhen}`);
    if (act.evidence) descParts.push(`Source: "${act.evidence}"`);

    return {
      id: actionId,
      user_id: userId,
      project_id: payload.projectId || null,
      action_title: act.title,
      action_description: descParts.join('\n') || act.description || null,
      owner_name: act.owner && act.owner !== 'Unassigned' ? act.owner.trim() : null,
      due_date: finalDue,
      status: 'not_started',
      priority: act.priority || 'medium',
      ownership_type: 'personal',
      source_type: 'imported_document',
      batch_id: batchId,
      origin: toActionOrigin('Stated in plan'),
      source_line: act.sourceLine || null,
      provenance: {
        quote: act.evidence || null,
        document_name: payload.documentName,
        agent_id: 'document_intelligence',
        date_basis: act.dueBasis,
      },
    };
  });

  const { error: actionErr } = await supabase.from('action_tracker').insert(actionRecords);
  if (actionErr) {
    return {
      success: false,
      batchId,
      actionsCount: 0,
      calendarCount: 0,
      error: `Failed to insert actions: ${actionErr.message}`,
    };
  }

  // 3. Calendar integration: add selected actions to Concludo Calendar
  let calendarCount = 0;
  const calendarEligible = payload.actions.filter((a) => {
    const effectiveDate = a.dueDate || payload.globalDateOverride;
    return a.addToCalendar && effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate);
  });

  for (const act of calendarEligible) {
    const effectiveDate = act.dueDate || payload.globalDateOverride || '';
    const targetActionId = actionIdMap.get(act.id) || act.id;
    try {
      const { error: calErr } = await createCalendarItem(supabase, {
        creator_id: userId,
        owner_name: act.owner && act.owner !== 'Unassigned' ? act.owner : null,
        type: act.kind === 'event' ? 'event' : 'task',
        title: act.title,
        description: act.description || `Imported from ${payload.documentName}`,
        due_date: effectiveDate,
        status: 'open',
        priority: act.priority,
        source_type: 'other',
        source_id: targetActionId,
        source_reference: targetActionId,
        source_title: payload.documentName,
        visibility: 'private',
      });
      if (!calErr) {
        calendarCount++;
      } else {
        console.warn('Calendar item create error for:', act.title, calErr);
      }
    } catch (e) {
      console.warn('Failed to create calendar item for:', act.title, e);
    }
  }

  return {
    success: true,
    batchId,
    actionsCount: actionRecords.length,
    calendarCount,
    warning,
  };
}
