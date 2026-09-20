/**
 * Tasklet 3.8: Advisory Frame Library (Channel INS-H)
 * 
 * Apply structured analytical lenses from the public advisory frame library.
 * Rule: Never names a consulting firm, claims a firm's methodology, or states what a firm would recommend.
 * Rule: Framed as what a public frame surfaces, never as Concludo's own recommendation.
 * Render: observation. Cap: 2. Tier: T3.
 */

export class ConsultingFirmReferenceProhibitedError extends Error {
  constructor(firmName) {
    super(`Prohibited reference to consulting firm or proprietary methodology: "${firmName}". Concludo uses only public, generally accepted analytical frames.`);
    this.name = 'ConsultingFirmReferenceProhibitedError';
    this.code = 'CONSULTING_FIRM_REFERENCE_PROHIBITED';
  }
}

export const INS_H_CHANNEL = {
  id: 'INS-H',
  question: 'What would an adviser likely recommend?',
  detector: 'advisory frame library',
  tier: 'T3',
  cap: 2,
  render: 'observation'
};

export const AUTHORITATIVE_ADVISORY_FRAMES = [
  'structured problem decomposition',
  'mutually exclusive option sets',
  'hypothesis led analysis',
  'value driver tree',
  'capability maturity assessment',
  'stakeholder influence mapping',
  'benefit dependency mapping',
  'pre-mortem analysis',
  'second order consequence analysis',
  'cost of delay',
  'SWOT',
  'options trade off',
  'scenario comparison'
];

const PROHIBITED_FIRMS = [
  'mckinsey', 'bcg', 'bain', 'deloitte', 'pwc', 'pricewaterhousecoopers',
  'kpmg', 'ey', 'ernst & young', 'accenture', 'oliver wyman', 'roland berger',
  'gartner', 'forrester'
];

export function validateNoConsultingFirms(text) {
  if (!text) return;
  const lower = text.toLowerCase();
  for (const firm of PROHIBITED_FIRMS) {
    // Check whole word match
    const regex = new RegExp(`\\b${firm}\\b`, 'i');
    if (regex.test(lower)) {
      throw new ConsultingFirmReferenceProhibitedError(firm);
    }
  }
}

export function applyAdvisoryFrames(meetingRecord = {}, selectedFrames = []) {
  const framesToApply = selectedFrames.length > 0 ? selectedFrames : ['pre-mortem analysis', 'second order consequence analysis'];
  const findings = [];

  for (const frame of framesToApply) {
    if (!AUTHORITATIVE_ADVISORY_FRAMES.includes(frame)) {
      throw new Error(`Unsupported advisory frame: "${frame}". Frame must be listed in authoritative registry.`);
    }

    let observationText = '';
    if (frame === 'pre-mortem analysis') {
      observationText = 'Applying a pre-mortem analysis lens surfaces potential failure pathways: if critical milestones slip 60 days into deployment, the primary vulnerabilities would trace to unvalidated integration assumptions and delayed escalation triggers.';
    } else if (frame === 'second order consequence analysis') {
      observationText = 'Applying a second order consequence lens highlights downstream effects: accelerating feature delivery without dedicated testing capacity creates technical debt that increases ongoing maintenance cycles in subsequent quarters.';
    } else if (frame === 'cost of delay') {
      observationText = 'Applying a cost of delay lens evaluates deferred commitments: postponing key architectural sign-offs increases team dependency wait-times and delays downstream customer onboarding.';
    } else {
      observationText = `Applying a ${frame} lens structures the discussion variables across key dependencies and stated operational constraints.`;
    }

    validateNoConsultingFirms(observationText);

    findings.push({
      channel_id: INS_H_CHANNEL.id,
      frame_identifier: frame.toUpperCase().replace(/\s+/g, '_'),
      comparison_basis: `Public advisory frame: ${frame}`,
      observation_text: observationText,
      render_type: INS_H_CHANNEL.render,
      created_at: new Date().toISOString()
    });

    if (findings.length >= INS_H_CHANNEL.cap) break;
  }

  return findings.slice(0, INS_H_CHANNEL.cap);
}
