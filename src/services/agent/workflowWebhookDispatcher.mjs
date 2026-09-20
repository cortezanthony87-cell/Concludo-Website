/**
 * Tasklet 10.7: Workflow Consumption Integration
 * Tasklet 10.8: Approval Integration and Governance Barrier
 *
 * Mandatory rule: NO agent takes an external action without a person approving it.
 * SSRF protected webhook dispatch with HMAC SHA-256 signatures.
 */

import { createHmac } from 'node:crypto';

export class ApprovalExpiredError extends Error {
  constructor(message = 'Approval request expired after 48 hours and cannot be executed') {
    super(message);
    this.name = 'APPROVAL_EXPIRED';
  }
}

export class SsrfBlockedError extends Error {
  constructor(targetUrl) {
    super(`SSRF Protection: target URL resolves to blocked network: ${targetUrl}`);
    this.name = 'SSRF_BLOCKED';
  }
}

export function validateWebhookUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new SsrfBlockedError(urlStr);
    }

    const host = u.hostname.toLowerCase();
    // Block localhost, private IPs, and cloud metadata
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31) ||
      host === '169.254.169.254' || // AWS/cloud metadata
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      throw new SsrfBlockedError(urlStr);
    }

    return true;
  } catch (e) {
    if (e.name === 'SSRF_BLOCKED') throw e;
    throw new SsrfBlockedError(urlStr);
  }
}

export class WorkflowWebhookDispatcher {
  constructor() {
    this.deliveryLogs = [];
  }

  dispatchSignedWebhook(targetUrl, secretKey, payload) {
    validateWebhookUrl(targetUrl);

    const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = createHmac('sha256', secretKey).update(bodyString).digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Concludo-Signature-256': signature,
      'X-Concludo-Delivery': `del_${Date.now()}`,
    };

    const deliveryRecord = {
      targetUrl,
      signature,
      payloadSize: bodyString.length,
      headers,
      dispatchedAt: new Date().toISOString(),
      status: 'DELIVERED',
    };

    this.deliveryLogs.push(deliveryRecord);
    return deliveryRecord;
  }
}

export class GovernanceBarrierService {
  constructor() {
    this.requests = new Map(); // id -> request
  }

  submitActionRequest(request) {
    if (!request.organisation_id) throw new Error('Organisation ID is required');
    if (!request.requesting_agent) throw new Error('Requesting agent ID is required');
    if (!request.action_type) throw new Error('Action type is required');

    const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const record = {
      id,
      organisation_id: request.organisation_id,
      requesting_agent: request.requesting_agent,
      action_type: request.action_type,
      proposed_payload: request.proposed_payload,
      status: 'PENDING',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      expires_at: now + (48 * 3600 * 1000), // 48 hours
      created_at: new Date(now).toISOString(),
    };

    this.requests.set(id, record);
    return record;
  }

  reviewRequest(requestId, humanUserId, decision, reason = null) {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`Approval request not found: ${requestId}`);

    // Self-approval prohibition: agents cannot approve their own actions
    if (!humanUserId || humanUserId.startsWith('agent_') || humanUserId === req.requesting_agent) {
      throw new Error('SECURITY VIOLATION: Agents cannot self-approve or bypass human review');
    }

    if (Date.now() > req.expires_at) {
      req.status = 'EXPIRED';
      throw new ApprovalExpiredError();
    }

    if (decision === 'APPROVE') {
      req.status = 'APPROVED';
      req.reviewed_by = humanUserId;
      req.reviewed_at = new Date().toISOString();
      return { ok: true, status: 'APPROVED', executed: true };
    } else {
      req.status = 'REJECTED';
      req.reviewed_by = humanUserId;
      req.reviewed_at = new Date().toISOString();
      req.rejection_reason = reason;
      return { ok: true, status: 'REJECTED', executed: false };
    }
  }

  getRequest(requestId) {
    const req = this.requests.get(requestId);
    if (!req) return null;
    if (Date.now() > req.expires_at && req.status === 'PENDING') {
      req.status = 'EXPIRED';
    }
    return req;
  }
}
