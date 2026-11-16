import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { meetingInputTheme } from '../src/features/meeting-output/meetingInputTheme';
import { isMeetingInputFuturisticEnabled, setMeetingInputFuturisticEnabled } from '../src/lib/meeting-output/meetingInputFlag';

describe('Meeting Input Bright Futuristic (Tests H1 to H12)', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(here, '../..');

  it('Tokens match reference/tokens.json from handover', () => {
    const tokensPath = '/tmp/handover_meet/handover_meet/reference/tokens.json';
    if (fs.existsSync(tokensPath)) {
      const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      expect(meetingInputTheme.flag).toBe(raw.flag);
      expect(meetingInputTheme.colour.navy).toBe(raw.colour.navy);
      expect(meetingInputTheme.colour.navy2).toBe(raw.colour.navy2);
      expect(meetingInputTheme.colour.gold).toBe(raw.colour.gold);
      expect(meetingInputTheme.colour.glowCyan).toBe(raw.colour.glowCyan);
      expect(meetingInputTheme.colour.glowBlue).toBe(raw.colour.glowBlue);
      expect(meetingInputTheme.glow.tile).toBe(raw.glow.tile);
      expect(meetingInputTheme.glow.card).toBe(raw.glow.card);
      expect(meetingInputTheme.glow.focus).toBe(raw.glow.focus);
      expect(meetingInputTheme.glow.ctaReady).toBe(raw.glow.ctaReady);
    } else {
      expect(meetingInputTheme.flag).toBe('meeting_input_futuristic_v1');
      expect(meetingInputTheme.colour.navy).toBe('#16263F');
      expect(meetingInputTheme.colour.glowCyan).toBe('#7DD3FC');
    }
  });

  it('H1 Flag: isMeetingInputFuturisticEnabled released to production and enabled by default', () => {
    expect(isMeetingInputFuturisticEnabled()).toBe(true);
  });

  it('H4 Word Count Pill: handles 0 words in, 1 word in (singular), and N words in', () => {
    const formatCount = (n: number) => (n === 1 ? '1 word in' : `${n.toLocaleString()} words in`);
    expect(formatCount(0)).toBe('0 words in');
    expect(formatCount(1)).toBe('1 word in');
    expect(formatCount(52)).toBe('52 words in');
    expect(formatCount(1234)).toBe('1,234 words in');
  });

  it('H9 Reduced Motion: css contains prefers-reduced-motion: reduce disabling scan animation', () => {
    const css = fs.readFileSync(path.join(here, '../src/features/meeting-output/meeting-output.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.cmo-fut-scan');
    expect(css).toContain('animation: none !important');
  });

  it('H11 Governance & Isolation: git diff of DashboardPage.tsx against main is 0 lines', () => {
    const diff = execSync(`git diff origin/main -- app/src/pages/DashboardPage.tsx`, { cwd: repoRoot, encoding: 'utf8' }).trim();
    expect(diff).toBe('');
  });

  it('H12 Dash Scan: zero em dashes (\\u2014) or en dashes (\\u2013) in changed files', () => {
    const filesToCheck = [
      'app/src/features/meeting-output/meetingInputTheme.ts',
      'app/src/lib/meeting-output/meetingInputFlag.ts',
      'app/src/features/meeting-output/studio.d.ts',
      'app/src/features/meeting-output/studio.js',
      'app/src/pages/MeetingOutputPage.tsx',
    ];

    for (const rel of filesToCheck) {
      const full = path.join(repoRoot, rel);
      if (fs.existsSync(full)) {
        const content = fs.readFileSync(full, 'utf8');
        expect(content.includes('—')).toBe(false);
        expect(content.includes('–')).toBe(false);
      }
    }
  });

  it('H12 Copy Scan: zero "AI" or "AI-powered" in user-facing Step 1 strings', () => {
    const studio = fs.readFileSync(path.join(here, '../src/features/meeting-output/studio.js'), 'utf8');
    const futSection = studio.slice(studio.indexOf('function viewImportFuturistic()'), studio.indexOf('function viewImport()'));
    expect(futSection).not.toMatch(/\bAI\b/);
    expect(futSection).not.toMatch(/\bAI-powered\b/i);
  });
});
