/**
 * Tasklet 6.1: Chart Engine Core
 * 
 * Foundational vector charting engine rendering bar charts, donut charts, and dimension bars
 * using Concludo design tokens (Navy, Gold, Light).
 * Pure deterministic SVG generator.
 */

export const CONCLUDO_CHART_TOKENS = {
  navy_primary: '#16263F',
  navy_secondary: '#21395C',
  gold_primary: '#E2B53C',
  gold_dark: '#BC8A1C',
  light: '#F4F6FA',
  ink: '#1B2430',
  muted: '#5B6B7F',
  rule: '#D9DFE8',
  status_good: '#1F7A4D',
  status_warning: '#B8860B',
  status_serious: '#C2561E',
  status_critical: '#B3261E'
};

export function escapeSvg(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderBarChartSvg(data = [], options = {}) {
  const width = options.width || 480;
  const height = options.height || 260;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const maxVal = Math.max(...data.map((d) => d.value || 0), 10);
  const barWidth = Math.min(36, (plotW / Math.max(1, data.length)) * 0.7);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-chart" aria-label="${escapeSvg(options.title || 'Bar Chart')}">
  <style>
    .title { font-family: 'Poppins', sans-serif; font-size: 11px; fill: #16263F; font-weight: 600; }
    .label { font-family: 'Inter', sans-serif; font-size: 9px; fill: #5B6B7F; text-anchor: middle; }
    .axis { stroke: #D9DFE8; stroke-width: 1; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="${options.rx || 6}" />
  <text x="${width / 2}" y="20" text-anchor="middle" class="title">${escapeSvg(options.title || 'Bar Chart')}</text>
  <g transform="translate(${margin.left}, ${margin.top})">
    <line x1="0" y1="${plotH}" x2="${plotW}" y2="${plotH}" class="axis" />
`;

  data.forEach((d, i) => {
    const x = (i + 0.5) * (plotW / data.length) - barWidth / 2;
    const h = (d.value / maxVal) * plotH;
    const y = plotH - h;
    const color = i % 2 === 0 ? CONCLUDO_CHART_TOKENS.navy_primary : CONCLUDO_CHART_TOKENS.navy_secondary;

    svg += `    <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${color}" rx="3" />\n`;
    svg += `    <text x="${x + barWidth / 2}" y="${plotH + 16}" class="label">${escapeSvg(d.label || 'Item ' + (i + 1))}</text>\n`;
    svg += `    <text x="${x + barWidth / 2}" y="${y - 4}" class="label" fill="#16263F" font-weight="600">${escapeSvg(d.value)}</text>\n`;
  });

  svg += `  </g>\n</svg>`;
  return svg;
}

export function renderDonutChartSvg(data = [], options = {}) {
  const size = options.size || 260;
  const radius = size / 2 - 20;
  const innerRadius = radius * 0.6;
  const center = size / 2;

  const total = data.reduce((acc, d) => acc + (d.value || 0), 0) || 1;
  const palette = [
    CONCLUDO_CHART_TOKENS.navy_primary,
    CONCLUDO_CHART_TOKENS.gold_primary,
    CONCLUDO_CHART_TOKENS.navy_secondary,
    CONCLUDO_CHART_TOKENS.gold_dark
  ];

  let currentAngle = -Math.PI / 2;
  let paths = '';

  data.forEach((d, i) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;

    const x1 = center + radius * Math.cos(currentAngle);
    const y1 = center + radius * Math.sin(currentAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const ix1 = center + innerRadius * Math.cos(currentAngle);
    const iy1 = center + innerRadius * Math.sin(currentAngle);
    const ix2 = center + innerRadius * Math.cos(endAngle);
    const iy2 = center + innerRadius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const color = palette[i % palette.length];

    const dPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    paths += `  <path d="${dPath}" fill="${color}" stroke="#FFFFFF" stroke-width="2" />\n`;

    currentAngle = endAngle;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="auto" class="concludo-chart">
  <rect width="${size}" height="${size}" fill="#FAFBFC" rx="6" />
  ${paths}
  <text x="${center}" y="${center + 4}" text-anchor="middle" font-family="Poppins, sans-serif" font-size="12px" font-weight="600" fill="#16263F">${escapeSvg(options.centerLabel || 'Total')}</text>
</svg>`;
}
