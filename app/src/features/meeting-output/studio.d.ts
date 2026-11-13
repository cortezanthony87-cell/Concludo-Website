import type { MeetingModel, SourceInput, MeetingMetaInput } from '../../lib/intelligence/meetingEngine';

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
  /** Draft meeting record hook: calls Edge Function to obtain model draft or basic fallback. */
  draftMeetingRecord?: (sources: SourceInput[], meta: MeetingMetaInput) => Promise<any>;
  /** Projects for the save dialog. */
  listProjects?: () => Promise<Array<{ id: string; title: string; client?: string | null }>>;
  /** Persist the record. Throw an Error with a readable message on failure. */
  onSave?: (model: MeetingModel, target: SaveTarget, extras: SaveExtras) => Promise<{ projectId: string }>;
  /** Called after a successful save, for example to navigate to the project. */
  onSaved?: (projectId: string) => void;
  /** false hides print and file download buttons (for hosts that block them). Default true. */
  canFile?: boolean;
  /** false locks follow-up email drafts with the Pro/Team upgrade notice. Default true. */
  canDraftEmail?: boolean;
  /** false locks client deck export with the Pro/Team upgrade notice. Default true. */
  canExportDeck?: boolean;
  canUseModelDrafting?: boolean;
  /** Pro and above (feature key action_timeline_export). Default false. */
  canExportTimeline?: boolean;
  /** Written release "release the timeline". Default false. Adds the Action timeline to the full report. */
  timelineReleased?: boolean;
  /** Written release "release the deck". Default false. Adds the Client presentation to the full report. */
  deckReleased?: boolean;
  /** Width over height of the logo image, used by the timeline PowerPoint. */
  logoAspect?: number;
  /** Open straight on the document step with this record. */
  model?: MeetingModel;
  template?: 'full' | 'board' | 'exec' | 'deck' | 'actions' | 'decisions' | 'email';
  viewer?: boolean;
  /** Custom title for Step 1 import view. Default 'Add the meeting'. */
  step1Title?: string;
  /** Custom breadcrumb title for topbar. Default 'Meeting output'. */
  crumbTitle?: string;
  /** Default save mode in modal. Default 'existing' if projects exist else 'new'. */
  defaultSaveMode?: 'existing' | 'new';
}

export function mountMeetingStudio(root: HTMLElement, options?: StudioOptions): () => void;
export function mountMeetingDocument(root: HTMLElement, model: MeetingModel, options?: Pick<StudioOptions, 'logo' | 'logoReversed' | 'template' | 'canFile' | 'canDraftEmail' | 'canExportDeck' | 'canExportTimeline' | 'timelineReleased' | 'deckReleased'>): () => void;
export function exportActionsToCsv(actions: any[]): string;
export function exportStandaloneHtml(model: any): string;
