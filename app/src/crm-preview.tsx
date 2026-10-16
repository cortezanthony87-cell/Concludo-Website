// Stage 2 visual harness. Not part of the module and not part of the patch.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { CrmModuleLayout } from './components/crm/CrmModuleLayout';
import { CRM_ROUTES, CRM_DETAIL_ROUTES } from './pages/crm/crmRouteTable';

const start = new URLSearchParams(window.location.search).get('p') ?? '/crm';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[start]}>
    <div className="main-content-area" style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/crm" element={<CrmModuleLayout />}>
          {CRM_ROUTES.map(({ path, segment, isIndex, Component }) =>
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
      </Routes>
    </div>
  </MemoryRouter>
);
