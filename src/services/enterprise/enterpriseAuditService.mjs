/**
 * Tasklet 11.1: Comprehensive Auditability Service
 * Tasklet 11.2: Governance Controls and Gatekeeper
 */

import { createHash } from 'node:crypto';

export class AuditWriteFailureError extends Error {
  constructor(message = 'Failed to write audit entry') {
    super(message);
    this.name = 'AUDIT_WRITE_FAILURE';
  }
}

export class GovernanceGateBlockedError extends Error {
  constructor(message = 'Publication blocked by governance policy review threshold') {
    super(message);
    this.name = 'GOVERNANCE_GATE_BLOCKED';
  }
}

export class EnterpriseAuditService {
  constructor() {
    this.logEntries = [];
    this.lastHash = 'GENESIS_HASH_CONCLUDO_AUDIT_LOG_ROOT';
  }

  logEvent(event) {
    if (!event.organisation_id) throw new AuditWriteFailureError('Missing organisation_id');
    if (!event.action_type) throw new AuditWriteFailureError('Missing action_type');

    const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const rowData = JSON.stringify({
      id,
      organisation_id: event.organisation_id,
      actor_id: event.actor_id || null,
      action_type: event.action_type,
      resource_type: event.resource_type || 'output',
      resource_id: event.resource_id || '',
      timestamp,
    });

    // Hash chaining algorithm: tamper_hash = SHA-256(prev_hash + row_data)
    const tamperHash = createHash('sha256').update(this.lastHash + rowData).digest('hex');

    const entry = {
      id,
      organisation_id: event.organisation_id,
      actor_id: event.actor_id || null,
      actor_email: event.actor_email || null,
      action_type: event.action_type,
      resource_type: event.resource_type || 'output',
      resource_id: event.resource_id || '',
      ip_address: event.ip_address || '127.0.0.1',
      user_agent: event.user_agent || 'ConcludoSystem',
      metadata: event.metadata || {},
      prev_hash: this.lastHash,
      tamper_hash: tamperHash,
      created_at: timestamp,
    };

    this.logEntries.push(entry);
    this.lastHash = tamperHash;
    return entry;
  }

  verifyChainIntegrity() {
    let currentPrev = 'GENESIS_HASH_CONCLUDO_AUDIT_LOG_ROOT';
    for (let i = 0; i < this.logEntries.length; i++) {
      const e = this.logEntries[i];
      if (e.prev_hash !== currentPrev) {
        return { ok: false, brokenAtIndex: i, error: 'Previous hash mismatch' };
      }

      const rowData = JSON.stringify({
        id: e.id,
        organisation_id: e.organisation_id,
        actor_id: e.actor_id,
        action_type: e.action_type,
        resource_type: e.resource_type,
        resource_id: e.resource_id,
        timestamp: e.created_at,
      });

      const expectedHash = createHash('sha256').update(currentPrev + rowData).digest('hex');
      if (e.tamper_hash !== expectedHash) {
        return { ok: false, brokenAtIndex: i, error: 'Tamper hash invalidated' };
      }

      currentPrev = e.tamper_hash;
    }

    return { ok: true, verifiedEntries: this.logEntries.length };
  }
}

export class GovernancePolicyGatekeeper {
  constructor() {
    this.policies = new Map(); // orgId -> Array of policies
  }

  addPolicy(orgId, policy) {
    const list = this.policies.get(orgId) || [];
    list.push(policy);
    this.policies.set(orgId, list);
  }

  evaluatePublishAction(orgId, document) {
    const list = this.policies.get(orgId) || [];

    for (const p of list) {
      if (!p.is_mandatory) continue;

      if (p.policy_code === 'BOARD_SIGN_OFF_REQUIRED') {
        if (document.template_id === 'T14' || document.template_id === 'T17') {
          if (!document.has_board_approval) {
            throw new GovernanceGateBlockedError(`Policy ${p.policy_name} requires board review prior to publication.`);
          }
        }
      }

      if (p.policy_code === 'P1_ACTION_VERIFICATION') {
        const hasUnverifiedP1 = (document.actions || []).some(a => a.priority === 'P1' && !a.verified_by_human);
        if (hasUnverifiedP1) {
          throw new GovernanceGateBlockedError(`Policy ${p.policy_name}: unverified P1 actions exist in document.`);
        }
      }
    }

    return { ok: true, permitted: true };
  }
}
