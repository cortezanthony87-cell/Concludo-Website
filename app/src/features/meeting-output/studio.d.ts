import type { MeetingModel, SourceInput } from '../../lib/intelligence/meetingEngine';

export interface SaveTarget {
  mode: 'existing' | 'new';
  projectId?: string;
  title?: string;
  client?: string;
}

export interface SaveExtras {
  sources: SourceInput[];
  markdown: string;
  email: { subject: string; body: string };
}

export interface StudioOptions {
  /** Hide the Concludo lockup and breadcrumb: the Workspace shell already shows them. */
  embedded?: boolean;
  /** Logo paths. Defaults: /brand/Concludo_lockup_horizontal_760w.png and /brand/Concludo_logo_horizontal_reversed_for_dark.png */
  logo?: string;
  logoReversed?: string;
  /** Use the Workspace file parser (pdfjs-dist, mammoth) instead of loading parsers from a CDN. */
  parseFile?: (file: File) => Promise<{ name: string; type: string; text: string }>;
  /** Projects for the save dialog. */
  listProjects?: () => Promise<Array<{ id: string; title: string; client?: string | null }>>;
  /** Persist the record. Throw an Error with a readable message on failure. */
  onSave?: (model: MeetingModel, target: SaveTarget, extras: SaveExtras) => Promise<{ projectId: string }>;
  /** Called after a successful save, for example to navigate to the project. */
  onSaved?: (projectId: string) => void;
  /** false hides print and file download buttons (for hosts that block them). Default true. */
  canFile?: boolean;
  /** Open straight on the document step with this record. */
  model?: MeetingModel;
  template?: 'board' | 'exec' | 'actions' | 'decisions' | 'email';
  viewer?: boolean;
}

export function mountMeetingStudio(root: HTMLElement, options?: StudioOptions): () => void;
export function mountMeetingDocument(root: HTMLElement, model: MeetingModel, options?: Pick<StudioOptions, 'logo' | 'logoReversed' | 'template' | 'canFile'>): () => void;
