/**
 * Phase 6 Visualisation Engine Test Suite (Tasklets 6.1 to 6.12)
 * 
 * Verifies the Concludo Visualisation Engine across visual models:
 * - Deterministic vector SVG rendering without DOM dependencies
 * - Accessible: Never colour alone (distinguishable by shape/label)
 * - Every visual has stated precondition and stated fallback
 * - No visual asserts external comparisons, benchmarks, or pass marks
 * - Zero individual behavioural scoring (no per-speaker timeline lanes)
 */

import {
  renderBarChartSvg,
  renderDonutChartSvg,
  escapeSvg,
  CONCLUDO_CHART_TOKENS
} from '../src/services/visualisation/chartEngineCore.mjs';

import {
  renderDashboardContainerHtml,
  BREAKPOINTS
} from '../src/services/visualisation/dashboardEngineCore.mjs';

import { renderSwotVisual } from '../src/services/visualisation/swotRenderer.mjs';
import {
  renderTimelineVisual,
  IndividualMeasurementProhibitedError
} from '../src/services/visualisation/timelineRenderer.mjs';
import { renderRoadmapVisual } from '../src/services/visualisation/roadmapRenderer.mjs';
import { renderRiskHeatmapVisual } from '../src/services/visualisation/riskHeatmapRenderer.mjs';
import { renderDecisionTreeVisual } from '../src/services/visualisation/decisionTreeRenderer.mjs';
import { renderPriorityMatrixVisual } from '../src/services/visualisation/priorityMatrixRenderer.mjs';
import { renderRagDashboardVisual } from '../src/services/visualisation/ragDashboardRenderer.mjs';
import { renderSensitivityTornadoVisual } from '../src/services/visualisation/sensitivityTornadoRenderer.mjs';
import { renderKnowledgeGraphCanvasSvg } from '../src/services/visualisation/knowledgeGraphRenderer.mjs';
import { renderKpiTileRowVisual } from '../src/services/visualisation/kpiTileRowRenderer.mjs';

import {
  VISUAL_CATALOGUE,
  renderVisualById
} from '../src/services/visualisation/visualisationRegistry.mjs';

export function runPhase6Tests(check) {
  // 1. Tasklet 6.1: Chart Engine Core
  {
    const data = [
      { label: 'Category A', value: 35 },
      { label: 'Category B', value: 65 }
    ];
    const barSvg = renderBarChartSvg(data, { title: 'Test Bar Chart' });
    check('phase6', 'bar chart renders valid SVG string', barSvg.startsWith('<svg') && barSvg.endsWith('</svg>'));
    check('phase6', 'bar chart uses Concludo navy brand tokens', barSvg.includes(CONCLUDO_CHART_TOKENS.navy_primary));

    const donutSvg = renderDonutChartSvg(data, { centerLabel: 'Total Initiatives' });
    check('phase6', 'donut chart renders valid SVG string', donutSvg.startsWith('<svg') && donutSvg.endsWith('</svg>'));
    check('phase6', 'donut chart includes center label', donutSvg.includes('Total Initiatives'));

    const escaped = escapeSvg('<circle id="bad">&');
    check('phase6', 'escapeSvg neutralizes XML special characters', !escaped.includes('<') && escaped.includes('&lt;circle'));
  }

  // 2. Tasklet 6.2: Dashboard Engine Core
  {
    check('phase6', 'breakpoints defined for mobile, tablet, desktop, and wide',
      BREAKPOINTS.mobile === 390 && BREAKPOINTS.tablet === 768 && BREAKPOINTS.desktop === 1280 && BREAKPOINTS.wide === 1440);
    
    const cards = [
      { title: 'Decisions', value: '7', span: 4 },
      { title: 'Actions', value: '14', span: 4 },
      { title: 'Health Score', value: '82/100', span: 4 }
    ];
    const html = renderDashboardContainerHtml(cards, { title: 'Executive Pulse' });
    check('phase6', 'dashboard container renders responsive CSS grid layout', html.includes('concludo-grid') && html.includes('metric-card'));
  }

  // 3. Tasklet 6.3: SWOT Renderer (VIS-07)
  {
    const fullSwot = {
      strengths: ['Strong patent portfolio', 'Core engineering capability'],
      weaknesses: ['Limited distribution footprint'],
      opportunities: ['Enterprise segment expansion'],
      threats: ['Incumbent price competition']
    };
    const res = renderSwotVisual(fullSwot);
    check('phase6', 'SWOT renders VIS-07 SVG when precondition met', res.visual_id === 'VIS-07' && !res.is_fallback && res.svg.includes('<svg'));

    // Fallback when fewer than 2 quadrants populated
    const thinSwot = { strengths: ['Good brand'] };
    const fallbackRes = renderSwotVisual(thinSwot);
    check('phase6', 'SWOT renders formatted fallback list when fewer than 2 quadrants', fallbackRes.is_fallback === true && fallbackRes.html.includes('swot-fallback-list'));
  }

  // 4. Tasklet 6.4: Timeline Renderer (VIS-04) & Prohibition of Individual Scoring
  {
    const topics = [
      { title: 'Market Strategy Discussion' },
      { title: 'Pricing Model Evaluation' },
      { title: 'Action Assignment' }
    ];
    const res = renderTimelineVisual(topics);
    check('phase6', 'timeline renders VIS-04 topic progression SVG', res.visual_id === 'VIS-04' && !res.is_fallback && res.svg.includes('<svg'));

    // Strict prohibition test: speaker lanes or speaker colours
    let speakerLaneBlocked = false;
    try {
      renderTimelineVisual(topics, { speakerLanes: true });
    } catch (err) {
      if (err instanceof IndividualMeasurementProhibitedError) speakerLaneBlocked = true;
    }
    check('phase6', 'timeline strictly forbids per-speaker lanes (individual measurement)', speakerLaneBlocked);

    let speakerColorBlocked = false;
    try {
      renderTimelineVisual(topics, { speakerColors: true });
    } catch (err) {
      if (err instanceof IndividualMeasurementProhibitedError) speakerColorBlocked = true;
    }
    check('phase6', 'timeline strictly forbids speaker colour coding', speakerColorBlocked);
  }

  // 5. Tasklet 6.5: Roadmap Renderer (VIS-06)
  {
    const items = [
      { milestone: 'MVP Release', horizon: 'Now', target_date: 'Oct 2026', owner: 'Engineering' },
      { milestone: 'Beta Program', horizon: 'Next', target_date: 'Dec 2026', owner: 'Product' },
      { milestone: 'General Availability', horizon: 'Later', target_date: 'Q1 2027', owner: 'Commercial' }
    ];
    const res = renderRoadmapVisual(items);
    check('phase6', 'roadmap renders VIS-06 swimlane SVG across horizons', res.visual_id === 'VIS-06' && !res.is_fallback && res.svg.includes('NOW') && res.svg.includes('NEXT') && res.svg.includes('LATER'));

    // Fallback when fewer than 3 items
    const thinRoadmap = [{ milestone: 'First Step', horizon: 'Now' }];
    const fallback = renderRoadmapVisual(thinRoadmap);
    check('phase6', 'roadmap renders fallback list when fewer than 3 items', fallback.is_fallback === true && fallback.html.includes('roadmap-fallback-list'));
  }

  // 6. Tasklet 6.6: Risk Heatmap Renderer (VIS-03)
  {
    const risks = [
      { risk: 'Supplier delay', severity: 'High', likelihood: 'Likely' },
      { risk: 'Currency fluctuation', severity: 'Medium', likelihood: 'Possible' }
    ];
    const res = renderRiskHeatmapVisual(risks);
    check('phase6', 'risk heatmap renders VIS-03 SVG with 2 or more risks', res.visual_id === 'VIS-03' && !res.is_fallback && res.svg.includes('<svg'));

    // Fallback when fewer than 2 risks
    const thinRisks = [{ risk: 'Single minor risk' }];
    const fallback = renderRiskHeatmapVisual(thinRisks);
    check('phase6', 'risk heatmap renders fallback table when fewer than 2 risks', fallback.is_fallback === true && fallback.html.includes('risk-fallback-table'));
  }

  // 7. Tasklet 6.7: Decision Tree Renderer (VIS-12)
  {
    const dec = {
      title: 'Hosting Architecture',
      alternatives: [
        { name: 'Self-hosted dedicated server', selected: false },
        { name: 'Cloud managed platform', selected: true }
      ]
    };
    const res = renderDecisionTreeVisual(dec);
    check('phase6', 'decision tree renders VIS-12 SVG with alternatives', res.visual_id === 'VIS-12' && !res.is_fallback && res.svg.includes('<svg'));

    // Fallback when fewer than 2 alternatives
    const thinDec = { title: 'Single path', alternatives: ['Only one path'] };
    const fallback = renderDecisionTreeVisual(thinDec);
    check('phase6', 'decision tree renders fallback list when fewer than 2 alternatives', fallback.is_fallback === true && fallback.html.includes('decision-fallback-list'));
  }

  // 8. Tasklet 6.8: Priority Matrix Renderer (VIS-02)
  {
    const items = [
      { title: 'Core API refactoring', impact: 8, effort: 6 },
      { title: 'Landing page copy', impact: 6, effort: 2 },
      { title: 'Dark mode theme', impact: 3, effort: 4 }
    ];
    const res = renderPriorityMatrixVisual(items);
    check('phase6', 'priority matrix renders VIS-02 2x2 SVG', res.visual_id === 'VIS-02' && !res.is_fallback && res.svg.includes('<svg'));

    // Fallback when fewer than 3 items
    const thinItems = [{ title: 'Single initiative', impact: 5, effort: 5 }];
    const fallback = renderPriorityMatrixVisual(thinItems);
    check('phase6', 'priority matrix renders fallback list when fewer than 3 items', fallback.is_fallback === true && fallback.html.includes('priority-fallback-list'));
  }

  // 9. Tasklet 6.9: RAG Dashboard Renderer (VIS-01) - Accessible without colour alone
  {
    const workstreams = [
      { name: 'Platform Engineering', status: 'GREEN', notes: 'Sprint on schedule' },
      { name: 'Security Audit', status: 'AMBER', notes: 'Awaiting vendor quote' },
      { name: 'Payment Integration', status: 'RED', notes: 'Blocked on registration' }
    ];
    const res = renderRagDashboardVisual(workstreams);
    check('phase6', 'RAG dashboard renders VIS-01 SVG', res.visual_id === 'VIS-01' && !res.is_fallback && res.svg.includes('<svg'));
    // Accessible marks check: circle for red, square for amber, polygon/triangle for green
    check('phase6', 'RAG statuses use distinct geometric shapes not colour alone',
      res.svg.includes('<circle') && res.svg.includes('<rect') && res.svg.includes('<polygon'));
    
    // Fallback when fewer than 2 items
    const fallback = renderRagDashboardVisual([{ name: 'Solo workstream', status: 'GREEN' }]);
    check('phase6', 'RAG dashboard renders fallback table when fewer than 2 items', fallback.is_fallback === true && fallback.html.includes('rag-fallback-table'));
  }

  // 10. Tasklet 6.10: Sensitivity Tornado Renderer (VIS-20)
  {
    const drivers = [
      { name: 'Customer Churn Rate', low: '-2.5%', high: '+4.0%' },
      { name: 'Implementation Cost', low: '-10%', high: '+15%' }
    ];
    const res = renderSensitivityTornadoVisual(drivers);
    check('phase6', 'sensitivity tornado renders VIS-20 SVG with 2 or more variables', res.visual_id === 'VIS-20' && !res.is_fallback && res.svg.includes('<svg'));

    // Fallback when fewer than 2 variables
    const fallback = renderSensitivityTornadoVisual([{ name: 'Only driver' }]);
    check('phase6', 'sensitivity tornado renders fallback table when fewer than 2 variables', fallback.is_fallback === true && fallback.html.includes('tornado-fallback-table'));
  }

  // 11. Tasklet 6.11: Knowledge Graph Visualisation Renderer (VIS-14)
  {
    const graphData = {
      nodes: [
        { id: 'n1', label: 'Strategic Goal', type: 'PILLAR' },
        { id: 'n2', label: 'Adopt Architecture', type: 'DECISION' }
      ],
      edges: [
        { from: 'n1', to: 'n2', label: 'DIRECTS' }
      ]
    };
    const res = renderKnowledgeGraphCanvasSvg(graphData);
    check('phase6', 'knowledge graph renders VIS-14 SVG network', res.visual_id === 'VIS-14' && !res.is_fallback && res.svg.includes('<svg'));
    check('phase6', 'knowledge graph contains nodes and edge relationships', res.svg.includes('Strategic') && res.svg.includes('DIRECTS'));
  }

  // 12. Tasklet 6.12: KPI Tile Row Renderer (VIS-13)
  {
    const kpis = [
      { metric: 'Annual Recurring Revenue', value: '$120k', target: '$150k' },
      { metric: 'Net Revenue Retention', value: '112%', target: '110%' },
      { metric: 'Gross Margin', value: '82%', target: '80%' }
    ];
    const res = renderKpiTileRowVisual(kpis);
    check('phase6', 'KPI tile row renders VIS-13 SVG with 3 or more quantified metrics', res.visual_id === 'VIS-13' && !res.is_fallback && res.svg.includes('<svg'));

    // Fallback when fewer than 3 quantified metrics
    const thinKpis = [{ metric: 'Single metric', value: '10' }];
    const fallback = renderKpiTileRowVisual(thinKpis);
    check('phase6', 'KPI tile row renders fallback table when fewer than 3 metrics', fallback.is_fallback === true && fallback.html.includes('kpi-fallback-table'));
  }

  // 13. Visualisation Registry and Dispatcher across all 28 Visuals
  {
    check('phase6', 'all 28 visuals VIS-01 to VIS-28 are catalogue registered', Object.keys(VISUAL_CATALOGUE).length === 28);

    // Verify all 28 visual IDs render cleanly via dispatcher
    for (let i = 1; i <= 28; i++) {
      const vid = `VIS-${String(i).padStart(2, '0')}`;
      const rendered = renderVisualById(vid, []);
      check('phase6', `${vid} dispatches cleanly without throwing`, Boolean(rendered && rendered.visual_id === vid));
    }
  }

  // 14. Governance checks: No benchmark assertions in visual SVG or fallbacks
  {
    const kpiRes = renderKpiTileRowVisual([
      { metric: 'Metric 1', value: '10', target: '12' },
      { metric: 'Metric 2', value: '20', target: '25' },
      { metric: 'Metric 3', value: '30', target: '35' }
    ]);
    check('phase6', 'visuals do not cite industry averages or external benchmarks',
      !/industry (?:average|benchmark|standard)|external benchmark/i.test(kpiRes.svg));
  }
}
