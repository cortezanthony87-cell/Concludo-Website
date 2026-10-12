/**
 * Email Command Centre, Stage 2 shell contracts.
 *
 * Scope note. These are the types the dashboard shell needs to render. The full
 * thread, message, analysis, draft and audit model is Stage 3 and is deliberately
 * not defined here. Everything below is shaped so the Stage 3 model can replace
 * the synthetic source without changing a component.
 *
 * Concludo proposes; a person disposes. Nothing in this module sends, files,
 * deletes or archives anything.
 */

/** A connected mailbox. Work and personal never merge. */
export type EmailAccountType = 'work' | 'personal';

export interface EmailAccountSummary {
  /** Stable identifier. Synthetic in Stage 2. */
  id: string;
  /** Display label, for example "Work, Concludo". */
  label: string;
  /** Address shown beside the label. Fictional in Stage 2. */
  address: string;
  accountType: EmailAccountType;
  /** ISO-8601. Null when the account has never synchronised. */
  lastSynchronisedAt: string | null;
  /** False until a real mailbox is connected, which is Stage 4. */
  connected: boolean;
}

/** The eight overview metrics. Keys are stable and used in URLs. */
export type EmailMetricKey =
  | 'needs_attention'
  | 'replies_due'
  | 'actions_required'
  | 'deadlines'
  | 'waiting_on_others'
  | 'quick_wins'
  | 'security_review'
  | 'unprocessed';

/** The seven dashboard panels. */
export type EmailPanelKey =
  | 'handle_first'
  | 'todays_workload'
  | 'reply_queue'
  | 'quick_wins'
  | 'waiting_on_others'
  | 'inbox_intelligence'
  | 'security_review';

/** Every asynchronous surface in the module is in exactly one of these states. */
export type AsyncState = 'loading' | 'ready' | 'empty' | 'error';

export interface EmailMetric {
  key: EmailMetricKey;
  /** Short label on the card. */
  label: string;
  /** One sentence saying what the number means. Never a claim about time saved. */
  explanation: string;
  /** Null while loading or on error. Zero is a real value and renders as empty. */
  count: number | null;
  state: AsyncState;
  /** Where the card navigates to. A module path, never an external link. */
  destination: EmailModulePath;
  /** Set when state is 'error'. Shown to the person, so written in plain words. */
  errorMessage?: string;
  /** Raises the card's visual weight. Reserved for security_review. */
  emphasis?: 'standard' | 'attention';
}

/**
 * The eleven module destinations, as path suffixes under /email.
 *
 * Stage 1 settled on ten. Stage 7 adds an eleventh, Clear Backlog, because a
 * backlog session has to be resumable by URL: burying it inside Overview as a
 * mode would mean a paused session could not be reopened from a link, a
 * bookmark or a second device. The change is deliberate and is recorded in the
 * Stage 7 report rather than made quietly.
 */
export type EmailModulePath =
  | '/email'
  | '/email/needs-attention'
  | '/email/reply-queue'
  | '/email/actions-deadlines'
  | '/email/waiting'
  | '/email/quick-wins'
  | '/email/clear-backlog'
  | '/email/all'
  | '/email/drafts'
  | '/email/security-review'
  | '/email/settings';

export interface EmailModuleDestination {
  path: EmailModulePath;
  label: string;
  /** lucide-react icon name. Resolved by the tab component. */
  iconName: string;
  /** Screen reader description where the label alone is not enough. */
  accessibleDescription: string;
}

/** A row in a dashboard panel. Shell-level only; Stage 3 replaces the source. */
export interface EmailPanelItem {
  id: string;
  accountId: string;
  accountType: EmailAccountType;
  sender: string;
  subject: string;
  /** One line. Plain language. */
  summary: string;
  /** 0 to 100. The formula is Stage 3. */
  priorityScore: number;
  priorityBand: 'immediate' | 'today' | 'soon' | 'batch' | 'low';
  /** Two or three short reasons naming a consequence. */
  priorityReasons: string[];
  /** ISO-8601, or null. */
  deadline: string | null;
  /** True only where the thread states a date. Inferred dates are never shown as explicit. */
  deadlineIsExplicit: boolean;
  status:
    | 'waiting_on_user'
    | 'waiting_on_other'
    | 'decision_required'
    | 'action_required'
    | 'information_only'
    | 'resolved'
    | 'security_review'
    | 'unclear';
  /** Whether a reply is recommended. Drafting is Stage 3 and sending is never. */
  replyRecommended: boolean;
}

export interface EmailPanelData {
  key: EmailPanelKey;
  title: string;
  /** One sentence under the title. */
  description: string;
  state: AsyncState;
  /** At most ten rows. A panel is a preview, never the whole queue. */
  items: EmailPanelItem[];
  /**
   * How many threads matched this panel's queue. Usually more than `items`
   * holds, which is why the panel says so and links to the paginated view.
   */
  totalItems: number;
  /** Shown when state is 'empty'. Written as a good outcome, not a failure. */
  emptyMessage: string;
  errorMessage?: string;
  /** Where "View all" goes. */
  destination: EmailModulePath;
}

/** Saved views. Stage 2 ships the eight defaults as read-only. */
export type EmailSavedViewKey =
  | 'morning_review'
  | 'handle_today'
  | 'quick_replies'
  | 'waiting_this_week'
  | 'needs_a_decision'
  | 'needs_an_attachment'
  | 'security_review'
  | 'unprocessed';

export interface EmailSavedView {
  key: EmailSavedViewKey;
  label: string;
  description: string;
}

/** Date range presets for the header control. */
export type EmailDateRange = 'today' | '7d' | '14d' | '30d' | 'all';

/**
 * Everything the person has chosen, in one object. Serialised to the URL so it
 * survives a reload, a back navigation and a shared link.
 */
export interface EmailViewState {
  accountId: string;
  dateRange: EmailDateRange;
  /** Folder or label. 'all' means no folder filter. */
  folder: string;
  search: string;
  savedView: EmailSavedViewKey | null;
  /** Reserved for the filter control. Empty array means no filter. */
  filters: string[];
}

export interface EmailSyncStatus {
  state: 'never' | 'synchronising' | 'synchronised' | 'error';
  /** ISO-8601, or null when never synchronised. */
  lastSynchronisedAt: string | null;
  message: string;
}
