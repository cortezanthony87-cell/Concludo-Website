-- =====================================================================
-- Concludo CRM, migration 0006: account planning
--
-- Concludo Pty Ltd. Stage 6.
--
-- Adds the tables behind the account plan, the stakeholder map, the
-- whitespace grid, the joint action plan and the internal account review,
-- plus the columns Stage 6 needs on two existing tables.
--
-- Three things in here are decisions rather than plumbing, and each one is
-- enforced by a constraint rather than left to the application:
--
--   1. ACCOUNT PLANNING IS OFF BY DEFAULT. `account_planning_enabled`
--      defaults to false on every workspace, including every workspace that
--      already exists when this migration runs. A sole trader with eleven
--      customers should never be shown a SWOT.
--
--   2. A BLOCKER NEEDS A NAME AND A SENTENCE. Every other stakeholder role
--      describes a position in a process. `blocker` describes a person as an
--      obstacle, so the check constraint refuses the row unless somebody has
--      confirmed it and written down why.
--
--   3. A JOINT PLAN CANNOT LEAVE THE BUILDING. The approval states stop at
--      'approved_internally'. There is no recipient column, no share token,
--      no external link and no export, because sharing a plan with a customer
--      is an authentication and disclosure design that does not exist yet.
--      When it does, it arrives as its own migration and its own review.
--
-- Depends on: 0001, 0002, 0003, 0004, 0005.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The switch
-- ---------------------------------------------------------------------

alter table public.crm_workspaces
  add column if not exists account_planning_enabled boolean not null default false;

comment on column public.crm_workspaces.account_planning_enabled is
  'Account planning is hidden until a workspace turns it on. Default false, '
  'including for workspaces that existed before Stage 6.';

-- ---------------------------------------------------------------------
-- 2. What the plan itself gained
-- ---------------------------------------------------------------------

alter table public.crm_account_plans
  add column if not exists review_cadence text not null default 'not_set',
  add column if not exists summary text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crm_account_plans_review_cadence_check'
  ) then
    alter table public.crm_account_plans
      add constraint crm_account_plans_review_cadence_check
      check (review_cadence in ('monthly', 'quarterly', 'half_yearly', 'yearly', 'not_set'));
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 3. The stakeholder map
-- ---------------------------------------------------------------------

-- The three roles Stage 6 added. A strategic account plan that cannot tell an
-- economic buyer from an influencer cannot tell you who signs.
alter table public.crm_person_organisation_roles
  drop constraint if exists crm_person_organisation_roles_stakeholder_role_check;

alter table public.crm_person_organisation_roles
  add constraint crm_person_organisation_roles_stakeholder_role_check
  check (stakeholder_role in (
    'decision_maker',
    'economic_buyer',
    'influencer',
    'user',
    'champion',
    'gatekeeper',
    'adviser',
    'blocker',
    'unknown'
  ));

alter table public.crm_person_organisation_roles
  add column if not exists role_confirmed_by uuid,
  add column if not exists role_confirmed_at timestamptz,
  add column if not exists role_evidence text,
  add column if not exists preferred_contact_method text,
  add column if not exists current_objective text,
  add column if not exists relationship_state text not null default 'not_recorded',
  add column if not exists relationship_state_by uuid,
  add column if not exists relationship_state_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crm_person_organisation_roles_relationship_state_check'
  ) then
    alter table public.crm_person_organisation_roles
      add constraint crm_person_organisation_roles_relationship_state_check
      check (relationship_state in ('not_recorded', 'new', 'working_well', 'needs_attention', 'on_hold'));
  end if;

  -- THE BLOCKER RULE, in the database.
  --
  -- Not in a trigger, not in the service layer, not in a code review comment.
  -- Anything that can write a row has to satisfy it, including an import, a
  -- migration written in a hurry and whatever replaces this application.
  if not exists (
    select 1 from pg_constraint where conname = 'crm_person_organisation_roles_blocker_confirmed'
  ) then
    alter table public.crm_person_organisation_roles
      add constraint crm_person_organisation_roles_blocker_confirmed
      check (
        stakeholder_role <> 'blocker'
        or (role_confirmed_by is not null and role_evidence is not null and length(btrim(role_evidence)) > 0)
      );
  end if;

  -- A described relationship carries who described it. Nothing here is
  -- computed, so there is always somebody to ask what they meant.
  if not exists (
    select 1 from pg_constraint where conname = 'crm_person_organisation_roles_state_attributed'
  ) then
    alter table public.crm_person_organisation_roles
      add constraint crm_person_organisation_roles_state_attributed
      check (relationship_state = 'not_recorded' or relationship_state_by is not null);
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 4. The written parts of a plan
-- ---------------------------------------------------------------------

-- One table, a section discriminator, and a sentence. Risks, constraints,
-- competitive position, the four SWOT quadrants, growth opportunities and
-- current value delivered are all the same shape, and giving each its own
-- table means a migration the first time somebody wants an eighth heading.
create table if not exists public.crm_account_plan_entries (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  account_plan_id uuid not null references public.crm_account_plans(id) on delete cascade,
  section text not null check (section in (
    'risk',
    'constraint',
    'competitive_position',
    'swot_strength',
    'swot_weakness',
    'swot_opportunity',
    'swot_threat',
    'growth_opportunity',
    'current_value'
  )),
  body text not null check (length(btrim(body)) > 0),
  evidence_id uuid references public.crm_evidence(id) on delete set null,
  -- A plan entry with no author is a rumour.
  recorded_by uuid not null,
  entry_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_account_plan_entries_plan_idx
  on public.crm_account_plan_entries (account_plan_id, section, entry_order);

create table if not exists public.crm_account_plan_actions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  account_plan_id uuid not null references public.crm_account_plans(id) on delete cascade,
  description text not null check (length(btrim(description)) > 0),
  -- Ownership is responsibility for the work, never a measure of the owner.
  action_owner_user_id uuid,
  due_date date,
  state text not null default 'open' check (state in ('open', 'done', 'no_longer_needed')),
  completed_at timestamptz,
  action_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  constraint crm_account_plan_actions_completion_recorded
    check ((state = 'done') = (completed_at is not null))
);

-- ---------------------------------------------------------------------
-- 5. The whitespace grid
-- ---------------------------------------------------------------------

-- `unknown` is the default and it is a real answer. A grid that renders
-- absence as "no" tells somebody they have asked a question they have never
-- asked, and the first time that is wrong it is wrong in front of a customer.
create table if not exists public.crm_whitespace_cells (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,
  product_id uuid not null references public.crm_products(id) on delete cascade,
  axis text not null check (axis in ('business_unit', 'site', 'region')),
  axis_value text not null check (length(btrim(axis_value)) > 0),
  state text not null default 'unknown'
    check (state in ('unknown', 'in_use', 'potential_need', 'open_opportunity', 'not_relevant')),
  evidence_id uuid references public.crm_evidence(id) on delete set null,
  note text,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  stated_by uuid,
  stated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  -- Anything other than "not known yet" is a claim about the customer's
  -- business, and a claim has a claimant.
  constraint crm_whitespace_cells_stated_by
    check (state = 'unknown' or stated_by is not null),
  unique (organisation_id, product_id, axis, axis_value)
);

create index if not exists crm_whitespace_cells_org_idx
  on public.crm_whitespace_cells (organisation_id, axis, axis_value);

-- ---------------------------------------------------------------------
-- 6. The joint action plan, which stays inside the building
-- ---------------------------------------------------------------------

create table if not exists public.crm_joint_plans (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,
  account_plan_id uuid references public.crm_account_plans(id) on delete set null,
  shared_objective text not null check (length(btrim(shared_objective)) > 0),
  -- THERE IS NO STATE AFTER 'approved_internally'. See the header.
  approval_state text not null default 'draft'
    check (approval_state in ('draft', 'internal_review', 'approved_internally', 'withdrawn')),
  approved_by uuid,
  approved_at timestamptz,
  review_note text,
  plan_owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  constraint crm_joint_plans_approval_recorded
    check ((approval_state = 'approved_internally') = (approved_at is not null)),
  constraint crm_joint_plans_approval_attributed
    check (approval_state <> 'approved_internally' or approved_by is not null)
);

create table if not exists public.crm_joint_plan_actions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  joint_plan_id uuid not null references public.crm_joint_plans(id) on delete cascade,
  description text not null check (length(btrim(description)) > 0),
  -- A joint plan where every action is ours is a to-do list.
  owned_by_us boolean not null default true,
  owner_user_id uuid,
  owner_name text,
  due_date date,
  depends_on_action_ids uuid[] not null default '{}',
  state text not null default 'not_started'
    check (state in ('not_started', 'in_progress', 'done', 'blocked', 'no_longer_needed')),
  evidence_id uuid references public.crm_evidence(id) on delete set null,
  action_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_joint_plan_actions_plan_idx
  on public.crm_joint_plan_actions (joint_plan_id, action_order);

-- ---------------------------------------------------------------------
-- 7. The internal review
-- ---------------------------------------------------------------------

create table if not exists public.crm_account_reviews (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  account_plan_id uuid not null references public.crm_account_plans(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid,
  summary text,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_account_reviews_plan_idx
  on public.crm_account_reviews (account_plan_id, reviewed_at desc);

-- ---------------------------------------------------------------------
-- 8. Row level security, on the same terms as everything else
-- ---------------------------------------------------------------------

do $$
declare
  t text;
  stage6_tables text[] := array[
    'crm_account_plan_entries',
    'crm_account_plan_actions',
    'crm_whitespace_cells',
    'crm_joint_plans',
    'crm_joint_plan_actions',
    'crm_account_reviews'
  ];
begin
  foreach t in array stage6_tables loop
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

    -- Both USING and WITH CHECK, for the same reason as every other table: an
    -- update that can move a row into another workspace is tenant isolation
    -- defeated by an UPDATE.
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
        with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
    $p$, t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format($p$
      create policy %I on public.%I
        for delete to authenticated
        using (public.crm_has_role(crm_workspace_id, 'crm_admin'))
    $p$, t || '_delete', t);
  end loop;
end
$$;

-- Approving a joint plan is an approver's act, not a contributor's, so it gets
-- a policy of its own on top of the standard update policy above. A
-- contributor may write the plan; moving it to approved needs the role that
-- the word implies.
drop policy if exists crm_joint_plans_approve on public.crm_joint_plans;
create policy crm_joint_plans_approve on public.crm_joint_plans
  for update to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_approver'))
  with check (public.crm_has_role(crm_workspace_id, 'crm_approver'));

-- =====================================================================
-- End of migration 0006.
--
-- Not in this migration, deliberately: any column that would let a joint plan
-- reach somebody outside the workspace. No recipient, no share token, no
-- public link, no expiry, no external audit table. Stage 6 previews and
-- approves internally. Sharing is a separate design, a separate review and a
-- separate migration.
-- =====================================================================
