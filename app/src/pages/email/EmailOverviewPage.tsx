/**
 * Email Command Centre - Overview Page Redesign
 *
 * Implements the authentic light-theme design from Concludo-ECC-Redesign-v1.zip / ecc-preview.html
 * - 4 Stat Tiles: Needs Reply (alert), Unread (warn), Flagged (neutral), Processed (good)
 * - Priority Inbox list with initials avatar, status tags, snippet, and responsive actions
 * - Inbox Intelligence Recommendations Panel with Triage Progress and authentic PriorityBand breakdown
 * - Complete Draft Response Panel with Tone Switcher (Concise, Detailed, Warm),
 *   Extracted Figures review, Approval Gate Checklist, and Verification Panel
 * - Strictly grounded in authentic account data, 100% Australian English, no em dashes
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { LoadingBlock, ErrorBlock } from '../../components/email/StateBlocks';
import { useViewData } from '../../lib/email/useViewData';
import { composeOverview } from '../../lib/email/overview';
import { metricCounts } from '../../lib/email/aggregation';
import { ThreadRecord } from '../../lib/email/filters';
import { DraftStyle, PriorityBand, ThreadStatus } from '../../lib/email/model';
import '../../styles/email-overview-redesign.css';

export const EmailOverviewPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state, dataset } = useViewData(accountId);

  const page = useMemo(() => composeOverview(records, now), [records, now]);
  const counts = useMemo(() => metricCounts(records, now), [records, now]);

  // Selected thread in the list for the Draft Response panel
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<DraftStyle>('concise');
  const [viewFilter, setViewFilter] = useState<'prioritised' | 'chronological' | 'all'>('prioritised');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    chk1: false,
    chk2: false,
    chk3: false,
    chk4: false,
  });

  // Reconcile selected thread: default to lead thread, or first record
  const selectedRecord: ThreadRecord | null = useMemo(() => {
    if (selectedThreadId) {
      const found = records.find((r) => r.thread.id === selectedThreadId);
      if (found) return found;
    }
    return page.lead || records[0] || null;
  }, [selectedThreadId, records, page.lead]);

  // Reset approval checklist when changing thread selection
  useEffect(() => {
    setChecklist({
      chk1: false,
      chk2: false,
      chk3: false,
      chk4: false,
    });
  }, [selectedRecord?.thread.id]);

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Associated draft from the dataset
  const activeDraft = useMemo(() => {
    if (!selectedRecord || !dataset) return null;
    return dataset.drafts.find((d) => d.threadId === selectedRecord.thread.id) || null;
  }, [selectedRecord, dataset]);

  // Priority inbox records to show
  const priorityRecords: ThreadRecord[] = useMemo(() => {
    if (viewFilter === 'chronological') {
      return records
        .slice()
        .sort((a, b) => new Date(b.thread.lastMessageAt).getTime() - new Date(a.thread.lastMessageAt).getTime())
        .slice(0, 8);
    }
    if (viewFilter === 'all') {
      return records.slice(0, 10);
    }

    // Default: Prioritised. Start with lead if present, then deduplicated section records
    const list: ThreadRecord[] = [];
    const seen = new Set<string>();

    if (page.lead) {
      list.push(page.lead);
      seen.add(page.lead.thread.id);
    }

    for (const section of page.sections) {
      for (const rec of section.records) {
        if (!seen.has(rec.thread.id)) {
          seen.add(rec.thread.id);
          list.push(rec);
        }
      }
    }

    // If still room, add remaining unflagged records
    for (const rec of records) {
      if (!seen.has(rec.thread.id) && !rec.analysis.securityAlert) {
        seen.add(rec.thread.id);
        list.push(rec);
      }
      if (list.length >= 6) break;
    }

    return list;
  }, [viewFilter, records, page.lead, page.sections]);

  // Metrics for the 4 Stat Tiles
  const needsReplyCount = useMemo(() => {
    return counts.find((c) => c.key === 'replies_due')?.count ?? 0;
  }, [counts]);

  const unreadCount = useMemo(() => {
    return records.filter((r) => !r.thread.isRead).length;
  }, [records]);

  const flaggedCount = useMemo(() => {
    return page.security.length;
  }, [page.security]);

  const processedCount = useMemo(() => {
    return records.filter((r) => r.analysis.currentStatus === 'resolved').length;
  }, [records]);

  // Priority band breakdown and classification progress
  const { triagePercentage, analysedCount, totalCount, urgentCount, highCount, soonCount, batchOrLowCount } = useMemo(() => {
    const total = records.length;
    const analysed = records.filter((r) => r.analysis.analysed).length;
    const immediate = records.filter((r) => r.analysis.priorityBand === 'immediate').length;
    const today = records.filter((r) => r.analysis.priorityBand === 'today').length;
    const soon = records.filter((r) => r.analysis.priorityBand === 'soon').length;
    const batchOrLow = records.filter((r) => r.analysis.priorityBand === 'batch' || r.analysis.priorityBand === 'low').length;

    const percentage = total > 0 ? Math.round((analysed / total) * 100) : 100;

    return {
      triagePercentage: percentage,
      analysedCount: analysed,
      totalCount: total,
      urgentCount: immediate,
      highCount: today,
      soonCount: soon,
      batchOrLowCount: batchOrLow,
    };
  }, [records]);

  // Recommendations for the Intel Panel
  const recommendations = useMemo(() => {
    const recs: Array<{
      id: string;
      type: 'critical' | 'high' | 'routine';
      title: string;
      detail: string;
      actionText: string;
      link: string;
    }> = [];

    // 1. Security Alert if any
    if (page.security.length > 0) {
      const sec = page.security[0];
      recs.push({
        id: 'sec-1',
        type: 'critical',
        title: `Security alert: ${sec.thread.subject}`,
        detail: sec.analysis.securityAlert?.explanation || 'Unsafe message flagged for your review. Advisory only.',
        actionText: 'Review security →',
        link: linkTo('/email/security-review'),
      });
    }

    // 2. Urgent / Lead thread
    if (page.lead) {
      recs.push({
        id: 'lead-1',
        type: 'critical',
        title: `Priority item: ${page.lead.counterpartyName}`,
        detail: `${page.leadReason}. Recommended: ${page.lead.analysis.recommendedNextStep}`,
        actionText: 'Review draft →',
        link: linkTo(`/email/thread/${page.lead.thread.id}`),
      });
    }

    // 3. Stated Deadlines
    const withDeadline = records.find((r) => r.nextStatedDeadline && r.thread.id !== page.lead?.thread.id);
    if (withDeadline && withDeadline.nextStatedDeadline) {
      const dateStr = new Date(withDeadline.nextStatedDeadline).toLocaleDateString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      recs.push({
        id: 'dead-1',
        type: 'high',
        title: `Deadline: ${withDeadline.counterpartyName} due ${dateStr}`,
        detail: withDeadline.analysis.whyItMatters || 'Explicit deadline stated in conversation.',
        actionText: 'Open thread →',
        link: linkTo(`/email/thread/${withDeadline.thread.id}`),
      });
    }

    // 4. Quick Wins
    const quickWinCount = counts.find((c) => c.key === 'quick_wins')?.count ?? 0;
    if (quickWinCount > 0) {
      recs.push({
        id: 'qw-1',
        type: 'routine',
        title: `${quickWinCount} Quick Wins available`,
        detail: 'Short conversations estimated at under two minutes each to rapidly reduce volume.',
        actionText: 'Work through →',
        link: linkTo('/email/quick-wins'),
      });
    }

    return recs;
  }, [page.security, page.lead, page.leadReason, records, counts, linkTo]);

  if (state === 'loading') {
    return (
      <section className="ecc-overview-v2" aria-labelledby="ecc-overview-heading">
        <LoadingBlock label="your inbox" rows={4} />
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="ecc-overview-v2" aria-labelledby="ecc-overview-heading">
        <ErrorBlock
          label="the overview"
          message="This account could not be read. Nothing has been missed; nothing has been changed either."
        />
      </section>
    );
  }

  // Format draft text according to selected tone
  const draftBodyContent = (() => {
    if (!selectedRecord) return null;
    if (!activeDraft) return null;

    if (activeDraft.status === 'withheld_for_safety') {
      return `Draft withheld for safety: ${activeDraft.statusReason || selectedRecord.analysis.securityAlert?.explanation || 'Sensitive or security-flagged message. Concludo does not draft replies to unverified or sensitive correspondence.'}`;
    }

    if (activeDraft.status === 'clarification_required') {
      return `Clarification needed before drafting: ${activeDraft.statusReason || selectedRecord.analysis.recommendedNextStep}`;
    }

    if (activeDraft.variants) {
      if (selectedTone === 'concise' && activeDraft.variants.concise) return activeDraft.variants.concise;
      if (selectedTone === 'detailed' && (activeDraft.variants.detailed || activeDraft.variants.concise)) {
        return activeDraft.variants.detailed || activeDraft.variants.concise;
      }
      if (selectedTone === 'warm' && (activeDraft.variants.warm || activeDraft.variants.concise)) {
        return activeDraft.variants.warm || activeDraft.variants.concise;
      }
    }

    return activeDraft.body || 'Draft prepared for review.';
  })();

  const avatarColors = ['av-rose', 'av-blue', 'av-amber', 'av-purple', 'av-teal', 'av-navy'];

  const factsList = (activeDraft?.factsToVerify && activeDraft.factsToVerify.length > 0)
    ? activeDraft.factsToVerify
    : (selectedRecord?.analysis.factsToVerify && selectedRecord.analysis.factsToVerify.length > 0)
    ? selectedRecord.analysis.factsToVerify
    : [];

  return (
    <div className="ecc-overview-v2">
      {/* ── 4 Stat Tiles ── */}
      <div className="stat-grid">
        {/* Tile 1: Needs Reply */}
        <Link to={linkTo('/email/reply-queue')} className="stat-tile alert" style={{ textDecoration: 'none' }}>
          <div className="stat-header">
            <span className="stat-label">Needs Reply</span>
            <svg className="stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <div className="stat-value">{needsReplyCount}</div>
          <div className="stat-footer">
            <span className="stat-delta up">▲ {urgentCount + highCount} high priority</span>
          </div>
        </Link>

        {/* Tile 2: Unread */}
        <Link to={linkTo('/email/all')} className="stat-tile warn" style={{ textDecoration: 'none' }}>
          <div className="stat-header">
            <span className="stat-label">Unread</span>
            <svg className="stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <path d="M4 4h16v12H4zM2 4l10 9 10-9" />
            </svg>
          </div>
          <div className="stat-value">{unreadCount}</div>
          <div className="stat-footer">
            <span className="stat-delta up">▲ {records.filter((r) => !r.analysis.analysed).length} unanalysed</span>
          </div>
        </Link>

        {/* Tile 3: Flagged */}
        <Link to={linkTo('/email/security-review')} className="stat-tile" style={{ textDecoration: 'none' }}>
          <div className="stat-header">
            <span className="stat-label">Flagged</span>
            <svg className="stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e2b53c" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </div>
          <div className="stat-value">{flaggedCount}</div>
          <div className="stat-footer">
            <span className="stat-delta">{flaggedCount === 1 ? '1 requires action' : `${flaggedCount} require action`}</span>
          </div>
        </Link>

        {/* Tile 4: Processed */}
        <Link to={linkTo('/email/all')} className="stat-tile good" style={{ textDecoration: 'none' }}>
          <div className="stat-header">
            <span className="stat-label">Processed</span>
            <svg className="stat-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="stat-value">{processedCount}</div>
          <div className="stat-footer">
            <span className="stat-delta down">{processedCount === 1 ? '1 resolved thread' : `${processedCount} resolved threads`}</span>
          </div>
        </Link>
      </div>

      {/* ── Main Two Columns ── */}
      <div className="main-cols">
        {/* Left Column: Priority Inbox */}
        <div>
          <div className="sec-hdr">
            <span className="sec-label">Priority inbox</span>
            <div className="view-toggle">
              <button
                type="button"
                className={`view-toggle-btn ${viewFilter === 'prioritised' ? 'active' : ''}`}
                onClick={() => setViewFilter('prioritised')}
              >
                Prioritised
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewFilter === 'chronological' ? 'active' : ''}`}
                onClick={() => setViewFilter('chronological')}
              >
                Chronological
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewFilter === 'all' ? 'active' : ''}`}
                onClick={() => setViewFilter('all')}
              >
                All
              </button>
            </div>
          </div>

          <div className="thread-list">
            {priorityRecords.length === 0 ? (
              <div
                style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--text-3)',
                }}
              >
                No conversations in this view.
              </div>
            ) : (
              priorityRecords.map((rec, index) => {
                const isSelected = selectedRecord?.thread.id === rec.thread.id;
                const isLead = rec.thread.id === page.lead?.thread.id;
                const initials = rec.counterpartyName
                  .split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'EM';

                const avatarColor = avatarColors[index % avatarColors.length];
                const dateStr = new Date(rec.thread.lastMessageAt).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <div
                    key={rec.thread.id}
                    className={`thread-card ${isSelected ? 'selected' : ''} ${!rec.thread.isRead ? 'unread' : ''}`}
                    onClick={() => setSelectedThreadId(rec.thread.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedThreadId(rec.thread.id);
                      }
                    }}
                  >
                    <div className={`thread-avatar ${avatarColor}`}>{initials}</div>
                    <div className="thread-main">
                      <div className="thread-row1">
                        <span className="thread-from">{rec.counterpartyName}</span>
                        <span className="thread-time">{dateStr}</span>
                      </div>
                      <div className="thread-subject">{rec.thread.subject}</div>
                      <div className="thread-preview">{rec.analysis.oneLineSummary}</div>

                      {/* Status / Urgency Tags */}
                      <div className="thread-tags">
                        {isLead && <span className="tag tag-red">Lead priority</span>}
                        {rec.analysis.replyRequired && (
                          <span className="tag tag-amber">Needs reply</span>
                        )}
                        {rec.analysis.priorityBand === 'immediate' && (
                          <span className="tag tag-red">Action today</span>
                        )}
                        {rec.nextStatedDeadline && (
                          <span className="tag tag-blue">
                            Due {new Date(rec.nextStatedDeadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {rec.analysis.securityAlert && (
                          <span className="tag tag-red">Security flag</span>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="thread-actions" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={linkTo(`/email/thread/${rec.thread.id}`)}
                          className="act-btn act-btn-gold"
                          style={{ textDecoration: 'none' }}
                        >
                          Review draft
                        </Link>
                        <Link
                          to={linkTo(`/email/thread/${rec.thread.id}`)}
                          className="act-btn act-btn-ghost"
                          style={{ textDecoration: 'none' }}
                        >
                          Open thread
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Inbox Intelligence */}
        <div>
          <div className="sec-hdr">
            <span className="sec-label">
              <Sparkles size={14} /> Inbox intelligence
            </span>
          </div>

          <div className="intel-panel">
            <div className="intel-header">
              <div>
                <div className="intel-title">
                  <Sparkles size={16} /> Intelligence status
                </div>
                <div className="intel-sub">Evidence-grounded inbox analysis</div>
              </div>
            </div>

            <div className="intel-body">
              {/* Score Meter */}
              <div className="health-bar-wrap">
                <div className="health-bar-row">
                  <span className="health-bar-label">Analysed and classified</span>
                  <span className="health-bar-score" style={{ color: triagePercentage >= 80 ? 'var(--green)' : 'var(--amber)' }}>
                    {triagePercentage}%
                  </span>
                </div>
                <div className="health-bar-track">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: `${triagePercentage}%`,
                      background: triagePercentage >= 80 ? 'var(--green)' : 'linear-gradient(90deg, var(--amber), var(--gold))',
                    }}
                  />
                </div>
                <div className="health-bar-meta">
                  <span>{analysedCount} of {totalCount} threads analysed</span>
                  <span>{urgentCount + highCount} require timely action</span>
                </div>
              </div>

              {/* Priority Breakdown */}
              <div className="intel-score-row">
                <div className="intel-score-item">
                  <div className="intel-score-val" style={{ color: 'var(--red)' }}>
                    {urgentCount}
                  </div>
                  <div className="intel-score-lbl">Immediate</div>
                </div>
                <div className="intel-score-item">
                  <div className="intel-score-val" style={{ color: 'var(--amber)' }}>
                    {highCount}
                  </div>
                  <div className="intel-score-lbl">Today</div>
                </div>
                <div className="intel-score-item">
                  <div className="intel-score-val" style={{ color: 'var(--navy2)' }}>
                    {soonCount}
                  </div>
                  <div className="intel-score-lbl">Soon</div>
                </div>
                <div className="intel-score-item">
                  <div className="intel-score-val" style={{ color: 'var(--text-3)' }}>
                    {batchOrLowCount}
                  </div>
                  <div className="intel-score-lbl">Batch / Low</div>
                </div>
              </div>

              {/* Grounded Recommendation Cards */}
              {recommendations.map((rec) => (
                <div key={rec.id} className={`rec-card ${rec.type}`}>
                  <div className={`rec-icon ${rec.type}`}>
                    {rec.type === 'critical' ? (
                      <AlertTriangle size={15} color="#ef4444" />
                    ) : rec.type === 'high' ? (
                      <Clock size={15} color="#f59e0b" />
                    ) : (
                      <Sparkles size={15} color="#3b82f6" />
                    )}
                  </div>
                  <div className="rec-content">
                    <div className="rec-title">{rec.title}</div>
                    <div className="rec-detail">{rec.detail}</div>
                    <Link to={rec.link} className="rec-action" style={{ textDecoration: 'none' }}>
                      {rec.actionText}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Draft Response Panel ── */}
      {selectedRecord && (
        <div className="draft-section">
          <div className="sec-hdr">
            <span className="sec-label">
              <FileText size={14} /> Draft response review
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              Target: <strong>{selectedRecord.counterpartyName}</strong>
            </span>
          </div>

          <div className="draft-panel">
            {/* Draft Header */}
            <div className="draft-header">
              <div className="draft-header-left">
                <div className="draft-header-icon">
                  <Sparkles size={20} color="var(--gold)" />
                </div>
                <div>
                  <div className="draft-title">
                    {activeDraft ? 'Response Draft Generated' : 'Conversation Intelligence Review'}
                  </div>
                  <div className="draft-subtitle">
                    {activeDraft
                      ? 'Grounded reply prepared for your explicit review and sign-off'
                      : 'Structured analysis of active thread'}
                  </div>
                </div>
              </div>

              {activeDraft ? (
                <div className="draft-status-pending">
                  <Clock size={14} /> Pending Approval
                </div>
              ) : (
                <div className="draft-status-pending" style={{ color: 'var(--text-3)', borderColor: 'var(--border-md)' }}>
                  Awaiting Draft
                </div>
              )}
            </div>

            {/* Draft Body (2 columns: left envelope & draft, right intelligence) */}
            <div className="draft-body">
              {/* Draft Left Column */}
              <div className="draft-left">
                {/* Envelope Grid */}
                <div className="envelope-grid">
                  <div>
                    <span className="env-label">From</span>
                    <span className="env-value">{accountLabel} ({accountType})</span>
                  </div>
                  <div>
                    <span className="env-label">To</span>
                    <span className="env-value">{selectedRecord.counterpartyName}</span>
                  </div>
                  <div>
                    <span className="env-label">Regarding</span>
                    <span className="env-value">{selectedRecord.thread.subject}</span>
                  </div>
                  <div>
                    <span className="env-label">Model</span>
                    <span className="env-value">Concludo Intelligence (Australian English)</span>
                  </div>
                  <div>
                    <span className="env-label">Length</span>
                    <span className="env-value">
                      {draftBodyContent
                        ? `${draftBodyContent.split(/\s+/).filter(Boolean).length} words · Standard response`
                        : 'No draft generated'}
                    </span>
                  </div>
                </div>

                {/* Tone Selector */}
                {activeDraft && activeDraft.variants && (
                  <>
                    <div className="tone-label">Select draft tone</div>
                    <div className="tone-selector">
                      <button
                        type="button"
                        className={`tone-btn ${selectedTone === 'concise' ? 'active' : ''}`}
                        onClick={() => setSelectedTone('concise')}
                      >
                        Concise
                      </button>
                      <button
                        type="button"
                        className={`tone-btn ${selectedTone === 'detailed' ? 'active' : ''}`}
                        onClick={() => setSelectedTone('detailed')}
                      >
                        Detailed
                      </button>
                      <button
                        type="button"
                        className={`tone-btn ${selectedTone === 'warm' ? 'active' : ''}`}
                        onClick={() => setSelectedTone('warm')}
                      >
                        Warm &amp; Professional
                      </button>
                    </div>
                  </>
                )}

                {/* Draft Content Box */}
                <div className="tone-label">Response draft</div>
                {draftBodyContent ? (
                  <div className="draft-body-text">{draftBodyContent}</div>
                ) : (
                  <div
                    style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '24px 20px',
                      color: 'var(--text-3)',
                      textAlign: 'center',
                    }}
                  >
                    <Mail size={28} style={{ margin: '0 auto 8px', opacity: 0.6, display: 'block' }} />
                    <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '4px' }}>
                      No draft has been generated for this conversation
                    </div>
                    <div style={{ fontSize: '0.8rem', maxWidth: '440px', margin: '0 auto' }}>
                      Concludo proposes; a person disposes. Drafts are generated only when recommended next steps warrant a drafted response. Open the conversation to review details or compose a reply.
                    </div>
                  </div>
                )}

                {/* Extracted Figures / Facts */}
                <div className="draft-figures">
                  <div className="figures-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Extracted details &amp; commitments
                  </div>
                  {selectedRecord.analysis.actions.length > 0 ? (
                    selectedRecord.analysis.actions.map((act) => (
                      <div key={act.id} className="figure-row">
                        <span className="figure-text">{act.description}</span>
                        {act.dueAt && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--amber)', fontWeight: 600 }}>
                            Due: {new Date(act.dueAt).toLocaleDateString('en-AU')}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="figure-row">
                      <span className="figure-text">{selectedRecord.analysis.recommendedNextStep}</span>
                    </div>
                  )}
                </div>

                {/* Approval Gate Checklist (only shown when an active draft exists) */}
                {activeDraft && (
                  <div className="approval-gate">
                    <div className="approval-gate-header">
                      <div className="figures-title" style={{ color: 'var(--navy)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Human approval gate
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                        {Object.values(checklist).filter(Boolean).length} / 4 verified
                      </span>
                    </div>
                    <div className="approval-gate-body">
                      <div className="approval-checklist">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checklist.chk1}
                            onChange={() => toggleCheck('chk1')}
                            style={{ accentColor: 'var(--navy)' }}
                          />
                          <span>All counterparty questions addressed</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checklist.chk2}
                            onChange={() => toggleCheck('chk2')}
                            style={{ accentColor: 'var(--navy)' }}
                          />
                          <span>No unintended legal or commercial concessions made</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checklist.chk3}
                            onChange={() => toggleCheck('chk3')}
                            style={{ accentColor: 'var(--navy)' }}
                          />
                          <span>Australian English spelling verified</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checklist.chk4}
                            onChange={() => toggleCheck('chk4')}
                            style={{ accentColor: 'var(--navy)' }}
                          />
                          <span>Stated terms confirmed against client agreement</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Draft Actions */}
                <div className="draft-actions">
                  <Link
                    to={linkTo(`/email/thread/${selectedRecord.thread.id}`)}
                    className="act-btn act-btn-gold"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Check size={14} /> Open &amp; Review in Conversation
                  </Link>
                  <Link
                    to={linkTo('/email/outputs')}
                    className="act-btn act-btn-ghost"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText size={14} /> Build Document
                  </Link>
                  <Link
                    to={linkTo('/email/all')}
                    className="act-btn act-btn-ghost"
                    style={{ textDecoration: 'none' }}
                  >
                    All Email
                  </Link>
                </div>

                {/* Safety Note */}
                <div className="safety-note">
                  Concludo proposes; a person disposes. Drafts are never sent automatically.
                </div>
              </div>

              {/* Draft Right Column: Verification & Intelligence */}
              <div className="draft-right">
                {/* Facts to Verify */}
                <div className="verify-section">
                  <div className="verify-title">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    Facts to verify
                  </div>
                  {factsList.length > 0 ? (
                    factsList.map((f) => (
                      <div key={f.id} className="verify-item">
                        <div className="verify-dot warn" />
                        <div className="verify-text">
                          <strong>{f.claim}</strong>: {f.howToVerify}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="verify-item">
                      <div className="verify-dot info" />
                      <div className="verify-text">
                        No specific factual claims flagged for manual verification in this thread.
                      </div>
                    </div>
                  )}
                </div>

                {/* Commitments in this Draft */}
                <div>
                  <div className="verify-title">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 12l2 2 4-4" />
                      <path d="M5 7H3a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" />
                    </svg>
                    Commitments in this draft
                  </div>
                  <div className="commitments-list">
                    {activeDraft?.commitmentsInDraft && activeDraft.commitmentsInDraft.length > 0 ? (
                      activeDraft.commitmentsInDraft.map((c, i) => (
                        <div key={i} className="commitment-item">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            style={{ flexShrink: 0, marginTop: '2px' }}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {c}
                        </div>
                      ))
                    ) : selectedRecord.analysis.actions.length > 0 ? (
                      selectedRecord.analysis.actions.map((act) => (
                        <div key={act.id} className="commitment-item">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            style={{ flexShrink: 0, marginTop: '2px' }}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {act.description}
                        </div>
                      ))
                    ) : (
                      <div className="commitment-item" style={{ color: 'var(--text-3)', background: 'var(--bg-raised)', borderColor: 'var(--border)' }}>
                        No explicit commitments or action promises detected in this thread.
                      </div>
                    )}
                  </div>
                </div>

                {/* Questions this draft does not answer */}
                <div>
                  <div className="verify-title">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Open questions in thread
                  </div>
                  {selectedRecord.analysis.openQuestions && selectedRecord.analysis.openQuestions.length > 0 ? (
                    selectedRecord.analysis.openQuestions.map((q) => (
                      <div key={q.id} className="unanswered-item">
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ flexShrink: 0, marginTop: '3px' }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {q.question}
                      </div>
                    ))
                  ) : (
                    <div className="unanswered-item">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ flexShrink: 0, marginTop: '3px' }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      No open counterparty questions flagged for this thread.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
