/**
 * Which workspace the relationship views are looking at.
 *
 * WHY THIS EXISTS AT ALL.
 *
 * Stage 3 built a multi-tenant model: five synthetic workspaces, one tenancy
 * column, row level security over the lot. A Stage 4 view that quietly rendered
 * one of them and never said which would be a lie about the model it sits on,
 * and it would leave the tenancy work untested from the interface side.
 *
 * So the workspace is part of the view state, which means it travels in the
 * query string like every other choice and survives moving between views. It is
 * NOT counted as a filter: a filter narrows what you see inside a workspace,
 * and the workspace is which set of records exists at all. Conflating the two
 * would put "clear filters" one click away from silently changing tenant.
 *
 * The default is the agency, because real estate agencies are the Team tier
 * beachhead and it is the workspace a buyer is most likely to be shown.
 */
import { CrmWorkspaceData } from '../domain';
import { CRM_WORKSPACES } from '../data/workspaces';

export const CRM_DEFAULT_WORKSPACE_ID = 'ws-agency';

export interface WorkspaceChoice {
  id: string;
  name: string;
  /** What shape of business this is, in words rather than an enum. */
  shape: string;
  /** What this workspace calls a work item, plural. */
  recordsPlural: string;
}

const SHAPE_WORDS: Record<string, string> = {
  sole_trader: 'Sole trader',
  small_team: 'Small team',
  mid_market: 'Mid market',
  enterprise: 'Enterprise',
};

export const CRM_WORKSPACE_CHOICES: WorkspaceChoice[] = CRM_WORKSPACES.map((data) => ({
  id: data.workspace.id,
  name: data.workspace.name,
  shape: SHAPE_WORDS[data.workspace.depth] ?? data.workspace.depth,
  recordsPlural: data.workspace.recordTerminologyPlural,
}));

/**
 * The workspace behind an id.
 *
 * An unknown id falls back to the default rather than throwing, because a
 * hand-edited URL or a stale bookmark is a normal thing and should land
 * somewhere useful. It never falls back to "everything", because there is no
 * such thing in a tenanted model.
 */
export function crmWorkspace(id: string | null | undefined): CrmWorkspaceData {
  const found = CRM_WORKSPACES.find((d) => d.workspace.id === id);
  return found ?? CRM_WORKSPACES.find((d) => d.workspace.id === CRM_DEFAULT_WORKSPACE_ID)!;
}

/** What this workspace calls one work item, for a heading or a sentence. */
export function recordWord(data: CrmWorkspaceData, plural = false): string {
  if (plural) return data.workspace.recordTerminologyPlural.toLowerCase();
  return data.workspace.recordTerminology;
}

/** A user id rendered as the name a person would recognise. */
export function personName(data: CrmWorkspaceData, userId: string | null): string | null {
  if (!userId) return null;
  const member = data.members.find((m) => m.userId === userId);
  if (!member) return null;
  // The synthetic ids carry the given name, which is all an owner column needs
  // to show. A real build reads this from the account record.
  const stem = userId.split('-')[1] ?? userId;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}
