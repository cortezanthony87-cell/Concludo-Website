/**
 * Tasklet 7.9: Document Versioning Service
 * Maintains complete, immutable version histories for regenerated or edited documents.
 * Generates automated change summaries and side-by-side diffs.
 */

export class VersionNotFoundError extends Error {
  constructor(message = 'Requested document version was not found') {
    super(message);
    this.name = 'VERSION_NOT_FOUND';
  }
}

export class DocumentVersioningService {
  constructor() {
    this.snapshots = new Map(); // outputId -> Array of versions
  }

  createSnapshot(outputId, orgId, payload, renderedHtml, userId = null, explicitSummary = null) {
    if (!outputId) throw new Error('Output ID is required');
    if (!orgId) throw new Error('Organisation ID is required');
    if (!payload) throw new Error('Structured payload is required');

    const history = this.snapshots.get(outputId) || [];
    const versionNumber = history.length + 1;

    let changeSummary = explicitSummary;
    if (!changeSummary) {
      if (versionNumber === 1) {
        changeSummary = 'Initial document generation';
      } else {
        const prev = history[history.length - 1];
        changeSummary = this.computeChangeSummary(prev.structured_payload, payload);
      }
    }

    const snapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      output_id: outputId,
      organisation_id: orgId,
      version_number: versionNumber,
      structured_payload: JSON.parse(JSON.stringify(payload)),
      rendered_html: renderedHtml || '',
      change_summary: changeSummary,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

    history.push(snapshot);
    this.snapshots.set(outputId, history);

    return snapshot;
  }

  computeChangeSummary(prevPayload, nextPayload) {
    const changes = [];
    const prevDecisions = prevPayload.decisions || [];
    const nextDecisions = nextPayload.decisions || [];
    if (nextDecisions.length !== prevDecisions.length) {
      changes.push(`Decisions changed from ${prevDecisions.length} to ${nextDecisions.length}`);
    }

    const prevActions = prevPayload.actions || [];
    const nextActions = nextPayload.actions || [];
    if (nextActions.length !== prevActions.length) {
      changes.push(`Actions changed from ${prevActions.length} to ${nextActions.length}`);
    }

    const prevSections = prevPayload.sections || [];
    const nextSections = nextPayload.sections || [];
    if (nextSections.length !== prevSections.length) {
      changes.push(`Section count modified (${prevSections.length} -> ${nextSections.length})`);
    }

    return changes.length ? changes.join('; ') : 'Content phrasing updated';
  }

  getVersions(outputId, orgId) {
    const history = this.snapshots.get(outputId) || [];
    return history.filter(v => v.organisation_id === orgId);
  }

  getVersion(outputId, versionNumber, orgId) {
    const versions = this.getVersions(outputId, orgId);
    const match = versions.find(v => v.version_number === Number(versionNumber));
    if (!match) throw new VersionNotFoundError(`Version ${versionNumber} not found for output ${outputId}`);
    return match;
  }

  rollbackToVersion(outputId, targetVersionNumber, orgId, userId = null) {
    const target = this.getVersion(outputId, targetVersionNumber, orgId);
    return this.createSnapshot(
      outputId,
      orgId,
      target.structured_payload,
      target.rendered_html,
      userId,
      `Rollback to version ${targetVersionNumber}`
    );
  }

  computeDiff(outputId, versionA, versionB, orgId) {
    const vA = this.getVersion(outputId, versionA, orgId);
    const vB = this.getVersion(outputId, versionB, orgId);

    const secA = vA.structured_payload.sections || [];
    const secB = vB.structured_payload.sections || [];

    const added = secB.filter(b => !secA.some(a => (a.heading || a.title) === (b.heading || b.title)));
    const deleted = secA.filter(a => !secB.some(b => (b.heading || b.title) === (a.heading || a.title)));
    const modified = secB.filter(b => {
      const match = secA.find(a => (a.heading || a.title) === (b.heading || b.title));
      return match && (match.body || match.content) !== (b.body || b.content);
    });

    return {
      outputId,
      versionA,
      versionB,
      addedSections: added.map(s => s.heading || s.title),
      deletedSections: deleted.map(s => s.heading || s.title),
      modifiedSections: modified.map(s => s.heading || s.title),
    };
  }
}
