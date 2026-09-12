export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
  retention_policy_days?: number;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id?: string;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  teams?: {
    id: string;
    name: string;
  } | null;
}

export type TeamActivityType =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'decision_saved'
  | 'action_created'
  | 'action_completed'
  | 'action_updated'
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'role_updated'
  | 'ownership_transferred'
  | 'team_renamed';

export interface TeamActivity {
  id: string;
  team_id: string;
  user_id: string;
  actor_name: string | null;
  activity_type: TeamActivityType;
  entity_id?: string | null;
  entity_type?: string | null;
  title: string;
  description?: string | null;
  created_at: string;
}

export interface CreateTeamInput {
  name: string;
}

export interface InviteMemberInput {
  team_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface TeamOverviewStats {
  memberCount: number;
  totalProjects: number;
  totalDecisions: number;
  totalActions: number;
  completedActions: number;
  openActions: number;
  overdueActions: number;
  completionRate: number;
}
