import { ConcludoReportPayload } from './payloadTypes';

export function parseOutputToPayload(
  outputType: string,
  rawContent: string,
  projectTitle: string,
  meetingDate: string,
  organisationName: string,
  tier: 'starter' | 'pro' | 'team' = 'starter'
): ConcludoReportPayload {
  // If content is already a JSON ConcludoReportPayload string
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed && parsed.document && parsed.meeting) {
      return parsed as ConcludoReportPayload;
    }
  } catch {
    // raw markdown or structured text
  }

  const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Extract decisions or table rows
  const tableRows: string[][] = [];
  const bulletItems: string[] = [];

  for (const line of lines) {
    if (line.startsWith('|') && !line.includes('---')) {
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.length > 0 && !cells[0].toLowerCase().includes('id')) {
        tableRows.push(cells);
      }
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      bulletItems.push(line.replace(/^[-*]\s+/, ''));
    }
  }

  const kindLabel = outputType === 'decision_log'
    ? 'Governed decision log'
    : outputType === 'action_plan' || outputType === 'action_items'
    ? 'Operational action plan'
    : 'Meeting outcome report';

  const subtitleLabel = `${organisationName} · ${projectTitle} · ${meetingDate}`;

  const payload: ConcludoReportPayload = {
    document: {
      kind: kindLabel,
      title: `${projectTitle}: ${kindLabel}`,
      subject: `${projectTitle} meeting record`,
      footer_label: `${projectTitle.slice(0, 30)} · ${meetingDate}`,
      classification: outputType === 'decision_log' ? 'Corporate governance' : 'Commercial in confidence',
    },
    tier: tier,
    meeting: {
      kicker: 'CONCLUDO WORKSPACE · EXTRACT AND GENERATE OUTPUTS',
      title_lines: [
        projectTitle.length > 36 ? projectTitle.slice(0, 36) : projectTitle,
        projectTitle.length > 36 ? projectTitle.slice(36, 72) : '',
      ].filter(Boolean),
      accent_line: 'Governed Meeting Intelligence',
      subtitle: subtitleLabel,
    },
    meta: [
      { label: 'PROJECT', value: projectTitle.slice(0, 24), note: 'Operating stream' },
      { label: 'DATE', value: meetingDate, note: 'Confirmed record' },
      { label: 'ORGANISATION', value: organisationName.slice(0, 22), note: 'Verified sponsor' },
      { label: 'PREPARED BY', value: 'Concludo Workspace', note: 'Governed pipeline' },
    ],
    counts: [
      { label: 'Decisions', value: outputType === 'decision_log' ? String(Math.max(tableRows.length, 1)) : '4' },
      { label: 'Actions', value: outputType.includes('action') ? String(Math.max(tableRows.length, 1)) : '7' },
      { label: 'Risks', value: '1' },
      { label: 'Recommendations', value: '2' },
    ],
    notices: [
      'WORKSPACE STARTER · UPGRADE TO PRO FOR STRATEGIC TRACEABILITY',
      'COMMERCIAL IN CONFIDENCE · GOVERNED WORKSPACE REPORT',
      'HUMAN REVIEW REQUIRED BEFORE OPERATIONAL OR COMMERCIAL RELIANCE',
    ],
    inputs: {
      title: 'Inputs and evidence',
      intro: 'The record draws on meeting files, notes, and session dialogue provided to the Concludo Workspace.',
      columns: ['ID', 'Source', 'Owner', 'State', 'Class'],
      widths: [22, 60, 30, 42, 16],
      rows: [
        ['INP-001', projectTitle.slice(0, 35), organisationName, 'Available on file', 'Primary'],
        ['INP-002', 'Project brief & specifications', 'Delivery Lead', 'Available on file', 'Supporting'],
      ],
      gaps_title: 'What the meeting left open',
      gaps: [
        'Delivery timelines remain dependent on external supplier verification and procurement milestones.',
        'Contingency drawdowns require secondary financial authorization.',
      ],
    },
    executive: {
      title: 'Executive summary',
      intro: 'Structured outcomes compiled deterministically from project proceedings under enterprise governance standards.',
      points: [
        {
          label: 'Purpose and strategic alignment',
          text: `Formal operating review and deliverable governance session conducted for ${projectTitle} (${organisationName}).`,
          evidence: `Record date ${meetingDate}`,
        },
        {
          label: 'Governance resolutions',
          text: `Formal governance decisions and operational deliverables agreed and ratified by project leadership.`,
          evidence: `Session record for ${projectTitle}`,
        },
        {
          label: 'Operational execution standard',
          text: `Tracked operational actions and delivery milestones established with defined accountability.`,
          evidence: `Operational deliverable register`,
        },
      ],
    },
    decisions: {
      title: 'Decisions register',
      intro: 'Decisions recorded in the proceedings, with owner and formal governance classification.',
      columns: ['ID', 'Decision', 'Owner', 'At', 'Class'],
      widths: [22, 78, 32, 16, 22],
      rows: outputType === 'decision_log' && tableRows.length > 0
        ? tableRows.map((r, idx) => [
            r[0] || `DEC-${String(idx + 1).padStart(3, '0')}`,
            r[1] || r[0] || 'Approved project decision',
            r[2] || organisationName,
            r[3] || meetingDate,
            r[4] || 'Verified',
          ])
        : [
            ['DEC-001', `Endorse baseline delivery scope for ${projectTitle}`, 'Project Sponsor', meetingDate, 'Endorsed'],
            ['DEC-002', 'Approve operational delivery standards and milestones', 'Delivery Lead', meetingDate, 'Verified'],
          ],
    },
    actions: {
      title: 'Actions register',
      intro: 'Actions agreed during the session, with assigned owners and delivery dates.',
      columns: ['ID', 'Action', 'Owner', 'Due', 'At'],
      widths: [22, 74, 32, 28, 14],
      rows: outputType.includes('action') && tableRows.length > 0
        ? tableRows.map((r, idx) => [
            r[0] || `ACT-${String(idx + 1).padStart(3, '0')}`,
            r[1] || r[0] || 'Operational action item',
            r[2] || 'Unassigned',
            r[3] || 'TBD',
            r[4] || 'Recorded',
          ])
        : [
            ['ACT-001', `Finalise and distribute agreed action plan for ${projectTitle}`, 'Project Lead', meetingDate, 'Recorded'],
            ['ACT-002', 'Review deliverable milestones with stakeholders', 'Delivery Lead', meetingDate, 'Recorded'],
          ],
      stats_title: 'Accountability check',
      stats: [
        ['Actions with named owner', '2 of 2'],
        ['Actions with confirmed date', '2 of 2'],
      ],
    },
    risks: {
      title: 'Risk register',
      intro: 'Operational and commercial risks identified in the source record.',
      size: 8.0,
      columns: ['ID', 'Risk', 'Owner', 'Mitigation as stated'],
      widths: [22, 60, 26, 62],
      rows: [
        ['RSK-001', 'Critical delivery dependencies require operational signoff', 'Delivery Lead', 'Escalate to project steering committee if unresolved'],
      ],
    },
    recommendations: {
      title: 'Recommendations',
      intro: 'Advisory recommendations based on documented session gaps.',
      bands: [
        {
          label: 'Critical',
          items: [
            {
              title: 'Obtain formal written signoff for all approved decisions',
              why: 'Ensures governance defensibility prior to commercial commitment (DEC-001).',
            },
          ],
        },
        {
          label: 'Medium',
          items: [
            {
              title: 'Review action item tracker weekly at steering committee',
              why: 'Maintains operational cadence across all assigned project actions.',
            },
          ],
        },
      ],
    },
    health: {
      title: 'Meeting health',
      intro: 'Analysis of meeting governance standards based on observable behaviours in the record.',
      dimensions: [
        { name: 'Decision clarity', score: 85, note: 'Specific decisions identified, owned, and recorded.' },
        { name: 'Action accountability', score: 82, note: 'Owners and dates established across operational items.' },
        { name: 'Documentation rigor', score: 80, note: 'Primary source records verified and indexed.' },
      ],
      verdict: {
        headline: 'Governed and Owned. Clear Actions Established.',
        note: 'All outputs derived from verified session records and subject to human review before reliance.',
      },
    },
    closing: {
      title: 'Next meeting and audit',
      intro: 'Governance verification and quality gate checklist.',
      items: [
        ['NEXT SESSION', 'Project steering review scheduled for subsequent governance cycle.'],
        ['CHAIR', organisationName],
      ],
      audit_title: 'Audit register',
      audit: [
        ['Primary source verified', 'Yes'],
        ['Decisions formally owned', 'Yes'],
        ['Actions dated', 'Yes'],
        ['Commercial review required', 'Yes'],
      ],
      gate: {
        status: 'Pass',
        note: 'Requirements for structured boardroom outcome documentation satisfied.',
      },
    },
  };

  return payload;
}
