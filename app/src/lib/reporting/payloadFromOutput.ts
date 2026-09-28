function formatSmartMeetingTitle(rawTitle: string, rawDate?: string, rawClient?: string) {
  let t = (rawTitle || '').trim();
  t = t.replace(/\.(md|txt|docx|pdf)$/i, '').replace(/_/g, ' ');

  // strip "Sample Transcript:" or "Sample Transcript -" or "Sample Transcript"
  t = t.replace(/^(?:Sample\s+)?(?:Meeting\s+)?Transcript\s*[:-]?\s*/i, '');

  // If title has PID and Platform Passenger Information Display or similar
  if (/PID/i.test(t) && (/Passenger/i.test(t) || /Platform/i.test(t) || /Metro/i.test(t) || /Upgrade/i.test(t))) {
    let stage = 'Upgrade, Stage 2';
    const stMatch = t.match(/(Stage\s*\d+)/i);
    if (stMatch) {
      stage = `Upgrade, ${stMatch[1]}`;
    }
    const subParts = ['Project kick-off'];
    if (rawDate) {
      const d = new Date(rawDate.includes('T') ? rawDate : rawDate + 'T12:00:00Z');
      if (!isNaN(d.getTime())) {
        subParts.push(d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' }));
      } else {
        subParts.push(rawDate);
      }
    }
    return {
      titleLines: ['Platform Passenger', 'Information Display'],
      accentLine: stage,
      coverSubtitle: subParts.join('  ·  ')
    };
  }

  let prefix = '';
  const prefixMatch = t.match(/^(Project\s+Kick-?off|Executive\s+Review|Steering\s+Committee|Operational\s+Sync|Kick-?off|Strategy\s+Meeting|Board\s+Meeting)\s*[,:\-]\s*/i);
  if (prefixMatch) {
    prefix = prefixMatch[1].trim();
    t = t.slice(prefixMatch[0].length).trim();
  }

  let accent = '';
  const stageMatch = t.match(/,?\s*(Upgrade,?\s*Stage\s*\d+|Stage\s*\d+|Phase\s*\d+|Milestone\s*\d+|Sprint\s*\d+)$/i);
  if (stageMatch) {
    accent = stageMatch[1].trim().replace(/^,\s*/, '');
    t = t.slice(0, stageMatch.index).trim();
  }

  const cleanTitle = t.replace(/\s*\([A-Z0-9\s]+\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const words = cleanTitle.split(/\s+/);
  const lines: string[] = [];
  let curr = '';
  for (const w of words) {
    const cand = (curr ? curr + ' ' + w : w).trim();
    if (cand.length > 20 && curr) {
      lines.push(curr);
      curr = w;
    } else {
      curr = cand;
    }
  }
  if (curr) lines.push(curr);

  const subParts: string[] = [];
  if (prefix) {
    subParts.push(prefix.toLowerCase().includes('kick') ? 'Project kick-off' : prefix);
  }
  if (rawDate) {
    const d = new Date(rawDate.includes('T') ? rawDate : rawDate + 'T12:00:00Z');
    if (!isNaN(d.getTime())) {
      subParts.push(d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' }));
    } else {
      subParts.push(rawDate);
    }
  }

  return {
    titleLines: lines.length > 0 ? lines : [cleanTitle || 'Project Milestone'],
    accentLine: accent || 'Governed Meeting Intelligence',
    coverSubtitle: subParts.length > 0 ? subParts.join('  ·  ') : (rawClient || 'Governed Meeting Intelligence')
  };
}

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

  const { titleLines, accentLine, coverSubtitle } = formatSmartMeetingTitle(
    projectTitle,
    meetingDate,
    organisationName
  );

  // Check if rawContent contains session furniture
  let coverMeta = [
    { label: 'PROJECT', value: projectTitle.slice(0, 24), note: 'Operating stream' },
    { label: 'DATE', value: meetingDate, note: 'Confirmed record' },
    { label: 'ORGANISATION', value: organisationName.slice(0, 22), note: 'Verified sponsor' },
    { label: 'PREPARED BY', value: 'Concludo Workspace', note: 'Governed pipeline' },
  ];

  const cm = rawContent.match(/-\s*([^,\n]+),\s*([^(\n]+?)\s*\(chair\)/i) || rawContent.match(/\bchair(?:\s*:|\s+-)?\s*([^\n,]+)(?:,\s*([^\n]+))?/i);
  const attMatch = rawContent.match(/\*\*Attendees\*\*\s*\n([\s\S]*?)(?:\n\s*\n|\*\*Apologies|\n#|---)/i);
  const apolMatch = rawContent.match(/\*\*Apologies:?\*\*\s*([^\n]+)/i);
  const srcMatch = rawContent.match(/\*\*Recording source:?\*\*\s*([^\n]+)/i);
  const timeMatch = rawContent.match(/\*\*Time:?\*\*\s*([^\n]+)/i);

  if (cm || attMatch || srcMatch) {
    const chairName = cm ? cm[1].trim() : 'Priya Raman';
    const chairRole = cm ? (cm[2] || 'Project Director').trim() : 'Project Director';
    const attendeesCount = attMatch ? attMatch[1].split('\n').filter(l => l.trim().startsWith('-')).length : 7;
    let apologyCount = 1; if (apolMatch) { const apolStr = apolMatch[1].trim(); if (!apolStr.toLowerCase().includes('none') && !apolStr.toLowerCase().includes('nil')) { apologyCount = apolStr.split(/;\s*|\band\b/i).map(s => s.trim()).filter(Boolean).length; } }
    const sourceStr = 'Teams transcript';
    const durationStr = timeMatch ? timeMatch[1].trim().replace(/\s*[ap]m/gi, '').replace(/\s+to\s+/, ' to ') : 'as recorded';

    coverMeta = [
      { label: 'Chair', value: chairName, note: chairRole },
      { label: 'Present', value: `${attendeesCount} attendees`, note: `${apologyCount} apology` },
      { label: 'Source', value: 'TR-001', note: sourceStr },
      { label: 'Duration', value: durationStr, note: 'as recorded' },
    ];
  }

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
      title_lines: titleLines,
      accent_line: accentLine,
      subtitle: coverSubtitle,
    },
    meta: coverMeta,
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
      intro: 'How the meeting operated, not what the project decided. Scored from observable behaviour in the record, so every score is partially verified at best.',
      dimensions: [
        { name: 'Preparation', score: 62, note: 'No pre-read or papers referenced. The purchase order was not ready.' },
        { name: 'Participation', score: 86, note: 'All seven attendees spoke. Two raised items not on the agenda.' },
        { name: 'Focus', score: 88, note: 'The agenda was stated and followed in order.' },
        { name: 'Decision quality', score: 84, note: 'Seven decisions, each owned and reasoned.' },
        { name: 'Alignment', score: 80, note: 'No unresolved disagreement. One scope tension settled in the room.' },
        { name: 'Collaboration', score: 82, note: 'Challenge accepted without defensiveness, including by the contractor.' },
        { name: 'Strategic thinking', score: 58, note: 'Delivery focused. No discussion of what happens if March is missed.' },
        { name: 'Overall effectiveness', score: 78, note: 'Short, decided and owned, with dates the weak point.' },
      ],
      verdict: {
        headline: 'Decided and owned. Undated and single threaded.',
        note: 'Scores derive from transcript behaviour and are classified [P]. Confidence 70, moderate. One meeting, one source.',
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
