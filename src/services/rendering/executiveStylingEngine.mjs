/**
 * Tasklet 7.2: Executive Styling Engine
 * Injects minified CSS adhering to brand_tokens.css and concludo-documents.css.
 * Navy #16263F & #21395C, Gold #E2B53C & #BC8A1C, Light #F4F6FA.
 * Poppins for headings, Inter for body.
 */

export class ExecutiveStylingEngine {
  constructor(options = {}) {
    this.mode = options.mode || 'screen'; // 'screen' or 'print'
  }

  getCss() {
    return `
:root {
  --concludo-navy-primary: #16263F;
  --concludo-navy-secondary: #21395C;
  --concludo-gold-primary: #E2B53C;
  --concludo-gold-secondary: #BC8A1C;
  --concludo-light-bg: #F4F6FA;
  --concludo-font-heading: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --concludo-font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --concludo-space-xs: 4px;
  --concludo-space-sm: 8px;
  --concludo-space-md: 16px;
  --concludo-space-lg: 24px;
  --concludo-space-xl: 32px;
}

body.concludo-document {
  margin: 0;
  padding: 0;
  font-family: var(--concludo-font-body);
  color: var(--concludo-navy-primary);
  background-color: var(--concludo-light-bg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.document-sheet {
  max-width: 210mm;
  margin: 0 auto;
  padding: 20mm;
  background-color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(22, 38, 63, 0.08);
  box-sizing: border-box;
}

h1, h2, h3, h4, .document-title, .section-title, .chapter-title {
  font-family: var(--concludo-font-heading);
  color: var(--concludo-navy-primary);
  margin-top: 0;
  break-after: avoid;
}

.document-title {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: var(--concludo-space-sm);
  border-bottom: 2px solid var(--concludo-gold-primary);
  padding-bottom: var(--concludo-space-xs);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--concludo-navy-secondary);
  border-bottom: 1px solid var(--concludo-light-bg);
  padding-bottom: var(--concludo-space-xs);
  margin-top: var(--concludo-space-lg);
  margin-bottom: var(--concludo-space-md);
}

.classification-banner {
  display: inline-block;
  background-color: var(--concludo-navy-primary);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 2px;
  margin-bottom: var(--concludo-space-sm);
  text-transform: uppercase;
}

.provenance-badge {
  font-size: 12px;
  color: var(--concludo-navy-secondary);
  margin-bottom: var(--concludo-space-xs);
}

.independence-line {
  font-size: 11px;
  color: #555555;
  font-style: italic;
  margin-bottom: var(--concludo-space-sm);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--concludo-space-sm);
  background-color: var(--concludo-light-bg);
  padding: var(--concludo-space-sm) var(--concludo-space-md);
  border-radius: 4px;
  margin-bottom: var(--concludo-space-md);
  font-size: 13px;
}

.meta-k {
  font-weight: 600;
  color: var(--concludo-navy-secondary);
}

.standfirst-card {
  background-color: #FAFBFD;
  border-left: 4px solid var(--concludo-gold-primary);
  padding: var(--concludo-space-md);
  margin-bottom: var(--concludo-space-md);
  font-size: 15px;
  font-weight: 500;
}

.concludo-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--concludo-space-md);
  font-size: 13px;
}

.concludo-table th {
  background-color: var(--concludo-navy-primary);
  color: #FFFFFF;
  text-align: left;
  padding: 8px 10px;
  font-family: var(--concludo-font-heading);
  font-weight: 600;
}

.concludo-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #E0E4EC;
  vertical-align: top;
}

.concludo-table tr {
  break-inside: avoid;
}

.col-id {
  font-family: monospace;
  font-weight: 600;
  white-space: nowrap;
}

.priority-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 700;
  font-size: 11px;
  color: #FFFFFF;
}

.priority-P1 { background-color: #B91C1C; }
.priority-P2 { background-color: var(--concludo-gold-secondary); }
.priority-P3 { background-color: var(--concludo-navy-secondary); }
.priority-P4 { background-color: #6B7280; }

.citations-bar {
  margin-top: var(--concludo-space-sm);
  font-size: 11px;
  color: #666666;
}

.citation-tag {
  background-color: var(--concludo-light-bg);
  border: 1px solid #CCD4E0;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: monospace;
}

.restricted-notice-box, .unscored-notice-box {
  background-color: #FFFBEB;
  border: 1px solid var(--concludo-gold-primary);
  padding: var(--concludo-space-md);
  border-radius: 4px;
  font-size: 13px;
}

.health-summary-panel {
  display: flex;
  align-items: center;
  gap: var(--concludo-space-md);
  background-color: var(--concludo-light-bg);
  padding: var(--concludo-space-md);
  border-radius: 4px;
}

.health-score-card {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.health-score-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--concludo-navy-primary);
  font-family: var(--concludo-font-heading);
}

.health-score-max {
  font-size: 14px;
  color: #666666;
}

.health-band-badge {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.band-Excellent { background-color: #D1FAE5; color: #065F46; }
.band-Good { background-color: #DBEAFE; color: #1E40AF; }
.band-Average { background-color: #FEF3C7; color: #92400E; }
.band-Poor { background-color: #FEE2E2; color: #991B1B; }

.doc-colophon {
  margin-top: var(--concludo-space-xl);
  border-top: 1px solid #CCD4E0;
  padding-top: var(--concludo-space-md);
  font-size: 11px;
  color: #666666;
}

.colophon-grid {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
    `.trim();
  }
}
