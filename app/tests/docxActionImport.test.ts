import { describe, it, expect } from 'bun:test';
import { htmlToMarkdown } from '../src/lib/intelligence/fileParser';
import { runDocumentActionAgent } from '../src/lib/actions/documentActionAgent';
import { readFileSync } from 'fs';
import mammoth from 'mammoth';

describe('DOCX Action Plan Import & Agent Analysis', () => {
  it('converts Mammoth HTML to structured Markdown preserving tables and checkboxes', () => {
    const sampleHtml = `
      <h1>Stage 1: Launch</h1>
      <table>
        <tr><th>ID</th><th>Action</th><th>Owner</th><th>Due</th><th>Done</th><th>Tick</th></tr>
        <tr><td>A01</td><td>Send brief to lawyer</td><td>Anthony</td><td>9 Nov 2026</td><td>Brief sent</td><td>☐</td></tr>
      </table>
    `;
    const md = htmlToMarkdown(sampleHtml);
    expect(md).toContain('| ID | Action | Owner | Due | Done | Tick |');
    expect(md).toContain('| A01 | Send brief to lawyer | Anthony | 9 Nov 2026 | Brief sent | ☐ |');
  });

  it('successfully extracts actions from uploaded Concludo_Action_Plan_v1.docx', async () => {
    const docxPath = '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/uploads/Concludo_Action_Plan_v1.docx';
    const docxBuf = readFileSync(docxPath);
    const ab = docxBuf.buffer.slice(docxBuf.byteOffset, docxBuf.byteOffset + docxBuf.byteLength);

    // Support both Node Buffer and browser arrayBuffer
    const options: any = { arrayBuffer: ab, buffer: docxBuf };
    const htmlRes = await mammoth.convertToHtml(options);
    const md = htmlToMarkdown(htmlRes.value || '');
    expect(md.length).toBeGreaterThan(1000);

    const result = runDocumentActionAgent(md, 'Concludo_Action_Plan_v1.docx');
    expect(result.success).toBe(true);
    expect(result.actions.length).toBeGreaterThanOrEqual(88);
    expect(result.missingDateCount).toBeGreaterThan(0);

    // Verify first action attributes
    const first = result.actions[0];
    expect(first.title).toContain('Send the one-page brief');
    expect(first.owner).toContain('Anthony');
    expect(first.stage).toContain('Now to Day 14');
  });
});
