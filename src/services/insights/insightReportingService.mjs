/**
 * Tasklet 3.12: Insight Reporting and Export Service
 * 
 * Compile curated insights into downloadable diagnostic reports and briefing annexures.
 * Rule: Channel questions are registry strings verbatim and render as the section heading.
 */

export const REGISTRY_CHANNEL_HEADINGS = {
  'INS-A': 'What did participants miss?',
  'INS-B': 'Which assumptions are weak?',
  'INS-C': 'What risks were not discussed?',
  'INS-D': 'What opportunities were not discussed?',
  'INS-E': 'What dependencies exist?',
  'INS-F': 'What should happen next?',
  'INS-G': 'What patterns exist in prior work?',
  'INS-H': 'What would an adviser likely recommend?'
};

export function compileInsightAnnexureHtml(curatedInsights = [], metadata = {}) {
  const byChannel = {};
  for (const item of curatedInsights) {
    const ch = item.channel_id;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(item);
  }

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Concludo Insight Annexure</title>
  <style>
    body { font-family: 'Inter', sans-serif; color: #16263F; line-height: 1.6; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1, h2, h3 { font-family: 'Poppins', sans-serif; color: #16263F; }
    .channel-section { margin-bottom: 32px; border-bottom: 1px solid #E5E7EB; padding-bottom: 24px; }
    .finding-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
    .comparison-basis { font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase; margin-bottom: 6px; }
    .observation { font-size: 14px; margin: 0; color: #1E293B; }
    .audit-note { font-size: 12px; color: #94A3B8; margin-top: 40px; text-align: center; }
  </style>
</head>
<body>
  <h1>Concludo Insight Annexure</h1>
  <p>Meeting Reference: ${metadata.meeting_id || 'Active Record'} | Generated: ${new Date().toISOString()}</p>
`;

  // Render each active channel section with exact registry question string as heading
  for (const [chId, heading] of Object.entries(REGISTRY_CHANNEL_HEADINGS)) {
    const items = byChannel[chId] || [];
    if (items.length === 0) continue;

    html += `  <div class="channel-section" id="channel-${chId.toLowerCase()}">\n`;
    html += `    <h2>${heading}</h2>\n`;

    for (const item of items) {
      const text = item.observation_text || item.question_text || '';
      const basis = item.comparison_basis || 'Corporate Governance Standard';

      html += `    <div class="finding-card">\n`;
      html += `      <div class="comparison-basis">Basis: ${basis}</div>\n`;
      html += `      <p class="observation">${text}</p>\n`;
      html += `    </div>\n`;
    }

    html += `  </div>\n`;
  }

  html += `  <div class="audit-note">Concludo Intelligence Engine. Evidence-grounded advisory output.</div>\n`;
  html += `</body>\n</html>`;

  return html;
}

export function compileInsightAnnexureMarkdown(curatedInsights = [], metadata = {}) {
  const byChannel = {};
  for (const item of curatedInsights) {
    const ch = item.channel_id;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(item);
  }

  let md = `# Concludo Insight Annexure\n\n`;
  md += `Meeting Reference: ${metadata.meeting_id || 'Active Record'} | Date: ${new Date().toISOString()}\n\n`;

  for (const [chId, heading] of Object.entries(REGISTRY_CHANNEL_HEADINGS)) {
    const items = byChannel[chId] || [];
    if (items.length === 0) continue;

    md += `## ${heading}\n\n`;

    for (const item of items) {
      const text = item.observation_text || item.question_text || '';
      const basis = item.comparison_basis || 'Corporate Governance Standard';

      md += `- **Basis**: ${basis}\n`;
      md += `  **Observation**: ${text}\n\n`;
    }
  }

  return md;
}
