/**
 * Tasklet 4.10: Recommendation Reporting and Delivery Service
 * 
 * Compiles ranked recommendations into the Recommendation log entry (OUT-42).
 * Rule: Deterministic compilation. Carries qualified review notice.
 */

import { QUALIFIED_REVIEW_NOTE } from './executiveRecommendationService.mjs';

export function compileRecommendationLogOut42(recommendations = [], metadata = {}) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Recommendation Log Entry (OUT-42)</title>
  <style>
    body { font-family: 'Inter', sans-serif; color: #16263F; line-height: 1.6; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1, h2, h3 { font-family: 'Poppins', sans-serif; color: #16263F; }
    .rec-card { border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 20px; background: #FFFFFF; }
    .rec-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 10px; margin-bottom: 12px; }
    .rec-code { font-family: 'Poppins', sans-serif; font-weight: bold; color: #21395C; font-size: 14px; }
    .badge { font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 600; }
    .badge-p1 { background: #FEE2E2; color: #991B1B; }
    .badge-p2 { background: #FFEDD5; color: #9A3412; }
    .badge-p3 { background: #FEF3C7; color: #92400E; }
    .benefit { background: #F0FDF4; border-left: 3px solid #22C55E; padding: 10px 14px; font-size: 13px; margin: 12px 0; }
    .citation { font-size: 11px; color: #64748B; font-style: italic; }
    .review-notice { margin-top: 32px; padding: 14px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <h1>Recommendation Log (OUT-42)</h1>
  <p>Meeting Reference: ${metadata.meeting_id || 'Active Workspace Record'} | Generated: ${new Date().toISOString()}</p>
`;

  for (const rec of recommendations) {
    const pCode = rec.priority_code || 'P3';
    const badgeClass = pCode === 'P1' ? 'badge-p1' : (pCode === 'P2' ? 'badge-p2' : 'badge-p3');

    html += `  <div class="rec-card" id="rec-${rec.recommendation_code.toLowerCase()}">\n`;
    html += `    <div class="rec-header">\n`;
    html += `      <span class="rec-code">#${rec.priority_rank || 1} &middot; ${rec.recommendation_code} &middot; ${rec.title}</span>\n`;
    html += `      <span class="badge ${badgeClass}">${rec.category} &middot; Effort: ${rec.implementation_effort || 'MED'}</span>\n`;
    html += `    </div>\n`;
    html += `    <p>${rec.recommendation_text}</p>\n`;
    html += `    <div class="benefit"><strong>Expected Benefit:</strong> ${rec.expected_business_benefit}</div>\n`;

    if (rec.evidence_citations && rec.evidence_citations.length > 0) {
      const cite = rec.evidence_citations[0];
      html += `    <div class="citation">Evidence Grounding: "${cite.quote || 'Discussion record'}" (Timestamp: ${cite.timestamp || '00:00'})</div>\n`;
    }

    html += `  </div>\n`;
  }

  html += `  <div class="review-notice">${QUALIFIED_REVIEW_NOTE}</div>\n`;
  html += `</body>\n</html>`;

  return html;
}
