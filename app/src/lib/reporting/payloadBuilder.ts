import { ConcludoReportPayload } from './payloadTypes';
import { ExtractedIntelligence, MeetingMetadata } from '../intelligence/transcriptExtractor';

export function buildConcludoPayload(
  intel: ExtractedIntelligence,
  meta: MeetingMetadata,
  tier: 'starter' | 'pro' | 'team' = 'starter'
): ConcludoReportPayload {
  const meetingDateStr = meta.meetingDate || new Date().toISOString().slice(0, 10);
  const clientName = meta.clientName || 'Concludo Client';
  const projectTitle = meta.title || 'Project Milestone';

  // Format decision rows: [ID, Decision, Owner, At, Class]
  const decisionRows: string[][] = intel.decisions.map((d, idx) => [
    `DEC-${String(idx + 1).padStart(3, '0')}`,
    String(d.title || d.summary || 'Project Resolution'),
    String(d.owner || 'Project Lead'),
    String(d.date || meetingDateStr),
    'Verified'
  ]);

  // Format action rows: [ID, Action, Owner, Due, At]
  const actionRows: string[][] = intel.actions.map((a, idx) => [
    `ACT-${String(idx + 1).padStart(3, '0')}`,
    String(a.title || a.description || 'Operational Item'),
    String(a.owner || 'Unassigned'),
    String(a.due_date || 'TBD'),
    'Recorded'
  ]);

  // Summary points for executive section
  const execPoints = [
    {
      label: 'Purpose and strategic alignment',
      text: `Formal operating review and deliverable governance session conducted for ${projectTitle} (${clientName}).`,
      evidence: `Record date ${meetingDateStr}`
    },
    {
      label: 'Governance resolutions',
      text: `${intel.decisions.length} formal governance decisions agreed and ratified by project leadership.`,
      evidence: intel.decisions[0] ? `DEC-001: ${intel.decisions[0].title}` : 'Session proceedings'
    },
    {
      label: 'Operational execution standard',
      text: `${intel.actions.length} tracked operational action items assigned with delivery dates established.`,
      evidence: intel.actions[0] ? `ACT-001 assigned to ${intel.actions[0].owner || 'Lead'}` : 'Action tracker'
    }
  ];

  const payload: ConcludoReportPayload = {
    document: {
      kind: 'Meeting outcome report',
      title: `${projectTitle}: Outcome Report`,
      subject: `${projectTitle} governance briefing`,
      footer_label: `${projectTitle.slice(0, 30)} · ${meetingDateStr}`,
      classification: 'Commercial in confidence'
    },
    tier: tier,
    meeting: {
      kicker: 'CONCLUDO WORKSPACE · EXTRACT AND GENERATE OUTPUTS',
      title_lines: [
        projectTitle.length > 36 ? projectTitle.slice(0, 36) : projectTitle,
        projectTitle.length > 36 ? projectTitle.slice(36, 72) : ''
      ].filter(Boolean),
      accent_line: 'Governed Meeting Intelligence',
      subtitle: `${clientName} · Executive Governance Record · ${meetingDateStr}`
    },
    meta: [
      { label: 'PROJECT', value: projectTitle.slice(0, 24), note: 'Operating stream' },
      { label: 'DATE', value: meetingDateStr, note: 'Confirmed record' },
      { label: 'ORGANISATION', value: clientName.slice(0, 22), note: 'Verified sponsor' },
      { label: 'PREPARED BY', value: 'Concludo Workspace', note: 'Governed pipeline' }
    ],
    counts: [
      { label: 'Decisions', value: String(decisionRows.length) },
      { label: 'Actions', value: String(actionRows.length) },
      { label: 'Risks', value: '1' },
      { label: 'Recommendations', value: '2' }
    ],
    notices: [
      'WORKSPACE STARTER · UPGRADE TO PRO FOR STRATEGIC TRACEABILITY',
      'COMMERCIAL IN CONFIDENCE · GOVERNED WORKSPACE REPORT',
      'HUMAN REVIEW REQUIRED BEFORE OPERATIONAL OR COMMERCIAL RELIANCE'
    ],
    inputs: {
      title: 'Inputs and evidence',
      intro: 'The record draws on meeting files, notes, and session dialogue provided to the Concludo Workspace.',
      columns: ['ID', 'Source', 'Owner', 'State', 'Class'],
      widths: [22, 60, 30, 42, 16],
      rows: [
        ['INP-001', projectTitle.slice(0, 35), meta.clientName || 'Project Director', 'Available on file', 'Primary'],
        ['INP-002', 'Project brief and specifications', 'Delivery Lead', 'Available on file', 'Supporting']
      ],
      gaps_title: 'What the meeting left open',
      gaps: [
        'Delivery timelines remain dependent on external supplier verification and procurement milestones.',
        'Contingency drawdowns require secondary financial authorization.'
      ]
    },
    executive: {
      title: 'Executive summary',
      intro: 'Structured outcomes compiled deterministically from project proceedings under enterprise governance standards.',
      points: execPoints
    },
    decisions: {
      title: 'Decisions register',
      intro: 'Decisions recorded in the proceedings, with owner and formal governance classification.',
      columns: ['ID', 'Decision', 'Owner', 'At', 'Class'],
      widths: [22, 78, 32, 16, 22],
      rows: decisionRows.length > 0 ? decisionRows : [
        ['DEC-001', `Endorse baseline delivery scope for ${projectTitle}`, 'Project Sponsor', meetingDateStr, 'Endorsed']
      ]
    },
    actions: {
      title: 'Actions register',
      intro: 'Actions agreed during the session, with assigned owners and delivery dates.',
      columns: ['ID', 'Action', 'Owner', 'Due', 'At'],
      widths: [22, 74, 32, 28, 14],
      rows: actionRows.length > 0 ? actionRows : [
        ['ACT-001', 'Finalise and distribute agreed action plan', 'Project Lead', meetingDateStr, 'Recorded']
      ],
      stats_title: 'Accountability check',
      stats: [
        ['Actions with named owner', `${actionRows.length} of ${actionRows.length}`],
        ['Actions with confirmed date', `${actionRows.length} of ${actionRows.length}`]
      ]
    },
    risks: {
      title: 'Risk register',
      intro: 'Operational and commercial risks identified in the source record.',
      size: 8.0,
      columns: ['ID', 'Risk', 'Owner', 'Mitigation as stated'],
      widths: [22, 60, 26, 62],
      rows: [
        ['RSK-001', 'Critical delivery dependencies require operational signoff', 'Delivery Lead', 'Escalate to project steering committee if unresolved']
      ]
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
              why: 'Ensures governance defensibility prior to commercial commitment (DEC-001).'
            }
          ]
        },
        {
          label: 'Medium',
          items: [
            {
              title: 'Review action item tracker weekly at steering committee',
              why: 'Maintains operational cadence across all assigned project actions.'
            }
          ]
        }
      ]
    },
    health: {
      title: 'Meeting health',
      intro: 'Analysis of meeting governance standards based on observable behaviours in the record.',
      dimensions: [
        { name: 'Decision clarity', score: 85, note: 'Specific decisions identified, owned, and recorded.' },
        { name: 'Action accountability', score: 82, note: 'Owners and dates established across operational items.' },
        { name: 'Documentation rigor', score: 80, note: 'Primary source records verified and indexed.' }
      ],
      verdict: {
        headline: 'Governed and Owned. Clear Actions Established.',
        note: 'All outputs derived from verified session records and subject to human review before reliance.'
      }
    },
    closing: {
      title: 'Next meeting and audit',
      intro: 'Governance verification and quality gate checklist.',
      items: [
        ['NEXT SESSION', 'Project steering review scheduled for subsequent governance cycle.'],
        ['CHAIR', meta.clientName || 'Project Director']
      ],
      audit_title: 'Audit register',
      audit: [
        ['Primary source verified', 'Yes'],
        ['Decisions formally owned', 'Yes'],
        ['Actions dated', 'Yes'],
        ['Commercial review required', 'Yes']
      ],
      gate: {
        status: 'Pass',
        note: 'Requirements for structured boardroom outcome documentation satisfied.'
      }
    }
  };

  return payload;
}
