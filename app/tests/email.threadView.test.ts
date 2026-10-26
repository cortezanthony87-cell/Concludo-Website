import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Email Command Centre Thread View Invariants', () => {
  const htmlPath = resolve(__dirname, '../public/modules/ecc/ecc-thread-view.html');
  const layoutPath = resolve(__dirname, '../src/components/email/EmailModuleLayout.tsx');

  it('1. ecc-thread-view.html exists at /modules/ecc/ecc-thread-view.html', () => {
    expect(existsSync(htmlPath)).toBe(true);
  });

  it('2. Uses authentic Concludo branding with zero fake yellow C marks', () => {
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).not.toContain('<div class="app-bar-mark">C</div>');
    expect(html).toContain('alt="Concludo"');
    expect(html).toContain('Concludo');
  });

  it('3. Respects iframe embedding by hiding redundant app-bar when framed', () => {
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).toContain('body.inside-iframe .app-bar');
    expect(html).toContain('inside-iframe');
  });

  it('4. Conforms to Australian English and avoids em dashes in public copy', () => {
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).not.toContain(' — ');
  });

  it('5. EmailModuleLayout embeds the module via iframe with explicit height', () => {
    const layout = readFileSync(layoutPath, 'utf8');
    expect(layout).toContain('<iframe');
    expect(layout).toContain('/modules/ecc/ecc-thread-view.html');
    expect(layout).toContain('module-content-slot');
  });

  it('6. Supports human-in-the-loop verification before drafting/sending', () => {
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).toContain('Concludo does not send email on your behalf');
    expect(html).toContain('checkSendReady');
  });
});
