import { describe, it, expect } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Added Document Blue Glowing Neon Light', () => {
  const studioPath = path.resolve(__dirname, '../src/features/meeting-output/studio.js');
  const cssPath = path.resolve(__dirname, '../src/features/meeting-output/meeting-output.css');

  it('1. studio.js applies neon-glow and src-doc to added document sources', async () => {
    const studioJs = await fs.readFile(studioPath, 'utf8');
    expect(studioJs).toContain('neon-glow');
    expect(studioJs).toContain('src-doc');
    expect(studioJs).toContain('data-kind="${s.kind}"');
    expect(studioJs).toContain('data-document');
  });

  it('2. meeting-output.css defines blue glowing neon styles and keyframe animation', async () => {
    const css = await fs.readFile(cssPath, 'utf8');
    expect(css).toContain('.cmo .src.neon-glow');
    expect(css).toContain('.cmo .src.src-doc');
    expect(css).toContain('.cmo .sources .src');
    expect(css).toContain('cmo-neon-blue-glow');
    expect(css).toContain('rgba(0, 153, 255');
    expect(css).toContain('box-shadow');
  });

  it('3. Zero em or en dashes in modified files', async () => {
    const studioJs = await fs.readFile(studioPath, 'utf8');
    const css = await fs.readFile(cssPath, 'utf8');
    expect(studioJs).not.toContain('\u2014');
    expect(studioJs).not.toContain('\u2013');
    expect(css).not.toContain('\u2014');
    expect(css).not.toContain('\u2013');
  });
});
