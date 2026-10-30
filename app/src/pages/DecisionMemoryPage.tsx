import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import { fetchDecisions } from '../lib/decisions/decisionClient';
import { DecisionRecord } from '../lib/decisions/types';
import { PageHeader, ScopeBar, MetricCard, StatePanel, ProvenanceChip } from '../components/intel/IntelKit';
import {
  DecisionPeriod,
  DecisionScope,
  filterDecisions,
  formatDecisionDate,
  projectName,
  projectOptions,
  describeScope,
  undatedCount,
} from '../lib/intel/decisionMemoryView';
import '../styles/intel-bright.css';

/**
 * Decision Memory (Memory > Decisions).
 * One job: find what was decided, by whom, when, and why, with the source one click away.
 * Phase B template for the other Intelligence pages.
 *
 * Deliberately not shown: status, impact or "superseded" markers. The decision_memory
 * schema in the handover has no such columns, so showing them would invent them.
 * They return when the decision-status migration is approved and run.
 */
export const DecisionMemoryPage: React.FC = () => {
  const { supabase } = useAuth();
  const featureAccess = useFeatureAccess('decision_memory');

  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<DecisionScope>('all');
  const [period, setPeriod] = useState<DecisionPeriod>('all');
  const [projectId, setProjectId] = useState<string>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!featureAccess.isAllowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await fetchDecisions(supabase, { workspaceScope: scope });
    if (fetchErr) {
      setError(fetchErr.message || 'The decisions could not be loaded.');
      setDecisions([]);
    } else {
      setDecisions(data || []);
    }
    setLoading(false);
  }, [supabase, featureAccess.isAllowed, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const filters = useMemo(() => ({ query, period, projectId }), [query, period, projectId]);
  const shown = useMemo(() => filterDecisions(decisions, filters), [decisions, filters]);
  const projects = useMemo(() => projectOptions(decisions), [decisions]);
  const withReasoning = useMemo(() => shown.filter((d) => d.decision_reasoning).length, [shown]);
  const withOwner = useMemo(() => shown.filter((d) => d.decision_owner).length, [shown]);

  // A project filter can outlive its data after a scope change. Reset it rather than show an empty list.
  useEffect(() => {
    if (projectId !== 'all' && !projects.some((p) => p.id === projectId)) setProjectId('all');
  }, [projects, projectId]);

  const header = (
    <PageHeader
      title="Decision Memory"
      purpose="What was decided, by whom, when and why. Each entry links back to the project it came from."
      crumbs={[{ label: 'Memory' }, { label: 'Decisions' }]}
    />
  );

  if (!featureAccess.isAllowed) {
    return (
      <div className="ib">
        {header}
        <StatePanel
          kind="denied"
          title="Decision Memory is not part of your current plan"
          body="It is included in the Pro subscription. Prices are indicative until validated with real buyers."
          action={
            <Link className="ib-btn ib-btn--primary" to="/dashboard">
              Back to dashboard
            </Link>
          }
        />
      </div>
    );
  }

  const projectLabel = projectId === 'all' ? null : projects.find((p) => p.id === projectId)?.name || null;

  return (
    <div className="ib">
      {header}

      <ScopeBar
        summary={
          loading
            ? 'waiting for the decisions to load'
            : error
            ? 'nothing yet, because the decisions did not load'
            : describeScope({
                shown: shown.length,
                total: decisions.length,
                scope,
                period,
                query,
                projectLabel,
                undated: undatedCount(decisions, filters),
              })
        }
      >
        <div className="ib-field ib-field--grow">
          <label className="ib-label" htmlFor="dm-search">Search</label>
          <input
            id="dm-search"
            className="ib-input"
            type="search"
            placeholder="Title, summary, reasoning or owner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="ib-field">
          <label className="ib-label" htmlFor="dm-scope">Whose decisions</label>
          <select id="dm-scope" className="ib-select" value={scope} onChange={(e) => setScope(e.target.value as DecisionScope)}>
            <option value="all">Mine and my teams</option>
            <option value="personal">Personal only</option>
            <option value="team">Team only</option>
          </select>
        </div>
        <div className="ib-field">
          <label className="ib-label" htmlFor="dm-period">Decided in</label>
          <select id="dm-period" className="ib-select" value={period} onChange={(e) => setPeriod(e.target.value as DecisionPeriod)}>
            <option value="all">All dates</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 12 months</option>
          </select>
        </div>
        <div className="ib-field">
          <label className="ib-label" htmlFor="dm-project">Project</label>
          <select id="dm-project" className="ib-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </ScopeBar>

      {loading && <StatePanel kind="loading" title="Loading decisions" />}

      {!loading && error && (
        <StatePanel
          kind="error"
          title="The decisions could not be loaded"
          body={error}
          action={<button type="button" className="ib-btn" onClick={load}>Try again</button>}
        />
      )}

      {!loading && !error && decisions.length === 0 && (
        <StatePanel
          kind="empty"
          title="No decisions saved yet"
          body="Decisions appear here once you save them from a Decision Log on a project."
          action={<Link className="ib-btn ib-btn--primary" to="/projects">Go to projects</Link>}
        />
      )}

      {!loading && !error && decisions.length > 0 && shown.length === 0 && (
        <StatePanel
          kind="empty"
          title="Nothing matches these filters"
          body="Widen the period, clear the search, or choose all projects."
          action={
            <button
              type="button"
              className="ib-btn"
              onClick={() => {
                setQuery('');
                setPeriod('all');
                setProjectId('all');
              }}
            >
              Clear filters
            </button>
          }
        />
      )}

      {!loading && !error && shown.length > 0 && (
        <>
          <section className="ib-summary" aria-label="Summary of what is shown">
            <MetricCard label="Decisions shown" value={shown.length} />
            <MetricCard
              label="With reasoning recorded"
              value={`${withReasoning} of ${shown.length}`}
              note="Counts the records that explain why."
            />
            <MetricCard
              label="With an owner named"
              value={`${withOwner} of ${shown.length}`}
              note="Counts the records that name who decided."
            />
          </section>

          <ul className="ib-list" aria-label="Decisions">
            {shown.map((d) => (
              <li key={d.id} className="ib-card">
                <div className="ib-card__meta">
                  <ProvenanceChip kind="recorded" />
                  <span>{formatDecisionDate(d.decision_date)}</span>
                  <span>Owner: {d.decision_owner || 'not recorded'}</span>
                  <span>{d.ownership_type === 'team' ? 'Team' : 'Personal'}</span>
                </div>
                <h2 className="ib-card__title">
                  <Link to={`/decision-memory/${d.id}`}>{d.decision_title}</Link>
                </h2>
                {d.decision_summary && <p className="ib-card__body">{d.decision_summary}</p>}
                {d.decision_reasoning ? (
                  <div className="ib-why"><strong>Why: </strong>{d.decision_reasoning}</div>
                ) : (
                  <div className="ib-why"><strong>Why: </strong>No reasoning was recorded for this decision.</div>
                )}
                <div className="ib-card__foot">
                  <span>
                    Source: {projectName(d)}
                    {d.source_output_id ? ', from a saved output' : ''}
                  </span>
                  <Link className="ib-link" to={`/projects/${d.project_id}`}>Open project</Link>
                </div>
              </li>
            ))}
          </ul>
          <p className="ib-note">
            This page shows saved records only. It does not rank decisions or score the people who made them.
          </p>
        </>
      )}
    </div>
  );
};
