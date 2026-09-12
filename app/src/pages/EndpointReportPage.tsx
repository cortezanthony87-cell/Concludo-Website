import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileBarChart,
  PlusCircle,
  Calendar,
  Clock,
  Trash2,
  Eye,
  RefreshCw,
  Lock,
  Loader2,
  AlertCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Award,
  Layers,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  X,
  Printer,
  ChevronRight,
  BrainCircuit,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import {
  fetchEndpointReports,
  generateEndpointReport,
  softDeleteEndpointReport,
} from '../lib/reports/reportClient';
import { EndpointReport, ReportPeriod, EndpointReportContent } from '../lib/reports/types';

export const EndpointReportPage: React.FC = () => {
  const { user } = useAuth();
  const { hasAccess, loading: checkingPermissions } = usePermissions('endpoint_report');

  const [reports, setReports] = useState<EndpointReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal / Reader state
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('All Time');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [viewingReport, setViewingReport] = useState<EndpointReport | null>(null);

  useEffect(() => {
    document.title = 'Executive Endpoint Reports — Concludo Workspace';
  }, []);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEndpointReports();
      setReports(data);
    } catch (err: any) {
      console.error('Failed to load endpoint reports:', err);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (hasAccess) {
      loadReports();
    }
  }, [hasAccess, loadReports]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);

    try {
      const newReport = await generateEndpointReport(selectedPeriod, customTitle || undefined);
      setShowGenerateModal(false);
      setCustomTitle('');
      await loadReports();
      setViewingReport(newReport);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setError('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Move this executive report to Recently Deleted? It will be recoverable for 30 days.')) {
      return;
    }

    setDeletingId(id);
    try {
      await softDeleteEndpointReport(id);
      if (viewingReport?.id === id) {
        setViewingReport(null);
      }
      await loadReports();
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      alert('Failed to delete report: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  // Permission Gate
  if (!checkingPermissions && !hasAccess) {
    return (
      <div className="page-container" style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            background: 'linear-gradient(145deg, #16263f 0%, #111d30 100%)',
            border: '1px solid rgba(226, 181, 60, 0.3)',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(226, 181, 60, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              border: '1px solid #e2b53c',
            }}
          >
            <Lock size={32} color="#e2b53c" />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(226, 181, 60, 0.15)',
              border: '1px solid rgba(226, 181, 60, 0.4)',
              padding: '4px 12px',
              borderRadius: '20px',
              color: '#e2b53c',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px',
            }}
          >
            Available on Pro
          </div>

          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
            Executive Endpoint Reports
          </h2>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '1rem',
              maxWidth: '560px',
              margin: '0 auto 28px auto',
              lineHeight: 1.6,
            }}
          >
            Generate comprehensive, boardroom-ready reports summarizing meeting volume, organizational decisions,
            completion performance, recurring themes, and strategic risk mitigations across any time period.
          </p>

          <Link to="/dashboard" className="action-button-secondary" style={{ textDecoration: 'none' }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading && reports.length === 0) {
    return (
      <div className="page-container" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <Loader2 size={40} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 16px auto' }} />
        <h3 style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.2rem', marginBottom: '8px' }}>
          Loading reports
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Retrieving executive milestone reports from database...
        </p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: '32px 24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(226, 181, 60, 0.15)',
                border: '1px solid rgba(226, 181, 60, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileBarChart size={20} color="#e2b53c" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Endpoint Reports
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0 }}>
            Executive summaries distilled from historical transcripts, decisions, and action items.
          </p>
        </div>

        <button
          type="button"
          className="action-button-primary"
          onClick={() => setShowGenerateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          <PlusCircle size={16} />
          <span>Generate Report</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" style={{ marginBottom: '20px' }}>
          <AlertCircle size={20} color="#f87171" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{error}</div>
          </div>
          <button
            type="button"
            className="action-button-secondary"
            onClick={loadReports}
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <div
          style={{
            background: 'linear-gradient(145deg, #16263f 0%, #111d30 100%)',
            border: '1px solid rgba(226, 181, 60, 0.2)',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(226, 181, 60, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              border: '1px solid rgba(226, 181, 60, 0.4)',
            }}
          >
            <FileBarChart size={32} color="#e2b53c" />
          </div>

          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            No endpoint reports generated yet
          </h3>

          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.94rem',
              maxWidth: '480px',
              margin: '0 auto 24px auto',
              lineHeight: 1.6,
            }}
          >
            Generate an executive-level summary across your meeting archive, tracking decisions, commitments,
            recurring patterns, and delivery risks.
          </p>

          <button
            type="button"
            className="action-button-primary"
            onClick={() => setShowGenerateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusCircle size={16} />
            <span>Generate First Report</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => setViewingReport(report)}
              style={{
                background: 'rgba(22, 38, 63, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="report-card-hover"
            >
              <div style={{ flex: 1, marginRight: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.05rem' }}>
                    {report.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      background: 'rgba(226, 181, 60, 0.15)',
                      border: '1px solid rgba(226, 181, 60, 0.3)',
                      color: '#e2b53c',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {report.report_period}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} color="#e2b53c" />
                    <span>Generated {new Date(report.generated_at).toLocaleDateString('en-AU')}</span>
                  </div>
                  <div>
                    {report.report_content.meetingActivity?.totalMeetings ?? 0} Meetings Analyzed
                  </div>
                  <div>
                    {report.report_content.decisionSummary?.totalDecisions ?? 0} Decisions
                  </div>
                  <div>
                    {report.report_content.actionSummary?.totalActions ?? 0} Actions ({report.report_content.completionPerformance?.completionRate ?? 0}% completed)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="action-button-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingReport(report);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.84rem' }}
                >
                  <Eye size={14} />
                  <span>View Report</span>
                </button>

                <button
                  type="button"
                  className="icon-button-danger"
                  onClick={(e) => handleDelete(report.id, e)}
                  disabled={deletingId === report.id}
                  title="Move to Recently Deleted"
                  style={{
                    background: 'none',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {deletingId === report.id ? (
                    <Loader2 size={16} className="spin-animation" color="#f87171" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px', width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileBarChart size={20} color="#e2b53c" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Generate Executive Endpoint Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerate}>
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.88rem' }}>
                  Reporting Period
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {(['All Time', 'Last 30 Days', 'Last 90 Days', 'Last 6 Months', 'Last 12 Months'] as ReportPeriod[]).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: selectedPeriod === period ? '#e2b53c' : 'rgba(255, 255, 255, 0.1)',
                        background: selectedPeriod === period ? 'rgba(226, 181, 60, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: selectedPeriod === period ? '#e2b53c' : '#cbd5e1',
                        fontWeight: selectedPeriod === period ? 700 : 500,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.88rem' }}>
                  Custom Report Title (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={`Executive Endpoint Report — ${selectedPeriod}`}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="action-button-secondary"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={generating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-button-primary"
                  disabled={generating}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="spin-animation" color="#0f172a" />
                      <span>Generating report...</span>
                    </>
                  ) : (
                    <>
                      <FileBarChart size={16} />
                      <span>Generate Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Report Full Modal / Reader */}
      {viewingReport && (
        <div className="modal-overlay" onClick={() => setViewingReport(null)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '960px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '36px',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '20px',
                marginBottom: '24px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    {viewingReport.title}
                  </h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#94a3b8' }}>
                  <span>Period: <strong style={{ color: '#e2b53c' }}>{viewingReport.report_period}</strong></span>
                  <span>•</span>
                  <span>Generated {new Date(viewingReport.generated_at).toLocaleString('en-AU')}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="action-button-secondary"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Content: All 10 Required Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* 1. Executive Summary */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Award size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    1. Executive Summary
                  </h3>
                </div>
                <div
                  style={{
                    background: 'rgba(226, 181, 60, 0.05)',
                    border: '1px solid rgba(226, 181, 60, 0.25)',
                    borderRadius: '10px',
                    padding: '18px',
                    color: '#e2e8f0',
                    lineHeight: 1.6,
                    fontSize: '0.94rem',
                  }}
                >
                  {viewingReport.report_content.executiveSummary}
                </div>
              </div>

              {/* 2. Meeting Activity */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Calendar size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    2. Meeting Activity
                  </h3>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Total Sessions</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                      {viewingReport.report_content.meetingActivity.totalMeetings}
                    </div>
                  </div>
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Primary Client</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
                      {viewingReport.report_content.meetingActivity.mostActiveClient || 'Internal Workspaces'}
                    </div>
                  </div>
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Active Initiative</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
                      {viewingReport.report_content.meetingActivity.mostActiveProject || 'Strategic Operations'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Decision Summary */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <BrainCircuit size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    3. Decision Summary
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viewingReport.report_content.decisionSummary.keyDecisions.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No key decisions recorded for this period.</div>
                  ) : (
                    viewingReport.report_content.decisionSummary.keyDecisions.map((dec: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>{dec.title}</div>
                        {dec.summary && (
                          <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: '4px' }}>{dec.summary}</div>
                        )}
                        <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                          <span>Owner: {dec.owner || 'Executive Committee'}</span>
                          {dec.date && <span>Date: {dec.date}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. Action Summary & 5. Completion Performance */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <CheckSquare size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    4. Action Summary & 5. Completion Performance
                  </h3>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Total Actions</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                      {viewingReport.report_content.actionSummary.totalActions}
                    </div>
                  </div>
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Completed</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>
                      {viewingReport.report_content.actionSummary.completedActions}
                    </div>
                  </div>
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Completion Rate</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e2b53c', marginTop: '4px' }}>
                      {viewingReport.report_content.completionPerformance.completionRate}%
                    </div>
                  </div>
                  <div className="section-card" style={{ padding: '14px' }}>
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Performance Rating</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: viewingReport.report_content.completionPerformance.performanceRating === 'Needs Attention' ? '#f87171' : '#4ade80', marginTop: '4px' }}>
                      {viewingReport.report_content.completionPerformance.performanceRating}
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Recurring Themes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Layers size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    6. Recurring Themes
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viewingReport.report_content.recurringThemes.map((theme: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{theme.theme}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>{theme.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7. Recurring Risks */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldAlert size={18} color="#f87171" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    7. Recurring Risks
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viewingReport.report_content.recurringRisks.map((risk: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(248, 113, 113, 0.05)',
                        border: '1px solid rgba(248, 113, 113, 0.25)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{risk.risk}</span>
                        <span style={{ fontSize: '0.72rem', color: risk.severity === 'high' ? '#f87171' : '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>
                          {risk.severity} severity
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>
                        Recurrence count: {risk.recurrence} • Recommendation: {risk.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 8. Recurring Opportunities */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <TrendingUp size={18} color="#4ade80" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    8. Recurring Opportunities
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viewingReport.report_content.recurringOpportunities.map((opp: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(74, 222, 128, 0.04)',
                        border: '1px solid rgba(74, 222, 128, 0.2)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{opp.opportunity}</span>
                        <span style={{ fontSize: '0.72rem', color: '#4ade80', textTransform: 'uppercase', fontWeight: 700 }}>
                          {opp.impact} impact
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>{opp.valueDescription}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 9. Recommended Areas For Review */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <AlertTriangle size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    9. Recommended Areas For Review
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {viewingReport.report_content.recommendedAreasForReview.map((rec: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{rec.area}</span>
                        <span style={{ fontSize: '0.72rem', color: rec.priority === 'critical' ? '#f87171' : '#e2b53c', textTransform: 'uppercase', fontWeight: 700 }}>
                          {rec.priority} priority
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>{rec.reason}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 10. Project Intelligence Summary */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <FileText size={18} color="#e2b53c" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    10. Project Intelligence Summary
                  </h3>
                </div>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '14px',
                    fontSize: '0.9rem',
                    color: '#cbd5e1',
                    lineHeight: 1.55,
                  }}
                >
                  {viewingReport.report_content.projectIntelligenceSummary.summaryText}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
