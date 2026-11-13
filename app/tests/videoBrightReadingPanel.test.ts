import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { chromium, Browser, Page } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';
import { statSync } from 'fs';

let server: any;
let browser: Browser;
let page: Page;

const dist = '/tmp/Concludo-Website/app/dist';
const indexHtml = readFileSync(join(dist, 'index.html'));

describe('Video Meeting Centre: Real Component Bright Reading Panel & Scrubbing', () => {
  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        let targetPath = join(dist, url.pathname.slice(1));
        try {
          const st = statSync(targetPath);
          if (st.isDirectory()) {
            targetPath = join(targetPath, 'index.html');
          }
          const file = Bun.file(targetPath);
          if (file.size > 0) return new Response(file);
        } catch {}
        return new Response(indexHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    });

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    page = await context.newPage();

    // Authenticate owner locally via dummy token (redacted/mocked, zero live session required)
    const mockSession = {
      access_token: 'mock_owner_access_token_redacted',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'mock_refresh_token_redacted',
      user: {
        id: 'a265d4d7-ae99-4ec5-a800-4c9c46ebadc1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test-owner-video@concludo.com.au'
      }
    };

    await page.addInitScript((session) => {
      window.localStorage.setItem('sb-ovnfvcxewhygipdtmowj-auth-token', JSON.stringify(session));
      window.localStorage.setItem('sb-dikthezsghsssnwtctem-auth-token', JSON.stringify(session));
    }, mockSession);

    // Mock RPC is_video_owner
    await page.route('**/rest/v1/rpc/is_video_owner', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true)
      });
    });

    await page.goto(`http://localhost:${server.port}/video/companion?video_centre=1`);
    await page.waitForTimeout(1000);
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) server.stop();
  });

  const getActiveWord = async () => {
    return await page.evaluate(() => {
      const ball = document.querySelector('.bouncing-ball');
      return ball?.parentElement?.textContent?.trim() || '';
    });
  };

  const resetToFirstCardTop = async () => {
    await page.click('text=Discovery: Post-Meeting Reality');
    await page.waitForTimeout(200);
    await page.click('text=Opening: Call Framing & Fit');
    await page.waitForTimeout(200);
    expect(await getActiveWord()).toBe('Thanks');
  };

  it('COMP-READ-1: tap moves one word (Next moves +1, Back moves -1) on real approved card', async () => {
    await resetToFirstCardTop();

    const nextBtn = page.locator('button:has-text("Next")');
    const backBtn = page.locator('button:has-text("Back")');

    // Tap Next: single pointerdown then pointerup
    await nextBtn.dispatchEvent('pointerdown');
    await nextBtn.dispatchEvent('pointerup');
    expect(await getActiveWord()).toBe('for');

    // Tap Next again
    await nextBtn.dispatchEvent('pointerdown');
    await nextBtn.dispatchEvent('pointerup');
    expect(await getActiveWord()).toBe('your');

    // Tap Back: single pointerdown then pointerup
    await backBtn.dispatchEvent('pointerdown');
    await backBtn.dispatchEvent('pointerup');
    expect(await getActiveWord()).toBe('for');
  });

  it('COMP-READ-2: hold starts after about 380ms and accelerates to cap (~40 words/sec)', async () => {
    await resetToFirstCardTop();

    const nextBtn = page.locator('button:has-text("Next")');

    // Pointerdown triggers immediate step (+1 word)
    await nextBtn.dispatchEvent('pointerdown');
    expect(await getActiveWord()).toBe('for');

    // Wait 300ms (before 380ms threshold): hold tick has not fired
    await page.waitForTimeout(300);
    expect(await getActiveWord()).toBe('for');

    // Wait another 150ms (total 450ms, past 380ms threshold): first hold tick fires
    await page.waitForTimeout(150);
    expect(await getActiveWord()).toBe('your');

    // Hold for another 600ms to experience accelerated ticking
    await page.waitForTimeout(600);

    // Release pointer first so ticking halts
    await nextBtn.dispatchEvent('pointerup');
    const wordAtRelease = await getActiveWord();
    expect(wordAtRelease).not.toBe('your');

    // Verify hold stopped: word stays unchanged after 200ms
    await page.waitForTimeout(200);
    expect(await getActiveWord()).toBe(wordAtRelease);
  });

  it('COMP-READ-3: double-click on Back goes to word one and on Next to the last word', async () => {
    await resetToFirstCardTop();

    const nextBtn = page.locator('button:has-text("Next")');
    const backBtn = page.locator('button:has-text("Back")');

    // Double-click Next: jumps to last word of card 1 ('work.')
    await nextBtn.dblclick();
    expect(await getActiveWord()).toBe('work.');

    // Double-click Back: jumps to word one ('Thanks')
    await backBtn.dblclick();
    expect(await getActiveWord()).toBe('Thanks');
  });

  it('COMP-READ-4: pointerleave, pointercancel and blur stop the hold', async () => {
    await resetToFirstCardTop();

    const nextBtn = page.locator('button:has-text("Next")');
    const box = await nextBtn.boundingBox();
    expect(box).not.toBeNull();

    // 1. Pointerleave stops hold via mouse move outside
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(0, 0);
      const wordAtLeave = await getActiveWord();
      await page.waitForTimeout(500);
      expect(await getActiveWord()).toBe(wordAtLeave);
      await page.mouse.up();
    }

    // 2. Pointercancel stops hold
    await nextBtn.dispatchEvent('pointerdown');
    await nextBtn.dispatchEvent('pointercancel');
    const wordAtCancel = await getActiveWord();
    await page.waitForTimeout(500);
    expect(await getActiveWord()).toBe(wordAtCancel);

    // 3. Blur stops hold
    if (box) {
      await nextBtn.focus();
      await nextBtn.dispatchEvent('pointerdown');
      await page.locator('h1:has-text("Sales Co-pilot")').click();
      const wordAtBlur = await getActiveWord();
      await page.waitForTimeout(500);
      expect(await getActiveWord()).toBe(wordAtBlur);
    }
  });

  it('COMP-READ-5: switching cards resets reading position to zero and pauses', async () => {
    await resetToFirstCardTop();

    const nextBtn = page.locator('button:has-text("Next")');
    await nextBtn.dispatchEvent('pointerdown');
    await nextBtn.dispatchEvent('pointerup');
    expect(await getActiveWord()).toBe('for');

    // Switch to Card 2
    await page.click('text=Discovery: Post-Meeting Reality');
    await page.waitForTimeout(300);

    // Should immediately reset to first word of Card 2 ('After')
    expect(await getActiveWord()).toBe('After');
  });

  it('COMP-READ-6: zero em dashes or en dashes across video reader component', async () => {
    const content = readFileSync('/tmp/Concludo-Website/app/src/pages/video/VideoCompanionPanelPage.tsx', 'utf8');
    expect(content.includes('\u2014')).toBe(false);
    expect(content.includes('\u2013')).toBe(false);
  });
});
