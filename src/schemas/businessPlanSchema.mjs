/**
 * Tasklet 8.2: Business Plan Schema (OUT-23)
 * Tasklet 8.3: Executive Brief Schema (OUT-51)
 */

export class BusinessPlanSchemaViolationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'BUSINESS_PLAN_SCHEMA_VIOLATION';
    this.errors = errors;
  }
}

export class ExecutiveBriefLengthExceededError extends Error {
  constructor(message, path = 'executiveSummary') {
    super(message);
    this.name = 'EXECUTIVE_BRIEF_LENGTH_EXCEEDED';
    this.path = path;
  }
}

export function validateBusinessPlanPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    throw new BusinessPlanSchemaViolationError('Payload must be an object', ['root']);
  }

  // Chapters: Executive Summary, Company Description, Market Analysis, Operational Plan, Financial Projections, Appendix
  const requiredChapters = ['executive_summary', 'company_description', 'market_analysis', 'operational_plan'];
  for (const ch of requiredChapters) {
    if (!payload[ch] && !(payload.chapters && payload.chapters[ch])) {
      errors.push({ path: ch, message: `Missing required business plan chapter: ${ch}` });
    }
  }

  if (payload.financial_projections) {
    const fin = payload.financial_projections;
    // Enforces numeric fields on financial projections or explicit placeholder marker
    for (const [k, v] of Object.entries(fin)) {
      if (typeof v !== 'number' && v !== '[UNSTATED_FIGURE]' && v !== '[PENDING_MODEL]') {
        errors.push({ path: `financial_projections.${k}`, message: `Field must be numeric or valid placeholder marker: ${k}` });
      }
    }
  }

  if (errors.length > 0) {
    throw new BusinessPlanSchemaViolationError('Business plan schema validation failed', errors);
  }
  return { ok: true };
}

export function validateExecutiveBriefPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Executive brief payload must be an object');
  }

  const summary = payload.executiveSummary || payload.standfirst || payload.summary || '';
  if (typeof summary === 'string' && summary.length > 1500) {
    throw new ExecutiveBriefLengthExceededError(`Executive brief summary exceeds 1,500 characters limit (${summary.length})`, 'executiveSummary');
  }

  if (!payload.determinations && !payload.decisions) {
    throw new Error('Executive brief requires determinations or decisions section');
  }

  return { ok: true };
}
