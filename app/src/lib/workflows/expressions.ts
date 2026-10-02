/**
 * Concludo Sandboxed Deterministic Expression Engine
 * Conforms to Master Build Instruction Section 24
 * Strictly no eval, no new Function, no arbitrary code execution.
 */

export interface ExpressionContext {
  trigger?: Record<string, any>;
  steps?: Record<string, { output?: any; status?: string }>;
  variables?: Record<string, any>;
  environment?: Record<string, any>;
}

export type ExpressionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'empty'
  | 'not_empty'
  | 'in_list'
  | 'not_in_list'
  | 'date_before'
  | 'date_after'
  | 'and'
  | 'or'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'round'
  | 'lowercase'
  | 'uppercase'
  | 'trim'
  | 'concat';

export interface ExpressionRule {
  operator: ExpressionOperator;
  left: string; // Token path like "trigger.deal_amount" or literal
  right?: any;  // Comparison value or second token path
}

/**
 * Resolves dot-notated token paths against the safe execution context.
 * e.g. "trigger.meeting.title" -> context.trigger?.meeting?.title
 */
export function resolveTokenPath(path: string, context: ExpressionContext): any {
  if (typeof path !== 'string') return path;
  if (!path.startsWith('$') && !path.includes('.')) {
    // If not a path expression, return raw string
    return path;
  }

  const cleanPath = path.startsWith('$') ? path.slice(1) : path;
  const parts = cleanPath.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Evaluates a single rule deterministically.
 */
export function evaluateRule(rule: ExpressionRule, context: ExpressionContext): boolean | any {
  const leftValue = resolveTokenPath(rule.left, context);
  const rightValue = typeof rule.right === 'string' && (rule.right.startsWith('$') || rule.right.includes('.'))
    ? resolveTokenPath(rule.right, context)
    : rule.right;

  switch (rule.operator) {
    case 'equals':
      return leftValue === rightValue;
    case 'not_equals':
      return leftValue !== rightValue;
    case 'greater_than':
      return typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue > rightValue;
    case 'less_than':
      return typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue < rightValue;
    case 'greater_than_or_equal':
      return typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue >= rightValue;
    case 'less_than_or_equal':
      return typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue <= rightValue;
    case 'contains':
      if (typeof leftValue === 'string') return leftValue.includes(String(rightValue));
      if (Array.isArray(leftValue)) return leftValue.includes(rightValue);
      return false;
    case 'not_contains':
      if (typeof leftValue === 'string') return !leftValue.includes(String(rightValue));
      if (Array.isArray(leftValue)) return !leftValue.includes(rightValue);
      return true;
    case 'empty':
      return leftValue === null || leftValue === undefined || leftValue === '' || (Array.isArray(leftValue) && leftValue.length === 0);
    case 'not_empty':
      return leftValue !== null && leftValue !== undefined && leftValue !== '' && (!Array.isArray(leftValue) || leftValue.length > 0);
    case 'in_list':
      return Array.isArray(rightValue) && rightValue.includes(leftValue);
    case 'not_in_list':
      return Array.isArray(rightValue) && !rightValue.includes(leftValue);
    case 'date_before':
      return new Date(leftValue).getTime() < new Date(rightValue).getTime();
    case 'date_after':
      return new Date(leftValue).getTime() > new Date(rightValue).getTime();
    case 'lowercase':
      return typeof leftValue === 'string' ? leftValue.toLowerCase() : leftValue;
    case 'uppercase':
      return typeof leftValue === 'string' ? leftValue.toUpperCase() : leftValue;
    case 'trim':
      return typeof leftValue === 'string' ? leftValue.trim() : leftValue;
    case 'concat':
      return `${leftValue ?? ''}${rightValue ?? ''}`;
    case 'add':
      return (Number(leftValue) || 0) + (Number(rightValue) || 0);
    case 'subtract':
      return (Number(leftValue) || 0) - (Number(rightValue) || 0);
    case 'multiply':
      return (Number(leftValue) || 0) * (Number(rightValue) || 0);
    case 'divide':
      return (Number(rightValue) || 0) !== 0 ? (Number(leftValue) || 0) / Number(rightValue) : 0;
    case 'round':
      return Math.round(Number(leftValue) || 0);
    default:
      return false;
  }
}

/**
 * Concludo Dynamic Variable Interpolator for Cross-Step Field Mapping
 * Evaluates safe tokens such as {{trigger.fieldName}} and {{steps.stepKey.outputField}}
 * Conforms to Master Build Instruction Section 10 & Zero Arbitrary Code Execution.
 */
export function interpolateVariables(template: any, context: ExpressionContext): any {
  if (typeof template !== 'string') return template;

  // Single exact token mapping (e.g. "{{trigger.id}}" -> returns literal primitive or object)
  const exactMatch = template.match(/^\{\{([a-zA-Z0-9_$.]+)\}\}$/);
  if (exactMatch) {
    const resolved = resolveTokenPath(exactMatch[1], context);
    return resolved !== undefined ? resolved : '';
  }

  // String interpolation (e.g. "Meeting with {{trigger.customer_name}} at {{trigger.time}}")
  return template.replace(/\{\{([a-zA-Z0-9_$.]+)\}\}/g, (_, path) => {
    const resolved = resolveTokenPath(path.trim(), context);
    if (resolved === null || resolved === undefined) return '';
    if (typeof resolved === 'object') return JSON.stringify(resolved);
    return String(resolved);
  });
}
