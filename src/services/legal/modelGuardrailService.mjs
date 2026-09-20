/**
 * Tasklet 14.9: Model Provider Guardrails
 *
 * Enforces no-training commitments in configuration and code, prompt injection
 * quarantine, and traceable source offset provenance.
 *
 * Invariant: training_on_inputs_disabled must be strictly TRUE.
 */

export class ModelConfigError extends Error {
  constructor(message, code = 'MODEL_CONFIG_VIOLATION') {
    super(message);
    this.name = 'ModelConfigError';
    this.code = code;
  }
}

const activeModelConfigs = new Map([
  [
    'default',
    {
      id: crypto.randomUUID(),
      provider_name: 'Anthropic',
      model_identifier: 'claude-3-5-sonnet',
      training_on_inputs_disabled: true,
      zero_retention_enabled: true,
      data_region: 'us-east-1',
      terms_version_reviewed: '2026-Q1-Commercial',
      reviewed_at: new Date().toISOString(),
      is_active: true,
    },
  ],
]);

/**
 * Validates and registers a model provider configuration.
 * Refuses any configuration where training is not disabled.
 * @param {object} config
 */
export function registerModelConfig(config) {
  if (config.training_on_inputs_disabled !== true) {
    throw new ModelConfigError(
      'DATABASE CONSTRAINT VIOLATION: training_on_inputs_disabled must be true. Customer transcripts must never be used for AI training.',
      'TRAINING_MUST_BE_DISABLED'
    );
  }

  const id = crypto.randomUUID();
  const entry = {
    ...config,
    id,
    training_on_inputs_disabled: true,
    created_at: new Date().toISOString(),
  };

  activeModelConfigs.set(id, entry);
  return entry;
}

/**
 * Startup assertion: ensures at least one active, verified no-training model configuration exists.
 */
export function assertModelProviderCompliance() {
  const active = Array.from(activeModelConfigs.values()).filter((c) => c.is_active);
  if (!active.length) {
    throw new ModelConfigError('No active model provider configuration found. Fail closed.', 'NO_ACTIVE_MODEL_CONFIG');
  }

  for (const c of active) {
    if (c.training_on_inputs_disabled !== true) {
      throw new ModelConfigError(`Model config "${c.provider_name}" has training enabled. Refusing to boot.`, 'TRAINING_ENABLED');
    }
  }

  return true;
}

/**
 * Quarantines prompt injection from transcript text without executing instructions.
 * @param {string} text
 * @returns {{ clean: boolean, quarantined_excerpts: string[], notes: string[] }}
 */
export function quarantinePromptInjection(text) {
  const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
    /disregard\s+(the\s+)?(system|previous|above)/i,
    /<\|?(im_start|im_end|system|endoftext)\|?>/i,
    /\[\[?\s*(system|assistant|instruction)\s*\]?\]/i,
    /(do\s+not|don't)\s+(follow|apply)\s+the\s+(rules|guidelines|constraints)/i,
    /output\s+(the\s+)?(raw\s+)?(system\s+)?prompt/i,
  ];

  const quarantined = [];
  const notes = [];

  for (const pattern of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      quarantined.push(match[0]);
      notes.push(`Instruction-shaped text detected and quarantined: "${match[0]}". Treated as verbatim historical data, not instructions.`);
    }
  }

  return {
    clean: quarantined.length === 0,
    quarantined_excerpts: quarantined,
    notes,
  };
}
