/**
 * Tasklet 6.4: Timeline Renderer (VIS-04)
 * 
 * Renders chronological meeting sequences and topic progression (VIS-04, Timeline milestone bar).
 * Strict Prohibition: No per-speaker lane and no speaker colour coding.
 * Doing so constitutes prohibited individual measurement.
 */

export class IndividualMeasurementProhibitedError extends Error {
  constructor(feature = 'Per-speaker lane or speaker colour coding') {
    super(`Prohibited individual measurement in timeline visualization: ${feature}. Concludo timelines render topic and milestone sequences only.`);
    this.name = 'IndividualMeasurementProhibitedError';
    this.code = 'INDIVIDUAL_MEASUREMENT_PROHIBITED';
  }
}

export function renderTimelineVisual(topics = [], options = {}) {
  // Check for prohibited individual measurement options
  if (options.bySpeaker || options.speakerLanes || options.speakerColors) {
    throw new IndividualMeasurementProhibitedError();
  }

  const width = options.width || 600;
  const height = options.height || 180;
  const margin = { top: 30, right: 30, bottom: 40, left: 30 };
  const plotW = width - margin.left - margin.right;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-timeline" aria-label="Meeting Topic Timeline (VIS-04)">
  <style>
    .time-title { font-family: 'Poppins', sans-serif; font-size: 11px; font-weight: 600; fill: #16263F; }
    .topic-box { fill: #21395C; rx: 4px; }
    .topic-label { font-family: 'Inter', sans-serif; font-size: 9px; fill: #FFFFFF; font-weight: 500; text-anchor: middle; dominant-baseline: central; }
    .axis { stroke: #D9DFE8; stroke-width: 2; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  <text x="${width / 2}" y="20" text-anchor="middle" class="time-title">${options.title || 'Meeting Topic Progression (VIS-04)'}</text>
  <g transform="translate(${margin.left}, 60)">
    <line x1="0" y1="20" x2="${plotW}" y2="20" class="axis" />
`;

  const count = Math.max(1, topics.length);
  const blockW = (plotW / count) - 8;

  topics.forEach((t, i) => {
    const x = i * (plotW / count) + 4;
    const title = typeof t === 'string' ? t : t.title || `Topic ${i + 1}`;
    svg += `    <rect x="${x}" y="0" width="${blockW}" height="40" class="topic-box" fill="${i % 2 === 0 ? '#16263F' : '#21395C'}" />\n`;
    svg += `    <text x="${x + blockW / 2}" y="20" class="topic-label">${title.slice(0, 16)}</text>\n`;
    svg += `    <circle cx="${x + blockW / 2}" cy="50" r="3" fill="#E2B53C" />\n`;
  });

  svg += `  </g>\n</svg>`;
  return {
    visual_id: 'VIS-04',
    is_fallback: false,
    svg
  };
}
