-- ==============================================================================
-- Concludo Workspace: Team Workspace, Team Administration & Collaboration
-- Tasklet 16: Team Workspace, Team Administration and Multi-User Collaboration
-- ==============================================================================

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  purge_after TIMESTAMPTZ,
  retention_policy_days INTEGER DEFAULT 30
);

-- 2. Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id)
);

-- 3. Create team_invitations table
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ
);

-- 4. Create team_activities table
CREATE TABLE IF NOT EXISTS public.team_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name TEXT,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'project_created',
    'project_updated',
    'project_deleted',
    'decision_saved',
    'action_created',
    'action_completed',
    'action_updated',
    'member_invited',
    'member_joined',
    'member_removed',
    'role_updated',
    'ownership_transferred',
    'team_renamed'
  )),
  entity_id UUID,
  entity_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Add team ownership fields to existing tables
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal' CHECK (ownership_type IN ('personal', 'team')),
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.decision_memory 
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal' CHECK (ownership_type IN ('personal', 'team')),
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.action_tracker 
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal' CHECK (ownership_type IN ('personal', 'team')),
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_name TEXT;

ALTER TABLE public.endpoint_reports 
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal' CHECK (ownership_type IN ('personal', 'team')),
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.generated_intelligence 
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal' CHECK (ownership_type IN ('personal', 'team')),
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_team_member_role(p_team_id UUID, p_user_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- 7. Update can_use_feature RPC to include Team features
CREATE OR REPLACE FUNCTION public.can_use_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_plan TEXT;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  IF v_plan IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin has all features
  IF v_plan = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Team features
  IF p_feature_key IN (
    'team_workspace',
    'team_administration',
    'shared_projects',
    'shared_decisions',
    'shared_actions',
    'shared_insights'
  ) THEN
    RETURN v_plan IN ('team', 'admin');
  END IF;

  -- Pro features
  IF p_feature_key IN (
    'meeting_memory',
    'decision_memory',
    'action_tracker',
    'keyword_search',
    'insight',
    'stats',
    'endpoint_report',
    'automation_export',
    'saved_projects',
    'transcript_archive',
    'manual_outputs',
    'next_best_action',
    'meeting_health_dashboard'
  ) THEN
    RETURN v_plan IN ('pro_trial', 'pro', 'team', 'admin');
  END IF;

  -- Starter features
  IF p_feature_key IN ('json_export') THEN
    RETURN v_plan IN ('starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'admin');
  END IF;

  -- Basic features available on all plans
  IF p_feature_key IN ('workspace_basic', 'core_outputs', 'copy_output') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 8. Team creation enforcement trigger
CREATE OR REPLACE FUNCTION public.check_team_creation_permission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.can_use_feature(NEW.owner_id, 'team_workspace') THEN
    RAISE EXCEPTION 'Feature not available on your plan. Team features require Team or Admin plan.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_team_creation ON public.teams;
CREATE TRIGGER trigger_check_team_creation
  BEFORE INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_team_creation_permission();

-- 9. Auto-sync team_id from project to child decisions and actions
CREATE OR REPLACE FUNCTION public.sync_project_team_context()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ownership TEXT;
  v_team UUID;
BEGIN
  SELECT ownership_type, team_id INTO v_ownership, v_team FROM public.projects WHERE id = NEW.project_id;
  IF v_ownership = 'team' AND v_team IS NOT NULL THEN
    NEW.ownership_type := 'team';
    NEW.team_id := v_team;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_decision_team ON public.decision_memory;
CREATE TRIGGER trigger_sync_decision_team
  BEFORE INSERT ON public.decision_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_team_context();

DROP TRIGGER IF EXISTS trigger_sync_action_team ON public.action_tracker;
CREATE TRIGGER trigger_sync_action_team
  BEFORE INSERT ON public.action_tracker
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_team_context();

-- 10. Enable RLS on new tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activities ENABLE ROW LEVEL SECURITY;

-- 11. Policies for teams
DROP POLICY IF EXISTS teams_select_policy ON public.teams;
CREATE POLICY teams_select_policy ON public.teams
  FOR SELECT USING (
    public.is_team_member(id, auth.uid()) OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS teams_insert_policy ON public.teams;
CREATE POLICY teams_insert_policy ON public.teams
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND public.can_use_feature(auth.uid(), 'team_workspace')
  );

DROP POLICY IF EXISTS teams_update_policy ON public.teams;
CREATE POLICY teams_update_policy ON public.teams
  FOR UPDATE USING (
    public.get_team_member_role(id, auth.uid()) IN ('owner', 'admin')
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    public.get_team_member_role(id, auth.uid()) IN ('owner', 'admin')
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS teams_delete_policy ON public.teams;
CREATE POLICY teams_delete_policy ON public.teams
  FOR DELETE USING (
    owner_id = auth.uid()
  );

-- 12. Policies for team_members
DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
CREATE POLICY team_members_select_policy ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_team_member(team_id, auth.uid())
  );

DROP POLICY IF EXISTS team_members_insert_policy ON public.team_members;
CREATE POLICY team_members_insert_policy ON public.team_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS team_members_update_policy ON public.team_members;
CREATE POLICY team_members_update_policy ON public.team_members
  FOR UPDATE USING (
    public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS team_members_delete_policy ON public.team_members;
CREATE POLICY team_members_delete_policy ON public.team_members
  FOR DELETE USING (
    public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

-- 13. Policies for team_invitations
DROP POLICY IF EXISTS team_invitations_select_policy ON public.team_invitations;
CREATE POLICY team_invitations_select_policy ON public.team_invitations
  FOR SELECT USING (
    public.is_team_member(team_id, auth.uid())
    OR email = lower(auth.jwt() ->> 'email')
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS team_invitations_insert_policy ON public.team_invitations;
CREATE POLICY team_invitations_insert_policy ON public.team_invitations
  FOR INSERT WITH CHECK (
    public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS team_invitations_update_policy ON public.team_invitations;
CREATE POLICY team_invitations_update_policy ON public.team_invitations
  FOR UPDATE USING (
    public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
    OR email = lower(auth.jwt() ->> 'email')
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS team_invitations_delete_policy ON public.team_invitations;
CREATE POLICY team_invitations_delete_policy ON public.team_invitations
  FOR DELETE USING (
    public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
  );

-- 14. Policies for team_activities
DROP POLICY IF EXISTS team_activities_select_policy ON public.team_activities;
CREATE POLICY team_activities_select_policy ON public.team_activities
  FOR SELECT USING (
    public.is_team_member(team_id, auth.uid())
  );

DROP POLICY IF EXISTS team_activities_insert_policy ON public.team_activities;
CREATE POLICY team_activities_insert_policy ON public.team_activities
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND public.is_team_member(team_id, auth.uid())
  );

-- 15. Update projects RLS policies for Team support
DROP POLICY IF EXISTS projects_user_isolation ON public.projects;
DROP POLICY IF EXISTS projects_team_select ON public.projects;
DROP POLICY IF EXISTS projects_team_insert ON public.projects;
DROP POLICY IF EXISTS projects_team_update ON public.projects;
DROP POLICY IF EXISTS projects_team_delete ON public.projects;

CREATE POLICY projects_team_select ON public.projects
  FOR SELECT USING (
    (user_id = auth.uid() AND (ownership_type = 'personal' OR team_id IS NULL))
    OR
    (ownership_type = 'team' AND team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
  );

CREATE POLICY projects_team_insert ON public.projects
  FOR INSERT WITH CHECK (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND user_id = auth.uid() AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin', 'member'))
  );

CREATE POLICY projects_team_update ON public.projects
  FOR UPDATE USING (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin', 'member'))
  );

CREATE POLICY projects_team_delete ON public.projects
  FOR DELETE USING (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin'))
  );

-- 16. Update decision_memory RLS policies for Team support
DROP POLICY IF EXISTS decision_memory_owner_select ON public.decision_memory;
DROP POLICY IF EXISTS decision_memory_owner_insert ON public.decision_memory;
DROP POLICY IF EXISTS decision_memory_owner_update ON public.decision_memory;
DROP POLICY IF EXISTS decision_memory_owner_delete ON public.decision_memory;

CREATE POLICY decision_memory_team_select ON public.decision_memory
  FOR SELECT USING (
    (user_id = auth.uid() AND (ownership_type = 'personal' OR team_id IS NULL))
    OR
    (ownership_type = 'team' AND team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
  );

CREATE POLICY decision_memory_team_insert ON public.decision_memory
  FOR INSERT WITH CHECK (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND user_id = auth.uid() AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin', 'member'))
  );

CREATE POLICY decision_memory_team_update ON public.decision_memory
  FOR UPDATE USING (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin', 'member'))
  );

CREATE POLICY decision_memory_team_delete ON public.decision_memory
  FOR DELETE USING (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin'))
  );

-- 17. Update action_tracker RLS policies for Team support
DROP POLICY IF EXISTS action_tracker_owner_select ON public.action_tracker;
DROP POLICY IF EXISTS action_tracker_owner_insert ON public.action_tracker;
DROP POLICY IF EXISTS action_tracker_owner_update ON public.action_tracker;
DROP POLICY IF EXISTS action_tracker_owner_delete ON public.action_tracker;

CREATE POLICY action_tracker_team_select ON public.action_tracker
  FOR SELECT USING (
    (user_id = auth.uid() AND (ownership_type = 'personal' OR team_id IS NULL))
    OR
    (ownership_type = 'team' AND team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid()))
  );

CREATE POLICY action_tracker_team_insert ON public.action_tracker
  FOR INSERT WITH CHECK (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND user_id = auth.uid() AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin', 'member'))
  );

CREATE POLICY action_tracker_team_update ON public.action_tracker
  FOR UPDATE USING (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND public.is_team_member(team_id, auth.uid()) AND (
      public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin')
      OR assigned_user_id = auth.uid()
      OR user_id = auth.uid()
    ))
  );

CREATE POLICY action_tracker_team_delete ON public.action_tracker
  FOR DELETE USING (
    (ownership_type = 'personal' AND user_id = auth.uid())
    OR
    (ownership_type = 'team' AND public.is_team_member(team_id, auth.uid()) AND public.get_team_member_role(team_id, auth.uid()) IN ('owner', 'admin'))
  );

-- 18. Updated Search RPC with Team Scope Support
CREATE OR REPLACE FUNCTION public.search_meeting_history(
  p_query TEXT,
  p_type_filter TEXT DEFAULT 'all',
  p_meeting_type TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_project_name TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_workspace_scope TEXT DEFAULT 'all',
  p_team_id UUID DEFAULT NULL
)
RETURNS TABLE (
  project_id UUID,
  record_id UUID,
  record_type TEXT,
  project_title TEXT,
  match_field TEXT,
  preview TEXT,
  meeting_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  relevance_score INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pattern TEXT := '%' || lower(p_query) || '%';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH accessible_projects AS (
    SELECT p.id, p.title, p.meeting_type, p.client_name, p.project_name, p.meeting_date,
           p.transcript, p.notes, p.created_at, p.updated_at, p.ownership_type, p.team_id
    FROM public.projects p
    WHERE p.deleted_at IS NULL
      AND (
        -- Personal match
        (p.user_id = v_user_id AND (p.ownership_type = 'personal' OR p.team_id IS NULL) AND (p_workspace_scope IN ('all', 'both', 'personal')))
        OR
        -- Team match
        (p.ownership_type = 'team' AND p.team_id IS NOT NULL AND public.is_team_member(p.team_id, v_user_id) AND (p_workspace_scope IN ('all', 'both', 'team')) AND (p_team_id IS NULL OR p.team_id = p_team_id))
      )
      AND (p_meeting_type IS NULL OR p.meeting_type = p_meeting_type)
      AND (p_client_name IS NULL OR p.client_name ILIKE '%' || p_client_name || '%')
      AND (p_project_name IS NULL OR p.project_name ILIKE '%' || p_project_name || '%')
      AND (p_start_date IS NULL OR p.meeting_date >= p_start_date)
      AND (p_end_date IS NULL OR p.meeting_date <= p_end_date)
  ),
  matched_projects AS (
    SELECT 
      ap.id AS project_id,
      ap.id AS record_id,
      'Project'::TEXT AS record_type,
      ap.title AS project_title,
      CASE 
        WHEN lower(ap.title) LIKE v_pattern THEN 'Title'
        WHEN lower(coalesce(ap.project_name, '')) LIKE v_pattern THEN 'Project Name'
        WHEN lower(coalesce(ap.client_name, '')) LIKE v_pattern THEN 'Client'
        WHEN lower(coalesce(ap.meeting_type, '')) LIKE v_pattern THEN 'Meeting Type'
        WHEN lower(coalesce(ap.transcript, '')) LIKE v_pattern THEN 'Transcript'
        ELSE 'Notes'
      END AS match_field,
      coalesce(substring(ap.transcript FROM 1 FOR 200), ap.notes, ap.title) AS preview,
      ap.meeting_date,
      ap.created_at,
      ap.updated_at,
      100::INTEGER AS relevance_score
    FROM accessible_projects ap
    WHERE (p_type_filter IN ('all', 'projects'))
      AND (
        lower(ap.title) LIKE v_pattern
        OR lower(coalesce(ap.project_name, '')) LIKE v_pattern
        OR lower(coalesce(ap.client_name, '')) LIKE v_pattern
        OR lower(coalesce(ap.meeting_type, '')) LIKE v_pattern
        OR lower(coalesce(ap.transcript, '')) LIKE v_pattern
        OR lower(coalesce(ap.notes, '')) LIKE v_pattern
      )
  ),
  matched_outputs AS (
    SELECT 
      o.project_id,
      o.id AS record_id,
      'Output'::TEXT AS record_type,
      ap.title AS project_title,
      'Saved Output (' || o.output_type || ')' AS match_field,
      substring(o.content FROM 1 FOR 200) AS preview,
      ap.meeting_date,
      o.created_at,
      o.created_at AS updated_at,
      80::INTEGER AS relevance_score
    FROM public.outputs o
    JOIN accessible_projects ap ON ap.id = o.project_id
    WHERE (p_type_filter IN ('all', 'outputs'))
      AND o.deleted_at IS NULL
      AND (lower(o.content) LIKE v_pattern OR lower(o.output_type) LIKE v_pattern)
  ),
  matched_decisions AS (
    SELECT 
      d.project_id,
      d.id AS record_id,
      'Decision'::TEXT AS record_type,
      ap.title AS project_title,
      'Decision: ' || d.decision_title AS match_field,
      coalesce(d.decision_summary, d.decision_reasoning, d.decision_title) AS preview,
      ap.meeting_date,
      d.created_at,
      d.updated_at,
      90::INTEGER AS relevance_score
    FROM public.decision_memory d
    JOIN accessible_projects ap ON ap.id = d.project_id
    WHERE (p_type_filter IN ('all', 'decisions'))
      AND d.deleted_at IS NULL
      AND (
        lower(d.decision_title) LIKE v_pattern
        OR lower(coalesce(d.decision_summary, '')) LIKE v_pattern
        OR lower(coalesce(d.decision_reasoning, '')) LIKE v_pattern
        OR lower(coalesce(d.decision_owner, '')) LIKE v_pattern
      )
  ),
  matched_actions AS (
    SELECT 
      a.project_id,
      a.id AS record_id,
      'Action'::TEXT AS record_type,
      ap.title AS project_title,
      'Action: ' || a.action_title AS match_field,
      coalesce(a.action_description, a.action_title) AS preview,
      ap.meeting_date,
      a.created_at,
      a.updated_at,
      85::INTEGER AS relevance_score
    FROM public.action_tracker a
    JOIN accessible_projects ap ON ap.id = a.project_id
    WHERE (p_type_filter IN ('all', 'actions'))
      AND a.deleted_at IS NULL
      AND (
        lower(a.action_title) LIKE v_pattern
        OR lower(coalesce(a.action_description, '')) LIKE v_pattern
        OR lower(coalesce(a.owner_name, '')) LIKE v_pattern
        OR lower(coalesce(a.assigned_user_name, '')) LIKE v_pattern
        OR lower(a.status) LIKE v_pattern
      )
  )
  SELECT * FROM matched_projects
  UNION ALL
  SELECT * FROM matched_outputs
  UNION ALL
  SELECT * FROM matched_decisions
  UNION ALL
  SELECT * FROM matched_actions
  ORDER BY relevance_score DESC, updated_at DESC;
END;
$$;
