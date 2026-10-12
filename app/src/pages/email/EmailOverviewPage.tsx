/**
 * Overview. The prioritised dashboard.
 *
 * Panel order follows the brief. On a phone the five priority panels come
 * first, which is a CSS order change rather than a different component tree.
 */
import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { MetricCardGrid } from '../../components/email/MetricCard';
import { DashboardPanel } from '../../components/email/DashboardPanel';
import { syntheticMetrics, syntheticPanels } from '../../lib/email/shellAdapter';
import { AsyncState, EmailPanelKey } from '../../lib/email/types';

/** Panels kept above the fold on a phone, per the brief. */
const PRIORITY_PANELS: readonly EmailPanelKey[] = [
  'handle_first',
  'reply_queue',
  'todays_workload',
  'quick_wins',
  'waiting_on_others',
];

/** Labels for the review controls. Written out so no raw state key reaches a
 *  button face. */
const DEMO_STATE_LABEL: Record<AsyncState, string> = {
  ready: 'With data',
  loading: 'Loading',
  empty: 'Nothing to show',
  error: 'Error',
};

export const EmailOverviewPage: React.FC = () => {
  const { accountId, refreshToken, linkTo } = useOutletContext<EmailModuleContext>();

  // Stage 2 has no data source, so the state is explicit and switchable. This
  // is how the loading, empty and error states are demonstrated and reviewed.
  const [demoState, setDemoState] = useState<AsyncState>('ready');

  const metrics = useMemo(
    () => syntheticMetrics(accountId, demoState),
    [accountId, demoState, refreshToken]
  );
  const panels = useMemo(
    () => syntheticPanels(accountId, demoState),
    [accountId, demoState, refreshToken]
  );

  return (
    <>
      <MetricCardGrid metrics={metrics} linkTo={linkTo} />

      <div className="ecc-panel-grid">
        {panels.map((panel) => (
          <DashboardPanel
            key={panel.key}
            panel={panel}
            linkTo={linkTo}
            priority={PRIORITY_PANELS.includes(panel.key)}
            onRetry={() => setDemoState('ready')}
          />
        ))}
      </div>

      <section className="ecc-demo-switch" aria-labelledby="ecc-demo-heading">
        <h2 id="ecc-demo-heading" className="ecc-demo-title">
          Review controls
        </h2>
        <p className="ecc-demo-note">
          Stage 2 ships the shell with synthetic data and no mailbox connection. These buttons
          switch every card and panel between its states so each one can be reviewed. They are
          removed when a real source is connected.
        </p>
        <div className="ecc-demo-buttons" role="group" aria-label="Demonstration state">
          {(['ready', 'loading', 'empty', 'error'] as AsyncState[]).map((state) => (
            <button
              key={state}
              type="button"
              className={demoState === state ? 'btn-secondary ecc-demo-active' : 'btn-secondary'}
              aria-pressed={demoState === state}
              onClick={() => setDemoState(state)}
            >
              {DEMO_STATE_LABEL[state]}
            </button>
          ))}
        </div>
      </section>
    </>
  );
};
