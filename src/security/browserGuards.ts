/**
 * Concludo Client-Safe Security Primitives.
 * Pure TypeScript implementation for browser context without Node.js runtime dependencies.
 */

/* ==========================================================================
 * 1. Output encoding & URL sanitisation. Defends against XSS.
 * ========================================================================== */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function escapeHtml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`=/]/g, (c) => HTML_ESCAPES[c] || c);
}

export function safeUrl(value: any): string {
  if (!value) return '#';
  const cleaned = String(value).replace(/[\x00-\x1f\x7f-\x9f\s]/g, '').toLowerCase();
  if (/^(javascript|data|vbscript|file):/i.test(cleaned)) return '#';
  if (cleaned.startsWith('//')) return '#';
  return escapeHtml(value);
}

/* ==========================================================================
 * 2. Prototype pollution prevention & Mass assignment allowlist
 * ========================================================================== */

export function pickAllowed<T extends Record<string, any>>(input: any, allowed: string[]): Partial<T> {
  const out: any = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, k)) {
      out[k] = input[k];
    }
  }
  return out;
}

export function hasPrototypePollution(obj: any, depth = 0): boolean {
  if (depth > 20 || !obj || typeof obj !== 'object') return false;
  for (const k of Object.keys(obj)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true;
    if (hasPrototypePollution(obj[k], depth + 1)) return true;
  }
  return false;
}

/* ==========================================================================
 * 3. Prompt injection detection on transcripts (Advisory only)
 * ========================================================================== */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(the\s+)?(system|previous|above)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
  /new\s+(system\s+)?(instructions?|prompt)\s*:/i,
  /\bsystem\s*:\s*/i,
  /<\|?(im_start|im_end|system|endoftext)\|?>/i,
  /\[\[?\s*(system|assistant|instruction)\s*\]?\]/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /output\s+(the\s+)?(raw\s+)?(system\s+)?prompt/i,
  /(do\s+not|don't)\s+(follow|apply)\s+the\s+(rules|guidelines|constraints)/i,
  /pretend\s+(that\s+)?you\s+(are|can)/i,
];

export function detectInstructionShapedContent(text: string): {
  detected: boolean;
  matches: Array<{ pattern: string; excerpt: string }>;
} {
  const matches: Array<{ pattern: string; excerpt: string }> = [];
  const s = String(text ?? '');
  for (const p of INJECTION_PATTERNS) {
    const m = s.match(p);
    if (m) matches.push({ pattern: p.source, excerpt: m[0].slice(0, 120) });
  }
  return { detected: matches.length > 0, matches };
}

/* ==========================================================================
 * 4. Client-side Sliding Window Limiter
 * ========================================================================== */

export class SlidingWindowLimiter {
  private limit: number;
  private windowMs: number;
  private hits: Map<string, number[]>;

  constructor({ limit, windowMs }: { limit: number; windowMs: number }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  check(key: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const cutoff = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return { allowed: false, remaining: 0, retryAfterMs: arr[0] + this.windowMs - now };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true, remaining: this.limit - arr.length, retryAfterMs: 0 };
  }
}
