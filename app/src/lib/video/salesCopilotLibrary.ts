/**
 * Sales Co-pilot Approved Knowledge Library & Cue on Demand Engine.
 *
 * Grounded in Business Plan v6.2 (1 Nov 2026) and Concludo Operating Principles.
 * Governed by the Honesty Guard: Never invents capabilities, customers,
 * traction, revenue, or validated demand. Prices are indicative.
 *
 * Zero em dashes or en dashes.
 */

export type CueCategory =
  | 'opening'
  | 'discovery'
  | 'value'
  | 'objections'
  | 'pricing'
  | 'close'
  | 'do_not_promise';

export interface CueCard {
  id: string;
  category: CueCategory;
  title: string;
  summary: string;
  speakingDraft: string;
  bullets: string[];
  sourceSection: string;
  sourceQuote: string;
  keywords: string[];
}

export type CueStatus = 'APPROVED' | 'HOLDING' | 'BLOCKED';

export interface CueDemandResult {
  matchedCard: CueCard | null;
  draftedAnswer: string;
  holdingLine?: string;
  sourceAttribution: string;
  isApproved: boolean;
  status: CueStatus;
  notice?: string;
  responseTimeMs: number;
}

export const APPROVED_CUE_CARDS: readonly CueCard[] = [
  {
    id: 'cue-opening-1',
    category: 'opening',
    title: 'Opening: Call Framing & Fit',
    summary: 'Explain what Concludo is, state that it is not on sale yet, and set focus on fit.',
    speakingDraft: 'Thanks for your time. I would like to understand what happens after your meetings. Concludo is a follow-through Workspace. It turns conversations into summaries, decision logs, action plans and follow-up emails ready for you to review, and nothing goes out without your approval. It is not on sale yet, so today is about whether it would fit how you work.',
    bullets: [
      'Acknowledge their time and frame the conversation around post-meeting follow-through.',
      'State clearly that nothing goes out without human review and approval.',
      'Be upfront: pre-revenue, not yet on sale, focused purely on workflow fit.'
    ],
    sourceSection: 'Part I. Executive summary & Part II. General company description',
    sourceQuote: 'A follow-through Workspace that turns conversations and source material into finished, tracked work... Nothing agreed in a conversation gets lost, and nothing goes out without your approval.',
    keywords: ['opening', 'intro', 'start', 'agenda', 'purpose', 'framing', 'hello', 'concludo']
  },
  {
    id: 'cue-discovery-1',
    category: 'discovery',
    title: 'Discovery: Post-Meeting Reality',
    summary: 'Diagnostic questions uncovering post-meeting responsibilities and dropped commitments.',
    speakingDraft: 'After an important meeting, who writes the summary and who tracks the actions? How long does it usually take before everyone has their actions? Where do commitments live today: email, a spreadsheet, someone\'s head? When something is missed, what does it cost you?',
    bullets: [
      'Who writes the summary and who tracks the actions?',
      'How long does it take before everyone receives their actions?',
      'Where do commitments live today (email, spreadsheet, someone\'s head)?',
      'When an action is missed, what does that cost?'
    ],
    sourceSection: 'Part II. General company description (Diagnostic discovery questions)',
    sourceQuote: 'Questions only, no factual claims.',
    keywords: ['discovery', 'question', 'process', 'notes', 'minutes', 'actions', 'admin', 'tracking']
  },
  {
    id: 'cue-value-paste',
    category: 'value',
    title: 'Value: You Paste In Your Own Material',
    summary: 'Capture agnostic: paste or upload your own notes or transcripts without any bot.',
    speakingDraft: 'You paste or upload your own transcript or notes from whatever recorder or platform you already use. Concludo does not join your calls, record them or transcribe them.',
    bullets: [
      'Capture agnostic: works with notes, audio recordings, or exported transcripts.',
      'No bot joins your calls, records them, or transcribes them.',
      'Concludo is an independent product and is not affiliated with, endorsed by, or partnered with any device maker, meeting platform or note-taking service.'
    ],
    sourceSection: 'Part I. Executive summary',
    sourceQuote: 'Capture agnostic: input from any recorder, smart pen, phone recording, notes or Zoom, Microsoft Teams or Google Meet transcript, pasted in. No meeting bot, recorder or transcription of its own.',
    keywords: ['paste', 'upload', 'recorder', 'recording', 'transcription', 'transcript', 'smart pen', 'capture agnostic', 'no meeting bot']
  },
  {
    id: 'cue-value-control',
    category: 'value',
    title: 'Value: You Stay In Control',
    summary: 'Source line attribution, record review step, and manual email sending.',
    speakingDraft: 'Every item points back to its source line, and you review before anything is saved. Follow-up email drafts are for you to review and send yourself.',
    bullets: [
      'Every extracted item carries a verifiable reference back to the source text.',
      'Record review step: a person inspects and confirms items before saving.',
      'Email drafts are copy-and-send only: no automatic dispatch.'
    ],
    sourceSection: 'Part III. Products and services',
    sourceQuote: 'record review step (each item shows its source line), follow-up email drafts (copy and send yourself; no send button).',
    keywords: ['control', 'approval', 'review', 'source', 'provenance', 'draft', 'email draft', 'send yourself', 'who reviews', 'before anything is saved', 'review before', 'stays in control', 'reviews every single item']
  },
  {
    id: 'cue-objection-price',
    category: 'objections',
    title: 'Objection: Price Is Too High',
    summary: 'Anchor against follow-up time while confirming prices are indicative.',
    speakingDraft: 'Fair question. These prices are indicative and the Workspace is not on sale yet: Starter AU$25 a month, Pro AU$59, and Team AU$49 per seat with a three-seat minimum. What is an hour of your time worth, and how many hours a month go on follow-up?',
    bullets: [
      'Reiterate that prices are indicative and the product is not yet on sale.',
      'Starter AU$25 a month, Pro AU$59 a month, Team AU$49 per seat a month (3 seat minimum).',
      'Optional founding rate if asked: first 25 paying accounts get 25% off for 12 months.'
    ],
    sourceSection: '10. Starter, Pro, Team and Enterprise pricing cards',
    sourceQuote: 'Starter AU$25 a month... Pro AU$59 a month... Team AU$49 per seat a month | AU$490 per seat a year 3 seat minimum, from AU$147 a month... Founding offer First 25 paying accounts get 25% off for 12 months, stated as a founding rate.',
    keywords: ['price', 'expensive', 'cost', 'budget', 'high', 'cheap', 'afford', 'rate']
  },
  {
    id: 'cue-objection-bot',
    category: 'objections',
    title: 'Objection: Will A Bot Join Our Calls?',
    summary: 'Confirm firmly that nothing joins calls.',
    speakingDraft: 'No. Nothing joins your call. You use your own recorder or notes and paste them in afterwards.',
    bullets: [
      'Nothing joins your meeting or sits in your call attendee list.',
      'Complete privacy: keep calls completely native and confidential.',
      'You choose what text or notes to paste in after the call ends.'
    ],
    sourceSection: 'Part I. Executive summary',
    sourceQuote: 'No meeting bot, recorder or transcription of its own.',
    keywords: ['bot', 'join', 'call', 'attendee', 'attend', 'listen', 'meeting bot', 'bot join', 'bot attend', 'recording bot enter', 'enter our']
  },
  {
    id: 'cue-objection-security',
    category: 'objections',
    title: 'Objection: Privacy And Security',
    summary: 'Approved holding response for privacy and security details.',
    speakingDraft: 'I want to give you accurate details, not guesses. I will send our privacy and data handling in writing. Our privacy terms are not yet lawyer-reviewed, so I will confirm exactly what applies before you put any real material in.',
    bullets: [
      'Never make unverified security, compliance, or retention claims.',
      'Acknowledge privacy terms are undergoing legal review.',
      'Commit to sending precise, verified written data handling details.'
    ],
    sourceSection: '5. What Concludo is now & Part III. Products and services',
    sourceQuote: 'Soft delete exists; scheduled permanent purge is not set up... language-model provider chosen on data terms (no training on customer data, region, retention)... no language model is called yet.',
    keywords: ['security', 'privacy', 'training', 'confidential', 'data', 'retention', 'storage']
  },
  {
    id: 'cue-pricing-1',
    category: 'pricing',
    title: 'Pricing Talk: Indicative Tiers',
    summary: 'Clear breakdown of indicative tiers: Starter AU$25, Pro AU$59, Team AU$49/seat.',
    speakingDraft: 'Indicative and not yet on sale. Starter AU$25 a month or AU$250 a year, for up to 20 transcripts a month. Pro AU$59 a month or AU$590 a year, with unlimited projects and approval-gated email drafts. Team AU$49 per seat a month with a three-seat minimum, from AU$147 a month or AU$490 per seat a year. Annual billing gives two months free. All prices are in Australian dollars.',
    bullets: [
      'Starter: AU$25/mo or AU$250/yr (up to 20 processed transcripts per month).',
      'Pro: AU$59/mo or AU$590/yr (unlimited projects, approval-gated email drafts).',
      'Team: AU$49/seat/mo or AU$490/seat/yr (3-seat minimum, from AU$147/mo).',
      'Enterprise (if asked): Enterprise is by quote and is not available yet.'
    ],
    sourceSection: '10. Starter, Pro, Team and Enterprise pricing cards',
    sourceQuote: 'AU$49 per seat a month | AU$490 per seat a year 3 seat minimum, from AU$147 a month... Everything in Starter plus unlimited projects, decision memory across clients, approval-gated email, branded PDF export, calendar',
    keywords: ['pricing', 'plans', 'tiers', 'subscription', 'monthly', 'annual', 'starter', 'pro', 'team', 'small team', 'pricing plans', 'subscription tiers']
  },
  {
    id: 'cue-close-1',
    category: 'close',
    title: 'Close: Design Partners & Walkthrough',
    summary: 'Invite them to be considered for early design partner cohort and sample output walkthrough.',
    speakingDraft: 'I am lining up a small number of design partners to try it on real meetings. When the trial opens it is 14 days with no card. Would you like to be considered, and could we book 10 minutes next week to look at a sample output?',
    bullets: [
      'Lining up design partners for early trial consideration.',
      'Trial parameters: 14 days, no credit card required, full Pro features.',
      'Offer a 10-minute walkthrough of sample output next week.'
    ],
    sourceSection: 'Part III. Products and services & 10. Starter, Pro, Team and Enterprise pricing cards',
    sourceQuote: 'Included in a trial: 14 days, no card, full Pro features, server-enforced expiry. No permanent free plan.',
    keywords: ['close', 'next steps', 'trial', 'design partners', 'walkthrough', 'sample', 'meeting']
  },
  {
    id: 'cue-do-not-promise',
    category: 'do_not_promise',
    title: 'Do Not Promise: Strict Boundaries',
    summary: 'Non-negotiable boundaries: Enterprise by quote only, pre-revenue, no bots, no stats.',
    speakingDraft: 'Keep to current verified truth. If they ask about custom enterprise SLAs, automated email blasting without review, live audio tapping, or validated customer case studies, give the approved holding line.',
    bullets: [
      'No Enterprise tier, custom SLA or bespoke terms. Enterprise is by quote and not available yet.',
      'No claims of revenue, paying customers, case studies or logos. Pre-revenue.',
      'No automatic sending. Drafts are reviewed and sent by the person.',
      'No live listening, meeting bot, recording or transcription.',
      'No security, compliance or certification claims (SOC 2, ISO 27001, GDPR, HIPAA, Privacy Act compliance, data location) until written evidence exists.',
      'No integrations beyond paste and upload.',
      'No statistics or savings figures.'
    ],
    sourceSection: 'Concludo Governance Principles and Business Plan v6.2 Risk and Legal Standards',
    sourceQuote: 'Pre-revenue and unpublished. Prices indicative. Figures are scenario outputs, not forecasts.',
    keywords: ['boundaries', 'promise', 'guarantee', 'sla', 'compliance']
  }
];

/**
 * Patterns for Traction questions.
 * Must return holding line plus 'not yet on sale, pre-revenue'. Never return opening card.
 */
export const TRACTION_PATTERNS: readonly RegExp[] = [
  /\bwho\s+else\s+uses\s+concludo\b/i,
  /\bdo\s+you\s+have\s+customers\b/i,
  /\bany\s+case\s+studies\b/i,
  /\bcase\s+stud(y|ies)\b/i,
  /\bpaying\s+customers\b/i,
  /\bexisting\s+customers\b/i,
  /\bhow\s+many\s+users\b/i,
  /\btraction\b/i
];

/**
 * Patterns for Discount & Negotiation questions.
 * Must return only the approved early-pricing line (first 25 paying accounts, 25% off for 12 months), marked indicative.
 */
export const DISCOUNT_PATTERNS: readonly RegExp[] = [
  /\bcan\s+i\s+get\s+a\s+discount\b/i,
  /\bis\s+the\s+price\s+negotiable\b/i,
  /\bnegotiat(e|ion|able)\b/i,
  /\bdiscount\b/i,
  /\bdoscount\b/i,
  /\bcheaper\s+rate\b/i,
  /\bcheaper\s+deal\b/i,
  /\bcheaper\b/i,
  /\bdeal\s+on\s+price\b/i,
  /\bfounding\s+rate\b/i,
  /\bfounding\s+discount\b/i,
  /\bintroductory\s+rate\b/i,
  /\bintroductory\b/i
];

/**
 * Patterns for Data & Privacy questions.
 * Must return holding line with status HOLDING (not APPROVED).
 */
export const DATA_PRIVACY_PATTERNS: readonly RegExp[] = [
  /\bis\s+my\s+data\s+safe\b/i,
  /\bwhere\s+do\s+you\s+keep\s+(our|my)\s+data\b/i,
  /\bwhere\s+is\s+data\s+stored\b/i,
  /\bwhere\s+is\s+(our|my)?\s*privat[e]?\s+data\s+stored\b/i,
  /\bprivat[e]?\s+data\b/i,
  /\bdo\s+you\s+train\s+on\s+(our|my)\s+data\b/i,
  /\btrain\s+on\s+(our|my)\s+data\b/i,
  /\btran\s+on\s+it\b/i,
  /\bprivacy\s+principles\b/i,
  /\bprivacy\s+policy\b/i,
  /\bdata\s+handling\b/i,
  /\bdata\s+security\b/i,
  /\bdata\s+privacy\b/i
];

/**
 * Patterns for Enterprise availability questions.
 * Must return holding line with status HOLDING explaining that Enterprise is by quote and not available yet.
 */
export const ENTERPRISE_AVAILABILITY_PATTERNS: readonly RegExp[] = [
  /\bis\s+enterprise\s+available\b/i,
  /\bcan\s+we\s+buy\s+enterprise\b/i,
  /\benterprise\s+tier\b/i,
  /\benterprise\s+pricing\b/i,
  /\benterprise\s+package\b/i
];

/**
 * Regex patterns for unsupported, unverified, or out-of-scope topics.
 * Uses strict whole-word and phrase matching to avoid substring false positives
 * (e.g., 'Slack' or 'translate' must never match 'sla').
 */
export const FORBIDDEN_OR_UNSUPPORTED_PATTERNS: readonly RegExp[] = [
  /\bhipaa\b/i,
  /\biso\s*27001\b/i,
  /\bsoc\s*2\b/i,
  /\bsoc2\b/i,
  /\bgdpr\b/i,
  /\bprivacy\s+act\b/i,
  /\bhosted\s+in\s+australia\b/i,
  /\bdata\s+residency\b/i,
  /\bencrypted\b/i,
  /\bencryption\b/i,
  /\bsso\b/i,
  /\bsingle\s+sign-?on\b/i,
  /\bintegration\s+with\b/i,
  /\bsalesforce\b/i,
  /\bhubspot\b/i,
  /\brefund\b/i,
  /\brefunds\b/i,
  /\bcontract\b/i,
  /\bcontracts\b/i,
  /\binsurance\b/i,
  /\bcustom\s+sla\b/i,
  /\bsla\b/i,
  /\bservice\s+agreement\b/i,
  /\bsystem\s+availability\b/i,
  /\bavailability\s+guarantee\b/i,
  /\bauto(matically)?\s+send\b/i,
  /\bauto(mated)?\s+sending\b/i,
  /\blive\s+bot\b/i,
  /\baudio\s+tapping\b/i
];

/**
 * Matches prospect statement and generates a grounded cue on demand.
 * Operates synchronously via fast keyword and pattern evaluation (< 10ms).
 */
export function evaluateCueOnDemand(queryText: string): CueDemandResult {
  const startTime = performance.now();
  const query = queryText.trim();

  if (!query) {
    return {
      matchedCard: null,
      draftedAnswer: 'Type or select a prospect objection, question, or comment above to receive an approved draft.',
      sourceAttribution: 'Concludo Sales Library (Business Plan v6.2)',
      isApproved: true,
      status: 'APPROVED',
      responseTimeMs: Math.round(performance.now() - startTime)
    };
  }

  // 1. Check Traction Questions first (Fix 3, Point 1)
  // Must return holding line plus 'not yet on sale, pre-revenue'. Never return opening card.
  if (TRACTION_PATTERNS.some(pat => pat.test(query))) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      matchedCard: null,
      draftedAnswer: 'That is a good question. Rather than guess, let me confirm and follow up in writing. Concludo is not yet on sale and is pre-revenue, so we do not have public case studies or customer logos yet.',
      holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
      sourceAttribution: 'Business Plan v6.2: Part I. Executive summary & Section 10. Starter, Pro, Team and Enterprise pricing cards',
      isApproved: false,
      status: 'HOLDING',
      notice: 'Current commercial truth: pre-revenue, not yet on sale, indicative pricing. Never invent traction or customer logos.',
      responseTimeMs: elapsed
    };
  }

  // 2. Check Discount / Negotiation Questions (Fix 3, Point 2)
  // Return only the approved early-pricing line (first 25 paying accounts, 25% off for 12 months), marked indicative.
  if (DISCOUNT_PATTERNS.some(pat => pat.test(query))) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      matchedCard: null,
      draftedAnswer: 'Our prices are indicative as the Workspace is not on sale yet. For early adopters, our planned founding offer gives the first 25 paying accounts 25% off for 12 months as a founding rate.',
      holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
      sourceAttribution: 'Business Plan v6.2: Section 10. Starter, Pro, Team and Enterprise pricing cards & Part III. Products and services',
      isApproved: true,
      status: 'APPROVED',
      notice: 'Indicative founding rate: first 25 paying accounts get 25% off for 12 months.',
      responseTimeMs: elapsed
    };
  }

  // 3. Check Data and Privacy Questions (Fix 3, Point 3)
  // Return holding line. Status must read HOLDING, not APPROVED.
  if (DATA_PRIVACY_PATTERNS.some(pat => pat.test(query))) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      matchedCard: null,
      draftedAnswer: 'I want to give you accurate details, not guesses. I will send our privacy and data handling in writing. Our privacy terms are not yet lawyer-reviewed, so I will confirm exactly what applies before you put any real material in.',
      holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
      sourceAttribution: 'Business Plan v6.2: Section 5. What Concludo is now & Part III. Products and services',
      isApproved: false,
      status: 'HOLDING',
      notice: 'Privacy and data terms require written confirmation; no unverified claims.',
      responseTimeMs: elapsed
    };
  }

  // 4. Check Enterprise Availability Questions
  // Return holding line explaining Enterprise is by quote and not available yet.
  if (ENTERPRISE_AVAILABILITY_PATTERNS.some(pat => pat.test(query))) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      matchedCard: null,
      draftedAnswer: 'Enterprise is by quote and is not available yet. It is sold only after single sign-on, data processing terms, insurance and security reviews exist.',
      holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
      sourceAttribution: 'Business Plan v6.2: Part III. Products and services & Section 10. Starter, Pro, Team and Enterprise pricing cards',
      isApproved: false,
      status: 'HOLDING',
      notice: 'Enterprise tier is not available yet and is by quote only.',
      responseTimeMs: elapsed
    };
  }

  // 5. Honesty Guard Check: Check against forbidden or unsupported whole-word and phrase patterns
  const hitPattern = FORBIDDEN_OR_UNSUPPORTED_PATTERNS.find(pat => pat.test(query));
  if (hitPattern) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      matchedCard: null,
      draftedAnswer: 'Not in approved material: tell them you will confirm and follow up.',
      holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
      sourceAttribution: 'Honesty Guard: Out of scope or unverified capability',
      isApproved: false,
      status: 'BLOCKED',
      notice: 'Current commercial truth: pre-revenue, not yet on sale, indicative pricing. Never invent capabilities.',
      responseTimeMs: elapsed
    };
  }

  // 6. Search through approved cards using keyword relevance
  const lowerQuery = query.toLowerCase();
  let bestMatch: CueCard | null = null;
  let highestScore = 0;

  for (const card of APPROVED_CUE_CARDS) {
    let score = 0;
    for (const kw of card.keywords) {
      // Use word-boundary matching on lowercase query
      const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
      if (kwRegex.test(lowerQuery)) {
        score += kw.includes(' ') ? 4 : 2;
      }
    }
    if (card.title.toLowerCase().includes(lowerQuery)) score += 3;
    if (card.summary.toLowerCase().includes(lowerQuery)) score += 1;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = card;
    }
  }

  const elapsed = Math.round(performance.now() - startTime);

  // If best match is a "do not promise" card, enforce the holding line
  if (bestMatch && bestMatch.category === 'do_not_promise') {
    return {
      matchedCard: bestMatch,
      draftedAnswer: 'Not in approved material: tell them you will confirm and follow up.',
      holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
      sourceAttribution: `${bestMatch.sourceSection}: ${bestMatch.sourceQuote}`,
      isApproved: false,
      status: 'BLOCKED',
      notice: 'Current commercial truth: pre-revenue, not yet on sale, indicative pricing. Never invent capabilities.',
      responseTimeMs: elapsed
    };
  }

  if (bestMatch && highestScore > 0) {
    return {
      matchedCard: bestMatch,
      draftedAnswer: bestMatch.speakingDraft,
      sourceAttribution: `${bestMatch.sourceSection} ("${bestMatch.sourceQuote}")`,
      isApproved: true,
      status: 'APPROVED',
      responseTimeMs: elapsed
    };
  }

  // If no confident approved match is found, apply the holding line
  return {
    matchedCard: null,
    draftedAnswer: 'Not in approved material: tell them you will confirm and follow up.',
    holdingLine: 'That is a good question. Rather than guess, let me confirm and follow up in writing.',
    sourceAttribution: 'Honesty Guard: Unmatched prospect inquiry',
    isApproved: false,
    status: 'HOLDING',
    notice: 'No direct match in approved sales library. Use holding line and record as an open item.',
    responseTimeMs: elapsed
  };
}
