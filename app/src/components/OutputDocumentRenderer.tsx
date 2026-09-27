import React, { useEffect, useState, useRef } from 'react';
import {
  Printer,
  Download,
  Sparkles,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  Layers,
  FileCheck,
} from 'lucide-react';
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
  jsonPayload?: any;
  projectTitle: string;
  meetingDate?: string;
  organisationName?: string;
  onCopy?: () => void;
  copied?: boolean;
}

// Sub-component to render individual page canvas for "All Pages (Continuous)" mode
const PDFPageCanvasItem: React.FC<{
  pdfDoc: any;
  pageNum: number;
  scale?: number;
}> = ({ pdfDoc, pageNum, scale = 1.6 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        if (!cancelled) setRendered(true);
      } catch (err) {
        console.error(`Page ${pageNum} render error:`, err);
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '850px',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
        borderRadius: '4px',
        overflow: 'hidden',
        background: '#FFFFFF',
        marginBottom: '28px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(9, 14, 26, 0.75)',
          color: '#e2b53c',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 600,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        Page {pageNum}
      </div>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      {!rendered && (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#94a3b8' }}>
          <span style={{ fontSize: '0.8rem' }}>Loading page {pageNum}...</span>
        </div>
      )}
    </div>
  );
};

export const OutputDocumentRenderer: React.FC<OutputDocumentRendererProps> = ({
  outputType,
  rawContent,
  jsonPayload,
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
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
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

        let payload: ConcludoReportPayload;
        if (jsonPayload && jsonPayload.document && jsonPayload.meeting) {
          payload = jsonPayload as ConcludoReportPayload;
        } else {
          payload = parseOutputToPayload(
            outputType,
            rawContent,
            projectTitle,
            meetingDate,
            organisationName,
            'starter'
          );
        }

        const result = await renderConcludoReport(payload);
        if (!active) return;

        // Create isolated clone for download so pdfjs worker transfer cannot detach or invalidate it
        const downloadBytes = new Uint8Array(result.pdfBytes);
        const viewerBytes = new Uint8Array(result.pdfBytes);

        setPdfBytes(downloadBytes);
        setNumPages(result.pages);
        setCurrentPage(1);

        // Load document into pdfjs for high-fidelity canvas rendering using isolated clone
        const loadingTask = pdfjsLib.getDocument({ data: viewerBytes });
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
  }, [outputType, rawContent, jsonPayload, projectTitle, meetingDate, organisationName]);

  // Render single page when in 'single' view mode
  useEffect(() => {
    if (viewMode !== 'single' || !pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

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
  }, [pdfDoc, currentPage, viewMode]);

  // Robust PDF download using standard byte cloning and sanitized filename
  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      let dataToDownload = pdfBytes;
      // If pdfBytes is missing, empty or detached, re-render fresh pristine bytes
      if (!dataToDownload || dataToDownload.byteLength === 0 || dataToDownload.buffer.byteLength === 0) {
        let payload: ConcludoReportPayload;
        if (jsonPayload && jsonPayload.document && jsonPayload.meeting) {
          payload = jsonPayload;
        } else {
          payload = parseOutputToPayload(
            outputType,
            rawContent,
            projectTitle,
            meetingDate,
            organisationName,
            'starter'
          );
        }
        const fresh = await renderConcludoReport(payload);
        dataToDownload = new Uint8Array(fresh.pdfBytes);
        setPdfBytes(dataToDownload);
      }

      // Allocate fresh ArrayBuffer copy for the Blob
      const freshBuffer = new ArrayBuffer(dataToDownload.byteLength);
      new Uint8Array(freshBuffer).set(dataToDownload);
      const blob = new Blob([freshBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (projectTitle || 'Concludo_Document')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const safeType = (outputType || 'Report').replace(/[^a-zA-Z0-9_\-]/g, '_');
      link.download = `${safeTitle}_${safeType}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!pdfBytes) return;
    const cleanBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    );
    const blob = new Blob([new Uint8Array(cleanBuffer) as unknown as BlobPart], { type: 'application/pdf' });
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
      }, 2000);
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
          gap: '12px',
          background: 'rgba(9, 14, 26, 0.95)',
          padding: '12px 18px',
          borderRadius: '8px',
          border: '1px solid rgba(226, 181, 60, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Sparkles size={16} color="#e2b53c" />
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>
            Concludo Boardroom Document System (A4 Standard)
          </span>
          {numPages > 0 && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(226, 181, 60, 0.15)',
                color: '#e2b53c',
                border: '1px solid rgba(226, 181, 60, 0.3)',
              }}
            >
              {viewMode === 'all' ? `${numPages} Pages Complete` : `Page ${currentPage} of ${numPages}`}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* View mode toggle: View Entire PDF vs Single Page */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '2px',
              marginRight: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('all')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'all' ? '#e2b53c' : 'transparent',
                color: viewMode === 'all' ? '#101b2e' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
              title="View all pages continuously"
            >
              <Layers size={13} />
              <span>Entire PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'single' ? '#e2b53c' : 'transparent',
                color: viewMode === 'single' ? '#101b2e' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
              title="View one page at a time"
            >
              <Eye size={13} />
              <span>Single Page</span>
            </button>
          </div>

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
            <p style={{ margin: 0, fontWeight: 600 }}>Failed to render document</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>{error}</p>
          </div>
        )}

        {!loading && !error && pdfDoc && (
          <>
            {viewMode === 'all' ? (
              /* ENTIRE PDF CONTINUOUS VIEW */
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <PDFPageCanvasItem key={pageNum} pdfDoc={pdfDoc} pageNum={pageNum} />
                ))}
              </div>
            ) : (
              /* SINGLE PAGE VIEW WITH NAVIGATION */
              <>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '820px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: '#FFFFFF',
                  }}
                >
                  <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
                </div>

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
          </>
        )}
      </div>
    </div>
  );
};
