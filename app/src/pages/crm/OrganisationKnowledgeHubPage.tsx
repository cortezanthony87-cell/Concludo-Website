/**
 * Organisation Knowledge Hub (OKH) - 10-View Comprehensive Experience
 * Concludo Pty Ltd. 21 October 2026.
 *
 * Implements all 10 specifications from UX_Specification.md & Wireframes.html:
 * 1. Dashboard
 * 2. Section Progress
 * 3. Completeness Score
 * 4. Missing Information Report
 * 5. Confidence Heat Map
 * 6. Recommended Improvements
 * 7. AI Suggestions (Proposals)
 * 8. Source Explorer
 * 9. Audit History
 * 10. Version History
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Edit3, Check, X, Shield, RefreshCw, UploadCloud, ChevronRight, ChevronDown, Camera, AlertCircle, Eye, RotateCcw } from 'lucide-react';
import { useStage4 } from '../../components/crm/Stage4Scaffold';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  fetchOrCreateHub,
  fetchHubFieldValues,
  updateFieldValue,
  fetchProposals,
  reviewProposal,
  fetchVersions,
  captureVersionSnapshot,
  fetchAuditLogs,
  triggerEnrichment,
  restoreVersionSnapshot,
  OKH_SECTION_TITLES,
} from '../../lib/okh/client';
import type {
  OkhHub,
  OkhFieldValue,
  OkhProposal,
  OkhVersion,
  OkhAuditLogEntry,
  OkhSectionKey,
} from '../../lib/okh/types';
import '../../styles/organisation-knowledge-hub.css';

type ScreenId =
  | 'dashboard'
  | 'section-progress'
  | 'completeness'
  | 'missing'
  | 'heatmap'
  | 'recommended'
  | 'ai-suggestions'
  | 'source-explorer'
  | 'audit'
  | 'versions';

export const OrganisationKnowledgeHubPage: React.FC = () => {
  const { organisationId } = useParams<{ organisationId: string }>();
  const { data: crmData, viewState, linkTo } = useStage4();
  const { user, profile } = useAuth();

  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [hub, setHub] = useState<OkhHub | null>(null);
  const [fieldValues, setFieldValues] = useState<OkhFieldValue[]>([]);
  const [proposals, setProposals] = useState<OkhProposal[]>([]);
  const [versions, setVersions] = useState<OkhVersion[]>([]);
  const [auditLogs, setAuditLogs] = useState<OkhAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showEnrichModal, setShowEnrichModal] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');

  // Diff Viewer Modal State
  const [diffVersion, setDiffVersion] = useState<OkhVersion | null>(null);
  const [showUnchangedDiff, setShowUnchangedDiff] = useState(false);

  // Restore Modal State
  const [restoreCandidate, setRestoreCandidate] = useState<OkhVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Actor details
  const actorId = user?.id || 'authentic-user';
  const actorName = profile?.full_name || user?.email || 'Authorised Member';

  // Accordion state in Section Progress & Source Explorer
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
  });

  // Selected field for editing in slide-out / modal
  const [editingField, setEditingField] = useState<OkhFieldValue | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Find organisation
  const org = useMemo(() => {
    return crmData.organisations.find((o) => o.id === organisationId);
  }, [crmData.organisations, organisationId]);

  const orgName = org?.name || 'Organisation Knowledge Hub';
  const workspaceId = viewState.workspaceId || user?.id || 'ws-agency';

  // Load data
  const loadHubData = async () => {
    if (!organisationId) return;
    setLoading(true);

    const h = await fetchOrCreateHub(workspaceId, organisationId, orgName, actorId);
    setHub(h);

    if (h) {
      const [fvs, props, vers, audits] = await Promise.all([
        fetchHubFieldValues(h.id),
        fetchProposals(h.id),
        fetchVersions(h.id),
        fetchAuditLogs(h.id),
      ]);
      setFieldValues(fvs);
      setProposals(props);
      setVersions(vers);
      setAuditLogs(audits);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHubData();
  }, [organisationId, workspaceId]);

  // Derived stats
  const totalFields = fieldValues.length || 107;
  const filledFields = fieldValues.filter((f) => {
    const v = f.value?.v !== undefined ? f.value.v : f.value;
    return v !== null && v !== undefined && v !== '';
  });
  const filledCount = filledFields.length;
  const emptyCount = totalFields - filledCount;

  const requiredFields = fieldValues.filter((f) => f.definition?.is_required);
  const filledRequired = requiredFields.filter((f) => {
    const v = f.value?.v !== undefined ? f.value.v : f.value;
    return v !== null && v !== undefined && v !== '';
  });

  const completenessScore =
    requiredFields.length > 0
      ? Math.round((filledRequired.length / requiredFields.length) * 100)
      : hub?.completeness_score || 0;

  const pendingProposals = proposals.filter((p) => !p.review_action);
  const staleFieldsCount = filledFields.filter((f) => {
    if (!f.updated_at) return false;
    const days = (Date.now() - new Date(f.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 90;
  }).length;

  // High, moderate, low counts
  const highConfCount = filledFields.filter((f) => f.confidence === 'high').length;
  const modConfCount = filledFields.filter((f) => f.confidence === 'moderate').length;
  const lowConfCount = filledFields.filter((f) => f.confidence === 'low').length;
  const humanVerifiedCount = filledFields.filter((f) => f.is_human_verified).length;

  // Group fields by section
  const sectionGroups = useMemo(() => {
    const groups: Record<OkhSectionKey, OkhFieldValue[]> = {
      overview: [],
      customers: [],
      products_services: [],
      marketing: [],
      sales: [],
      customer_success: [],
      operations: [],
      strategy: [],
      policies: [],
      ai_layer: [],
    };
    fieldValues.forEach((f) => {
      if (groups[f.section_key]) {
        groups[f.section_key].push(f);
      }
    });
    return groups;
  }, [fieldValues]);

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleEditField = (fv: OkhFieldValue) => {
    setEditingField(fv);
    const v = fv.value?.v !== undefined ? fv.value.v : fv.value;
    setEditValue(v !== null && v !== undefined ? String(v) : '');
  };

  const handleSaveField = async () => {
    if (!editingField || !hub) return;
    const ok = await updateFieldValue(editingField.id, editValue, actorId, actorName);
    if (ok) {
      setEditingField(null);
      await loadHubData();
    }
  };

  const handleReviewProposal = async (
    proposalId: string,
    action: 'accepted' | 'rejected' | 'edited',
    finalVal?: any
  ) => {
    if (!hub) return;
    await reviewProposal(proposalId, action, finalVal, actorId, actorName);
    await loadHubData();
  };

  const handleStartEnrichment = async () => {
    if (!hub) return;
    setShowEnrichModal(false);
    setEnriching(true);
    setToastMessage('Enrichment started. You will see suggestions in a moment.');
    setToastType('info');

    try {
      const res = await triggerEnrichment(hub.id, 'full');
      if (res.success) {
        setToastMessage('Enrichment completed. Review proposals below.');
        setToastType('success');
        await loadHubData();
      } else {
        setToastMessage(res.error || 'Enrichment failed. Please try again.');
        setToastType('error');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Enrichment failed.');
      setToastType('error');
    } finally {
      setEnriching(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const handleConfirmRestore = async () => {
    if (!hub || !restoreCandidate) return;
    setRestoring(true);
    try {
      const ok = await restoreVersionSnapshot(hub.id, restoreCandidate, actorId, actorName);
      if (ok) {
        setToastMessage('Snapshot restored successfully.');
        setToastType('success');
        setRestoreCandidate(null);
        await loadHubData();
      } else {
        setToastMessage('Failed to restore snapshot.');
        setToastType('error');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to restore snapshot.');
      setToastType('error');
    } finally {
      setRestoring(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!hub) return;
    await captureVersionSnapshot(hub.id, actorId, 'Manual snapshot', completenessScore);
    await loadHubData();
  };

  if (loading) {
    return (
      <div className="content" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--slate)', fontSize: '14px' }}>Loading Organisation Knowledge Hub...</p>
      </div>
    );
  }

  return (
    <div className="okh-view-wrapper" style={{ padding: '24px 32px' }}>
      {/* Back to Organisation Record */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          to={linkTo(`/crm/organisations/${organisationId}`)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} /> Back to {orgName} Record
        </Link>
      </div>

      {/* Top Bar Navigation for 10 Views */}
      <div className="view-nav" style={{ marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div
          className={`view-nav-item ${activeScreen === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveScreen('dashboard')}
        >
          Dashboard
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'section-progress' ? 'active' : ''}`}
          onClick={() => setActiveScreen('section-progress')}
        >
          Section Progress
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'completeness' ? 'active' : ''}`}
          onClick={() => setActiveScreen('completeness')}
        >
          Completeness Score
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'missing' ? 'active' : ''}`}
          onClick={() => setActiveScreen('missing')}
        >
          Missing Information
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'heatmap' ? 'active' : ''}`}
          onClick={() => setActiveScreen('heatmap')}
        >
          Confidence Heat Map
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'recommended' ? 'active' : ''}`}
          onClick={() => setActiveScreen('recommended')}
        >
          Recommended
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'ai-suggestions' ? 'active' : ''}`}
          onClick={() => setActiveScreen('ai-suggestions')}
        >
          AI Suggestions
          {pendingProposals.length > 0 && <span className="badge">{pendingProposals.length}</span>}
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'source-explorer' ? 'active' : ''}`}
          onClick={() => setActiveScreen('source-explorer')}
        >
          Source Explorer
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveScreen('audit')}
        >
          Audit History
        </div>
        <div
          className={`view-nav-item ${activeScreen === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveScreen('versions')}
        >
          Version History
        </div>
      </div>

      {/* SCREEN 1: DASHBOARD */}
      {activeScreen === 'dashboard' && (
        <div className="screen active">
          <div className="page-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1>{orgName}</h1>
                <div className="page-header-sub">
                  <span className={`freshness-badge freshness-${hub?.knowledge_freshness || 'stale'}`}>
                    ● {hub?.knowledge_freshness === 'current' ? 'Current' : hub?.knowledge_freshness === 'ageing' ? 'Ageing' : 'Stale'}
                  </span>
                  <span>
                    Last enriched:{' '}
                    {hub?.last_enrichment_at ? new Date(hub.last_enrichment_at).toLocaleDateString('en-AU') : 'Never'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveScreen('section-progress')}
                >
                  Edit
                </button>
                <button
                  className="btn btn-gold"
                  onClick={() => setShowEnrichModal(true)}
                >
                  ⚡ Populate With AI
                </button>
              </div>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-tile-label">Completeness</div>
              <div className="stat-tile-value" style={{ color: 'var(--gold)' }}>
                {completenessScore}%
              </div>
              <div className="stat-tile-sub">Overall hub score</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Fields Filled</div>
              <div className="stat-tile-value">
                {filledCount}
                <span style={{ fontSize: '18px', color: 'var(--slate)' }}>/{totalFields}</span>
              </div>
              <div className="stat-tile-sub">{emptyCount} fields empty</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Pending AI</div>
              <div className="stat-tile-value" style={{ color: 'var(--warning)' }}>
                {pendingProposals.length}
              </div>
              <div className="stat-tile-sub">Suggestions to review</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Stale Fields</div>
              <div className="stat-tile-value" style={{ color: 'var(--danger)' }}>
                {staleFieldsCount}
              </div>
              <div className="stat-tile-sub">Updated &gt; 90 days ago</div>
            </div>
          </div>

          {pendingProposals.length > 0 && (
            <div className="action-strip">
              <span className="action-strip-icon">⚡</span>
              <div className="action-strip-text">
                <strong>{pendingProposals.length} AI suggestions</strong> are ready for your review.
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveScreen('ai-suggestions')}
              >
                Review Now
              </button>
            </div>
          )}

          <div className="section-grid">
            {(Object.keys(OKH_SECTION_TITLES) as OkhSectionKey[]).map((secKey) => {
              const secFields = sectionGroups[secKey] || [];
              const secFilled = secFields.filter((f) => {
                const v = f.value?.v !== undefined ? f.value.v : f.value;
                return v !== null && v !== undefined && v !== '';
              }).length;
              const secPct = secFields.length > 0 ? Math.round((secFilled / secFields.length) * 100) : 0;

              return (
                <div
                  key={secKey}
                  className="section-card"
                  onClick={() => {
                    setOpenSections({ [secKey]: true });
                    setActiveScreen('section-progress');
                  }}
                >
                  <div className="section-card-header">
                    <div className="section-card-name">{OKH_SECTION_TITLES[secKey]}</div>
                    <div className="section-card-pct">{secPct}%</div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${secPct}%` }} />
                  </div>
                  <div className="section-card-count">
                    {secFilled} of {secFields.length} fields
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCREEN 2: SECTION PROGRESS */}
      {activeScreen === 'section-progress' && (
        <div className="screen active">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Section Progress</h1>
              <div className="page-header-sub">
                10 sections · {filledCount} of {totalFields} fields complete
              </div>
            </div>
          </div>

          {(Object.keys(OKH_SECTION_TITLES) as OkhSectionKey[]).map((secKey) => {
            const secFields = sectionGroups[secKey] || [];
            const secFilled = secFields.filter((f) => {
              const v = f.value?.v !== undefined ? f.value.v : f.value;
              return v !== null && v !== undefined && v !== '';
            }).length;
            const secPct = secFields.length > 0 ? Math.round((secFilled / secFields.length) * 100) : 0;
            const isOpen = !!openSections[secKey];

            return (
              <div key={secKey} className={`accordion-item ${isOpen ? 'open' : ''}`}>
                <div className="accordion-header" onClick={() => toggleSection(secKey)}>
                  <span className="accordion-chevron">{isOpen ? '▼' : '▶'}</span>
                  <div className="accordion-title">{OKH_SECTION_TITLES[secKey]}</div>
                  <div className="accordion-meta">
                    <span className="accordion-pct">{secPct}%</span>
                    <div className="accordion-mini-bar">
                      <div className="progress-fill" style={{ width: `${secPct}%`, height: '100%' }} />
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="accordion-body">
                    <table className="field-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Value</th>
                          <th>Confidence</th>
                          <th>Source</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secFields.map((fv) => {
                          const v = fv.value?.v !== undefined ? fv.value.v : fv.value;
                          const isEmpty = v === null || v === undefined || v === '';
                          const isReq = fv.definition?.is_required;

                          return (
                            <tr key={fv.id} style={isReq && isEmpty ? { backgroundColor: '#FFF9F0' } : {}}>
                              <td>
                                {fv.definition?.display_label || fv.field_key}
                                {isReq && <span className="required-star">*</span>}
                              </td>
                              <td className={isEmpty ? 'field-empty' : ''}>
                                {isEmpty ? 'Not recorded' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </td>
                              <td>
                                {fv.confidence && (
                                  <>
                                    <span className={`conf-dot conf-${fv.confidence}`} />
                                    {fv.confidence.charAt(0).toUpperCase() + fv.confidence.slice(1)}
                                  </>
                                )}
                              </td>
                              <td>
                                {fv.source_type && (
                                  <span className={`source-pill source-${fv.is_ai_generated ? 'ai' : 'manual'}`}>
                                    {fv.is_ai_generated ? 'AI' : 'Manual'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="row-actions">
                                  <span
                                    className="icon-btn"
                                    title="Edit field"
                                    onClick={() => handleEditField(fv)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    ✏️
                                  </span>
                                  <span
                                    className="icon-btn"
                                    title="Improve with AI"
                                    onClick={() => setActiveScreen('ai-suggestions')}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    ✨
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SCREEN 3: COMPLETENESS SCORE */}
      {activeScreen === 'completeness' && (
        <div className="screen active">
          <div className="page-header">
            <h1>Knowledge Completeness Score</h1>
            <div className="page-header-sub">{orgName} · Updated Today</div>
          </div>

          <div className="two-col">
            <div>
              <div className="gauge-wrap" style={{ textAlign: 'center', marginBottom: '24px' }}>
                <svg className="gauge-svg" width="220" height="130" viewBox="0 0 200 110">
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * completenessScore) / 100}
                  />
                  <text x="100" y="85" textAnchor="middle" className="gauge-text" style={{ fontSize: '28px', fontWeight: 700, fill: 'var(--navy)' }}>
                    {completenessScore}%
                  </text>
                  <text x="100" y="105" textAnchor="middle" className="gauge-sub" style={{ fontSize: '11px', fill: 'var(--slate)' }}>
                    {filledRequired.length} of {requiredFields.length} required fields
                  </text>
                </svg>
              </div>

              <div className="card" style={{ padding: '20px 24px' }}>
                <div className="quality-row">
                  <span className="conf-dot conf-high" style={{ width: '10px', height: '10px', borderRadius: '2px', marginRight: '8px' }} />
                  <div className="quality-label">High confidence fields</div>
                  <div className="quality-count">{highConfCount}</div>
                </div>
                <div className="quality-row">
                  <span className="conf-dot conf-moderate" style={{ width: '10px', height: '10px', borderRadius: '2px', marginRight: '8px' }} />
                  <div className="quality-label">Moderate confidence fields</div>
                  <div className="quality-count">{modConfCount}</div>
                </div>
                <div className="quality-row">
                  <span className="conf-dot conf-low" style={{ width: '10px', height: '10px', borderRadius: '2px', marginRight: '8px' }} />
                  <div className="quality-label">Low confidence fields</div>
                  <div className="quality-count">{lowConfCount}</div>
                </div>
                <div className="quality-row">
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--success)', marginRight: '8px', flexShrink: 0 }} />
                  <div className="quality-label">Human-verified fields</div>
                  <div className="quality-count">{humanVerifiedCount}</div>
                </div>
              </div>
            </div>

            <div>
              <div style={{ marginBottom: '16px', fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '14px' }}>
                Section Breakdown
              </div>
              {(Object.keys(OKH_SECTION_TITLES) as OkhSectionKey[]).map((secKey) => {
                const secFields = sectionGroups[secKey] || [];
                const secFilled = secFields.filter((f) => {
                  const v = f.value?.v !== undefined ? f.value.v : f.value;
                  return v !== null && v !== undefined && v !== '';
                }).length;
                const secPct = secFields.length > 0 ? Math.round((secFilled / secFields.length) * 100) : 0;

                return (
                  <div key={secKey} className="hbar-row">
                    <div className="hbar-label">{OKH_SECTION_TITLES[secKey]}</div>
                    <div className="hbar-track">
                      <div className="hbar-fill" style={{ width: `${secPct}%` }} />
                    </div>
                    <div className="hbar-pct">{secPct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 4: MISSING INFORMATION */}
      {activeScreen === 'missing' && (
        <div className="screen active">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Missing Information Report</h1>
              <div className="page-header-sub">
                {emptyCount} fields empty · {requiredFields.length - filledRequired.length} required
              </div>
            </div>
          </div>

          <div className="section-group-header">Required ({requiredFields.length - filledRequired.length})</div>
          {requiredFields
            .filter((f) => {
              const v = f.value?.v !== undefined ? f.value.v : f.value;
              return v === null || v === undefined || v === '';
            })
            .map((fv) => (
              <div key={fv.id} className="missing-row missing-required-bg">
                <div className="missing-field">
                  {fv.definition?.display_label || fv.field_key}
                  <span className="required-star">*</span>
                </div>
                <div className="missing-section-name">{OKH_SECTION_TITLES[fv.section_key]}</div>
                <div className="missing-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditField(fv)}>
                    Add
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveScreen('ai-suggestions')}>
                    ✨ AI
                  </button>
                </div>
              </div>
            ))}

          <div className="section-group-header" style={{ marginTop: '24px' }}>
            Optional ({emptyCount - (requiredFields.length - filledRequired.length)})
          </div>
          {fieldValues
            .filter((f) => !f.definition?.is_required)
            .filter((f) => {
              const v = f.value?.v !== undefined ? f.value.v : f.value;
              return v === null || v === undefined || v === '';
            })
            .slice(0, 15)
            .map((fv) => (
              <div key={fv.id} className="missing-row">
                <div className="missing-field">{fv.definition?.display_label || fv.field_key}</div>
                <div className="missing-section-name">{OKH_SECTION_TITLES[fv.section_key]}</div>
                <div className="missing-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditField(fv)}>
                    Add
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveScreen('ai-suggestions')}>
                    ✨ AI
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* SCREEN 5: CONFIDENCE HEAT MAP */}
      {activeScreen === 'heatmap' && (
        <div className="screen active">
          <div className="page-header">
            <h1>Confidence Heat Map</h1>
            <div className="page-header-sub">Every field coloured by data confidence</div>
          </div>

          <div className="heatmap-wrap" style={{ overflowX: 'auto' }}>
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Section</th>
                  <th className="hm-th">Core 1</th>
                  <th className="hm-th">Core 2</th>
                  <th className="hm-th">Core 3</th>
                  <th className="hm-th">Core 4</th>
                  <th className="hm-th">Core 5</th>
                  <th className="hm-th">Core 6</th>
                  <th className="hm-th">Core 7</th>
                  <th className="hm-th">Core 8</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(OKH_SECTION_TITLES) as OkhSectionKey[]).map((secKey) => {
                  const secFields = (sectionGroups[secKey] || []).slice(0, 8);
                  return (
                    <tr key={secKey}>
                      <td className="hm-section">{OKH_SECTION_TITLES[secKey]}</td>
                      {secFields.map((fv) => {
                        const v = fv.value?.v !== undefined ? fv.value.v : fv.value;
                        const isEmpty = v === null || v === undefined || v === '';
                        let cellClass = 'hm-empty';
                        if (!isEmpty) {
                          if (fv.confidence === 'high') cellClass = 'hm-high';
                          else if (fv.confidence === 'moderate') cellClass = 'hm-moderate';
                          else if (fv.confidence === 'low') cellClass = 'hm-low';
                          else cellClass = 'hm-manual';
                        }
                        return (
                          <td key={fv.id}>
                            <div
                              className={`hm-cell ${cellClass}`}
                              title={`${fv.definition?.display_label}: ${isEmpty ? 'Empty' : fv.confidence || 'Manual'}`}
                              onClick={() => handleEditField(fv)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        );
                      })}
                      {Array.from({ length: Math.max(0, 8 - secFields.length) }).map((_, i) => (
                        <td key={i}>
                          <div className="hm-cell hm-empty" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="legend" style={{ marginTop: '20px' }}>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--gold)' }} />
              High confidence
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--warning)' }} />
              Moderate confidence
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--danger)' }} />
              Low confidence
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--border)' }} />
              Empty
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: 'var(--navy2)' }} />
              Manual entry
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 6: RECOMMENDED IMPROVEMENTS */}
      {activeScreen === 'recommended' && (
        <div className="screen active">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Recommended Improvements</h1>
              <div className="page-header-sub">Prioritised actions to improve knowledge accuracy</div>
            </div>
            <button className="btn btn-secondary" onClick={loadHubData}>
              ↻ Refresh
            </button>
          </div>

          <div className="section-group-header">Impact: High</div>
          <div className="rec-card">
            <div className="rec-num">1</div>
            <div className="rec-body">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="rec-title">Fill Annual Revenue (AUD)</div>
                <span className="impact-badge impact-high">High</span>
              </div>
              <div className="rec-desc">
                Used by AI agents across proposals and pipeline forecasting. Without this field, agents cannot
                calibrate commercial scale accurately.
              </div>
              <div className="rec-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const f = fieldValues.find((x) => x.field_key === 'annual_revenue');
                    if (f) handleEditField(f);
                  }}
                >
                  Add Now
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveScreen('ai-suggestions')}>
                  ✨ Request AI
                </button>
              </div>
            </div>
          </div>

          <div className="rec-card">
            <div className="rec-num">2</div>
            <div className="rec-body">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="rec-title">Resolve Low Confidence on Industry Sector</div>
                <span className="impact-badge impact-high">High</span>
              </div>
              <div className="rec-desc">
                AI-inferred with no primary source document linked. Adding a reliable source document or confirming
                manually improves meeting briefs and email personalisation.
              </div>
              <div className="rec-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const f = fieldValues.find((x) => x.field_key === 'industry');
                    if (f) handleEditField(f);
                  }}
                >
                  View Field
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveScreen('ai-suggestions')}>
                  ✨ Improve
                </button>
              </div>
            </div>
          </div>

          <div className="section-group-header" style={{ marginTop: '24px' }}>Impact: Medium</div>
          <div className="rec-card">
            <div className="rec-num">3</div>
            <div className="rec-body">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="rec-title">Confirm Data Sharing & Recording Consent</div>
                <span className="impact-badge impact-medium">Medium</span>
              </div>
              <div className="rec-desc">
                Ensures governance alignment before generating automated client-facing summaries.
              </div>
              <div className="rec-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const f = fieldValues.find((x) => x.field_key === 'data_sharing_consent');
                    if (f) handleEditField(f);
                  }}
                >
                  Update Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 7: AI SUGGESTIONS */}
      {activeScreen === 'ai-suggestions' && (
        <div className="screen active">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>
                AI Suggestions{' '}
                {pendingProposals.length > 0 && (
                  <span className="badge" style={{ fontSize: '14px', padding: '2px 8px', verticalAlign: 'middle' }}>
                    {pendingProposals.length}
                  </span>
                )}
              </h1>
              <div className="page-header-sub">
                Review AI-generated values before they are saved to the hub
              </div>
            </div>
            {pendingProposals.length > 0 && (
              <button
                className="btn btn-gold"
                onClick={async () => {
                  for (const p of pendingProposals) {
                    await reviewProposal(p.id, 'accepted', undefined, actorId, actorName);
                  }
                  await loadHubData();
                }}
              >
                Accept All
              </button>
            )}
          </div>

          <div className="section-group-header">Pending ({pendingProposals.length})</div>
          {pendingProposals.length === 0 ? (
            <p style={{ color: 'var(--slate)', fontSize: '14px', padding: '16px 0' }}>
              No pending suggestions. All AI proposals have been reviewed.
            </p>
          ) : (
            pendingProposals.map((prop) => {
              const pv = prop.proposed_value?.v !== undefined ? prop.proposed_value.v : prop.proposed_value;
              return (
                <div key={prop.id} className="proposal-card">
                  <div className="proposal-header">
                    <div>
                      <div className="proposal-field">{prop.definition?.display_label || prop.field_key}</div>
                      <div className="proposal-section">{OKH_SECTION_TITLES[prop.section_key]}</div>
                    </div>
                    <span className={`freshness-badge freshness-${prop.confidence === 'high' ? 'current' : prop.confidence === 'moderate' ? 'ageing' : 'stale'}`}>
                      ● {prop.confidence} confidence
                    </span>
                  </div>
                  <div className="proposal-value-label">Suggested value</div>
                  <div className="proposal-value">{String(pv)}</div>
                  {prop.source_document && (
                    <div className="proposal-source">
                      📄 {prop.source_document} · {prop.source_type} · KAM Agent
                    </div>
                  )}
                  {prop.source_location && (
                    <div className="proposal-quote">"{prop.source_location}"</div>
                  )}
                  <div className="proposal-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleReviewProposal(prop.id, 'accepted')}
                    >
                      ✓ Accept
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const edited = prompt('Edit value before accepting:', String(pv));
                        if (edited !== null) {
                          handleReviewProposal(prop.id, 'edited', edited);
                        }
                      }}
                    >
                      ✏️ Edit & Accept
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleReviewProposal(prop.id, 'rejected')}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SCREEN 8: SOURCE EXPLORER */}
      {activeScreen === 'source-explorer' && (
        <div className="screen active">
          <div className="page-header">
            <h1>Source Explorer</h1>
            <div className="page-header-sub">Attributed sources across all filled knowledge fields</div>
          </div>

          <div className="accordion-item open">
            <div className="accordion-header">
              <span className="accordion-chevron">▶</span>
              <div className="accordion-title">Discovery Call & Transcripts</div>
              <div className="accordion-meta">
                <span className="source-type-pill st-meeting">Meeting</span>
                <span style={{ fontSize: '12px', color: 'var(--slate)', marginLeft: '8px' }}>
                  {fieldValues.filter((f) => f.source_type === 'meeting').length} fields
                </span>
              </div>
            </div>
            <div className="accordion-body" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '10px' }}>
                Fields sourced from meeting records:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {fieldValues
                  .filter((f) => f.source_type === 'meeting')
                  .map((f) => (
                    <span key={f.id} className="field-chip">
                      {f.definition?.display_label || f.field_key}
                    </span>
                  ))}
                {fieldValues.filter((f) => f.source_type === 'meeting').length === 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--slate)' }}>No meeting sources recorded yet.</span>
                )}
              </div>
            </div>
          </div>

          <div className="accordion-item open" style={{ marginTop: '16px' }}>
            <div className="accordion-header">
              <span className="accordion-chevron">▶</span>
              <div className="accordion-title">Manual User Entries</div>
              <div className="accordion-meta">
                <span className="source-type-pill st-manual">Manual</span>
                <span style={{ fontSize: '12px', color: 'var(--slate)', marginLeft: '8px' }}>
                  {fieldValues.filter((f) => !f.is_ai_generated && f.value !== null).length} fields
                </span>
              </div>
            </div>
            <div className="accordion-body" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '10px' }}>
                Fields directly entered by workspace members:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {fieldValues
                  .filter((f) => !f.is_ai_generated && f.value !== null)
                  .map((f) => (
                    <span key={f.id} className="field-chip">
                      {f.definition?.display_label || f.field_key}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 9: AUDIT HISTORY */}
      {activeScreen === 'audit' && (
        <div className="screen active">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Audit History</h1>
              <div className="page-header-sub">{auditLogs.length} immutable entries for {orgName}</div>
            </div>
          </div>

          <div className="audit-group-header">Recent Activity</div>
          {auditLogs.length === 0 ? (
            <p style={{ color: 'var(--slate)', fontSize: '14px', padding: '16px 0' }}>
              No audit entries recorded yet.
            </p>
          ) : (
            auditLogs.map((entry) => (
              <div key={entry.id} className="audit-row">
                <div className="audit-time">
                  {new Date(entry.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="audit-actor">{entry.actor_label}</div>
                <span className="audit-action-badge aa-updated">{entry.action.replace('_', ' ')}</span>
                <div className="audit-field">
                  {entry.field_key || 'Hub metadata'}
                  {entry.new_value && (
                    <div className="audit-diff">
                      → <ins>{JSON.stringify(entry.new_value)}</ins>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SCREEN 10: VERSION HISTORY */}
      {activeScreen === 'versions' && (
        <div className="screen active">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Version History</h1>
              <div className="page-header-sub">{versions.length} point-in-time snapshots saved</div>
            </div>
            <button className="btn btn-secondary" onClick={handleCaptureSnapshot}>
              📷 Capture Snapshot
            </button>
          </div>

          {versions.length === 0 ? (
            <p style={{ color: 'var(--slate)', fontSize: '14px', padding: '16px 0' }}>
              No version snapshots captured yet. Click "Capture Snapshot" to record the current baseline.
            </p>
          ) : (
            versions.map((ver, idx) => (
              <div key={ver.id} className="version-card">
                <div className="version-num">v{ver.version_number}</div>
                <div className="version-body">
                  <div className="version-name">{ver.capture_reason || 'Snapshot'}</div>
                  <div className="version-meta">
                    Captured on {new Date(ver.captured_at).toLocaleDateString('en-AU')} · Score: {ver.completeness_score}%
                  </div>
                  <div className="version-stats">
                    {Object.keys(ver.snapshot || {}).length} fields captured
                  </div>
                </div>
                <div className="version-actions">
                  {idx === 0 && <span className="current-badge">CURRENT</span>}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDiffVersion(ver)}
                  >
                    View Diff
                  </button>
                  {idx > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRestoreCandidate(ver)}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Field Modal / Slide-out */}
      {editingField && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(22, 38, 63, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              width: '480px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '18px', fontWeight: 600, color: 'var(--navy)', marginBottom: '8px' }}>
              Edit {editingField.definition?.display_label || editingField.field_key}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--slate)', marginBottom: '16px' }}>
              {editingField.definition?.description || 'Update the verified value for this organisation.'}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--slate)', marginBottom: '6px' }}>
                Value
              </label>
              {editingField.definition?.field_type === 'long_text' ? (
                <textarea
                  rows={4}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '14px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '14px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingField(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveField}>
                Save Value
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: toastType === 'error' ? '#EF4444' : toastType === 'success' ? '#22C55E' : 'var(--navy)',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toastType === 'error' ? <AlertCircle size={16} /> : <Sparkles size={16} />}
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '8px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Populate With AI Confirm Modal */}
      {showEnrichModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(22, 38, 63, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              width: '460px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '18px', fontWeight: 600, color: 'var(--navy)', marginBottom: '8px' }}>
              Populate Hub With AI
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: 1.5, marginBottom: '12px' }}>
              The KAM Agent will analyse available relationship records, notes, and documents to suggest structured values for empty and uncertain fields.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: 1.5, marginBottom: '16px' }}>
              Suggestions require your review before any values are saved to the hub.
            </p>
            <div style={{ backgroundColor: 'var(--light)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: 'var(--slate)', marginBottom: '20px' }}>
              Estimated time: 30 to 90 seconds
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowEnrichModal(false)} disabled={enriching}>
                Cancel
              </button>
              <button className="btn btn-gold" onClick={handleStartEnrichment} disabled={enriching}>
                {enriching ? 'Enriching...' : 'Start Enrichment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {diffVersion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(22, 38, 63, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '28px',
              width: '800px',
              maxWidth: '94vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '18px', fontWeight: 600, color: 'var(--navy)' }}>
                  Viewing Snapshot v{diffVersion.version_number} Diff
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--slate)' }}>
                  {diffVersion.capture_reason || 'Manual Snapshot'} | Captured {new Date(diffVersion.captured_at).toLocaleString('en-AU')}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setDiffVersion(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showUnchangedDiff}
                  onChange={(e) => setShowUnchangedDiff(e.target.checked)}
                />
                Show unchanged fields
              </label>
            </div>

            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Field</th>
                  <th style={{ width: '35%' }}>Then (v{diffVersion.version_number})</th>
                  <th style={{ width: '35%' }}>Now (Current Hub)</th>
                </tr>
              </thead>
              <tbody>
                {fieldValues.map((fv) => {
                  const snapField = diffVersion.snapshot?.[fv.field_key];
                  const thenVal = snapField?.value?.v !== undefined ? snapField.value.v : snapField?.value;
                  const nowVal = fv.value?.v !== undefined ? fv.value.v : fv.value;

                  const isDiff = JSON.stringify(thenVal) !== JSON.stringify(nowVal);
                  if (!isDiff && !showUnchangedDiff) return null;

                  return (
                    <tr
                      key={fv.id}
                      style={{
                        backgroundColor: isDiff ? '#FFFBEB' : 'transparent',
                        borderLeft: isDiff ? '3px solid var(--warning)' : 'none',
                      }}
                    >
                      <td style={{ fontWeight: 500, color: 'var(--navy)' }}>
                        {fv.definition?.display_label || fv.field_key}
                      </td>
                      <td style={{ color: thenVal !== null && thenVal !== undefined ? 'var(--text)' : 'var(--slate)' }}>
                        {thenVal !== null && thenVal !== undefined ? String(thenVal) : 'Not recorded'}
                      </td>
                      <td style={{ color: nowVal !== null && nowVal !== undefined ? 'var(--text)' : 'var(--slate)' }}>
                        {nowVal !== null && nowVal !== undefined ? String(nowVal) : 'Not recorded'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setDiffVersion(null)}>
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal */}
      {restoreCandidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(22, 38, 63, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              width: '460px',
              maxWidth: '90vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '18px', fontWeight: 600, color: 'var(--navy)', marginBottom: '8px' }}>
              Restore Snapshot v{restoreCandidate.version_number}?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: 1.5, marginBottom: '12px' }}>
              This will replace current field values with their state from {new Date(restoreCandidate.captured_at).toLocaleDateString('en-AU')}.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: 1.5, marginBottom: '20px' }}>
              An automatic snapshot of the current state will be captured before restoring.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setRestoreCandidate(null)} disabled={restoring}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmRestore} disabled={restoring}>
                {restoring ? 'Restoring...' : 'Restore Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
