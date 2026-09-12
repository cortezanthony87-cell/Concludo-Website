import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicAuthRoute } from './components/PublicAuthRoute';
import { WorkspaceLayout } from './components/WorkspaceLayout';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SearchPage } from './pages/SearchPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { RecentlyDeletedPage } from './pages/RecentlyDeletedPage';
import { DecisionMemoryPage } from './pages/DecisionMemoryPage';
import { DecisionDetailPage } from './pages/DecisionDetailPage';
import { ActionsPage } from './pages/ActionsPage';
import { ActionDetailPage } from './pages/ActionDetailPage';
import { ConnectionTestPage } from './pages/ConnectionTestPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Home Route (renders HomePage or redirects to /dashboard if logged in) */}
        <Route path="/" element={<HomePage />} />

        {/* Public Auth routes (redirect to /dashboard if already logged in) */}
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

        {/* Password reset route (accessible via recovery email link) */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Workspace routes (redirect to /login if not authenticated) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/deleted" element={<RecentlyDeletedPage />} />
            <Route path="/decision-memory" element={<DecisionMemoryPage />} />
            <Route path="/decision-memory/:id" element={<DecisionDetailPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/actions/:id" element={<ActionDetailPage />} />
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/test-connection" element={<ConnectionTestPage />} />
          </Route>
        </Route>

        {/* Fallback: redirect to /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};
