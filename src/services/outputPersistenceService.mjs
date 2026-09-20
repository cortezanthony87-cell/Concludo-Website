/**
 * Tasklet 1.7: Output Persistence Service
 *
 * Stores generated output payloads, structured JSON trees, renderable HTML,
 * and compiled markdown with delta versioning, 30-day soft deletion, and
 * legal hold protection.
 */

export class OutputPersistenceService {
  constructor() {
    this.records = new Map(); // id -> outputRecord
  }

  saveOutput(input) {
    const {
      meetingId,
      organisationId,
      outputId,
      title,
      summary,
      structuredPayload,
      renderedHtml,
      renderedMarkdown,
      dqiScore,
      createdBy,
    } = input;

    if (!meetingId || !organisationId || !outputId) {
      throw new Error('meetingId, organisationId, and outputId are required for output persistence');
    }

    // Determine current version count for this meeting and output_id
    const existing = Array.from(this.records.values()).filter(
      (r) => r.meeting_id === meetingId && r.output_id === outputId && r.deleted_at === null
    );
    const nextVersion = existing.length > 0
      ? Math.max(...existing.map((r) => r.version)) + 1
      : 1;

    // Sanitise payload: strip sensitive credentials or authentication tokens
    const sanitisedPayload = JSON.parse(JSON.stringify(structuredPayload || {}));
    delete sanitisedPayload.service_role_key;
    delete sanitisedPayload.api_key;
    delete sanitisedPayload.password;

    const id = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id,
      meeting_id: meetingId,
      organisation_id: organisationId,
      output_id: outputId,
      version: nextVersion,
      lifecycle_state: 'DRAFT_GENERATED',
      title: title || `Output ${outputId}`,
      summary: summary || null,
      structured_payload: sanitisedPayload,
      rendered_html: renderedHtml || null,
      rendered_markdown: renderedMarkdown || null,
      dqi_score: typeof dqiScore === 'number' ? Math.max(0, Math.min(100, dqiScore)) : null,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      deleted_by: null,
      purge_after: null,
      legal_hold: false,
    };

    this.records.set(id, record);
    return record;
  }

  softDelete(outputInstanceId, deletedBy) {
    const record = this.records.get(outputInstanceId);
    if (!record) {
      const err = new Error('Output not found');
      err.code = 'OUTPUT_NOT_FOUND';
      throw err;
    }

    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days retention

    record.deleted_at = now.toISOString();
    record.deleted_by = deletedBy || null;
    record.purge_after = purgeAfter.toISOString();
    record.updated_at = now.toISOString();
    return record;
  }

  setLegalHold(outputInstanceId, holdState) {
    const record = this.records.get(outputInstanceId);
    if (!record) {
      const err = new Error('Output not found');
      err.code = 'OUTPUT_NOT_FOUND';
      throw err;
    }
    record.legal_hold = Boolean(holdState);
    record.updated_at = new Date().toISOString();
    return record;
  }

  purgeExpired(referenceDate = new Date()) {
    const purgedIds = [];
    for (const [id, record] of this.records.entries()) {
      // Retention rule: purge only when deleted_at is not null, purge_after < now, and legal_hold is false
      if (
        record.deleted_at !== null &&
        record.purge_after &&
        new Date(record.purge_after) < referenceDate
      ) {
        if (record.legal_hold) {
          // Suspended by legal hold
          continue;
        }
        this.records.delete(id);
        purgedIds.push(id);
      }
    }
    return purgedIds;
  }

  getOutputById(outputInstanceId) {
    return this.records.get(outputInstanceId) || null;
  }
}
