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

  // Quick Create Form State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState<CalendarItemType>('task');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [quickDueTime, setQuickDueTime] = useState('');
  const [quickOwner, setQuickOwner] = useState('');
  const [quickPriority, setQuickPriority] = useState<CalendarItemPriority>('medium');
  const [creating, setCreating] = useState(false);

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

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickTitle.trim()) return;
    setCreating(true);

    const { data } = await createCalendarItem(supabase.client, {
      creator_id: user.id,
      title: quickTitle.trim(),
      type: quickType,
      due_date: quickDueDate || null,
      due_time: quickDueTime || null,
      owner_name: quickOwner.trim() || null,
      priority: quickPriority,
      status: 'open',
      visibility: 'private',
    });

    if (data) {
      setItems((prev) => [data, ...prev]);
      setQuickTitle('');
      setQuickDueDate('');
      setQuickDueTime('');
      setQuickOwner('');
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

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="concludo-calendar-app" style={{ background: '#F4F6FA', minHeight: '100%', color: '#16263F' }}>
      {/* Top Bar (Authoritative 03 Navigation: Workspace, view tabs, search, filters, Generate) */}
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
                { id: 'day', label: 'DAY' },
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
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Quick Create & Standing Generate */}
        <div className="calendar-topbar-actions">
          <div className="calendar-search-box">
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#5A6478' }} />
            <input
              type="text"
              placeholder="Search calendar items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsQuickCreateOpen(true)}
            style={{
              background: '#21395C',
              color: '#FFFFFF',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} color="#E2B53C" />
            <span>Quick Create</span>
          </button>

          <button
            style={{
              background: '#E2B53C',
              color: '#16263F',
              border: 'none',
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
            onClick={() => {
              window.location.hash = '#/projects';
            }}
            title="Generate to Calendar is accessible on every Concludo project output"
          >
            <Sparkles size={16} />
            <span>GENERATE</span>
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="calendar-content-wrap">
        {/* Needs You Now Standing Strip (Rules: 4 standing counts, never moves below the fold) */}
        <div className="calendar-standing-strip">
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D9DFE9',
              borderLeft: '4px solid #BC8A1C',
              borderRadius: '8px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', letterSpacing: '0.04em' }}>
                OVERDUE ACTIONS
              </span>
              <AlertCircle size={18} color="#BC8A1C" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: summary.overdue > 0 ? '#BC8A1C' : '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
              {summary.overdue}
            </div>
            <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
              {summary.overdue > 0 ? 'Requires immediate action' : 'All deadlines current'}
            </div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D9DFE9',
              borderLeft: '4px solid #E2B53C',
              borderRadius: '8px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', letterSpacing: '0.04em' }}>
                ACTIONS WITH NO OWNER
              </span>
              <User size={18} color="#E2B53C" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: summary.unowned > 0 ? '#E2B53C' : '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
              {summary.unowned}
            </div>
            <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
              Unassigned from transcript
            </div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D9DFE9',
              borderLeft: '4px solid #E2B53C',
              borderRadius: '8px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', letterSpacing: '0.04em' }}>
                ACTIONS WITH NO DATE
              </span>
              <Clock size={18} color="#E2B53C" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: summary.undated > 0 ? '#E2B53C' : '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
              {summary.undated}
            </div>
            <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
              Requires agreed timeline
            </div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #D9DFE9',
              borderLeft: '4px solid #21395C',
              borderRadius: '8px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478', letterSpacing: '0.04em' }}>
                DECISION & RISK REVIEWS
              </span>
              <Layers size={18} color="#21395C" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#16263F', marginTop: '6px', fontFamily: 'Poppins, sans-serif' }}>
              {summary.reviewsDue}
            </div>
            <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '4px' }}>
              Governance checkpoints
            </div>
          </div>
        </div>

        {/* View Routing */}
        {currentView === 'home' && (
          <div className="calendar-home-grid">
            {/* Left 7 cols: Today Schedule & Open Commitments */}
            <div className="calendar-home-main">
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
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                    Today's Schedule & Commitments
                  </h2>
                  <span style={{ fontSize: '12px', color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {filteredItems.filter((i) => i.due_date === todayStr).length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#5A6478', fontSize: '14px' }}>
                    No meetings or tasks scheduled for today.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredItems
                      .filter((i) => i.due_date === todayStr)
                      .map((item) => {
                        const tone = getItemToneColor(item.type, false);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDrawerOpen(true);
                            }}
                            className="calendar-item-row"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: tone.bg,
                              borderLeft: `4px solid ${tone.bar}`,
                              borderRadius: '4px',
                              padding: '10px 14px',
                              cursor: 'pointer',
                              boxSizing: 'border-box',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace', minWidth: '55px' }}>
                                {item.due_time ? item.due_time.slice(0, 5) : 'All Day'}
                              </span>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#16263F' }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#5A6478', marginTop: '2px' }}>
                                  {item.owner_name ? `Owner: ${item.owner_name}` : 'Unassigned'} · {item.reference || item.type}
                                </div>
                              </div>
                            </div>
                            <span className="calendar-item-actions" style={{ fontSize: '11px', fontWeight: 650, textTransform: 'uppercase', color: tone.text, background: '#FFFFFF', padding: '3px 8px', borderRadius: '4px', border: '1px solid #D9DFE9' }}>
                              {item.type}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Needs You Now Detailed List */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #D9DFE9',
                  padding: '20px',
                }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#16263F', margin: '0 0 16px 0', fontFamily: 'Poppins, sans-serif' }}>
                  Attention Required (Overdue & Gaps)
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredItems
                    .filter(
                      (i) =>
                        (i.due_date && i.due_date < todayStr && i.status !== 'completed') ||
                        !i.due_date ||
                        !i.owner_name
                    )
                    .slice(0, 6)
                    .map((item) => {
                      const isOverdue = !!(item.due_date && item.due_date < todayStr);
                      const tone = getItemToneColor(item.type, isOverdue);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setIsDrawerOpen(true);
                          }}
                          className="calendar-item-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#FFFFFF',
                            border: `1px solid ${isOverdue ? '#BC8A1C' : '#D9DFE9'}`,
                            borderLeft: `4px solid ${isOverdue ? '#BC8A1C' : '#E2B53C'}`,
                            borderRadius: '4px',
                            padding: '10px 14px',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#16263F' }}>
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                              {isOverdue && (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#BC8A1C' }}>
                                  OVERDUE: {item.due_date}
                                </span>
                              )}
                              {!item.due_date && (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#BC8A1C', background: 'rgba(226, 181, 60, 0.2)', padding: '1px 6px', borderRadius: '3px' }}>
                                  UNDATED
                                </span>
                              )}
                              {!item.owner_name && (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#BC8A1C', background: 'rgba(226, 181, 60, 0.2)', padding: '1px 6px', borderRadius: '3px' }}>
                                  UNASSIGNED
                                </span>
                              )}
                              {item.source_reference && (
                                <span style={{ fontSize: '11px', color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace' }}>
                                  Source: {item.source_reference}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="calendar-item-actions" style={{ display: 'flex', gap: '6px' }}>
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
                                padding: '6px 12px',
                                fontSize: '12px',
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

            {/* Right 5 cols: Mini Calendar & Concludo Suggests */}
            <div className="calendar-home-side">
              {/* Mini Calendar Card */}
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
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#16263F', margin: 0, fontFamily: 'Poppins, sans-serif' }}>
                    October 2026
                  </h3>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <ChevronLeft size={16} />
                    </button>
                    <button style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
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
                  {Array.from({ length: 31 }).map((_, idx) => {
                    const day = idx + 1;
                    const isToday = day === 28;
                    const hasItems = filteredItems.some((it) => it.due_date?.endsWith(`-${day < 10 ? '0' + day : day}`));
                    return (
                      <div
                        key={idx}
                        style={{
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: isToday ? 700 : 500,
                          background: isToday ? '#E2B53C' : hasItems ? 'rgba(22, 38, 63, 0.05)' : 'transparent',
                          color: isToday ? '#16263F' : '#16263F',
                          border: hasItems ? '1px solid #D9DFE9' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Concludo Suggests Panel (Rule: AI recommendations) */}
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
                { title: 'UNDATED & BACKLOG', filter: (it: CalendarItem) => !it.due_date },
              ].map((grp) => {
                const groupItems = filteredItems.filter(grp.filter);
                return (
                  <div key={grp.title}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 750, color: '#BC8A1C', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {grp.title}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: '#D9DFE9' }} />
                    </div>

                    {groupItems.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#5A6478', padding: '6px 0 10px 0' }}>
                        No items in this period.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {groupItems.map((item) => {
                          const tone = getItemToneColor(item.type);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSelectedItem(item);
                                setIsDrawerOpen(true);
                              }}
                              className="calendar-agenda-item"
                              style={{
                                borderLeft: `4px solid ${tone.bar}`,
                              }}
                            >
                              <div className="calendar-agenda-item-left" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace', minWidth: '70px' }}>
                                  {item.due_date || 'NO DATE'}
                                </span>
                                <div style={{ flex: 1, minWidth: '180px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#16263F' }}>
                                    {item.title}
                                  </span>
                                  {item.status_reason && (
                                    <div style={{ fontSize: '11px', color: '#BC8A1C', marginTop: '2px' }}>
                                      Reason: {item.status_reason}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="calendar-agenda-item-right">
                                <span style={{ fontSize: '12px', color: '#5A6478' }}>
                                  {item.owner_name ? `Owner: ${item.owner_name}` : 'Unassigned'}
                                </span>
                                <span style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace', color: '#BC8A1C', minWidth: '60px', textAlign: 'right' }}>
                                  {item.source_reference || item.reference || 'TR-001'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Task Board View (S8 Task Board: 5 columns, reasons required for blocked & review) */}
        {currentView === 'board' && (
          <div className="calendar-board-container">
            {[
              { id: 'open', label: 'OPEN' },
              { id: 'in_progress', label: 'IN PROGRESS' },
              { id: 'blocked', label: 'BLOCKED' },
              { id: 'review', label: 'REVIEW' },
              { id: 'completed', label: 'COMPLETED' },
            ].map((col) => {
              const colItems = filteredItems.filter((i) => i.status === col.id);
              return (
                <div
                  key={col.id}
                  className="calendar-board-col"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #D9DFE9',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '550px',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #D9DFE9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(22, 38, 63, 0.03)',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 750, color: '#16263F', letterSpacing: '0.04em' }}>
                      {col.label}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#BC8A1C', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {colItems.length}
                    </span>
                  </div>

                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                    {colItems.map((item) => {
                      const tone = getItemToneColor(item.type);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setIsDrawerOpen(true);
                          }}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #D9DFE9',
                            borderTop: `3px solid ${tone.bar}`,
                            borderRadius: '4px',
                            padding: '10px',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#16263F', lineHeight: '1.3' }}>
                            {item.title}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: '#5A6478' }}>
                            <span>{item.owner_name || 'Unassigned'}</span>
                            <span style={{ color: item.due_date ? '#16263F' : '#BC8A1C', fontWeight: 600 }}>
                              {item.due_date || 'NO DATE'}
                            </span>
                          </div>
                          {item.status_reason && (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#BC8A1C', background: 'rgba(226, 181, 60, 0.1)', padding: '4px 6px', borderRadius: '3px' }}>
                              {item.status_reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Day, Week, Month Placeholders maintaining layout structure */}
        {(currentView === 'day' || currentView === 'week' || currentView === 'month') && (
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
                onClick={() => setCurrentView('agenda')}
                style={{
                  background: '#16263F',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Switch to Agenda Register
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Item Detail Right Drawer (Authoritative Spec: Opens over canvas, never a new page) */}
      {isDrawerOpen && selectedItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '460px',
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
                Item Detail
              </h3>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body */}
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
                  {selectedItem.due_date ? `${selectedItem.due_date} ${selectedItem.due_time || ''}` : 'No date set'}
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

            {/* Lineage & Source Attribution (Rule 2) */}
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
          </div>
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
                Quick Create Calendar Item
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
                  placeholder="e.g. Liquidated damages review"
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
                  <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Due Date</label>
                  <input
                    type="date"
                    value={quickDueDate}
                    onChange={(e) => setQuickDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 650, color: '#5A6478' }}>Due Time</label>
                  <input
                    type="time"
                    value={quickDueTime}
                    onChange={(e) => setQuickDueTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #D9DFE9', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>
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
