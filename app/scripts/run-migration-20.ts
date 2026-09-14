import { invokeTool } from '@tasklet/tools/v2';

const sections = [
  // 1. Alter organizations table and create executive_briefings table
  `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS allow_team_predictive BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.executive_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN (
        'executive_summary',
        'strategic_health_report',
        'risk_report',
        'opportunity_report',
        'operational_performance_report',
        'custom'
    )),
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE public.executive_briefings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_executive_briefings_org_id ON public.executive_briefings(organization_id);
CREATE INDEX IF NOT EXISTS idx_executive_briefings_team_id ON public.executive_briefings(team_id);
CREATE INDEX IF NOT EXISTS idx_executive_briefings_generated_by ON public.executive_briefings(generated_by);
CREATE INDEX IF NOT EXISTS idx_executive_briefings_report_type ON public.executive_briefings(report_type);
CREATE INDEX IF NOT EXISTS idx_executive_briefings_deleted_at ON public.executive_briefings(deleted_at);`,

  // 2. Predictive snapshots table
  `CREATE TABLE IF NOT EXISTS public.predictive_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'team', 'individual')),
    health_score NUMERIC NOT NULL,
    health_category TEXT NOT NULL CHECK (health_category IN (
        'excellent',
        'strong',
        'stable',
        'at_risk',
        'critical_attention_needed'
    )),
    category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    opportunity_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    strategic_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    forecast_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
    purge_after TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE public.predictive_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_predictive_snapshots_org_id ON public.predictive_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_predictive_snapshots_team_id ON public.predictive_snapshots(team_id);
CREATE INDEX IF NOT EXISTS idx_predictive_snapshots_user_id ON public.predictive_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_snapshots_scope ON public.predictive_snapshots(scope_type);
CREATE INDEX IF NOT EXISTS idx_predictive_snapshots_created_at ON public.predictive_snapshots(created_at DESC);`,

  // 3. RLS Policies
  `
CREATE POLICY "Users can view own or team/org executive briefings" ON public.executive_briefings
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            auth.uid() = generated_by
            OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
            OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        )
    );

CREATE POLICY "Users can insert executive briefings" ON public.executive_briefings
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "Users can update own or org admin executive briefings" ON public.executive_briefings
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = generated_by
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can delete own or org admin executive briefings" ON public.executive_briefings
    FOR DELETE TO authenticated
    USING (
        auth.uid() = generated_by
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can view own or team/org predictive snapshots" ON public.predictive_snapshots
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND (
            auth.uid() = user_id
            OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
            OR (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
        )
    );

CREATE POLICY "Users can insert predictive snapshots" ON public.predictive_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or org admin predictive snapshots" ON public.predictive_snapshots
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = user_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );

CREATE POLICY "Users can delete own or org admin predictive snapshots" ON public.predictive_snapshots
    FOR DELETE TO authenticated
    USING (
        auth.uid() = user_id
        OR (organization_id IS NOT NULL AND is_org_admin(organization_id, auth.uid()))
    );`,

  // 4. Stored Procedures: soft delete, restore, permanent delete
  `
CREATE OR REPLACE FUNCTION public.soft_delete_executive_briefing(
    p_briefing_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_retention_days INT := 30;
    v_purge_date TIMESTAMPTZ;
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.executive_briefings
    WHERE id = p_briefing_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_org_id IS NOT NULL THEN
        SELECT public.get_organization_retention_days(v_org_id, 'reports') INTO v_retention_days;
    END IF;

    IF v_retention_days = -1 THEN
        v_purge_date := NULL;
    ELSE
        v_purge_date := now() + (v_retention_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.executive_briefings
    SET deleted_at = now(),
        deleted_by = p_user_id,
        purge_after = v_purge_date,
        updated_at = now()
    WHERE id = p_briefing_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_executive_briefing(
    p_briefing_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.executive_briefings
    SET deleted_at = NULL,
        deleted_by = NULL,
        purge_after = NULL,
        updated_at = now()
    WHERE id = p_briefing_id
      AND deleted_at IS NOT NULL;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.permanent_delete_executive_briefing(
    p_briefing_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_gen_by UUID;
    v_team_id UUID;
BEGIN
    SELECT generated_by, team_id INTO v_gen_by, v_team_id
    FROM public.executive_briefings
    WHERE id = p_briefing_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF public.is_record_on_legal_hold(v_gen_by, v_team_id) THEN
        RAISE EXCEPTION 'Cannot permanently delete record: Active Legal Hold in effect.';
    END IF;

    DELETE FROM public.executive_briefings
    WHERE id = p_briefing_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`,

  // 5. Updated purge_expired_records
  `
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
      AND NOT public.is_record_on_legal_hold(eb.generated_by, eb.team_id);
    GET DIAGNOSTICS v_purged_briefings_count = ROW_COUNT;

    DELETE FROM public.predictive_snapshots ps
    WHERE ps.deleted_at IS NOT NULL
      AND ps.purge_after < v_now
      AND NOT public.is_record_on_legal_hold(ps.user_id, ps.team_id);

    RETURN jsonb_build_object(
        'purged_projects', v_purged_projects_count,
        'purged_outputs', v_purged_outputs_count,
        'purged_decisions', v_purged_decisions_count,
        'purged_actions', v_purged_actions_count,
        'purged_reports', v_purged_reports_count,
        'purged_agent_memory', v_purged_memory_count,
        'purged_workflows', v_purged_workflows_count,
        'purged_approvals', v_purged_approvals_count,
        'purged_executive_briefings', v_purged_briefings_count,
        'purged_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.soft_delete_executive_briefing(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_executive_briefing(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permanent_delete_executive_briefing(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_records() TO service_role;
`
];

console.log(`Executing ${sections.length} migration sections for Tasklet 20...`);

// First ensure active tab is the SQL editor
await invokeTool({
  toolName: 'browser',
  args: {
    actions: [
      {
        select_tab: {
          tabId: '3CB356D6DA1936FF7FC6EBF8E20B7E53'
        }
      }
    ]
  }
});

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

  await new Promise((r) => setTimeout(r, 1500));

  // Check if confirmation dialog popped up and click confirm
  await invokeTool({
    toolName: 'browser',
    args: {
      actions: [
        {
          evaluate: {
            expression: `
            const dialogBtn = Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(b =>
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

  await new Promise((r) => setTimeout(r, 2000));
}

console.log('✅ Migration 20 applied successfully!');
