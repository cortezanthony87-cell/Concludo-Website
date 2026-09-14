import { invokeTool } from '@tasklet/tools/v2';

const sections = [
  // 1. Alter organizations table and create copilot_conversations table
  `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS allow_team_copilot BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.copilot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    session_id TEXT,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user ON public.copilot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_org ON public.copilot_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_team ON public.copilot_conversations(team_id);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_archived ON public.copilot_conversations(is_archived);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_deleted_at ON public.copilot_conversations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_updated ON public.copilot_conversations(updated_at DESC);`,

  // 2. Copilot messages table
  `CREATE TABLE IF NOT EXISTS public.copilot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message TEXT NOT NULL,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_copilot_messages_conv ON public.copilot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_created ON public.copilot_messages(created_at ASC);`,

  // 3. Copilot prompts table (Saved & Shared Prompts)
  `CREATE TABLE IF NOT EXISTS public.copilot_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'decisions', 'projects', 'actions', 'risks', 'executive', 'reports')),
    scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team', 'organization', 'executive', 'role')),
    target_role TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.copilot_prompts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_copilot_prompts_org ON public.copilot_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_copilot_prompts_team ON public.copilot_prompts(team_id);
CREATE INDEX IF NOT EXISTS idx_copilot_prompts_user ON public.copilot_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_prompts_scope ON public.copilot_prompts(scope);
CREATE INDEX IF NOT EXISTS idx_copilot_prompts_deleted_at ON public.copilot_prompts(deleted_at);`,

  // 4. RLS Policies for conversations, messages and prompts
  `
CREATE POLICY "Users can view own or org/team copilot conversations"
ON public.copilot_conversations
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        auth.uid() = user_id
        OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can insert own copilot conversations"
ON public.copilot_conversations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own copilot conversations"
ON public.copilot_conversations
FOR UPDATE TO authenticated
USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can delete own copilot conversations"
ON public.copilot_conversations
FOR DELETE TO authenticated
USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can view messages for accessible conversations"
ON public.copilot_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.copilot_conversations c
        WHERE c.id = copilot_messages.conversation_id
        AND c.deleted_at IS NULL
        AND (
            c.user_id = auth.uid()
            OR (c.team_id IS NOT NULL AND is_team_member(c.team_id, auth.uid()))
            OR (c.organization_id IS NOT NULL AND is_org_member(c.organization_id, auth.uid()))
        )
    )
);

CREATE POLICY "Users can insert messages into accessible conversations"
ON public.copilot_messages
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.copilot_conversations c
        WHERE c.id = copilot_messages.conversation_id
        AND (
            c.user_id = auth.uid()
            OR (c.organization_id IS NOT NULL AND is_org_admin(c.organization_id, auth.uid()))
        )
    )
);

CREATE POLICY "Users can delete messages from own conversations"
ON public.copilot_messages
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.copilot_conversations c
        WHERE c.id = copilot_messages.conversation_id
        AND (
            c.user_id = auth.uid()
            OR (c.organization_id IS NOT NULL AND is_org_admin(c.organization_id, auth.uid()))
        )
    )
);
`,

  // 5. RLS Policies for prompts
  `
CREATE POLICY "Users can view accessible copilot prompts"
ON public.copilot_prompts
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND (
        user_id = auth.uid()
        OR (scope = 'team' AND team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        OR (scope = 'organization' AND organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
        OR (scope = 'executive' AND organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
        OR (scope = 'role' AND organization_id IS NOT NULL AND (
            is_org_admin(organization_id, auth.uid()) OR EXISTS (
                SELECT 1 FROM public.organization_members om
                WHERE om.organization_id = copilot_prompts.organization_id
                AND om.user_id = auth.uid()
                AND om.role = copilot_prompts.target_role
            )
        ))
    )
);

CREATE POLICY "Users can insert personal or authorized copilot prompts"
ON public.copilot_prompts
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND (
        scope = 'personal'
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    )
);

CREATE POLICY "Users can update personal or authorized copilot prompts"
ON public.copilot_prompts
FOR UPDATE TO authenticated
USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);

CREATE POLICY "Users can delete personal or authorized copilot prompts"
ON public.copilot_prompts
FOR DELETE TO authenticated
USING (
    auth.uid() = user_id
    OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
);
`,

  // 6. RPC Functions for soft delete, restore, permanent delete and purge
  `
CREATE OR REPLACE FUNCTION public.soft_delete_copilot_conversation(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.copilot_conversations
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE id = p_conversation_id
      AND deleted_at IS NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_copilot_conversation(
    p_conversation_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.copilot_conversations
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_conversation_id
      AND deleted_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_copilot_conversation(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_conv RECORD;
BEGIN
    SELECT user_id, team_id INTO v_conv
    FROM public.copilot_conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Strict check: Legal Hold must block permanent deletion
    IF public.is_record_on_legal_hold(v_conv.user_id, v_conv.team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete conversation: An active legal hold applies.';
    END IF;

    DELETE FROM public.copilot_conversations
    WHERE id = p_conversation_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.soft_delete_copilot_prompt(
    p_prompt_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.copilot_prompts
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE id = p_prompt_id
      AND deleted_at IS NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_copilot_prompt(
    p_prompt_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.copilot_prompts
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_prompt_id
      AND deleted_at IS NOT NULL;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_copilot_prompt(
    p_prompt_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_prompt RECORD;
BEGIN
    SELECT user_id, team_id INTO v_prompt
    FROM public.copilot_prompts
    WHERE id = p_prompt_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF public.is_record_on_legal_hold(v_prompt.user_id, v_prompt.team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete prompt: An active legal hold applies.';
    END IF;

    DELETE FROM public.copilot_prompts
    WHERE id = p_prompt_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.purge_expired_records()
RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_purged_projects_count INT := 0;
    v_purged_outputs_count INT := 0;
    v_purged_decisions_count INT := 0;
    v_purged_actions_count INT := 0;
    v_purged_reports_count INT := 0;
    v_purged_memory_count INT := 0;
    v_purged_workflows_count INT := 0;
    v_purged_approvals_count INT := 0;
    v_purged_briefings_count INT := 0;
    v_purged_lessons_count INT := 0;
    v_purged_conversations_count INT := 0;
    v_purged_prompts_count INT := 0;
BEGIN
    DELETE FROM public.decision_memory dm
    WHERE dm.deleted_at IS NOT NULL
      AND dm.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(dm.user_id, dm.team_id);
    GET DIAGNOSTICS v_purged_decisions_count = ROW_COUNT;

    DELETE FROM public.action_tracker at
    WHERE at.deleted_at IS NOT NULL
      AND at.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(at.user_id, at.team_id);
    GET DIAGNOSTICS v_purged_actions_count = ROW_COUNT;

    DELETE FROM public.endpoint_reports er
    WHERE er.deleted_at IS NOT NULL
      AND er.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(er.user_id, NULL);
    GET DIAGNOSTICS v_purged_reports_count = ROW_COUNT;

    DELETE FROM public.outputs o
    WHERE o.deleted_at IS NOT NULL
      AND o.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(o.user_id, NULL);
    GET DIAGNOSTICS v_purged_outputs_count = ROW_COUNT;

    DELETE FROM public.projects p
    WHERE p.deleted_at IS NOT NULL
      AND p.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(p.user_id, p.team_id);
    GET DIAGNOSTICS v_purged_projects_count = ROW_COUNT;

    DELETE FROM public.agent_memory am
    WHERE am.deleted_at IS NOT NULL
      AND am.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(am.owner_id, am.team_id);
    GET DIAGNOSTICS v_purged_memory_count = ROW_COUNT;

    DELETE FROM public.workflows wf
    WHERE wf.deleted_at IS NOT NULL
      AND wf.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wf.owner_id, wf.team_id);
    GET DIAGNOSTICS v_purged_workflows_count = ROW_COUNT;

    DELETE FROM public.workflow_approvals wa
    WHERE wa.deleted_at IS NOT NULL
      AND wa.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(wa.requester_id, NULL);
    GET DIAGNOSTICS v_purged_approvals_count = ROW_COUNT;

    DELETE FROM public.executive_briefings eb
    WHERE eb.deleted_at IS NOT NULL
      AND eb.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(eb.generated_by, NULL);
    GET DIAGNOSTICS v_purged_briefings_count = ROW_COUNT;

    DELETE FROM public.lessons_learned ll
    WHERE ll.deleted_at IS NOT NULL
      AND ll.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(ll.created_by, ll.team_id);
    GET DIAGNOSTICS v_purged_lessons_count = ROW_COUNT;

    DELETE FROM public.copilot_conversations cc
    WHERE cc.deleted_at IS NOT NULL
      AND cc.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(cc.user_id, cc.team_id);
    GET DIAGNOSTICS v_purged_conversations_count = ROW_COUNT;

    DELETE FROM public.copilot_prompts cp
    WHERE cp.deleted_at IS NOT NULL
      AND cp.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(cp.user_id, cp.team_id);
    GET DIAGNOSTICS v_purged_prompts_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count,
        'purged_agent_memory', v_purged_memory_count,
        'purged_workflows', v_purged_workflows_count,
        'purged_approvals', v_purged_approvals_count,
        'purged_briefings', v_purged_briefings_count,
        'purged_lessons', v_purged_lessons_count,
        'purged_copilot_conversations', v_purged_conversations_count,
        'purged_copilot_prompts', v_purged_prompts_count,
        'purged_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`
];

async function main() {
  console.log(`Starting execution of ${sections.length} DDL sections via Supabase SQL Editor...`);

  for (let i = 0; i < sections.length; i++) {
    const statement = sections[i];
    console.log(`Executing section ${i + 1}/${sections.length}...`);

    const escaped = JSON.stringify(statement);
    await invokeTool({
      toolName: 'browser',
      args: {
        actions: [
          {
            evaluate: {
              expression: `
              window.monaco.editor.getEditors()[0].setValue(${escaped});
              window.monaco.editor.getEditors()[0].setSelection(new window.monaco.Selection(1, 1, 1, 1));
              'set';
            `,
            },
          },
        ],
      },
    });

    // Click Run button
    await invokeTool({
      toolName: 'browser',
      args: {
        actions: [
          {
            evaluate: {
              expression: `
              const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Run'));
              if (btn) btn.click();
              'clicked_run';
            `,
            },
          },
        ],
      },
    });

    await new Promise((r) => setTimeout(r, 2000));

    // Check if confirmation dialog popped up and click confirm
    await invokeTool({
      toolName: 'browser',
      args: {
        actions: [
          {
            evaluate: {
              expression: `
              const dialogBtn = Array.from(document.querySelectorAll('[role=\"alertdialog\"] button')).find(b =>
                b.innerText.includes('Run') || b.innerText.includes('enable RLS')
              );
              if (dialogBtn) {
                dialogBtn.click();
                'clicked_dialog_btn: ' + dialogBtn.innerText;
              } else {
                'no_dialog';
              }
            `,
            },
          },
        ],
      },
    });

    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log('✅ Migration 22 applied successfully!');
}

main().catch(console.error);
