-- Governance migration for permanent workflow templates and user-scoped email actions

CREATE TABLE IF NOT EXISTS public.permanent_workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text DEFAULT 'Permanent Templates',
  applications_required jsonb DEFAULT '[]'::jsonb,
  concludo_services_required jsonb DEFAULT '["Approval Centre", "AI Agents"]'::jsonb,
  approval_required boolean DEFAULT true,
  setup_time_category text DEFAULT '5 mins',
  example_trigger text,
  example_result text,
  definition jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_by_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.permanent_workflow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read permanent templates" ON public.permanent_workflow_templates;
DROP POLICY IF EXISTS "Allow write permanent templates" ON public.permanent_workflow_templates;
DROP POLICY IF EXISTS "Allow owner write permanent templates" ON public.permanent_workflow_templates;
DROP POLICY IF EXISTS "Allow read permanent templates for owner and team" ON public.permanent_workflow_templates;

-- Owner writes: Only Anthony's primary account ('91c086e8-d2d0-4060-9a7c-650e13d2245e') can insert, update, or delete.
CREATE POLICY "Allow owner write permanent templates"
  ON public.permanent_workflow_templates
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = '91c086e8-d2d0-4060-9a7c-650e13d2245e'::uuid
  )
  WITH CHECK (
    auth.uid() = '91c086e8-d2d0-4060-9a7c-650e13d2245e'::uuid
  );

-- Reads: Anthony's account AND members of teams owned by Anthony
CREATE POLICY "Allow read permanent templates for owner and team"
  ON public.permanent_workflow_templates
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = '91c086e8-d2d0-4060-9a7c-650e13d2245e'::uuid
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.teams t ON t.id = tm.team_id
      WHERE tm.user_id = auth.uid()
        AND t.owner_id = '91c086e8-d2d0-4060-9a7c-650e13d2245e'::uuid
    )
  );

-- User-scoped email actions (e.g. Ignore email)
CREATE TABLE IF NOT EXISTS public.user_email_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_email_actions_user_thread_action_unique UNIQUE(user_id, thread_id, action)
);

ALTER TABLE public.user_email_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own email actions" ON public.user_email_actions;

CREATE POLICY "Users manage their own email actions"
  ON public.user_email_actions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
