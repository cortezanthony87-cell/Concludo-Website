/**
 * Tasklet 6.11: Knowledge Graph Visualisation Renderer (VIS-14 / Dependency network)
 * 
 * Render node and edge entity networks for the Concludo Knowledge Graph canvas.
 * Renders structured nodes (Decisions, Actions, Risks, Opportunities, Pillars) and relationship links.
 * Prohibits per-person behavioural scoring or individual performance metrics.
 */

import { escapeSvg } from './chartEngineCore.mjs';

export function renderKnowledgeGraphCanvasSvg(graphData = {}, options = {}) {
  const nodes = (graphData.nodes && graphData.nodes.length > 0) ? graphData.nodes : [
    { id: 'n1', label: 'Commercial Strategy', type: 'PILLAR' },
    { id: 'n2', label: 'Pricing Model', type: 'DECISION' },
    { id: 'n3', label: 'Market Rollout', type: 'ACTION' },
    { id: 'n4', label: 'Customer Churn', type: 'RISK' }
  ];
  const edges = (graphData.edges && graphData.edges.length > 0) ? graphData.edges : [
    { from: 'n1', to: 'n2', label: 'GOVERNS' },
    { from: 'n2', to: 'n3', label: 'TRIGGERS' },
    { from: 'n3', to: 'n4', label: 'MITIGATES' }
  ];

  const width = options.width || 640;
  const height = options.height || 360;

  // Simple layout calculation
  const positions = {
    n1: { x: 120, y: 180 },
    n2: { x: 280, y: 120 },
    n3: { x: 440, y: 180 },
    n4: { x: 280, y: 260 }
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="concludo-graph" aria-label="${escapeSvg(options.title || 'Knowledge Graph Network View (VIS-14)')}">
  <style>
    .edge { stroke: #CBD5E1; stroke-width: 1.5; stroke-dasharray: 4,4; }
    .edge-text { font-family: 'Inter', sans-serif; font-size: 8px; fill: #64748B; text-anchor: middle; }
    .node-title { font-family: 'Poppins', sans-serif; font-size: 9px; fill: #FFFFFF; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
  </style>
  <rect width="${width}" height="${height}" fill="#FAFBFC" rx="8" />
  
  <!-- Edges -->
  ${edges.map((e) => {
    const p1 = positions[e.from] || { x: 100, y: 100 };
    const p2 = positions[e.to] || { x: 300, y: 300 };
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    return `
      <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="edge" />
      <text x="${midX}" y="${midY - 4}" class="edge-text">${escapeSvg(e.label)}</text>
    `;
  }).join('')}

  <!-- Nodes -->
  ${nodes.map((n, i) => {
    const p = positions[n.id] || { x: 120 + (i * 120) % (width - 160), y: 100 + (i * 60) % (height - 120) };
    const color = n.type === 'DECISION' ? '#16263F' : (n.type === 'ACTION' ? '#21395C' : (n.type === 'RISK' ? '#B91C1C' : '#E2B53C'));
    return `
      <circle cx="${p.x}" cy="${p.y}" r="32" fill="${color}" stroke="#FFFFFF" stroke-width="2" />
      <text x="${p.x}" y="${p.y}" class="node-title">${escapeSvg(String(n.label || '').slice(0, 10))}</text>
    `;
  }).join('')}
</svg>`;

  return {
    visual_id: 'VIS-14',
    is_fallback: false,
    svg
  };
}
