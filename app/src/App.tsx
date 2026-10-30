import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicAuthRoute } from './components/PublicAuthRoute';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { ScrollToTop } from './components/ScrollToTop';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { MeetingOutputPage } from './pages/MeetingOutputPage';
import { SearchPage } from './pages/SearchPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { RecentlyDeletedPage } from './pages/RecentlyDeletedPage';
import { DecisionMemoryPage } from './pages/DecisionMemoryPage';
import { DecisionDetailPage } from './pages/DecisionDetailPage';
import { ActionsPage } from './pages/ActionsPage';
import { ActionDetailPage } from './pages/ActionDetailPage';
import { InsightPage } from './pages/InsightPage';
import { StatsPage } from './pages/StatsPage';
import { EndpointReportPage } from './pages/EndpointReportPage';
import { ConnectionTestPage } from './pages/ConnectionTestPage';
import { TeamDashboardPage } from './pages/TeamDashboardPage';
import { CreateTeamPage } from './pages/CreateTeamPage';
import { TeamSettingsPage } from './pages/TeamSettingsPage';
import { AdminPortalPage } from './pages/admin/AdminPortalPage';

// Tasklet 18 Integrations, Automation & Connectivity Pages
import { IntegrationsPage } from './pages/integrations/IntegrationsPage';
import { ConnectProviderPage } from './pages/integrations/ConnectProviderPage';
import { IntegrationHistoryPage } from './pages/integrations/IntegrationHistoryPage';
import { OAuthCallbackPage } from './pages/integrations/OAuthCallbackPage';
import { AutomationExportPage } from './pages/automation/AutomationExportPage';
import { WebhooksPage } from './pages/automation/WebhooksPage';
import { ApiAccessPage } from './pages/api/ApiAccessPage';

// Tasklet 19 AI Agents, Workflow Orchestration & Approvals Pages
import { AgentsPage } from './pages/agents/AgentsPage';
import { AgentDashboardPage } from './pages/agents/AgentDashboardPage';
import { WorkflowsPage } from './pages/workflows/WorkflowsPage';
import { WorkflowBuilderPage } from './pages/workflows/WorkflowBuilderPage';
import { ConnectorCentrePage } from './pages/workflows/ConnectorCentrePage';
import { WorkflowGovernancePage } from './pages/workflows/WorkflowGovernancePage';
import { WorkflowRunsPage } from './pages/workflows/WorkflowRunsPage';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage';
import { useParams } from 'react-router-dom';

{/* Legacy /workflows/:id redirect to /workflows/builder/:id */}
function WorkflowLegacyRedirect() {
  const { id } = useParams<{ id: string }>();
  if (id === 'builder' || id === 'runs' || id === 'governance') {
    return <Navigate to={`/workflows/${id}`} replace />;
  }
  return <Navigate to={`/workflows/builder/${id}`} replace />;
}

// Tasklet 20 Predictive Intelligence, Strategy & Executive Briefing Pages
import { PredictiveIntelligencePage } from './pages/predictive/PredictiveIntelligencePage';
import { ExecutiveIntelligencePage } from './pages/predictive/ExecutiveIntelligencePage';
import { ForecastsPage } from './pages/predictive/ForecastsPage';
import { ExecutiveBriefingsPage } from './pages/predictive/ExecutiveBriefingsPage';

// Tasklet 21 Knowledge Network & Memory Pages (Phase B Intel Bright System)
import { MemoryExplorePage } from './pages/MemoryExplorePage';
import { MemoryLessonsPage } from './pages/MemoryLessonsPage';
import { MemoryTimelinePage } from './pages/MemoryTimelinePage';
import { KnowledgeAnalyticsPage } from './pages/knowledge/KnowledgeAnalyticsPage';

// Tasklet 22 Concludo Copilot & Conversational Intelligence Page
import { CopilotPage } from './pages/copilot/CopilotPage';

// Tasklet 23 Strategic Operations (Phase B Honest Unavailable State Gates)
import {
  ExecutiveCommandCentrePage,
  EnterprisePerformancePage,
  ExecutiveBriefingCentrePage,
  DigitalTwinUnavailablePage,
  ScenarioModellingUnavailablePage,
} from './pages/UnavailablePages';

// Email Command Centre
import { EmailModuleLayout } from './components/email/EmailModuleLayout';
import { EMAIL_ROUTES, EMAIL_DETAIL_ROUTES } from './pages/email/emailRouteTable';

// Concludo CRM
import { CrmModuleLayout } from './components/crm/CrmModuleLayout';
import { CRM_ROUTES, CRM_DETAIL_ROUTES } from './pages/crm/crmRouteTable';
import { CommHubPage } from './pages/crm/hub/CommHubPage';
import { activeRedirects } from './lib/workspace/legacyRedirects';
import { MERGED_PAGES_READY } from './lib/workspace/workspaceNav';

// Billing & Checkout Pages
import { CheckoutPage } from './pages/CheckoutPage';
import { CheckoutSuccessPage } from './pages/billing/CheckoutSuccessPage';
import { CheckoutCancelPage } from './pages/billing/CheckoutCancelPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        {/* Public Home Route (renders HomePage or redirects to /dashboard if logged in) */}
        <Route path="/" element={<HomePage />} />

        {/* Public auth routes with session redirect */}
        <Route
          path="/login"
          element={
            <PublicAuthRoute>
              <LoginPage />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicAuthRoute>
              <SignupPage />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicAuthRoute>
              <ForgotPasswordPage />
            </PublicAuthRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Checkout & Billing Routes (Accessible publicly or with auth) */}
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/pricing" element={<Navigate to="/checkout" replace />} />
        <Route path="/billing/success" element={<CheckoutSuccessPage />} />
        <Route path="/billing/cancel" element={<CheckoutCancelPage />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />

            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/meeting-output" element={<MeetingOutputPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/deleted" element={<RecentlyDeletedPage />} />
            <Route path="/decision-memory" element={<DecisionMemoryPage />} />
            <Route path="/decision-memory/:id" element={<DecisionDetailPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/actions/:id" element={<ActionDetailPage />} />
            <Route path="/insight" element={<InsightPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/endpoint-report" element={<EndpointReportPage />} />
            <Route path="/endpoint-report/:id" element={<EndpointReportPage />} />

            {/* Team Workspace Routes */}
            <Route path="/team" element={<TeamDashboardPage />} />
            <Route path="/team/create" element={<CreateTeamPage />} />
            <Route path="/team/settings" element={<TeamSettingsPage />} />

            {/* Enterprise Admin, Audit, Compliance & Security Routes */}
            <Route path="/admin" element={<AdminPortalPage initialTab="overview" />} />
            <Route path="/admin/audit" element={<AdminPortalPage initialTab="audit" />} />
            <Route path="/admin/compliance" element={<AdminPortalPage initialTab="compliance" />} />
            <Route path="/admin/security" element={<AdminPortalPage initialTab="security" />} />

            {/* Tasklet 18 Integration, Automation & Public API Routes */}
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/integrations/connect/:providerId" element={<ConnectProviderPage />} />
            <Route path="/integrations/history" element={<IntegrationHistoryPage />} />
            <Route path="/integrations/callback" element={<OAuthCallbackPage />} />
            <Route path="/automation-export" element={<AutomationExportPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
            <Route path="/api" element={<ApiAccessPage />} />

            {/* Tasklet 19 AI Agents, Workflows & Approvals Routes */}
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/dashboard" element={<Navigate to="/agents" replace />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/workflows/builder/new" element={<WorkflowBuilderPage isNew />} />
            <Route path="/workflows/builder/:id" element={<WorkflowBuilderPage />} />
            <Route path="/workflows/builder" element={<Navigate to="/workflows/builder/new" replace />} />
            <Route path="/workflows/governance" element={<WorkflowGovernancePage />} />
            <Route path="/workflows/runs" element={<WorkflowRunsPage />} />
            <Route path="/workflows/runs/:id" element={<WorkflowRunsPage />} />
            <Route path="/connections" element={<ConnectorCentrePage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/approvals/:id" element={<ApprovalsPage />} />
            <Route path="/workflows/:id" element={<WorkflowLegacyRedirect />} />

            {/* Tasklet 20 Predictive Intelligence, Strategy & Executive Briefing Routes */}
            <Route path="/predictive-intelligence" element={<PredictiveIntelligencePage />} />
            <Route path="/executive-intelligence" element={<ExecutiveIntelligencePage />} />
            <Route path="/forecasts" element={<ForecastsPage />} />
            <Route path="/executive-briefings" element={<ExecutiveBriefingsPage />} />

            {/* Tasklet 21 Memory & Knowledge Routes (Phase B Bright System) */}
            <Route path="/knowledge" element={<MemoryExplorePage />} />
            <Route path="/memory/explore" element={<MemoryExplorePage />} />
            <Route path="/organizational-memory" element={<MemoryLessonsPage />} />
            <Route path="/memory/lessons" element={<MemoryLessonsPage />} />
            <Route path="/knowledge/timeline" element={<MemoryTimelinePage />} />
            <Route path="/memory/timeline" element={<MemoryTimelinePage />} />
            <Route path="/executive-explorer" element={<Navigate to="/knowledge" replace />} />
            <Route path="/knowledge-analytics" element={<KnowledgeAnalyticsPage />} />

            {/* Tasklet 22 Concludo Copilot Route */}
            <Route path="/copilot" element={<CopilotPage />} />

            {/* Tasklet 23 Strategic Operations (Phase B Fail-Closed Honest Gates) */}
            <Route path="/digital-twin" element={<DigitalTwinUnavailablePage />} />
            <Route path="/executive-command-center" element={<ExecutiveCommandCentrePage />} />
            <Route path="/scenario-modeling" element={<ScenarioModellingUnavailablePage />} />
            <Route path="/performance" element={<EnterprisePerformancePage />} />
            <Route path="/executive-center" element={<ExecutiveBriefingCentrePage />} />

            {/* Email Command Centre. One parent, eleven children, generated
                from the same destination list the tab row reads, so a tab can
                never point at a route that does not exist. */}
            <Route path="/email" element={<EmailModuleLayout />}>
              {EMAIL_ROUTES.map(({ path, segment, isIndex, Component }) =>
                isIndex ? (
                  <Route key={path} index element={<Component />} />
                ) : (
                  <Route key={path} path={segment} element={<Component />} />
                )
              )}
              {EMAIL_DETAIL_ROUTES.map(({ segment, Component }) => (
                <Route key={segment} path={segment} element={<Component />} />
              ))}
            </Route>

            {/* Concludo CRM Module */}
            <Route path="/crm" element={<CrmModuleLayout />}>
              <Route path="communicate" element={<CommHubPage />} />
              <Route path="contacts" element={<Navigate to="/crm/people" replace />} />
              {CRM_ROUTES.filter((r) => r.segment !== 'communicate').map(({ path, segment, isIndex, Component }) =>
                isIndex ? (
                  <Route key={path} index element={<Component />} />
                ) : (
                  <Route key={path} path={segment} element={<Component />} />
                )
              )}
              {CRM_DETAIL_ROUTES.map(({ segment, Component }) => (
                <Route key={segment} path={segment} element={<Component />} />
              ))}
            </Route>

            {Object.entries(activeRedirects(MERGED_PAGES_READY)).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}

            <Route path="/test-connection" element={<ConnectionTestPage />} />
          </Route>
        </Route>

        {/* Fallback: redirect to /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};
export default App;
