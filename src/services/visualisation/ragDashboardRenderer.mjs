/**
 * Tasklet 6.9: RAG Dashboard Renderer (VIS-01)
 * 
 * Renders the RAG status set (VIS-01).
 * Accessible: Each status is distinguishable by shape and label, not colour alone.
 * Precondition: 2 or more items with a stated status.
 * Fallback: Status table.
 */

import { escapeSvg } from './chartEngineCore.mjs';

export function renderRagDashboardVisual(items = [], options = {}) {
  if (!items || items.length < 2) {
    return {
      visual_id: 'VIS-01',
      is_fallback: true,
      precondition: '2 or more items with a stated status',
      html: `
        <div class="rag-fallback-table" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Workstream Status (Table View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 2 items stated. Rendered as formatted table.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr style="background: #F1F5F9;"><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Workstream</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Status</th></tr>
            ${(items && items.length > 0)
              ? items.map((it) => `<tr><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(it.name || it.title || 'Workstream')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(it.status || 'Active')}</td></tr>`).join('')
              : '<tr><td colspan="2" style="border: 1px solid #E2E8F0; padding: 6px 8px; font-style: italic; color: #64748B;">No workstream status items recorded.</td></tr>'
            }
          </table>
        </div>
      `
    };
  }

  const width = options.width || 600;
  const height = 40 + items.length * 45;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-rag" aria-label="RAG Status Set (VIS-01)">
  <style>
    .rag-title { font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600; fill: #16263F; }
    .item-name { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; fill: #16263F; }
    .item-notes { font-family: 'Inter', sans-serif; font-size: 8px; fill: #64748B; }
    .status-text { font-family: 'Inter', sans-serif; font-size: 9px; font-weight: bold; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  <text x="20" y="24" class="rag-title">${escapeSvg(options.title || 'Workstream Health and RAG Status (VIS-01)')}</text>
`;

  items.forEach((it, i) => {
    const y = 40 + i * 45;
    const status = String(it.status || 'GREEN').toUpperCase();
    let badgeFill = '#F0FDF4';
    let textColor = '#15803D';
    let symbolSvg = '';

    if (status === 'RED') {
      badgeFill = '#FEF2F2';
      textColor = '#B91C1C';
      // Circle for Red
      symbolSvg = `<circle cx="48" cy="${y + 18}" r="8" fill="#DC2626" />`;
    } else if (status === 'AMBER' || status === 'YELLOW') {
      badgeFill = '#FEF3C7';
      textColor = '#B45309';
      // Square for Amber
      symbolSvg = `<rect x="40" y="${y + 10}" width="16" height="16" fill="#D97706" rx="2" />`;
    } else {
      // Triangle for Green
      symbolSvg = `<polygon points="48,${y + 10} 56,${y + 26} 40,${y + 26}" fill="#16A34A" />`;
    }

    svg += `  <rect x="20" y="${y}" width="${width - 40}" height="36" rx="6" fill="${badgeFill}" stroke="#E2E8F0" stroke-width="1" />\n`;
    svg += `  ${symbolSvg}\n`;
    svg += `  <text x="75" y="${y + 16}" class="item-name">${escapeSvg(String(it.name || it.title || 'Workstream')).slice(0, 35)}</text>\n`;
    svg += `  <text x="75" y="${y + 28}" class="item-notes">${escapeSvg(String(it.notes || 'Operating within agreed parameters')).slice(0, 45)}</text>\n`;
    svg += `  <text x="${width - 50}" y="${y + 22}" class="status-text" fill="${textColor}" text-anchor="end">${escapeSvg(status)}</text>\n`;
  });

  svg += `</svg>`;

  return {
    visual_id: 'VIS-01',
    is_fallback: false,
    svg
  };
}
