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

export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Plain text / Markdown / CSV / JSON
  if (['txt', 'text', 'md', 'markdown', 'csv', 'json', 'log'].includes(extension) || file.type.startsWith('text/')) {
    const text = await file.text();
    return {
      name: file.name,
      size: file.size,
      type: extension || 'text',
      text: text.trim(),
    };
  }

  // 2. Microsoft Word (.docx)
  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return {
      name: file.name,
      size: file.size,
      type: 'docx',
      text: (result.value || '').trim(),
    };
  }

  // 3. Adobe PDF (.pdf)
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
    throw new Error(`Unsupported file format (.${extension}). Please upload PDF, Word (.docx), or plain text (.txt, .md).`);
  }
}
