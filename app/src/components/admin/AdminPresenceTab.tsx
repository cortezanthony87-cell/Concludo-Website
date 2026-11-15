import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Radio,
  Users,
  Shield,
  Laptop,
  Clock,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Cpu,
} from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminPresenceRecord,
  AdminSession,
  fetchAdminPresence,
  sendAdminHeartbeat,
  subscribeToAdminPresence,
  formatMelbourneTime,
  formatRelativeTime,
  parseUserAgent,
} from '../../lib/enterprise/adminPresenceClient';

interface AdminPresenceTabProps {
  supabase: SupabaseClient;
  organizationId: string;
  currentUser: { id: string; email?: string };
  onlineAdminIds?: Set<string>;
}

export const AdminPresenceTab: React.FC<AdminPresenceTabProps> = ({
  supabase,
  organizationId,
  currentUser,
  onlineAdminIds: externalOnlineAdminIds,
}) => {
  const [admins, setAdmins] = useState<AdminPresenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalOnlineIds, setInternalOnlineIds] = useState<Set<string>>(new Set([currentUser.id]));
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const activeOnlineIds = externalOnlineAdminIds || internalOnlineIds;

  // Load presence records from database
  const loadData = useCallback(async () => {
    if (!supabase || !organizationId) return;
    try {
      const { data, error: fetchErr } = await fetchAdminPresence(supabase, organizationId);
      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setAdmins(data || []);
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve admin presence');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If external presence is not provided, subscribe internally
  useEffect(() => {
    if (!supabase || !organizationId || !currentUser) return;

    sendAdminHeartbeat(supabase, organizationId, 'online', '/admin/presence');

    let unsubscribe = () => {};
    if (!externalOnlineAdminIds) {
      unsubscribe = subscribeToAdminPresence(
        supabase,
        organizationId,
        currentUser,
        (activeIds) => {
          setInternalOnlineIds(activeIds);
        },
        () => {
          loadData();
        }
      );
    }

    const interval = setInterval(() => {
      sendAdminHeartbeat(supabase, organizationId, 'online', '/admin/presence');
    }, 45000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [supabase, organizationId, currentUser, externalOnlineAdminIds, loadData]);

  // Determine if a specific admin is currently online
  const isUserOnline = useCallback(
    (admin: AdminPresenceRecord): boolean => {
      if (activeOnlineIds.has(admin.user_id)) return true;

      if (admin.current_status === 'online') {
        const lastSeen = new Date(admin.last_seen_at).getTime();
        const diff = Date.now() - lastSeen;
        if (diff < 3 * 60 * 1000) return true;
      }

      if (admin.user_id === currentUser.id) return true;

      return false;
    },
    [activeOnlineIds, currentUser.id]
  );

  // Compute metrics
  const metrics = useMemo(() => {
    const total = admins.length;
    let onlineCount = 0;
    let mostRecentDate: Date | null = null;

    admins.forEach((admin) => {
      if (isUserOnline(admin)) onlineCount += 1;
      const seen = new Date(admin.last_seen_at);
      if (!isNaN(seen.getTime())) {
        if (!mostRecentDate || seen > mostRecentDate) {
          mostRecentDate = seen;
        }
      }
    });

    return {
      total,
      onlineCount,
      offlineCount: Math.max(0, total - onlineCount),
      mostRecentText: mostRecentDate ? formatRelativeTime(mostRecentDate) : 'Not recorded',
    };
  }, [admins, isUserOnline]);

  // Flatten and sort all sessions across admins
  const allSessions = useMemo(() => {
    const list: (AdminSession & {
      adminName: string;
      adminEmail: string;
      adminRole: string;
      userId: string;
    })[] = [];

    admins.forEach((admin) => {
      (admin.recent_sessions || []).forEach((session) => {
        list.push({
          ...session,
          adminName: admin.full_name,
          adminEmail: admin.email,
          adminRole: admin.role,
          userId: admin.user_id,
        });
      });
    });

    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [admins]);

  // Filtered session records
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      if (selectedAdminId !== 'all' && session.userId !== selectedAdminId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = session.adminName?.toLowerCase().includes(q);
        const matchEmail = session.adminEmail?.toLowerCase().includes(q);
        const matchIp = session.ip?.toLowerCase().includes(q);
        const matchUa = session.user_agent?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchIp && !matchUa) return false;
      }
      return true;
    });
  }, [allSessions, selectedAdminId, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header and Telemetry Status */}
      <div className="content-card" style={{ padding: '24px 28px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(226, 181, 60, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e2b53c',
                }}
              >
                <Radio size={18} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Administrator Presence & Real-Time Activity
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, maxWidth: '620px' }}>
              Live WebSocket presence tracking, active session status, and sign-in records for
              all enterprise administrators.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              <span>Real-Time Presence Live</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                sendAdminHeartbeat(supabase, organizationId, 'online', '/admin/presence');
                loadData();
              }}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              title="Refresh administrator telemetry"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          className="content-card"
          style={{
            padding: '20px',
            borderLeft: '4px solid #10b981',
            background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, rgba(14, 23, 41, 0.7) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Online Now
            </span>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 10px #10b981',
              }}
            />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>
            {metrics.onlineCount}{' '}
            <span style={{ fontSize: '0.9rem', color: '#6ee7b7', fontWeight: 500 }}>
              of {metrics.total} Active
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
            Connected to real-time presence socket
          </div>
        </div>

        <div
          className="content-card"
          style={{
            padding: '20px',
            borderLeft: '4px solid #64748b',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Offline
            </span>
            <Users size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>
            {metrics.offlineCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
            No active browser session open
          </div>
        </div>

        <div
          className="content-card"
          style={{
            padding: '20px',
            borderLeft: '4px solid #e2b53c',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Admins
            </span>
            <Shield size={16} color="#e2b53c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
            1 Owner and {Math.max(0, metrics.total - 1)} Organization Admins
          </div>
        </div>

        <div
          className="content-card"
          style={{
            padding: '20px',
            borderLeft: '4px solid #3b82f6',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Last Session Activity
            </span>
            <Clock size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', paddingTop: '4px' }}>
            {metrics.mostRecentText}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
            Melbourne timezone (AEDT)
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Real-Time Administrator Presence Matrix */}
      <div className="content-card" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 6px' }}>
            Administrator Presence Matrix
          </h4>
          <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0 }}>
            Real-time status indicators update dynamically when administrators navigate or sign into
            the workspace.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {admins.map((admin) => {
            const online = isUserOnline(admin);
            const isOwner = admin.role === 'organization_owner';
            const latestSession = (admin.recent_sessions || [])[0];
            const uaInfo = parseUserAgent(latestSession?.user_agent);

            return (
              <div
                key={admin.user_id}
                style={{
                  padding: '20px',
                  borderRadius: '10px',
                  background: online ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                  border: online
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                }}
              >
                {/* Admin Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: isOwner ? 'rgba(226, 181, 60, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          border: isOwner ? '1px solid #e2b53c' : '1px solid #3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f8fafc',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                        }}
                      >
                        {admin.full_name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: online ? '#10b981' : '#64748b',
                          border: '2px solid #0e1729',
                          boxShadow: online ? '0 0 8px #10b981' : 'none',
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.98rem' }}>
                        {admin.full_name}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{admin.email}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: isOwner ? 'rgba(226, 181, 60, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isOwner ? '#e2b53c' : '#93c5fd',
                      border: isOwner ? '1px solid rgba(226, 181, 60, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {isOwner ? 'Organization Owner' : 'Organization Admin'}
                  </span>
                </div>

                {/* Status Bar */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: online ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                    border: online ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(100, 116, 139, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: online ? '#10b981' : '#64748b',
                        boxShadow: online ? '0 0 6px #10b981' : 'none',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: online ? '#6ee7b7' : '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {online ? 'Online Now' : 'Offline'}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {online
                      ? admin.current_path
                        ? `Viewing ${admin.current_path}`
                        : 'Active in workspace'
                      : `Last active ${formatRelativeTime(admin.last_seen_at)}`}
                  </span>
                </div>

                {/* Detail Points */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Last Sign-In:</span>
                    <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                      {formatMelbourneTime(admin.last_sign_in_at)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Last Activity Recorded:</span>
                    <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                      {formatMelbourneTime(admin.last_seen_at)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Primary Device:</span>
                    <span
                      style={{
                        color: uaInfo.isAutomated ? '#fca5a5' : '#f8fafc',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {uaInfo.isAutomated ? <Cpu size={12} /> : <Laptop size={12} />}
                      <span>
                        {uaInfo.browser} ({uaInfo.os})
                      </span>
                    </span>
                  </div>

                  {latestSession?.ip && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span>Recent IP Address:</span>
                      <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                        {latestSession.ip.replace('/32', '')}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAdminId(admin.user_id)}
                  className="btn-secondary"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Eye size={14} />
                  <span>View Session History ({admin.recent_sessions?.length || 0})</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Comprehensive Session History Table */}
      <div className="content-card" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 4px' }}>
              Admin Session History & Audit Records
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0 }}>
              Chronological log of verified logins, IP addresses, user agents, and session updates.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#94a3b8" />
              <select
                className="form-input"
                style={{ padding: '6px 12px', fontSize: '0.82rem', background: '#0e1729' }}
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
              >
                <option value="all">All Administrators ({allSessions.length})</option>
                {admins.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.full_name} ({a.email})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color="#94a3b8"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search by IP, email, or device..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ padding: '6px 12px 6px 30px', fontSize: '0.82rem', width: '220px' }}
              />
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                }}
              >
                <th style={{ padding: '12px 16px' }}>Administrator</th>
                <th style={{ padding: '12px 16px' }}>Login Time (Melbourne)</th>
                <th style={{ padding: '12px 16px' }}>Last Active Timestamp</th>
                <th style={{ padding: '12px 16px' }}>IP Address</th>
                <th style={{ padding: '12px 16px' }}>Device & Client Environment</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Session Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    No session activity matches the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const ua = parseUserAgent(session.user_agent);
                  const isCurrent = session.is_active;

                  return (
                    <tr
                      key={session.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.02)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>
                          {session.adminName}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{session.adminEmail}</div>
                      </td>

                      <td style={{ padding: '14px 16px', fontSize: '0.84rem', color: '#cbd5e1' }}>
                        {formatMelbourneTime(session.created_at)}
                      </td>

                      <td style={{ padding: '14px 16px', fontSize: '0.84rem' }}>
                        <div style={{ color: '#f8fafc' }}>{formatMelbourneTime(session.updated_at)}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                          {formatRelativeTime(session.updated_at)}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#93c5fd',
                            background: 'rgba(59, 130, 246, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                          }}
                        >
                          {session.ip ? session.ip.replace('/32', '') : '127.0.0.1'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: ua.isAutomated ? '#fca5a5' : '#f8fafc',
                            fontWeight: 500,
                            fontSize: '0.82rem',
                          }}
                        >
                          {ua.isAutomated ? <Cpu size={14} /> : <Laptop size={14} />}
                          <span>{ua.browser}</span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>Platform: {ua.os}</div>
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {isCurrent ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#6ee7b7',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#10b981',
                              }}
                            />
                            <span>Active Session</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              background: 'rgba(100, 116, 139, 0.12)',
                              color: '#94a3b8',
                              border: '1px solid rgba(100, 116, 139, 0.2)',
                            }}
                          >
                            Previous Session
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
