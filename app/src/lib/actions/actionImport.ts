import { SupabaseClient } from '@supabase/supabase-js';
import { ActionRecord, CreateActionInput } from './types';

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

export function parseActionRegisterCsv(csvText: string): ImportedActionRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idIdx = header.indexOf('id');
  const stageIdx = header.indexOf('stage');
  const actIdx = header.indexOf('action');
  const ownerIdx = header.indexOf('owner');
  const dueTextIdx = header.indexOf('due_text');
  const dueDateIdx = header.indexOf('due_date');
  const doneIdx = header.indexOf('done_when');
  const originIdx = header.indexOf('origin');
  const lineIdx = header.indexOf('plan_source_line');
  const scoreIdx = header.indexOf('match_score');
  const statusIdx = header.indexOf('status');
  const evidIdx = header.indexOf('evidence');

  const rows: ImportedActionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length || !cols[actIdx >= 0 ? actIdx : 2]?.trim()) continue;
    rows.push({
      id: cols[idIdx] || `A${String(i).padStart(2, '0')}`,
      stage: cols[stageIdx] || '',
      action: cols[actIdx] || '',
      owner: cols[ownerIdx] || '',
      due_text: cols[dueTextIdx] || '',
      due_date: cols[dueDateIdx] || '',
      done_when: cols[doneIdx] || '',
      origin: cols[originIdx] || 'Stated in plan',
      plan_source_line: cols[lineIdx] || '',
      match_score: cols[scoreIdx] || '',
      status: cols[statusIdx] || 'Not started',
      evidence: cols[evidIdx] || 'Planned. Not yet confirmed by a person',
    });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export async function importActionBatch(
  supabase: SupabaseClient,
  userId: string,
  rows: ImportedActionRow[],
  projectId?: string | null
): Promise<{ success: boolean; batchId: string; count: number; error?: string }> {
  const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const recordsToInsert = rows.map((r) => {
    const primaryOwner = r.owner ? r.owner.split(',')[0].trim() : null;
    const due = /^\d{4}-\d{2}-\d{2}$/.test(r.due_date.trim()) ? r.due_date.trim() : null;
    const desc = [
      r.stage ? `Stage: ${r.stage}` : '',
      r.due_text && !due ? `Due: ${r.due_text}` : '',
      r.owner && r.owner.includes(',') ? `Full owners: ${r.owner}` : '',
      r.done_when ? `Done when: ${r.done_when}` : '',
      r.origin ? `Origin: ${r.origin}` : '',
    ].filter(Boolean).join('\n');

    return {
      user_id: userId,
      project_id: projectId || null,
      action_title: r.action,
      action_description: desc || null,
      owner_name: primaryOwner,
      due_date: due,
      status: 'not_started',
      priority: 'medium',
      ownership_type: 'personal',
      source_type: 'imported_plan',
      origin_marker: r.origin || 'Stated in plan',
      source_id: batchId,
    };
  });

  const { error } = await supabase.from('actions').insert(recordsToInsert);
  if (error) {
    return { success: false, batchId, count: 0, error: error.message };
  }
  return { success: true, batchId, count: recordsToInsert.length };
}

export async function reverseImportBatch(
  supabase: SupabaseClient,
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('actions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('source_id', batchId);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
