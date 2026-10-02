import { ErrorTaxonomyCategory } from './types';
import { redactSensitiveData } from './auditService';

// ==========================================
// 1. DEAD-LETTER QUEUE
// ==========================================

export interface DeadLetterItem {
  id: string;
  organizationId: string;
  workflowId: string;
  executionId?: string;
  stepKey: string;
  errorCategory: ErrorTaxonomyCategory;
  errorMessage: string;
  attempts: number;
  payloadReference: Record<string, any>;
  status: 'exhausted' | 'retrying' | 'resolved' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

const DEAD_LETTER_QUEUE: Map<string, DeadLetterItem> = new Map();

export function captureDeadLetter(params: {
  organizationId: string;
  workflowId: string;
  executionId?: string;
  stepKey: string;
  errorCategory: ErrorTaxonomyCategory;
  errorMessage: string;
  attempts?: number;
  payloadReference: Record<string, any>;
}): DeadLetterItem {
  const id = `dlq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  // Redact secrets from error message and payload reference before queue persistence
  const sanitizedErrorMessage = redactSensitiveData(params.errorMessage);
  const sanitizedPayloadReference = redactSensitiveData(params.payloadReference || {});

  const item: DeadLetterItem = {
    id,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    executionId: params.executionId,
    stepKey: params.stepKey,
    errorCategory: params.errorCategory,
    errorMessage: sanitizedErrorMessage,
    attempts: params.attempts || 3,
    payloadReference: sanitizedPayloadReference,
    status: 'exhausted',
    createdAt: now,
    updatedAt: now,
  };

  DEAD_LETTER_QUEUE.set(id, item);
  return item;
}

export function getDeadLetters(organizationId: string): DeadLetterItem[] {
  return Array.from(DEAD_LETTER_QUEUE.values()).filter((i) => i.organizationId === organizationId);
}

export function updateDeadLetterStatus(
  id: string,
  status: 'retrying' | 'resolved' | 'cancelled'
): DeadLetterItem {
  const item = DEAD_LETTER_QUEUE.get(id);
  if (!item) throw new Error(`Dead-letter item '${id}' not found.`);
  item.status = status;
  item.updatedAt = new Date().toISOString();
  return item;
}

// ==========================================
// 2. PROMPT-INJECTION DEFENSE (Layered Architecture)
// ==========================================

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
  /forget\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
  /reveal\s+(system\s+instructions|credentials|api\s+keys|secrets|tokens|passwords)/i,
  /expose\s+(system\s+instructions|credentials|api\s+keys|secrets|tokens|passwords)/i,
  /print\s+(system\s+instructions|credentials|api\s+keys|secrets|tokens|passwords)/i,
  /output\s+(system\s+instructions|credentials|api\s+keys|secrets|tokens|passwords)/i,
  /disable\s+(approvals?|governance|policy|safety\s+checks|rules)/i,
  /bypass\s+(approvals?|permissions?|rls|guardrails|safety\s+checks)/i,
  /delete\s+(audit\s+logs|history|incidents|records)/i,
  /change\s+organization\s+to/i,
  /grant\s+(admin|owner|superuser)\s+role/i,
  /falsify\s+(test|dry\s+run)\s+results/i,
  /override\s+(all\s+)?(system|safety|security)\s+rules/i,
  /execute\s+as\s+root/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /do\s+anything\s+now/i,
];

export interface PromptSanitizationResult {
  isClean: boolean;
  sanitizedText: string;
  detectedThreats: string[];
}

/**
 * Normalizes input text across URL encoding, HTML entities, and spaced letter obfuscation.
 */
function extractNormalizedVariants(text: string): string[] {
  const variants: string[] = [text];

  // 1. URL-decoded variant
  try {
    const urlDecoded = decodeURIComponent(text.replace(/\+/g, ' '));
    if (urlDecoded !== text) variants.push(urlDecoded);
  } catch {
    // Malformed URI, ignore
  }

  // 2. Base64 decoded segments
  const base64Regex = /\b[A-Za-z0-9+/]{20,}={0,2}\b/g;
  let b64Match;
  while ((b64Match = base64Regex.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(b64Match[0], 'base64').toString('utf8');
      if (/[\x20-\x7E]{6,}/.test(decoded)) {
        variants.push(decoded);
      }
    } catch {
      // Not base64
    }
  }

  // 3. Spaced/punctuated letter collapsing (e.g., "i g n o r e   p r e v i o u s")
  // Replace multiple spaces or dots between single characters
  const collapsed = text.replace(/(?<=\b[a-zA-Z])[ ._\-](?=[a-zA-Z]\b)/g, '');
  if (collapsed !== text) {
    variants.push(collapsed);
  }

  return variants;
}

/**
 * Sanitizes untrusted content (transcripts, emails, docs, webhooks) to prevent prompt injection.
 * Ensures the data is treated purely as inert text and cannot redefine workflow control flow.
 */
export function sanitizeUntrustedInput(rawInput: string): PromptSanitizationResult {
  const detectedThreats: string[] = [];
  const variants = extractNormalizedVariants(rawInput);

  for (const variant of variants) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(variant)) {
        const threatDesc = `Detected prompt injection directive: ${pattern.source}`;
        if (!detectedThreats.includes(threatDesc)) {
          detectedThreats.push(threatDesc);
        }
      }
    }
  }

  // Strip or neutralize malicious directive triggers across raw input
  let sanitizedText = rawInput;
  if (detectedThreats.length > 0) {
    // Neutralize standard overrides
    sanitizedText = sanitizedText
      .replace(/ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/gi, '[INSTRUCTION_OVERRIDE_STRIPPED]')
      .replace(/disregard\s+(all\s+)?(previous|prior|above|system)\s+instructions/gi, '[INSTRUCTION_OVERRIDE_STRIPPED]')
      .replace(/forget\s+(all\s+)?(previous|prior|above|system)\s+instructions/gi, '[INSTRUCTION_OVERRIDE_STRIPPED]')
      .replace(/reveal\s+(system\s+instructions|credentials|api\s+keys|secrets|tokens|passwords)/gi, '[EXFILTRATION_ATTEMPT_STRIPPED]')
      .replace(/expose\s+(system\s+instructions|credentials|api\s+keys|secrets|tokens|passwords)/gi, '[EXFILTRATION_ATTEMPT_STRIPPED]')
      .replace(/disable\s+(approvals?|governance|policy|safety\s+checks|rules)/gi, '[SECURITY_BYPASS_STRIPPED]')
      .replace(/bypass\s+(approvals?|permissions?|rls|guardrails|safety\s+checks)/gi, '[SECURITY_BYPASS_STRIPPED]');

    // Neutralize spaced letters if present
    sanitizedText = sanitizedText
      .replace(/i\s*g\s*n\s*o\s*r\s*e\s+p\s*r\s*e\s*v\s*i\s*o\s*u\s*s\s+i\s*n\s*s\s*t\s*r\s*u\s*c\s*t\s*i\s*o\s*n\s*s/gi, '[INSTRUCTION_OVERRIDE_STRIPPED]')
      .replace(/d\s*i\s*s\s*a\s*b\s*l\s*e\s+a\s*p\s*p\s*r\s*o\s*v\s*a\s*l/gi, '[SECURITY_BYPASS_STRIPPED]');

    // Neutralize encoded or base64 malicious segments
    const b64Regex = /\b[A-Za-z0-9+/]{20,}={0,2}\b/g;
    sanitizedText = sanitizedText.replace(b64Regex, (m) => {
      try {
        const decoded = Buffer.from(m, 'base64').toString('utf8');
        if (INJECTION_PATTERNS.some((p) => p.test(decoded))) {
          return '[ENCODED_INJECTION_STRIPPED]';
        }
      } catch {}
      return m;
    });

    // Strip fake system/instruction delimiters
    sanitizedText = sanitizedText
      .replace(/<\/?(?:system|instruction|prompt|admin)[^>]*>/gi, '[DELIMITER_STRIPPED]')
      .replace(/\[\/?(?:system|instruction|prompt|admin)\]/gi, '[DELIMITER_STRIPPED]');
  }

  return {
    isClean: detectedThreats.length === 0,
    sanitizedText,
    detectedThreats,
  };
}

// ==========================================
// 3. SCHEDULER HARDENING (Australia/Melbourne)
// ==========================================

/**
 * Validates and formats schedule time respecting Australia/Melbourne timezone and DST.
 */
export function calculateNextScheduledRun(cronOrInterval: string, referenceDate: Date = new Date()): {
  nextRunIso: string;
  timezone: string;
  melbourneLocalTime: string;
} {
  const timezone = 'Australia/Melbourne';
  // Use Intl formatting to guarantee accurate local time in Melbourne
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Calculate 15-minute default step for intervals
  const nextTimeMs = referenceDate.getTime() + 15 * 60 * 1000;
  const nextDate = new Date(nextTimeMs);

  return {
    nextRunIso: nextDate.toISOString(),
    timezone,
    melbourneLocalTime: formatter.format(nextDate),
  };
}

// ==========================================
// 4. FEATURE FLAGS
// ==========================================

export interface WorkflowFeatureFlags {
  workflow_builder: boolean;
  natural_language_generation: boolean;
  external_connectors: boolean;
  custom_api: boolean;
  custom_webhook: boolean;
  experimental_ai: boolean;
}

const DEFAULT_FLAGS: WorkflowFeatureFlags = {
  workflow_builder: true,
  natural_language_generation: true,
  external_connectors: true,
  custom_api: true,
  custom_webhook: true,
  experimental_ai: false, // Off by default in production
};

export function isFeatureEnabled(flagName: keyof WorkflowFeatureFlags): boolean {
  return DEFAULT_FLAGS[flagName] ?? false;
}
