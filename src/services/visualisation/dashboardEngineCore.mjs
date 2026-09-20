/**
 * Tasklet 6.2: Dashboard Engine Core
 * 
 * Layout engine for composite multi-metric dashboards with responsive breakpoints
 * at 390px (mobile), 768px (tablet), 1280px (desktop), and 1440px (wide screen).
 */

export const BREAKPOINTS = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
  wide: 1440
};

export function renderDashboardContainerHtml(cards = [], options = {}) {
  const title = options.title || 'Executive Dashboard';
  return `
    <div class="concludo-dashboard" style="font-family: 'Inter', sans-serif; max-width: 1440px; margin: 0 auto; padding: 16px;">
      <style>
        .concludo-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
        .col-12 { grid-column: span 12; }
        .col-6 { grid-column: span 6; }
        .col-4 { grid-column: span 4; }
        .col-3 { grid-column: span 3; }
        @media (max-width: 768px) {
          .col-6, .col-4, .col-3 { grid-column: span 12 !important; }
        }
        @media (min-width: 769px) and (max-width: 1280px) {
          .col-3 { grid-column: span 6 !important; }
        }
        .metric-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .metric-title { font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; margin-bottom: 6px; }
        .metric-value { font-family: 'Poppins', sans-serif; font-size: 22px; font-weight: 700; color: #16263F; }
      </style>
      <h2 style="font-family: 'Poppins', sans-serif; color: #16263F; margin-bottom: 20px;">${title}</h2>
      <div class="concludo-grid">
        ${cards.map((c) => `
          <div class="metric-card col-${c.span || 4}">
            <div class="metric-title">${c.title}</div>
            <div class="metric-value">${c.value}</div>
            ${c.subtitle ? `<div style="font-size: 12px; color: #64748B; margin-top: 4px;">${c.subtitle}</div>` : ''}
            ${c.content ? `<div style="margin-top: 12px;">${c.content}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
