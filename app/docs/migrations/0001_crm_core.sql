-- =====================================================================
-- Concludo CRM, migration 0001: tenancy, parties and work.
--
-- Stage 1 settled the tenancy decision and this is it in SQL. Read the
-- reasoning before changing anything here.
--
-- WHY ONE SCOPE COLUMN RATHER THAN THE APPLICATION'S EXISTING TRIPLE.
--
-- The rest of the Workspace scopes rows with a nullable
-- user_id / team_id / organization_id triple and policies that OR the three.
-- That is workable for a project a person owns. It is wrong for a contact
-- record, because a customer belongs to the business and not to whoever
-- happened to be in the meeting. Under the triple, "who can see this person"
-- has no single answer, every CRM query carries a three-branch OR, and a sole
-- trader who later creates a team has orphaned contacts.
--
-- So every CRM table carries crm_workspace_id NOT NULL, referencing one new
-- root table. One workspace per sole trader, per team or per organisation.
-- Membership resolves through one table and one helper function. The
-- sole-trader to team upgrade becomes a membership insert rather than a data
-- migration, and no existing table is touched.
--
-- WHY FORCE ROW LEVEL SECURITY.
--
-- `force row level security` appears nowhere in the application's existing 30
-- migrations, which means a table owner still bypasses every policy. The
-- production build has no API host (the router is Vite dev middleware only and
-- vercel.json rewrites everything to the SPA), so RLS is the only boundary
-- between a browser and customer personal information. Every CRM table is
-- therefore enabled AND forced, in migration 0004.
--
-- Idempotent. Safe to re-run. Verified against PostgreSQL 16.13.
-- =====================================================================

-- ---------------------------------------------------------------- shims
--
-- Supabase supplies auth.uid(). A scratch database used for verification does
-- not, so these create the shape only where it is absent. On a real Supabase
-- project both blocks are no-ops.

create schema if not exists auth;

-- Supabase also supplies the `authenticated`, `anon` and `service_role` roles.
-- A scratch database has none of them, and migration 0004 grants to
-- `authenticated`, so create them where absent. On a real project these are
-- no-ops.
do $$
declare
  r text;
begin
  foreach r in array array['authenticated', 'anon', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I', r);
    end if;
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $f$
      create function auth.uid() returns uuid
      language sql stable
      as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    $f$;
  end if;
end
$$;

-- =====================================================================
-- 1. The workspace: the CRM's tenancy root
-- =====================================================================

create table if not exists public.crm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  -- Which shape of business this workspace is configured for. It changes
  -- which views are shown and which defaults apply. It is deliberately not a
  -- plan or a tier: a sole trader on the Team tier is still a sole trader.
  depth text not null default 'sole_trader'
    check (depth in ('sole_trader', 'small_team', 'mid_market', 'enterprise')),

  -- What this workspace calls a work item. Stage 1 decision 11: one table with
  -- configurable terminology rather than four tables, because four tables means
  -- four pipelines, four permission models and four report sets, which is how
  -- one configurable product becomes four products.
  record_terminology text not null default 'opportunity'
    check (record_terminology in ('opportunity', 'deal', 'job', 'case', 'application')),
  record_terminology_plural text not null default 'Opportunities',

  -- Everything else a workspace renames, as a flat map. A map rather than
  -- columns because the set of renameable nouns will grow and a column per
  -- noun is a migration per noun.
  terminology jsonb not null default '{}'::jsonb,

  -- Where this workspace's rows sit in the application's existing scopes, so a
  -- workspace can be reconciled with a team or an organisation later without
  -- changing any CRM table. Both nullable: a sole trader has neither.
  linked_team_id uuid,
  linked_organization_id uuid,

  -- The boundary. A work workspace never holds personal communication, and a
  -- personal workspace is never linked to a work item. Enforced in 0002.
  workspace_scope text not null default 'work'
    check (workspace_scope in ('work', 'personal')),

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

comment on table public.crm_workspaces is
  'The CRM tenancy root. Every CRM row carries crm_workspace_id referencing this.';

-- ---------------------------------------------------------- membership

create table if not exists public.crm_workspace_members (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  user_id uuid not null,

  -- Authorisation, which is a different question from entitlement.
  -- Entitlement asks "does this plan include it" and stays with
  -- canUseFeature. This asks "may this person do it here".
  crm_role text not null default 'crm_viewer'
    check (crm_role in ('crm_viewer', 'crm_contributor', 'crm_approver', 'crm_admin')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crm_workspace_id, user_id)
);

create index if not exists crm_workspace_members_user_idx
  on public.crm_workspace_members (user_id);

-- ------------------------------------------------------------- helpers
--
-- One helper, used by every policy. `security definer` so it can read the
-- membership table regardless of the caller's own policies, and
-- `set search_path = public` because roughly 100 existing security-definer
-- functions in this application do not set it, which is a search-path
-- injection surface this module does not reproduce.

create or replace function public.crm_is_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crm_workspace_members m
    where m.crm_workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.crm_has_role(p_workspace_id uuid, p_minimum text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Roles are ordered. An approver can do everything a contributor can.
  select exists (
    select 1
    from public.crm_workspace_members m
    where m.crm_workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and case p_minimum
            when 'crm_viewer'      then true
            when 'crm_contributor' then m.crm_role in ('crm_contributor', 'crm_approver', 'crm_admin')
            when 'crm_approver'    then m.crm_role in ('crm_approver', 'crm_admin')
            when 'crm_admin'       then m.crm_role = 'crm_admin'
            else false
          end
  );
$$;

comment on function public.crm_has_role(uuid, text) is
  'Role test used by every write policy. Roles are ordered: admin implies approver implies contributor implies viewer.';

-- The updated_at trigger, applied to every table that has the column.
create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- 2. Organisations, with a hierarchy that cannot form a cycle
-- =====================================================================

create table if not exists public.crm_organisations (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  name text not null,
  legal_name text,
  trading_name text,
  abn text,
  industry text,
  website text,

  -- The hierarchy. Self-referencing, guarded by a trigger below.
  parent_organisation_id uuid references public.crm_organisations(id) on delete set null,
  -- Materialised depth, so a list can show structure without a recursive query
  -- per row. Maintained by the same trigger that guards the cycle.
  hierarchy_depth integer not null default 0,

  -- Ownership is responsibility for work, never a measure of performance.
  owner_user_id uuid,
  relationship_owner_user_id uuid,
  data_quality_owner_user_id uuid,

  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('prospect', 'active', 'dormant', 'closed')),

  renewal_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  constraint crm_organisations_not_own_parent check (parent_organisation_id is null or parent_organisation_id <> id)
);

create index if not exists crm_organisations_workspace_idx
  on public.crm_organisations (crm_workspace_id) where deleted_at is null;
create index if not exists crm_organisations_parent_idx
  on public.crm_organisations (parent_organisation_id);

-- The cycle guard.
--
-- A self-referencing parent column with no guard is one UPDATE away from an
-- infinite recursion in every report that walks the tree. The check constraint
-- above stops the one-row case; this stops A -> B -> A and anything longer,
-- and keeps hierarchy_depth true at the same time.
create or replace function public.crm_guard_organisation_hierarchy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cursor uuid := new.parent_organisation_id;
  v_depth integer := 0;
  v_parent_workspace uuid;
begin
  if new.parent_organisation_id is null then
    new.hierarchy_depth := 0;
    return new;
  end if;

  -- A child may not belong to a different workspace from its parent. Without
  -- this, a hierarchy is a hole straight through tenant isolation.
  select crm_workspace_id into v_parent_workspace
  from public.crm_organisations
  where id = new.parent_organisation_id;

  if v_parent_workspace is null then
    raise exception 'crm_organisations: parent % does not exist', new.parent_organisation_id;
  end if;

  if v_parent_workspace <> new.crm_workspace_id then
    raise exception 'crm_organisations: a parent organisation must be in the same workspace';
  end if;

  while v_cursor is not null loop
    v_depth := v_depth + 1;

    if v_cursor = new.id then
      raise exception 'crm_organisations: that parent would create a cycle';
    end if;

    if v_depth > 12 then
      raise exception 'crm_organisations: hierarchy deeper than 12 levels is refused';
    end if;

    select parent_organisation_id into v_cursor
    from public.crm_organisations
    where id = v_cursor;
  end loop;

  new.hierarchy_depth := v_depth;
  return new;
end;
$$;

drop trigger if exists crm_organisations_hierarchy on public.crm_organisations;
create trigger crm_organisations_hierarchy
  before insert or update of parent_organisation_id, crm_workspace_id
  on public.crm_organisations
  for each row execute function public.crm_guard_organisation_hierarchy();

drop trigger if exists crm_organisations_touch on public.crm_organisations;
create trigger crm_organisations_touch
  before update on public.crm_organisations
  for each row execute function public.crm_touch_updated_at();

-- =====================================================================
-- 3. People
-- =====================================================================

create table if not exists public.crm_people (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  full_name text not null,
  given_name text,
  family_name text,

  -- Nullable on purpose. Many people are captured from a transcript attendee
  -- line with no address at all, and a CRM that will not hold a person without
  -- an email address simply loses them.
  primary_email text,
  secondary_email text,
  phone text,

  -- The work and personal boundary, on the contact details themselves.
  -- A personal address recorded against a work contact is the most common way
  -- a CRM ends up holding information it has no business holding.
  primary_email_scope text not null default 'work'
    check (primary_email_scope in ('work', 'personal', 'unknown')),

  organisation_id uuid references public.crm_organisations(id) on delete set null,
  role_label text,

  owner_user_id uuid,
  relationship_owner_user_id uuid,

  -- A person is never deleted silently by a merge. A merge sets this and keeps
  -- the row, so the merge is reversible and any reference to the old id still
  -- resolves to something.
  merged_into_person_id uuid references public.crm_people(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  constraint crm_people_not_merged_into_self check (merged_into_person_id is null or merged_into_person_id <> id)
);

create index if not exists crm_people_workspace_idx
  on public.crm_people (crm_workspace_id) where deleted_at is null;
create index if not exists crm_people_organisation_idx
  on public.crm_people (organisation_id);
create index if not exists crm_people_email_idx
  on public.crm_people (crm_workspace_id, lower(primary_email)) where primary_email is not null;

drop trigger if exists crm_people_touch on public.crm_people;
create trigger crm_people_touch
  before update on public.crm_people
  for each row execute function public.crm_touch_updated_at();

-- A person belongs to an organisation in the same workspace, or to none.
create or replace function public.crm_guard_same_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_other uuid;
  v_column text := tg_argv[0];
  v_table text := tg_argv[1];
  v_value uuid;
begin
  execute format('select ($1).%I', v_column) into v_value using new;
  if v_value is null then
    return new;
  end if;

  execute format('select crm_workspace_id from public.%I where id = $1', v_table)
    into v_other using v_value;

  if v_other is null then
    raise exception '%: referenced % % does not exist', tg_table_name, v_table, v_value;
  end if;

  if v_other <> new.crm_workspace_id then
    raise exception '%: % must be in the same workspace', tg_table_name, v_column;
  end if;

  return new;
end;
$$;

comment on function public.crm_guard_same_workspace() is
  'Refuses a reference that crosses workspaces. RLS stops a person reading another workspace; this stops a row pointing at one.';

drop trigger if exists crm_people_same_workspace on public.crm_people;
create trigger crm_people_same_workspace
  before insert or update of organisation_id on public.crm_people
  for each row execute function public.crm_guard_same_workspace('organisation_id', 'crm_organisations');

-- ------------------------------------------- a person's roles at an organisation

create table if not exists public.crm_person_organisation_roles (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  person_id uuid not null references public.crm_people(id) on delete cascade,
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,

  role_label text,
  -- How this person relates to a decision, in the account's own terms.
  stakeholder_role text not null default 'unknown'
    check (stakeholder_role in ('decision_maker', 'influencer', 'user', 'gatekeeper', 'blocker', 'unknown')),
  is_primary boolean not null default false,
  started_on date,
  ended_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, organisation_id, role_label)
);

create index if not exists crm_person_org_roles_org_idx
  on public.crm_person_organisation_roles (organisation_id);

-- =====================================================================
-- 4. Relationships between parties
-- =====================================================================

create table if not exists public.crm_relationships (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  from_kind text not null check (from_kind in ('person', 'organisation')),
  from_id uuid not null,
  to_kind text not null check (to_kind in ('person', 'organisation')),
  to_id uuid not null,

  relationship_type text not null
    check (relationship_type in (
      'reports_to', 'works_with', 'introduced_by', 'refers_to',
      'subsidiary_of', 'partner_of', 'former_colleague_of', 'advises'
    )),

  -- Strength is about the business relationship, never about the person.
  -- Describing how well two parties work together is legitimate; scoring a
  -- human being is not, and the line is the difference between a CRM and a
  -- surveillance tool.
  strength text check (strength in ('strong', 'working', 'weak', 'unknown')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  constraint crm_relationships_not_self check (not (from_kind = to_kind and from_id = to_id))
);

create index if not exists crm_relationships_from_idx
  on public.crm_relationships (crm_workspace_id, from_kind, from_id) where deleted_at is null;
create index if not exists crm_relationships_to_idx
  on public.crm_relationships (crm_workspace_id, to_kind, to_id) where deleted_at is null;

-- =====================================================================
-- 5. Leads
-- =====================================================================

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  person_name text,
  organisation_name text,
  email text,
  phone text,
  source text,
  summary text,

  -- What is missing before a decision can be made. A list, not a score.
  -- "Incomplete, and here is which part" is a list a person works through;
  -- a quality grade is a list a person avoids.
  missing_information text[] not null default '{}',

  state text not null default 'awaiting_review'
    check (state in ('awaiting_review', 'in_review', 'converted', 'not_proceeding')),
  not_proceeding_reason text,

  -- Set when converted, so the conversion is traceable in both directions.
  converted_person_id uuid references public.crm_people(id) on delete set null,
  converted_organisation_id uuid references public.crm_organisations(id) on delete set null,
  converted_work_item_id uuid,
  converted_at timestamptz,
  converted_by uuid,

  owner_user_id uuid,
  received_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  -- A lead that is not proceeding says why. Without this the list fills with
  -- rows nobody can tell apart from rows that were never looked at.
  constraint crm_leads_not_proceeding_has_reason
    check (state <> 'not_proceeding' or (not_proceeding_reason is not null and length(trim(not_proceeding_reason)) > 0)),
  constraint crm_leads_converted_has_person
    check (state <> 'converted' or converted_person_id is not null)
);

create index if not exists crm_leads_workspace_state_idx
  on public.crm_leads (crm_workspace_id, state) where deleted_at is null;

-- =====================================================================
-- 6. Pipelines, stages and exit criteria
-- =====================================================================

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  name text not null,
  work_item_type text not null default 'opportunity'
    check (work_item_type in ('opportunity', 'deal', 'job', 'case', 'application')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_pipelines_workspace_idx
  on public.crm_pipelines (crm_workspace_id) where deleted_at is null;

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null,
  stage_order integer not null,
  -- How long a record normally sits here. Used to say "34 days, where 21 is
  -- usual for this stage" rather than flagging a number against a global
  -- target that means nothing.
  typical_days integer not null default 0 check (typical_days >= 0),
  is_closed boolean not null default false,
  closed_disposition text check (closed_disposition in ('won', 'not_proceeding', 'on_hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, stage_order)
);

drop trigger if exists crm_pipeline_stages_same_workspace on public.crm_pipeline_stages;
create trigger crm_pipeline_stages_same_workspace
  before insert or update of pipeline_id on public.crm_pipeline_stages
  for each row execute function public.crm_guard_same_workspace('pipeline_id', 'crm_pipelines');

-- The exit criteria. Written, named and checkable.
create table if not exists public.crm_stage_criteria (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete cascade,

  -- Plain words, because a criterion a person cannot read is a criterion
  -- nobody will meet on purpose.
  description text not null,
  criterion_order integer not null default 0,

  -- Whether leaving the stage without it requires an override reason.
  is_required boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_stage_criteria_stage_idx
  on public.crm_stage_criteria (stage_id);

-- =====================================================================
-- 7. Work items: opportunity, deal, job, case, application
-- =====================================================================

create table if not exists public.crm_work_items (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  title text not null,
  -- The configurable type. One table, because four tables means four
  -- pipelines, four permission models and four report sets.
  work_item_type text not null default 'opportunity'
    check (work_item_type in ('opportunity', 'deal', 'job', 'case', 'application')),

  organisation_id uuid references public.crm_organisations(id) on delete set null,
  primary_person_id uuid references public.crm_people(id) on delete set null,

  pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  entered_stage_at timestamptz not null default now(),

  -- Money, with its basis. A figure the customer stated and a figure worked
  -- out from a seat count are different facts and a CRM that draws them the
  -- same way will have somebody forecast on a guess.
  value_amount numeric(14, 2),
  value_currency text not null default 'AUD',
  value_basis text not null default 'unknown'
    check (value_basis in ('stated', 'inferred', 'calculated', 'unknown')),

  expected_close_date date,

  status text not null default 'open'
    check (status in ('open', 'won', 'not_proceeding', 'on_hold')),
  -- A resolved item must not appear as active. The partial index below is what
  -- the application reads for an open list.
  resolved_at timestamptz,
  resolution_reason text,

  next_step text,
  next_step_due date,

  owner_user_id uuid,
  action_owner_user_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  -- Resolution is recorded, not implied. An item marked won with no date is
  -- the shape that makes a pipeline report wrong six months later.
  constraint crm_work_items_resolution_recorded
    check ((status in ('open', 'on_hold')) = (resolved_at is null)),
  constraint crm_work_items_resolution_has_reason
    check (status <> 'not_proceeding' or (resolution_reason is not null and length(trim(resolution_reason)) > 0))
);

create index if not exists crm_work_items_open_idx
  on public.crm_work_items (crm_workspace_id, stage_id)
  where deleted_at is null and status = 'open';
create index if not exists crm_work_items_org_idx
  on public.crm_work_items (organisation_id) where deleted_at is null;

drop trigger if exists crm_work_items_touch on public.crm_work_items;
create trigger crm_work_items_touch
  before update on public.crm_work_items
  for each row execute function public.crm_touch_updated_at();

drop trigger if exists crm_work_items_same_workspace_org on public.crm_work_items;
create trigger crm_work_items_same_workspace_org
  before insert or update of organisation_id on public.crm_work_items
  for each row execute function public.crm_guard_same_workspace('organisation_id', 'crm_organisations');

drop trigger if exists crm_work_items_same_workspace_pipeline on public.crm_work_items;
create trigger crm_work_items_same_workspace_pipeline
  before insert or update of pipeline_id on public.crm_work_items
  for each row execute function public.crm_guard_same_workspace('pipeline_id', 'crm_pipelines');

-- A stage must belong to the item's own pipeline. Without this, a work item
-- can sit at a stage of a pipeline it is not in, which makes every stage
-- report quietly wrong.
create or replace function public.crm_guard_stage_belongs_to_pipeline()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pipeline uuid;
begin
  select pipeline_id into v_pipeline
  from public.crm_pipeline_stages
  where id = new.stage_id;

  if v_pipeline is null then
    raise exception 'crm_work_items: stage % does not exist', new.stage_id;
  end if;

  if v_pipeline <> new.pipeline_id then
    raise exception 'crm_work_items: that stage belongs to a different pipeline';
  end if;

  return new;
end;
$$;

drop trigger if exists crm_work_items_stage_pipeline on public.crm_work_items;
create trigger crm_work_items_stage_pipeline
  before insert or update of stage_id, pipeline_id on public.crm_work_items
  for each row execute function public.crm_guard_stage_belongs_to_pipeline();

-- ------------------------------------------------- stage history and overrides
--
-- A record must not advance silently. Every move is a row here, and a move
-- that left a required criterion unmet carries the reason. The requirement is
-- an override with a reason, not a block: an authorised person may always
-- proceed, and the CRM records that they did and why.

create table if not exists public.crm_work_item_stage_history (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  work_item_id uuid not null references public.crm_work_items(id) on delete cascade,

  from_stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  to_stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,

  moved_by uuid,
  moved_at timestamptz not null default now(),

  -- Which criteria were met, which were waived, and why.
  criteria_met uuid[] not null default '{}',
  criteria_unmet uuid[] not null default '{}',
  override_reason text,

  constraint crm_stage_history_override_has_reason
    check (cardinality(criteria_unmet) = 0
           or (override_reason is not null and length(trim(override_reason)) >= 10))
);

create index if not exists crm_stage_history_item_idx
  on public.crm_work_item_stage_history (work_item_id, moved_at desc);

comment on constraint crm_stage_history_override_has_reason on public.crm_work_item_stage_history is
  'Advancing past an unmet required criterion is allowed and must carry a reason of at least ten characters. The rule is "do not advance silently", not "do not advance".';
