import React, { useEffect, useState, useRef } from 'react';
import { Printer, Download, Sparkles, Check, Copy, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { renderConcludoReport } from '../lib/reporting/concludoReport';
import { parseOutputToPayload } from '../lib/reporting/payloadFromOutput';
import { ConcludoReportPayload } from '../lib/reporting/payloadTypes';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker if available
if (typeof window !== 'undefined' && (pdfjsLib as any).GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

interface OutputDocumentRendererProps {
  outputType: string;
  rawContent: string;
  projectTitle: string;
  meetingDate?: string;
  organisationName?: string;
  onCopy?: () => void;
  copied?: boolean;
}

export const OutputDocumentRenderer: React.FC<OutputDocumentRendererProps> = ({
  outputType,
  rawContent,
  projectTitle,
  meetingDate = new Date().toISOString().slice(0, 10),
  organisationName = 'Concludo Client',
  onCopy,
  copied = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // Compile boardroom PDF using Concludo Design Spec
  useEffect(() => {
    let active = true;

    async function compilePdf() {
      try {
        setLoading(true);
        setError(null);

        const payload: ConcludoReportPayload = parseOutputToPayload(
          outputType,
          rawContent,
          projectTitle,
          meetingDate,
          organisationName,
          'starter'
        );

        const result = await renderConcludoReport(payload);
        if (!active) return;

        setPdfBytes(result.pdfBytes);
        setNumPages(result.pages);
        setCurrentPage(1);

        // Load document into pdfjs for high-fidelity canvas rendering
        const loadingTask = pdfjsLib.getDocument({ data: result.pdfBytes });
        const doc = await loadingTask.promise;
        if (!active) return;
        setPdfDoc(doc);
      } catch (err: any) {
        console.error('Failed to compile Concludo Boardroom PDF:', err);
        if (active) {
          setError(err?.message || 'Failed to compile Concludo Boardroom PDF document');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    compilePdf();

    return () => {
      active = false;
    };
  }, [outputType, rawContent, projectTitle, meetingDate, organisationName]);

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Render at 2x device scale for crisp boardroom typography
        const scale = 1.8;
        const viewport = page.getViewport({ scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Canvas render error:', err);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage]);

  const handleDownloadPdf = () => {
    if (!pdfBytes) return;
    setDownloading(true);
    try {
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${outputType}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top action toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          background: 'rgba(9, 14, 26, 0.95)',
          padding: '12px 18px',
          borderRadius: '8px',
          border: '1px solid rgba(226, 181, 60, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#e2b53c" />
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>
            Concludo Boardroom Document System (A4 Standard)
          </span>
          {numPages > 0 && (
            <span
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(226, 181, 60, 0.15)',
                color: '#e2b53c',
                border: '1px solid rgba(226, 181, 60, 0.3)',
              }}
            >
              Page {currentPage} of {numPages}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
            >
              {copied ? (
                <>
                  <Check size={14} color="#34d399" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !pdfBytes}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
          >
            <Printer size={14} />
            <span>Print Sheet</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || downloading || !pdfBytes}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              padding: '6px 14px',
              background: '#e2b53c',
              color: '#101b2e',
              fontWeight: 600,
              border: 'none',
            }}
          >
            <Download size={14} />
            <span>{downloading ? 'Compiling PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* RENDERED BOARDROOM DOCUMENT VIEWER */}
      <div
        style={{
          background: '#101B2E',
          padding: '24px 16px',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
          minHeight: '600px',
        }}
      >
        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc' }}>
              Compiling Concludo Boardroom Document...
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Generating vector typography, governance lines, and proof register
            </p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '24px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={32} style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Failed to render document</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div
              style={{
                width: '100%',
                maxWidth: '794px', // Standard A4 display width (210mm at 96dpi)
                boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
                borderRadius: '4px',
                overflow: 'hidden',
                background: '#FFFFFF',
              }}
            >
              <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>

            {/* Pagination Controls */}
            {numPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '18px',
                  background: 'rgba(9, 14, 26, 0.85)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid rgba(226, 181, 60, 0.2)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>
                  Page <strong style={{ color: '#e2b53c' }}>{currentPage}</strong> of <strong>{numPages}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
                  disabled={currentPage >= numPages}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
