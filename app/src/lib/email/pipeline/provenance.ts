/**
 * Provenance on every AI-generated field.
 *
 * The Stage 6 brief asks for seven things to be retained per generated field:
 * model version, prompt version, timestamp, confidence, source message
 * references, user correction status and approval status.
 *
 * `Generated<T>` makes all seven mandatory in the type. A generated value that
 * does not carry its provenance does not compile, which is the only way a rule
 * like this survives contact with a deadline.
 *
 * The structured-output validator below is the other half. A model returns a
 * string; a string that parses is not the same as a string that is valid, and
 * an invalid field must be dropped rather than displayed. Showing a malformed
 * extraction is worse than showing none: a person cannot tell the difference
 * between a field the model got wrong and a field the parser mangled.
 */
import { Confidence, SourceRef } from '../model';

export interface ModelIdentity {
  /** The model as the provider names it. */
  model: string;
  /** The exact prompt revision. Changed whenever the prompt text changes. */
  promptVersion: string;
  /** The schema the output was validated against. */
  schemaVersion: string;
}

export type CorrectionStatus =
  | 'uncorrected'
  | 'corrected_by_user'
  /** The person looked at it and left it. Different from never having looked. */
  | 'confirmed_by_user';

export type FieldApprovalStatus =
  | 'not_applicable'
  | 'awaiting_approval'
  | 'approved'
  | 'approval_expired';

/**
 * A generated value and everything needed to judge it.
 *
 * Note what is NOT optional. Every one of the seven is required, including
 * `source`, which must be non-empty for anything extracted from a message.
 */
export interface Generated<T> {
  value: T;
  model: ModelIdentity;
  generatedAt: string;
  confidence: Confidence;
  source: readonly SourceRef[];
  correction: CorrectionStatus;
  approval: FieldApprovalStatus;
}

export function generated<T>(
  value: T,
  options: {
    model: ModelIdentity;
    at: string;
    confidence: Confidence;
    source: readonly SourceRef[];
    correction?: CorrectionStatus;
    approval?: FieldApprovalStatus;
  }
): Generated<T> {
  return {
    value,
    model: options.model,
    generatedAt: options.at,
    confidence: options.confidence,
    source: options.source,
    correction: options.correction ?? 'uncorrected',
    approval: options.approval ?? 'not_applicable',
  };
}

/** The identity used by the synthetic dataset, so provenance is never blank. */
export const SYNTHETIC_MODEL: ModelIdentity = {
  model: 'synthetic-no-model',
  promptVersion: 'icc-2026-10',
  schemaVersion: 'ecc-analysis-v2',
};

/* ------------------------------------------------- structured validation */

export interface ValidationIssue {
  path: string;
  problem: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

type FieldRule =
  | { kind: 'string'; min?: number; max?: number; oneOf?: readonly string[] }
  | { kind: 'number'; min?: number; max?: number; integer?: boolean }
  | { kind: 'boolean' }
  | { kind: 'iso_datetime' }
  | { kind: 'array'; of: FieldRule; min?: number; max?: number }
  | { kind: 'object'; fields: Record<string, FieldRule>; optional?: readonly string[] }
  | { kind: 'nullable'; of: FieldRule };

export type Schema = Record<string, FieldRule>;

/**
 * Validates a parsed model response against a schema.
 *
 * Collects every issue rather than stopping at the first. One error at a time
 * turns a broken prompt into five round trips, and the person debugging it
 * never sees the shape of what is wrong.
 */
export function validateStructured<T>(input: unknown, schema: Schema): ValidationResult<T> {
  const issues: ValidationIssue[] = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, value: null, issues: [{ path: '', problem: 'Expected an object.' }] };
  }

  const record = input as Record<string, unknown>;

  for (const [key, rule] of Object.entries(schema)) {
    checkField(record[key], rule, key, issues);
  }

  // Unexpected keys are reported, not accepted. A model that invents a field is
  // a model whose prompt has drifted, and silently ignoring the extra field
  // hides that until something depends on it.
  for (const key of Object.keys(record)) {
    if (!(key in schema)) {
      issues.push({ path: key, problem: 'Not in the schema. The model returned a field nobody asked for.' });
    }
  }

  return issues.length === 0
    ? { ok: true, value: record as T, issues: [] }
    : { ok: false, value: null, issues };
}

function checkField(value: unknown, rule: FieldRule, path: string, issues: ValidationIssue[]): void {
  switch (rule.kind) {
    case 'nullable':
      if (value === null) return;
      checkField(value, rule.of, path, issues);
      return;

    case 'string': {
      if (typeof value !== 'string') {
        issues.push({ path, problem: `Expected a string, got ${describe(value)}.` });
        return;
      }
      if (rule.oneOf && !rule.oneOf.includes(value)) {
        issues.push({ path, problem: `"${value}" is not one of: ${rule.oneOf.join(', ')}.` });
      }
      if (rule.min !== undefined && value.trim().length < rule.min) {
        issues.push({ path, problem: `Shorter than ${rule.min} characters. An empty field is not an answer.` });
      }
      if (rule.max !== undefined && value.length > rule.max) {
        issues.push({ path, problem: `Longer than ${rule.max} characters.` });
      }
      return;
    }

    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        issues.push({ path, problem: `Expected a number, got ${describe(value)}.` });
        return;
      }
      if (rule.integer && !Number.isInteger(value)) {
        issues.push({ path, problem: 'Expected a whole number.' });
      }
      if (rule.min !== undefined && value < rule.min) {
        issues.push({ path, problem: `Below the minimum of ${rule.min}.` });
      }
      if (rule.max !== undefined && value > rule.max) {
        issues.push({ path, problem: `Above the maximum of ${rule.max}.` });
      }
      return;
    }

    case 'boolean':
      if (typeof value !== 'boolean') {
        issues.push({ path, problem: `Expected true or false, got ${describe(value)}.` });
      }
      return;

    case 'iso_datetime': {
      if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
        issues.push({ path, problem: `Expected an ISO-8601 timestamp, got ${describe(value)}.` });
        return;
      }
      if (!/[+-]\d{2}:\d{2}$|Z$/.test(value)) {
        issues.push({
          path,
          problem: 'Timestamp has no offset. A date without a zone is how a deadline lands on the wrong day.',
        });
      }
      return;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        issues.push({ path, problem: `Expected an array, got ${describe(value)}.` });
        return;
      }
      if (rule.min !== undefined && value.length < rule.min) {
        issues.push({ path, problem: `Expected at least ${rule.min} item(s).` });
      }
      if (rule.max !== undefined && value.length > rule.max) {
        issues.push({ path, problem: `Expected at most ${rule.max} item(s).` });
      }
      value.forEach((item, i) => checkField(item, rule.of, `${path}[${i}]`, issues));
      return;
    }

    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        issues.push({ path, problem: `Expected an object, got ${describe(value)}.` });
        return;
      }
      const record = value as Record<string, unknown>;
      const optional = new Set(rule.optional ?? []);
      for (const [key, inner] of Object.entries(rule.fields)) {
        if (!(key in record) && optional.has(key)) continue;
        checkField(record[key], inner, `${path}.${key}`, issues);
      }
      return;
    }
  }
}

function describe(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}

/* ------------------------------------------------- the analysis schemas */

const SOURCE_RULE: FieldRule = {
  kind: 'object',
  fields: {
    messageId: { kind: 'string', min: 1 },
    threadId: { kind: 'string', min: 1 },
    quote: { kind: 'string', min: 1 },
  },
  optional: ['quote'],
};

/** Classification, stage 11. */
export const CLASSIFICATION_SCHEMA: Schema = {
  category: {
    kind: 'string',
    oneOf: [
      'customer_issue',
      'meeting',
      'request',
      'invoice_or_payment',
      'notification',
      'newsletter',
      'delivery',
      'employment',
      'personal',
      'acknowledgement',
      'security',
      'other',
    ],
  },
  sensitivity: { kind: 'string', oneOf: ['standard', 'sensitive'] },
  isBulk: { kind: 'boolean' },
  tags: { kind: 'array', of: { kind: 'string', min: 1 }, max: 8 },
  confidence: { kind: 'string', oneOf: ['high', 'medium', 'low'] },
  source: { kind: 'array', of: SOURCE_RULE, min: 1 },
};

/** Summary, stage 13. */
export const SUMMARY_SCHEMA: Schema = {
  oneLineSummary: { kind: 'string', min: 10, max: 200 },
  whyItMatters: { kind: 'string', min: 10, max: 300 },
  recommendedNextStep: { kind: 'string', min: 5, max: 300 },
  confidence: { kind: 'string', oneOf: ['high', 'medium', 'low'] },
  source: { kind: 'array', of: SOURCE_RULE, min: 1 },
};

/** Deadlines, stage 15. The basis field is why this schema matters most. */
export const DEADLINE_SCHEMA: Schema = {
  id: { kind: 'string', min: 1 },
  description: { kind: 'string', min: 3 },
  dueAt: { kind: 'iso_datetime' },
  basis: { kind: 'string', oneOf: ['stated', 'inferred', 'calculated'] },
  consequence: { kind: 'string', min: 5 },
  ownerIsSelf: { kind: 'boolean' },
  confidence: { kind: 'string', oneOf: ['high', 'medium', 'low'] },
  source: { kind: 'array', of: SOURCE_RULE, min: 1 },
};

/** Actions, stage 14. */
export const ACTION_SCHEMA: Schema = {
  id: { kind: 'string', min: 1 },
  description: { kind: 'string', min: 3 },
  owner: { kind: 'string', min: 1 },
  ownerIsSelf: { kind: 'boolean' },
  dueAt: { kind: 'nullable', of: { kind: 'iso_datetime' } },
  estimatedMinutes: { kind: 'nullable', of: { kind: 'number', min: 0, max: 600, integer: true } },
  status: { kind: 'string', oneOf: ['open', 'done', 'blocked'] },
  confidence: { kind: 'string', oneOf: ['high', 'medium', 'low'] },
  source: { kind: 'array', of: SOURCE_RULE, min: 1 },
};

/** Priority, stage 12. */
export const PRIORITY_SCHEMA: Schema = {
  score: { kind: 'number', min: 0, max: 100, integer: true },
  band: { kind: 'string', oneOf: ['immediate', 'today', 'soon', 'batch', 'low'] },
  reasons: { kind: 'array', of: { kind: 'string', min: 5 }, min: 1, max: 3 },
  confidence: { kind: 'string', oneOf: ['high', 'medium', 'low'] },
};

export const SCHEMAS: Readonly<Record<string, Schema>> = {
  classification: CLASSIFICATION_SCHEMA,
  summary: SUMMARY_SCHEMA,
  deadline: DEADLINE_SCHEMA,
  action: ACTION_SCHEMA,
  priority: PRIORITY_SCHEMA,
};

/**
 * Parses and validates a model response in one step.
 *
 * A model response is a string from an untrusted-ish source: not hostile, but
 * not guaranteed well formed either. Parse failures are an ordinary outcome,
 * not an exception, so they are returned rather than thrown.
 */
export function parseAndValidate<T>(raw: string, schema: Schema): ValidationResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      value: null,
      issues: [{ path: '', problem: `Response is not valid JSON: ${(error as Error).message}` }],
    };
  }
  return validateStructured<T>(parsed, schema);
}
