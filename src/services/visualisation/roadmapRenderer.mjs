/**
 * Tasklet 6.5: Roadmap Renderer (VIS-06)
 * 
 * Renders multi-horizon roadmaps (VIS-06, Roadmap swimlane) across Now, Next, and Later horizons.
 * Precondition: 3 or more dated or horizon-assigned items.
 * Fallback: Horizon list.
 */

import { escapeSvg } from './chartEngineCore.mjs';

export function renderRoadmapVisual(items = [], options = {}) {
  if (!items || items.length < 3) {
    return {
      visual_id: 'VIS-06',
      is_fallback: true,
      precondition: '3 or more dated or horizon-assigned items',
      html: `
        <div class="roadmap-fallback-list" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Delivery Roadmap (List View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 3 roadmap items stated. Rendered as formatted list.</p>
          <ul style="padding-left: 20px; font-size: 11px;">
            ${(items && items.length > 0)
              ? items.map((it) => `<li><strong>${escapeSvg(it.milestone || it.title || 'Item')}:</strong> ${escapeSvg(it.horizon || 'Scheduled')} (${escapeSvg(it.target_date || 'TBD')})</li>`).join('')
              : '<li style="font-style: italic; color: #64748B;">No roadmap milestones recorded in source transcript.</li>'
            }
          </ul>
        </div>
      `
    };
  }

  const width = options.width || 640;
  const height = options.height || 260;
  const colW = (width - 40) / 3;

  const nowItems = items.filter((it) => it.horizon?.toLowerCase() === 'now' || !it.horizon);
  const nextItems = items.filter((it) => it.horizon?.toLowerCase() === 'next');
  const laterItems = items.filter((it) => it.horizon?.toLowerCase() === 'later');

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-roadmap" aria-label="Roadmap Swimlane (VIS-06)">
  <style>
    .col-title { font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600; text-anchor: middle; }
    .card { rx: 4px; stroke: #D9DFE8; stroke-width: 1; fill: #FFFFFF; }
    .card-title { font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 600; fill: #16263F; }
    .card-meta { font-family: 'Inter', sans-serif; font-size: 8px; fill: #64748B; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  
  <!-- Column 1: Now -->
  <rect x="15" y="15" width="${colW - 10}" height="${height - 30}" fill="#F0FDF4" rx="6" />
  <text x="${15 + colW / 2}" y="36" class="col-title" fill="#15803D">NOW (MONTH 1-2)</text>
  ${nowItems.slice(0, 3).map((it, i) => `
    <rect x="22" y="${50 + i * 55}" width="${colW - 24}" height="45" class="card" />
    <text x="30" y="${68 + i * 55}" class="card-title">${escapeSvg(String(it.milestone || it.title || 'Deliverable')).slice(0, 24)}</text>
    <text x="30" y="${82 + i * 55}" class="card-meta">Owner: ${escapeSvg(it.owner || 'Lead')} | ${escapeSvg(it.target_date || 'M1')}</text>
  `).join('')}

  <!-- Column 2: Next -->
  <rect x="${15 + colW}" y="15" width="${colW - 10}" height="${height - 30}" fill="#FEF3C7" rx="6" />
  <text x="${15 + colW + colW / 2}" y="36" class="col-title" fill="#B45309">NEXT (MONTH 3-6)</text>
  ${nextItems.slice(0, 3).map((it, i) => `
    <rect x="${22 + colW}" y="${50 + i * 55}" width="${colW - 24}" height="45" class="card" />
    <text x="${30 + colW}" y="${68 + i * 55}" class="card-title">${escapeSvg(String(it.milestone || it.title || 'Deliverable')).slice(0, 24)}</text>
    <text x="${30 + colW}" y="${82 + i * 55}" class="card-meta">Owner: ${escapeSvg(it.owner || 'Team')} | ${escapeSvg(it.target_date || 'M3')}</text>
  `).join('')}

  <!-- Column 3: Later -->
  <rect x="${15 + colW * 2}" y="15" width="${colW - 10}" height="${height - 30}" fill="#EFF6FF" rx="6" />
  <text x="${15 + colW * 2 + colW / 2}" y="36" class="col-title" fill="#1D4ED8">LATER (MONTH 6+)</text>
  ${laterItems.slice(0, 3).map((it, i) => `
    <rect x="${22 + colW * 2}" y="${50 + i * 55}" width="${colW - 24}" height="45" class="card" />
    <text x="${30 + colW * 2}" y="${68 + i * 55}" class="card-title">${escapeSvg(String(it.milestone || it.title || 'Deliverable')).slice(0, 24)}</text>
    <text x="${30 + colW * 2}" y="${82 + i * 55}" class="card-meta">Owner: ${escapeSvg(it.owner || 'Strategic')} | ${escapeSvg(it.target_date || 'M6+')}</text>
  `).join('')}
</svg>`;

  return {
    visual_id: 'VIS-06',
    is_fallback: false,
    svg
  };
}
