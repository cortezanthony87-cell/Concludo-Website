/**
 * The ingestion pipeline: twenty-two stages, declared.
 *
 * Declaring them as data rather than as a function that calls twenty-two other
 * functions buys three things. The order is inspectable. Each stage states
 * whether it touches the model provider, which is what the per-stage failure
 * policy depends on. And each states what it is permitted to read, so a stage
 * that quietly starts reading something else is a visible change rather than
 * an invisible one.
 *
 * Stages marked `implemented: false` are specified and not built. That flag is
 * honest rather than aspirational: it is read by the runner, which refuses to
 * claim a result for a stage that does not exist.
 */
import { CapabilityKey } from '../providers/capabilities';

export type StageId =
  | 'oauth_connect'
  | 'account_register'
  | 'folder_select'
  | 'incremental_sync'
  | 'normalise'
  | 'thread_reconstruct'
  | 'quoted_history_reduce'
  | 'attachment_metadata'
  | 'attachment_process'
  | 'ai_safety_preprocess'
  | 'classify'
  | 'priority_score'
  | 'summarise'
  | 'extract_actions'
  | 'extract_deadlines'
  | 'extract_decisions'
  | 'extract_commitments'
  | 'extract_questions'
  | 'security_screen'
  | 'draft_generate'
  | 'aggregate'
  | 'audit_log';

export type StageKind =
  /** Runs against the provider. Subject to rate limits and outages. */
  | 'provider'
  /** Pure computation on data already held. Cannot fail for external reasons. */
  | 'local'
  /** Calls the model. Subject to analysis failure and must validate its output. */
  | 'model';

export interface StageDefinition {
  id: StageId;
  order: number;
  label: string;
  kind: StageKind;
  /** What it does, in one sentence. */
  description: string;
  /** Capabilities it requires. Checked before it runs. */
  requires: readonly CapabilityKey[];
  /** True when a failure here stops the run; false when the run continues. */
  fatal: boolean;
  /** Whether this stage exists in code today. */
  implemented: boolean;
  /** For an unimplemented stage, what would be needed. */
  notes?: string;
}

export const PIPELINE: readonly StageDefinition[] = [
  {
    id: 'oauth_connect',
    order: 1,
    label: 'Secure OAuth connection',
    kind: 'provider',
    description: 'Authorisation code flow with PKCE, least-privilege scopes, tokens written straight to the token store.',
    requires: [],
    fatal: true,
    implemented: false,
    notes:
      'Scope declarations, justification and the forbidden-scope guard are built and tested. The flow itself needs a registered application at each provider and a server to hold the client secret, neither of which exists in this environment.',
  },
  {
    id: 'account_register',
    order: 2,
    label: 'Account registration',
    kind: 'local',
    description: 'Record the account, its owned addresses, its type and its capability grants.',
    requires: ['read_profile'],
    fatal: true,
    implemented: true,
  },
  {
    id: 'folder_select',
    order: 3,
    label: 'Folder or label selection',
    kind: 'provider',
    description: 'List folders and record which are analysed. Spam, bin, sent and archive are excluded by default.',
    requires: ['read_labels'],
    fatal: true,
    implemented: true,
  },
  {
    id: 'incremental_sync',
    order: 4,
    label: 'Incremental synchronisation',
    kind: 'provider',
    description: 'Fetch changes since the stored cursor, with backoff, deduplication and a cursor that only advances on a completed run.',
    requires: ['read_messages'],
    fatal: true,
    implemented: true,
  },
  {
    id: 'normalise',
    order: 5,
    label: 'Message normalisation',
    kind: 'local',
    description: 'Provider shape to the module model. HTML reduced to text, remote content stripped, participants resolved against owned addresses.',
    requires: [],
    fatal: true,
    implemented: true,
  },
  {
    id: 'thread_reconstruct',
    order: 6,
    label: 'Thread reconstruction',
    kind: 'local',
    description: 'The nine determinations: latest meaningful message, whether the user replied, answered and unanswered questions, changed deadlines, conflicts, owner, resolution and who is waiting.',
    requires: [],
    fatal: false,
    implemented: true,
  },
  {
    id: 'quoted_history_reduce',
    order: 7,
    label: 'Quoted-history reduction',
    kind: 'local',
    description: 'Split the new text from the quoted history beneath it, conservatively.',
    requires: [],
    fatal: false,
    implemented: true,
  },
  {
    id: 'attachment_metadata',
    order: 8,
    label: 'Attachment metadata extraction',
    kind: 'provider',
    description: 'Names, sizes and types. Never contents.',
    requires: ['read_attachment_metadata'],
    fatal: false,
    implemented: true,
  },
  {
    id: 'attachment_process',
    order: 9,
    label: 'Optional attachment processing',
    kind: 'provider',
    description: 'Read attachment contents, only where the person has turned it on, only within a size limit, only in memory.',
    requires: ['process_attachment_contents'],
    fatal: false,
    implemented: false,
    notes:
      'The capability gate, the size limit and the refusal path are built and tested. Parsing document formats is deliberately not built: every parser is an attack surface, and adding one belongs in its own stage with its own review.',
  },
  {
    id: 'ai_safety_preprocess',
    order: 10,
    label: 'AI safety preprocessing',
    kind: 'local',
    description: 'Wrap content as untrusted data, strip fence markers, scan for injection attempts and record them as observations.',
    requires: [],
    fatal: true,
    implemented: true,
  },
  {
    id: 'classify',
    order: 11,
    label: 'Classification',
    kind: 'model',
    description: 'Category, sensitivity, bulk flag.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'The output contract and its validation are built. The model call needs a provider agreement and a key.',
  },
  {
    id: 'priority_score',
    order: 12,
    label: 'Priority scoring',
    kind: 'local',
    description: 'Eleven weighted factors, escalation rules, and the reasons behind the number.',
    requires: [],
    fatal: false,
    implemented: true,
  },
  {
    id: 'summarise',
    order: 13,
    label: 'Summary generation',
    kind: 'model',
    description: 'One-line summary, why it matters, recommended next step.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'Output contract and validation built; the model call is not.',
  },
  {
    id: 'extract_actions',
    order: 14,
    label: 'Action extraction',
    kind: 'model',
    description: 'Actions with an owner, a date where stated, and a source reference.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'Output contract and validation built; the model call is not.',
  },
  {
    id: 'extract_deadlines',
    order: 15,
    label: 'Deadline extraction',
    kind: 'model',
    description: 'Dates, split into stated and inferred, each with a consequence.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'Output contract and validation built; the model call is not.',
  },
  {
    id: 'extract_decisions',
    order: 16,
    label: 'Decision extraction',
    kind: 'model',
    description: 'Decisions made and decisions still required.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'Output contract and validation built; the model call is not.',
  },
  {
    id: 'extract_commitments',
    order: 17,
    label: 'Commitment extraction',
    kind: 'model',
    description: 'Promises, who made them and whether they are overdue.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'Output contract and validation built; the model call is not.',
  },
  {
    id: 'extract_questions',
    order: 18,
    label: 'Open-question extraction',
    kind: 'model',
    description: 'Questions asked, by whom, and whether answered.',
    requires: [],
    fatal: false,
    implemented: false,
    notes: 'Output contract and validation built; the model call is not.',
  },
  {
    id: 'security_screen',
    order: 19,
    label: 'Risk and security screening',
    kind: 'local',
    description: 'The nine warning categories, plus the injection findings from stage 10.',
    requires: [],
    fatal: false,
    implemented: true,
  },
  {
    id: 'draft_generate',
    order: 20,
    label: 'Reply-draft generation',
    kind: 'model',
    description: 'Three written styles, or a refusal with the reason. Never for a flagged or sensitive thread.',
    requires: [],
    fatal: false,
    implemented: false,
    notes:
      'The withholding rules, the three-style contract and the approval mechanism are built and tested. Generation itself needs the model call.',
  },
  {
    id: 'aggregate',
    order: 21,
    label: 'Dashboard aggregation',
    kind: 'local',
    description: 'Eight counts and five queues, per account.',
    requires: [],
    fatal: false,
    implemented: true,
  },
  {
    id: 'audit_log',
    order: 22,
    label: 'Audit logging',
    kind: 'local',
    description: 'One event per analysis, withheld draft, advisory and correction. Redacted, with no message content.',
    requires: [],
    fatal: false,
    implemented: true,
  },
];

export function stage(id: StageId): StageDefinition {
  const found = PIPELINE.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown stage: ${id}`);
  return found;
}

export const IMPLEMENTED_STAGES = PIPELINE.filter((s) => s.implemented);
export const SPECIFIED_ONLY_STAGES = PIPELINE.filter((s) => !s.implemented);
