import { SupabaseClient } from '@supabase/supabase-js';
import {
  CalendarItem,
  CalendarSummaryCounts,
  GenerateCalendarPayload,
  CalendarItemStatus,
  CalendarItemPriority,
  CalendarItemType
} from './calendarTypes';

export async function fetchCalendarItems(
  supabase: SupabaseClient,
  userId: string,
  options?: { includeCompleted?: boolean; view?: string }
): Promise<{ data: CalendarItem[]; error: string | null }> {
  try {
    // 1. Fetch calendar items for current user (private by default)
    // Filters out soft-deleted items, ordered by due_date ascending
    let query = supabase
      .from('calendar_items')
      .select('*')
      .is('deleted_at', null);

    if (userId) {
      query = query.eq('creator_id', userId);
    }

    const { data, error } = await query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Direct DB fetch error:', error.message);
      return { data: [], error: error.message };
    }

    const items = (data || []) as CalendarItem[];
    if (items.length === 0) {
      return { data: [], error: null };
    }

    // 2. Validate source project and output status to ensure deleted sources are excluded
    // Collect non-null project_ids and output_ids
    const projectIds = Array.from(new Set(items.map((it) => it.project_id).filter(Boolean))) as string[];
    const outputIds = Array.from(new Set(items.map((it) => it.output_id).filter(Boolean))) as string[];

    const deletedProjectIds = new Set<string>();
    const deletedOutputIds = new Set<string>();

    if (projectIds.length > 0) {
      const { data: delProjects } = await supabase
        .from('projects')
        .select('id')
        .in('id', projectIds)
        .not('deleted_at', 'is', null);

      if (delProjects) {
        for (const p of delProjects) {
          deletedProjectIds.add(p.id);
        }
      }
    }

    if (outputIds.length > 0) {
      const { data: delOutputs } = await supabase
        .from('outputs')
        .select('id')
        .in('id', outputIds)
        .not('deleted_at', 'is', null);

      if (delOutputs) {
        for (const o of delOutputs) {
          deletedOutputIds.add(o.id);
        }
      }
    }

    // Filter out items whose linked project or output is soft-deleted
    const validItems = items.filter((it) => {
      if (it.project_id && deletedProjectIds.has(it.project_id)) {
        return false;
      }
      if (it.output_id && deletedOutputIds.has(it.output_id)) {
        return false;
      }
      return true;
    });

    return { data: validItems, error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export function computeSummaryCounts(items: CalendarItem[]): CalendarSummaryCounts {
  const todayStr = new Date().toISOString().split('T')[0];
  let overdue = 0;
  let unowned = 0;
  let undated = 0;
  let reviewsDue = 0;
  let totalOpen = 0;
  let todayCount = 0;

  for (const item of items) {
    if (item.status === 'completed' || item.status === 'cancelled') continue;
    totalOpen++;

    if (item.due_date && item.due_date < todayStr) {
      overdue++;
    }
    if (!item.owner_id && (!item.owner_name || item.owner_name.trim() === '')) {
      unowned++;
    }
    if (!item.due_date) {
      undated++;
    }
    if (item.type === 'review' || item.review_type) {
      reviewsDue++;
    }
    if (item.due_date === todayStr) {
      todayCount++;
    }
  }

  return {
    overdue,
    unowned,
    undated,
    reviewsDue,
    totalOpen,
    todayCount,
  };
}

export async function createCalendarItem(
  supabase: SupabaseClient,
  item: Partial<CalendarItem> & { title: string; creator_id: string; type: CalendarItemType }
): Promise<{ data: CalendarItem | null; error: string | null }> {
  try {
    const status = item.status || 'open';
    const statusReason = (status === 'waiting' || status === 'blocked' || status === 'cancelled')
      ? (item.status_reason || 'Status updated by user')
      : (item.status_reason || null);

    const newItem = {
      creator_id: item.creator_id,
      calendar_id: item.calendar_id || null,
      owner_id: item.owner_id || null,
      owner_name: item.owner_name || null,
      organization_id: item.organization_id || null,
      type: item.type,
      title: item.title,
      description: item.description || null,
      notes: item.notes || null,
      reference: item.reference || null,
      priority: item.priority || null,
      status: status,
      status_reason: statusReason,
      due_date: item.due_date || null,
      due_time: item.due_time || null,
      date_inferred: item.date_inferred || false,
      start_date: item.start_date || null,
      end_date: item.end_date || null,
      progress_percentage: item.progress_percentage || null,
      review_type: item.review_type || null,
      review_cadence: item.review_cadence || null,
      review_expires_on: item.review_expires_on || null,
      visibility: item.visibility || 'private',
      source_type: item.source_type || 'other',
      source_id: item.source_id || null,
      source_title: item.source_title || null,
      source_reference: item.source_reference || null,
      source_occurred_at: item.source_occurred_at || null,
      project_id: item.project_id || null,
      output_id: item.output_id || null,
      idempotency_key: item.idempotency_key || crypto.randomUUID(),
    };

    const { data, error } = await supabase
      .from('calendar_items')
      .insert([newItem])
      .select()
      .single();

    if (error) {
      console.error('DB insert failed:', error.message);
      return { data: null, error: error.message };
    }

    await recordAudit(supabase, item.creator_id, 'create', 'calendar_item', data.id, null, data);

    return { data: data as CalendarItem, error: null };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
}

export async function updateCalendarItem(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<CalendarItem>,
  actorId?: string
): Promise<{ data: CalendarItem | null; error: string | null }> {
  try {
    const patch: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (patch.status && (patch.status === 'waiting' || patch.status === 'blocked' || patch.status === 'cancelled')) {
      if (!patch.status_reason || patch.status_reason.trim() === '') {
        patch.status_reason = 'Reason required for non-active status';
      }
    }

    const { data, error } = await supabase
      .from('calendar_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('DB update failed:', error.message);
      return { data: null, error: error.message };
    }

    if (actorId) {
      await recordAudit(supabase, actorId, 'update', 'calendar_item', id, null, data);
    }

    return { data: data as CalendarItem, error: null };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
}

export async function softDeleteCalendarItem(
  supabase: SupabaseClient,
  id: string,
  actorId?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('calendar_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('DB soft delete error:', error.message);
      return { success: false, error: error.message };
    }

    if (actorId) {
      await recordAudit(supabase, actorId, 'soft_delete', 'calendar_item', id, null, { deleted_at: new Date().toISOString() });
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateToCalendar(
  supabase: SupabaseClient,
  userId: string,
  payload: GenerateCalendarPayload
): Promise<{ itemsCreated: number; generationId: string; error: string | null }> {
  try {
    const projectId = payload.source.project_id || (payload.source.type === 'project' ? payload.source.id : null);
    const outputId = payload.source.output_id || (payload.source.type === 'report' ? payload.source.id : null);

    const idempotencyKey = payload.idempotency_key || `${outputId || projectId || payload.source.id}_${Date.now()}`;
    const generationId = crypto.randomUUID();

    // 1. Record generation event
    const { error: genError } = await supabase.from('calendar_generations').insert([{
      id: generationId,
      user_id: userId,
      source_type: payload.source.type,
      source_id: payload.source.id,
      options: payload.options,
      idempotency_key: idempotencyKey,
      items_count: payload.items.length,
      created_at: new Date().toISOString()
    }]);

    if (genError) {
      console.error('Calendar generation record error:', genError.message);
    }

    // 2. Prepare items with full lineage and versioned idempotency key
    const uniformRows = payload.items.map((item, idx) => {
      const ownerName = item.owner?.stated ? item.owner.name : null;
      // Scoped idempotency key: includes source output id, item reference, and generation id
      const itemKey = `${outputId || payload.source.id}_${item.reference || `item_${idx}`}_${generationId.slice(0, 8)}`;

      return {
        creator_id: userId,
        calendar_id: null,
        owner_id: item.owner?.user_id || null,
        owner_name: ownerName,
        organization_id: null,
        type: item.type === 'meeting' ? 'event' : item.type,
        title: item.title,
        description: item.description || null,
        notes: null,
        reference: item.reference || null,
        priority: item.priority || null,
        status: item.status || 'open',
        status_reason: null,
        due_date: item.due_date || null,
        due_time: item.due_time || null,
        date_inferred: item.date_inferred || false,
        start_date: null,
        end_date: null,
        progress_percentage: null,
        review_type: item.review?.review_type || null,
        review_cadence: item.review?.cadence || null,
        review_expires_on: item.review?.expires_on || null,
        visibility: 'private',
        source_type: payload.source.type || 'meeting',
        source_id: payload.source.id,
        source_title: payload.source.title,
        source_reference: payload.source.record_reference || 'TR-001',
        source_occurred_at: payload.source.occurred_at || new Date().toISOString(),
        project_id: projectId,
        output_id: outputId,
        idempotency_key: itemKey,
      };
    });

    const { data, error } = await supabase
      .from('calendar_items')
      .upsert(uniformRows, { onConflict: 'idempotency_key' })
      .select();

    if (error) {
      console.error('Supabase calendar_items upsert failed:', error.message);
      return { itemsCreated: 0, generationId: '', error: error.message };
    }

    const createdCount = data ? data.length : uniformRows.length;

    await recordAudit(supabase, userId, 'generate', 'calendar_items', generationId, null, {
      source_id: payload.source.id,
      project_id: projectId,
      output_id: outputId,
      count: createdCount,
    });

    return { itemsCreated: createdCount, generationId, error: null };
  } catch (err: any) {
    return { itemsCreated: 0, generationId: '', error: err.message };
  }
}

export async function undoCalendarGeneration(
  supabase: SupabaseClient,
  userId: string,
  generationId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const now = new Date().toISOString();

    // 1. Mark generation record undone
    await supabase
      .from('calendar_generations')
      .update({ undone_at: now })
      .eq('id', generationId)
      .eq('user_id', userId);

    // 2. Soft-delete generated calendar items created in this generation batch
    const genSuffix = generationId.slice(0, 8);
    await supabase
      .from('calendar_items')
      .update({ deleted_at: now })
      .eq('creator_id', userId)
      .like('idempotency_key', `%_${genSuffix}`)
      .is('deleted_at', null);

    await recordAudit(supabase, userId, 'undo_generate', 'calendar_generations', generationId, null, { undone_at: now });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function recordAudit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  objectType: string,
  objectId: string,
  before: any,
  after: any
) {
  try {
    await supabase.from('calendar_audit').insert([{
      actor_id: actorId,
      action,
      object_type: objectType,
      object_id: objectId,
      before: before || null,
      after: after || null,
      created_at: new Date().toISOString(),
    }]);
  } catch (e) {
  }
}

export function getLocalMockCalendarItems(userId: string): CalendarItem[] {
  // Empty array: never invent dummy data or stale source records
  return [];
}

export async function fetchDailyNote(
  supabase: SupabaseClient,
  userId: string,
  dateStr: string
): Promise<{ note: string; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('calendar_daily_notes')
      .select('note')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .maybeSingle();

    if (error) {
      const local = localStorage.getItem(`concludo_daily_note_${userId}_${dateStr}`);
      return { note: local || '', error: error.message };
    }

    if (data) {
      return { note: data.note || '', error: null };
    }

    const local = localStorage.getItem(`concludo_daily_note_${userId}_${dateStr}`);
    return { note: local || '', error: null };
  } catch (err: any) {
    const local = localStorage.getItem(`concludo_daily_note_${userId}_${dateStr}`);
    return { note: local || '', error: err.message };
  }
}

export async function saveDailyNote(
  supabase: SupabaseClient,
  userId: string,
  dateStr: string,
  noteText: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    localStorage.setItem(`concludo_daily_note_${userId}_${dateStr}`, noteText);

    const { error } = await supabase
      .from('calendar_daily_notes')
      .upsert(
        {
          user_id: userId,
          date: dateStr,
          note: noteText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' }
      );

    if (error) {
      console.warn('Daily note DB save warning:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
