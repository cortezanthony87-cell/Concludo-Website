import React, { useEffect, useState } from 'react';
import { PageHeader, StatePanel, MetricCard, ProvenanceChip } from '../components/intel/IntelKit';
import { cleanInsight, InsightLike } from '../lib/intel/insightView';
import '../styles/intel-bright.css';

/**
 * Insight > Insight. Counts from saved projects, decisions and actions.
 * Not shown: a health figure, canned opportunities, per-person rankings.
 * `loader(refresh)` is passed by the route (fetchUserInsights or fetchTeamInsights for the chosen scope).
 */
export const InsightOverviewPage: React.FC<{ loader: (refresh: boolean) => Promise<InsightLike>; initial?: InsightLike }> = ({ loader, initial }) => {
  const [data, setData] = useState<InsightLike | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = (refresh: boolean) => {
    setBusy(true); setError(null);
    loader(refresh).then(setData).catch(() => setError('Insight could not be loaded. Try again shortly.')).finally(() => setBusy(false));
  };
  useEffect(() => { if (!initial) run(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loader]);

  const v = data ? cleanInsight(data) : null;
  return (
    <div>
      <PageHeader
        title="Insight"
        purpose="What the saved projects, decisions and actions say."
        actions={<button type="button" className="ib-btn" disabled={busy} onClick={() => run(true)}>{busy ? 'Recalculating' : 'Recalculate'}</button>}
      />
      {error && <StatePanel kind="error" title="Could not load" body={error} />}
      {!error && !v && <StatePanel kind="loading" title="Loading insight" />}
      {v && !v.hasEnoughHistory && <StatePanel kind="empty" title="No saved projects yet" body="Insight appears once projects, decisions and actions are saved." />}
      {v && v.hasEnoughHistory && (
        <>
          <p className="ib-note">{v.calculated} <ProvenanceChip kind="recorded" /></p>
          <div className="ib-metrics">
            <MetricCard label="Projects" value={v.projects} />
            <MetricCard label="Open actions" value={v.open.totalOpen} note={`${v.open.notStarted} not started, ${v.open.inProgress} in progress, ${v.open.blocked} blocked`} />
            <MetricCard label="Overdue actions" value={v.overdueCount} note={v.overdueOfOpen.ok ? `${v.overdueOfOpen.value.numerator} of ${v.overdueOfOpen.value.denominator} open (${v.overdueOfOpen.value.percent}%)` : v.overdueOfOpen.reason} />
          </div>
          {v.risks.length > 0 && (
            <section className="ib-card" aria-label="Risks from the records">
              <h2 className="ib-card__title">Risks from the records</h2>
              <ul>{v.risks.map((r) => (<li key={r.id}><strong>{r.title}</strong> <ProvenanceChip kind="recorded" /> {r.description}{r.mitigationRecommendation && <> <ProvenanceChip kind="suggested" /> {r.mitigationRecommendation}</>}</li>))}</ul>
            </section>
          )}
          {v.decisions.length > 0 && (
            <section className="ib-card" aria-label="Recent decisions">
              <h2 className="ib-card__title">Recent decisions</h2>
              <ul>{v.decisions.map((d) => (<li key={d.id}>{d.title}{d.date ? `, ${d.date.slice(0, 10)}` : ''}</li>))}</ul>
            </section>
          )}
          {v.topics.length > 0 && (
            <section className="ib-card" aria-label="Names that appear most">
              <h2 className="ib-card__title">Names that appear most in your projects</h2>
              <ul>{v.topics.map((t) => (<li key={t.topic}>{t.topic}: {t.mentions}</li>))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
