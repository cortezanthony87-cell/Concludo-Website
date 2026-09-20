/**
 * Tasklet 12.2: Access Grant Codes Service
 *
 * Stores and manages single-use access codes that grant a workspace a tier
 * and capability flags without billing.
 *
 * Security: Never returns secret_hash or secret_salt to any caller.
 */

export class GrantCodeService {
  constructor() {
    this.codes = new Map(); // id -> grantCodeRecord
    this.byPublicId = new Map(); // public_id -> id
  }

  seedCode(codeRow) {
    const id = codeRow.id || `gc_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      id,
      public_id: codeRow.public_id,
      secret_hash: codeRow.secret_hash,
      secret_salt: codeRow.secret_salt,
      hash_params: codeRow.hash_params || { algorithm: 'scrypt', N: 16384, r: 8, p: 1, keylen: 32 },
      grants_tier: codeRow.grants_tier || 'team',
      grants_capabilities: codeRow.grants_capabilities || ['governance_policy', 'legal_hold', 'audit_log'],
      grants_seat_count: codeRow.grants_seat_count || 5,
      label: codeRow.label || 'Internal grant',
      max_redemptions: codeRow.max_redemptions || 1,
      redemption_count: codeRow.redemption_count || 0,
      expires_at: codeRow.expires_at,
      revoked_at: codeRow.revoked_at || null,
      revoked_by: codeRow.revoked_by || null,
      revoked_reason: codeRow.revoked_reason || null,
      created_at: codeRow.created_at || new Date().toISOString(),
      created_by: codeRow.created_by || null,
    };

    this.codes.set(id, record);
    this.byPublicId.set(record.public_id, id);
    return id;
  }

  /**
   * Administrative listing. Never returns secret_hash or secret_salt.
   */
  listCodes() {
    return Array.from(this.codes.values()).map((c) => ({
      id: c.id,
      public_id: c.public_id,
      grants_tier: c.grants_tier,
      grants_capabilities: [...c.grants_capabilities],
      grants_seat_count: c.grants_seat_count,
      label: c.label,
      max_redemptions: c.max_redemptions,
      redemption_count: c.redemption_count,
      expires_at: c.expires_at,
      revoked_at: c.revoked_at,
      revoked_reason: c.revoked_reason,
      created_at: c.created_at,
    }));
  }

  getCodeStatus(publicId) {
    const id = this.byPublicId.get(publicId);
    if (!id) return null;
    const c = this.codes.get(id);
    if (!c) return null;

    return {
      public_id: c.public_id,
      grants_tier: c.grants_tier,
      is_active: !c.revoked_at && new Date(c.expires_at) > new Date() && c.redemption_count < c.max_redemptions,
      expires_at: c.expires_at,
      revoked: Boolean(c.revoked_at),
    };
  }

  revokeCode(id, actorId, reason) {
    const code = this.codes.get(id);
    if (!code) {
      const err = new Error('GRANT_CODE_NOT_FOUND');
      err.code = 'GRANT_CODE_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (code.revoked_at) {
      const err = new Error('GRANT_ALREADY_REVOKED');
      err.code = 'GRANT_ALREADY_REVOKED';
      err.status = 409;
      throw err;
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Revocation requires a mandatory typed reason');
    }

    code.revoked_at = new Date().toISOString();
    code.revoked_by = actorId;
    code.revoked_reason = reason.trim();

    return {
      id: code.id,
      public_id: code.public_id,
      revoked_at: code.revoked_at,
      revoked_by: code.revoked_by,
      revoked_reason: code.revoked_reason,
    };
  }
}
