-- =====================================================================
-- Concludo CRM, migration 0009: the memory read log
--
-- Concludo Pty Ltd. Phase 2B-i.
--
-- Adds one table. It records that somebody read a customer's memory. It adds
-- no table of memory, and that is the most important thing in this file.
--
-- WHY THERE IS NO MEMORY TABLE.
--
-- Memory is derived: every entry the memory page shows is a row that
-- migrations 0001 to 0008 already created. A commitment, a decision, a work
-- item that did not proceed, a service case, a review, a renewal date. Storing
-- a second copy of those, assembled, would create a table that can disagree
-- with the records it came from, and in a release with no job to refresh it
-- the disagreement would start the moment somebody logged a call. A memory
-- layer that is wrong about one promise in fifty is worse than no memory
-- layer, because nobody can tell which one.
--
-- WHY THERE IS A READ LOG.
--
-- Phase 2B-i does not store anything new about a customer. What it changes is
-- how easily one person can assemble all of it: one query now returns a
-- customer's whole relationship history, including what was promised, what
-- went wrong and what somebody recorded about a service failure. That is the
-- largest single change this product makes to its own risk surface, and the
-- proportionate control is not a restriction on reading, because reading the
-- history before a meeting is the job. The control is a record of the read.
--
-- The Australian Privacy Principles do not mandate a read log. What they
-- create is the obligation the log discharges:
--
--   * APP 11.2 requires reasonable steps to protect personal information. For
--     a system that can assemble a complete customer history in one query,
--     knowing which histories were assembled is a reasonable step.
--   * APP 12 gives an individual a right of access to their personal
--     information. A business asked who inside it has looked at a customer's
--     file either has a log or is answering from memory.
--   * The notifiable data breaches scheme gives an entity thirty days to
--     assess whether a breach is likely to result in serious harm. With this
--     log, a compromised account's reach is a list of customers. Without it,
--     every customer in the workspace must be assumed read, and the
--     notification goes to all of them.
--
-- FIVE THINGS IN HERE ARE DECISIONS RATHER THAN PLUMBING.
--
--   1. THERE IS NO SCORE COLUMN, AND THERE CANNOT BE ONE. Block 13, widened
--      again below, fails the deploy if a column shaped like a score appears
--      on any CRM table. A count of reads per person is the most obvious
--      productivity figure in this schema, and the check refuses the column
--      that would hold it.
--
--   2. read_by IS RECORDED AND MAY NOT BE ROLLED UP. The privacy obligation
--      above is about who, so the column exists. It does not follow that the
--      product shows anybody a count of reads per user. Block 15 below fails
--      the deploy if a view appears that groups this table by a user column.
--      A read log surfaced next to somebody's name is staff surveillance
--      wearing a privacy control's clothes, and the behaviour it would change
--      is "read the account history before the meeting".
--
--   3. THE QUERY IS KEPT, THE RESULTS ARE NOT. `query` holds the words
--      somebody searched for, because "who searched for what" is the first
--      question a breach assessment asks. There is no column for what came
--      back, because a log that copied the results would be a second,
--      unprotected copy of the customer information the log exists to
--      protect. `entries_returned` is a count, which is enough to see an
--      unusual read and not enough to reconstruct one.
--
--   4. A READ OF ONE CUSTOMER NAMES THE CUSTOMER. `organisation_id` is null
--      only for a workspace-wide search, enforced by a check rather than by
--      the application remembering.
--
--   5. THE LOG IS APPEND-ONLY TO EVERYBODY WHO CAN WRITE IT. There is no
--      update policy. A log a user can edit is not a log, and the delete
--      policy is admin-only so that retention can still be applied.
--
-- Depends on: 0001 to 0008.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------

create table if not exists public.crm_memory_reads (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  -- Null only for a workspace-wide search. See decision 4.
  organisation_id uuid references public.crm_organisations(id) on delete cascade,

  kind text not null,

  -- The question asked, where one was. Never the answer.
  question text,

  -- The words searched for. See decision 3.
  query text,

  -- A count, not a copy. See decision 3.
  entries_returned integer not null default 0,

  -- The role decides what the read could see, so the role is part of the
  -- record. A read made as a viewer saw less than the same read made as an
  -- administrator, and a breach assessment needs to know which.
  read_as text not null,

  -- See decision 2. Recorded, never grouped by.
  read_by uuid not null,
  read_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint crm_memory_reads_kind_check
    check (kind in ('explorer', 'search')),

  constraint crm_memory_reads_role_check
    check (read_as in ('crm_viewer', 'crm_contributor', 'crm_approver', 'crm_admin')),

  constraint crm_memory_reads_count_check
    check (entries_returned >= 0),

  -- Decision 4. A read of one customer says which customer; only a search
  -- covers the whole workspace.
  constraint crm_memory_reads_subject_check
    check (organisation_id is not null or kind = 'search'),

  -- A search without the words it searched for is a row that cannot answer
  -- the question the log exists to answer.
  constraint crm_memory_reads_query_check
    check (kind <> 'search' or query is not null)
);

comment on table public.crm_memory_reads is
  'That somebody read a customer memory. Not the memory, which is derived '
  'from records that already exist in this schema.';

comment on column public.crm_memory_reads.read_by is
  'Who read it. Recorded because APP 12 and the notifiable data breaches '
  'scheme ask who. Never grouped by, and block 15 fails the deploy if a view '
  'does.';

comment on column public.crm_memory_reads.entries_returned is
  'How much came back, as a count. Deliberately not a copy of what came '
  'back: a log of the results would be a second unprotected copy of the '
  'information the log exists to protect.';

comment on column public.crm_memory_reads.read_as is
  'The role the read was made under, because the role decided what it could '
  'see.';

-- The query a privacy assessment runs: what was read about this customer.
create index if not exists crm_memory_reads_organisation_idx
  on public.crm_memory_reads (crm_workspace_id, organisation_id, read_at desc);

-- The query an unusual-access review runs: everything read in a window.
create index if not exists crm_memory_reads_window_idx
  on public.crm_memory_reads (crm_workspace_id, read_at desc);

-- Searches only, which are the reads with the widest reach.
create index if not exists crm_memory_reads_search_idx
  on public.crm_memory_reads (crm_workspace_id, read_at desc)
  where kind = 'search';

-- ---------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------

alter table public.crm_memory_reads enable row level security;
alter table public.crm_memory_reads force row level security;

-- Reading the log needs the approver role, not the viewer role. The log is
-- about people as well as customers, so it is not ordinary workspace reading.
drop policy if exists crm_memory_reads_select on public.crm_memory_reads;
create policy crm_memory_reads_select on public.crm_memory_reads
  for select to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_approver'));

-- Writing one needs only the viewer role, because reading is what a viewer
-- does and a control that refused to record a viewer's read would record only
-- the reads that mattered least.
drop policy if exists crm_memory_reads_insert on public.crm_memory_reads;
create policy crm_memory_reads_insert on public.crm_memory_reads
  for insert to authenticated
  with check (public.crm_has_role(crm_workspace_id, 'crm_viewer'));

-- Decision 5: there is deliberately NO update policy. With forced row level
-- security and no permissive policy for UPDATE, no authenticated role can
-- amend a row. A log somebody can edit is not a log.

-- Delete is admin only, so a retention policy can still be applied to it.
drop policy if exists crm_memory_reads_delete on public.crm_memory_reads;
create policy crm_memory_reads_delete on public.crm_memory_reads
  for delete to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'));

-- ---------------------------------------------------------------------
-- 3. A read belongs to the workspace it names
-- ---------------------------------------------------------------------

create or replace function public.crm_memory_read_same_workspace()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  org_workspace uuid;
begin
  if new.organisation_id is null then
    return new;
  end if;

  select crm_workspace_id into org_workspace
  from public.crm_organisations
  where id = new.organisation_id;

  if org_workspace is null or org_workspace <> new.crm_workspace_id then
    raise exception
      'A memory read must belong to the same workspace as the organisation it names.';
  end if;

  return new;
end
$$;

drop trigger if exists crm_memory_reads_same_workspace on public.crm_memory_reads;
create trigger crm_memory_reads_same_workspace
  before insert or update on public.crm_memory_reads
  for each row execute function public.crm_memory_read_same_workspace();

-- ---------------------------------------------------------------------
-- 4. Verification
-- ---------------------------------------------------------------------

-- Block 13 (widened again). Phase 2B-i adds the names somebody would reach
-- for when turning a read log into a figure about a person.
do $$
declare
  offending text;
begin
  select string_agg(table_name || '.' || column_name, ', ')
  into offending
  from information_schema.columns
  where table_schema = 'public'
    and table_name like 'crm_%'
    and (
      column_name in (
        'score', 'grade', 'rating',
        'performance_score', 'productivity_score',
        'attention_score', 'health_score', 'engagement_score', 'risk_score',
        'relationship_score', 'weighting', 'weight',
        'reads_per_user', 'read_count_by_user', 'activity_score', 'usage_score'
      )
      or column_name like '%_score'
      or column_name like '%_ranking'
      or column_name like '%_per_user'
    );

  if offending is not null then
    raise exception
      'A score, ranking or per-user column has appeared on a CRM table (%). Concludo counts work, records and relationships, never people.',
      offending;
  end if;
end
$$;

-- Block 15 (new). No view may group the read log by a person. This is the one
-- check that keeps the read log a privacy control rather than a productivity
-- figure: the data is shaped so that the rollup is possible, and only this
-- refuses it.
do $$
declare
  offending text;
begin
  select string_agg(table_name, ', ')
  into offending
  from information_schema.views
  where table_schema = 'public'
    and view_definition ilike '%crm_memory_reads%'
    and (
      view_definition ilike '%group by%read_by%'
      or view_definition ilike '%group by%read_as%'
      or view_definition ilike '%group by%user_id%'
      or view_definition ilike '%count(%) %over (partition by read_by%'
    );

  if offending is not null then
    raise exception
      'A view groups the memory read log by a person (%). The log records who read, so that a customer can be told and a breach can be assessed. It is not a figure about anybody who works here.',
      offending;
  end if;
end
$$;

-- Block 16 (new). No table may appear that stores assembled memory. The
-- check is on the name, which is what somebody adding one would call it.
do $$
declare
  offending text;
begin
  select string_agg(table_name, ', ')
  into offending
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and table_name in (
      'crm_memory',
      'crm_memory_entries',
      'crm_memory_timeline',
      'crm_memory_cache',
      'crm_memory_summaries',
      'crm_memory_embeddings'
    );

  if offending is not null then
    raise exception
      'A table of assembled memory has appeared (%). Memory is derived from records that already exist in this schema, so a stored copy can disagree with them, and with no job to refresh it every row is stale the moment somebody logs a call.',
      offending;
  end if;
end
$$;

-- Block 17 (new). The read log stays append-only: no permissive UPDATE policy
-- may exist on it. Asserted here rather than trusted, because adding one is a
-- single line somebody could write in good faith.
do $$
declare
  offending text;
begin
  select string_agg(policyname, ', ')
  into offending
  from pg_policies
  where schemaname = 'public'
    and tablename = 'crm_memory_reads'
    and cmd in ('UPDATE', 'ALL');

  if offending is not null then
    raise exception
      'An update policy exists on the memory read log (%). A log somebody can amend is not a log.',
      offending;
  end if;
end
$$;

-- =====================================================================
-- End of migration 0009.
--
-- Not in this migration, deliberately:
--
--   * No table of memory. It is derived from records that already exist, and
--     block 16 fails the deploy if one appears.
--   * No copy of what a read returned. A count, and the search words. A log
--     of the results would be a second unprotected copy of the information
--     the log exists to protect.
--   * No update policy on the log, and block 17 fails the deploy if one
--     appears.
--   * No score, no weight, no per-user column, and block 13 fails the deploy
--     if one appears.
--   * No view that groups reads by a person, and block 15 fails the deploy if
--     one appears.
--   * No embedding column and no vector index. Phase 2B-ii may add semantic
--     retrieval, and when it does the answer still has to resolve to a row:
--     the embedding is a better way to FIND the record, never the source of
--     the sentence.
-- =====================================================================
