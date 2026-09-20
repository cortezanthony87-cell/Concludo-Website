/**
 * Tasklet 6.10: Sensitivity Tornado Renderer (VIS-20)
 * 
 * Renders the Sensitivity tornado (VIS-20) displaying parameter sensitivity and assumption ranges.
 * Precondition: 2 or more stated variables with ranges.
 * Fallback: Assumption table.
 */

import { escapeSvg } from './chartEngineCore.mjs';
import { renderSensitivityTornadoSvg } from '../insights/insightVisualisationService.mjs';

export function renderSensitivityTornadoVisual(drivers = [], options = {}) {
  if (!drivers || drivers.length < 2) {
    return {
      visual_id: 'VIS-20',
      is_fallback: true,
      precondition: '2 or more stated variables with swing ranges',
      html: `
        <div class="tornado-fallback-table" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Assumption Sensitivity (Table View)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 2 sensitivity variables stated. Rendered as formatted table.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr style="background: #F1F5F9;"><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Variable</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">Low Range</th><th style="border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left;">High Range</th></tr>
            ${(drivers && drivers.length > 0)
              ? drivers.map((d) => `<tr><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(d.name || 'Variable')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(d.low || '-10%')}</td><td style="border: 1px solid #E2E8F0; padding: 4px 8px;">${escapeSvg(d.high || '+10%')}</td></tr>`).join('')
              : '<tr><td colspan="3" style="border: 1px solid #E2E8F0; padding: 6px 8px; font-style: italic; color: #64748B;">No sensitivity variables stated in source record.</td></tr>'
            }
          </table>
        </div>
      `
    };
  }

  return {
    visual_id: 'VIS-20',
    is_fallback: false,
    svg: renderSensitivityTornadoSvg(drivers)
  };
}
