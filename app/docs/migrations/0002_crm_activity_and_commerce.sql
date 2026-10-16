-- =====================================================================
-- Concludo CRM, migration 0002: activity, commitments and commerce.
--
-- The timeline, the things people promised each other, and the commercial
-- objects. Two rules are carried in the schema rather than in a document.
--
-- THE WORK AND PERSONAL BOUNDARY.
--
-- `crm_email_references.account_scope` marks where a message came from, and a
-- trigger refuses to link a personal-scoped reference to a work item. This is
-- the one place a CRM most easily acquires information it has no business
-- holding: somebody forwards a personal thread into an account record and it
-- is there forever. The boundary is enforced at insert rather than filtered at
-- read, because a filter is one forgotten WHERE clause from failing.
--
-- NOTHING STORES MESSAGE CONTENT.
--
-- An email reference is a pointer: provider, account, thread and message ids,
-- a subject line and a timestamp. No body, no recipients beyond the people
-- already in the CRM, no attachments. Storing the mail is a different product
-- with a different privacy position, and the CRM does not need it to do its
-- job.
--
-- Idempotent. Verified against PostgreSQL 16.13.
-- =====================================================================

-- =====================================================================
-- 1. Activities: one timeline
-- =====================================================================

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  activity_type text not null
    check (activity_type in ('meeting', 'call', 'note', 'email', 'document', 'task_completed', 'stage_change')),

  title text not null,
  summary text,
  occurred_at timestamptz not null,

  organisation_id uuid references public.crm_organisations(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,

  -- Whether this activity counts as meaningful contact for the freshness
  -- measure. A stage change by somebody in the office is activity; it is not
  -- contact with the customer, and treating it as contact is how an account
  -- looks healthy for six months while nobody speaks to anyone.
  is_meaningful_contact boolean not null default true,

  -- True when something was agreed here and nothing has been recorded since.
  follow_through_outstanding boolean not null default false,
  follow_through_reason text,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_activities_workspace_time_idx
  on public.crm_activities (crm_workspace_id, occurred_at desc) where deleted_at is null;
create index if not exists crm_activities_org_idx
  on public.crm_activities (organisation_id, occurred_at desc) where deleted_at is null;
create index if not exists crm_activities_work_item_idx
  on public.crm_activities (work_item_id, occurred_at desc) where deleted_at is null;

drop trigger if exists crm_activities_same_workspace_org on public.crm_activities;
create trigger crm_activities_same_workspace_org
  before insert or update of organisation_id on public.crm_activities
  for each row execute function public.crm_guard_same_workspace('organisation_id', 'crm_organisations');

drop trigger if exists crm_activities_same_workspace_item on public.crm_activities;
create trigger crm_activities_same_workspace_item
  before insert or update of work_item_id on public.crm_activities
  for each row execute function public.crm_guard_same_workspace('work_item_id', 'crm_work_items');

drop trigger if exists crm_activities_touch on public.crm_activities;
create trigger crm_activities_touch
  before update on public.crm_activities
  for each row execute function public.crm_touch_updated_at();

-- Who was there. People, not free text, so an attendee becomes a relationship
-- rather than a string nobody can search.
create table if not exists public.crm_activity_participants (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  activity_id uuid not null references public.crm_activities(id) on delete cascade,
  person_id uuid references public.crm_people(id) on delete cascade,
  -- Where a name was captured but not yet confirmed as a person.
  unresolved_name text,
  participant_role text check (participant_role in ('organiser', 'attendee', 'apology', 'mentioned')),
  created_at timestamptz not null default now(),
  constraint crm_activity_participants_identified
    check (person_id is not null or (unresolved_name is not null and length(trim(unresolved_name)) > 0))
);

create index if not exists crm_activity_participants_activity_idx
  on public.crm_activity_participants (activity_id);

-- ------------------------------------------------------------ meetings
--
-- A meeting is an activity with meeting-specific detail, not a separate
-- timeline. The link to the Workspace's own `projects` row is nullable and
-- unconstrained by a foreign key on purpose: `projects` lives outside the CRM
-- schema and a hard reference would couple the CRM's deletion rules to it.

create table if not exists public.crm_meetings (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  activity_id uuid not null unique references public.crm_activities(id) on delete cascade,

  -- The Workspace project that holds the transcript, where there is one.
  source_project_id uuid,
  meeting_type text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  location text,
  -- Capture agnostic: a recorder, a smart pen, a phone, or a platform
  -- transcript. Concludo is independent of all of them and the column records
  -- what was used, not an endorsement of it.
  capture_method text check (capture_method in
    ('pasted_text', 'uploaded_file', 'recorder', 'smart_pen', 'phone_recording', 'platform_transcript', 'unknown')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------- email references

create table if not exists public.crm_email_references (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  activity_id uuid references public.crm_activities(id) on delete set null,

  provider text not null check (provider in ('microsoft', 'google', 'imap', 'other')),
  -- An opaque identifier for the mailbox, never an address, so the CRM does
  -- not accumulate mailbox addresses it has no use for.
  account_reference text not null,
  thread_reference text not null,
  message_reference text,
  subject text,
  occurred_at timestamptz not null,

  -- The boundary.
  account_scope text not null
    check (account_scope in ('work', 'personal')),

  organisation_id uuid references public.crm_organisations(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  person_id uuid references public.crm_people(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  unique (crm_workspace_id, provider, account_reference, thread_reference, message_reference)
);

create index if not exists crm_email_refs_work_item_idx
  on public.crm_email_references (work_item_id) where deleted_at is null;

-- The enforcement.
create or replace function public.crm_guard_personal_boundary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_workspace_scope text;
begin
  if new.account_scope = 'personal' then
    if new.work_item_id is not null then
      raise exception 'crm_email_references: a personal mailbox reference cannot be linked to a work item';
    end if;
    if new.organisation_id is not null then
      raise exception 'crm_email_references: a personal mailbox reference cannot be linked to an organisation';
    end if;
  end if;

  select workspace_scope into v_workspace_scope
  from public.crm_workspaces
  where id = new.crm_workspace_id;

  if v_workspace_scope = 'work' and new.account_scope = 'personal' then
    raise exception 'crm_email_references: a work workspace does not hold personal mailbox references';
  end if;

  return new;
end;
$$;

comment on function public.crm_guard_personal_boundary() is
  'The work and personal boundary, enforced at write rather than filtered at read. A filter is one forgotten WHERE clause from failing.';

drop trigger if exists crm_email_references_boundary on public.crm_email_references;
create trigger crm_email_references_boundary
  before insert or update on public.crm_email_references
  for each row execute function public.crm_guard_personal_boundary();

-- =====================================================================
-- 2. Notes, tasks, commitments and decisions
-- =====================================================================

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  body text not null,
  organisation_id uuid references public.crm_organisations(id) on delete cascade,
  person_id uuid references public.crm_people(id) on delete cascade,
  work_item_id uuid references public.crm_work_items(id) on delete cascade,
  activity_id uuid references public.crm_activities(id) on delete set null,
  author_user_id uuid,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  constraint crm_notes_attached_to_something
    check (organisation_id is not null or person_id is not null or work_item_id is not null or activity_id is not null)
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  title text not null,
  detail text,
  due_date date,
  state text not null default 'open' check (state in ('open', 'done', 'no_longer_needed')),
  completed_at timestamptz,
  -- Action ownership: responsibility for the work, not a measure of anybody.
  action_owner_user_id uuid,
  organisation_id uuid references public.crm_organisations(id) on delete set null,
  person_id uuid references public.crm_people(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  constraint crm_tasks_completion_recorded check ((state = 'done') = (completed_at is not null))
);

create index if not exists crm_tasks_open_idx
  on public.crm_tasks (crm_workspace_id, due_date) where deleted_at is null and state = 'open';

-- A commitment is what somebody said they would do, in a meeting, with the
-- sentence it came from. Distinct from a task: a task is something you created,
-- a commitment is something that was promised, and the difference matters when
-- you are deciding whether to chase somebody.
create table if not exists public.crm_commitments (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  description text not null,
  -- Who promised it, in their own words where it was said aloud.
  owner_name text not null,
  owner_person_id uuid references public.crm_people(id) on delete set null,
  owner_user_id uuid,
  owned_by_us boolean not null default false,

  due_date date,
  state text not null default 'open' check (state in ('open', 'done', 'no_longer_needed')),
  completed_at timestamptz,

  organisation_id uuid references public.crm_organisations(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  activity_id uuid references public.crm_activities(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  constraint crm_commitments_completion_recorded check ((state = 'done') = (completed_at is not null))
);

create index if not exists crm_commitments_open_idx
  on public.crm_commitments (crm_workspace_id, due_date) where deleted_at is null and state = 'open';

create table if not exists public.crm_decisions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  title text not null,
  summary text,
  reasoning text,
  decided_on date,
  decided_by_name text,
  decided_by_person_id uuid references public.crm_people(id) on delete set null,
  organisation_id uuid references public.crm_organisations(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  activity_id uuid references public.crm_activities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

-- =====================================================================
-- 3. Commerce: products, quotes, and references to systems of record
-- =====================================================================

create table if not exists public.crm_products (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'service' check (kind in ('product', 'service', 'subscription')),
  unit_price numeric(14, 2),
  currency text not null default 'AUD',
  -- Every price in Concludo is indicative until validated with real buyers,
  -- including the ones a customer puts in their own workspace.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create table if not exists public.crm_quotes (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  reference text not null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  organisation_id uuid references public.crm_organisations(id) on delete set null,
  person_id uuid references public.crm_people(id) on delete set null,

  state text not null default 'draft'
    check (state in ('draft', 'sent', 'awaiting_response', 'accepted', 'declined', 'expired', 'withdrawn')),
  sent_on date,
  valid_until date,
  responded_on date,
  decline_reason text,

  subtotal numeric(14, 2),
  total numeric(14, 2),
  currency text not null default 'AUD',

  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  unique (crm_workspace_id, reference),
  constraint crm_quotes_sent_has_date check (state = 'draft' or sent_on is not null),
  constraint crm_quotes_declined_has_reason
    check (state <> 'declined' or (decline_reason is not null and length(trim(decline_reason)) > 0))
);

create table if not exists public.crm_quote_lines (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  product_id uuid references public.crm_products(id) on delete set null,
  description text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  line_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists crm_quote_lines_quote_idx on public.crm_quote_lines (quote_id);

-- Orders and invoices are REFERENCES, not records.
--
-- Concludo is not an accounting system and must not become the place a figure
-- is authored. These rows point at a system of record, cache what was last
-- read, and say when it was read, so the CRM can show invoice status without
-- ever being the source of truth for it.
create table if not exists public.crm_order_references (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  external_system text not null,
  external_id text not null,
  external_url text,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  organisation_id uuid references public.crm_organisations(id) on delete set null,
  cached_status text,
  cached_total numeric(14, 2),
  cached_currency text default 'AUD',
  -- When the cache was read. A figure with no read time is a figure nobody can
  -- tell is six months stale.
  cached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  unique (crm_workspace_id, external_system, external_id)
);

create table if not exists public.crm_invoice_references (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  external_system text not null,
  external_id text not null,
  external_url text,
  organisation_id uuid references public.crm_organisations(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,
  order_reference_id uuid references public.crm_order_references(id) on delete set null,
  cached_status text check (cached_status is null or cached_status in ('draft', 'sent', 'part_paid', 'paid', 'overdue', 'void')),
  cached_amount numeric(14, 2),
  cached_currency text default 'AUD',
  cached_due_date date,
  cached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  unique (crm_workspace_id, external_system, external_id)
);

-- =====================================================================
-- 4. Service cases
-- =====================================================================

create table if not exists public.crm_service_cases (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  title text not null,
  detail text,
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,
  person_id uuid references public.crm_people(id) on delete set null,
  work_item_id uuid references public.crm_work_items(id) on delete set null,

  severity text not null default 'low' check (severity in ('low', 'moderate', 'high')),
  state text not null default 'open'
    check (state in ('open', 'with_customer', 'with_us', 'resolved', 'closed')),
  raised_at timestamptz not null default now(),
  resolved_at timestamptz,

  -- The only reason a service case belongs in a CRM at all: it changes how the
  -- next conversation with that customer should go. A case with no recorded
  -- effect is a help desk ticket in the wrong system.
  relationship_effect text,

  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  constraint crm_service_cases_resolution_recorded
    check ((state in ('resolved', 'closed')) = (resolved_at is not null))
);

create index if not exists crm_service_cases_open_idx
  on public.crm_service_cases (organisation_id) where deleted_at is null and state <> 'closed';

-- =====================================================================
-- 5. Account plans
-- =====================================================================

create table if not exists public.crm_account_plans (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,
  objective text not null,
  review_date date,
  last_reviewed_at timestamptz,
  -- Plan ownership, which is responsibility for keeping the plan current.
  plan_owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  unique (organisation_id)
);

create table if not exists public.crm_account_plan_outcomes (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  account_plan_id uuid not null references public.crm_account_plans(id) on delete cascade,
  label text not null,
  -- An outcome with no measure is an aspiration. The column is NOT NULL so the
  -- distinction cannot be lost by omission.
  measure text not null,
  state text not null default 'not_started'
    check (state in ('not_started', 'on_track', 'needs_attention', 'achieved', 'abandoned')),
  outcome_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 6. Attachments, tags, custom fields and custom objects
-- =====================================================================

-- An attachment is a reference too. The CRM holds no files.
create table if not exists public.crm_attachment_references (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  storage_system text not null,
  storage_path text not null,
  file_name text not null,
  media_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  subject_table text not null,
  subject_id uuid not null,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_attachments_subject_idx
  on public.crm_attachment_references (subject_table, subject_id) where deleted_at is null;

create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  label text not null,
  colour_token text,
  created_at timestamptz not null default now()
);

-- A unique INDEX rather than a unique CONSTRAINT, because a table-level
-- constraint cannot be written over an expression and tag labels have to be
-- unique case-insensitively or a workspace ends up with "Renewal" and
-- "renewal" as two different tags.
create unique index if not exists crm_tags_label_idx
  on public.crm_tags (crm_workspace_id, lower(label));

create table if not exists public.crm_record_tags (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  tag_id uuid not null references public.crm_tags(id) on delete cascade,
  subject_table text not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tag_id, subject_table, subject_id)
);

-- Custom fields: a definition table and a value table.
--
-- Stage 1 decision 4 chose this over a JSONB column per entity. JSONB is
-- faster to build and cannot be queried, reported on or validated, and a CRM's
-- custom fields are exactly what people filter and report by. Note also that no
-- JSONB column anywhere in the existing application has a GIN index.
create table if not exists public.crm_custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  subject_table text not null,
  field_key text not null,
  label text not null,
  field_type text not null
    check (field_type in ('text', 'long_text', 'number', 'currency', 'date', 'boolean', 'single_select', 'multi_select', 'url')),
  options text[] not null default '{}',
  is_required boolean not null default false,
  help_text text,
  field_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  unique (crm_workspace_id, subject_table, field_key),
  constraint crm_custom_field_select_has_options
    check (field_type not in ('single_select', 'multi_select') or cardinality(options) > 0)
);

create table if not exists public.crm_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  definition_id uuid not null references public.crm_custom_field_definitions(id) on delete cascade,
  subject_id uuid not null,
  -- One column per shape rather than one text column, so a date filter is a
  -- date filter and a number sorts as a number.
  value_text text,
  value_number numeric(18, 4),
  value_date date,
  value_boolean boolean,
  value_options text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (definition_id, subject_id)
);

create index if not exists crm_custom_field_values_subject_idx
  on public.crm_custom_field_values (subject_id);

-- Validation against the definition, at write.
create or replace function public.crm_validate_custom_field_value()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d record;
  v_filled integer;
begin
  select * into d from public.crm_custom_field_definitions where id = new.definition_id;
  if d is null then
    raise exception 'crm_custom_field_values: definition % does not exist', new.definition_id;
  end if;

  if d.crm_workspace_id <> new.crm_workspace_id then
    raise exception 'crm_custom_field_values: definition belongs to a different workspace';
  end if;

  -- Exactly one value column may be used, and it must be the one the
  -- definition declares. Two populated columns is a value nobody can read
  -- back reliably.
  v_filled :=
    (case when new.value_text is not null then 1 else 0 end) +
    (case when new.value_number is not null then 1 else 0 end) +
    (case when new.value_date is not null then 1 else 0 end) +
    (case when new.value_boolean is not null then 1 else 0 end) +
    (case when new.value_options is not null then 1 else 0 end);

  if v_filled > 1 then
    raise exception 'crm_custom_field_values: only one value column may be set';
  end if;

  if d.is_required and v_filled = 0 then
    raise exception 'crm_custom_field_values: % is required', d.label;
  end if;

  if v_filled = 1 then
    case d.field_type
      when 'text' then
        if new.value_text is null then raise exception 'crm_custom_field_values: % expects text', d.label; end if;
      when 'long_text' then
        if new.value_text is null then raise exception 'crm_custom_field_values: % expects text', d.label; end if;
      when 'url' then
        if new.value_text is null then raise exception 'crm_custom_field_values: % expects a url', d.label; end if;
      when 'number' then
        if new.value_number is null then raise exception 'crm_custom_field_values: % expects a number', d.label; end if;
      when 'currency' then
        if new.value_number is null then raise exception 'crm_custom_field_values: % expects an amount', d.label; end if;
      when 'date' then
        if new.value_date is null then raise exception 'crm_custom_field_values: % expects a date', d.label; end if;
      when 'boolean' then
        if new.value_boolean is null then raise exception 'crm_custom_field_values: % expects true or false', d.label; end if;
      when 'single_select' then
        if new.value_text is null then raise exception 'crm_custom_field_values: % expects one option', d.label; end if;
        if not (new.value_text = any (d.options)) then
          raise exception 'crm_custom_field_values: "%" is not an option for %', new.value_text, d.label;
        end if;
      when 'multi_select' then
        if new.value_options is null then raise exception 'crm_custom_field_values: % expects options', d.label; end if;
        if exists (select 1 from unnest(new.value_options) o where not (o = any (d.options))) then
          raise exception 'crm_custom_field_values: one or more values are not options for %', d.label;
        end if;
      else
        raise exception 'crm_custom_field_values: unknown field type %', d.field_type;
    end case;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_custom_field_values_validate on public.crm_custom_field_values;
create trigger crm_custom_field_values_validate
  before insert or update on public.crm_custom_field_values
  for each row execute function public.crm_validate_custom_field_value();

-- Custom objects.
--
-- A definition plus a row table with a JSONB payload, which is the opposite
-- choice from custom fields and is deliberate: a custom object is a whole new
-- entity whose shape is unknown at migration time, so there is nothing to make
-- columns out of. Custom fields attach to entities the CRM already knows, and
-- those are what people filter and report by.
create table if not exists public.crm_custom_object_definitions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  object_key text not null,
  label_singular text not null,
  label_plural text not null,
  -- Which existing entity a row of this object hangs off, where it hangs off one.
  attaches_to text check (attaches_to in ('crm_organisations', 'crm_people', 'crm_work_items', 'none')),
  schema_definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,
  unique (crm_workspace_id, object_key)
);

create table if not exists public.crm_custom_object_records (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  definition_id uuid not null references public.crm_custom_object_definitions(id) on delete cascade,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz
);

create index if not exists crm_custom_object_records_definition_idx
  on public.crm_custom_object_records (definition_id) where deleted_at is null;
-- The one GIN index in this schema, because this payload is the one column
-- that genuinely has to be queried by arbitrary key.
create index if not exists crm_custom_object_records_payload_idx
  on public.crm_custom_object_records using gin (payload);

-- =====================================================================
-- 7. Consent and communication preferences
-- =====================================================================

-- Consent is a record with a basis, a time and a source, not a checkbox.
-- Under the Australian Privacy Principles, APP 3 governs collection and APP 5
-- requires notification at or near the time of collection. A CRM that holds a
-- boolean cannot answer either question.
create table if not exists public.crm_consent_records (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  person_id uuid not null references public.crm_people(id) on delete cascade,

  consent_type text not null
    check (consent_type in ('contact', 'marketing', 'recording', 'data_retention', 'third_party_sharing')),
  basis text not null
    check (basis in ('express', 'implied', 'legitimate_interest', 'not_obtained', 'withdrawn')),

  captured_at timestamptz not null default now(),
  captured_from text,
  captured_by uuid,
  expires_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_consent_withdrawn_is_consistent
    check ((basis = 'withdrawn') = (withdrawn_at is not null))
);

create index if not exists crm_consent_person_idx
  on public.crm_consent_records (person_id, consent_type);

create table if not exists public.crm_communication_preferences (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  person_id uuid not null references public.crm_people(id) on delete cascade,

  channel text not null check (channel in ('email', 'phone', 'sms', 'post', 'any')),
  preference text not null default 'open'
    check (preference in ('open', 'limited', 'do_not_contact')),
  -- A do-not-contact with no reason is one somebody will override by accident.
  note text not null default 'No preference recorded.',
  effective_from date,
  effective_until date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, channel)
);
