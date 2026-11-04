
/**
 * Converts HTML from mammoth.convertToHtml into structured Markdown preserving tables,
 * headings, list items, and line breaks so document mode intelligence can extract actions.
 */
export function htmlToMarkdown(htmlStr: string): string {
  // Convert <table> to markdown table
  let res = htmlStr.replace(/<table[\s\S]*?<\/table>/gi, (tbl) => {
    const rows = tbl.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const mdRows: string[] = [];
    let isHeader = true;
    for (const row of rows) {
      const cells = Array.from(row.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)).map((m) => {
        return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      });
      if (cells.length > 0) {
        mdRows.push('| ' + cells.join(' | ') + ' |');
        if (isHeader) {
          mdRows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
          isHeader = false;
        }
      }
    }
    return '\n\n' + mdRows.join('\n') + '\n\n';
  });

  // Convert headings
  res = res.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    return '\n\n' + '#'.repeat(Number(level)) + ' ' + content.replace(/<[^>]+>/g, ' ').trim() + '\n\n';
  });

  // Convert paragraphs and lists
  res = res.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  res = res.replace(/<br\s*\/?>/gi, '\n');
  res = res.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  res = res.replace(/<[^>]+>/g, ' ');
  res = res.replace(/&nbsp;/g, ' ');
  res = res.replace(/&amp;/g, '&');
  res = res.replace(/&lt;/g, '<');
  res = res.replace(/&gt;/g, '>');
  res = res.replace(/&quot;/g, '"');
  res = res.replace(/&#39;/g, "'");

  return res.replace(/\n{3,}/g, '\n\n').trim();
}

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF worker using bundled or CDN fallback
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch {
    // Fallback gracefully
  }
}

export interface ParsedDocument {
  name: string;
  size: number;
  type: string;
  text: string;
}

/**
 * Cleans WebVTT (.vtt) or SubRip (.srt) subtitle / transcript files into clean readable text
 */
function cleanTranscriptSubtitles(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip WEBVTT header, NOTE, or numeric sequence counters
    if (/^(?:WEBVTT|NOTE|\d+)$/i.test(trimmed)) continue;
    // Skip timestamp lines: 00:00:00.000 --> 00:00:05.000 or 00:00:00,000 --> 00:00:05,000
    if (/^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->\s+\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}/.test(trimmed)) continue;
    // Remove inline timestamp or styling tags: <v Speaker>text</v> or <00:00:01.000>
    const deTagged = trimmed
      .replace(/<v\s+([^>]+)>/gi, '$1: ')
      .replace(/<\/v>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (deTagged) {
      cleaned.push(deTagged);
    }
  }
  return cleaned.join('\n');
}

export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. WebVTT or SRT transcript files
  if (['vtt', 'srt'].includes(extension)) {
    const text = await file.text();
    return {
      name: file.name,
      size: file.size,
      type: extension,
      text: cleanTranscriptSubtitles(text),
    };
  }

  // 2. Plain text / Markdown / CSV / JSON
  if (['txt', 'text', 'md', 'markdown', 'csv', 'json', 'log'].includes(extension) || file.type.startsWith('text/')) {
    const text = await file.text();
    return {
      name: file.name,
      size: file.size,
      type: extension || 'text',
      text: text.trim(),
    };
  }

  // 3. Microsoft Word (.docx)
  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    // Convert to HTML first to preserve table rows, headers, and checkboxes
    const options: any = { arrayBuffer };
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      options.buffer = Buffer.from(arrayBuffer);
    }
    const htmlResult = await mammoth.convertToHtml(options);
    const markdownText = htmlToMarkdown(htmlResult.value || '');
    return {
      name: file.name,
      size: file.size,
      type: 'docx',
      text: markdownText || (await mammoth.extractRawText({ arrayBuffer })).value || '',
    };
  }

  // 4. Adobe PDF (.pdf)
  if (extension === 'pdf' || file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
    });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStr = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      if (pageStr.trim()) {
        fullText += (pageNum > 1 ? '\n\n' : '') + `[Page ${pageNum}]\n` + pageStr;
      }
    }
    return {
      name: file.name,
      size: file.size,
      type: 'pdf',
      text: fullText.trim(),
    };
  }

  // Fallback: attempt plain text read
  try {
    const text = await file.text();
    return {
      name: file.name,
      size: file.size,
      type: extension || 'unknown',
      text: text.trim(),
    };
  } catch {
    throw new Error(`Unsupported file format (.${extension}). Please upload PDF, Word (.docx), or plain text (.txt, .md, .vtt, .srt).`);
  }
}
