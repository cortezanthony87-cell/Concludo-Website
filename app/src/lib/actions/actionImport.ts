import { SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

export interface ImportedActionRow {
  id: string;
  stage: string;
  action: string;
  owner: string;
  due_text: string;
  due_date: string;
  done_when: string;
  origin: string; // 'Stated in plan' | 'Derived by reviewer'
  plan_source_line?: string;
  match_score?: string;
  status: string;
  evidence: string;
}

export async function computeContentHash(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  }
  return `hash_${Math.abs(h).toString(16)}`;
}

export function toActionOrigin(raw: string): 'stated_in_plan' | 'derived_by_reviewer' | 'inferred_by_concludo' {
  const o = raw.toLowerCase().trim();
  if (o.includes('derived')) return 'derived_by_reviewer';
  if (o.includes('inferred')) return 'inferred_by_concludo';
  return 'stated_in_plan';
}

/** RFC 4180 CSV parser using PapaParse - handles multiline quoted cells */
export function parseActionRegisterCsv(csvText: string): ImportedActionRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.toLowerCase().trim(),
  });

  if (!parsed.data || !parsed.data.length) return [];

  return parsed.data.map((row: Record<string, string>, index: number) => {
    const id = row['id'] || `A${String(index + 1).padStart(2, '0')}`;
    const stage = row['stage'] || '';
    const action = row['action'] || row['task'] || '';
    // Fix: Keep all owners, not only the first
    const owner = row['owner'] || row['who'] || '';
    const due_text = row['due_text'] || '';
    const due_date = row['due_date'] || '';
    const done_when = row['done_when'] || '';
    const origin = row['origin'] || 'Stated in plan';
    const plan_source_line = row['plan_source_line'] || '';
    const match_score = row['match_score'] || '';
    const status = row['status'] || 'Not started';
    const evidence = row['evidence'] || 'Planned. Not yet confirmed by a person';

    return {
      id,
      stage,
      action,
      owner,
      due_text,
      due_date,
      done_when,
      origin,
      plan_source_line,
      match_score,
      status,
      evidence,
    };
  }).filter((r: ImportedActionRow) => r.action.trim().length > 0);
}

export async function checkDuplicateBatch(
  supabase: SupabaseClient,
  userId: string,
  contentHash: string
): Promise<{ isDuplicate: boolean; existingBatchId?: string; importedAt?: string }> {
  try {
    const { data } = await supabase
      .from('import_batches')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return { isDuplicate: true, existingBatchId: data.id, importedAt: data.created_at };
    }
  } catch {}
  return { isDuplicate: false };
}

export async function importActionBatch(
  supabase: SupabaseClient,
  userId: string,
  rows: ImportedActionRow[],
  projectId?: string | null,
  sourceFile = 'action_plan.csv',
  rawCsvText = ''
): Promise<{ success: boolean; batchId: string; count: number; warning?: string; error?: string }> {
  const batchId = crypto.randomUUID();
  const contentHash = await computeContentHash(rawCsvText || JSON.stringify(rows));

  // Check duplicate
  const dupCheck = await checkDuplicateBatch(supabase, userId, contentHash);
  const warning = dupCheck.isDuplicate
    ? `A batch with this exact CSV content was already imported on ${dupCheck.importedAt}. Re-importing may create duplicate actions.`
    : undefined;

  // Record batch
  try {
    const { error: batchErr } = await supabase.from('import_batches').insert({
      id: batchId,
      user_id: userId,
      project_id: projectId || null,
      source_file: sourceFile,
      content_hash: contentHash,
      row_count: rows.length,
      created_at: new Date().toISOString(),
    });
    if (batchErr) {
      console.warn('Could not insert import_batches record:', batchErr);
      if (batchErr.code && batchErr.code !== '42P01') {
        return { success: false, batchId, count: 0, error: `Batch creation failed: ${batchErr.message}` };
      }
    }
  } catch (err) {
    console.warn('Could not insert import_batches record (migration may be pending):', err);
  }

  // Insert into public.action_tracker
  const recordsToInsert = rows.map((r) => {
    const due = /^\d{4}-\d{2}-\d{2}$/.test(r.due_date.trim()) ? r.due_date.trim() : null;
    const desc = [
      r.stage ? `Stage: ${r.stage}` : '',
      r.due_text && !due ? `Due: ${r.due_text}` : '',
      r.done_when ? `Done when: ${r.done_when}` : '',
      r.origin ? `Origin: ${r.origin}` : '',
    ].filter(Boolean).join('\n');

    const sourceLine = r.plan_source_line ? parseInt(r.plan_source_line, 10) : null;

    return {
      user_id: userId,
      project_id: projectId || null,
      action_title: r.action,
      action_description: desc || null,
      // Fix: Keep all owners, not only the first
      owner_name: r.owner.trim() || null,
      due_date: due,
      status: 'not_started',
      priority: 'normal',
      ownership_type: 'personal',
      source_type: 'imported_plan',
      batch_id: batchId,
      origin: toActionOrigin(r.origin || 'Stated in plan'),
      source_line: isNaN(sourceLine as number) ? null : sourceLine,
      provenance: {
        quote: r.evidence || null,
        span: null,
        model: null,
        prompt_version: null,
      },
    };
  });

  const { error } = await supabase.from('action_tracker').insert(recordsToInsert);
  if (error) {
    try {
      await supabase.from('import_batches').delete().eq('id', batchId);
    } catch {}
    return { success: false, batchId, count: 0, error: error.message };
  }
  return { success: true, batchId, count: recordsToInsert.length, warning };
}

export async function reverseImportBatch(
  supabase: SupabaseClient,
  batchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Soft delete scoped by batch_id and user_id
  const { error } = await supabase
    .from('action_tracker')
    .update({
      deleted_at: now.toISOString(),
      deleted_by: userId,
      deleted_reason: 'undo_import_batch',
      purge_after: purgeAfter.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('batch_id', batchId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await supabase
      .from('import_batches')
      .update({
        undone_at: now.toISOString(),
        deleted_by: userId,
        deleted_reason: 'undo_import_batch',
      })
      .eq('id', batchId)
      .eq('user_id', userId);
  } catch {}

  return { success: true };
}

export async function restoreImportBatch(
  supabase: SupabaseClient,
  batchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('action_tracker')
    .update({
      deleted_at: null,
      deleted_by: null,
      deleted_reason: null,
      purge_after: null,
      updated_at: new Date().toISOString(),
    })
    .eq('batch_id', batchId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await supabase
      .from('import_batches')
      .update({
        undone_at: null,
        deleted_by: null,
        deleted_reason: null,
      })
      .eq('id', batchId)
      .eq('user_id', userId);
  } catch {}

  return { success: true };
}
