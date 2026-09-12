import { SupabaseClient } from '@supabase/supabase-js';
import {
  Team,
  TeamMember,
  TeamInvitation,
  TeamActivity,
  TeamRole,
  CreateTeamInput,
  InviteMemberInput,
  TeamOverviewStats,
} from './types';
import { isActionOverdue } from '../actions/types';

export interface TeamQueryResult<T> {
  data: T | null;
  error: Error | null;
}

export type TeamActionPermission =
  | 'view_records'
  | 'create_records'
  | 'update_records'
  | 'invite_members'
  | 'manage_members'
  | 'delete_team'
  | 'transfer_ownership';

/**
 * Check role permissions for a team member:
 * - Owner: Full control, Manage team, Invite members, Remove members, Change roles, Delete team, View all records
 * - Admin: Invite members, Remove members, Change member roles, View all records, Create/update records
 * - Member: View shared records, Create shared records, Update shared records
 * - Viewer: View shared records only
 */
export function hasTeamRolePermission(role: TeamRole, action: TeamActionPermission): boolean {
  switch (role) {
    case 'owner':
      return true;
    case 'admin':
      return action !== 'delete_team' && action !== 'transfer_ownership';
    case 'member':
      return (
        action === 'view_records' ||
        action === 'create_records' ||
        action === 'update_records'
      );
    case 'viewer':
      return action === 'view_records';
    default:
      return false;
  }
}


/**
 * Fetch all active teams the authenticated user belongs to.
 */
export async function fetchUserTeams(
  supabase: SupabaseClient
): Promise<TeamQueryResult<(Team & { currentRole: TeamRole })[]>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Query team_members for the current user
    const { data: memberships, error: memberErr } = await supabase
      .from('team_members')
      .select('team_id, role, teams(*)')
      .eq('user_id', user.id);

    if (memberErr) {
      return { data: null, error: new Error(memberErr.message) };
    }

    const teams: (Team & { currentRole: TeamRole })[] = [];
    for (const m of memberships || []) {
      const t = (m as any).teams;
      if (t && !t.deleted_at) {
        teams.push({
          ...t,
          currentRole: m.role as TeamRole,
        });
      }
    }

    return { data: teams, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch user teams'),
    };
  }
}

/**
 * Fetch a single team by ID, verifying membership.
 */
export async function fetchTeamById(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamQueryResult<Team & { currentRole: TeamRole; memberCount: number }>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .is('deleted_at', null)
      .maybeSingle();

    if (teamErr) return { data: null, error: new Error(teamErr.message) };
    if (!team) return { data: null, error: new Error('Team not found') };

    // Get current user role
    const { data: membership, error: memErr } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memErr) return { data: null, error: new Error(memErr.message) };
    if (!membership) return { data: null, error: new Error('You do not have access to this team') };

    // Get member count
    const { count, error: countErr } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    return {
      data: {
        ...team,
        currentRole: membership.role as TeamRole,
        memberCount: count || 1,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch team'),
    };
  }
}

/**
 * Fetch all members of a team with their profile information.
 */
export async function fetchTeamMembers(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamQueryResult<TeamMember[]>> {
  try {
    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!members || members.length === 0) {
      return { data: [], error: null };
    }

    const userIds = members.map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched = members.map((m: any) => ({
      ...m,
      profiles: profileMap.get(m.user_id) || null,
    }));

    return { data: enriched as TeamMember[], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch team members'),
    };
  }
}

/**
 * Fetch pending invitations for a team.
 */
export async function fetchTeamInvitations(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamQueryResult<TeamInvitation[]>> {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as TeamInvitation[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch team invitations'),
    };
  }
}

/**
 * Fetch pending invitations addressed to the current authenticated user's email.
 */
export async function fetchUserInvitations(
  supabase: SupabaseClient
): Promise<TeamQueryResult<TeamInvitation[]>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user || !user.email) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('team_invitations')
      .select('*, teams(id, name)')
      .eq('email', user.email.toLowerCase().trim())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as TeamInvitation[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch invitations'),
    };
  }
}

/**
 * Fetch team activity feed.
 */
export async function fetchTeamActivities(
  supabase: SupabaseClient,
  teamId: string,
  limit: number = 20
): Promise<TeamQueryResult<TeamActivity[]>> {
  try {
    const { data, error } = await supabase
      .from('team_activities')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as TeamActivity[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch team activities'),
    };
  }
}

/**
 * Create a new team.
 * The creator becomes the owner and the first member.
 */
export async function createTeam(
  supabase: SupabaseClient,
  input: CreateTeamInput
): Promise<TeamQueryResult<Team>> {
  try {
    const trimmedName = input.name ? input.name.trim() : '';
    if (!trimmedName) {
      return { data: null, error: new Error('Team name is required') };
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Insert team
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({
        name: trimmedName,
        owner_id: user.id,
      })
      .select('*')
      .single();

    if (teamErr) {
      return { data: null, error: new Error(teamErr.message) };
    }

    // Add creator as owner in team_members
    const { error: memberErr } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    });

    if (memberErr) {
      return { data: null, error: new Error(memberErr.message) };
    }

    // Log activity
    await logTeamActivity(supabase, team.id, {
      activity_type: 'member_joined',
      title: 'Team created',
      description: `${trimmedName} workspace established by owner`,
    });

    return { data: team as Team, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create team'),
    };
  }
}

/**
 * Rename team.
 */
export async function updateTeam(
  supabase: SupabaseClient,
  teamId: string,
  updates: { name: string }
): Promise<TeamQueryResult<Team>> {
  try {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      return { data: null, error: new Error('Team name cannot be empty') };
    }

    const { data, error } = await supabase
      .from('teams')
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .select('*')
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    await logTeamActivity(supabase, teamId, {
      activity_type: 'team_renamed',
      title: 'Team renamed',
      description: `Workspace name updated to "${trimmedName}"`,
    });

    return { data: data as Team, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update team'),
    };
  }
}

/**
 * Invite a member by email.
 */
export async function inviteMember(
  supabase: SupabaseClient,
  input: InviteMemberInput
): Promise<TeamQueryResult<TeamInvitation>> {
  try {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { data: null, error: new Error('Valid email address is required') };
    }

    // Check if user is already a member
    const { data: existingMembers } = await supabase
      .from('team_members')
      .select('user_id, profiles:user_id(email)')
      .eq('team_id', input.team_id);

    const alreadyMember = existingMembers?.some(
      (m: any) => m.profiles?.email?.toLowerCase() === cleanEmail
    );

    if (alreadyMember) {
      return { data: null, error: new Error('User is already a member of this team') };
    }

    // Create invitation
    const { data: inv, error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: input.team_id,
        email: cleanEmail,
        role: input.role,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    await logTeamActivity(supabase, input.team_id, {
      activity_type: 'member_invited',
      title: 'Member invited',
      description: `Invited ${cleanEmail} as ${input.role}`,
    });

    return { data: inv as TeamInvitation, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to invite member'),
    };
  }
}

/**
 * Accept an invitation.
 */
export async function acceptInvitation(
  supabase: SupabaseClient,
  invitationId: string
): Promise<TeamQueryResult<TeamMember>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Fetch invitation
    const { data: inv, error: invErr } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (invErr || !inv) {
      return { data: null, error: new Error('Invitation not found or expired') };
    }

    if (inv.status !== 'pending') {
      return { data: null, error: new Error(`Invitation is already ${inv.status}`) };
    }

    // Verify email matches
    if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
      return { data: null, error: new Error('Invitation email does not match your account email') };
    }

    // Insert into team_members
    const { data: member, error: memErr } = await supabase
      .from('team_members')
      .insert({
        team_id: inv.team_id,
        user_id: user.id,
        role: inv.role,
        joined_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (memErr) return { data: null, error: new Error(memErr.message) };

    // Mark invitation as accepted
    await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    // Log activity
    await logTeamActivity(supabase, inv.team_id, {
      activity_type: 'member_joined',
      title: 'Member joined',
      description: `${user.email} joined as ${inv.role}`,
    });

    return { data: member as TeamMember, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to accept invitation'),
    };
  }
}

/**
 * Decline an invitation.
 */
export async function declineInvitation(
  supabase: SupabaseClient,
  invitationId: string
): Promise<TeamQueryResult<boolean>> {
  try {
    const { error } = await supabase
      .from('team_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);

    if (error) return { data: null, error: new Error(error.message) };
    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to decline invitation'),
    };
  }
}

/**
 * Remove a member from the team.
 * Owners cannot be removed.
 */
export async function removeMember(
  supabase: SupabaseClient,
  teamId: string,
  memberUserId: string
): Promise<TeamQueryResult<boolean>> {
  try {
    // Check if target is owner
    const { data: targetMem } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', memberUserId)
      .single();

    if (targetMem?.role === 'owner') {
      return { data: null, error: new Error('Team owner cannot be removed. Transfer ownership first.') };
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', memberUserId);

    if (error) return { data: null, error: new Error(error.message) };

    await logTeamActivity(supabase, teamId, {
      activity_type: 'member_removed',
      title: 'Member removed',
      description: 'A member was removed from the workspace',
    });

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to remove member'),
    };
  }
}

/**
 * Update a member's role (admin, member, viewer).
 */
export async function updateMemberRole(
  supabase: SupabaseClient,
  teamId: string,
  memberUserId: string,
  newRole: TeamRole
): Promise<TeamQueryResult<boolean>> {
  try {
    if (newRole === 'owner') {
      return { data: null, error: new Error('Use transferTeamOwnership to change owner') };
    }

    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('user_id', memberUserId);

    if (error) return { data: null, error: new Error(error.message) };

    await logTeamActivity(supabase, teamId, {
      activity_type: 'role_updated',
      title: 'Role updated',
      description: `Member role changed to ${newRole}`,
    });

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update role'),
    };
  }
}

/**
 * Transfer team ownership to another member.
 * The current owner becomes admin, and the new user becomes owner.
 */
export async function transferTeamOwnership(
  supabase: SupabaseClient,
  teamId: string,
  newOwnerUserId: string
): Promise<TeamQueryResult<boolean>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Verify current user is owner
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', teamId)
      .single();

    if (teamErr || team.owner_id !== user.id) {
      return { data: null, error: new Error('Only the team owner can transfer ownership') };
    }

    // 1. Update team owner_id
    const { error: updateTeamErr } = await supabase
      .from('teams')
      .update({ owner_id: newOwnerUserId, updated_at: new Date().toISOString() })
      .eq('id', teamId);

    if (updateTeamErr) return { data: null, error: new Error(updateTeamErr.message) };

    // 2. Set new owner role
    await supabase
      .from('team_members')
      .update({ role: 'owner', updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('user_id', newOwnerUserId);

    // 3. Demote former owner to admin
    await supabase
      .from('team_members')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('user_id', user.id);

    await logTeamActivity(supabase, teamId, {
      activity_type: 'ownership_transferred',
      title: 'Ownership transferred',
      description: 'Workspace ownership transferred to new owner',
    });

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to transfer ownership'),
    };
  }
}

/**
 * Soft-delete a team.
 * Prompt: "Delete Team? This action cannot be undone."
 * Warning: "All team links will be removed. Team-owned records become inaccessible."
 * Uses retention framework (deleted_at, deleted_by, purge_after 30 days).
 */
export async function softDeleteTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamQueryResult<boolean>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    const now = new Date().toISOString();
    const purgeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Soft-delete the team record
    const { error: teamErr } = await supabase
      .from('teams')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        purge_after: purgeDate,
      })
      .eq('id', teamId)
      .eq('owner_id', user.id);

    if (teamErr) return { data: null, error: new Error(teamErr.message) };

    // 2. Soft-delete team-owned projects
    await supabase
      .from('projects')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        purge_after: purgeDate,
      })
      .eq('team_id', teamId)
      .is('deleted_at', null);

    // 3. Soft-delete team decisions
    await supabase
      .from('decision_memory')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        purge_after: purgeDate,
      })
      .eq('team_id', teamId)
      .is('deleted_at', null);

    // 4. Soft-delete team actions
    await supabase
      .from('action_tracker')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        purge_after: purgeDate,
      })
      .eq('team_id', teamId)
      .is('deleted_at', null);

    // 5. Log activity
    await logTeamActivity(supabase, teamId, {
      activity_type: 'project_deleted',
      title: 'Team scheduled for deletion',
      description: 'Workspace and all associated records soft-deleted with 30-day retention',
    });

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete team'),
    };
  }
}

/**
 * Fetch overview statistics for the team dashboard.
 */
export async function fetchTeamOverviewStats(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamQueryResult<TeamOverviewStats>> {
  try {
    // 1. Member count
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    // 2. Projects count
    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .is('deleted_at', null);

    // 3. Decisions count
    const { count: decisionCount } = await supabase
      .from('decision_memory')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .is('deleted_at', null);

    // 4. Actions
    const { data: actions } = await supabase
      .from('action_tracker')
      .select('status, due_date')
      .eq('team_id', teamId)
      .is('deleted_at', null);

    const totalActions = actions?.length || 0;
    let completedActions = 0;
    let openActions = 0;
    let overdueActions = 0;

    for (const a of actions || []) {
      if (a.status === 'completed') {
        completedActions++;
      } else {
        openActions++;
        if (isActionOverdue(a)) {
          overdueActions++;
        }
      }
    }

    const completionRate =
      totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

    return {
      data: {
        memberCount: memberCount || 1,
        totalProjects: projectCount || 0,
        totalDecisions: decisionCount || 0,
        totalActions,
        completedActions,
        openActions,
        overdueActions,
        completionRate,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch team stats'),
    };
  }
}

/**
 * Helper to log team activity.
 */
export async function logTeamActivity(
  supabase: SupabaseClient,
  teamId: string,
  activity: {
    activity_type: TeamActivity['activity_type'];
    title: string;
    description?: string;
    entity_id?: string;
    entity_type?: string;
  }
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Get user full name or email for actor_name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const actorName = profile?.full_name || profile?.email || user.email || 'Team Member';

    await supabase.from('team_activities').insert({
      team_id: teamId,
      user_id: user.id,
      actor_name: actorName,
      activity_type: activity.activity_type,
      title: activity.title,
      description: activity.description || null,
      entity_id: activity.entity_id || null,
      entity_type: activity.entity_type || null,
    });
  } catch {
    // Non-fatal logging error
  }
}
