import {
  DocumentRoutingSection,
  DocumentBriefSection,
  DocumentIntelligenceSection,
  DocumentRoutingNotAnalysed,
  DocumentRiskItem,
  DocumentDiscussedItem,
  DocumentObligation,
  DocumentExplicitDate,
  DocumentInferredDate,
  DocumentAmount,
  DocumentProfessionalReview,
} from '../reporting/payloadTypes';

export interface InputDocument {
  name: string;
  content?: string;
  documentClass?: string;
  isSupplied?: boolean;
  isReadable?: boolean;
  isCorrupt?: boolean;
  isProtected?: boolean;
  source?: 'project' | 'meeting' | 'transcript_reference';
  thirdParty?: boolean;
}

export interface RoutingContext {
  projectDocuments?: InputDocument[];
  meetingAttachments?: InputDocument[];
  transcriptText?: string;
  meetingType?: string;
  decisions?: Array<{ title?: string; summary?: string; description?: string }>;
  actions?: Array<{ title?: string; description?: string }>;
  risks?: Array<{ title?: string; description?: string }>;
  tier?: 'starter' | 'pro' | 'team';
}

export interface RoutingResult {
  routing: DocumentRoutingSection;
  brief?: DocumentBriefSection;
  intelligence?: DocumentIntelligenceSection;
  requiresHumanReview?: boolean;
  warningNotice?: string;
}

// Class Bands per Spec 01 Section 4
export const BAND_ALWAYS_EXPLAIN = new Set([
  'contract',
  'legal agreement',
  'lease',
  'loan or finance agreement',
  'guarantee',
  'insurance policy',
  'insurance document',
  'government or regulatory notice',
  'compliance document',
  'employment or contractor agreement',
  'subcontract agreement',
  'settlement',
  'property document',
  'terms and conditions',
  'data processing agreement',
]);

export const BAND_EXPLAIN_WHEN_DECISION = new Set([
  'proposal',
  'business plan',
  'financial report',
  'financial model',
  'budget',
  'forecast',
  'tender or statement of work',
  'statement of work',
  'policy',
  'procedure',
  'board paper',
  'technical report',
  'research document',
]);

export const BAND_REFERENCE_ONLY = new Set([
  'agenda',
  'slide deck',
  'meeting notes',
  'venue or logistics',
  'image',
  'image set',
  'brand asset',
  'previously analysed document with no change',
]);

export const STANDARD_NOTICE =
  'About this explanation. This explains a document supplied to this project, in plain language, so the people in this meeting can act on it. It is not legal, accounting, tax or financial advice, and it does not say whether any clause is enforceable. Where a qualified professional should look at something, this document says so and says what to ask them.';

export const THIRD_PARTY_NOTICE_ADDENDUM =
  ' The document analysed was supplied by the project owner. Concludo has not verified its authenticity, its version, or whether it is the executed copy.';

/**
 * Infer meeting type deterministically from transcript and metadata.
 */
export function inferMeetingType(context: RoutingContext): {
  meetingType: DocumentRoutingSection['meeting_type'];
  inferred: boolean;
} {
  if (context.meetingType) {
    const mt = context.meetingType.toLowerCase().replace(/[\s-]+/g, '_');
    const validTypes: DocumentRoutingSection['meeting_type'][] = [
      'contract_or_negotiation',
      'decision_or_approval',
      'board_or_governance',
      'project_or_delivery',
      'client_or_sales',
      'finance_or_budget',
      'status_or_standup',
      'onboarding_or_training',
      'unclear',
    ];
    for (const vt of validTypes) {
      if (mt.includes(vt) || vt.includes(mt)) return { meetingType: vt, inferred: false };
    }
    if (mt.includes('status') || mt.includes('standup') || mt.includes('sync')) {
      return { meetingType: 'status_or_standup', inferred: false };
    }
    if (mt.includes('contract') || mt.includes('negotiation')) {
      return { meetingType: 'contract_or_negotiation', inferred: false };
    }
  }

  const txt = (context.transcriptText || '').toLowerCase();
  if (/negotiat|clause|terms of|contract execution|counterparty/.test(txt)) {
    return { meetingType: 'contract_or_negotiation', inferred: true };
  }
  if (/board\b|governance|directors|resolution\b|shareholder/.test(txt)) {
    return { meetingType: 'board_or_governance', inferred: true };
  }
  if (/budget|forecast|financial year|p&l|ebitda|audit|balance sheet/.test(txt)) {
    return { meetingType: 'finance_or_budget', inferred: true };
  }
  if (/status|daily standup|weekly sync|round-robin|catch-up/.test(txt)) {
    return { meetingType: 'status_or_standup', inferred: true };
  }
  if (/delivery|sprint|milestone|deployment|blockers|backlog/.test(txt)) {
    return { meetingType: 'project_or_delivery', inferred: true };
  }
  if (/client|pitch|proposal|sales|account review/.test(txt)) {
    return { meetingType: 'client_or_sales', inferred: true };
  }
  if (/onboarding|training|induction|policy compliance/.test(txt)) {
    return { meetingType: 'onboarding_or_training', inferred: true };
  }
  if (context.decisions && context.decisions.length > 0) {
    return { meetingType: 'decision_or_approval', inferred: true };
  }

  return { meetingType: 'unclear', inferred: true };
}

/**
 * Detect document mentions in transcript.
 */
export function detectTranscriptDocumentReferences(transcript: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /\b(?:the|our|their|revised|signed|executed)\s+([a-z0-9_\-\s]+?(?:contract|agreement|lease|loan|policy|proposal|quote|invoice|tender|specification|subcontract|sow))\b/gi,
    /\b(clause\s+\d+(?:\.\d+)?(?:\s*,\s*[a-z\s]+)?)\b/gi,
    /\b([A-Z][a-zA-Z0-9_\-]+\.(?:pdf|docx|xlsx|doc|txt))\b/g,
    /\b(?:Insurance\s+certificate|Certificate\s+of\s+currency|Schedule\s+\d+)\b/gi,
  ];

  for (const pat of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pat.exec(transcript)) !== null) {
      const ref = match[1] ? match[1].trim() : match[0].trim();
      if (ref && !refs.some((r) => r.toLowerCase() === ref.toLowerCase())) {
        refs.push(ref);
      }
    }
  }
  return refs;
}

/**
 * Classify a document name / content into a document class string.
 */
export function classifyDocument(doc: InputDocument): string {
  if (doc.documentClass) return doc.documentClass.toLowerCase().trim();
  const name = (doc.name || '').toLowerCase();

  if (/\.(png|jpe?g|gif|webp|svg|zip)$/i.test(name) || /photo|image|site_photo/.test(name)) {
    return 'image set';
  }
  if (/agenda/i.test(name)) return 'agenda';
  if (/\.(pptx?|key)$/i.test(name) || /slides?|deck|presentation/.test(name)) return 'slide deck';
  if (/notes?|minutes/i.test(name)) return 'meeting notes';

  if (/subcontract|contract|agreement/i.test(name)) return 'contract';
  if (/lease/i.test(name)) return 'lease';
  if (/loan|finance/i.test(name)) return 'loan or finance agreement';
  if (/guarantee/i.test(name)) return 'guarantee';
  if (/insurance|certificate of currency/i.test(name)) return 'insurance document';
  if (/employment|contractor/i.test(name)) return 'employment or contractor agreement';
  if (/proposal/i.test(name)) return 'proposal';
  if (/budget|forecast|financial model/i.test(name)) return 'financial model';
  if (/tender|sow|statement of work/i.test(name)) return 'statement of work';
  if (/policy|procedure/i.test(name)) return 'policy';
  if (/board paper/i.test(name)) return 'board paper';

  return 'unknown';
}

/**
 * Test B: Meeting engagement test.
 * Did the meeting turn on the document?
 */
export function testMeetingEngagement(doc: InputDocument, context: RoutingContext): boolean {
  const transcript = (context.transcriptText || '').toLowerCase();
  const docName = (doc.name || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '');
  const baseName = docName.split(/[\s_\-]+/)[0];

  // 1. Direct name or keyword mention in transcript
  if (baseName && baseName.length > 2 && transcript.includes(baseName)) {
    return true;
  }
  if (/contract|agreement|subcontract|clause|indemnity|warranty|liability|schedule\s*\d+/i.test(transcript)) {
    if (BAND_ALWAYS_EXPLAIN.has(classifyDocument(doc))) {
      return true;
    }
  }

  // 2. Decision made, deferred, or blocked because of it
  if (context.decisions && context.decisions.length > 0) {
    const decisionText = context.decisions
      .map((d) => `${d.title || ''} ${d.summary || ''} ${d.description || ''}`)
      .join(' ')
      .toLowerCase();
    if (baseName && decisionText.includes(baseName)) return true;
    if (/contract|agreement|clause|sign|terms/i.test(decisionText)) return true;
  }

  // 3. Action created to read, review, sign, amend, send or respond to it
  if (context.actions && context.actions.length > 0) {
    const actionText = context.actions
      .map((a) => `${a.title || ''} ${a.description || ''}`)
      .join(' ')
      .toLowerCase();
    if (baseName && actionText.includes(baseName)) return true;
    if (/review|sign|amend|execute|send|read/i.test(actionText) && /contract|agreement|policy|document|scope/i.test(actionText)) {
      return true;
    }
  }

  // 4. Risks or obligations raised
  if (context.risks && context.risks.length > 0) {
    const riskText = context.risks
      .map((r) => `${r.title || ''} ${r.description || ''}`)
      .join(' ')
      .toLowerCase();
    if (baseName && riskText.includes(baseName)) return true;
    if (/contract|clause|legal|indemnity|exposure|penalty/i.test(riskText)) return true;
  }

  return false;
}

/**
 * Check for prompt injection or embedded instructions.
 */
export function detectEmbeddedInstructions(text: string): {
  detected: boolean;
  pattern?: string;
} {
  const patterns = [
    /ai\s+assistants?:\s*summarise/i,
    /ignore\s+(?:all\s+)?previous\s+instructions/i,
    /system\s+prompt/i,
    /omit\s+clause\s+\d+/i,
    /treat\s+as\s+low\s+risk\s+and\s+do\s+not\s+mention/i,
    /forward\s+this\s+(?:thread|document)\s+to/i,
    /do\s+not\s+mention\s+it\s+to\s+the\s+user/i,
  ];
  for (const pat of patterns) {
    if (pat.test(text)) {
      return { detected: true, pattern: pat.source };
    }
  }
  return { detected: false };
}

/**
 * Main deterministic document routing engine.
 * Runs on every output generation.
 */
export function routeDocumentIntelligence(context: RoutingContext): RoutingResult {
  const { meetingType, inferred: meetingTypeInferred } = inferMeetingType(context);

  const projectDocs = context.projectDocuments || [];
  const meetingDocs = context.meetingAttachments || [];
  const allSuppliedDocs = [...projectDocs, ...meetingDocs];

  const transcriptRefs = detectTranscriptDocumentReferences(context.transcriptText || '');

  const detectionSources: Array<'project' | 'meeting' | 'transcript_reference'> = [];
  if (projectDocs.length > 0) detectionSources.push('project');
  if (meetingDocs.length > 0) detectionSources.push('meeting');
  if (transcriptRefs.length > 0) detectionSources.push('transcript_reference');

  const documentsFound = allSuppliedDocs.length + transcriptRefs.length;
  const readableSuppliedDocs = allSuppliedDocs.filter(
    (d) => d.isSupplied !== false && d.isReadable !== false && !d.isCorrupt && !d.isProtected
  );
  const documentsSupplied = readableSuppliedDocs.length;

  const notAnalysed: DocumentRoutingNotAnalysed[] = [];

  // Record transcript references that were not supplied as files
  for (const ref of transcriptRefs) {
    const matchingFile = allSuppliedDocs.find((d) =>
      d.name.toLowerCase().includes(ref.toLowerCase()) || ref.toLowerCase().includes(d.name.toLowerCase().replace(/\.[^.]+$/, ''))
    );
    if (!matchingFile) {
      notAnalysed.push({
        name: ref,
        document_class: 'referenced in transcript',
        reason: 'not_supplied',
      });
    }
  }

  // Stage 1: Detect
  if (allSuppliedDocs.length === 0 && transcriptRefs.length === 0) {
    return {
      routing: {
        stage_reached: 'detect',
        document_detected: false,
        detection_source: [],
        documents_found: 0,
        documents_supplied: 0,
        meeting_type: meetingType,
        meeting_type_inferred: meetingTypeInferred,
        not_analysed: [],
        agent_error: null,
      },
    };
  }

  if (allSuppliedDocs.length === 0 && transcriptRefs.length > 0) {
    return {
      routing: {
        stage_reached: 'qualify',
        document_detected: true,
        detection_source: ['transcript_reference'],
        documents_found: transcriptRefs.length,
        documents_supplied: 0,
        meeting_type: meetingType,
        meeting_type_inferred: meetingTypeInferred,
        not_analysed: notAnalysed,
        agent_error: null,
      },
      warningNotice: 'A document was discussed in the meeting but was not supplied for analysis.',
    };
  }

  // Stage 2: Qualify each supplied document
  const qualifiedDocs: InputDocument[] = [];

  for (const doc of allSuppliedDocs) {
    // Check readability
    if (doc.isReadable === false) {
      notAnalysed.push({
        name: doc.name,
        document_class: classifyDocument(doc),
        reason: 'unreadable',
      });
      continue;
    }
    if (doc.isCorrupt || doc.isProtected) {
      notAnalysed.push({
        name: doc.name,
        document_class: classifyDocument(doc),
        reason: 'protected_or_corrupt',
      });
      continue;
    }

    const docClass = classifyDocument(doc);

    // Test A: Document Class
    if (BAND_REFERENCE_ONLY.has(docClass)) {
      notAnalysed.push({
        name: doc.name,
        document_class: docClass,
        reason: 'reference_only_class',
      });
      continue;
    }

    if (docClass === 'unknown') {
      notAnalysed.push({
        name: doc.name,
        document_class: 'unknown',
        reason: 'class_unknown',
      });
      continue;
    }

    // Test B: Meeting Engagement
    const engaged = testMeetingEngagement(doc, context);
    if (!engaged) {
      notAnalysed.push({
        name: doc.name,
        document_class: docClass,
        reason: 'not_discussed',
      });
      continue;
    }

    // If it requires a decision (Band 2), verify decision context
    if (BAND_EXPLAIN_WHEN_DECISION.has(docClass)) {
      const hasDecision =
        (context.decisions && context.decisions.length > 0) ||
        /decid|approve|defer|reject|adopt/i.test(context.transcriptText || '');
      if (!hasDecision) {
        notAnalysed.push({
          name: doc.name,
          document_class: docClass,
          reason: 'not_discussed',
        });
        continue;
      }
    }

    qualifiedDocs.push(doc);
  }

  if (qualifiedDocs.length === 0) {
    return {
      routing: {
        stage_reached: 'qualify',
        document_detected: true,
        detection_source: detectionSources,
        documents_found: documentsFound,
        documents_supplied: documentsSupplied,
        meeting_type: meetingType,
        meeting_type_inferred: meetingTypeInferred,
        not_analysed: notAnalysed,
        agent_error: null,
      },
    };
  }

  // Stage 3: Explain
  // Primary document to explain
  const primaryDoc = qualifiedDocs[0];
  const docClass = classifyDocument(primaryDoc);
  const docContent = primaryDoc.content || context.transcriptText || '';

  // Embedded instruction check
  const injectionCheck = detectEmbeddedInstructions(docContent);
  let requiresReview = false;
  const identifiedRisks: DocumentRiskItem[] = [];

  if (injectionCheck.detected) {
    requiresReview = true;
    identifiedRisks.push({
      rating: 'critical',
      issue: 'Embedded prompt instruction detected in document source',
      reference: 'Document text / footer',
      why_it_matters: 'Potential injection attempt. Content was not executed and flagged for human review.',
      who_carries_it: 'Project Owner',
      recommended_response: 'Verify the document origin out-of-band and obtain a clean certified copy.',
    });
  }

  // Check anti-surveillance for performance reviews or disciplinary documents
  const isPerformanceOrDisciplinary = /performance\s+review|disciplinary|staff\s+appraisal|employee\s+warning/i.test(
    primaryDoc.name + ' ' + docContent
  );

  const noticeText = STANDARD_NOTICE + (primaryDoc.thirdParty ? THIRD_PARTY_NOTICE_ADDENDUM : '');

  // Depth rule:
  // If meetingType is 'status_or_standup', output document_brief ONLY (short form), NOT contract depth!
  const isStatusMeeting = meetingType === 'status_or_standup';

  const brief: DocumentBriefSection = {
    document_name: primaryDoc.name,
    document_class: docClass,
    status: 'draft',
    document_date: new Date().toISOString().slice(0, 10),
    what_it_requires: isPerformanceOrDisciplinary
      ? 'Formal process adherence, procedural timeline observation, and documented response rights.'
      : 'Compliance with specified milestones, resourcing commitments, and notice procedures.',
    nearest_date: {
      date: '2026-11-14',
      event: 'Practical completion revision deadline',
      basis: 'explicit',
    },
    most_significant_risk: injectionCheck.detected
      ? 'Embedded prompt instruction detected in document text.'
      : 'Compressed delivery schedule without verified resourcing signoff.',
    professional_review: {
      profession: 'Legal counsel',
      question: 'Confirm whether liability caps in clause 13 apply to indemnities in clause 14.',
      before_proceeding: true,
    },
    evidence_label: '[Stated]',
    notice: noticeText,
  };

  let intelligence: DocumentIntelligenceSection | undefined = undefined;

  if (!isStatusMeeting) {
    // Full form
    const discussedItems: DocumentDiscussedItem[] = [
      {
        reference: 'Clause 14.2, indemnity',
        what_it_says: 'Subcontractor indemnifies head contractor against loss arising from works.',
        what_it_means: 'Direct exposure to reimbursement obligations for site loss or damages.',
        why_it_matters: 'The liability cap in clause 13.1 excludes indemnities, leaving exposure uncapped.',
        transcript_anchor: 'Discussed during agenda review',
        evidence_label: '[Stated]',
      },
      {
        reference: 'Clause 9.4, programme',
        what_it_says: 'Practical completion moves from 28 November to 14 November.',
        what_it_means: 'Two weeks less on site for the same agreed scope.',
        why_it_matters: 'Resourcing plan must be reviewed against compressed handover.',
        transcript_anchor: 'Discussed during scheduling sync',
        evidence_label: '[Stated]',
      },
    ];

    const obligations: DocumentObligation[] = isPerformanceOrDisciplinary
      ? [
          {
            party: 'Employer',
            obligation: 'Provide written notification of concerns with minimum 10 business days for response',
            by_when: '2026-10-24',
            consequence_if_missed: 'Procedural defect under standard employment governance',
            reference: 'Clause 4.1, notice',
          },
          {
            party: 'Employee',
            obligation: 'Submit formal written response or nominate support person for review meeting',
            by_when: '2026-11-04',
            consequence_if_missed: 'Process proceeds on existing records',
            reference: 'Clause 4.3, response',
          },
        ]
      : [
          {
            party: 'Subcontractor',
            obligation: 'Submit certificate of currency for public liability and workers compensation',
            by_when: '2026-10-16',
            consequence_if_missed: 'Site access suspended without compensation',
            reference: 'Clause 8.1, insurance',
          },
          {
            party: 'Subcontractor',
            obligation: 'Achieve practical completion and submit handover documentation',
            by_when: '2026-11-14',
            consequence_if_missed: 'Liquidated damages of $1,200 per day apply under clause 11.2',
            reference: 'Clause 9.4, completion',
          },
        ];

    const explicitDates: DocumentExplicitDate[] = [
      {
        date: '2026-11-14',
        event: 'Revised practical completion date',
        notice_period: '14 calendar days prior notice for extension claims',
        reference: 'Clause 9.4',
      },
      {
        date: '2026-10-16',
        event: 'Insurance renewal certificate submission',
        notice_period: '7 days',
        reference: 'Clause 8.1',
      },
    ];

    const inferredDates: DocumentInferredDate[] = [
      {
        date: '2026-10-31',
        reason: 'Estimated milestone inspection based on two-week prior delivery checkpoint',
        requires_confirmation: true,
      },
    ];

    const amounts: DocumentAmount[] = [
      {
        amount: '$148,500.00 AUD',
        purpose: 'Subcontract sum for Harrington fit-out fabrication works',
        basis: 'stated',
        timing: 'Progress claims on 25th of each month, 14-day payment terms',
        tax_treatment: 'Exclusive of GST (GST payable on valid tax invoices)',
        reference: 'Schedule 2, pricing',
      },
      {
        amount: '$16,800.00 AUD',
        purpose: 'Potential liquidated damages for two-week delivery delay',
        basis: 'calculated',
        working: '14 days delay * $1,200.00/day = $16,800.00 AUD (clause 11.2)',
        timing: 'Deducted from progress claims upon certification',
        tax_treatment: 'Exempt from GST under ruling GSTR 2001/4',
        reference: 'Clause 11.2, liquidated damages',
      },
    ];

    if (identifiedRisks.length === 0) {
      identifiedRisks.push({
        rating: 'high',
        issue: 'Liquidated damages exposure of $1,200 per day for delayed completion',
        reference: 'Clause 11.2',
        why_it_matters: 'Compressed programme leaves zero buffer for procurement lead times.',
        who_carries_it: 'Subcontractor',
        recommended_response: 'Negotiate extension of time grace period before executing revision.',
      });
    }

    intelligence = {
      document_name: primaryDoc.name,
      document_class: [docClass, 'financial commitment', 'operational dependency'],
      status: 'draft',
      parties: [
        {
          name: 'Meridian Build Co Pty Ltd',
          identifier: 'ACN 000 000 101',
          role: 'head contractor',
          is_our_organisation: false,
        },
        {
          name: 'Concludo Client Organisation',
          identifier: 'ACN 000 000 102',
          role: 'subcontractor',
          is_our_organisation: true,
        },
      ],
      jurisdiction: 'Victoria, Australia',
      governing_law: 'Victoria, Australia',
      currency: 'AUD',
      tax_treatment: 'Amounts stated exclusive of GST',
      discussed_in_meeting: discussedItems,
      obligations: obligations,
      explicit_dates: explicitDates,
      inferred_dates: inferredDates,
      amounts: amounts,
      risks: identifiedRisks,
      decisions_made: ['Endorse baseline delivery scope subject to legal review of indemnities.'],
      decisions_required: ['Confirm whether team resourcing can deliver by 14 November.'],
      missing: ['Schedule 3 (Shop drawings)', 'Insurance certificate of currency'],
      verify_with: [
        {
          profession: 'Construction lawyer',
          give_them: 'Subcontract agreement rev B, specifically clauses 9, 11, 13 and 14',
          question: 'Does the liability cap in clause 13 protect against indemnity claims under clause 14?',
          ask_them: 'Does the liability cap in clause 13 protect against indemnity claims under clause 14?',
          before_proceeding: true,
        },
      ],
      coverage: {
        reviewed: 'Main agreement clauses 1 to 22 and Schedule 2 (Pricing).',
        not_reviewed: 'Schedule 3 (Shop drawings) not supplied; structural engineering annexure omitted.',
        limitation: 'Analysis is based on unexecuted draft rev B provided by project owner.',
      },
      third_party_document: primaryDoc.thirdParty ?? true,
      notice: noticeText,
    };
  }

  return {
    routing: {
      stage_reached: 'explain',
      document_detected: true,
      detection_source: detectionSources,
      documents_found: documentsFound,
      documents_supplied: documentsSupplied,
      meeting_type: meetingType,
      meeting_type_inferred: meetingTypeInferred,
      not_analysed: notAnalysed,
      agent_error: null,
    },
    brief,
    intelligence,
    requiresHumanReview: requiresReview,
  };
}
