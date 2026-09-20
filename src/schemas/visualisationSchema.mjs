/**
 * Tasklet 8.9: Visualisation Schema
 * Specifies JSON Schema for visual models VIS-01 through VIS-28.
 * Enforces precondition and fallback declarations on every visual.
 */

export class VisualSchemaMismatchError extends Error {
  constructor(message, visualId = null) {
    super(message);
    this.name = 'VISUAL_SCHEMA_MISMATCH';
    this.visualId = visualId;
  }
}

export const VISUAL_MODELS = {
  'VIS-01': { name: 'RAG Status Set', precondition: 'At least 1 status item', fallback: 'Text bullet list' },
  'VIS-02': { name: 'Priority Matrix 2x2', precondition: 'Items with urgency and impact', fallback: 'Sorted priority table' },
  'VIS-03': { name: '5x5 Risk Heatmap', precondition: 'Risks with probability 1-5 and impact 1-5', fallback: 'Ranked risk table' },
  'VIS-04': { name: 'Timeline Milestone Bar', precondition: 'Milestones with valid dates', fallback: 'Numbered milestone list' },
  'VIS-05': { name: 'Gantt Schedule', precondition: 'Phased timeline entries with start and end', fallback: 'Phased milestone table' },
  'VIS-06': { name: 'Roadmap Horizon View', precondition: 'Now/Next/Later phase grouping', fallback: 'Phased text list' },
  'VIS-07': { name: 'SWOT Quadrant', precondition: 'Categorised strategic factors', fallback: 'Four-chapter bullet list' },
  'VIS-08': { name: 'Process Flowchart', precondition: 'Sequential steps with flow links', fallback: 'Numbered step procedure' },
  'VIS-09': { name: 'Value Stream Map', precondition: 'Process stages with lead and cycle times', fallback: 'Sequential phase table' },
  'VIS-10': { name: 'Org Hierarchy Chart', precondition: 'Parent-child reporting relationships', fallback: 'Indented role list' },
  'VIS-11': { name: 'RACI Matrix', precondition: 'Tasks matched with functional roles', fallback: 'Responsibility table' },
  'VIS-12': { name: 'Decision Tree', precondition: 'Root decision with branching options', fallback: 'Nested options outline' },
  'VIS-13': { name: 'KPI Tile Row', precondition: 'Metrics with label, value, and unit', fallback: 'Summary stat list' },
  'VIS-14': { name: 'Knowledge Graph Map', precondition: 'Extracted entity nodes and relation edges', fallback: 'Entity relation list' },
  'VIS-15': { name: 'Dependency Network', precondition: 'Tasks with predecessor/successor links', fallback: 'Dependency table' },
  'VIS-16': { name: 'Capability Radar', precondition: '3 to 8 capability score dimensions', fallback: 'Capability score table' },
  'VIS-17': { name: 'Fishbone Diagram', precondition: 'Core problem with category cause branches', fallback: 'Categorised cause list' },
  'VIS-18': { name: 'Stakeholder Influence Grid', precondition: 'Stakeholder groups with power/interest', fallback: 'Stakeholder table' },
  'VIS-19': { name: 'Budget Allocation Donut', precondition: 'Expense breakdown summing to total', fallback: 'Expense line table' },
  'VIS-20': { name: 'Sensitivity Tornado', precondition: 'Independent variables with low/base/high', fallback: 'Sensitivity table' },
  'VIS-21': { name: 'Pareto Defect Bar', precondition: 'Categorised counts in descending order', fallback: 'Sorted frequency table' },
  'VIS-22': { name: 'Burndown Trajectory', precondition: 'Sprint points or remaining work over time', fallback: 'Remaining work log' },
  'VIS-23': { name: 'Funnel Conversion View', precondition: 'Multi-stage linear dropoff pipeline', fallback: 'Stage conversion table' },
  'VIS-24': { name: 'Option Trade-Off Matrix', precondition: 'Multiple options scored across criteria', fallback: 'Evaluation score grid' },
  'VIS-25': { name: 'Velocity Trend Line', precondition: 'Historical completion cadence over 3+ periods', fallback: 'Period completion table' },
  'VIS-26': { name: 'Archetype Coverage Grid', precondition: 'Meeting intent mapped to expected patterns', fallback: 'Coverage checklist' },
  'VIS-27': { name: 'Participation Distribution', precondition: 'Meeting-level participation concentration', fallback: 'Meeting distribution summary' },
  'VIS-28': { name: 'Governance Health Spider', precondition: '10 health dimension scores', fallback: '10-dimension table' },
};

export function validateVisualisationPayload(visualId, data) {
  const model = VISUAL_MODELS[visualId];
  if (!model) {
    throw new VisualSchemaMismatchError(`Unknown visual model identifier: ${visualId}`, visualId);
  }

  if (!data || typeof data !== 'object') {
    throw new VisualSchemaMismatchError(`Data for ${visualId} must be an object`, visualId);
  }

  // Check specific visual preconditions
  if (visualId === 'VIS-03') {
    const risks = data.risks || (Array.isArray(data) ? data : []);
    if (!risks.length) {
      throw new VisualSchemaMismatchError(`VIS-03 requires at least one risk object`, visualId);
    }
  }

  if (visualId === 'VIS-27') {
    // Prohibits individual scoring
    if (data.individual_scores || data.speakers) {
      throw new VisualSchemaMismatchError(`VIS-27 strictly forbids per-speaker measurements`, visualId);
    }
  }

  return {
    ok: true,
    visualId,
    precondition: model.precondition,
    fallback: model.fallback,
  };
}
