/**
 * Tasklet 7.8: Document Storage Service
 * Manages secure persistent storage of compiled documents and export artefacts.
 * Path convention: outputs-vault/{organisation_id}/{meeting_id}/{filename}
 * Generates time-limited signed download URLs (900s expiry).
 * Enforces organisation storage quotas.
 */

import { createHash, createHmac } from 'node:crypto';

export class StorageQuotaExceededError extends Error {
  constructor(message = 'Organisation document storage quota exceeded') {
    super(message);
    this.name = 'STORAGE_QUOTA_EXCEEDED';
  }
}

export class DocumentStorageService {
  constructor(options = {}) {
    this.signingSecret = options.signingSecret || 'concludo-storage-signing-secret-key-32b';
    this.urlExpirySeconds = options.urlExpirySeconds || 900; // 15 mins
    this.orgQuotasBytes = new Map(); // orgId -> quota limit
    this.orgUsageBytes = new Map(); // orgId -> current usage
    this.storedObjects = new Map(); // path -> { bytes, hash, uploadedAt }
  }

  setOrgQuota(orgId, quotaBytes) {
    this.orgQuotasBytes.set(orgId, quotaBytes);
  }

  getOrgUsage(orgId) {
    return this.orgUsageBytes.get(orgId) || 0;
  }

  async storeDocument(orgId, meetingId, filename, contentBytes) {
    if (!orgId) throw new Error('Organisation ID is required');
    if (!meetingId) throw new Error('Meeting ID is required');
    if (!filename) throw new Error('Filename is required');
    if (!contentBytes) throw new Error('Content bytes are required');

    const bytes = Buffer.isBuffer(contentBytes) ? contentBytes : Buffer.from(contentBytes);
    const size = bytes.length;
    const currentUsage = this.getOrgUsage(orgId);
    const quota = this.orgQuotasBytes.get(orgId) || 1024 * 1024 * 1024; // 1GB default

    if (currentUsage + size > quota) {
      throw new StorageQuotaExceededError(`Quota exceeded for organisation ${orgId}. Used: ${currentUsage}, Attempted: ${size}, Limit: ${quota}`);
    }

    const path = `outputs-vault/${orgId}/${meetingId}/${filename}`;
    const hash = createHash('sha256').update(bytes).digest('hex');

    this.storedObjects.set(path, {
      bytes,
      hash,
      size,
      uploadedAt: new Date().toISOString(),
    });

    this.orgUsageBytes.set(orgId, currentUsage + size);

    return {
      storage_path: path,
      sha256_hash: hash,
      size_bytes: size,
    };
  }

  generateSignedDownloadUrl(storagePath, expirySeconds = this.urlExpirySeconds) {
    const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;
    const payload = `${storagePath}:${expiresAt}`;
    const signature = createHmac('sha256', this.signingSecret).update(payload).digest('hex');

    return `https://storage.concludo.com/${storagePath}?expires=${expiresAt}&sig=${signature}`;
  }

  verifySignedUrl(url) {
    try {
      const parsed = new URL(url);
      const storagePath = parsed.pathname.replace(/^\//, '');
      const expires = Number(parsed.searchParams.get('expires'));
      const sig = parsed.searchParams.get('sig');

      if (!expires || !sig) return false;
      if (Math.floor(Date.now() / 1000) > expires) return false;

      const expectedPayload = `${storagePath}:${expires}`;
      const expectedSig = createHmac('sha256', this.signingSecret).update(expectedPayload).digest('hex');

      return sig === expectedSig;
    } catch {
      return false;
    }
  }

  getDocument(storagePath) {
    return this.storedObjects.get(storagePath) || null;
  }
}
