/**
 * Tasklet 6.7: Decision Tree Renderer (VIS-12)
 * 
 * Renders the Decision tree (VIS-12) displaying decision node, evaluated alternatives, and outcome.
 * Precondition: A decision with 2 or more stated alternatives.
 * Fallback: Options list.
 */

import { escapeSvg } from './chartEngineCore.mjs';

export function renderDecisionTreeVisual(decisionNode = {}, options = {}) {
  const alternatives = decisionNode.alternatives || decisionNode.options || [];

  if (alternatives.length < 2) {
    return {
      visual_id: 'VIS-12',
      is_fallback: true,
      precondition: 'A decision with 2 or more stated alternatives',
      html: `
        <div class="decision-fallback-list" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Evaluated Options (List View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 2 alternatives stated. Rendered as options list.</p>
          <ul style="padding-left: 20px; font-size: 11px;">
            ${(alternatives && alternatives.length > 0)
              ? alternatives.map((alt) => `<li>${escapeSvg(alt.name || alt)}</li>`).join('')
              : '<li style="font-style: italic; color: #64748B;">No alternatives stated in source transcript.</li>'
            }
          </ul>
        </div>
      `
    };
  }

  const width = options.width || 600;
  const height = options.height || 220;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-tree" aria-label="Decision Tree (VIS-12)">
  <style>
    .node-text { font-family: 'Poppins', sans-serif; font-size: 10px; fill: #FFFFFF; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
    .branch-text { font-family: 'Inter', sans-serif; font-size: 9px; fill: #16263F; font-weight: 500; }
    .line { stroke: #21395C; stroke-width: 1.5; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  
  <!-- Root Decision Node -->
  <rect x="20" y="85" width="120" height="50" rx="6" fill="#16263F" />
  <text x="80" y="110" class="node-text">${escapeSvg(String(decisionNode.title || 'Decision Point')).slice(0, 16)}</text>

  <!-- Branches -->
  ${alternatives.slice(0, 3).map((alt, i) => {
    const y = 40 + i * 65;
    const isSelected = Boolean(alt.selected || i === 0);
    const altLabel = String(alt.name || alt);
    return `
      <line x1="140" y1="110" x2="260" y2="${y + 20}" class="line" />
      <rect x="260" y="${y}" width="180" height="40" rx="4" fill="${isSelected ? '#E2B53C' : '#F1F5F9'}" stroke="${isSelected ? '#BC8A1C' : '#CBD5E1'}" stroke-width="1.5" />
      <text x="350" y="${y + 20}" font-family="Inter, sans-serif" font-size="9px" font-weight="${isSelected ? 'bold' : 'normal'}" fill="${isSelected ? '#16263F' : '#475569'}" text-anchor="middle" dominant-baseline="central">Option ${i + 1}: ${escapeSvg(altLabel).slice(0, 22)}</text>
      ${isSelected ? `<rect x="460" y="${y + 5}" width="100" height="30" rx="4" fill="#1F7A4D" /><text x="510" y="${y + 20}" class="node-text">Selected</text>` : ''}
    `;
  }).join('')}
</svg>`;

  return {
    visual_id: 'VIS-12',
    is_fallback: false,
    svg
  };
}
