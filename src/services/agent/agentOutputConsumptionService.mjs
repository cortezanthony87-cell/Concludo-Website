/**
 * Tasklet 10.1: Agent Output Consumption Interface
 * Tasklet 10.2: Meeting Health Consumption by Agents
 */

export class AgentTokenInvalidError extends Error {
  constructor(message = 'Agent token is invalid or expired') {
    super(message);
    this.name = 'AGENT_TOKEN_INVALID';
    this.status = 401;
  }
}

export class AgentOutputConsumptionService {
  constructor() {
    this.tokens = new Map(); // token -> { agentId, organisationId, permissions, expiresAt }
    this.outputs = new Map(); // outputId -> payload
  }

  registerAgentToken(token, agentId, organisationId, permissions = ['output:read']) {
    this.tokens.set(token, {
      agentId,
      organisationId,
      permissions,
      expiresAt: Date.now() + 86400000,
    });
  }

  storeOutput(outputId, orgId, payload) {
    this.outputs.set(outputId, { orgId, payload });
  }

  getOutputPayload(outputId, agentToken, sectionFilter = null) {
    const session = this.tokens.get(agentToken);
    if (!session || Date.now() > session.expiresAt) {
      throw new AgentTokenInvalidError();
    }

    const output = this.outputs.get(outputId);
    if (!output) {
      throw new Error(`Output not found: ${outputId}`);
    }

    // Tenant isolation: agent cannot read outputs outside its token's organisation
    if (output.orgId !== session.organisationId) {
      throw new Error('ACCESS_DENIED: Agent token not authorized for this organisation output');
    }

    const raw = output.payload;
    if (sectionFilter) {
      return {
        outputId,
        filteredSection: sectionFilter,
        data: raw[sectionFilter] || null,
      };
    }

    return raw;
  }
}

export class HealthEventDispatcher {
  constructor() {
    this.rules = []; // Array of rules
    this.allowedMetrics = new Set(['composite_score', 'distribution_index', 'overrun_minutes', 'unscored_status']);
  }

  addSubscriptionRule(rule) {
    if (!this.allowedMetrics.has(rule.condition_metric)) {
      throw new Error(`PROHIBITED_METRIC: ${rule.condition_metric} is not an allowed meeting-level metric.`);
    }
    this.rules.push(rule);
  }

  evaluateHealthRun(orgId, healthRun) {
    if (!healthRun) return [];

    // Standing rule: a run with a null composite score triggers NO threshold rules
    if (healthRun.composite_score === null) {
      return [];
    }

    const firedAlerts = [];
    for (const rule of this.rules) {
      if (rule.organisation_id !== orgId) continue;
      if (!rule.is_active) continue;

      const val = healthRun[rule.condition_metric];
      if (val === undefined || val === null) continue;

      let triggered = false;
      if (rule.operator === '<' && val < rule.threshold_value) triggered = true;
      if (rule.operator === '<=' && val <= rule.threshold_value) triggered = true;
      if (rule.operator === '>' && val > rule.threshold_value) triggered = true;
      if (rule.operator === '>=' && val >= rule.threshold_value) triggered = true;
      if (rule.operator === '==' && val === rule.threshold_value) triggered = true;

      if (triggered) {
        firedAlerts.push({
          ruleId: rule.id,
          ruleName: rule.rule_name,
          targetAgent: rule.target_agent_id,
          metric: rule.condition_metric,
          value: val,
          threshold: rule.threshold_value,
          dispatchedAt: new Date().toISOString(),
        });
      }
    }

    return firedAlerts;
  }
}
