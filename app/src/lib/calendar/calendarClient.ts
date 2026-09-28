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
    const { data, error } = await supabase
      .from('calendar_items')
      .select('*')
      .is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Direct DB fetch error:', error.message);
      return { data: [], error: error.message };
    }

    if (!data || data.length === 0) {
      const seedItems = getLocalMockCalendarItems(userId);
      const inserted = await seedInitialCalendarItems(supabase, seedItems);
      if (inserted.length > 0) {
        return { data: inserted, error: null };
      }
      return { data: seedItems, error: null };
    }

    return { data: data as CalendarItem[], error: null };
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
    const idempotencyKey = payload.idempotency_key || `${payload.source.id}_${Date.now()}`;
    const generationId = crypto.randomUUID();

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

    const uniformRows = payload.items.map((item) => {
      const ownerName = item.owner?.stated ? item.owner.name : null;
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
        project_id: payload.source.type === 'project' ? payload.source.id : null,
        output_id: payload.source.type === 'report' ? payload.source.id : null,
        idempotency_key: `${payload.source.id}_${item.reference || item.title}`,
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

    await supabase
      .from('calendar_generations')
      .update({ undone_at: now })
      .eq('id', generationId)
      .eq('user_id', userId);

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

async function seedInitialCalendarItems(supabase: SupabaseClient, items: CalendarItem[]): Promise<CalendarItem[]> {
  try {
    const rows = items.map((it) => ({
      creator_id: it.creator_id,
      owner_name: it.owner_name || null,
      type: it.type === 'meeting' ? 'event' : it.type,
      title: it.title,
      reference: it.reference || null,
      priority: it.priority || null,
      status: it.status || 'open',
      due_date: it.due_date || null,
      due_time: it.due_time || null,
      visibility: 'private',
      source_reference: it.source_reference || 'TR-001',
      source_title: it.source_title || 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      idempotency_key: `seed_${it.creator_id}_${it.reference || it.title}`,
    }));

    const { data, error } = await supabase.from('calendar_items').upsert(rows, { onConflict: 'idempotency_key' }).select();
    if (error) {
      console.warn('Seed insert warning:', error.message);
      return [];
    }
    return (data as CalendarItem[]) || [];
  } catch {
    return [];
  }
}

export function getLocalMockCalendarItems(userId: string): CalendarItem[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'mock-1',
      creator_id: userId,
      owner_name: 'Priya Raman',
      type: 'event',
      title: 'Client review, Harding',
      due_date: today,
      due_time: '09:00:00',
      status: 'open',
      priority: 'high',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-2',
      creator_id: userId,
      owner_name: 'Priya Raman',
      type: 'review',
      review_type: 'decision',
      title: 'Decision review DEC-004',
      reference: 'DEC-004',
      due_date: today,
      due_time: '11:00:00',
      status: 'open',
      priority: 'high',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-3',
      creator_id: userId,
      owner_name: 'Liam Chen',
      type: 'task',
      title: 'Variation paperwork to Priya',
      reference: 'ACT-001',
      due_date: '2026-09-25',
      due_time: '17:00:00',
      status: 'open',
      priority: 'critical',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-4',
      creator_id: userId,
      owner_name: null,
      type: 'task',
      title: 'Night work options and timetable impact',
      reference: 'ACT-004',
      due_date: null,
      status: 'open',
      priority: 'medium',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-5',
      creator_id: userId,
      owner_name: 'Mark Taylor',
      type: 'milestone',
      title: 'Crew numbers and method statement',
      reference: 'ACT-002',
      due_date: '2026-10-01',
      status: 'in_progress',
      priority: 'high',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-6',
      creator_id: userId,
      owner_name: 'Sophie Martin',
      type: 'task',
      title: 'Council notifications for station staging',
      reference: 'ACT-005',
      due_date: '2026-10-02',
      status: 'open',
      priority: 'medium',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'mock-7',
      creator_id: userId,
      owner_name: 'Liam Chen',
      type: 'review',
      review_type: 'risk',
      title: 'Risk review RSK-002: Liquidated damages clause',
      reference: 'RSK-002',
      due_date: '2026-10-02',
      status: 'open',
      priority: 'high',
      visibility: 'private',
      source_reference: 'TR-001',
      source_title: 'Platform Passenger Information Display (PID) Upgrade, Stage 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}
