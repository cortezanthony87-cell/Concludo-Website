/**
 * Tasklet 6.12: KPI Tile Row Renderer (VIS-13)
 * 
 * Renders KPI tile rows (VIS-13) for stated performance indicators.
 * Precondition: 3 or more quantified indicators stated in the record.
 * Fallback: Formatted metric table.
 * Pure deterministic layout; zero invented figures; targets appear only if stated.
 */

import { escapeSvg } from './chartEngineCore.mjs';

export function renderKpiTileRowVisual(kpiData = [], options = {}) {
  if (!kpiData || kpiData.length < 3) {
    return {
      visual_id: 'VIS-13',
      is_fallback: true,
      precondition: '3 or more quantified performance indicators stated in record',
      html: `
        <div class="kpi-fallback-table" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Key Performance Indicators (Table View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 3 quantified indicators stated. Rendered as formatted metric table.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr style="background: #F1F5F9;"><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Metric</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Current Value</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Target Baseline</th></tr>
            ${(kpiData && kpiData.length > 0)
              ? kpiData.map((k) => `<tr><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(k.name || k.metric || 'Metric')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(k.value || 'N/A')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(k.target || 'Not stated')}</td></tr>`).join('')
              : '<tr><td colspan="3" style="border: 1px solid #E2E8F0; padding: 6px 8px; font-style: italic; color: #64748B;">No quantified indicators stated in source record.</td></tr>'
            }
          </table>
        </div>
      `
    };
  }

  const width = options.width || 640;
  const tileCount = Math.min(4, kpiData.length);
  const tileW = (width - 40 - (tileCount - 1) * 12) / tileCount;
  const height = 110;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-kpi" aria-label="KPI Tile Row (VIS-13)">
  <style>
    .kpi-tile { rx: 6px; fill: #FFFFFF; stroke: #E2E8F0; stroke-width: 1.5; }
    .kpi-title { font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 600; fill: #64748B; text-transform: uppercase; }
    .kpi-val { font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: bold; fill: #16263F; }
    .kpi-meta { font-family: 'Inter', sans-serif; font-size: 8px; fill: #15803D; font-weight: 500; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
`;

  kpiData.slice(0, tileCount).forEach((k, i) => {
    const x = 20 + i * (tileW + 12);
    const y = 16;
    svg += `  <g transform="translate(${x}, ${y})">\n`;
    svg += `    <rect width="${tileW}" height="78" class="kpi-tile" />\n`;
    svg += `    <text x="12" y="22" class="kpi-title">${escapeSvg(String(k.name || k.metric || 'KPI')).slice(0, 16)}</text>\n`;
    svg += `    <text x="12" y="48" class="kpi-val">${escapeSvg(k.value || '0')}</text>\n`;
    svg += `    <text x="12" y="66" class="kpi-meta">${escapeSvg(k.trend || (k.target ? 'Target: ' + k.target : 'Stated indicator'))}</text>\n`;
    svg += `  </g>\n`;
  });

  svg += `</svg>`;

  return {
    visual_id: 'VIS-13',
    is_fallback: false,
    svg
  };
}
