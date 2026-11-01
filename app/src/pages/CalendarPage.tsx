import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  ExternalLink,
  Loader2,
  Trash2,
  User,
  Users,
  Search,
  Eye,
  X,
  Sparkles,
  Link2,
} from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { CalendarItem, CalendarItemType, CalendarItemStatus } from '../lib/calendar/types';
import {
  fetchCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  softDeleteCalendarItem,
  fetchDailyNote,
  saveDailyNote,
} from '../lib/calendar/calendarClient';
import type { CollabCalendarEvent } from '../lib/collaboration/collaborationTypes';
import { collaborationStore } from '../lib/collaboration/collaborationStore';
import { isDemoWorkspace } from '../lib/crm/hub/featureFlag';

// Helper for Australian English formatted dates
const formatAuDate = (date: Date): string => {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatAuDay = (date: Date): string => {
  return date.toLocaleDateString('en-AU', { weekday: 'short' });
};

const getStatusBadge = (status: CalendarItemStatus) => {
  switch (status) {
    case 'completed':
      return <span className=\"px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200\">Completed</span>;
    case 'open':
      return <span className=\"px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200\">Open</span>;
    case 'in_progress':
      return <span className=\"px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200\">In Progress</span>;
    case 'blocked':
      return <span className=\"px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200\">Blocked</span>;
    case 'cancelled':
      return <span className=\"px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-200\">Cancelled</span>;
    default:
      return <span className=\"px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800\">Pending</span>;
  }
};

const getTypeBadge = (type: CalendarItemType) => {
  switch (type) {
    case 'meeting':
      return <span className=\"px-2 py-0.5 text-xs font-medium rounded bg-indigo-50 text-indigo-700 border border-indigo-200\">Meeting</span>;
    case 'action':
      return <span className=\"px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200\">Action</span>;
    case 'decision':
      return <span className=\"px-2 py-0.5 text-xs font-medium rounded bg-purple-50 text-purple-700 border border-purple-200\">Decision</span>;
    case 'deadline':
      return <span className=\"px-2 py-0.5 text-xs font-medium rounded bg-rose-50 text-rose-700 border border-rose-200\">Deadline</span>;
    case 'milestone':
      return <span className=\"px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700 border border-amber-200\">Milestone</span>;
    default:
      return <span className=\"px-2 py-0.5 text-xs font-medium rounded bg-slate-50 text-slate-700 border border-slate-200\">Event</span>;
  }
};

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const calendarAccess = useFeatureAccess('calendar_view');

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Filter states
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedVisibility, setSelectedVisibility] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Daily note state
  const [dailyNoteText, setDailyNoteText] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [dailyNoteUpdated, setDailyNoteUpdated] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusReasonText, setStatusReasonText] = useState('');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await fetchCalendarItems(supabase.client, user.id);
    const dbItems = data || [];

    // Synchronise with real-time collaboration store events (strictly gated to demo workspaces only)
    const isDemo = Boolean(user && isDemoWorkspace(user.id));
    const collabEvents = isDemo
      ? collaborationStore
          .getCalendarEvents()
          .map((e: CollabCalendarEvent): CalendarItem => ({
      id: e.id,
      creator_id: e.creatorId,
      calendar_id: null,
      owner_id: null,
      owner_name: e.creatorName,
      organization_id: null,
      type: e.eventType as any,
      title: e.title,
      description: e.description || null,
      notes: '[Demonstration] Synthetic collaboration event',
      reference: null,
      priority: 'medium',
      status: (e.status === 'accepted' ? 'open' : e.status) as any,
      status_reason: e.statusReason || null,
      due_date: e.date,
      due_time: `${e.startTime}:00`,
      date_inferred: false,
      start_date: e.date,
      end_date: e.date,
      progress_percentage: null,
      review_type: null,
      review_cadence: null,
      review_expires_on: null,
      visibility: 'private',
      source_type: 'other',
      source_id: null,
      source_title: e.crmLink || 'CRM Record Room',
      source_reference: null,
      source_occurred_at: e.createdAt,
      project_id: null,
      output_id: null,
      idempotency_key: e.id,
      parent_series_id: null,
      series_index: null,
      conflict_detected: false,
      created_at: e.createdAt,
      updated_at: e.createdAt,
      deleted_at: e.deletedAt || null,
    }))
      : [];

    const existingIds = new Set(dbItems.map((it) => it.id));
    const combined = [...dbItems, ...collabEvents.filter((c: CalendarItem) => !existingIds.has(c.id))];
    setItems(combined);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    return collaborationStore.subscribe(loadData);
  }, []);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (selectedVisibility !== 'all' && item.visibility !== selectedVisibility) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchDesc = item.description?.toLowerCase().includes(query);
        const matchOwner = item.owner_name?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchOwner) return false;
      }
      return true;
    });
  }, [items, selectedType, selectedStatus, selectedVisibility, searchQuery]);

  // Items for the selected day
  const selectedDayItems = useMemo(() => {
    return filteredItems.filter((item) => {
      const itemDate = item.due_date || item.start_date;
      return itemDate === selectedDate;
    });
  }, [filteredItems, selectedDate]);

  // Load daily note when date changes
  useEffect(() => {
    if (!user || !selectedDate) return;
    fetchDailyNote(supabase.client, user.id, selectedDate).then(({ note }) => {
      setDailyNoteText(note?.note_text || '');
      setDailyNoteUpdated(note?.updated_at || null);
    });
  }, [user, selectedDate]);

  const handleSaveDailyNote = async () => {
    if (!user) return;
    setSavingNote(true);
    await saveDailyNote(supabase.client, user.id, selectedDate, dailyNoteText);
    setDailyNoteUpdated(new Date().toISOString());
    setSavingNote(false);
  };

  // Calendar month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Build calendar matrix
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const lastDate = new Date(year, month + 1, 0).getDate();

    // Adjust for Monday as first day of week
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    // Previous month padding
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDate - i,
        monthOffset: -1,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(prevMonthLastDate - i).padStart(2, '0')}`,
      });
    }

    // Current month
    for (let i = 1; i <= lastDate; i++) {
      days.push({
        day: i,
        monthOffset: 0,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        monthOffset: 1,
        dateStr: `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      });
    }

    return days;
  }, [currentMonth]);

  const handleStatusUpdate = async (newStatus: CalendarItemStatus) => {
    if (!selectedItem) return;
    const updates: Partial<CalendarItem> = {
      status: newStatus,
      status_reason: statusReasonText || null,
    };
    const { data } = await updateCalendarItem(supabase.client, selectedItem.id, updates, user?.id);
    if (data) {
      setSelectedItem(data);
      setItems((prev) => prev.map((item) => (item.id === data.id ? data : item)));
    }
    setIsEditingStatus(false);
    setStatusReasonText('');
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this calendar item?')) return;
    const { success } = await softDeleteCalendarItem(supabase.client, itemId, user?.id);
    if (success) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      if (selectedItem?.id === itemId) setSelectedItem(null);
    }
  };

  return (
    <div className=\"p-6 max-w-7xl mx-auto space-y-6\">
      {/* Header */}
      <div className=\"flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4\">
        <div>
          <h1 className=\"text-2xl font-bold text-slate-900 flex items-center gap-2\">
            <CalendarIcon className=\"text-amber-500\" size={28} />
            Unified Workspace Calendar
          </h1>
          <p className=\"text-sm text-slate-600 mt-1\">
            Actions, decisions, deadlines, and meetings linked strictly to project lineage.
          </p>
        </div>
        <div className=\"flex items-center gap-3\">
          <button
            onClick={() => {
              const title = prompt('Enter item title:');
              if (!title) return;
              createCalendarItem(supabase.client, {
                title,
                type: 'action',
                due_date: selectedDate,
                creator_id: user?.id || 'anonymous',
              }).then(({ data }) => {
                if (data) setItems((prev) => [...prev, data]);
              });
            }}
            className=\"flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm\"
          >
            <Plus size={16} />
            New Item
          </button>
        </div>
      </div>

      {/* Main Grid: Left Calendar View + Right Day Agenda */}
      <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
        {/* Left Column: Month Matrix + Filters */}
        <div className=\"lg:col-span-2 space-y-6\">
          {/* Controls Bar */}
          <div className=\"bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4\">
            <div className=\"flex items-center gap-2\">
              <button
                onClick={prevMonth}
                className=\"p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors\"
              >
                <ChevronLeft size={20} />
              </button>
              <span className=\"text-base font-bold text-slate-800 min-w-36 text-center\">
                {currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={nextMonth}
                className=\"p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors\"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Quick Filters */}
            <div className=\"flex flex-wrap items-center gap-2\">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className=\"px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500\"
              >
                <option value=\"all\">All Types</option>
                <option value=\"meeting\">Meetings</option>
                <option value=\"action\">Actions</option>
                <option value=\"decision\">Decisions</option>
                <option value=\"deadline\">Deadlines</option>
                <option value=\"milestone\">Milestones</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className=\"px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500\"
              >
                <option value=\"all\">All Statuses</option>
                <option value=\"open\">Open</option>
                <option value=\"in_progress\">In Progress</option>
                <option value=\"completed\">Completed</option>
                <option value=\"blocked\">Blocked</option>
              </select>
            </div>
          </div>

          {/* Month Matrix */}
          <div className=\"bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden\">
            <div className=\"grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-500 py-2.5\">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
            <div className=\"grid grid-cols-7 divide-x divide-y divide-slate-100\">
              {daysInMonth.map((dayObj, idx) => {
                const isSelected = dayObj.dateStr === selectedDate;
                const isToday = dayObj.dateStr === new Date().toISOString().split('T')[0];
                const dayItems = filteredItems.filter((i) => (i.due_date || i.start_date) === dayObj.dateStr);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(dayObj.dateStr)}
                    className={`min-h-[96px] p-2 transition-colors cursor-pointer relative ${
                      dayObj.monthOffset !== 0 ? 'bg-slate-50/50 text-slate-400' : 'bg-white text-slate-800'
                    } ${isSelected ? 'ring-2 ring-inset ring-amber-500 bg-amber-50/30' : 'hover:bg-slate-50'}`}
                  >
                    <div className=\"flex items-center justify-between mb-1\">
                      <span
                        className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                          isToday ? 'bg-amber-500 text-white' : ''
                        }`}
                      >
                        {dayObj.day}
                      </span>
                      {dayItems.length > 0 && (
                        <span className=\"text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 rounded-full\">
                          {dayItems.length}
                        </span>
                      )}
                    </div>

                    {/* Tiny Event Pills */}
                    <div className=\"space-y-1 overflow-hidden max-h-[64px]\">
                      {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={`text-[10px] truncate px-1.5 py-0.5 rounded font-medium border ${
                            item.status === 'completed'
                              ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              : item.type === 'action'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                              : item.type === 'meeting'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-100'
                              : 'bg-amber-50 text-amber-800 border-amber-100'
                          }`}
                        >
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className=\"text-[9px] text-slate-400 font-semibold pl-1\">
                          +{dayItems.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Day Agenda & Daily Note */}
        <div className=\"space-y-6\">
          {/* Day Agenda */}
          <div className=\"bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4\">
            <div className=\"flex items-center justify-between border-b border-slate-100 pb-3\">
              <div>
                <h2 className=\"text-base font-bold text-slate-900\">
                  Agenda for {new Date(selectedDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <span className=\"text-xs text-slate-500\">
                  {selectedDayItems.length} item{selectedDayItems.length === 1 ? '' : 's'} scheduled
                </span>
              </div>
            </div>

            {loading ? (
              <div className=\"py-12 flex justify-center text-slate-400\">
                <Loader2 className=\"animate-spin\" size={24} />
              </div>
            ) : selectedDayItems.length === 0 ? (
              <div className=\"py-12 text-center text-slate-400 text-sm space-y-2\">
                <Clock className=\"mx-auto text-slate-300\" size={28} />
                <p>No actions or events on this date.</p>
              </div>
            ) : (
              <div className=\"space-y-2 max-h-[380px] overflow-y-auto pr-1\">
                {selectedDayItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedItem?.id === item.id
                        ? 'border-amber-500 bg-amber-50/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className=\"flex items-start justify-between gap-2 mb-1.5\">
                      <h3 className=\"text-sm font-semibold text-slate-900 line-clamp-1\">{item.title}</h3>
                      <div className=\"flex items-center gap-1.5 shrink-0\">
                        {getTypeBadge(item.type)}
                      </div>
                    </div>
                    {item.description && (
                      <p className=\"text-xs text-slate-600 line-clamp-2 mb-2\">{item.description}</p>
                    )}
                    <div className=\"flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100\">
                      <div className=\"flex items-center gap-1\">
                        <Clock size={12} />
                        <span>{item.due_time || 'All day'}</span>
                      </div>
                      <div>{getStatusBadge(item.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Note Section */}
          <div className=\"bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3\">
            <div className=\"flex items-center justify-between\">
              <h3 className=\"text-sm font-bold text-slate-800 flex items-center gap-1.5\">
                <Sparkles size={16} className=\"text-amber-500\" />
                Daily Note
              </h3>
              {dailyNoteUpdated && (
                <span className=\"text-[10px] text-slate-400\">
                  Saved {new Date(dailyNoteUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <textarea
              value={dailyNoteText}
              onChange={(e) => setDailyNoteText(e.target.value)}
              placeholder=\"Add daily reflections, priorities, or handover notes for this day...\"
              rows={4}
              className=\"w-full text-xs text-slate-800 p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500\"
            />
            <div className=\"flex justify-end\">
              <button
                onClick={handleSaveDailyNote}
                disabled={savingNote}
                className=\"px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50\"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Detail Drawer */}
      {selectedItem && (
        <div className=\"fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-xl z-50 p-6 overflow-y-auto space-y-6\">
          <div className=\"flex items-center justify-between border-b border-slate-100 pb-3\">
            <div className=\"flex items-center gap-2\">
              {getTypeBadge(selectedItem.type)}
              <span className=\"text-xs text-slate-400\">ID: {selectedItem.id.slice(0, 8)}</span>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className=\"p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100\"
            >
              <X size={18} />
            </button>
          </div>

          <div>
            <h2 className=\"text-lg font-bold text-slate-900 mb-1\">{selectedItem.title}</h2>
            <div className=\"flex items-center gap-2 mt-2\">
              {getStatusBadge(selectedItem.status)}
              <button
                onClick={() => setIsEditingStatus(!isEditingStatus)}
                className=\"text-xs text-indigo-600 font-semibold hover:underline\"
              >
                Change Status
              </button>
            </div>
          </div>

          {/* Status Editing Popover */}
          {isEditingStatus && (
            <div className=\"p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3\">
              <p className=\"text-xs font-semibold text-slate-700\">Select new status:</p>
              <div className=\"grid grid-cols-2 gap-2\">
                {(['open', 'in_progress', 'completed', 'blocked', 'cancelled'] as CalendarItemStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusUpdate(st)}
                    className=\"text-xs py-1.5 px-2 bg-white border border-slate-200 rounded font-medium hover:border-slate-300 capitalize text-slate-800\"
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <input
                type=\"text\"
                placeholder=\"Reason for change (optional)...\"
                value={statusReasonText}
                onChange={(e) => setStatusReasonText(e.target.value)}
                className=\"w-full text-xs p-2 border border-slate-200 rounded bg-white\"
              />
            </div>
          )}

          {/* Details Metadata */}
          <div className=\"space-y-3 text-xs text-slate-600 border-t border-b border-slate-100 py-4\">
            <div className=\"flex justify-between\">
              <span className=\"text-slate-400\">Due Date:</span>
              <span className=\"font-medium text-slate-800\">{selectedItem.due_date || 'None'}</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-slate-400\">Due Time:</span>
              <span className=\"font-medium text-slate-800\">{selectedItem.due_time || 'All Day'}</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-slate-400\">Owner:</span>
              <span className=\"font-medium text-slate-800\">{selectedItem.owner_name || 'Unassigned'}</span>
            </div>
            <div className=\"flex justify-between\">
              <span className=\"text-slate-400\">Visibility:</span>
              <span className=\"font-medium text-slate-800 capitalize\">{selectedItem.visibility}</span>
            </div>
            {selectedItem.source_title && (
              <div className=\"flex justify-between\">
                <span className=\"text-slate-400\">Origin Link:</span>
                <span className=\"font-medium text-indigo-600 flex items-center gap-1\">
                  <Link2 size={12} />
                  {selectedItem.source_title}
                </span>
              </div>
            )}
          </div>

          {/* Notes or Description */}
          {selectedItem.description && (
            <div>
              <h4 className=\"text-xs font-bold text-slate-700 mb-1\">Description</h4>
              <p className=\"text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100\">
                {selectedItem.description}
              </p>
            </div>
          )}

          {/* Delete Action */}
          <div className=\"pt-4 border-t border-slate-100 flex justify-between items-center\">
            <button
              onClick={() => handleDelete(selectedItem.id)}
              className=\"flex items-center gap-1.5 text-xs text-red-600 font-semibold hover:text-red-700 transition-colors\"
            >
              <Trash2 size={14} />
              Delete Item
            </button>
            <button
              onClick={() => setSelectedItem(null)}
              className=\"px-3 py-1.5 border border-slate-200 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-50\"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
