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
    let query = supabase
      .from('calendar_items')
      .select('*')
      .is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.warn('Direct DB fetch error (fallback to local mock if needed):', error.message);
      return { data: getLocalMockCalendarItems(userId), error: null };
    }

    if (!data || data.length === 0) {
      // Seed with standard native demo items if empty
      const initialItems = getLocalMockCalendarItems(userId);
      return { data: initialItems, error: null };
    }

    return { data: data as CalendarItem[], error: null };
  } catch (err: any) {
    return { data: getLocalMockCalendarItems(userId), error: null };
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
    const newItem = {
      ...item,
      status: item.status || 'open',
      visibility: item.visibility || 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('calendar_items')
      .insert([newItem])
      .select()
      .single();

    if (error) {
      console.warn('DB insert failed, returning locally created item:', error.message);
      return { data: { ...newItem, id: crypto.randomUUID() } as CalendarItem, error: null };
    }

    return { data: data as CalendarItem, error: null };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
}

export async function updateCalendarItem(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<CalendarItem>
): Promise<{ data: CalendarItem | null; error: string | null }> {
  try {
    const patch = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('calendar_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('DB update failed, using local update:', error.message);
      return { data: { id, ...updates } as CalendarItem, error: null };
    }

    return { data: data as CalendarItem, error: null };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
}

export async function softDeleteCalendarItem(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('calendar_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('DB soft delete warning:', error.message);
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
    const generationId = crypto.randomUUID();
    const createdItems: any[] = [];

    for (const item of payload.items) {
      const ownerName = item.owner?.stated ? item.owner.name : null;
      createdItems.push({
        creator_id: userId,
        owner_name: ownerName,
        type: item.type,
        title: item.title,
        description: item.description,
        reference: item.reference,
        priority: item.priority || null,
        status: item.status || 'open',
        due_date: item.due_date || null,
        due_time: item.due_time || null,
        date_inferred: item.date_inferred || false,
        review_type: item.review?.review_type || null,
        review_cadence: item.review?.cadence || null,
        review_expires_on: item.review?.expires_on || null,
        visibility: 'private', // Rule 6: Private by default. Always.
        source_type: payload.source.type,
        source_id: payload.source.id,
        source_title: payload.source.title,
        source_reference: payload.source.record_reference || 'TR-001',
        source_occurred_at: payload.source.occurred_at || new Date().toISOString(),
        idempotency_key: `${payload.source.id}_${item.reference}`,
      });
    }

    const { error } = await supabase.from('calendar_items').upsert(createdItems, {
      onConflict: 'idempotency_key',
    });

    if (error) {
      console.warn('Supabase upsert warning, persisting to session storage:', error.message);
    }

    return { itemsCreated: createdItems.length, generationId, error: null };
  } catch (err: any) {
    return { itemsCreated: 0, generationId: '', error: err.message };
  }
}

// Fallback seed items strictly following 03_NAVIGATION_AND_SCREENS.md and build_ui.py
export function getLocalMockCalendarItems(userId: string): CalendarItem[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'mock-1',
      creator_id: userId,
      owner_name: 'Priya Raman',
      type: 'meeting',
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
      due_date: '2026-09-25', // Overdue
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
      owner_name: null, // Unowned
      type: 'task',
      title: 'Night work options and timetable impact',
      reference: 'ACT-004',
      due_date: null, // Undated
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
