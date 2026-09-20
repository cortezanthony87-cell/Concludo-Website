/**
 * Tasklet 11.3: Retention Controls and Soft Delete Lifecycle
 * Tasklet 11.4: Legal Hold Compatibility Engine
 * Tasklet 11.5: Output Versioning and Immutability
 */

export class RecordUnderLegalHoldError extends Error {
  constructor(message = 'Cannot purge record: active legal hold prevents deletion') {
    super(message);
    this.name = 'RECORD_UNDER_LEGAL_HOLD';
  }
}

export class OutputPublishedImmutableError extends Error {
  constructor(message = 'Published output is immutable. In-place modification is forbidden. Create a new version branch.') {
    super(message);
    this.name = 'OUTPUT_PUBLISHED_IMMUTABLE';
  }
}

export class RetentionLifecycleWorker {
  constructor() {
    this.records = []; // Array of records
    this.purgeLogs = [];
  }

  addRecord(record) {
    this.records.push({
      ...record,
      deleted_at: record.deleted_at || null,
      purge_after: record.purge_after || null,
      legal_hold: record.legal_hold ?? false,
    });
  }

  runPurgeCycle(nowTimestamp = Date.now()) {
    const surviving = [];
    const purged = [];

    for (const r of this.records) {
      if (r.deleted_at && r.purge_after && new Date(r.purge_after).getTime() <= nowTimestamp) {
        if (r.legal_hold) {
          // Suspended by legal hold
          surviving.push(r);
        } else {
          purged.push(r);
          this.purgeLogs.push({
            table_name: r.table_name || 'outputs',
            record_id: r.id,
            purged_at: new Date(nowTimestamp).toISOString(),
          });
        }
      } else {
        surviving.push(r);
      }
    }

    this.records = surviving;
    return {
      survivingCount: surviving.length,
      purgedCount: purged.length,
      purgedRecords: purged,
    };
  }
}

export class LegalHoldEngine {
  constructor() {
    this.cases = new Map(); // caseId -> case
    this.heldResourceIds = new Set();
  }

  applyLegalHold(caseData, resourceIds = []) {
    if (!caseData.case_reference) throw new Error('Case reference required');
    if (!caseData.organisation_id) throw new Error('Organisation ID required');

    const id = `lh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCase = {
      id,
      organisation_id: caseData.organisation_id,
      case_reference: caseData.case_reference,
      case_title: caseData.case_title,
      is_active: true,
      resource_ids: resourceIds,
      applied_at: new Date().toISOString(),
    };

    this.cases.set(id, newCase);
    for (const rId of resourceIds) {
      this.heldResourceIds.add(rId);
    }

    return newCase;
  }

  isResourceHeld(resourceId) {
    return this.heldResourceIds.has(resourceId);
  }

  releaseLegalHold(caseId, notes = '') {
    const c = this.cases.get(caseId);
    if (!c) throw new Error('Legal hold case not found');
    c.is_active = false;
    c.released_at = new Date().toISOString();
    c.release_notes = notes;

    for (const rId of c.resource_ids) {
      this.heldResourceIds.delete(rId);
    }

    return c;
  }
}

export class OutputImmutabilityService {
  constructor() {
    this.outputs = new Map(); // id -> output
  }

  saveOutput(output) {
    this.outputs.set(output.id, {
      ...output,
      version: output.version || 1,
      lifecycle_state: output.lifecycle_state || 'DRAFT',
    });
    return this.outputs.get(output.id);
  }

  updateOutput(outputId, updates) {
    const out = this.outputs.get(outputId);
    if (!out) throw new Error('Output not found');

    // Immutability rule: if lifecycle_state is 'PUBLISHED', reject in-place edits
    if (out.lifecycle_state === 'PUBLISHED') {
      throw new OutputPublishedImmutableError();
    }

    Object.assign(out, updates);
    return out;
  }

  branchNewVersion(outputId, updates, userId = null) {
    const out = this.outputs.get(outputId);
    if (!out) throw new Error('Output not found');

    const newVersionNumber = out.version + 1;
    const newOutput = {
      ...out,
      ...updates,
      id: `${out.id}_v${newVersionNumber}`,
      parent_output_id: out.id,
      version: newVersionNumber,
      lifecycle_state: 'DRAFT_GENERATED',
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    this.outputs.set(newOutput.id, newOutput);
    return newOutput;
  }
}
