/**
 * Tasklet 7.4: Print Formatting Engine
 * Configures CSS Paged Media print rules, ensuring A4 portrait dimensions,
 * 15mm margins, repeating headers, fixed footers, and orphan/widow suppression.
 */

export class PrintFormattingEngine {
  constructor(options = {}) {
    this.pageSize = options.pageSize || 'A4 portrait';
    this.margin = options.margin || '15mm';
  }

  getPrintCss(docHash = 'SHA256:7f9a2b8e3c1d4e5f', timestamp = new Date().toISOString()) {
    return `
@media print {
  @page {
    size: ${this.pageSize};
    margin: ${this.margin};
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'Inter', sans-serif;
      font-size: 9pt;
      color: #666666;
    }
    @bottom-left {
      content: "Ref: ${docHash} | ${timestamp.split('T')[0]}";
      font-family: monospace;
      font-size: 8pt;
      color: #888888;
    }
  }

  body.concludo-document {
    background-color: #FFFFFF !important;
    color: #000000 !important;
    font-size: 10pt;
  }

  .document-sheet {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }

  thead {
    display: table-header-group;
  }

  tfoot {
    display: table-footer-group;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  h1, h2, h3, h4, .section-title, .chapter-title {
    break-after: avoid;
    page-break-after: avoid;
    orphans: 3;
    widows: 3;
  }

  p, li {
    orphans: 2;
    widows: 2;
  }

  .col-id, td.col-id, th.col-id {
    white-space: nowrap !important;
  }

  .no-print {
    display: none !important;
  }
}
    `.trim();
  }
}
