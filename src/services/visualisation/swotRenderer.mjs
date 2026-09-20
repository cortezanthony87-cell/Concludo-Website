/**
 * Tasklet 6.3: SWOT Renderer (VIS-07)
 * 
 * Renders the SWOT quadrant (VIS-07) with distinct styling for Strengths, Weaknesses,
 * Opportunities, and Threats.
 * Precondition: Items stated in at least 2 quadrants.
 * Fallback: Categorised list.
 */

import { escapeSvg } from './chartEngineCore.mjs';

export function renderSwotVisual(swotData = {}, options = {}) {
  const strengths = swotData.strengths || [];
  const weaknesses = swotData.weaknesses || [];
  const opportunities = swotData.opportunities || [];
  const threats = swotData.threats || [];

  const filledQuadrants = [strengths.length > 0, weaknesses.length > 0, opportunities.length > 0, threats.length > 0].filter(Boolean).length;

  // Precondition check: at least 2 quadrants required
  if (filledQuadrants < 2) {
    return {
      visual_id: 'VIS-07',
      is_fallback: true,
      precondition: 'Items stated in at least 2 quadrants',
      html: `
        <div class="swot-fallback-list" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">SWOT Analysis Summary (List View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 2 quadrants populated. Rendered as categorized list.</p>
          ${strengths.length ? `<p><strong>Strengths:</strong> ${strengths.map(s => escapeSvg(s)).join(', ')}</p>` : ''}
          ${weaknesses.length ? `<p><strong>Weaknesses:</strong> ${weaknesses.map(w => escapeSvg(w)).join(', ')}</p>` : ''}
          ${opportunities.length ? `<p><strong>Opportunities:</strong> ${opportunities.map(o => escapeSvg(o)).join(', ')}</p>` : ''}
          ${threats.length ? `<p><strong>Threats:</strong> ${threats.map(t => escapeSvg(t)).join(', ')}</p>` : ''}
        </div>
      `
    };
  }

  const width = options.width || 600;
  const height = options.height || 400;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-swot" aria-label="SWOT Quadrant (VIS-07)">
  <style>
    .quad-title { font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: bold; }
    .item-text { font-family: 'Inter', sans-serif; font-size: 10px; fill: #1B2430; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  
  <!-- Quadrant 1: Strengths -->
  <rect x="12" y="12" width="${width / 2 - 18}" height="${height / 2 - 18}" fill="#F0FDF4" rx="6" stroke="#BBF7D0" stroke-width="1.5" />
  <text x="24" y="34" class="quad-title" fill="#15803D">STRENGTHS</text>
  ${strengths.slice(0, 3).map((s, i) => `<text x="24" y="${56 + i * 20}" class="item-text">&bull; ${escapeSvg(s).slice(0, 35)}</text>`).join('\n')}

  <!-- Quadrant 2: Weaknesses -->
  <rect x="${width / 2 + 6}" y="12" width="${width / 2 - 18}" height="${height / 2 - 18}" fill="#FEF2F2" rx="6" stroke="#FECACA" stroke-width="1.5" />
  <text x="${width / 2 + 18}" y="34" class="quad-title" fill="#B91C1C">WEAKNESSES</text>
  ${weaknesses.slice(0, 3).map((w, i) => `<text x="${width / 2 + 18}" y="${56 + i * 20}" class="item-text">&bull; ${escapeSvg(w).slice(0, 35)}</text>`).join('\n')}

  <!-- Quadrant 3: Opportunities -->
  <rect x="12" y="${height / 2 + 6}" width="${width / 2 - 18}" height="${height / 2 - 18}" fill="#EFF6FF" rx="6" stroke="#BFDBFE" stroke-width="1.5" />
  <text x="24" y="${height / 2 + 28}" class="quad-title" fill="#1D4ED8">OPPORTUNITIES</text>
  ${opportunities.slice(0, 3).map((o, i) => `<text x="24" y="${height / 2 + 50 + i * 20}" class="item-text">&bull; ${escapeSvg(o).slice(0, 35)}</text>`).join('\n')}

  <!-- Quadrant 4: Threats -->
  <rect x="${width / 2 + 6}" y="${height / 2 + 6}" width="${width / 2 - 18}" height="${height / 2 - 18}" fill="#FFFBEB" rx="6" stroke="#FDE68A" stroke-width="1.5" />
  <text x="${width / 2 + 18}" y="${height / 2 + 28}" class="quad-title" fill="#B45309">THREATS</text>
  ${threats.slice(0, 3).map((t, i) => `<text x="${width / 2 + 18}" y="${height / 2 + 50 + i * 20}" class="item-text">&bull; ${escapeSvg(t).slice(0, 35)}</text>`).join('\n')}
</svg>`;

  return {
    visual_id: 'VIS-07',
    is_fallback: false,
    svg
  };
}
