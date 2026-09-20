/**
 * Tasklet 6.8: Priority Matrix Renderer (VIS-02)
 * 
 * Renders the Priority matrix 2x2 (VIS-02) for operational and recommendation triage.
 * Precondition: 3 or more items with impact and effort.
 * Fallback: Ranked list.
 */

import { escapeSvg } from './chartEngineCore.mjs';
import { renderPriorityMatrixSvg } from '../insights/insightVisualisationService.mjs';

export function renderPriorityMatrixVisual(items = [], options = {}) {
  if (!items || items.length < 3) {
    return {
      visual_id: 'VIS-02',
      is_fallback: true,
      precondition: '3 or more items with impact and effort ratings',
      html: `
        <div class="priority-fallback-list" style="padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; background: #FAFBFC; font-family: Inter, sans-serif;">
          <h4 style="font-family: Poppins, sans-serif; margin-top: 0; color: #16263F;">Priority Items (Ranked List)</h4>
          <p style="font-size: 10px; color: #64748B; margin-bottom: 8px;">Precondition unmet: fewer than 3 items with impact and effort. Rendered as ranked list.</p>
          <ol style="padding-left: 20px; font-size: 11px;">
            ${(items && items.length > 0)
              ? items.map((it) => `<li><strong>${escapeSvg(it.title || it.name || 'Item')}:</strong> Impact ${escapeSvg(it.impact || 5)}/10, Effort ${escapeSvg(it.effort || 5)}/10</li>`).join('')
              : '<li style="font-style: italic; color: #64748B;">No items available for prioritisation.</li>'
            }
          </ol>
        </div>
      `
    };
  }

  return {
    visual_id: 'VIS-02',
    is_fallback: false,
    svg: renderPriorityMatrixSvg(items)
  };
}
