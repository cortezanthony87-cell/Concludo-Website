import React, { useRef, useState } from 'react';
import { Printer, Download, Sparkles, Check, Copy } from 'lucide-react';
import html2pdf from 'html2pdf.js';

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
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Determine doc type badge label and kicker
  let docClassification = 'Commercial in confidence';
  let docKicker = 'Executive Paper · Decision & Action';
  let docSubheading = 'Governed Output Intelligence';

  if (outputType === 'summary') {
    docClassification = 'Commercial in confidence';
    docKicker = 'Executive Briefing · Summary of Proceedings';
    docSubheading = 'Executive Summary';
  } else if (outputType === 'action_plan') {
    docClassification = 'Operational Delivery';
    docKicker = 'Operational Plan · Five-Field Execution Standard';
    docSubheading = 'Operational Action Plan';
  } else if (outputType === 'decision_log') {
    docClassification = 'Corporate Governance';
    docKicker = 'Formal Record · Resolution Register';
    docSubheading = 'Governed Decision Log';
  }

  // Parse lines
  const lines = rawContent.split('\n').filter((l) => l.trim().length > 0);
  const leadParagraph = lines[0]?.startsWith('#')
    ? (lines[1]?.startsWith('###') || lines[1]?.startsWith('- **Status:**') ? lines[2] : lines[1]) || ''
    : lines[0] || '';

  const handleDownloadPdf = async () => {
    if (!documentRef.current) return;
    try {
      setDownloading(true);
      const opt = {
        margin: [12, 12, 12, 12],
        filename: `${projectTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${outputType}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };
      await (html2pdf() as any).from(documentRef.current).set(opt).save();
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper function to render inline markdown formatting (**bold**)
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: '#16263F', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
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
          background: 'rgba(9, 14, 26, 0.85)',
          padding: '12px 18px',
          borderRadius: '8px',
          border: '1px solid rgba(226, 181, 60, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#e2b53c" />
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>
            Claude Executive PDF Design System (A4 Standard)
          </span>
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
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
          >
            <Printer size={14} />
            <span>Print Sheet</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
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

      {/* RENDERED CLAUDE SPECIMEN DOCUMENT CONTAINER */}
      <div
        style={{
          background: '#101B2E',
          padding: '24px 16px',
          borderRadius: '10px',
          overflowX: 'auto',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
        }}
      >
        {/* Concludo Provenance Block (sits outside paper on dark navy ground) */}
        <div
          style={{
            maxWidth: '190mm',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              padding: '8px 16px',
              borderRadius: '2px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <img
              src="/brand/Concludo_lockup_horizontal_760w.png"
              alt="Concludo"
              style={{ width: '135px', height: 'auto', display: 'block' }}
            />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              lineHeight: 1.5,
              color: 'rgba(244, 246, 250, 0.7)',
              maxWidth: '52ch',
              textAlign: 'right',
            }}
          >
            Concludo Governed Output Intelligence. Structured executive briefing compiled from verified meeting records under enterprise governance controls.
          </p>
        </div>

        <div
          ref={documentRef}
          className="sheet"
          style={{
            maxWidth: '190mm',
            margin: '0 auto',
            background: '#FFFFFF',
            color: '#16263F',
            boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
            boxSizing: 'border-box',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '9.5pt',
            lineHeight: 1.5,
          }}
        >
          {/* HEADER LETTERHEAD (Tallowwood / Client style) */}
          <header
            className="letterhead pad"
            style={{
              padding: '24px 30px 16px',
              borderBottom: '2px solid #16263F',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '14pt',
                  fontWeight: 700,
                  color: '#16263F',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {organisationName}
              </div>
              <span style={{ fontSize: '7.5pt', color: '#52627A', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Operational & Governance Deliverable
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  display: 'inline-block',
                  background: '#16263F',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '2px',
                  fontSize: '8pt',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {docClassification}
              </div>
              <div style={{ fontSize: '8pt', color: '#52627A', marginTop: '4px', fontStyle: 'italic' }}>
                {docSubheading}
              </div>
            </div>
          </header>

          {/* CONTROL METADATA STRIP */}
          <div
            className="control pad"
            style={{
              padding: '12px 30px',
              background: '#F4F6FA',
              borderBottom: '1px solid #DDE3ED',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '10px 16px',
              fontSize: '8.5pt',
            }}
          >
            <div>
              <span style={{ display: 'block', color: '#8695A9', fontSize: '7pt', textTransform: 'uppercase', fontWeight: 600 }}>Paper Ref</span>
              <span style={{ fontWeight: 600, color: '#16263F' }}>CC-OUT-{outputType.slice(0, 4).toUpperCase()}</span>
            </div>
            <div>
              <span style={{ display: 'block', color: '#8695A9', fontSize: '7pt', textTransform: 'uppercase', fontWeight: 600 }}>Meeting</span>
              <span style={{ fontWeight: 600, color: '#16263F' }}>{projectTitle.slice(0, 24)}</span>
            </div>
            <div>
              <span style={{ display: 'block', color: '#8695A9', fontSize: '7pt', textTransform: 'uppercase', fontWeight: 600 }}>Date</span>
              <span style={{ fontWeight: 600, color: '#16263F' }}>{meetingDate}</span>
            </div>
            <div>
              <span style={{ display: 'block', color: '#8695A9', fontSize: '7pt', textTransform: 'uppercase', fontWeight: 600 }}>Prepared</span>
              <span style={{ fontWeight: 600, color: '#16263F' }}>Concludo Workspace</span>
            </div>
            <div>
              <span style={{ display: 'block', color: '#8695A9', fontSize: '7pt', textTransform: 'uppercase', fontWeight: 600 }}>Status</span>
              <span style={{ fontWeight: 600, color: '#16263F' }}>Working Paper · Not Minutes</span>
            </div>
          </div>

          {/* TITLEBLOCK */}
          <div className="titleblock pad" style={{ padding: '24px 30px 16px' }}>
            <p
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '8.5pt',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#BC8A1C',
                margin: '0 0 6px 0',
              }}
            >
              {docKicker}
            </p>
            <h1
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '18pt',
                fontWeight: 700,
                color: '#16263F',
                lineHeight: 1.25,
                margin: '0 0 10px 0',
              }}
            >
              {projectTitle}
            </h1>
            {leadParagraph && (
              <p
                style={{
                  fontSize: '9.5pt',
                  lineHeight: 1.55,
                  color: '#52627A',
                  margin: '0',
                  borderLeft: '3px solid #E2B53C',
                  paddingLeft: '12px',
                  background: '#F4F6FA',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                }}
              >
                {renderFormattedText(leadParagraph.replace(/^#+\s*/, ''))}
              </p>
            )}
          </div>

          {/* DOCUMENT BODY */}
          <div className="doc pad" style={{ padding: '10px 30px 30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {lines.slice(1).map((line, idx) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
                return (
                  <h2
                    key={idx}
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: '11.5pt',
                      fontWeight: 600,
                      color: '#16263F',
                      margin: '14px 0 4px',
                      paddingBottom: '4px',
                      borderBottom: '1.5px solid #16263F',
                    }}
                  >
                    {trimmed.replace(/^#+\s*/, '')}
                  </h2>
                );
              }

              if (trimmed.startsWith('|')) {
                // Table row
                const cells = trimmed
                  .split('|')
                  .filter((_, i, arr) => i > 0 && i < arr.length - 1)
                  .map((c) => c.trim());

                if (cells.every((c) => c.startsWith('---') || c.startsWith(':---'))) {
                  return null; // separator row
                }

                const isHeader = lines[idx - 1]?.includes('---') || lines[idx + 1]?.includes('---');

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
                      gap: '8px',
                      padding: '6px 8px',
                      background: isHeader ? '#16263F' : idx % 2 === 0 ? '#FFFFFF' : '#F4F6FA',
                      color: isHeader ? '#FFFFFF' : '#16263F',
                      fontWeight: isHeader ? 600 : 400,
                      fontSize: '8.5pt',
                      borderRadius: isHeader ? '2px' : '0',
                      borderBottom: '1px solid #DDE3ED',
                    }}
                  >
                    {cells.map((cell, cIdx) => (
                      <span key={cIdx}>{renderFormattedText(cell)}</span>
                    ))}
                  </div>
                );
              }

              if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '9pt', color: '#16263F' }}>
                    <span style={{ color: '#BC8A1C', fontWeight: 'bold' }}>•</span>
                    <span>{renderFormattedText(trimmed.replace(/^[-*]\s*/, ''))}</span>
                  </div>
                );
              }

              return (
                <p key={idx} style={{ fontSize: '9.2pt', lineHeight: 1.6, color: '#16263F', margin: 0 }}>
                  {renderFormattedText(trimmed)}
                </p>
              );
            })}
          </div>

          {/* COLOPHON / METHOD & LEGAL SAFEGUARD */}
          <footer
            className="sheetfoot pad"
            style={{
              margin: '20px 30px 0',
              padding: '12px 0 20px',
              borderTop: '1px solid #DDE3ED',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '7.5pt',
              color: '#8695A9',
            }}
          >
            <div>
              <strong>Concludo Pty Ltd</strong> · ACN 701 605 898 · ABN 61 701 605 898 · Melbourne, Victoria, Australia
            </div>
            <div>
              <span>Requires qualified review: working record for briefing purposes, not formal board minutes.</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
