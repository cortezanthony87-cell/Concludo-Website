/**
 * The three registers, and why two of them are a legal requirement rather than
 * good practice.
 *
 * THE DATE THAT MATTERS.
 *
 * On 10 December 2026 the automated decision-making transparency obligation in
 * APP 1.7 to 1.9 takes effect. The OAIC published its guidance and fact sheets
 * on 30 September 2026. From that date, an APP entity that has arranged for a
 * computer program to make a decision about an individual, OR to do something
 * substantially and directly related to making one, where that decision could
 * reasonably be expected to significantly affect the individual's rights or
 * interests, and where their personal information is used in operating the
 * program, must say so in its privacy policy: the kinds of personal information
 * used, the kinds of decisions made solely by the program, and the kinds of
 * decisions the program does something related to.
 *
 * Today is 13 October 2026. That is 58 days away.
 *
 * WHAT THIS MEANS FOR CONCLUDO, STATED CAREFULLY.
 *
 * Concludo's agents propose and a person disposes, and the guidance is explicit
 * that a program which merely INFORMS a decision can still be in scope. So
 * "there is a human in the loop" is not by itself an answer.
 *
 * The condition that most likely takes Concludo's current agents out of scope
 * is a different one: the decision has to significantly affect an individual's
 * rights or interests. Attaching a meeting to the right account, proposing a
 * next step on a deal, or drafting a follow-up email for a person to send does
 * not do that. The OAIC's examples are things like granting or refusing a
 * government benefit, affecting contract rights, or affecting access to
 * healthcare.
 *
 * That assessment is recorded against each entry below rather than asserted
 * once in a report, because it is an assessment that changes the moment the
 * product changes. The day a Concludo agent scores a lead for credit, screens a
 * job applicant, or decides who gets a service tier, the answer flips, and the
 * register is where somebody finds that out before the regulator does.
 *
 * NOTHING HERE IS LEGAL ADVICE. The assessment column is Concludo's own working
 * position, written so a lawyer can check it. A lawyer must check it before
 * Concludo represents itself as compliant.
 *
 * Sources consulted 13 October 2026:
 *   OAIC, "New resources on transparency for use of AI and automated
 *   decision-making", 30 September 2026.
 *   Gilbert + Tobin, "Automated decision-making transparency under the Privacy
 *   Act: are you prepared for 10 December 2026?"
 */

/* ============================================ automated decisions */

export type AdmScope = 'in_scope' | 'out_of_scope' | 'needs_legal_review';

export interface AutomatedDecisionEntry {
  id: string;
  /** What the program does, in the words a privacy policy would use. */
  what: string;
  /** Which Concludo component. */
  component: string;
  /** The kinds of personal information used in operating it. APP 1.8(a). */
  personalInformationUsed: string[];
  /** Does a program decide alone, assist a person, or neither. */
  automationLevel: 'decides_alone' | 'informs_a_person' | 'no_decision_made';
  /** Could the decision significantly affect rights or interests. */
  significantEffect: boolean;
  /** The resulting assessment, and the reasoning behind it. */
  scope: AdmScope;
  assessment: string;
  /** What would change the answer. The most useful column in the register. */
  wouldChangeIf: string;
  lastReviewed: string;
  reviewedBy: string;
}

export const ADM_OBLIGATION_START = '2026-12-10';

export const AUTOMATED_DECISION_REGISTER: AutomatedDecisionEntry[] = [
  {
    id: 'adm-1',
    what: 'Proposes which account or piece of work a recorded conversation belongs to.',
    component: 'Capture agent (Stage 7)',
    personalInformationUsed: [
      'Names of people recorded as participants',
      'The organisation a person is recorded against',
      'Conversation titles and summaries',
    ],
    automationLevel: 'informs_a_person',
    significantEffect: false,
    scope: 'out_of_scope',
    assessment:
      'Filing a conversation against the correct account is an administrative act. It does not affect anybody’s rights or interests in the sense APP 1.7 requires, and no decision about an individual is made: the proposal is about a record. Nothing is attached without a person confirming it.',
    wouldChangeIf:
      'If Concludo used the filing to decide anything about the person, such as eligibility, pricing or access.',
    lastReviewed: '2026-10-13',
    reviewedBy: 'Concludo, pending legal review',
  },
  {
    id: 'adm-2',
    what: 'Produces an evidence-based estimate of how well-recorded a piece of work is.',
    component: 'Forecast system estimate (Stage 5)',
    personalInformationUsed: [
      'Names of people recorded against a piece of work',
      'Dates of recorded conversations',
    ],
    automationLevel: 'informs_a_person',
    significantEffect: false,
    scope: 'out_of_scope',
    assessment:
      'The estimate is about a RECORD, not about a person, and the module states that in words on every card. It produces no probability, makes no decision, and is shown beside a human forecast rather than replacing it. No decision about an individual results from it.',
    wouldChangeIf:
      'If the estimate were used to decide anything about an employee, such as pay, ranking or continued employment. Concludo deliberately produces no individual performance score, which is what keeps this out.',
    lastReviewed: '2026-10-13',
    reviewedBy: 'Concludo, pending legal review',
  },
  {
    id: 'adm-3',
    what: 'Proposes that two person records may be the same human being.',
    component: 'Data steward agent (Stage 7)',
    personalInformationUsed: ['Names', 'Email addresses', 'Phone numbers', 'Job titles'],
    automationLevel: 'informs_a_person',
    significantEffect: false,
    scope: 'needs_legal_review',
    assessment:
      'A merge combines everything recorded about two people, and if they are different people it puts one person’s conversations onto the other’s record. Concludo’s position is that this is a data quality operation rather than a decision about an individual, and that it is out of scope because a person confirms every merge and automatic merging is disabled. That position should be tested by a lawyer, because the consequence of a wrong merge for the individual is not trivial.',
    wouldChangeIf:
      'If automatic merging were enabled, or a merged record were used to make a decision about the person.',
    lastReviewed: '2026-10-13',
    reviewedBy: 'Concludo, flagged for legal review before 10 December 2026',
  },
  {
    id: 'adm-4',
    what: 'Identifies that a person may not be contacted, from consent records and communication preferences.',
    component: 'Privacy and consent agent (Stage 7)',
    personalInformationUsed: [
      'Consent records',
      'Communication preferences',
      'Contact details',
    ],
    automationLevel: 'informs_a_person',
    significantEffect: false,
    scope: 'out_of_scope',
    assessment:
      'This restricts what Concludo does rather than deciding anything about the individual, and it operates only in the direction of less contact. A program that decides somebody may NOT be contacted does not affect their rights adversely; the opposite behaviour would be the problem.',
    wouldChangeIf:
      'If the same mechanism were used to decide that somebody MAY be contacted, as the basis for contacting them.',
    lastReviewed: '2026-10-13',
    reviewedBy: 'Concludo, pending legal review',
  },
  {
    id: 'adm-5',
    what: 'Nothing in Concludo makes a decision about an individual without a person.',
    component: 'The whole product',
    personalInformationUsed: [],
    automationLevel: 'no_decision_made',
    significantEffect: false,
    scope: 'out_of_scope',
    assessment:
      'Recorded as an entry in its own right so the register answers the question directly rather than by the absence of a row. No agent writes a customer record, sends a message, or merges anything; the appliers run only on a human decision bound to a digest.',
    wouldChangeIf: 'If any agent were given a write path that did not pass through a human approval.',
    lastReviewed: '2026-10-13',
    reviewedBy: 'Concludo, pending legal review',
  },
];

/**
 * The paragraph Concludo would publish, if any entry were in scope.
 *
 * Generated from the register rather than written separately, because a privacy
 * policy maintained by hand beside a register maintained by code drifts, and
 * the drifting half is always the policy.
 */
export function privacyPolicyAdmSection(): {
  required: boolean;
  text: string;
  because: string;
} {
  const inScope = AUTOMATED_DECISION_REGISTER.filter((entry) => entry.scope === 'in_scope');
  const needsReview = AUTOMATED_DECISION_REGISTER.filter(
    (entry) => entry.scope === 'needs_legal_review'
  );

  if (inScope.length === 0) {
    return {
      required: false,
      because:
        needsReview.length > 0
          ? `Concludo’s own assessment is that nothing currently in the product meets all three conditions in APP 1.7, but ${needsReview.length} ${needsReview.length === 1 ? 'entry is' : 'entries are'} flagged for legal review before ${ADM_OBLIGATION_START}.`
          : 'Concludo’s own assessment is that nothing currently in the product meets all three conditions in APP 1.7.',
      text:
        'Concludo uses software to suggest how your information should be organised and what a person here might do next. ' +
        'These suggestions are reviewed by a person before anything happens. Concludo does not use computer programs to ' +
        'make decisions about you that affect your rights or interests.',
    };
  }

  const kinds = [...new Set(inScope.flatMap((entry) => entry.personalInformationUsed))];
  const alone = inScope.filter((entry) => entry.automationLevel === 'decides_alone');
  const assisting = inScope.filter((entry) => entry.automationLevel === 'informs_a_person');

  return {
    required: true,
    because: `${inScope.length} ${inScope.length === 1 ? 'entry meets' : 'entries meet'} all three conditions in APP 1.7.`,
    text: [
      'Automated decision-making.',
      '',
      `We use computer programs that use the following kinds of personal information: ${kinds.join(', ')}.`,
      alone.length > 0
        ? `Decisions made solely by a computer program: ${alone.map((entry) => entry.what).join(' ')}`
        : 'No decision about you is made solely by a computer program.',
      assisting.length > 0
        ? `Decisions where a computer program does something substantially and directly related to the decision: ${assisting.map((entry) => entry.what).join(' ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

/* ================================================= AI model register */

export interface ModelEntry {
  id: string;
  /** What it would be used for. */
  purpose: string;
  component: string;
  /** Null where nothing is wired, which is the current state of all of them. */
  provider: string | null;
  modelVersion: string | null;
  promptVersion: string | null;
  /** Whether customer personal information would reach it. */
  sendsPersonalInformation: boolean;
  /** Where the processing would happen, which matters for residency. */
  processingLocation: string | null;
  state: 'not_connected' | 'connected';
  /** What has to be true before this is turned on. */
  beforeEnabling: string[];
}

/**
 * Every model slot in the product. All of them are empty.
 *
 * The register exists before the models do, deliberately. A model register
 * written after the models are wired is written by somebody reconstructing what
 * was connected and why, and it is always incomplete. This one is a gate: a new
 * entry is how a model gets added, and `beforeEnabling` is the checklist.
 */
export const AI_MODEL_REGISTER: ModelEntry[] = [
  {
    id: 'model-1',
    purpose: 'Extracting commitments, decisions and next steps from a transcript.',
    component: 'Follow-through agent (Stage 7)',
    provider: null,
    modelVersion: null,
    promptVersion: null,
    sendsPersonalInformation: true,
    processingLocation: null,
    state: 'not_connected',
    beforeEnabling: [
      'A data processing agreement with the provider, naming where processing happens.',
      'A decision about whether transcripts may leave Australia, and a privacy policy that says so.',
      'The structured output validator in place, which it already is.',
      'A recorded-fixture test suite, because the current suites rely on the agents being deterministic.',
      'An entry in the automated decision register, reassessed against APP 1.7.',
    ],
  },
  {
    id: 'model-2',
    purpose: 'Drafting a follow-up message for a person to read, change and send.',
    component: 'Drafting agent (Stage 7)',
    provider: null,
    modelVersion: null,
    promptVersion: null,
    sendsPersonalInformation: true,
    processingLocation: null,
    state: 'not_connected',
    beforeEnabling: [
      'Everything above.',
      'Confirmation that the recipient list is still built from CRM records and never from model output.',
      'A test that a model asked to address a message elsewhere cannot do so.',
    ],
  },
  {
    id: 'model-3',
    purpose: 'Summarising a service case for an account person without the detail.',
    component: 'Service context agent (Stage 7)',
    provider: null,
    modelVersion: null,
    promptVersion: null,
    sendsPersonalInformation: true,
    processingLocation: null,
    state: 'not_connected',
    beforeEnabling: [
      'Everything in model-1.',
      'A redaction step before the content reaches the model, because the case detail is the restricted part and a model that receives it can repeat it.',
    ],
  },
];

export function modelsConnected(): number {
  return AI_MODEL_REGISTER.filter((entry) => entry.state === 'connected').length;
}

/* ============================================== integration register */

export type IntegrationState = 'not_built' | 'specified' | 'connected';

export interface ScopeRequest {
  /** The provider's own scope string, where it has one. */
  scope: string;
  /** What it lets Concludo do, in a sentence. */
  allows: string;
  /** Why Concludo needs it. A scope with no justification is not requested. */
  because: string;
  /** Whether it can write. Read-only scopes are preferred everywhere. */
  writes: boolean;
}

export interface IntegrationEntry {
  id: string;
  name: string;
  purpose: string;
  state: IntegrationState;
  /** Least privilege: the scopes requested, each justified. */
  scopes: ScopeRequest[];
  /** What Concludo would never ask for, and why. Often the more useful list. */
  notRequested: { scope: string; because: string }[];
  /** The controls a person sets before anything is read. */
  importControls: string[];
  /** Whether anything could be sent, and the default. */
  canSend: boolean;
  sendingDefault: 'off';
  /** What happens when the provider's permission expires. */
  onPermissionExpiry: string;
  /** Where the provider processes data, where Concludo would need to know. */
  residencyNote: string | null;
}

/**
 * Fourteen connectors, specified. None connected.
 *
 * READ THIS BEFORE READING THE TABLE. Not one of these is built. There is no
 * OAuth client, no token store, no refresh loop, no webhook endpoint and no
 * credential anywhere in this repository. What is here is the permission model:
 * for each connector, the scopes Concludo would request, why each one is
 * needed, what it deliberately does not request, and the controls a person sets
 * before anything is read.
 *
 * That is worth building first for one reason: the scope list is the thing
 * nobody revisits. A connector shipped with mail.read-write because it was
 * easier keeps that scope for years, and the day somebody asks why Concludo can
 * delete a customer's email, the answer is that it was convenient in week two.
 */
export const INTEGRATION_REGISTER: IntegrationEntry[] = [
  {
    id: 'int-ms-mail',
    name: 'Microsoft email and calendar',
    purpose: 'Read the messages and meetings a person chooses, to attach them to records.',
    state: 'specified',
    scopes: [
      {
        scope: 'Mail.Read',
        allows: 'Read messages in the signed-in person’s mailbox.',
        because: 'A conversation cannot be attached to an account without reading it.',
        writes: false,
      },
      {
        scope: 'Calendars.Read',
        allows: 'Read events in the signed-in person’s calendar.',
        because: 'A meeting record needs the time, the attendees and the subject.',
        writes: false,
      },
      {
        scope: 'offline_access',
        allows: 'Refresh the token without the person signing in again.',
        because: 'Otherwise the connection breaks silently every hour.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'Mail.Send',
        because:
          'Concludo does not send. A drafting agent produces a body for a person to send from their own mail, and asking for send permission would be asking for something the product does not do.',
      },
      {
        scope: 'Mail.ReadWrite',
        because: 'Concludo never modifies or deletes a message in somebody’s mailbox.',
      },
      {
        scope: 'Mail.Read.Shared / Calendars.Read.Shared',
        because:
          'Reading a colleague’s mailbox is a different product with a different consent conversation.',
      },
      {
        scope: 'User.Read.All / Directory.Read.All',
        because: 'Concludo does not need the organisation’s directory to file a meeting.',
      },
    ],
    importControls: [
      'Which mailbox or calendar, chosen explicitly. Never all of them by default.',
      'Which folders or labels. The default is none until somebody chooses.',
      'A date range, with a default of the last 30 days rather than all history.',
      'Only messages involving people or domains already recorded in this workspace, which is the control that stops a whole mailbox arriving.',
      'A preview of what would be imported, before anything is.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry:
      'The connection is marked expired, synchronisation stops, and the person is told. Nothing is retried silently and no partial state is presented as current.',
    residencyNote:
      'Microsoft 365 data location depends on the tenant. Concludo must record which region before any Australian customer’s data is read.',
  },
  {
    id: 'int-google-mail',
    name: 'Google email and calendar',
    purpose: 'The same, for Google accounts.',
    state: 'specified',
    scopes: [
      {
        scope: 'gmail.readonly',
        allows: 'Read messages and settings.',
        because: 'Same as Microsoft: a conversation has to be read to be filed.',
        writes: false,
      },
      {
        scope: 'calendar.readonly',
        allows: 'Read calendars and events.',
        because: 'A meeting record needs the time and the attendees.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'gmail.send',
        because: 'Concludo does not send.',
      },
      {
        scope: 'gmail.modify',
        because: 'Concludo does not label, archive or delete anybody’s mail.',
      },
      {
        scope: 'https://mail.google.com/',
        because:
          'Full mailbox access is the scope most commonly requested and least commonly needed. Concludo reads; it does not need to do everything.',
      },
    ],
    importControls: [
      'Which Google account.',
      'Which labels, chosen explicitly.',
      'A date range.',
      'Only threads involving recorded people or domains.',
      'A preview before import.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry:
      'Google refresh tokens expire when a password changes or access is revoked. The connection is marked expired and the person is told.',
    residencyNote:
      'Google Workspace data regions are configurable by the customer. Concludo records the region.',
  },
  {
    id: 'int-ecc',
    name: 'Concludo Email Command Centre',
    purpose: 'Reuse the email triage Concludo already built, rather than reading mailboxes twice.',
    state: 'specified',
    scopes: [
      {
        scope: 'concludo.ecc.read',
        allows: 'Read the messages the Command Centre has already processed.',
        because:
          'The Command Centre already has the person’s consent and their folder choices. Reading its output avoids a second mailbox connection and a second consent conversation.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'concludo.ecc.write',
        because: 'The CRM does not change what the Command Centre holds.',
      },
    ],
    importControls: [
      'Which Command Centre account.',
      'Only messages the Command Centre has already classified as customer correspondence.',
      'A date range.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Internal, so expiry is a session matter rather than a provider one.',
    residencyNote: 'Same deployment as the CRM, so residency is Concludo’s own choice.',
  },
  {
    id: 'int-outputs',
    name: 'Concludo meeting outputs',
    purpose:
      'Attach the summaries, action items and decision logs Concludo already produces to the right CRM records.',
    state: 'specified',
    scopes: [
      {
        scope: 'concludo.outputs.read',
        allows: 'Read finished outputs and their source transcripts.',
        because:
          'This is the product’s own central claim: a transcript becomes finished work, and the finished work belongs on the customer record.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'concludo.transcripts.write',
        because: 'The CRM never edits a transcript.',
      },
    ],
    importControls: [
      'Which workspace.',
      'A date range.',
      'Only outputs whose participants match recorded people, with the rest offered for review.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Internal.',
    residencyNote: 'Same deployment as the CRM.',
  },
  {
    id: 'int-xero',
    name: 'Xero',
    purpose: 'Read invoice status, so an account page can say what is outstanding.',
    state: 'specified',
    scopes: [
      {
        scope: 'accounting.contacts.read',
        allows: 'Read contacts.',
        because: 'To match a Xero contact to a CRM organisation.',
        writes: false,
      },
      {
        scope: 'accounting.transactions.read',
        allows: 'Read invoices and payments.',
        because: 'An account manager needs to know an invoice is overdue before a renewal call.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'accounting.transactions (write)',
        because:
          'Concludo does not raise invoices, apply payments or change anything in an accounting system. That is somebody’s books.',
      },
      { scope: 'payroll.*', because: 'Nothing in a CRM needs payroll.' },
    ],
    importControls: [
      'Which Xero organisation.',
      'Invoice status only. Concludo stores a reference and a state, not the line items.',
      'A date range.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry:
      'Xero refresh tokens expire after 60 days of disuse. The connection is marked expired rather than failing silently on the next read.',
    residencyNote: 'Xero processes in the region of the organisation’s subscription.',
  },
  {
    id: 'int-myob',
    name: 'MYOB',
    purpose: 'The same as Xero, for customers who use MYOB.',
    state: 'not_built',
    scopes: [],
    notRequested: [],
    importControls: [],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Not built.',
    residencyNote: null,
  },
  {
    id: 'int-stripe',
    name: 'Stripe',
    purpose: 'Read subscription and payment state for Concludo’s own customers.',
    state: 'specified',
    scopes: [
      {
        scope: 'rak_ (restricted key, read)',
        allows: 'Read customers, subscriptions and invoices.',
        because:
          'To know whether a Concludo customer’s own subscription is current. This is Concludo’s billing, not the customer’s.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'Secret key (full access)',
        because:
          'A full key can move money. Nothing in a CRM needs to move money, and a restricted read key cannot.',
      },
      {
        scope: 'Write access to charges or refunds',
        because: 'Concludo does not take payments from inside the CRM.',
      },
    ],
    importControls: [
      'Concludo’s own Stripe account only.',
      'Subscription state and invoice status. No card data ever reaches Concludo.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'A revoked restricted key fails closed and is reported.',
    residencyNote:
      'Stripe processes in the United States. Concludo stores a reference and a state, never card data, which keeps this out of the customer-data residency question.',
  },
  {
    id: 'int-teams',
    name: 'Microsoft Teams',
    purpose: 'Read meeting metadata where a customer runs meetings there.',
    state: 'specified',
    scopes: [
      {
        scope: 'OnlineMeetings.Read',
        allows: 'Read meeting details for the signed-in person.',
        because: 'A meeting record needs a time and participants.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'OnlineMeetingTranscript.Read.All',
        because:
          'Reading every transcript in a tenant is far beyond what a CRM needs, and it is the scope most likely to be refused by an IT department, correctly.',
      },
      {
        scope: 'ChannelMessage.Read.All',
        because: 'Concludo does not read team chat.',
      },
    ],
    importControls: [
      'Which account.',
      'Only meetings with recorded people.',
      'A date range.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Marked expired, synchronisation stops, the person is told.',
    residencyNote: 'Tenant-dependent, recorded at connection.',
  },
  {
    id: 'int-slack',
    name: 'Slack',
    purpose: 'Notify a channel that something needs a person. Read nothing.',
    state: 'not_built',
    scopes: [],
    notRequested: [
      {
        scope: 'channels:history',
        because:
          'Concludo has no reason to read a company’s Slack. If this is ever built it is a notification sink, not a source.',
      },
    ],
    importControls: [],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Not built.',
    residencyNote: null,
  },
  {
    id: 'int-esign',
    name: 'E-signature provider',
    purpose: 'Read the status of a document sent for signature.',
    state: 'not_built',
    scopes: [],
    notRequested: [
      {
        scope: 'Send for signature',
        because:
          'Sending a document for signature is a communication to a customer, and Concludo does not send. The CRM would show status only.',
      },
    ],
    importControls: [],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Not built.',
    residencyNote: null,
  },
  {
    id: 'int-telephony',
    name: 'Telephony provider',
    purpose: 'Record that a call happened, and its duration.',
    state: 'not_built',
    scopes: [],
    notRequested: [
      {
        scope: 'Call recording access',
        because:
          'Recording a call engages consent law in every Australian state, with different rules in each. That is a product decision and a legal one, not a connector setting.',
      },
    ],
    importControls: [],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Not built.',
    residencyNote: null,
  },
  {
    id: 'int-api',
    name: 'Open API',
    purpose: 'Let a customer read and write their own CRM data programmatically.',
    state: 'specified',
    scopes: [
      {
        scope: 'crm.read',
        allows: 'Read records in one workspace.',
        because: 'A customer owns their data and should be able to get it out.',
        writes: false,
      },
      {
        scope: 'crm.write',
        allows: 'Create and update records in one workspace.',
        because: 'For the customer’s own integrations.',
        writes: true,
      },
    ],
    notRequested: [
      {
        scope: 'crm.admin',
        because:
          'Changing roles, retention or integrations through an API token is how a compromised token becomes a tenant takeover. Those stay in the interface, behind a person.',
      },
    ],
    importControls: [
      'A token is scoped to one workspace and cannot reach another.',
      'Rate limited per token.',
      'Every call is audited with the token id.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Tokens expire and are rotated. An expired token fails closed.',
    residencyNote: 'Concludo’s own deployment.',
  },
  {
    id: 'int-webhooks',
    name: 'Webhooks',
    purpose: 'Tell a customer’s system that something happened in theirs.',
    state: 'specified',
    scopes: [
      {
        scope: 'outbound only',
        allows: 'Post an event to a URL the customer configures.',
        because: 'So a customer can react without polling.',
        writes: false,
      },
    ],
    notRequested: [
      {
        scope: 'Inbound webhooks that write records',
        because:
          'An inbound webhook that creates records is an unauthenticated write path unless it is done very carefully. The Open API, with a token, is the right door.',
      },
    ],
    importControls: [
      'The customer chooses which events.',
      'Payloads carry ids and event types, not record contents, so a misconfigured URL leaks a reference rather than a customer’s data.',
      'Signed, with a secret the customer can rotate.',
      'Retried with backoff, and the failures are visible rather than silent.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'A URL that fails repeatedly is disabled and reported, not retried forever.',
    residencyNote: 'The customer chooses the destination.',
  },
  {
    id: 'int-csv',
    name: 'CSV import and export',
    purpose: 'Get data in and out without an integration at all.',
    state: 'connected',
    scopes: [
      {
        scope: 'none',
        allows: 'A file the person chooses.',
        because:
          'The only connector that needs no permission from anybody, which is why it is the one that is actually built.',
        // `writes` means "can write to the outside system". A file a person
        // hands over grants Concludo nothing: the import writes into Concludo,
        // under Concludo's own permission model, and touches nothing of
        // theirs.
        writes: false,
      },
    ],
    notRequested: [],
    importControls: [
      'Preview before anything is created.',
      'Field mapping the person confirms.',
      'Validation, with the errors downloadable.',
      'Duplicate review.',
      'A dry run that writes nothing.',
      'Rollback of a completed import.',
      'An audit record of what was imported and by whom.',
    ],
    canSend: false,
    sendingDefault: 'off',
    onPermissionExpiry: 'Not applicable.',
    residencyNote: 'The file never leaves the browser in this release.',
  },
];

export function integrationsConnected(): IntegrationEntry[] {
  return INTEGRATION_REGISTER.filter((entry) => entry.state === 'connected');
}

export function integrationsSpecified(): IntegrationEntry[] {
  return INTEGRATION_REGISTER.filter((entry) => entry.state === 'specified');
}

/** Every scope that can write, across every connector. Short on purpose. */
export function writeScopes(): { integration: string; scope: string; because: string }[] {
  return INTEGRATION_REGISTER.flatMap((entry) =>
    entry.scopes
      .filter((scope) => scope.writes)
      .map((scope) => ({ integration: entry.name, scope: scope.scope, because: scope.because }))
  );
}

/** The sentence shown wherever a connector is named. */
export const INTEGRATION_TRUTH =
  'No connector to an outside system is connected. Concludo holds no credential for any of these providers in this release, and nothing has been read from or written to any of them. The one working path for data in this release is a file you choose and import yourself, which needs no credential and reads nothing you did not hand it. What is recorded below is the permission each connector would request and why, which is the part worth settling before anybody signs in.';
