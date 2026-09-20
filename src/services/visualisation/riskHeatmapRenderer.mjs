/**
 * Tasklet 6.6: Risk Heatmap Renderer (VIS-03)
 * 
 * Renders the 5x5 Risk heat map (VIS-03) with WCAG AA compliant contrast and greyscale patterns.
 * Precondition: 2 or more stated risks with likelihood and severity.
 * Fallback: Risk register table.
 */

import { escapeSvg } from './chartEngineCore.mjs';
import { renderRiskHeatmapSvg } from '../insights/insightVisualisationService.mjs';

export function renderRiskHeatmapVisual(risks = [], options = {}) {
  if (!risks || risks.length < 2) {
    return {
      visual_id: 'VIS-03',
      is_fallback: true,
      precondition: '2 or more stated risks with likelihood and severity ratings',
      html: `
        <div class="risk-fallback-table" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Risk Register Summary (Table View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 2 stated risks. Rendered as formatted table.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr style="background: #F1F5F9;"><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Risk</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Severity</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Likelihood</th></tr>
            ${(risks && risks.length > 0)
              ? risks.map((r) => `<tr><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(r.risk || r.title || 'Risk item')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(r.severity || 'Medium')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(r.likelihood || 'Possible')}</td></tr>`).join('')
              : '<tr><td colspan="3" style="border: 1px solid #E2E8F0; padding: 6px 8px; font-style: italic; color: #64748B;">No explicit risks recorded in source transcript.</td></tr>'
            }
          </table>
        </div>
      `
    };
  }

  return {
    visual_id: 'VIS-03',
    is_fallback: false,
    svg: renderRiskHeatmapSvg(risks)
  };
}
