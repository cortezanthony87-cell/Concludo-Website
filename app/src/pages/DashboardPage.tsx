/**
 * DashboardPage.tsx · Concludo Workspace Work → Dashboard
 * Redesigned v2: Week Forecast, Performance Banner, Stage Chart, Word-doc panels,
 * Dopamine-hit design, Empty state. All data clients and route links preserved.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  Lightbulb,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
  FileSpreadsheet,
  Trophy,
  Target,
  Flame,
  AlertTriangle,
  FileIcon,
  Activity,
  BookOpen,
  ListChecks,
  Mail,
} from 'lucide-react';

import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS, PlanType } from '../lib/profiles/types';
import { OutputType, OUTPUT_TYPE_LABELS } from '../lib/outputs/types';
import { queryBackendPermissions, BackendPermissionsResponse } from '../lib/permissions/backendCheckClient';
import { FeatureKey } from '../lib/permissions/types';
import { fetchDecisions } from '../lib/decisions/decisionClient';
import { DecisionRecord } from '../lib/decisions/types';
import { fetchActions } from '../lib/actions/actionClient';
import { ActionRecord, isActionOverdue, STATUS_LABELS } from '../lib/actions/types';
import { fetchUserInsights, fetchUserStats } from '../lib/intelligence/intelligenceClient';
import { InsightData, StatsData } from '../lib/intelligence/types';
import { fetchEndpointReports } from '../lib/reports/reportClient';
import { EndpointReport } from '../lib/reports/types';
import { fetchUserTeams } from '../lib/teams/teamClient';
import { Team, TeamRole } from '../lib/teams/types';
import { getPredictiveAnalysis } from '../lib/predictive/predictiveService';
import { fetchCalendarItems } from '../lib/calendar/calendarClient';
import { PredictiveAnalysisResult } from '../lib/predictive/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardProject {
  id: string;
  title: string;
  meeting_type: string | null;
  client_name: string | null;
  project_name: string | null;
  client_or_project: string | null;
  meeting_date: string | null;
  updated_at: string | null;
}

interface DashboardOutput {
  id: string;
  project_id: string;
  output_type: OutputType;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
  projects: { id: string; title: string } | null;
}

// ─── Performance thresholds ───────────────────────────────────────────────────

type PerformanceState = 'crushing' | 'on_track' | 'behind' | 'critical' | 'no_data';

function getPerformanceState(completed: number, total: number): PerformanceState {
  if (total === 0) return 'no_data';
  const pct = completed / total;
  if (pct >= 0.8) return 'crushing';
  if (pct >= 0.6) return 'on_track';
  if (pct >= 0.4) return 'behind';
  return 'critical';
}

const PERF_CONFIG: Record<
  PerformanceState,
  { label: string; msg: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  crushing: {
    label: 'Crushing it',
    msg: 'Outstanding work this week. You are ahead of pace · keep the momentum.',
    color: '#f3c958',
    bg: 'rgba(226,181,60,0.08)',
    border: 'rgba(226,181,60,0.35)',
    icon: <Trophy size={20} />,
  },
  on_track: {
    label: 'On track',
    msg: 'Solid progress. You are meeting your weekly targets.',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.3)',
    icon: <Target size={20} />,
  },
  behind: {
    label: 'Falling behind',
    msg: 'You are behind pace. At this rate, your remaining workload increases significantly.',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.3)',
    icon: <AlertTriangle size={20} />,
  },
  critical: {
    label: 'Critical · action required',
    msg: 'Your completion rate is critically low. Unfinished work is compounding · act now to avoid a backlog.',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.3)',
    icon: <Flame size={20} />,
  },
  no_data: {
    label: 'Ready to start',
    msg: 'No activity recorded yet this week. Create your first project to begin tracking progress.',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.06)',
    border: 'rgba(148,163,184,0.2)',
    icon: <Sparkles size={20} />,
  },
};

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: friday.toISOString().slice(0, 10),
  };
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekDays(): { label: string; date: Date; dateStr: string; isToday: boolean }[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    return { label, date: d, dateStr: toLocalDateStr(d), isToday };
  });
}

function formatShortDate(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString('en-AU', { month: 'short' })}`;
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const wordDocStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#1e293b',
  borderRadius: '6px',
  padding: '20px 24px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
  fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
  lineHeight: 1.65,
};

const wordDocTitleStyle: React.CSSProperties = {
  fontFamily: "'Poppins', Arial, sans-serif",
  fontWeight: 700,
  fontSize: '0.95rem',
  color: '#0f172a',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const cutoutStyle: React.CSSProperties = {
  background: 'rgba(14,23,41,0.85)',
  border: '1px solid rgba(226,181,60,0.25)',
  borderLeft: '3px solid #e2b53c',
  borderRadius: '6px',
  padding: '14px 18px',
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const cardStyle: React.CSSProperties = {
  background: '#0e1729',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
  padding: '20px',
};

// ─── File chip ────────────────────────────────────────────────────────────────

function FileChip({ name, type }: { name: string; type?: string }) {
  const ext = type || name.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: 'rgba(22,38,63,0.9)',
        border: '1px solid rgba(226,181,60,0.3)',
        borderRadius: '6px',
        padding: '4px 10px',
        fontSize: '0.78rem',
        color: '#f3c958',
        fontWeight: 600,
      }}
    >
      <FileIcon size={12} />
      {name}
      <span
        style={{
          background: 'rgba(226,181,60,0.15)',
          borderRadius: '3px',
          padding: '1px 4px',
          fontSize: '0.68rem',
          color: '#e2b53c',
        }}
      >
        {ext}
      </span>
    </span>
  );
}

// ─── Clustered bar chart (V8 · full-width pct rows above/below) ──────────────

/** Planned targets are constants · not from DB */
const PLANNED_TARGETS: Record<string, number> = {
  New: 50,
  'In Progress': 75,
  Review: 50,
  Complete: 100,
};
const STAGE_ORDER = ['New', 'In Progress', 'Review', 'Complete'] as const;

interface StageBarChartItem {
  label: string;
  plannedPct: number;
  actualPct: number;
}

function ClusteredBarChart({ data }: { data: StageBarChartItem[] }) {
  return (
    <div style={{ width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#94a3b8' }}>
          <span style={{ width: 10, height: 10, background: '#21395c', borderRadius: 2, display: 'inline-block' }} />
          Planned
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#94a3b8', marginLeft: 8 }}>
          <span style={{ width: 10, height: 10, background: '#e2b53c', borderRadius: 2, display: 'inline-block' }} />
          Active
        </span>
      </div>

      {/* Planned pct row · above bars */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '8px' }}>
        {data.map((d) => (
          <span
            key={`p-${d.label}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#21395c',
              whiteSpace: 'nowrap',
            }}
          >
            {d.plannedPct}%
          </span>
        ))}
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: '80px' }}>
        {data.map((d) => {
          const plannedH = Math.max(Math.round((d.plannedPct / 100) * 72), 4);
          const actualH = Math.max(Math.round((d.actualPct / 100) * 72), 4);
          return (
            <div
              key={d.label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '72px' }}>
                <div
                  title={`Planned: ${d.plannedPct}%`}
                  style={{
                    width: '16px',
                    height: `${plannedH}px`,
                    background: '#21395c',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.5s ease',
                  }}
                />
                <div
                  title={`Active: ${d.actualPct}%`}
                  style={{
                    width: '16px',
                    height: `${actualH}px`,
                    background: '#e2b53c',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.5s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.67rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actual pct row · below bars */}
      <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
        {data.map((d) => (
          <span
            key={`a-${d.label}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#bc8a1c',
              whiteSpace: 'nowrap',
            }}
          >
            {d.actualPct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color = '#e2b53c', label }: { value: number; color?: string; label?: string }) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</span>
          <span style={{ fontSize: '0.75rem', color, fontWeight: 700 }}>{value}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(value, 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: value >= 80 ? `0 0 8px ${color}80` : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const { supabase, user, profile, loading: authLoading } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [recentProjects, setRecentProjects] = useState<DashboardProject[]>([]);
  const [recentOutputs, setRecentOutputs] = useState<DashboardOutput[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<DecisionRecord[]>([]);
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentReports, setRecentReports] = useState<EndpointReport[]>([]);
  const [userTeams, setUserTeams] = useState<Array<{ team: Team; role: TeamRole }>>([]);
  const [backendPerms, setBackendPerms] = useState<BackendPermissionsResponse | null>(null);
  const [predictiveData, setPredictiveData] = useState<PredictiveAnalysisResult | null>(null);

  // ── V8 additions: stage counts, calendar, email ────────────────────────────
  interface StageCount { stage: string; stage_count: number; }
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);

  interface CalendarEvent {
    id: string;
    title: string;
    start_at: string;
    end_at: string | null;
    event_type: 'meeting';
  }
  interface TaskEvent {
    id: string;
    title: string;
    due_at: string;
    event_type: 'task' | 'deadline';
  }
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  interface EmailStats {
    needReply: number;
    unread: number;
    flagged: number;
    processedToday: number;
  }
  interface EmailPreviewItem {
    id: string;
    sender_name: string | null;
    subject: string | null;
    client_or_project: string | null;
    received_at: string | null;
    status: string | null;
  }
  const [emailStats, setEmailStats] = useState<EmailStats>({
    needReply: 0, unread: 0, flagged: 0, processedToday: 0,
  });
  const [emailPreviews, setEmailPreviews] = useState<EmailPreviewItem[]>([]);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingPredictive, setLoadingPredictive] = useState(false);

  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [outputsError, setOutputsError] = useState<string | null>(null);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadDashboardData = useCallback(async () => {
    if (authLoading) return;
    if (!supabase || !user || !profile) {
      setLoadingDashboard(false);
      return;
    }

    setLoadingDashboard(true);
    setDashboardError(null);
    setProfileError(null);
    setProjectsError(null);
    setOutputsError(null);
    setDecisionsError(null);
    setActionsError(null);
    setPermissionError(null);

    // 1. Recent projects
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id,title,meeting_type,client_name,project_name,client_or_project,meeting_date,updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) setProjectsError('Could not load projects');
      else setRecentProjects(data || []);
    } catch {
      setProjectsError('Could not load projects');
    }

    // 2. Recent outputs
    try {
      const { data, error } = await supabase
        .from('outputs')
        .select('id,project_id,output_type,content,created_at,updated_at,projects(id,title)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) setOutputsError('Could not load outputs');
      else setRecentOutputs((data as any) || []);
    } catch {
      setOutputsError('Could not load outputs');
    }

    // 2b. Stage counts for bar chart · reads `stage` column from projects
    try {
      const { data: stageRows } = await supabase
        .from('projects')
        .select('stage')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('archived', false);

      const counts: Record<string, number> = {
        New: 0,
        'In Progress': 0,
        Review: 0,
        Complete: 0,
      };
      (stageRows || []).forEach((p: { stage: string | null }) => {
        if (p.stage && Object.prototype.hasOwnProperty.call(counts, p.stage)) {
          counts[p.stage]++;
        } else {
          counts['New']++;
        }
      });
      setStageCounts(
        Object.entries(counts).map(([stage, stage_count]) => ({ stage, stage_count }))
      );
    } catch {
      // stageCounts stays at default zeros; chart shows 0% actual bars
    }

    // 2c. Week Overview Calendar · meetings, tasks and deadlines
    setLoadingCalendar(true);
    setCalendarError(null);
    try {
      const { weekStart, weekEnd } = getWeekBounds();

      // Query authentic calendar_items scoped to current user
      const { data: calItems, error: calErr } = await fetchCalendarItems(supabase, user.id);

      if (calErr) {
        setCalendarError('Calendar unavailable');
        setCalendarEvents([]);
        setTaskEvents([]);
      } else {
        const items = calItems || [];
        const meetings: CalendarEvent[] = [];
        const tasks: TaskEvent[] = [];

        for (const item of items) {
          const dateStr = item.start_date || item.due_date;
          if (!dateStr || dateStr < weekStart || dateStr > weekEnd) continue;

          const timeStr = item.due_time
            ? `${dateStr}T${item.due_time}`
            : `${dateStr}T09:00:00`;

          if (item.type === 'meeting' || item.type === 'event') {
            meetings.push({
              id: item.id,
              title: item.title,
              start_at: timeStr,
              end_at: item.end_date ? `${item.end_date}T10:00:00` : null,
              event_type: 'meeting',
            });
          } else {
            tasks.push({
              id: item.id,
              title: item.title,
              due_at: timeStr,
              event_type: (item.type === 'review' || item.review_type) ? 'deadline' : 'task',
            });
          }
        }

        setCalendarEvents(meetings);
        setTaskEvents(tasks);
      }
    } catch {
      setCalendarError('Calendar unavailable');
      setCalendarEvents([]);
      setTaskEvents([]);
    } finally {
      setLoadingCalendar(false);
    }

    // 2d. Email Command Centre snapshot
    setLoadingEmail(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [needReplyRes, unreadRes, flaggedRes, processedTodayRes, previewRes] = await Promise.all([
        supabase
          .from('email_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'needs_reply'),
        supabase
          .from('email_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),
        supabase
          .from('email_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_flagged', true),
        supabase
          .from('email_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('processed_at', todayStart.toISOString()),
        supabase
          .from('email_items')
          .select('id,sender_name,subject,client_or_project,received_at,status')
          .eq('user_id', user.id)
          .order('received_at', { ascending: false })
          .limit(4),
      ]);

      setEmailStats({
        needReply: needReplyRes.count ?? 0,
        unread: unreadRes.count ?? 0,
        flagged: flaggedRes.count ?? 0,
        processedToday: processedTodayRes.count ?? 0,
      });
      setEmailPreviews((previewRes.data || []) as EmailPreviewItem[]);
    } catch {
      // Email snapshot is optional · stay at default zeros
    } finally {
      setLoadingEmail(false);
    }

    // 3. Permissions
    let permDataResult: BackendPermissionsResponse | null = null;
    setLoadingPermissions(true);
    try {
      const { data: permData, error: permErr } = await queryBackendPermissions(supabase);
      if (permErr || !permData) {
        setPermissionError('Permission check failed');
      } else {
        setBackendPerms(permData);
        permDataResult = permData;
      }
    } catch {
      setPermissionError('Permission check failed');
    } finally {
      setLoadingPermissions(false);
    }

    // 4. Decisions
    if (permDataResult?.allowedFeatures.includes('decision_memory')) {
      setLoadingDecisions(true);
      try {
        const decRes = await fetchDecisions(supabase, { limit: 5 });
        if (decRes.error) setDecisionsError('Failed to load decisions');
        else setRecentDecisions(decRes.data || []);
      } catch {
        setDecisionsError('Failed to load decisions');
      } finally {
        setLoadingDecisions(false);
      }
    }

    // 5. Actions
    if (permDataResult?.allowedFeatures.includes('action_tracker')) {
      setLoadingActions(true);
      try {
        const actRes = await fetchActions(supabase);
        if (actRes.error) setActionsError('Failed to load actions');
        else {
          const openActions = (actRes.data || []).filter((a: ActionRecord) => a.status !== 'completed').slice(0, 5);
          setRecentActions(openActions);
        }
      } catch {
        setActionsError('Failed to load actions');
      } finally {
        setLoadingActions(false);
      }
    }

    // 6. Insights
    if (permDataResult?.allowedFeatures.includes('insight')) {
      setLoadingInsights(true);
      try {
        const insData = await fetchUserInsights({ supabase });
        setInsights(insData);
      } catch (err) {
        console.warn('Could not load dashboard insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    }

    // 7. Stats
    if (permDataResult?.allowedFeatures.includes('stats')) {
      setLoadingStats(true);
      try {
        const statsData = await fetchUserStats('all', { supabase });
        setStats(statsData);
      } catch (err) {
        console.warn('Could not load dashboard stats:', err);
      } finally {
        setLoadingStats(false);
      }
    }

    // 8. Reports
    if (permDataResult?.allowedFeatures.includes('endpoint_report')) {
      setLoadingReports(true);
      try {
        const reports = await fetchEndpointReports({ supabase });
        setRecentReports(reports.slice(0, 3));
      } catch (err) {
        console.warn('Could not load dashboard reports:', err);
      } finally {
        setLoadingReports(false);
      }
    }

    // 9. Teams
    if (permDataResult?.allowedFeatures.includes('team_workspace')) {
      try {
        const teamsRes = await fetchUserTeams(supabase);
        if (teamsRes.data) setUserTeams(teamsRes.data.map((t) => ({ team: t, role: t.currentRole })));
      } catch (err) {
        console.warn('Could not load user teams:', err);
      }
    }

    // 10. Predictive
    if (permDataResult?.allowedFeatures.includes('predictive_intelligence')) {
      setLoadingPredictive(true);
      try {
        const pred = await getPredictiveAnalysis({ scope: 'individual', userId: user.id }, supabase);
        setPredictiveData(pred);
      } catch (err) {
        console.warn('Could not load predictive intelligence:', err);
      } finally {
        setLoadingPredictive(false);
      }
    }

    setLoadingDashboard(false);
  }, [supabase, user, profile, authLoading]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const fullName = profile?.full_name?.trim();
  const welcomeGreeting = fullName ? `Good day, ${fullName}` : 'Good day';
  const currentPlan: PlanType = (profile?.plan as PlanType) || 'free_preview';
  const planBadgeText = PLAN_LABELS[currentPlan] || 'Free Preview';

  const isFeatureAllowed = (key: FeatureKey): boolean => {
    if (!backendPerms) return false;
    return backendPerms.allowedFeatures.includes(key);
  };

  const isActionTrackerAllowed = isFeatureAllowed('action_tracker');
  const isDecisionMemoryAllowed = isFeatureAllowed('decision_memory');

  const hasAnyError =
    dashboardError || profileError || projectsError || outputsError ||
    decisionsError || actionsError || permissionError;

  // Empty state: no projects and no outputs yet
  const isEmpty = !loadingDashboard && recentProjects.length === 0 && recentOutputs.length === 0;

  // Performance calculation from open actions
  const totalActionsThisWeek = recentActions.length + (stats?.completedActions || 0);
  const completedActionsThisWeek = stats?.completedActions || 0;
  const perfState = getPerformanceState(completedActionsThisWeek, totalActionsThisWeek);
  const perfPct = totalActionsThisWeek > 0 ? Math.round((completedActionsThisWeek / totalActionsThisWeek) * 100) : 0;
  const perf = PERF_CONFIG[perfState];

  // Workload forecast: if behind, remaining work grows
  const workloadForecast =
    perfState === 'critical'
      ? Math.min(Math.round((1 - perfPct / 100) * 120), 999)
      : perfState === 'behind'
      ? Math.round((1 - perfPct / 100) * 80)
      : 0;

  // Stage chart · V8: percentage-based clustered bar chart
  const stageBarData: StageBarChartItem[] = (() => {
    const totalProjects = stageCounts.reduce((sum, s) => sum + s.stage_count, 0);
    return STAGE_ORDER.map((label) => {
      const row = stageCounts.find((s) => s.stage === label);
      const count = row?.stage_count ?? 0;
      const actualPct = totalProjects > 0
        ? Math.round((count / totalProjects) * 100)
        : 0;
      const plannedPct = PLANNED_TARGETS[label] ?? 50;
      return { label, plannedPct, actualPct };
    });
  })();

  // Events for day helper
  function eventsForDay(dateStr: string): Array<{ id: string; title: string; time: string; type: 'meeting' | 'task' | 'deadline' }> {
    const meetings = calendarEvents
      .filter((e) => e.start_at.slice(0, 10) === dateStr)
      .map((e) => ({
        id: e.id,
        title: e.title,
        time: new Date(e.start_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
        type: 'meeting' as const,
      }));

    const tasks = taskEvents
      .filter((e) => e.due_at.slice(0, 10) === dateStr)
      .map((e) => ({
        id: e.id,
        title: e.title,
        time: new Date(e.due_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
        type: e.event_type,
      }));

    return [...meetings, ...tasks].sort((a, b) => a.time.localeCompare(b.time));
  }

  // Week forecast
  const weekDays = getWeekDays();
  const todayIdx = weekDays.findIndex((d) => d.isToday);

  // Output type panels · find first of each type in recent outputs
  const execSummary = recentOutputs.find((o) => o.output_type === 'executive_summary');
  const decisionLog = recentOutputs.find((o) => o.output_type === 'decision_log');
  const actionPlan = recentOutputs.find((o) => o.output_type === 'action_plan');
  const transcript = recentOutputs.find((o) => o.output_type === 'transcript');

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingDashboard || authLoading) {
    return (
      <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', padding: '40px 0' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.9rem' }}>Loading your workspace...</span>
        </div>
      </div>
    );
  }

  // ── Empty / unsaved state ──────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
        {/* Minimal header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#f3c958', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <Sparkles size={13} color="#f3c958" />
              <span>CONCLUDO WORKSPACE</span>
            </div>
            <span style={{ padding: '5px 12px', background: 'rgba(226,181,60,0.1)', border: '1px solid rgba(226,181,60,0.3)', borderRadius: '20px', color: '#f3c958', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={12} /> {planBadgeText}
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>{welcomeGreeting}</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Empty prompt */}
        <div
          style={{
            background: 'rgba(14,23,41,0.6)',
            border: '1px dashed rgba(226,181,60,0.25)',
            borderRadius: '16px',
            padding: '56px 40px',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          <div style={{ width: '56px', height: '56px', background: 'rgba(226,181,60,0.1)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#f3c958' }}>
            <BookOpen size={26} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginBottom: '10px' }}>
            Your workspace is ready
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 28px', lineHeight: 1.6 }}>
            Create your first project by pasting a meeting transcript. Your dashboard will fill with your weekly goals, stage progress, and outputs once work begins.
          </p>
          <Link
            to="/projects/new"
            className="btn-gold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <PlusCircle size={16} />
            <span>Create Your First Project</span>
          </Link>
        </div>

        {/* Quick actions compact */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { to: '/projects', icon: <FolderKanban size={15} />, label: 'Projects' },
            { to: '/actions', icon: <CheckCircle2 size={15} />, label: 'Actions' },
            { to: '/decision-memory', icon: <BrainCircuit size={15} />, label: 'Decisions' },
            { to: '/settings', icon: <Settings size={15} />, label: 'Settings' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none' }}
            >
              {a.icon}
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#f3c958', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            <Sparkles size={13} color="#f3c958" />
            <span>CONCLUDO WORKSPACE</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
            {welcomeGreeting}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ padding: '6px 14px', background: 'rgba(226,181,60,0.1)', border: '1px solid rgba(226,181,60,0.3)', borderRadius: '20px', color: '#f3c958', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} /> {planBadgeText}
          </span>
          <button
            onClick={loadDashboardData}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {hasAnyError && (
        <div className="auth-alert-error" role="alert" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: '#fecaca' }}>
              {dashboardError || profileError || projectsError || outputsError || permissionError}
            </span>
          </div>
          <button onClick={loadDashboardData} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* ── Performance Banner ── */}
      <div
        style={{
          background: perf.bg,
          border: `1px solid ${perf.border}`,
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: perf.color }}>{perf.icon}</span>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: perf.color, fontSize: '0.95rem' }}>
              {perf.label}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>{perf.msg}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {workloadForecast > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: perf.color, fontFamily: 'var(--font-heading)' }}>
                +{workloadForecast}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>projected workload increase</div>
            </div>
          )}
          {perfState === 'crushing' && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f3c958', fontFamily: 'var(--font-heading)' }}>
                {perfPct}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>completion rate</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Week Forecast Strip ── */}
      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={sectionHeadStyle}>
            <Calendar size={14} color="#e2b53c" />
            Week Forecast
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {formatShortDate(weekDays[0].date)} · {formatShortDate(weekDays[4].date)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {weekDays.map((day, i) => {
            const isPast = i < todayIdx;
            const isToday = day.isToday;
            const isFuture = i > todayIdx;
            return (
              <div
                key={day.label}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: '8px',
                  background: isToday
                    ? 'rgba(226,181,60,0.12)'
                    : isPast
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(255,255,255,0.02)',
                  border: isToday
                    ? '1px solid rgba(226,181,60,0.4)'
                    : '1px solid rgba(255,255,255,0.05)',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? '#f3c958' : '#64748b', marginBottom: '4px', letterSpacing: '0.06em' }}>
                  {day.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '0.8rem', color: isToday ? '#f8fafc' : '#475569' }}>{day.date.getDate()}</div>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '3px' }}>
                  {isPast ? (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} title="Done" />
                  ) : isToday ? (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f3c958', display: 'inline-block', boxShadow: '0 0 6px #f3c958' }} title="Today" />
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'inline-block' }} title="Upcoming" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Week progress */}
        <div style={{ marginTop: '14px' }}>
          <ProgressBar
            value={todayIdx >= 0 ? Math.round(((todayIdx + 1) / 5) * 100) : 20}
            color={perfState === 'crushing' ? '#f3c958' : perfState === 'on_track' ? '#4ade80' : perfState === 'behind' ? '#fb923c' : '#f87171'}
            label="Week progress"
          />
        </div>
      </div>

      {/* ── 3-Column Row: Goals | Stage Chart | Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>

        {/* Weekly Goals */}
        <div style={cardStyle}>
          <div style={sectionHeadStyle}>
            <Target size={14} color="#e2b53c" />
            Weekly Goals
          </div>
          {recentProjects.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.82rem' }}>No active projects this week.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentProjects.slice(0, 4).map((p) => (
                <li key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ marginTop: '4px', width: 6, height: 6, borderRadius: '50%', background: '#e2b53c', flexShrink: 0, display: 'inline-block' }} />
                  <div>
                    <Link to={`/projects/${p.id}`} style={{ fontSize: '0.84rem', color: '#f8fafc', textDecoration: 'none', fontWeight: 500 }}>
                      {p.title}
                    </Link>
                    {p.client_or_project && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>{p.client_or_project}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/projects" style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}>
            All projects <ChevronRight size={13} />
          </Link>
        </div>

        {/* Stage Chart */}
        <div style={cardStyle}>
          <div style={sectionHeadStyle}>
            <BarChart3 size={14} color="#e2b53c" />
            Project Evolution &amp; Stages
          </div>
          <ClusteredBarChart data={stageBarData} />
          <div style={{ marginTop: '12px', fontSize: '0.72rem', color: '#475569' }}>
            {stageCounts.reduce((s, c) => s + c.stage_count, 0)} active{' '}
            {stageCounts.reduce((s, c) => s + c.stage_count, 0) === 1 ? 'project' : 'projects'}
          </div>
        </div>

        {/* Open Actions */}
        <div style={cardStyle}>
          <div style={sectionHeadStyle}>
            <ListChecks size={14} color="#e2b53c" />
            Open Actions
          </div>
          {!isActionTrackerAllowed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.82rem' }}>
              <Zap size={14} /> Available on Pro
            </div>
          ) : recentActions.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.82rem' }}>No open actions.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentActions.map((a) => {
                const overdue = isActionOverdue(a);
                return (
                  <li key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span
                      style={{
                        marginTop: '3px',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: overdue ? '#f87171' : '#f3c958',
                        flexShrink: 0,
                        display: 'inline-block',
                        boxShadow: overdue ? '0 0 6px #f8717180' : 'none',
                      }}
                    />
                    <div>
                      <Link to={`/actions/${a.id}`} style={{ fontSize: '0.83rem', color: overdue ? '#fca5a5' : '#f8fafc', textDecoration: 'none' }}>
                        {a.action_title || a.action_description?.slice(0, 60)}
                      </Link>
                      {a.due_date && (
                        <div style={{ fontSize: '0.7rem', color: overdue ? '#f87171' : '#64748b', marginTop: '1px' }}>
                          Due {formatDate(a.due_date)}{overdue ? ' · overdue' : ''}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/actions" style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}>
            All actions <ChevronRight size={13} />
          </Link>
        </div>
      </div>

            {/* ── Week Calendar Overview ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={sectionHeadStyle}>
          <Calendar size={14} color="#e2b53c" />
          Week Overview · {formatShortDate(weekDays[0].date)} to {formatShortDate(weekDays[4].date)}
        </div>
        {loadingCalendar ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px' }} />
            Loading calendar...
          </div>
        ) : calendarError ? (
          <div style={{ ...cardStyle, color: '#475569', fontSize: '0.82rem' }}>
            {calendarError}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            {weekDays.map((day) => {
              const dayEvents = eventsForDay(day.dateStr);
              const isToday = day.isToday;

              return (
                <div
                  key={day.label}
                  style={{
                    background: isToday ? '#fffcf2' : '#ffffff',
                    border: isToday ? '1px solid #e2b53c' : '1px solid #e2e8f0',
                    boxShadow: isToday ? '0 0 0 2px rgba(226,181,60,0.18)' : 'none',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    minHeight: '140px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {day.label}
                    </span>
                    <span style={{ fontFamily: "'Poppins', Arial, sans-serif", fontSize: '1.05rem', fontWeight: 700, color: isToday ? '#9a6c00' : '#16263f' }}>
                      {day.date.getDate()}
                    </span>
                  </div>

                  {dayEvents.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '12px', textAlign: 'center' }}>
                      -
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {dayEvents.map((ev) => {
                        const isMeeting = ev.type === 'meeting';
                        const isDeadline = ev.type === 'deadline';
                        const bg = isMeeting
                          ? 'rgba(33,57,92,0.08)'
                          : isDeadline
                          ? 'rgba(248,113,113,0.10)'
                          : 'rgba(226,181,60,0.10)';
                        const borderCol = isMeeting ? '#21395c' : isDeadline ? '#f87171' : '#e2b53c';
                        const textCol = isMeeting ? '#21395c' : isDeadline ? '#b91c1c' : '#7a5200';

                        return (
                          <div
                            key={ev.id}
                            style={{
                              fontSize: '0.68rem',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              background: bg,
                              borderLeft: `2px solid ${borderCol}`,
                              color: textCol,
                              lineHeight: 1.35,
                            }}
                          >
                            <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: '1px' }}>
                              {ev.time}
                            </div>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.title}
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
        )}
      </div>

      {/* ── Email Command Centre Snapshot ── */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <div style={sectionHeadStyle}>
          <Activity size={14} color="#e2b53c" />
          Email Command Centre
        </div>

        {/* Four stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Need reply', value: emailStats.needReply, color: '#f87171' },
            { label: 'Unread', value: emailStats.unread, color: '#f3c958' },
            { label: 'Flagged', value: emailStats.flagged, color: '#fb923c' },
            { label: 'Processed today', value: emailStats.processedToday, color: '#4ade80' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Email preview rows */}
        {loadingEmail ? (
          <div style={{ color: '#475569', fontSize: '0.82rem' }}>Loading...</div>
        ) : emailPreviews.length === 0 ? (
          <div style={{ color: '#475569', fontSize: '0.82rem' }}>No recent emails.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {emailPreviews.map((email) => (
              <div
                key={email.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.83rem', color: '#f8fafc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.sender_name || 'Unknown'}
                    </span>
                    {email.client_or_project && (
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        · {email.client_or_project}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email.subject || '(no subject)'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                  {email.received_at && (
                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                      {new Date(email.received_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {email.status === 'needs_reply' && (
                    <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                      Reply
                    </span>
                  )}
                  {email.status === 'flagged' && (
                    <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                      Flagged
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          to="/email"
          style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}
        >
          Open Email Centre <ChevronRight size={13} />
        </Link>
      </div>

      {/* ── Active Projects (horizontal scroll with full context) ── */}
      {recentProjects.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={sectionHeadStyle}>
              <FolderKanban size={14} color="#e2b53c" />
              Active Projects
            </div>
            <Link to="/projects" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}>
              View all <ChevronRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
            {recentProjects.map((p) => {
              const projectOutputs = recentOutputs.filter((o) => o.project_id === p.id);
              const hasTranscript = projectOutputs.some((o) => o.output_type === 'transcript');
              const hasDecision = projectOutputs.some((o) => o.output_type === 'decision_log');
              const hasAction = projectOutputs.some((o) => o.output_type === 'action_plan');
              const hasExec = projectOutputs.some((o) => o.output_type === 'executive_summary');
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  style={{
                    minWidth: '260px',
                    maxWidth: '260px',
                    background: '#0e1729',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px',
                    padding: '16px',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    flexShrink: 0,
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Project header */}
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.title}
                    </div>
                    {p.client_or_project && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.client_or_project}</div>
                    )}
                  </div>

                  {/* Output chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {hasTranscript && <FileChip name="Transcript" type="TXT" />}
                    {hasExec && <FileChip name="Summary" type="DOC" />}
                    {hasDecision && <FileChip name="Decisions" type="LOG" />}
                    {hasAction && <FileChip name="Actions" type="ACT" />}
                    {projectOutputs.length === 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#475569' }}>No outputs yet</span>
                    )}
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                    {p.meeting_date ? (
                      <span style={{ fontSize: '0.7rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {formatDate(p.meeting_date)}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>{formatDate(p.updated_at)}</span>
                    )}
                    <ArrowRight size={13} color="#e2b53c" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Outputs Section ── */}
      {recentOutputs.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <div style={sectionHeadStyle}>
            <FileText size={14} color="#e2b53c" />
            Recent Outputs
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>

            {/* Executive Summary · Word doc style */}
            {execSummary && (
              <Link to={`/projects/${execSummary.project_id}`} style={{ textDecoration: 'none' }}>
                <div style={wordDocStyle}>
                  <div style={wordDocTitleStyle}>
                    <BookOpen size={15} color="#16263f" />
                    Executive Summary
                    {execSummary.projects?.title && (
                      <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#475569', marginLeft: 'auto' }}>
                        {execSummary.projects.title}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.65, maxHeight: '120px', overflow: 'hidden', position: 'relative' }}>
                    {execSummary.content?.slice(0, 360) || 'No content.'}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32px', background: 'linear-gradient(transparent, #ffffff)' }} />
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> {formatDate(execSummary.updated_at)} &middot; Open full summary
                  </div>
                </div>
              </Link>
            )}

            {/* Decision Log · cutout style */}
            {decisionLog && isDecisionMemoryAllowed && (
              <Link to={`/projects/${decisionLog.project_id}`} style={{ textDecoration: 'none' }}>
                <div style={cutoutStyle}>
                  <div style={{ ...sectionHeadStyle, marginBottom: '10px' }}>
                    <BrainCircuit size={13} color="#e2b53c" />
                    Decision Log
                    {decisionLog.projects?.title && (
                      <span style={{ marginLeft: 'auto', color: '#475569', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                        {decisionLog.projects.title}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6, maxHeight: '90px', overflow: 'hidden' }}>
                    {decisionLog.content?.slice(0, 240) || 'No decisions recorded.'}
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowRight size={11} color="#e2b53c" />
                    <span style={{ color: '#e2b53c' }}>View full decision log</span>
                  </div>
                </div>
              </Link>
            )}

            {/* Action Plan · bullet style */}
            {actionPlan && isActionTrackerAllowed && (
              <Link to={`/projects/${actionPlan.project_id}`} style={{ textDecoration: 'none' }}>
                <div style={cardStyle}>
                  <div style={sectionHeadStyle}>
                    <CheckCircle2 size={13} color="#e2b53c" />
                    Action Plan
                    {actionPlan.projects?.title && (
                      <span style={{ marginLeft: 'auto', color: '#475569', textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: '0.75rem' }}>
                        {actionPlan.projects.title}
                      </span>
                    )}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {(actionPlan.content || '')
                      .split('\n')
                      .filter((line) => line.trim().length > 0)
                      .slice(0, 5)
                      .map((line, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span style={{ marginTop: '5px', width: 5, height: 5, borderRadius: '50%', background: '#e2b53c', flexShrink: 0, display: 'inline-block' }} />
                          <span>{line.replace(/^[-*•]\s*/, '')}</span>
                        </li>
                      ))}
                  </ul>
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#e2b53c', fontWeight: 600 }}>
                    <ArrowRight size={11} /> Open full action plan
                  </div>
                </div>
              </Link>
            )}

            {/* Transcript · Word doc style */}
            {transcript && (
              <Link to={`/projects/${transcript.project_id}`} style={{ textDecoration: 'none' }}>
                <div style={wordDocStyle}>
                  <div style={wordDocTitleStyle}>
                    <FileText size={15} color="#16263f" />
                    Meeting Transcript
                    {transcript.projects?.title && (
                      <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#475569', marginLeft: 'auto' }}>
                        {transcript.projects.title}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.65, maxHeight: '110px', overflow: 'hidden', position: 'relative', fontFamily: "'Inter', monospace" }}>
                    {transcript.content?.slice(0, 360) || 'No transcript content.'}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32px', background: 'linear-gradient(transparent, #ffffff)' }} />
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> {formatDate(transcript.updated_at)} · Open project
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── Decision Memory preview ── */}
      {isDecisionMemoryAllowed && recentDecisions.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={sectionHeadStyle}>
              <BrainCircuit size={14} color="#e2b53c" />
              Decision Memory
            </div>
            <Link to="/decision-memory" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}>
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentDecisions.slice(0, 3).map((d) => (
              <Link
                key={d.id}
                to={`/decision-memory/${d.id}`}
                style={{
                  ...cutoutStyle,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500, marginBottom: '3px' }}>
                    {d.decision_title || d.decision_summary?.slice(0, 80) || 'Decision'}
                  </div>
                  {d.decision_summary && d.decision_title && (
                    <div style={{ fontSize: '0.77rem', color: '#64748b', lineHeight: 1.5 }}>
                      {d.decision_summary.slice(0, 100)}...
                    </div>
                  )}
                </div>
                <ChevronRight size={14} color="#e2b53c" style={{ marginTop: '3px', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Intelligence Snapshot (Insights + Stats) ── */}
      {(insights || stats) && (
        <section style={{ marginBottom: '28px' }}>
          <div style={sectionHeadStyle}>
            <Activity size={14} color="#e2b53c" />
            Workspace Intelligence
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {stats?.totalProjects != null && (
              <div style={cardStyle}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#f3c958' }}>{stats.totalProjects}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Total projects</div>
              </div>
            )}
            {recentOutputs.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#f3c958' }}>{recentOutputs.length}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Outputs generated</div>
              </div>
            )}
            {recentDecisions.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#f3c958' }}>{recentDecisions.length}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Decisions recorded</div>
              </div>
            )}
            {recentActions.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#f3c958' }}>{recentActions.length}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Open actions</div>
              </div>
            )}
          </div>
          {(insights?.keyThemes?.[0] || insights?.topOpportunities?.[0]) && (
            <div style={{ ...cardStyle, marginTop: '12px' }}>
              <div style={sectionHeadStyle}><Lightbulb size={13} color="#e2b53c" /> Insight</div>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{insights?.keyThemes?.[0] ? insights.keyThemes[0].name + ' · ' + insights.keyThemes[0].relevance + '% relevance' : (insights?.topOpportunities?.[0]?.title || 'Standardised workflows')}</p>
              <Link to="/insight" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.77rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}>
                Full insights <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── Predictive Intelligence ── */}
      {predictiveData && (
        <section style={{ marginBottom: '28px' }}>
          <div style={sectionHeadStyle}>
            <TrendingUp size={14} color="#e2b53c" />
            Predictive Intelligence
          </div>
          <div style={{ ...cutoutStyle }}>
            {(predictiveData.strategicRecommendations?.[0] || predictiveData.riskPredictions?.[0]) && (
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: '0 0 10px' }}>{predictiveData.strategicRecommendations?.[0]?.summary || predictiveData.riskPredictions?.[0]?.explanation || 'Strategic forecasting active.'}</p>
            )}
            <Link to="/predictive-intelligence" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#e2b53c', textDecoration: 'none', fontWeight: 600 }}>
              Open full forecast <ChevronRight size={12} />
            </Link>
          </div>
        </section>
      )}

      {/* ── Team Workspaces ── */}
      {userTeams.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <div style={sectionHeadStyle}>
            <Users size={14} color="#e2b53c" />
            Team Workspaces
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {userTeams.map(({ team, role }) => (
              <Link
                key={team.id}
                to="/team"
                style={{
                  padding: '10px 16px',
                  background: '#0e1729',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Users size={14} color="#e2b53c" />
                <span style={{ fontSize: '0.84rem', color: '#f8fafc', fontWeight: 500 }}>{team.name}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 6px' }}>{role}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Locked features ── */}
      {backendPerms && (() => {
        const locked = [
          { key: 'decision_memory' as FeatureKey, title: 'Decision Memory', desc: 'Audit-ready decision logs and stakeholder recall.', badge: 'Pro', icon: <BrainCircuit size={16} /> },
          { key: 'action_tracker' as FeatureKey, title: 'Action Tracker', desc: 'Accountability matrix with owners and deadlines.', badge: 'Pro', icon: <CheckCircle2 size={16} /> },
          { key: 'insight' as FeatureKey, title: 'Insight', desc: 'Continuous synthesis of recurring meeting patterns.', badge: 'Pro', icon: <Lightbulb size={16} /> },
          { key: 'stats' as FeatureKey, title: 'Stats', desc: 'Workspace metrics: velocity, conversion rate, and output generation.', badge: 'Pro', icon: <BarChart3 size={16} /> },
          { key: 'endpoint_report' as FeatureKey, title: 'Endpoint Reports', desc: 'Automated executive milestone summaries.', badge: 'Pro', icon: <FileSpreadsheet size={16} /> },
          { key: 'team_workspace' as FeatureKey, title: 'Team Workspace', desc: 'Shared workspaces and role-based access.', badge: 'Team', icon: <Users size={16} /> },
          { key: 'predictive_intelligence' as FeatureKey, title: 'Predictive Intelligence', desc: 'Risk predictions and 30-to-365 day operational forecasts.', badge: 'Team', icon: <TrendingUp size={16} /> },
        ].filter((f) => !isFeatureAllowed(f.key));

        if (locked.length === 0) return null;

        return (
          <section style={{ marginBottom: '28px' }}>
            <div style={sectionHeadStyle}>
              <Star size={14} color="#e2b53c" />
              Unlock More Capabilities
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {locked.map((f) => (
                <div
                  key={f.key}
                  style={{
                    background: 'rgba(14,23,41,0.5)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    opacity: 0.7,
                  }}
                >
                  <span style={{ color: '#475569', marginTop: '1px' }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#64748b', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {f.title}
                      <span style={{ fontSize: '0.68rem', background: 'rgba(226,181,60,0.1)', color: '#e2b53c', border: '1px solid rgba(226,181,60,0.2)', borderRadius: '4px', padding: '1px 5px' }}>
                        {f.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ── Quick Actions (compact bottom bar) ── */}
      <div
        style={{
          background: '#0e1729',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600, marginRight: '4px' }}>Quick actions:</span>
        <Link to="/projects/new" className="btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none' }}>
          <PlusCircle size={14} /> New Project
        </Link>
        {[
          { to: '/projects', icon: <FolderKanban size={14} />, label: 'Projects' },
          { to: '/actions', icon: <CheckCircle2 size={14} />, label: 'Actions' },
          { to: '/decision-memory', icon: <BrainCircuit size={14} />, label: 'Decisions' },
          { to: '/insight', icon: <Lightbulb size={14} />, label: 'Insight' },
          { to: '/stats', icon: <BarChart3 size={14} />, label: 'Stats' },
          { to: '/settings', icon: <Settings size={14} />, label: 'Settings' },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none' }}
          >
            {a.icon} {a.label}
          </Link>
        ))}
      </div>

    </div>
  );
};

export default DashboardPage;
