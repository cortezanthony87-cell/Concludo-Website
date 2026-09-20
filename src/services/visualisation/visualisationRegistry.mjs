/**
 * Phase 6: Visualisation Registry and Dispatcher (Tasklets 6.1 to 6.12)
 * 
 * Maps all 28 visuals (VIS-01 to VIS-28) from the authoritative registry index
 * to their respective token-driven renderers and fallback table handlers.
 * 
 * Three governing rules:
 * 1. Never colour alone: every status, band, and mark is distinguishable by shape and label.
 * 2. Every visual has a stated precondition and stated fallback.
 * 3. No visual asserts an external comparison or benchmark Concludo does not have.
 */

import { escapeSvg } from './chartEngineCore.mjs';
import { renderRagDashboardVisual } from './ragDashboardRenderer.mjs';
import { renderPriorityMatrixVisual } from './priorityMatrixRenderer.mjs';
import { renderRiskHeatmapVisual } from './riskHeatmapRenderer.mjs';
import { renderTimelineVisual } from './timelineRenderer.mjs';
import { renderRoadmapVisual } from './roadmapRenderer.mjs';
import { renderSwotVisual } from './swotRenderer.mjs';
import { renderDecisionTreeVisual } from './decisionTreeRenderer.mjs';
import { renderSensitivityTornadoVisual } from './sensitivityTornadoRenderer.mjs';
import { renderKnowledgeGraphCanvasSvg } from './knowledgeGraphRenderer.mjs';
import { renderKpiTileRowVisual } from './kpiTileRowRenderer.mjs';

export const VISUAL_CATALOGUE = {
  'VIS-01': { id: 'VIS-01', name: 'RAG status set', tasklet: '6.9', min_items: 2, precondition: '2 or more workstream items with rag status' },
  'VIS-02': { id: 'VIS-02', name: 'Priority matrix 2x2', tasklet: '6.8', min_items: 3, precondition: '3 or more scored initiatives' },
  'VIS-03': { id: 'VIS-03', name: 'Risk heat map', tasklet: '6.6', min_items: 2, precondition: '2 or more stated risks with severity and likelihood' },
  'VIS-04': { id: 'VIS-04', name: 'Timeline milestone bar', tasklet: '6.4', min_items: 1, precondition: '1 or more meeting topic sequence items' },
  'VIS-05': { id: 'VIS-05', name: 'Gantt view', min_items: 3, precondition: '3 or more actions with start and finish dates' },
  'VIS-06': { id: 'VIS-06', name: 'Roadmap swimlane', tasklet: '6.5', min_items: 3, precondition: '3 or more roadmap milestones across horizons' },
  'VIS-07': { id: 'VIS-07', name: 'SWOT quadrant', tasklet: '6.3', min_items: 2, precondition: '2 or more stated SWOT factors' },
  'VIS-08': { id: 'VIS-08', name: 'Business Model Canvas grid', min_items: 4, precondition: '4 or more business model elements' },
  'VIS-09': { id: 'VIS-09', name: 'Capability map', min_items: 3, precondition: '3 or more capability domains' },
  'VIS-10': { id: 'VIS-10', name: 'Maturity assessment', min_items: 3, precondition: '3 or more capability maturity scores' },
  'VIS-11': { id: 'VIS-11', name: 'Accountability or org chart', min_items: 2, precondition: '2 or more organisational units or roles' },
  'VIS-12': { id: 'VIS-12', name: 'Decision tree', tasklet: '6.7', min_items: 2, precondition: '2 or more branches or options evaluated' },
  'VIS-13': { id: 'VIS-13', name: 'KPI tile row', tasklet: '6.12', min_items: 3, precondition: '3 or more quantified performance indicators' },
  'VIS-14': { id: 'VIS-14', name: 'Dependency network', tasklet: '6.11', min_items: 2, precondition: '2 or more linked entity nodes' },
  'VIS-15': { id: 'VIS-15', name: 'Waterfall bridge', min_items: 3, precondition: '3 or more financial bridge variances' },
  'VIS-16': { id: 'VIS-16', name: 'Trend line', min_items: 4, precondition: '4 or more longitudinal data points from own series' },
  'VIS-17': { id: 'VIS-17', name: 'Funnel or pipeline', min_items: 3, precondition: '3 or more pipeline conversion stages' },
  'VIS-18': { id: 'VIS-18', name: 'Stacked composition', min_items: 2, precondition: '2 or more composition components' },
  'VIS-19': { id: 'VIS-19', name: 'Options trade off matrix', min_items: 2, precondition: '2 or more evaluated options against criteria' },
  'VIS-20': { id: 'VIS-20', name: 'Sensitivity tornado', tasklet: '6.10', min_items: 2, precondition: '2 or more variable swing ranges' },
  'VIS-21': { id: 'VIS-21', name: 'Action ageing', min_items: 3, precondition: '3 or more actions with elapsed durations' },
  'VIS-22': { id: 'VIS-22', name: 'Meeting health dimension bars', min_items: 5, precondition: '5 or more scoreable dimension ratings' },
  'VIS-23': { id: 'VIS-23', name: 'Decision closure gauge', min_items: 1, precondition: '1 or more decision closure metrics' },
  'VIS-24': { id: 'VIS-24', name: 'Coverage bars', min_items: 2, precondition: '2 or more section coverage ratios' },
  'VIS-25': { id: 'VIS-25', name: 'Process and handoff flow', min_items: 3, precondition: '3 or more process handoff steps' },
  'VIS-26': { id: 'VIS-26', name: 'Incident timeline', min_items: 2, precondition: '2 or more chronological incident events' },
  'VIS-27': { id: 'VIS-27', name: 'Stakeholder grid', min_items: 3, precondition: '3 or more stakeholders with interest/influence' },
  'VIS-28': { id: 'VIS-28', name: 'Scenario comparison panel', min_items: 2, precondition: '2 or more scenario options' }
};

export function renderVisualById(visualId, data, options = {}) {
  const meta = VISUAL_CATALOGUE[visualId] || { id: visualId, name: 'Standard Visualisation', precondition: 'Stated data points' };

  switch (visualId) {
    case 'VIS-01': return renderRagDashboardVisual(data, options);
    case 'VIS-02': return renderPriorityMatrixVisual(data, options);
    case 'VIS-03': return renderRiskHeatmapVisual(data, options);
    case 'VIS-04': return renderTimelineVisual(data, options);
    case 'VIS-06': return renderRoadmapVisual(data, options);
    case 'VIS-07': return renderSwotVisual(data, options);
    case 'VIS-12': return renderDecisionTreeVisual(data, options);
    case 'VIS-13': return renderKpiTileRowVisual(data, options);
    case 'VIS-14': return renderKnowledgeGraphCanvasSvg(data, options);
    case 'VIS-20': return renderSensitivityTornadoVisual(data, options);
    default: {
      const title = meta.name;
      const precondition = meta.precondition;
      return {
        visual_id: visualId,
        is_fallback: true,
        precondition,
        html: `<div class="concludo-visual-fallback" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <div style="font-family: Poppins, sans-serif; font-size: 11px; font-weight: 600; color: #16263F; margin-bottom: 6px;">
            ${escapeSvg(visualId)}: ${escapeSvg(title)} (Structured Data Table)
          </div>
          <p style="font-size: 10px; color: #64748B; margin: 0 0 8px 0;">Precondition: ${escapeSvg(precondition)}. Rendered as formatted table.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr style="background: #F1F5F9;"><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Item</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Value / Detail</th></tr>
            ${Array.isArray(data) && data.length > 0
              ? data.map((d, i) => `<tr><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(d.label || d.name || `Row ${i + 1}`)}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(d.value || d.description || JSON.stringify(d))}</td></tr>`).join('')
              : '<tr><td colspan="2" style="border: 1px solid #E2E8F0; padding: 6px 8px; font-style: italic; color: #64748B;">No record data provided for this visual.</td></tr>'
            }
          </table>
        </div>`
      };
    }
  }
}
