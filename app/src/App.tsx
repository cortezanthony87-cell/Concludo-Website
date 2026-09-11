import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicAuthRoute } from './components/PublicAuthRoute';
import { WorkspaceLayout } from './components/WorkspaceLayout';

import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { RecentlyDeletedPage } from './pages/RecentlyDeletedPage';
import { DecisionMemoryPage } from './pages/DecisionMemoryPage';
import { ActionsPage } from './pages/ActionsPage';
import { ConnectionTestPage } from './pages/ConnectionTestPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Authentication routes (redirect to /dashboard if already logged in) */}
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/deleted" element={<RecentlyDeletedPage />} />
            <Route path="/decision-memory" element={<DecisionMemoryPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/test-connection" element={<ConnectionTestPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
};
