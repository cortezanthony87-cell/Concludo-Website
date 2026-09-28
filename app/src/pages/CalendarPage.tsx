import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/auth/AuthContext';
import { supabase } from '../lib/supabase/client';
import {
  CalendarItem,
  CalendarSummaryCounts,
  CalendarItemType,
  CalendarItemStatus,
  CalendarItemPriority,
} from '../lib/calendar/calendarTypes';
import {
  fetchCalendarItems,
  computeSummaryCounts,
  createCalendarItem,
  updateCalendarItem,
  softDeleteCalendarItem,
  fetchDailyNote,
  saveDailyNote,
} from '../lib/calendar/calendarClient';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Tag,
  Link2,
  X,
  FileText,
  AlertTriangle,
  Layers,
  CalendarDays,
  ListTodo,
  Columns3,
  Sparkles,
  Edit,
  Pencil,
  Trash2,
  Save,
  StickyNote,
} from 'lucide-react';

type CalendarSubView = 'home' | 'day' | 'week' | 'month' | 'agenda' | 'board';

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<CalendarSubView>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);

  // Selected date for day view and calendar selection
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return '2026-10-28';
  });

  // Calendar month/year navigation
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(9); // 0-indexed: 9 = October

  // Daily note for the selected date
  const [dailyNoteText, setDailyNoteText] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<boolean>(false);

  // Quick Create / New Item Form State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState<CalendarItemType>('task');
  const [quickDueDate, setQuickDueDate] = useState('2026-10-28');
  const [quickDueTime, setQuickDueTime] = useState('09:00');
  const [quickOwner, setQuickOwner] = useState('');
  const [quickPriority, setQuickPriority] = useState<CalendarItemPriority>('medium');
  const [quickDescription, setQuickDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Drawer Edit Form State
  const [isEditingInDrawer, setIsEditingInDrawer] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editType, setEditType] = useState<CalendarItemType>('task');
  const [editPriority, setEditPriority] = useState<CalendarItemPriority>('medium');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Status reason modal for Blocked / Waiting / Cancelled
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    id: string;
    newStatus: CalendarItemStatus;
  } | null>(null);
  const [statusReasonText, setStatusReasonText] = useState('');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await fetchCalendarItems(supabase.client, user.id);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Load daily note when selectedDate or user changes
  useEffect(() => {
    if (!user || !selectedDate) return;
    let isCancelled = false;
    fetchDailyNote(supabase.client, user.id, selectedDate).then(({ note }) => {
      if (!isCancelled) {
        setDailyNoteText(note);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [user, selectedDate]);

  const handleSaveDailyNote = async () => {
    if (!user || !selectedDate) return;
    setSavingNote(true);
    await saveDailyNote(supabase.client, user.id, selectedDate, dailyNoteText);
    setSavingNote(false);
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);
  };

  const summary = useMemo(() => computeSummaryCounts(items), [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.owner_name && item.owner_name.toLowerCase().includes(q)) ||
        (item.reference && item.reference.toLowerCase().includes(q)) ||
        (item.source_title && item.source_title.toLowerCase().includes(q))
      );
    });
  }, [items, searchQuery]);

  // Scheduled dates set for highlighting
  const scheduledDatesSet = useMemo(() => {
    const dates = new Set<string>();
    for (const item of items) {
      if (item.due_date && item.status !== 'cancelled') {
        dates.add(item.due_date);
      }
    }
    return dates;
  }, [items]);

  // Open drawer for viewing / editing an item
  const openItemDetail = (item: CalendarItem, startInEditMode = false) => {
    setSelectedItem(item);
    setIsEditingInDrawer(startInEditMode);
    setEditTitle(item.title);
    setEditOwner(item.owner_name || '');
    setEditDueDate(item.due_date || '');
    setEditDueTime(item.due_time ? item.due_time.slice(0, 5) : '');
    setEditType(item.type);
    setEditPriority(item.priority || 'medium');
    setEditDescription(item.description || '');
    setEditNotes(item.notes || '');
    setIsDrawerOpen(true);
  };

  const handleSaveDrawerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !editTitle.trim()) return;
    setSavingEdit(true);

    const updates: Partial<CalendarItem> = {
      title: editTitle.trim(),
      owner_name: editOwner.trim() || null,
      due_date: editDueDate || null,
      due_time: editDueTime ? `${editDueTime}:00` : null,
      type: editType,
      priority: editPriority,
      description: editDescription.trim() || null,
      notes: editNotes.trim() || null,
    };

    const { data } = await updateCalendarItem(supabase.client, selectedItem.id, updates, user?.id);
    if (data) {
      setItems((prev) => prev.map((it) => (it.id === selectedItem.id ? { ...it, ...data } : it)));
      setSelectedItem((prev) => (prev ? { ...prev, ...data } : null));
      setIsEditingInDrawer(false);
    }
    setSavingEdit(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this calendar item? (Soft-deleted with full audit record)')) {
      return;
    }
    const { success } = await softDeleteCalendarItem(supabase.client, itemId, user?.id);
    if (success) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setIsDrawerOpen(false);
      setSelectedItem(null);
    }
  };

  // Click on a calendar day
  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentView('day');
  };

  // Open quick create prefilled with a specific date/hour
  const handleOpenCreateForDate = (dateStr: string, timeStr?: string) => {
    setQuickDueDate(dateStr);
    setQuickDueTime(timeStr || '09:00');
    setQuickTitle('');
    setQuickOwner('');
    setQuickType('task');
    setQuickPriority('medium');
    setQuickDescription('');
    setIsQuickCreateOpen(true);
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickTitle.trim()) return;
    setCreating(true);

    const { data } = await createCalendarItem(supabase.client, {
      creator_id: user.id,
      title: quickTitle.trim(),
      type: quickType,
      due_date: quickDueDate || null,
      due_time: quickDueTime ? `${quickDueTime}:00` : null,
      owner_name: quickOwner.trim() || null,
      priority: quickPriority,
      description: quickDescription.trim() || null,
      status: 'open',
      visibility: 'private',
    });

    if (data) {
      setItems((prev) => [data, ...prev]);
      setQuickTitle('');
      setQuickDueDate(selectedDate || '2026-10-28');
      setQuickDueTime('09:00');
      setQuickOwner('');
      setQuickDescription('');
      setIsQuickCreateOpen(false);
    }
    setCreating(false);
  };

  const handleStatusChangeTrigger = (item: CalendarItem, newStatus: CalendarItemStatus) => {
    if (newStatus === 'blocked' || newStatus === 'waiting' || newStatus === 'cancelled') {
      setPendingStatusChange({ id: item.id, newStatus });
      setStatusReasonText(item.status_reason || '');
      return;
    }
    applyStatusChange(item.id, newStatus, null);
  };

  const applyStatusChange = async (
    id: string,
    newStatus: CalendarItemStatus,
    reason: string | null
  ) => {
    const { data } = await updateCalendarItem(supabase.client, id, {
      status: newStatus,
      status_reason: reason,
    });
    if (data) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
      if (selectedItem?.id === id) {
        setSelectedItem((prev) => (prev ? { ...prev, ...data } : null));
      }
    }
    setPendingStatusChange(null);
    setStatusReasonText('');
  };

  const getItemToneColor = (kind: CalendarItemType, isOverdue = false) => {
    if (isOverdue) return { bg: 'rgba(188, 138, 28, 0.16)', bar: '#E2B53C', text: '#BC8A1C' };
    switch (kind) {
      case 'meeting':
        return { bg: 'rgba(22, 38, 63, 0.08)', bar: '#21395C', text: '#16263F' };
      case 'task':
        return { bg: 'rgba(33, 57, 92, 0.08)', bar: '#21395C', text: '#16263F' };
      case 'milestone':
        return { bg: 'rgba(226, 181, 60, 0.15)', bar: '#E2B53C', text: '#16263F' };
      case 'review':
        return { bg: 'rgba(188, 138, 28, 0.15)', bar: '#BC8A1C', text: '#16263F' };
      case 'board_action':
        return { bg: 'rgba(22, 38, 63, 0.12)', bar: '#16263F', text: '#16263F' };
      default:
        return { bg: 'rgba(22, 38, 63, 0.06)', bar: '#5A6478', text: '#16263F' };
    }
  };

  const todayStr = '2026-10-28';

  // Format date readable
  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Days in month calculation for the calendar grid
  const daysInCurrentMonth = useMemo(() => {
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7; // Monday = 0
    return { totalDays, firstDayIndex };
  }, [calendarYear, calendarMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  // Items for the selected day
  const selectedDayItems = useMemo(() => {
    return filteredItems.filter((it) => it.due_date === selectedDate);
  }, [filteredItems, selectedDate]);

  // Hourly slots (24 hours: 00:00 to 23:00)
  const hourlySlots = useMemo(() => {
    return Array.from({ length: 24 }).map((_, h) => {
      const hStr = h < 10 ? `0${h}` : `${h}`;
      const label = `${hStr}:00`;
      const period = h < 12 ? 'AM' : 'PM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayTime = `${displayHour}:00 ${period}`;

      const slotItems = selectedDayItems.filter((it) => {
        if (!it.due_time) return false;
        const itemH = it.due_time.split(':')[0];
        return itemH === hStr;
      });

      return {
        hour: h,
        label,
        displayTime,
        items: slotItems,
      };
    });
  }, [selectedDayItems]);

  const allDayOrUntimedItems = useMemo(() => {
    return selectedDayItems.filter((it) => !it.due_time);
  }, [selectedDayItems]);

  return (
    <div className="concludo-calendar-app" style={{ background: '#F4F6FA', minHeight: '100%', color: '#16263F' }}>
      {/* Top Bar */}
      <div className="calendar-topbar">
        <div className="calendar-topbar-left">
          <div className="calendar-title-group">
            <CalendarIcon size={22} color="#E2B53C" />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
              Calendar
            </h1>
          </div>

          {/* Subview Nav Tabs */}
          <div className="calendar-nav-scroll">
            {(
              [
                { id: 'home', label: 'HOME' },
                { id: 'day', label: 'DAY & 24H' },
                { id: 'week', label: 'WEEK' },
                { id: 'month', label: 'MONTH' },
                { id: 'agenda', label: 'AGENDA' },
                { id: 'board', label: 'TASK BOARD' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className="calendar-nav-tab"
                style={{
                  background: currentView === tab.id ? '#E2B53C' : 'transparent',
                  color: currentView === tab.id ? '#16263F' : '#FFFFFF',
                  fontWeight: currentView === tab.id ? 700 : 500,
                  fontSize: '12px',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topbar Actions */}
        <div className="calendar-topbar-actions">
          <div className="calendar-search-box" style={{ position: 'relative' }}>
            <Search size={14} color="#5A6478" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search actions, events, decisions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: '#FFFFFF',
                border: '1px solid #D9DFE9',
                borderRadius: '4px',
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                color: '#16263F',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={() => handleOpenCreateForDate(selectedDate || todayStr)}
            style={{
              background: '#E2B53C',
              color: '#16263F',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <Plus size={15} />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="calendar-content-wrap" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* S1 Calendar Home View */}
        {currentView === 'home' && (
          <div>
            {/* Standing Strip: Needs You Now */}
            <div
              className="calendar-standing-strip"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #D9DFE9',
                  borderLeft: '4px solid #BC8A1C',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                    OVERDUE ACTIONS
                  </span>
                  <AlertCircle size={16} color="#BC8A1C" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
                  {summary.overdue}
                </div>
                <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
                  Requires immediate action
                </div>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #D9DFE9',
                  borderLeft: '4px solid #E2B53C',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                    UNOWNED ACTIONS
                  </span>
                  <User size={16} color="#BC8A1C" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
                  {summary.unowned}
                </div>
                <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
                  Unassigned from transcript
                </div>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #D9DFE9',
                  borderLeft: '4px solid #E2B53C',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                    UNDATED ACTIONS
                  </span>
                  <Clock size={16} color="#BC8A1C" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
                  {summary.undated}
                </div>
                <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
                  Requires agreed timeline
                </div>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #D9DFE9',
                  borderLeft: '4px solid #16263F',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                    DECISION & RISK REVIEWS
                  </span>
                  <Layers size={16} color="#16263F" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
                  {summary.reviewsDue}
                </div>
                <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
                  Governance checkpoints
                </div>
              </div>
            </div>

            {/* Main Content Grid: 12 Columns on desktop, 1 Column on Mobile */}
            <div
              className="calendar-home-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: '24px',
              }}
            >
              {/* Left 7 cols: Today Schedule & Attention Required */}
              <div className="calendar-home-main" style={{ gridColumn: 'span 7' }}>
                {/* Attention Required Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '20px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={18} color="#BC8A1C" />
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                        Attention Required (Gaps & Reviews)
                      </h3>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#BC8A1C', background: 'rgba(226, 181, 60, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                      {summary.overdue + summary.unowned + summary.undated} ITEMS
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredItems
                      .filter((it) => !it.owner_name || !it.due_date || (it.due_date && it.due_date < todayStr))
                      .slice(0, 4)
                      .map((item) => (
                        <div
                          key={item.id}
                          onClick={() => openItemDetail(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#F4F6FA',
                            borderRadius: '6px',
                            borderLeft: `4px solid ${!item.due_date ? '#BC8A1C' : '#E2B53C'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16263F', fontFamily: 'IBM Plex Mono, monospace' }}>
                                {item.reference || item.type.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#16263F' }}>
                                {item.title}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              {!item.owner_name && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#BC8A1C', background: 'rgba(226, 181, 60, 0.2)', padding: '1px 5px', borderRadius: '3px' }}>
                                  UNASSIGNED
                                </span>
                              )}
                              {!item.due_date && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#BC8A1C', background: 'rgba(226, 181, 60, 0.2)', padding: '1px 5px', borderRadius: '3px' }}>
                                  UNDATED
                                </span>
                              )}
                              {item.due_date && item.due_date < todayStr && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', background: 'rgba(220, 38, 38, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                                  OVERDUE: {item.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openItemDetail(item, true);
                            }}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #D9DFE9',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Pencil size={11} /> Edit
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Today Schedule List */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarDays size={18} color="#16263F" />
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                        Today's Schedule & Commitments
                      </h3>
                    </div>
                    <button
                      onClick={() => handleDateSelect(todayStr)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#BC8A1C',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      View 24-Hour Day →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredItems
                      .filter((it) => it.due_date === todayStr)
                      .map((item) => {
                        const tone = getItemToneColor(item.type);
                        return (
                          <div
                            key={item.id}
                            onClick={() => openItemDetail(item)}
                            className="calendar-item-row"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              background: '#F4F6FA',
                              borderRadius: '6px',
                              borderLeft: `4px solid ${tone.bar}`,
                              cursor: 'pointer',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: tone.text, fontFamily: 'IBM Plex Mono, monospace' }}>
                                  {item.due_time ? item.due_time.slice(0, 5) : 'ALL DAY'}
                                </span>
                                <span style={{ fontSize: '14px', fontWeight: 650, color: '#16263F' }}>
                                  {item.title}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#5A6478' }}>
                                  Owner: <strong>{item.owner_name || 'Unassigned'}</strong>
                                </span>
                                <span style={{ fontSize: '11px', color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace' }}>
                                  {item.source_reference || 'TR-001'}
                                </span>
                              </div>
                            </div>

                            <div className="calendar-item-actions" style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openItemDetail(item, true);
                                }}
                                style={{
                                  background: '#FFFFFF',
                                  color: '#16263F',
                                  border: '1px solid #D9DFE9',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChangeTrigger(item, 'completed');
                                }}
                                style={{
                                  background: '#16263F',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Complete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Right 5 cols: Mini Calendar with Highlights & Concludo Suggests */}
              <div className="calendar-home-side" style={{ gridColumn: 'span 5' }}>
                {/* Mini Calendar Card with Date Highlighting & Direct Navigation */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '20px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                      {monthNames[calendarMonth]} {calendarYear}
                    </h3>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={handlePrevMonth}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
                        title="Previous Month"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={handleNextMonth}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
                        title="Next Month"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, idx) => (
                      <div key={idx} style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', padding: '4px 0' }}>
                        {d}
                      </div>
                    ))}

                    {/* Empty cells before month starts */}
                    {Array.from({ length: daysInCurrentMonth.firstDayIndex }).map((_, idx) => (
                      <div key={`empty-${idx}`} style={{ height: '34px' }} />
                    ))}

                    {/* Month days */}
                    {Array.from({ length: daysInCurrentMonth.totalDays }).map((_, idx) => {
                      const day = idx + 1;
                      const mStr = calendarMonth + 1 < 10 ? `0${calendarMonth + 1}` : `${calendarMonth + 1}`;
                      const dStr = day < 10 ? `0${day}` : `${day}`;
                      const fullDate = `${calendarYear}-${mStr}-${dStr}`;

                      const isSelected = selectedDate === fullDate;
                      const isToday = fullDate === todayStr;
                      const hasScheduled = scheduledDatesSet.has(fullDate);

                      return (
                        <div
                          key={fullDate}
                          onClick={() => handleDateSelect(fullDate)}
                          title={`${fullDate} - Click to view 24h schedule, edit or create tasks`}
                          style={{
                            height: '34px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: isToday || isSelected ? 700 : hasScheduled ? 650 : 500,
                            // Highlighting rule: scheduled dates highlighted in subtle gold tint with gold border
                            background: isSelected
                              ? '#16263F'
                              : isToday
                              ? '#E2B53C'
                              : hasScheduled
                              ? 'rgba(226, 181, 60, 0.18)'
                              : 'transparent',
                            color: isSelected
                              ? '#FFFFFF'
                              : isToday
                              ? '#16263F'
                              : hasScheduled
                              ? '#16263F'
                              : '#16263F',
                            border: isSelected
                              ? '2px solid #16263F'
                              : hasScheduled
                              ? '1.5px solid #E2B53C'
                              : '1px solid transparent',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{day}</span>
                          {hasScheduled && !isSelected && (
                            <span
                              style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#BC8A1C',
                                marginTop: '1px',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #D9DFE9', fontSize: '11px', color: '#5A6478' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', background: '#E2B53C', borderRadius: '2px', display: 'inline-block' }} />
                      <span>Today</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', background: 'rgba(226, 181, 60, 0.25)', border: '1px solid #E2B53C', borderRadius: '2px', display: 'inline-block' }} />
                      <span>Scheduled Items</span>
                    </div>
                    <button
                      onClick={() => handleDateSelect(selectedDate || todayStr)}
                      style={{
                        background: '#16263F',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Open Day
                    </button>
                  </div>
                </div>

                {/* Concludo Suggests Panel */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Sparkles size={16} color="#BC8A1C" />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                      Concludo Suggests
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: '#F4F6FA', padding: '10px 12px', borderRadius: '4px', fontSize: '12px', borderLeft: '3px solid #BC8A1C' }}>
                      <strong>Set a date</strong> for 5 actions extracted from Tuesday's kick-off output.
                    </div>
                    <div style={{ background: '#F4F6FA', padding: '10px 12px', borderRadius: '4px', fontSize: '12px', borderLeft: '3px solid #BC8A1C' }}>
                      <strong>Assign RSK-002:</strong> Liquidated damages review has no dedicated owner assigned.
                    </div>
                    <div style={{ background: '#F4F6FA', padding: '10px 12px', borderRadius: '4px', fontSize: '12px', borderLeft: '3px solid #E2B53C' }}>
                      <strong>Decision DEC-004</strong> expires in 14 days without an active progress checkpoint.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* S2 Day View & 24-Hour Time Overview */}
        {currentView === 'day' && (
          <div className="calendar-day-container">
            {/* Day Header Bar */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #D9DFE9',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => {
                    const parts = selectedDate.split('-');
                    const cur = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    cur.setDate(cur.getDate() - 1);
                    const prevStr = cur.toISOString().split('T')[0];
                    setSelectedDate(prevStr);
                  }}
                  style={{ background: '#F4F6FA', border: '1px solid #D9DFE9', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer' }}
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#BC8A1C', letterSpacing: '0.04em' }}>
                    {selectedDate === todayStr ? 'TODAY' : 'DAY VIEW'} · {selectedDate}
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16263F', margin: '2px 0 0 0', fontFamily: 'Poppins, sans-serif' }}>
                    {formatReadableDate(selectedDate)}
                  </h2>
                </div>

                <button
                  onClick={() => {
                    const parts = selectedDate.split('-');
                    const cur = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    cur.setDate(cur.getDate() + 1);
                    const nextStr = cur.toISOString().split('T')[0];
                    setSelectedDate(nextStr);
                  }}
                  style={{ background: '#F4F6FA', border: '1px solid #D9DFE9', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer' }}
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  style={{
                    background: selectedDate === todayStr ? '#E2B53C' : '#F4F6FA',
                    color: '#16263F',
                    border: '1px solid #D9DFE9',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                >
                  Today
                </button>
                <button
                  onClick={() => handleOpenCreateForDate(selectedDate)}
                  style={{
                    background: '#16263F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={15} color="#E2B53C" />
                  <span>Add Event/Task</span>
                </button>
              </div>
            </div>

            {/* Grid Layout: 24-Hour Schedule (Left 8 cols) & Day Notes / Summary (Right 4 cols) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: '20px',
              }}
              className="calendar-home-grid"
            >
              {/* Left Column: 24-Hour Timeline */}
              <div style={{ gridColumn: 'span 8' }} className="calendar-home-main">
                {/* Untimed / All Day Strip */}
                {allDayOrUntimedItems.length > 0 && (
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #D9DFE9',
                      padding: '16px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      ALL DAY & UNTIMED COMMITMENTS ({allDayOrUntimedItems.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {allDayOrUntimedItems.map((item) => {
                        const tone = getItemToneColor(item.type);
                        return (
                          <div
                            key={item.id}
                            onClick={() => openItemDetail(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              background: '#F4F6FA',
                              borderRadius: '6px',
                              borderLeft: `4px solid ${tone.bar}`,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: tone.text, fontFamily: 'IBM Plex Mono, monospace' }}>
                                {item.reference || item.type.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                                {item.title}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#5A6478' }}>
                                {item.owner_name || 'Unassigned'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openItemDetail(item, true);
                                }}
                                style={{ background: '#FFFFFF', border: '1px solid #D9DFE9', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 24-Hour Time Overview Grid (00:00 to 23:00) */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      background: '#16263F',
                      color: '#FFFFFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#E2B53C" />
                      <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
                        24-HOUR TIME OVERVIEW
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#E2B53C' }}>
                      Click any hour to create an event/task
                    </span>
                  </div>

                  <div style={{ maxHeight: '700px', overflowY: 'auto' }}>
                    {hourlySlots.map((slot) => {
                      const hasEvents = slot.items.length > 0;
                      return (
                        <div
                          key={slot.hour}
                          style={{
                            display: 'flex',
                            borderBottom: '1px solid #EDF1F7',
                            minHeight: '44px',
                            background: hasEvents ? 'rgba(226, 181, 60, 0.04)' : '#FFFFFF',
                          }}
                        >
                          {/* Hour Label */}
                          <div
                            style={{
                              width: '90px',
                              padding: '10px 12px',
                              borderRight: '1px solid #D9DFE9',
                              fontSize: '12px',
                              fontWeight: 650,
                              color: '#5A6478',
                              background: '#F8FAFD',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>{slot.displayTime}</span>
                          </div>

                          {/* Slot Content */}
                          <div
                            onClick={() => {
                              if (!hasEvents) {
                                const hStr = slot.hour < 10 ? `0${slot.hour}` : `${slot.hour}`;
                                handleOpenCreateForDate(selectedDate, `${hStr}:00`);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              cursor: hasEvents ? 'default' : 'pointer',
                              position: 'relative',
                            }}
                            title={hasEvents ? undefined : `Click to schedule an item at ${slot.displayTime}`}
                          >
                            {hasEvents ? (
                              slot.items.map((item) => {
                                const tone = getItemToneColor(item.type);
                                return (
                                  <div
                                    key={item.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openItemDetail(item);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 12px',
                                      background: tone.bg,
                                      borderLeft: `4px solid ${tone.bar}`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: tone.text, fontFamily: 'IBM Plex Mono, monospace' }}>
                                        {item.due_time ? item.due_time.slice(0, 5) : slot.label}
                                      </span>
                                      <span style={{ fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                                        {item.title}
                                      </span>
                                      {item.reference && (
                                        <span style={{ fontSize: '10px', background: '#FFFFFF', padding: '1px 5px', borderRadius: '3px', border: '1px solid #D9DFE9' }}>
                                          {item.reference}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '11px', color: '#5A6478' }}>
                                        {item.owner_name || 'Unassigned'}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openItemDetail(item, true);
                                        }}
                                        style={{
                                          background: '#FFFFFF',
                                          border: '1px solid #D9DFE9',
                                          padding: '2px 8px',
                                          borderRadius: '3px',
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div
                                style={{
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: '11px',
                                  color: '#A0AEC0',
                                }}
                              >
                                <span className="hover-slot-hint" style={{ opacity: 0.5 }}>+ Add event at {slot.displayTime}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Daily Notes Section & Day Summary */}
              <div style={{ gridColumn: 'span 4' }} className="calendar-home-side">
                {/* Daily Notes Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StickyNote size={18} color="#BC8A1C" />
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                        Notes for {selectedDate}
                      </h3>
                    </div>
                    {noteSavedFeedback && (
                      <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Saved
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '12px', color: '#5A6478', margin: '0 0 12px 0' }}>
                    Write down things to remember, meeting talking points, or follow-up notes for this day.
                  </p>

                  <textarea
                    rows={8}
                    placeholder="e.g. Remember to verify the platform passenger display firmware patch before the 2pm review with Priya..."
                    value={dailyNoteText}
                    onChange={(e) => setDailyNoteText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #D9DFE9',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      color: '#16263F',
                      boxSizing: 'border-box',
                      lineHeight: '1.5',
                      resize: 'vertical',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      onClick={handleSaveDailyNote}
                      disabled={savingNote}
                      style={{
                        background: '#16263F',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 650,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Save size={14} color="#E2B53C" />
                      <span>{savingNote ? 'Saving...' : 'Save Day Note'}</span>
                    </button>
                  </div>
                </div>

                {/* Day Overview Summary Box */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '20px',
                  }}
                >
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#16263F', margin: '0 0 12px 0', fontFamily: 'Poppins, sans-serif' }}>
                    Day Schedule Summary
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F4F6FA' }}>
                      <span style={{ color: '#5A6478' }}>Total Scheduled Items:</span>
                      <strong style={{ color: '#16263F' }}>{selectedDayItems.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F4F6FA' }}>
                      <span style={{ color: '#5A6478' }}>Timed Slots:</span>
                      <strong style={{ color: '#16263F' }}>{selectedDayItems.filter((it) => it.due_time).length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F4F6FA' }}>
                      <span style={{ color: '#5A6478' }}>Untimed / All Day:</span>
                      <strong style={{ color: '#16263F' }}>{allDayOrUntimedItems.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ color: '#5A6478' }}>Completed:</span>
                      <strong style={{ color: '#10B981' }}>{selectedDayItems.filter((it) => it.status === 'completed').length}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenCreateForDate(selectedDate)}
                    style={{
                      width: '100%',
                      background: '#F4F6FA',
                      border: '1px solid #D9DFE9',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      marginTop: '14px',
                      fontSize: '12px',
                      fontWeight: 650,
                      color: '#16263F',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} color="#BC8A1C" />
                    <span>Create New Item on This Day</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agenda View (S7 Agenda: Chronological grouped list) */}
        {currentView === 'agenda' && (
          <div className="calendar-agenda-container">
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16263F', marginBottom: '20px', fontFamily: 'Poppins, sans-serif' }}>
              Agenda · Chronological Master Register
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { title: 'TODAY', filter: (it: CalendarItem) => it.due_date === todayStr },
                {
                  title: 'THIS WEEK',
                  filter: (it: CalendarItem) =>
                    it.due_date && it.due_date > todayStr && it.due_date <= '2026-10-04',
                },
                {
                  title: 'THIS MONTH',
                  filter: (it: CalendarItem) =>
                    it.due_date && it.due_date > '2026-10-04' && it.due_date <= '2026-10-31',
                },
                {
                  title: 'UNDATED & BACKLOG',
                  filter: (it: CalendarItem) => !it.due_date,
                },
              ].map((group) => {
                const groupItems = filteredItems.filter(group.filter);
                return (
                  <div key={group.title}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.06em' }}>
                        {group.title}
                      </span>
                      <span style={{ fontSize: '11px', color: '#BC8A1C', fontWeight: 700 }}>
                        ({groupItems.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {groupItems.length === 0 ? (
                        <div style={{ padding: '12px 16px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #D9DFE9', color: '#5A6478', fontSize: '12px' }}>
                          No scheduled items in this window.
                        </div>
                      ) : (
                        groupItems.map((item) => {
                          const tone = getItemToneColor(item.type);
                          return (
                            <div
                              key={item.id}
                              onClick={() => openItemDetail(item)}
                              className="calendar-agenda-item"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: '#FFFFFF',
                                borderRadius: '6px',
                                border: '1px solid #D9DFE9',
                                borderLeft: `4px solid ${tone.bar}`,
                                cursor: 'pointer',
                              }}
                            >
                              <div className="calendar-agenda-item-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: tone.text, fontFamily: 'IBM Plex Mono, monospace', minWidth: '70px' }}>
                                  {item.due_date || 'UNDATED'}
                                </span>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 650, color: '#16263F' }}>
                                    {item.title}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#5A6478', marginTop: '2px' }}>
                                    Owner: <strong>{item.owner_name || 'Unassigned'}</strong> · Ref: {item.reference || item.type.toUpperCase()}
                                  </div>
                                </div>
                              </div>

                              <div className="calendar-agenda-item-right">
                                <span style={{ fontSize: '11px', fontWeight: 600, color: item.status === 'completed' ? '#10B981' : '#5A6478', textTransform: 'uppercase' }}>
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Task Board View (S8 Task Board: 5 columns, reasons required for blocked & review) */}
        {currentView === 'board' && (
          <div className="calendar-board-container">
            {(
              [
                { id: 'open', label: 'OPEN' },
                { id: 'in_progress', label: 'IN PROGRESS' },
                { id: 'blocked', label: 'BLOCKED' },
                { id: 'review', label: 'REVIEW' },
                { id: 'completed', label: 'COMPLETED' },
              ] as const
            ).map((col) => {
              const colItems = filteredItems.filter((it) => it.status === col.id);
              return (
                <div
                  key={col.id}
                  className="calendar-board-col"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#16263F', letterSpacing: '0.04em' }}>
                      {col.label}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', background: '#F4F6FA', padding: '2px 6px', borderRadius: '4px' }}>
                      {colItems.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    {colItems.map((item) => {
                      const tone = getItemToneColor(item.type);
                      return (
                        <div
                          key={item.id}
                          onClick={() => openItemDetail(item)}
                          style={{
                            background: '#F4F6FA',
                            borderRadius: '6px',
                            borderLeft: `4px solid ${tone.bar}`,
                            padding: '10px 12px',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 700, color: tone.text, fontFamily: 'IBM Plex Mono, monospace' }}>
                            {item.reference || item.type.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 650, color: '#16263F', marginTop: '2px' }}>
                            {item.title}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: '#5A6478' }}>
                            <span>{item.owner_name || 'Unassigned'}</span>
                            <span>{item.due_date || 'Undated'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Week and Month View Placeholders */}
        {(currentView === 'week' || currentView === 'month') && (
          <div style={{ background: '#FFFFFF', borderRadius: '8px', border: '1px solid #D9DFE9', padding: '32px', textAlign: 'center' }}>
            <CalendarDays size={48} color="#BC8A1C" style={{ margin: '0 auto 16px auto' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#16263F', margin: '0 0 8px 0', fontFamily: 'Poppins, sans-serif' }}>
              {currentView.toUpperCase()} VIEW ACTIVE
            </h2>
            <p style={{ color: '#5A6478', fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px auto' }}>
              Displays all {filteredItems.length} active workspace commitments, hourly bands, and deadlines without external dependencies.
            </p>
            <div style={{ display: 'inline-flex', gap: '8px' }}>
              <button
                onClick={() => setCurrentView('day')}
                style={{
                  background: '#E2B53C',
                  color: '#16263F',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                Switch to 24-Hour Day View
              </button>
              <button
                onClick={() => setCurrentView('agenda')}
                style={{
                  background: '#16263F',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                Switch to Agenda Register
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Item Detail / Edit Right Drawer */}
      {isDrawerOpen && selectedItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '480px',
            maxWidth: '100vw',
            height: '100vh',
            background: '#FFFFFF',
            borderLeft: '1px solid #D9DFE9',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #D9DFE9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#16263F',
              color: '#FFFFFF',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#E2B53C', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono, monospace' }}>
                {selectedItem.reference || selectedItem.type.toUpperCase()}
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 0 0', fontFamily: 'Poppins, sans-serif' }}>
                {isEditingInDrawer ? 'Edit Calendar Item' : 'Item Details'}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isEditingInDrawer && (
                <button
                  onClick={() => setIsEditingInDrawer(true)}
                  style={{ background: 'transparent', border: '1px solid #E2B53C', color: '#E2B53C', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit size={12} /> Edit
                </button>
              )}
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Drawer Body: Edit Mode vs View Mode */}
          {isEditingInDrawer ? (
            <form onSubmit={handleSaveDrawerEdit} style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>TITLE</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>TYPE</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as CalendarItemType)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  >
                    <option value="task">Task</option>
                    <option value="event">Event</option>
                    <option value="milestone">Milestone</option>
                    <option value="review">Review</option>
                    <option value="follow_up">Follow Up</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>PRIORITY</label>
                  <select
                    value={editPriority || 'medium'}
                    onChange={(e) => setEditPriority(e.target.value as CalendarItemPriority)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>DUE DATE</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>DUE TIME</label>
                  <input
                    type="time"
                    value={editDueTime}
                    onChange={(e) => setEditDueTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>OWNER / ASSIGNED</label>
                <input
                  type="text"
                  placeholder="e.g. Priya Raman (leave blank if unassigned)"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>DESCRIPTION</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>NOTES</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Context, decisions or talking points..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  style={{ background: 'transparent', border: 'none', color: '#DC2626', fontSize: '12px', fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={13} /> Delete Item
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingInDrawer(false)}
                    style={{ background: '#F4F6FA', border: '1px solid #D9DFE9', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    style={{ background: '#16263F', color: '#FFFFFF', border: 'none', borderRadius: '4px', padding: '6px 14px', fontSize: '12px', fontWeight: 650, cursor: 'pointer' }}
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>TITLE</label>
                <div style={{ fontSize: '16px', fontWeight: 650, color: '#16263F', marginTop: '4px' }}>
                  {selectedItem.title}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>OWNER</label>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: selectedItem.owner_name ? '#16263F' : '#BC8A1C', marginTop: '2px' }}>
                    {selectedItem.owner_name || 'Unassigned'}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>DUE DATE</label>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: selectedItem.due_date ? '#16263F' : '#BC8A1C', marginTop: '2px' }}>
                    {selectedItem.due_date ? `${selectedItem.due_date} ${selectedItem.due_time ? selectedItem.due_time.slice(0, 5) : ''}` : 'No date set'}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>STATUS</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {(['open', 'in_progress', 'blocked', 'waiting', 'review', 'completed'] as CalendarItemStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChangeTrigger(selectedItem, st)}
                        style={{
                          background: selectedItem.status === st ? '#16263F' : '#F4F6FA',
                          color: selectedItem.status === st ? '#FFFFFF' : '#16263F',
                          border: '1px solid #D9DFE9',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {selectedItem.status_reason && (
                <div style={{ background: 'rgba(226, 181, 60, 0.1)', border: '1px solid #E2B53C', borderRadius: '6px', padding: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#BC8A1C' }}>STATUS REASON:</span>
                  <div style={{ fontSize: '13px', color: '#16263F', marginTop: '4px' }}>
                    {selectedItem.status_reason}
                  </div>
                </div>
              )}

              {selectedItem.description && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>DESCRIPTION</label>
                  <div style={{ fontSize: '13px', color: '#16263F', marginTop: '4px', lineHeight: '1.4' }}>
                    {selectedItem.description}
                  </div>
                </div>
              )}

              {selectedItem.notes && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478' }}>NOTES</label>
                  <div style={{ fontSize: '13px', color: '#16263F', marginTop: '4px', lineHeight: '1.4', background: '#F4F6FA', padding: '8px 12px', borderRadius: '4px' }}>
                    {selectedItem.notes}
                  </div>
                </div>
              )}

              {/* Lineage & Source Attribution */}
              <div style={{ background: '#F4F6FA', borderRadius: '6px', border: '1px solid #D9DFE9', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Link2 size={14} color="#BC8A1C" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                    PROVENANCE & LINEAGE
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#16263F' }}>
                  <strong>Source:</strong> {selectedItem.source_reference || 'TR-001'} ({selectedItem.source_type || 'meeting transcript'})
                </div>
                <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
                  <strong>Project:</strong> {selectedItem.source_title || 'Platform Passenger Information Display (PID) Upgrade'}
                </div>
                <div style={{ fontSize: '11px', color: '#5A6478', marginTop: '6px' }}>
                  Visibility: <strong>{selectedItem.visibility.toUpperCase()}</strong> (Private by default)
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #D9DFE9' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  style={{ background: 'transparent', border: 'none', color: '#DC2626', fontSize: '12px', fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={13} /> Delete Item
                </button>
                <button
                  onClick={() => setIsEditingInDrawer(true)}
                  style={{ background: '#16263F', color: '#FFFFFF', border: 'none', borderRadius: '4px', padding: '6px 14px', fontSize: '12px', fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit size={13} color="#E2B53C" /> Edit Item
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Create Modal */}
      {isQuickCreateOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 38, 63, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: '8px', width: '480px', maxWidth: '92vw', padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                Create New Calendar Item
              </h3>
              <button onClick={() => setIsQuickCreateOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client review with Harding"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Type</label>
                  <select
                    value={quickType}
                    onChange={(e) => setQuickType(e.target.value as CalendarItemType)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  >
                    <option value="task">Task</option>
                    <option value="event">Event</option>
                    <option value="milestone">Milestone</option>
                    <option value="review">Review</option>
                    <option value="follow_up">Follow Up</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Owner (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave blank if unowned"
                    value={quickOwner}
                    onChange={(e) => setQuickOwner(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Scheduled Date</label>
                  <input
                    type="date"
                    value={quickDueDate}
                    onChange={(e) => setQuickDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Scheduled Time</label>
                  <input
                    type="time"
                    value={quickDueTime}
                    onChange={(e) => setQuickDueTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Description / Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or talking points..."
                  value={quickDescription}
                  onChange={(e) => setQuickDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsQuickCreateOpen(false)}
                  style={{ background: '#F4F6FA', border: '1px solid #D9DFE9', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ background: '#16263F', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 650, cursor: 'pointer' }}
                >
                  {creating ? 'Saving...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Reason Modal for Blocked / Waiting / Cancelled */}
      {pendingStatusChange && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 38, 63, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: '8px', width: '420px', maxWidth: '92vw', padding: '24px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#16263F', margin: '0 0 10px 0' }}>
              Reason Required for {pendingStatusChange.newStatus.toUpperCase()}
            </h3>
            <p style={{ fontSize: '12px', color: '#5A6478', margin: '0 0 14px 0' }}>
              Concludo binding rule: Blocked, Waiting, and Cancelled statuses require an explicit reason to ensure transparency and accountability.
            </p>
            <textarea
              required
              rows={3}
              placeholder="Explain why this action is blocked or waiting..."
              value={statusReasonText}
              onChange={(e) => setStatusReasonText(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', fontSize: '13px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button
                onClick={() => setPendingStatusChange(null)}
                style={{ background: '#F4F6FA', border: '1px solid #D9DFE9', padding: '6px 14px', borderRadius: '4px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                disabled={!statusReasonText.trim()}
                onClick={() =>
                  applyStatusChange(pendingStatusChange.id, pendingStatusChange.newStatus, statusReasonText.trim())
                }
                style={{
                  background: '#16263F',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 650,
                  cursor: statusReasonText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
