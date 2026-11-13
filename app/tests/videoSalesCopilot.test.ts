import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPROVED_CUE_CARDS,
  evaluateCueOnDemand,
  FORBIDDEN_OR_UNSUPPORTED_PATTERNS,
  type CueCategory,
  type CueStatus
} from '../src/lib/video/salesCopilotLibrary';

describe('Video Meeting Centre: Sales Co-pilot Step 0 (Staging)', () => {
  it('COPILOT-1: contains all 7 canonical cue card categories with exact v6.2 source section and quote', () => {
    const categories = new Set(APPROVED_CUE_CARDS.map((c) => c.category));
    const requiredCategories: CueCategory[] = [
      'opening',
      'discovery',
      'value',
      'objections',
      'pricing',
      'close',
      'do_not_promise'
    ];

    for (const req of requiredCategories) {
      expect(categories.has(req)).toBe(true);
    }

    // Ensure every card has title, summary, speaking draft, bullets, sourceSection and sourceQuote
    for (const card of APPROVED_CUE_CARDS) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.summary.length).toBeGreaterThan(0);
      expect(card.speakingDraft.length).toBeGreaterThan(0);
      expect(card.bullets.length).toBeGreaterThan(0);
      expect(card.sourceSection.length).toBeGreaterThan(0);
      expect(card.sourceQuote.length).toBeGreaterThan(0);

      // Verify no 'AI' in speakingDraft (Australian English + 'drafting' standard)
      expect(card.speakingDraft).not.toMatch(/\bAI\b/);
      expect(card.speakingDraft).not.toContain('\u2014'); // em dash
      expect(card.speakingDraft).not.toContain('\u2013'); // en dash
    }
  });

  it('COPILOT-2: evaluates common prospect objections with v6.2 figures and zero unverified stats', () => {
    const priceRes = evaluateCueOnDemand('the price is too high');
    expect(priceRes.isApproved).toBe(true);
    expect(priceRes.status).toBe('APPROVED');
    expect(priceRes.draftedAnswer).toContain('Starter AU$25');
    expect(priceRes.draftedAnswer).toContain('Pro AU$59');
    expect(priceRes.draftedAnswer).toContain('Team AU$49 per seat');
    expect(priceRes.draftedAnswer).not.toContain('29 dollars');
    expect(priceRes.draftedAnswer).not.toContain('pays for itself ten times over');
    expect(priceRes.draftedAnswer).not.toContain('15 to 20 hours');
    expect(priceRes.sourceAttribution).toContain('10. Starter, Pro, Team and Enterprise pricing cards');
    expect(priceRes.responseTimeMs).toBeLessThanOrEqual(20);

    const botRes = evaluateCueOnDemand('will a bot join our client call?');
    expect(botRes.isApproved).toBe(true);
    expect(botRes.status).toBe('APPROVED');
    expect(botRes.draftedAnswer).toContain('Nothing joins your call');
    expect(botRes.draftedAnswer).not.toContain('Works seamlessly with Google Meet');
    expect(botRes.responseTimeMs).toBeLessThanOrEqual(20);
  });

  it('COPILOT-3: honesty guard blocks unapproved claims and supplies holding lines', () => {
    // 1. HIPAA / Healthcare certification (unapproved)
    const hipaaRes = evaluateCueOnDemand('Are you HIPAA certified?');
    expect(hipaaRes.isApproved).toBe(false);
    expect(hipaaRes.status).toBe('BLOCKED');
    expect(hipaaRes.draftedAnswer).toBe('Not in approved material: tell them you will confirm and follow up.');
    expect(hipaaRes.holdingLine).toBe('That is a good question. Rather than guess, let me confirm and follow up in writing.');

    // 2. Custom SLA inquiry
    const slaRes = evaluateCueOnDemand('Can you guarantee a custom enterprise SLA?');
    expect(slaRes.isApproved).toBe(false);
    expect(slaRes.status).toBe('BLOCKED');
    expect(slaRes.draftedAnswer).toBe('Not in approved material: tell them you will confirm and follow up.');

    // 3. Traction questions return holding line plus 'not yet on sale, pre-revenue' (Fix 3, Point 1)
    const tractionRes = evaluateCueOnDemand('Who else uses Concludo?');
    expect(tractionRes.isApproved).toBe(false);
    expect(tractionRes.status).toBe('HOLDING');
    expect(tractionRes.draftedAnswer).toContain('not yet on sale and is pre-revenue');
    expect(tractionRes.draftedAnswer).not.toContain('Concludo is a follow-through Workspace'); // must NOT return opening card
  });

  it('COPILOT-4: whole-word matching prevents false positives (e.g., Slack, translate, island)', () => {
    // Slack should NOT trigger SLA pattern
    const slackQuery = 'Can we paste transcripts from Slack discussions?';
    const hitSlack = FORBIDDEN_OR_UNSUPPORTED_PATTERNS.some(pat => pat.test(slackQuery));
    expect(hitSlack).toBe(false);

    // Translate should NOT trigger SLA pattern
    const translateQuery = 'Can you translate notes?';
    const hitTranslate = FORBIDDEN_OR_UNSUPPORTED_PATTERNS.some(pat => pat.test(translateQuery));
    expect(hitTranslate).toBe(false);

    // Island of sanity should NOT trigger SLA pattern
    const islandQuery = 'We need an island of sanity for our meetings';
    const hitIsland = FORBIDDEN_OR_UNSUPPORTED_PATTERNS.some(pat => pat.test(islandQuery));
    expect(hitIsland).toBe(false);

    // Actual SLA query MUST trigger
    const slaQuery = 'What SLA do you offer?';
    const hitSla = FORBIDDEN_OR_UNSUPPORTED_PATTERNS.some(pat => pat.test(slaQuery));
    expect(hitSla).toBe(true);
  });

  it('COPILOT-5: comprehensive honesty guard suite with 70 pre-written prospect phrasings and card IDs', () => {
    // Exactly 50 test cases with pre-written expected statuses and expected card IDs (committed BEFORE run)
    // A test where the card id does not match is a FAIL even if the status matches.
    const testCases: { query: string; expectedStatus: CueStatus; expectedCardId: string | null; description: string; expectedSubstring?: string; forbiddenSubstring?: string }[] = [
      // 1-4: Traction questions (Fix 3, Point 1) -> HOLDING, not yet on sale, pre-revenue, expectedCardId: null
      { query: 'Who else uses Concludo?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Traction: who else uses', expectedSubstring: 'not yet on sale and is pre-revenue', forbiddenSubstring: 'turns conversations into summaries' },
      { query: 'Do you have customers?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Traction: do you have customers', expectedSubstring: 'not yet on sale and is pre-revenue', forbiddenSubstring: 'turns conversations into summaries' },
      { query: 'Any case studies?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Traction: any case studies', expectedSubstring: 'not yet on sale and is pre-revenue', forbiddenSubstring: 'turns conversations into summaries' },
      { query: 'How many paying customers do you have right now?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Traction: paying customers count', expectedSubstring: 'not yet on sale and is pre-revenue', forbiddenSubstring: 'turns conversations into summaries' },

      // 5-8: Discount / Negotiation questions (Fix 3, Point 2) -> APPROVED early-pricing line, expectedCardId: null
      { query: 'Can I get a discount?', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Discount: can I get a discount', expectedSubstring: 'first 25 paying accounts 25% off for 12 months' },
      { query: 'Is the price negotiable?', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Discount: is price negotiable', expectedSubstring: 'first 25 paying accounts 25% off for 12 months' },
      { query: 'Can we negotiate a cheaper rate?', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Discount: cheaper rate negotiation', expectedSubstring: 'first 25 paying accounts 25% off for 12 months' },
      { query: 'What is the founding rate for early accounts?', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Discount: founding rate inquiry', expectedSubstring: 'first 25 paying accounts 25% off for 12 months' },

      // 9-13: Data & Privacy questions (Fix 3, Point 3) -> HOLDING, holding line with accurate details, expectedCardId: null
      { query: 'Is my data safe?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Privacy: is my data safe', expectedSubstring: 'I want to give you accurate details, not guesses' },
      { query: 'Where do you keep our data?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Privacy: where do you keep our data', expectedSubstring: 'I want to give you accurate details, not guesses' },
      { query: 'Where is data stored?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Privacy: where is data stored', expectedSubstring: 'I want to give you accurate details, not guesses' },
      { query: 'Do you train on our data?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Privacy: do you train on our data', expectedSubstring: 'I want to give you accurate details, not guesses' },
      { query: 'What are your Privacy Principles?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Privacy: privacy principles', expectedSubstring: 'I want to give you accurate details, not guesses' },

      // 14-25: Blocked by Honesty Guard -> BLOCKED, expectedCardId: null
      { query: 'What SLA do you guarantee for enterprise clients?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Enterprise SLA trigger' },
      { query: 'Are you SOC 2 or SOC2 certified right now?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'SOC 2 compliance trigger' },
      { query: 'Do you hold ISO 27001 accreditation?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'ISO 27001 certification trigger' },
      { query: 'Are you HIPAA compliant for health data?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'HIPAA certification trigger' },
      { query: 'Do you comply with GDPR regulations?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'GDPR trigger' },
      { query: 'Can you guarantee that data is hosted in Australia?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Hosted in Australia trigger' },
      { query: 'Do you offer Australian data residency guarantees?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Data residency trigger' },
      { query: 'Is all meeting data encrypted at rest and in transit?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Encryption trigger' },
      { query: 'Can we use SSO or single sign-on with our corporate Okta?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'SSO trigger' },
      { query: 'Does Concludo have an integration with Salesforce CRM?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Integration with Salesforce trigger' },
      { query: 'Can you connect with HubSpot to update contact records?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'HubSpot trigger' },
      { query: 'What is your refund policy if our team does not like it?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Refund trigger' },

      // 26-34: Approved Cue Cards (verified speaking drafts from Business Plan v6.2)
      { query: 'The price is too high for our boutique firm', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-price', description: 'Price objection card' },
      { query: 'How much does it cost each month?', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-price', description: 'Cost inquiry' },
      { query: 'What are your pricing plans and subscription tiers?', expectedStatus: 'APPROVED', expectedCardId: 'cue-pricing-1', description: 'Pricing plans card' },
      { query: 'Will a bot join our client calls or record them?', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-bot', description: 'Bot objection card' },
      { query: 'Does an automated bot attend the meeting?', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-bot', description: 'Bot attendance card' },
      { query: 'How does the recorder integration work if you have no bot?', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-paste', description: 'Recorder integration card' },
      { query: 'Who reviews the summary and actions before anything is saved?', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-control', description: 'Human review card' },
      { query: 'What diagnostic questions do you ask in discovery?', expectedStatus: 'APPROVED', expectedCardId: 'cue-discovery-1', description: 'Discovery questions card' },
      { query: 'Can we start a 14-day trial or book a sample walkthrough?', expectedStatus: 'APPROVED', expectedCardId: 'cue-close-1', description: 'Close and trial card' },

      // 35-40: False Positive Shields and Unmatched Inquiries (safe holding line or clean match)
      { query: 'Can we paste transcripts from Slack discussions?', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-paste', description: 'Slack transcript (must NOT match SLA)' },
      { query: 'Can you translate or summarize our client notes?', expectedStatus: 'APPROVED', expectedCardId: 'cue-discovery-1', description: 'Translate notes (must NOT match SLA)' },
      { query: 'We want an island of sanity for our leadership meetings', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Island phrasing (must NOT match SLA)' },
      { query: 'Where do commitments live today in typical firms?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'General commitment query' },
      { query: 'Who writes the summary today in most professional firms?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'General summary query' },
      { query: 'Is Enterprise available right now?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Enterprise inquiry falls to holding line' },

      // 41-50: 10 NEW Phrasings (mixed case, misspellings, long sentences)
      { query: 'DO YOU HAVE ANY PAYING CUSTOMERS YET???', expectedStatus: 'HOLDING', expectedCardId: null, description: 'All-caps traction query with punctuation' },
      { query: 'can i get a doscount or cheaper deal for our team', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Misspelled discount inquiry' },
      { query: 'wher is our privat data stored and do you tran on it', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Misspelled privacy inquiry' },
      { query: 'Do you have SOC2 or ISO27001 certification ready for our procurement team?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Mixed case certification query' },
      { query: 'Can Concludo automatically send emails to attendees right after the call finishes without anyone checking them first?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Long sentence auto-send inquiry' },
      { query: 'Tell me about your Small Team subscription tiers and annual pricing', expectedStatus: 'APPROVED', expectedCardId: 'cue-pricing-1', description: 'Long pricing calculation inquiry' },
      { query: 'WILL A RECORDING BOT ENTER OUR CONFIDENTIAL BOARDROOM DISCUSSION?', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-bot', description: 'All-caps bot inquiry' },
      { query: 'Tell me about how a person stays in control and reviews every single item before it gets saved into the system', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-control', description: 'Long sentence control and review inquiry' },
      { query: 'Can we test it out with a fourteen day trial period before deciding?', expectedStatus: 'APPROVED', expectedCardId: 'cue-close-1', description: 'Trial period inquiry' },
      { query: 'Our executive committee is wondering whether this software works well on mobile phones or iPads during flights', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Unmatched long sentence mobile flight inquiry' },

      // 51-60: 10 NEW Pre-Committed Phrasings (v1 Staging DB Brief)
      { query: 'Are there any public customer reviews or testimonials?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Traction: customer reviews inquiry' },
      { query: 'Is there an early adopter discount for founders?', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Discount: early adopter discount inquiry' },
      { query: 'What SLA do you guarantee for uptime?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'SLA uptime guarantee trigger' },
      { query: 'Can we export notes into Salesforce?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Salesforce export trigger' },
      { query: 'Does this sync with HubSpot CRM?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'HubSpot sync trigger' },
      { query: 'What are the subscription plans and prices?', expectedStatus: 'APPROVED', expectedCardId: 'cue-pricing-1', description: 'Pricing plans inquiry' },
      { query: 'Will an automated bot join our meeting?', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-bot', description: 'Automated bot inquiry' },
      { query: 'Can we use our own recorder and paste transcripts into Concludo?', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-paste', description: 'Own recorder paste inquiry' },
      { query: 'How do we get started with a 14-day trial?', expectedStatus: 'APPROVED', expectedCardId: 'cue-close-1', description: '14-day trial startup inquiry' },
      { query: 'Do you support video calls held on trains or while walking?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Unmatched mobility inquiry' },

      // 61-70: 10 NEW Pre-Committed Phrasings (v1 Bright Reader Brief)
      { query: 'Are there any verified client references or case studies we can read?', expectedStatus: 'HOLDING', expectedCardId: null, description: 'Traction: client references inquiry' },
      { query: 'Is there a special introductory rate for early startup founders?', expectedStatus: 'APPROVED', expectedCardId: null, description: 'Discount: introductory founder rate' },
      { query: 'Do you guarantee 99.99% system availability in your service agreement?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'SLA availability guarantee trigger' },
      { query: 'Does Concludo push tasks directly into Salesforce opportunities?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'Salesforce opportunity sync trigger' },
      { query: 'Can our sales team connect this tool to HubSpot contacts?', expectedStatus: 'BLOCKED', expectedCardId: null, description: 'HubSpot contacts trigger' },
      { query: 'Tell me about the annual price for small team workspaces', expectedStatus: 'APPROVED', expectedCardId: 'cue-pricing-1', description: 'Small team annual pricing inquiry' },
      { query: 'Will an AI bot attend our Zoom calls?', expectedStatus: 'APPROVED', expectedCardId: 'cue-objection-bot', description: 'Zoom bot attendance inquiry' },
      { query: 'Can I paste transcripts from our existing recording software?', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-paste', description: 'Paste transcripts from existing software' },
      { query: 'Who reviews the draft actions and follow-up before they get saved?', expectedStatus: 'APPROVED', expectedCardId: 'cue-value-control', description: 'Who reviews draft actions inquiry' },
      { query: 'Can we try out the platform on a fourteen-day free trial?', expectedStatus: 'APPROVED', expectedCardId: 'cue-close-1', description: 'Fourteen day free trial inquiry' }
    ];

    expect(testCases.length).toBe(70);

    for (const tc of testCases) {
      const res = evaluateCueOnDemand(tc.query);
      const matchedId = res.matchedCard?.id || null;

      // Status check
      expect(res.status).toBe(tc.expectedStatus);

      // Card ID check: A test where the card id does not match is a FAIL even if status matches
      expect(matchedId).toBe(tc.expectedCardId);

      if (tc.expectedSubstring) {
        expect(res.draftedAnswer).toContain(tc.expectedSubstring);
      }
      if (tc.forbiddenSubstring) {
        expect(res.draftedAnswer).not.toContain(tc.forbiddenSubstring);
      }
    }
  });

  it('COPILOT-6: measures response speed suitable for mid-call usage (< 50ms)', () => {
    const queries = [
      'price',
      'recorder integration',
      'security and privacy',
      'closing next steps',
      'discovery questions'
    ];

    for (const q of queries) {
      const res = evaluateCueOnDemand(q);
      expect(res.responseTimeMs).toBeLessThanOrEqual(50);
    }
  });

  it('COPILOT-7: protects DashboardPage isolation (100% clean diff)', () => {
    const projectRoot = join(__dirname, '..');
    const dashboardContent = readFileSync(join(projectRoot, 'src/pages/DashboardPage.tsx'), 'utf8');
    expect(dashboardContent).not.toContain('video_meeting_centre');
    expect(dashboardContent).not.toContain('VideoCompanionPanel');
  });

  it('COPILOT-8: zero em dashes or en dashes across all video copilot files', () => {
    const projectRoot = join(__dirname, '..');
    const filesToCheck = [
      'src/lib/video/salesCopilotLibrary.ts',
      'src/lib/video/videoMeetingCentreFeatureFlag.ts',
      'src/lib/video/videoMeetingCentreOwnerClient.ts',
      'src/pages/video/VideoCompanionPanelPage.tsx',
      'tests/videoSalesCopilot.test.ts'
    ];

    for (const relPath of filesToCheck) {
      const content = readFileSync(join(projectRoot, relPath), 'utf8');
      expect(content).not.toContain('\u2014'); // em dash
      expect(content).not.toContain('\u2013'); // en dash
    }
  });
});
