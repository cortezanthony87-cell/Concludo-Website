/** Saved briefings made by the earlier version are shown read-only and labelled. Nothing is deleted. */
export interface SavedBriefing { id: string; title: string; report_type?: string; created_at: string; content?: { executiveSummary?: string; sections?: Array<{ heading: string; body: string }> } }

export const EARLIER_VERSION_LABEL = 'Made by the earlier version from fixed templates. It is not a record of your work.';

export function sortNewestFirst(rows: SavedBriefing[]): SavedBriefing[] {
  return [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}
