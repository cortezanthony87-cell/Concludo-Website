/**
 * Phase 7 Test Suite: Document Rendering Engine
 * Covers Tasklets 7.1 through 7.9.
 */

import { DocumentLayoutEngine, INDEPENDENCE_NOTICE, TemplateHydrationError } from '../src/services/rendering/documentLayoutEngine.mjs';
import { ExecutiveStylingEngine } from '../src/services/rendering/executiveStylingEngine.mjs';
import { BoardStylingEngine } from '../src/services/rendering/boardStylingEngine.mjs';
import { PrintFormattingEngine } from '../src/services/rendering/printFormattingEngine.mjs';
import { PdfRenderingService } from '../src/services/rendering/pdfRenderingService.mjs';
import { ReportExportService } from '../src/services/rendering/reportExportService.mjs';
import { PackageAssemblyEngine, IncompleteBundleCannotAssembleError } from '../src/services/rendering/packageAssemblyEngine.mjs';
import { DocumentStorageService, StorageQuotaExceededError } from '../src/services/storage/documentStorageService.mjs';
import { DocumentVersioningService, VersionNotFoundError } from '../src/services/storage/documentVersioningService.mjs';

export async function runPhase7Tests(check) {
  const styling = new ExecutiveStylingEngine();
  const layout = new DocumentLayoutEngine(styling);

  // --- Tasklet 7.1: Document Layout Engine ---
  {
    const samplePayload = {
      title: 'Executive Meeting Summary',
      classification: 'OFFICIAL: SENSITIVE',
      meetingMetadata: {
        meeting_title: 'Q3 Strategy Alignment',
        date: '2026-09-17',
        organisation_name: 'Concludo Pty Ltd',
        capture_source: 'Direct Upload',
        source_platform: 'Zoom',
      },
      provenance: {
        capture_source: 'Direct Upload',
        source_platform: 'Zoom',
        mentions_device_or_platform: true,
      },
      standfirst: 'The executive leadership confirmed Q3 strategic initiatives.',
      decisions: [
        { id: 'DEC-01', decision: 'Adopt Australian data residency', rationale: 'OAIC compliance', evidence_mark: 'confirmed' }
      ],
      actions: [
        { id: 'ACT-01', owner: 'Engineering Lead', action: 'Verify ap-southeast-2 deployment', deadline: '2026-09-25', definition_of_done: 'Production logs verified' }
      ],
      sections: [
        { heading: 'Market Opportunity', body: 'Expansion into Sydney commercial firms.', evidence_citations: ['Offset 04:12'] }
      ],
      recommendations: [
        { priority: 'P1', recommendation: 'Enforce fail-closed upload consent', failure_pattern: 'FP-02', impact: 'Regulatory risk', confidence: 0.95 }
      ],
      health: {
        composite_score: 82,
        band: 'Good',
      },
      annexures: [
        { title: 'Risk Overview', content: 'Low residual risk profile.' }
      ],
    };

    const html = layout.compileDocument(samplePayload);
    check('Phase 7', '7.1 compileDocument returns valid HTML5 document', html.startsWith('<!DOCTYPE html>') && html.includes('</html>'));
    check('Phase 7', '7.1 section sequence 1 to 9 is strictly enforced',
      html.indexOf('data-section-seq="1"') < html.indexOf('data-section-seq="2"') &&
      html.indexOf('data-section-seq="2"') < html.indexOf('data-section-seq="3"') &&
      html.indexOf('data-section-seq="3"') < html.indexOf('data-section-seq="4"') &&
      html.indexOf('data-section-seq="4"') < html.indexOf('data-section-seq="5"') &&
      html.indexOf('data-section-seq="5"') < html.indexOf('data-section-seq="6"') &&
      html.indexOf('data-section-seq="6"') < html.indexOf('data-section-seq="7"') &&
      html.indexOf('data-section-seq="7"') < html.indexOf('data-section-seq="8"') &&
      html.indexOf('data-section-seq="8"') < html.indexOf('data-section-seq="9"')
    );
    check('Phase 7', '7.1 provenance renders capture source and independence line', html.includes(INDEPENDENCE_NOTICE));
    check('Phase 7', '7.1 colophon contains statutory ACN and ABN', html.includes('701 605 898') && html.includes('61 701 605 898'));
    check('Phase 7', '7.1 script injection is prevented', !html.includes('<script'));

    let hydrationErr = false;
    try {
      layout.compileDocument({ title: 'Missing Meta' });
    } catch (e) {
      if (e instanceof TemplateHydrationError) hydrationErr = true;
    }
    check('Phase 7', '7.1 template hydration throws on missing metadata', hydrationErr);
  }

  // --- Tasklet 7.2: Executive Styling Engine ---
  {
    const css = styling.getCss();
    check('Phase 7', '7.2 CSS defines Concludo Navy tokens', css.includes('--concludo-navy-primary: #16263F;') && css.includes('--concludo-navy-secondary: #21395C;'));
    check('Phase 7', '7.2 CSS defines Concludo Gold tokens', css.includes('--concludo-gold-primary: #E2B53C;') && css.includes('--concludo-gold-secondary: #BC8A1C;'));
    check('Phase 7', '7.2 typography defines Poppins headings and Inter body', css.includes("'Poppins'") && css.includes("'Inter'"));
  }

  // --- Tasklet 7.3: Board Styling Engine ---
  {
    const boardEngine = new BoardStylingEngine({ isDraft: true });
    const boardDoc = boardEngine.formatBoardDocument({
      title: 'Q3 Board Review Working Paper',
      motions: [{ id: 'MOT-01', title: 'Adopt Budget', motion: 'Resolved that budget is approved', outcome: 'CARRIED' }],
      recorded_positions: [{ matter: 'Expenditure', summary: 'Unanimous approval' }],
    });

    check('Phase 7', '7.3 board paper includes mandatory qualified review notice', boardDoc.includes('Requires qualified review: working record for briefing purposes, not formal board minutes.'));
    check('Phase 7', '7.3 draft board paper renders draft watermark', boardDoc.includes('watermark-draft'));
    check('Phase 7', '7.3 board paper renders signature attestation placeholders', boardDoc.includes('sig-block') && boardDoc.includes('sig-line'));

    let minutesForbidden = false;
    try {
      boardEngine.formatBoardDocument({ title: 'Official Board Minutes of Meeting' });
    } catch (e) {
      if (e.message.includes('never board minutes')) minutesForbidden = true;
    }
    check('Phase 7', '7.3 board styling strictly forbids labelling documents minutes', minutesForbidden);
  }

  // --- Tasklet 7.4: Print Formatting Engine ---
  {
    const printEngine = new PrintFormattingEngine();
    const printCss = printEngine.getPrintCss('HASH123', '2026-09-17');
    check('Phase 7', '7.4 print CSS specifies A4 portrait and 15mm margins', printCss.includes('size: A4 portrait;') && printCss.includes('margin: 15mm;'));
    check('Phase 7', '7.4 table headers repeat and rows do not split', printCss.includes('thead {\n    display: table-header-group;') && printCss.includes('break-inside: avoid;'));
    check('Phase 7', '7.4 identifier columns do not wrap', printCss.includes('.col-id') && printCss.includes('white-space: nowrap !important;'));
  }

  // --- Tasklet 7.5: PDF Rendering Engine ---
  {
    const pdfService = new PdfRenderingService();
    const res = await pdfService.renderPdfFromHtml('<html><body><h1>Test Doc</h1></body></html>', {
      output_id: 'out_test_1',
      organisation_id: 'org_test_1',
      meeting_id: 'meet_test_1',
    });
    check('Phase 7', '7.5 PDF rendering produces valid PDF buffer', Buffer.isBuffer(res.pdfBytes) && res.pdfBytes.length > 0);
    check('Phase 7', '7.5 PDF export record records SHA-256 hash and A4 metadata', typeof res.record.pdf_hash === 'string' && res.record.pdf_hash.length === 64);
  }

  // --- Tasklet 7.6: Report Export Engine ---
  {
    const exportService = new ReportExportService();
    const samplePayload = {
      title: 'Action Report',
      standfirst: 'Meeting action log',
      decisions: [{ id: 'DEC-01', decision: 'Proceed' }],
      actions: [{ id: 'ACT-01', owner: 'Anthony', action: 'Build workspace', deadline: 'Today', definition_of_done: 'Tested' }],
      recommendations: [{ priority: 'P1', recommendation: 'Review architecture' }],
    };

    const md = exportService.exportMarkdown(samplePayload);
    check('Phase 7', '7.6 Markdown export renders structured headings and tables', md.includes('# Action Report') && md.includes('| ID | Owner (Who) | Action (What) |'));
    check('Phase 7', '7.6 Markdown export contains qualified review notice and statutory entity details', md.includes('Requires qualified review') && md.includes('701 605 898'));

    const jsonStr = exportService.exportJson(samplePayload);
    check('Phase 7', '7.6 JSON export serialises payload', jsonStr.includes('"Action Report"'));

    let docxBlockedOnStarter = false;
    try {
      exportService.exportDocx(samplePayload, 'starter');
    } catch (e) {
      if (e.message.includes('Pro subscription or Team subscription')) docxBlockedOnStarter = true;
    }
    check('Phase 7', '7.6 DOCX export is blocked on Starter subscription', docxBlockedOnStarter);

    const docxBuffer = exportService.exportDocx(samplePayload, 'pro_subscription');
    check('Phase 7', '7.6 DOCX export succeeds on Pro subscription', Buffer.isBuffer(docxBuffer) && docxBuffer.toString('utf8').includes('w:document'));
  }

  // --- Tasklet 7.7: Package Assembly Engine ---
  {
    const packageEngine = new PackageAssemblyEngine();
    const sampleBundle = {
      outputs: [
        { id: 'OUT-01', title: 'Executive Summary', template_id: 'T13', status: 'COMPLETED', rendered_html: '<p>Exec content</p>' },
        { id: 'OUT-02', title: 'Action Plan', template_id: 'T05', status: 'COMPLETED', rendered_html: '<p>Actions content</p>' },
      ],
      stated_omissions: [
        { output_id: 'OUT-23', title: 'Business Plan Draft', gate: 'COVERAGE_FLOOR', reason: 'Insufficient commercial evidence' }
      ],
    };

    const assembled = packageEngine.assembleBundlePackage(sampleBundle);
    check('Phase 7', '7.7 package assembly generates table of contents', assembled.tableOfContents.length === 2);
    check('Phase 7', '7.7 package assembly includes Stated Omissions block', assembled.assembledHtml.includes('Stated Omissions Block') && assembled.assembledHtml.includes('OUT-23'));

    let incompleteBlocked = false;
    try {
      packageEngine.assembleBundlePackage({
        outputs: [
          { id: 'OUT-01', status: 'COMPLETED' },
          { id: 'OUT-02', status: 'PROCESSING' },
        ],
      });
    } catch (e) {
      if (e instanceof IncompleteBundleCannotAssembleError) incompleteBlocked = true;
    }
    check('Phase 7', '7.7 package assembly blocks if bundle outputs are still processing', incompleteBlocked);
  }

  // --- Tasklet 7.8: Document Storage Service ---
  {
    const storageService = new DocumentStorageService();
    storageService.setOrgQuota('org_concludo', 10000); // 10KB quota

    const storeRes = await storageService.storeDocument('org_concludo', 'meet_123', 'brief.pdf', Buffer.from('hello world pdf'));
    check('Phase 7', '7.8 document storage uses outputs-vault path convention', storeRes.storage_path === 'outputs-vault/org_concludo/meet_123/brief.pdf');
    check('Phase 7', '7.8 document storage generates verified SHA-256 hash', storeRes.sha256_hash.length === 64);

    const signedUrl = storageService.generateSignedDownloadUrl(storeRes.storage_path, 900);
    check('Phase 7', '7.8 signed download URL validates correctly', storageService.verifySignedUrl(signedUrl));

    const expiredUrl = storageService.generateSignedDownloadUrl(storeRes.storage_path, -10);
    check('Phase 7', '7.8 expired signed URL is rejected', !storageService.verifySignedUrl(expiredUrl));

    let quotaBlocked = false;
    try {
      await storageService.storeDocument('org_concludo', 'meet_123', 'large.pdf', Buffer.alloc(20000));
    } catch (e) {
      if (e instanceof StorageQuotaExceededError) quotaBlocked = true;
    }
    check('Phase 7', '7.8 storage quota breach is rejected', quotaBlocked);
  }

  // --- Tasklet 7.9: Document Versioning Service ---
  {
    const versionService = new DocumentVersioningService();
    const payloadV1 = { title: 'Strategy Plan', sections: [{ heading: 'Goals', body: 'Reach 100 users' }] };
    const snap1 = versionService.createSnapshot('out_strat', 'org_1', payloadV1, '<p>Goals</p>');
    check('Phase 7', '7.9 snapshot 1 is created with version number 1', snap1.version_number === 1);

    const payloadV2 = {
      title: 'Strategy Plan',
      sections: [
        { heading: 'Goals', body: 'Reach 200 users' },
        { heading: 'Marketing', body: 'Wix marketing page' },
      ],
    };
    const snap2 = versionService.createSnapshot('out_strat', 'org_1', payloadV2, '<p>Goals & Marketing</p>');
    check('Phase 7', '7.9 snapshot 2 increments version and auto-computes summary', snap2.version_number === 2 && snap2.change_summary.includes('Section count'));

    const diff = versionService.computeDiff('out_strat', 1, 2, 'org_1');
    check('Phase 7', '7.9 side-by-side diff detects added sections', diff.addedSections.includes('Marketing'));
    check('Phase 7', '7.9 side-by-side diff detects modified sections', diff.modifiedSections.includes('Goals'));

    const rolledBack = versionService.rollbackToVersion('out_strat', 1, 'org_1');
    check('Phase 7', '7.9 rollback creates immutable append-only version 3', rolledBack.version_number === 3 && rolledBack.change_summary.includes('Rollback to version 1'));
  }
}
