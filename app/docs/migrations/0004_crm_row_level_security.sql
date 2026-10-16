-- =====================================================================
-- Concludo CRM, migration 0004: row level security.
--
-- WHY THIS MIGRATION MATTERS MORE HERE THAN ANYWHERE ELSE IN THE PRODUCT.
--
-- The application's API router exists only as Vite dev middleware
-- (src/server/viteApiPlugin.ts implements configureServer and nothing else),
-- and vercel.json rewrites every path to the SPA. So in production there is no
-- /api host, the one properly enforced permission gate never runs, and pages
-- call Supabase directly from the browser. Row level security is not one of
-- several boundaries around customer personal information. It is the only one.
--
-- Three consequences, all of them deliberate:
--
-- 1. **Every CRM table is ENABLED and FORCED.** `force row level security`
--    appears nowhere in the application's existing 30 migrations, which means
--    a table owner bypasses every policy there. Not here.
-- 2. **Policies are per operation.** No `for all`. A single permissive policy
--    covering select, insert, update and delete is four decisions written as
--    one, and the delete case is always the one that was not thought about.
-- 3. **Writes require a role.** Reading needs membership; creating and editing
--    need crm_contributor; deleting needs crm_admin. Approving is enforced
--    inside crm_decide_proposal rather than by a policy, because it is a state
--    transition rather than a row write.
--
-- The policy set is applied by a loop over an explicit table list. A loop,
-- because forty hand-written blocks is forty chances to leave one out; an
-- explicit list rather than a catalogue scan, because a table that is added
-- later should fail the verification rather than silently inherit a policy
-- nobody chose for it.
--
-- Idempotent. Verified against PostgreSQL 16.13.
-- =====================================================================

-- The tables that take the standard policy set: readable by any member of the
-- workspace, writable by a contributor, deletable by an admin.
do $$
declare
  t text;
  standard_tables text[] := array[
    'crm_organisations',
    'crm_people',
    'crm_person_organisation_roles',
    'crm_relationships',
    'crm_leads',
    'crm_pipelines',
    'crm_pipeline_stages',
    'crm_stage_criteria',
    'crm_work_items',
    'crm_work_item_stage_history',
    'crm_activities',
    'crm_activity_participants',
    'crm_meetings',
    'crm_email_references',
    'crm_notes',
    'crm_tasks',
    'crm_commitments',
    'crm_decisions',
    'crm_products',
    'crm_quotes',
    'crm_quote_lines',
    'crm_order_references',
    'crm_invoice_references',
    'crm_service_cases',
    'crm_account_plans',
    'crm_account_plan_outcomes',
    'crm_attachment_references',
    'crm_tags',
    'crm_record_tags',
    'crm_custom_field_definitions',
    'crm_custom_field_values',
    'crm_custom_object_definitions',
    'crm_custom_object_records',
    'crm_consent_records',
    'crm_communication_preferences',
    'crm_evidence',
    'crm_proposals',
    'crm_duplicate_candidates',
    'crm_record_quality'
  ];
begin
  foreach t in array standard_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using (public.crm_is_member(crm_workspace_id))
    $p$, t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format($p$
      create policy %I on public.%I
        for insert to authenticated
        with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
    $p$, t || '_insert', t);

    -- Both USING and WITH CHECK. Without the WITH CHECK, a contributor can
    -- update a row they can see and move it into a workspace they cannot,
    -- which is tenant isolation defeated by an UPDATE.
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
        with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
    $p$, t || '_update', t);

    -- Hard delete is an admin operation. Everything ordinary goes through soft
    -- delete, which is an UPDATE, so a contributor can remove a record from
    -- view and only an admin can destroy it.
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($p$
      create policy %I on public.%I
        for delete to authenticated
        using (public.crm_has_role(crm_workspace_id, 'crm_admin'))
    $p$, t || '_delete', t);
  end loop;
end
$$;

-- ------------------------------------------------- the workspace itself

alter table public.crm_workspaces enable row level security;
alter table public.crm_workspaces force row level security;

drop policy if exists crm_workspaces_select on public.crm_workspaces;
create policy crm_workspaces_select on public.crm_workspaces
  for select to authenticated
  using (public.crm_is_member(id));

-- Creating a workspace is not a workspace-scoped operation, because there is
-- no workspace to be a member of yet. It is deliberately left to a
-- security-definer function rather than opened by a policy, so the membership
-- row is always created in the same transaction. A workspace with no members
-- is a workspace nobody can see or delete.
drop policy if exists crm_workspaces_update on public.crm_workspaces;
create policy crm_workspaces_update on public.crm_workspaces
  for update to authenticated
  using (public.crm_has_role(id, 'crm_admin'))
  with check (public.crm_has_role(id, 'crm_admin'));

drop policy if exists crm_workspaces_delete on public.crm_workspaces;
create policy crm_workspaces_delete on public.crm_workspaces
  for delete to authenticated
  using (public.crm_has_role(id, 'crm_admin'));

create or replace function public.crm_create_workspace(
  p_name text,
  p_depth text default 'sole_trader',
  p_terminology text default 'opportunity'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'crm_create_workspace: a signed-in user is required';
  end if;

  insert into public.crm_workspaces (name, depth, record_terminology, created_by)
  values (p_name, p_depth, p_terminology, v_user)
  returning id into v_id;

  insert into public.crm_workspace_members (crm_workspace_id, user_id, crm_role)
  values (v_id, v_user, 'crm_admin');

  perform public.crm_record_audit(v_id, 'workspace_created', 'crm_workspaces', v_id,
                                  null, jsonb_build_object('name', p_name));

  return v_id;
end;
$$;

-- -------------------------------------------------------- membership

alter table public.crm_workspace_members enable row level security;
alter table public.crm_workspace_members force row level security;

-- A member can see who else is in their workspace. They cannot see
-- memberships of workspaces they are not in, which is what stops the
-- membership table becoming a directory of every CRM user in the system.
drop policy if exists crm_workspace_members_select on public.crm_workspace_members;
create policy crm_workspace_members_select on public.crm_workspace_members
  for select to authenticated
  using (public.crm_is_member(crm_workspace_id));

drop policy if exists crm_workspace_members_insert on public.crm_workspace_members;
create policy crm_workspace_members_insert on public.crm_workspace_members
  for insert to authenticated
  with check (public.crm_has_role(crm_workspace_id, 'crm_admin'));

drop policy if exists crm_workspace_members_update on public.crm_workspace_members;
create policy crm_workspace_members_update on public.crm_workspace_members
  for update to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'))
  with check (public.crm_has_role(crm_workspace_id, 'crm_admin'));

drop policy if exists crm_workspace_members_delete on public.crm_workspace_members;
create policy crm_workspace_members_delete on public.crm_workspace_members
  for delete to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'));

-- ------------------------------------------------------- approvals

alter table public.crm_approvals enable row level security;
alter table public.crm_approvals force row level security;

drop policy if exists crm_approvals_select on public.crm_approvals;
create policy crm_approvals_select on public.crm_approvals
  for select to authenticated
  using (public.crm_is_member(crm_workspace_id));

-- No insert, update or delete policy at all.
--
-- An approval row is written only by crm_decide_proposal, which is security
-- definer and checks the role itself. A policy that let a client insert an
-- approval directly would let a client approve something without the state
-- transition, which is the whole control.

-- ----------------------------------------------------------- audit

alter table public.crm_audit_events enable row level security;
alter table public.crm_audit_events force row level security;

drop policy if exists crm_audit_events_select on public.crm_audit_events;
create policy crm_audit_events_select on public.crm_audit_events
  for select to authenticated
  using (public.crm_is_member(crm_workspace_id));

-- No insert policy either: audit rows come from crm_record_audit alone. This
-- is the specific defect in the application's existing audit_logs table, whose
-- insert policy is `with check (auth.uid() is not null)` and therefore lets
-- any authenticated user forge an audit row for any organisation. The update
-- and delete triggers in 0003 make the table append only on top of this.

-- ------------------------------------------- retention policy table

create table if not exists public.crm_retention_policies (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  subject_table text not null,
  -- Days after soft deletion before a row may be destroyed.
  retain_deleted_days integer not null default 30 check (retain_deleted_days >= 0),
  -- Days of inactivity after which a live record is offered for review. This
  -- is a prompt, never an automatic deletion: destroying a customer record
  -- because nobody opened it is not a retention policy, it is data loss with a
  -- schedule.
  review_after_inactive_days integer check (review_after_inactive_days is null or review_after_inactive_days > 0),

  -- A hold stops the purge for everything in this workspace, whatever the
  -- days say.
  legal_hold boolean not null default false,
  legal_hold_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crm_workspace_id, subject_table),
  constraint crm_retention_hold_has_reason
    check (not legal_hold or (legal_hold_reason is not null and length(trim(legal_hold_reason)) > 0))
);

alter table public.crm_retention_policies enable row level security;
alter table public.crm_retention_policies force row level security;

drop policy if exists crm_retention_policies_select on public.crm_retention_policies;
create policy crm_retention_policies_select on public.crm_retention_policies
  for select to authenticated
  using (public.crm_is_member(crm_workspace_id));

-- Retention is an admin decision, not a contributor one.
drop policy if exists crm_retention_policies_insert on public.crm_retention_policies;
create policy crm_retention_policies_insert on public.crm_retention_policies
  for insert to authenticated
  with check (public.crm_has_role(crm_workspace_id, 'crm_admin'));

drop policy if exists crm_retention_policies_update on public.crm_retention_policies;
create policy crm_retention_policies_update on public.crm_retention_policies
  for update to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'))
  with check (public.crm_has_role(crm_workspace_id, 'crm_admin'));

drop policy if exists crm_retention_policies_delete on public.crm_retention_policies;
create policy crm_retention_policies_delete on public.crm_retention_policies
  for delete to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'));

-- ------------------------------------------------------------ grants
--
-- RLS decides which rows. Grants decide which tables and which operations are
-- reachable at all, and the two together are what make a mistake in one of
-- them survivable.

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'crm\_%'
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- The three exceptions, narrowed after the loop above.
revoke insert, update, delete on public.crm_audit_events from authenticated;
grant select on public.crm_audit_events to authenticated;

revoke insert, update, delete on public.crm_approvals from authenticated;
grant select on public.crm_approvals to authenticated;

-- Creating a workspace goes through the function, so the table itself takes no
-- insert grant. Without this, a client could create a workspace with no
-- membership row, which nobody could then see, administer or delete.
revoke insert on public.crm_workspaces from authenticated;

grant execute on function public.crm_is_member(uuid) to authenticated;
grant execute on function public.crm_has_role(uuid, text) to authenticated;
grant execute on function public.crm_create_workspace(text, text, text) to authenticated;
grant execute on function public.crm_decide_proposal(uuid, text, text) to authenticated;
grant execute on function public.crm_record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text, text) to authenticated;
grant execute on function public.crm_supersede_evidence(uuid, uuid) to authenticated;
grant execute on function public.crm_record_conflict(uuid, uuid, text) to authenticated;
grant execute on function public.crm_recompute_work_item_quality(uuid) to authenticated;
grant select on public.crm_current_evidence to authenticated;
grant select on public.crm_record_quality_summary to authenticated;
