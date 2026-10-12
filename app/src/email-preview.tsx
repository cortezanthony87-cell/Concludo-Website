// Stage 3 visual harness. Not part of the module and not part of the patch.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { AuthProvider } from "./lib/auth/AuthContext";
import { EmailModuleLayout } from './components/email/EmailModuleLayout';
import { EMAIL_ROUTES, EMAIL_DETAIL_ROUTES } from './pages/email/emailRouteTable';

const start = new URLSearchParams(window.location.search).get('p') ?? '/email';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
  <MemoryRouter initialEntries={[start]}>
    <div className="main-content-area" style={{ minHeight: '100vh' }}>
      <Routes>
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
      </Routes>
    </div>
  </MemoryRouter>
</AuthProvider>
);
