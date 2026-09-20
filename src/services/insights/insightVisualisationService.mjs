/**
 * Tasklet 3.11: Insight Visualisation Engine
 * 
 * Render interactive and exportable vector SVG representations:
 * - VIS-03: Risk heat map 5x5
 * - VIS-02: Priority matrix 2x2
 * - VIS-20: Sensitivity tornado
 * 
 * Rules: Pure deterministic SVG. Distinct by shape and label, not colour alone.
 */

export function renderRiskHeatmapSvg(risks = []) {
  // 5x5 matrix SVG
  const width = 500;
  const height = 400;
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const cellWidth = (width - margin.left - margin.right) / 5;
  const cellHeight = (height - margin.top - margin.bottom) / 5;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-svg-plot" aria-label="5x5 Risk Heat Map Plot">
  <style>
    .axis-label { font-family: 'Poppins', sans-serif; font-size: 11px; fill: #16263F; font-weight: 600; }
    .tick-label { font-family: 'Inter', sans-serif; font-size: 9px; fill: #6B7280; }
    .cell { stroke: #FFFFFF; stroke-width: 1.5; }
    .risk-dot { stroke: #16263F; stroke-width: 1.5; }
    .risk-text { font-family: 'Inter', sans-serif; font-size: 8px; fill: #FFFFFF; font-weight: bold; text-anchor: middle; dominant-baseline: central; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  <text x="${width / 2}" y="24" text-anchor="middle" class="axis-label">Risk Distribution Matrix (VIS-03)</text>
  <g transform="translate(${margin.left}, ${margin.top})">
`;

  // Draw 5x5 grid cells
  const colors = [
    ['#E0F2FE', '#E0F2FE', '#BAE6FD', '#7DD3FC', '#38BDF8'],
    ['#E0F2FE', '#BAE6FD', '#FED7AA', '#FDBA74', '#FB923C'],
    ['#BAE6FD', '#FED7AA', '#FDBA74', '#FB923C', '#F87171'],
    ['#7DD3FC', '#FDBA74', '#FB923C', '#F87171', '#EF4444'],
    ['#38BDF8', '#FB923C', '#F87171', '#EF4444', '#DC2626']
  ];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = c * cellWidth;
      const y = (4 - r) * cellHeight; // row 0 is bottom
      const color = colors[r][c];
      svg += `    <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${color}" class="cell" />\n`;
    }
  }

  // Draw risks as identifiable markers
  risks.forEach((rk, idx) => {
    const sev = Math.max(1, Math.min(5, rk.severity || 3));
    const lik = Math.max(1, Math.min(5, rk.likelihood || 3));
    const cx = (lik - 0.5) * cellWidth;
    const cy = (5 - sev + 0.5) * cellHeight;
    const label = `R${idx + 1}`;

    svg += `    <circle cx="${cx}" cy="${cy}" r="9" fill="#16263F" class="risk-dot" />\n`;
    svg += `    <text x="${cx}" y="${cy}" class="risk-text">${label}</text>\n`;
  });

  svg += `  </g>
  <text x="${width / 2}" y="${height - 15}" text-anchor="middle" class="axis-label">Likelihood (1: Rare to 5: Almost Certain)</text>
  <text x="18" y="${height / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90 18 ${height / 2})">Severity (1: Negligible to 5: Critical)</text>
</svg>`;

  return svg;
}

export function renderPriorityMatrixSvg(items = []) {
  const width = 500;
  const height = 400;
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-svg-plot" aria-label="Priority Matrix 2x2 (VIS-02)">
  <style>
    .title { font-family: 'Poppins', sans-serif; font-size: 11px; fill: #16263F; font-weight: 600; text-anchor: middle; }
    .axis { stroke: #D1D5DB; stroke-dasharray: 4,4; stroke-width: 1.5; }
    .quadrant-label { font-family: 'Inter', sans-serif; font-size: 10px; fill: #9CA3AF; font-weight: bold; }
    .item-label { font-family: 'Inter', sans-serif; font-size: 8px; fill: #FFFFFF; font-weight: bold; text-anchor: middle; dominant-baseline: central; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  <text x="${width / 2}" y="24" class="title">Strategic Priority Matrix (VIS-02)</text>
  <g transform="translate(${margin.left}, ${margin.top})">
    <rect x="0" y="0" width="${plotW / 2}" height="${plotH / 2}" fill="#F0FDF4" />
    <rect x="${plotW / 2}" y="0" width="${plotW / 2}" height="${plotH / 2}" fill="#FEF3C7" />
    <rect x="0" y="${plotH / 2}" width="${plotW / 2}" height="${plotH / 2}" fill="#F3F4F6" />
    <rect x="${plotW / 2}" y="${plotH / 2}" width="${plotW / 2}" height="${plotH / 2}" fill="#FEE2E2" />

    <line x1="${plotW / 2}" y1="0" x2="${plotW / 2}" y2="${plotH}" class="axis" />
    <line x1="0" y1="${plotH / 2}" x2="${plotW}" y2="${plotH / 2}" class="axis" />

    <text x="12" y="20" class="quadrant-label">HIGH IMPACT / LOW EFFORT (QUICK WINS)</text>
    <text x="${plotW / 2 + 12}" y="20" class="quadrant-label">HIGH IMPACT / HIGH EFFORT (STRATEGIC)</text>
    <text x="12" y="${plotH / 2 + 20}" class="quadrant-label">LOW IMPACT / LOW EFFORT (FILL-INS)</text>
    <text x="${plotW / 2 + 12}" y="${plotH / 2 + 20}" class="quadrant-label">LOW IMPACT / HIGH EFFORT (RECONSIDER)</text>
`;

  items.forEach((item, idx) => {
    const imp = Math.max(1, Math.min(10, item.impact || 5));
    const eff = Math.max(1, Math.min(10, item.effort || 5));
    const cx = (eff / 10) * plotW;
    const cy = (1 - (imp / 10)) * plotH;
    const label = `P${idx + 1}`;

    svg += `    <polygon points="${cx},${cy - 8} ${cx + 7},${cy + 6} ${cx - 7},${cy + 6}" fill="#21395C" />\n`;
    svg += `    <text x="${cx}" y="${cy}" class="item-label">${label}</text>\n`;
  });

  svg += `  </g>
  <text x="${width / 2}" y="${height - 15}" text-anchor="middle" class="title">Implementation Effort (1: Low to 10: Extensive)</text>
  <text x="18" y="${height / 2}" text-anchor="middle" class="title" transform="rotate(-90 18 ${height / 2})">Strategic Impact (1: Low to 10: High)</text>
</svg>`;

  return svg;
}

export function renderSensitivityTornadoSvg(drivers = []) {
  const width = 500;
  const height = 300;
  const margin = { top: 40, right: 40, bottom: 40, left: 140 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-svg-plot" aria-label="Sensitivity Tornado Plot (VIS-20)">
  <style>
    .title { font-family: 'Poppins', sans-serif; font-size: 11px; fill: #16263F; font-weight: 600; text-anchor: middle; }
    .label { font-family: 'Inter', sans-serif; font-size: 9px; fill: #16263F; text-anchor: end; dominant-baseline: central; }
    .center-line { stroke: #16263F; stroke-width: 1.5; }
    .pos-bar { fill: #E2B53C; }
    .neg-bar { fill: #21395C; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  <text x="${width / 2}" y="24" class="title">Parameter Sensitivity Tornado (VIS-20)</text>
  <g transform="translate(${margin.left}, ${margin.top})">
    <line x1="${plotW / 2}" y1="0" x2="${plotW / 2}" y2="${plotH}" class="center-line" />
`;

  const barHeight = Math.min(24, plotH / Math.max(1, drivers.length));

  drivers.forEach((d, idx) => {
    const y = idx * (barHeight + 6);
    const low = Math.abs(d.low || 15);
    const high = Math.abs(d.high || 25);
    const maxVal = 50;

    const leftW = (low / maxVal) * (plotW / 2);
    const rightW = (high / maxVal) * (plotW / 2);

    svg += `    <text x="-10" y="${y + barHeight / 2}" class="label">${d.name || 'Variable ' + (idx + 1)}</text>\n`;
    svg += `    <rect x="${plotW / 2 - leftW}" y="${y}" width="${leftW}" height="${barHeight}" class="neg-bar" rx="2" />\n`;
    svg += `    <rect x="${plotW / 2}" y="${y}" width="${rightW}" height="${barHeight}" class="pos-bar" rx="2" />\n`;
  });

  svg += `  </g>
</svg>`;

  return svg;
}
