import React, { useEffect, useState } from 'react';
import { PageHeader, StatePanel, MetricCard, ProvenanceChip } from '../components/intel/IntelKit';
import { cleanStats, StatsLike } from '../lib/intel/insightView';
import '../styles/intel-bright.css';

/** Insight > Stats. Totals, and rates only with at least 5 records. No member participation table. */
export const StatsOverviewPage: React.FC<{ loader: () => Promise<StatsLike>; initial?: StatsLike }> = ({ loader, initial }) => {
  const [data, setData] = useState<StatsLike | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (initial) return; loader().then(setData).catch(() => setError('Stats could not be loaded. Try again shortly.')); }, [loader]);
  const v = data ? cleanStats(data) : null;
  return (
    <div>
      <PageHeader title="Stats" purpose="Counts across the saved records." />
      {error && <StatePanel kind="error" title="Could not load" body={error} />}
      {!error && !v && <StatePanel kind="loading" title="Loading stats" />}
      {v && (
        <>
          <p className="ib-note">{v.calculated} <ProvenanceChip kind="recorded" /></p>
          <div className="ib-metrics">
            <MetricCard label="Projects" value={v.totals.projects} />
            <MetricCard label="Decisions" value={v.totals.decisions} />
            <MetricCard label="Actions" value={v.totals.actions} note={`${v.totals.completed} completed, ${v.totals.open} open`} />
            <MetricCard label="Completion" value={v.completion.ok ? `${v.completion.value.percent}%` : 'Not enough evidence yet'} note={v.completion.ok ? `${v.completion.value.numerator} of ${v.completion.value.denominator} actions` : v.completion.reason} />
            <MetricCard label="Overdue of open" value={v.overdueOfOpen.ok ? `${v.overdueOfOpen.value.percent}%` : 'Not enough evidence yet'} note={v.overdueOfOpen.ok ? `${v.overdueOfOpen.value.numerator} of ${v.overdueOfOpen.value.denominator} open` : v.overdueOfOpen.reason} />
          </div>
        </>
      )}
    </div>
  );
};
