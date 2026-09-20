/**
 * Tasklet 10.5: Output Reuse Framework
 * Tasklet 10.6: Report Reuse Framework
 */

export class CircularOutputLineageError extends Error {
  constructor(message = 'Circular dependency detected in output lineage') {
    super(message);
    this.name = 'CIRCULAR_OUTPUT_LINEAGE';
  }
}

export class SeriesHasSingleMeetingError extends Error {
  constructor(message = 'A series report requires a minimum of 2 meetings in the series.') {
    super(message);
    this.name = 'SERIES_HAS_SINGLE_MEETING';
  }
}

export class OutputReuseService {
  constructor() {
    this.lineageEdges = []; // { sourceOutputId, targetMeetingId, orgId, type }
    this.outputs = new Map(); // outputId -> output
  }

  registerOutput(outputId, orgId, meetingId, payload) {
    this.outputs.set(outputId, { orgId, meetingId, payload });
  }

  linkPrecursorOutput(sourceOutputId, targetMeetingId, orgId, relType = 'PRIOR_DECISION_BASE') {
    const src = this.outputs.get(sourceOutputId);
    if (!src || src.orgId !== orgId) {
      throw new Error('Source output does not exist or belongs to another organisation');
    }

    // Circular check: ensure targetMeeting does not lead back to sourceOutput
    if (src.meetingId === targetMeetingId) {
      throw new CircularOutputLineageError('Cannot link output as precursor to its own source meeting');
    }

    this.lineageEdges.push({
      id: `lin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceOutputId,
      targetMeetingId,
      orgId,
      relationship_type: relType,
      created_at: new Date().toISOString(),
    });
  }

  getPrecursorOutputs(meetingId, orgId) {
    const matching = this.lineageEdges.filter(e => e.targetMeetingId === meetingId && e.orgId === orgId);
    return matching.map(e => {
      const out = this.outputs.get(e.sourceOutputId);
      return {
        lineageId: e.id,
        relationshipType: e.relationship_type,
        outputId: e.sourceOutputId,
        sourceMeetingId: out.meetingId,
        // Crucial requirement: Carried-forward content keeps original evidence mark and citation
        decisions: (out.payload.decisions || []).map(d => ({
          ...d,
          carried_from_meeting: out.meetingId,
          evidence_mark: d.evidence_mark || 'confirmed',
        })),
      };
    });
  }
}

export class ReportReuseEngine {
  constructor() {
    this.seriesMeetings = new Map(); // orgId:seriesId -> Array of meetings
  }

  addSeriesMeeting(orgId, seriesId, meeting) {
    const key = `${orgId}:${seriesId}`;
    const list = this.seriesMeetings.get(key) || [];
    list.push(meeting);
    this.seriesMeetings.set(key, list);
  }

  compileSeriesReport(orgId, seriesId) {
    const key = `${orgId}:${seriesId}`;
    const meetings = this.seriesMeetings.get(key) || [];

    if (meetings.length < 2) {
      throw new SeriesHasSingleMeetingError();
    }

    // Aggregate progress across periods
    const allDecisions = [];
    const allActions = [];
    for (const m of meetings) {
      if (m.decisions) allDecisions.push(...m.decisions);
      if (m.actions) allActions.push(...m.actions);
    }

    const closedActions = allActions.filter(a => a.status === 'DONE' || a.status === 'CLOSED');
    const openActions = allActions.filter(a => a.status !== 'DONE' && a.status !== 'CLOSED');

    return {
      seriesId,
      meetingCount: meetings.length,
      totalDecisions: allDecisions.length,
      totalActions: allActions.length,
      closedActionsCount: closedActions.length,
      openActionsCount: openActions.length,
      canonicalDisclaimer: 'Not a benchmark. Historical comparison is within this organisation and meeting series only.',
    };
  }
}
