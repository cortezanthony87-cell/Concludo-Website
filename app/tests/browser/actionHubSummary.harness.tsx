import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionHubSummary, SummaryFilterKey } from '../../src/components/actions/ActionHubSummary';
import { ActionBucketCounts } from '../../src/lib/actions/actionBuckets';
import { ActionHubSummaryThemeKey } from '../../src/components/actions/actionHubSummaryTheme';
import '../../src/styles/action-hub-summary.css';

// Director's real 102 actions baseline
const baselineCounts: ActionBucketCounts = {
  total: 102,
  overdue: 37,
  dueToday: 1,
  upcoming: 18,
  unscheduled: 46,
  pending: 64,
  inProgress: 0,
  waiting: 0,
  blocked: 0,
  completed: 0,
};

interface HarnessState {
  bucketCounts: ActionBucketCounts;
  themeKey: ActionHubSummaryThemeKey;
  activeFilter: SummaryFilterKey;
  loading: boolean;
  error: string | null;
  scope: 'my' | 'all';
  activeTab: string;
}

const defaultState: HarnessState = {
  bucketCounts: baselineCounts,
  themeKey: 'mix',
  activeFilter: null,
  loading: false,
  error: null,
  scope: 'my',
  activeTab: 'my',
};

const HarnessApp: React.FC = () => {
  const [state, setState] = useState<HarnessState>(defaultState);

  // Expose state controller to test runner
  (window as any).__setHarnessState = (partial: Partial<HarnessState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };
  (window as any).__getHarnessState = () => state;

  const handleSelectFilter = (filterKey: SummaryFilterKey) => {
    setState((prev) => {
      let nextTab = prev.activeTab;
      if (!filterKey) {
        if (['overdue', 'due_today', 'upcoming', 'unscheduled', 'completed'].includes(prev.activeTab)) {
          nextTab = prev.scope === 'my' ? 'my' : 'all';
        }
      } else if (filterKey === 'overdue') nextTab = 'overdue';
      else if (filterKey === 'due_today') nextTab = 'due_today';
      else if (filterKey === 'upcoming') nextTab = 'upcoming';
      else if (filterKey === 'unscheduled') nextTab = 'unscheduled';
      else if (filterKey === 'completed') nextTab = 'completed';

      return {
        ...prev,
        activeFilter: filterKey,
        activeTab: nextTab,
      };
    });
  };

  return (
    <div style={{ margin: 0, background: '#F4F6FA', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', color: '#16263F', minHeight: '100vh' }}>
      <div style={{ boxSizing: 'border-box', maxWidth: '1480px', margin: '0 auto', padding: '32px 40px 40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'Poppins, Arial, sans-serif', fontWeight: 700, fontSize: '40px', lineHeight: 1.1, color: '#16263F' }}>
              Action Command Hub
            </h1>
            <div style={{ marginTop: '6px', fontSize: '16px', color: '#5A6478' }}>
              Scope: {state.scope === 'my' ? 'My Actions' : 'All permitted actions'}. Timezone: Australia/Melbourne. Showing live verified records.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button type="button" style={{ minHeight: '44px', boxSizing: 'border-box', padding: '0 20px', display: 'flex', alignItems: 'center', border: '1px solid #D5DBE6', borderRadius: '10px', background: '#fff', fontWeight: 500, fontSize: '16px', cursor: 'pointer' }}>
              Import register
            </button>
            <button
              type="button"
              id="scope-switch-btn"
              onClick={() => {
                const nextScope = state.scope === 'my' ? 'all' : 'my';
                setState((prev) => ({ ...prev, scope: nextScope, activeTab: nextScope }));
              }}
              style={{ minHeight: '44px', boxSizing: 'border-box', padding: '0 20px', display: 'flex', alignItems: 'center', border: '1px solid #D5DBE6', borderRadius: '10px', background: '#fff', fontWeight: 500, fontSize: '16px', cursor: 'pointer' }}
            >
              {state.scope === 'my' ? 'My Actions' : 'All permitted actions'}
            </button>
            <button type="button" style={{ minHeight: '44px', boxSizing: 'border-box', padding: '0 22px', display: 'flex', alignItems: 'center', borderRadius: '10px', background: '#E2B53C', color: '#16263F', fontWeight: 600, fontSize: '16px', border: 'none', cursor: 'pointer' }}>
              + Create new item
            </button>
          </div>
        </div>

        {/* Summary Component */}
        <ActionHubSummary
          bucketCounts={state.bucketCounts}
          activeFilter={state.activeFilter}
          onSelectFilter={handleSelectFilter}
          loading={state.loading}
          error={state.error}
          onRetry={() => setState((prev) => ({ ...prev, error: null, loading: false }))}
          themeKey={state.themeKey}
        />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '28px', alignItems: 'center', borderBottom: '1px solid #D5DBE6', paddingBottom: '12px', fontSize: '16px', color: '#5A6478', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: state.activeTab === 'my' ? 600 : 400, color: state.activeTab === 'my' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'my' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            My Actions
          </span>
          <span style={{ fontWeight: state.activeTab === 'all' ? 600 : 400, color: state.activeTab === 'all' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'all' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            All permitted actions
          </span>
          <span style={{ fontWeight: state.activeTab === 'due_today' ? 600 : 400, color: state.activeTab === 'due_today' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'due_today' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            Due today
          </span>
          <span style={{ fontWeight: state.activeTab === 'overdue' ? 600 : 400, color: state.activeTab === 'overdue' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'overdue' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            Overdue
          </span>
          <span style={{ fontWeight: state.activeTab === 'upcoming' ? 600 : 400, color: state.activeTab === 'upcoming' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'upcoming' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            Upcoming
          </span>
          <span style={{ fontWeight: state.activeTab === 'unscheduled' ? 600 : 400, color: state.activeTab === 'unscheduled' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'unscheduled' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            Unscheduled
          </span>
          <span style={{ fontWeight: state.activeTab === 'completed' ? 600 : 400, color: state.activeTab === 'completed' ? '#16263F' : '#5A6478', borderBottom: state.activeTab === 'completed' ? '3px solid #E2B53C' : 'none', paddingBottom: '9px' }}>
            Completed
          </span>
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<HarnessApp />);
}
