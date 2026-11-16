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

const mockActionRows = [
  { id: '1', title: 'Complete ASIC director identification verification', status: 'overdue', priority: 'high', dueDate: '2026-11-02', owner: 'Anthony Cortez', project: 'Governance' },
  { id: '2', title: 'Review Q4 financial model and bank reconciliations', status: 'overdue', priority: 'high', dueDate: '2026-11-05', owner: 'Anthony Cortez', project: 'Finance' },
  { id: '3', title: 'Execute customer feedback interview round 2', status: 'overdue', priority: 'medium', dueDate: '2026-11-08', owner: 'Anthony Cortez', project: 'Customer Ops' },
  { id: '4', title: 'Finalise Concludo Meeting Mastery workbook distribution plan', status: 'overdue', priority: 'high', dueDate: '2026-11-10', owner: 'Anthony Cortez', project: 'Commercial' },
  { id: '5', title: 'Submit Stripe live account verification documents', status: 'due_today', priority: 'high', dueDate: '2026-11-16', owner: 'Anthony Cortez', project: 'Billing' },
  { id: '6', title: 'Prepare board meeting governance slide deck', status: 'upcoming', priority: 'medium', dueDate: '2026-11-20', owner: 'Anthony Cortez', project: 'Operations' },
  { id: '7', title: 'Conduct website security audit checklist review', status: 'upcoming', priority: 'low', dueDate: '2026-11-25', owner: 'Anthony Cortez', project: 'Security' },
  { id: '8', title: 'Draft enterprise pilot terms of service agreement', status: 'unscheduled', priority: 'normal', dueDate: 'Not set', owner: 'Anthony Cortez', project: 'Legal' },
];

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

        {/* Action Items List Table */}
        <div id="ach-actions-table" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #D5DBE6', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '18px', color: '#16263F' }}>
              Action items ({mockActionRows.length})
            </div>
            <div style={{ fontSize: '14px', color: '#5A6478' }}>
              Filter: {state.activeFilter || state.activeTab}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Action item</th>
                <th style={{ padding: '12px 16px', width: '100px' }}>Priority</th>
                <th style={{ padding: '12px 16px', width: '120px' }}>Due date</th>
                <th style={{ padding: '12px 16px', width: '140px' }}>Assignee</th>
                <th style={{ padding: '12px 16px', width: '120px' }}>Project</th>
              </tr>
            </thead>
            <tbody>
              {mockActionRows
                .filter((row) => {
                  if (state.activeFilter === 'overdue' || state.activeTab === 'overdue') return row.status === 'overdue';
                  if (state.activeFilter === 'due_today' || state.activeTab === 'due_today') return row.status === 'due_today';
                  if (state.activeFilter === 'upcoming' || state.activeTab === 'upcoming') return row.status === 'upcoming';
                  if (state.activeFilter === 'unscheduled' || state.activeTab === 'unscheduled') return row.status === 'unscheduled';
                  return true;
                })
                .map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: row.status === 'overdue' ? '#FF5A6E' : row.status === 'due_today' ? '#FFC83D' : row.status === 'upcoming' ? '#3D7BE0' : '#8A94A6',
                      }} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1E293B' }}>{row.title}</td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{row.priority}</td>
                    <td style={{ padding: '12px 16px', color: row.status === 'overdue' ? '#DC2626' : row.status === 'due_today' ? '#D97706' : '#64748B' }}>
                      {row.dueDate}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{row.owner}</td>
                    <td style={{ padding: '12px 16px', color: '#64748B' }}>{row.project}</td>
                  </tr>
                ))}
            </tbody>
          </table>
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
