/**
 * Tasklet 1.8: Output Retrieval Services
 *
 * Provides high-performance, filterable, and paginated retrieval of compiled
 * outputs with projection filters and tenant boundary enforcement.
 */

export class OutputRetrievalService {
  constructor(persistenceService) {
    this.persistence = persistenceService;
  }

  getMeetingOutputs(meetingId, options = {}) {
    const {
      includeDeleted = false,
      includeRendered = true,
      includePayload = true,
      outputId = null,
    } = options;

    const all = Array.from(this.persistence.records.values()).filter(
      (r) => r.meeting_id === meetingId
    );

    const filtered = all.filter((r) => {
      if (!includeDeleted && r.deleted_at !== null) return false;
      if (outputId && r.output_id !== outputId) return false;
      return true;
    });

    // Projections
    return filtered.map((r) => {
      const out = { ...r };
      if (!includeRendered) {
        delete out.rendered_html;
        delete out.rendered_markdown;
      }
      if (!includePayload) {
        delete out.structured_payload;
      }
      return out;
    });
  }

  getOutputDetail(outputInstanceId) {
    const record = this.persistence.getOutputById(outputInstanceId);
    if (!record || record.deleted_at !== null) {
      const err = new Error('Output not found');
      err.code = 'OUTPUT_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    return record;
  }

  searchOutputs(organisationId, query = {}) {
    const { term, tier, limit = 20, offset = 0 } = query;
    const records = Array.from(this.persistence.records.values()).filter((r) => {
      if (r.organisation_id !== organisationId) return false;
      if (r.deleted_at !== null) return false;
      if (term) {
        const text = `${r.title} ${r.summary || ''}`.toLowerCase();
        if (!text.includes(term.toLowerCase())) return false;
      }
      return true;
    });

    return {
      total: records.length,
      limit,
      offset,
      items: records.slice(offset, offset + limit),
    };
  }
}
