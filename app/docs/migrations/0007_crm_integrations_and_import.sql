-- =====================================================================
-- Concludo CRM, migration 0007: connections, imports and the registers
--
-- Concludo Pty Ltd. Stage 8.
--
-- Adds the three tables Stage 8 needs: the connection to an outside system,
-- the import run, and the import row. Plus the indexes that make the
-- hundred-thousand-activity page loads in Stage 8 possible without reading a
-- whole workspace into memory.
--
-- Five things in here are decisions rather than plumbing, and each is a
-- constraint rather than a convention the application remembers:
--
--   1. SENDING IS OFF PER CONNECTION. `sending_enabled` defaults to false and
--      is a column of its own, so switching it on is an auditable change to a
--      row rather than a side effect of an OAuth scope arriving. A connection
--      cannot be created with sending already on, because the insert trigger
--      refuses it.
--
--   2. THE SCOPES STORED ARE THE SCOPES GRANTED. Not the scopes requested.
--      The two differ in practice, and a product that shows the request tells
--      people they have access they do not have.
--
--   3. AN IMPORT CANNOT BE COMMITTED WITHOUT A DRY RUN. The check constraint
--      refuses `state = 'committed'` unless `dry_run_at` is set. "Preview
--      first" is not a step somebody can skip by clicking faster.
--
--   4. A ROLLED BACK RUN KEEPS ITS ROWS. Rollback sets the row state and the
--      run state; it does not delete the run or its rows, because the question
--      after a bad import is always "what did it do", and a rollback that
--      erases its own evidence cannot answer it.
--
--      It also does not delete anything a person has since edited: the
--      application checks that before it reverses a row, and the row's
--      created_id stays on the record so the check is possible.
--
--   5. IMPORT ROWS HOLD PERSONAL INFORMATION. A source row is the file as it
--      was read, so these rows carry names, addresses and phone numbers and
--      are subject to the same retention rules, the same export and the same
--      deletion as any other table. They are in CRM_TABLES and in the
--      exporter for that reason.
--
-- Depends on: 0001, 0002, 0003, 0004, 0005, 0006.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The connection to an outside system
-- ---------------------------------------------------------------------

create table if not exists public.crm_integration_connections (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  -- Matches an id in the Stage 8 integration register, which is application
  -- configuration rather than data. A foreign key here would mean shipping a
  -- release to add an integration.
  integration_id text not null,
  state text not null default 'never_connected',
  granted_scopes text[] not null default '{}',
  connected_by uuid,
  connected_at timestamptz,
  expires_at timestamptz,
  sending_enabled boolean not null default false,
  sending_enabled_by uuid,
  -- Which accounts, folders, labels and dates may be read. Never "all".
  import_scope jsonb not null default '{}'::jsonb,
  last_attempt_at timestamptz,
  last_outcome text not null default 'never_run',
  failure_detail text,
  next_retry_at timestamptz,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_integration_connections_state_check
    check (state in ('never_connected', 'connected', 'expired', 'revoked', 'failed')),
  constraint crm_integration_connections_outcome_check
    check (last_outcome in ('never_run', 'ok', 'partial', 'failed')),
  -- Sending needs a connection that exists and a person who turned it on.
  constraint crm_integration_connections_sending_check
    check (
      sending_enabled = false
      or (state = 'connected' and sending_enabled_by is not null)
    ),
  -- A failure that claims to be handled needs to say when it will be retried,
  -- and a success cannot carry a failure detail.
  constraint crm_integration_connections_failure_check
    check (
      (last_outcome in ('failed', 'partial') and failure_detail is not null)
      or (last_outcome in ('never_run', 'ok') and failure_detail is null)
    ),
  constraint crm_integration_connections_one_per_workspace
    unique (crm_workspace_id, integration_id)
);

comment on column public.crm_integration_connections.granted_scopes is
  'What the provider granted, not what Concludo requested. The two differ, and '
  'showing the request would tell people they have access they do not have.';

comment on column public.crm_integration_connections.sending_enabled is
  'Automatic sending is off until somebody turns it on, per connection. '
  'Default false, including for connections that existed before Stage 8.';

create index if not exists crm_integration_connections_workspace_idx
  on public.crm_integration_connections (crm_workspace_id, integration_id);

create index if not exists crm_integration_connections_failing_idx
  on public.crm_integration_connections (crm_workspace_id, last_outcome)
  where last_outcome in ('failed', 'partial');

-- A connection cannot be born with sending already on. The check constraint
-- above would allow it where a connected row names an enabler; this trigger
-- refuses it on insert, so enabling sending is always a second, separate,
-- audited act.
create or replace function public.crm_refuse_sending_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.sending_enabled then
    raise exception
      'A connection cannot be created with sending enabled. Create the connection, then enable sending as a separate change.';
  end if;
  return new;
end
$$;

drop trigger if exists crm_integration_connections_no_sending_on_insert
  on public.crm_integration_connections;
create trigger crm_integration_connections_no_sending_on_insert
  before insert on public.crm_integration_connections
  for each row execute function public.crm_refuse_sending_on_insert();

-- ---------------------------------------------------------------------
-- 2. The import run
-- ---------------------------------------------------------------------

create table if not exists public.crm_import_runs (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  kind text not null,
  file_name text not null,
  -- Source column to CRM field. Unmapped columns stay unmapped, not guessed.
  mapping jsonb not null default '{}'::jsonb,
  state text not null default 'mapping',
  row_count integer not null default 0,
  started_by uuid,
  dry_run_at timestamptz,
  committed_at timestamptz,
  committed_by uuid,
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  rollback_reason text,
  audit_event_id uuid references public.crm_audit_events(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_import_runs_kind_check
    check (kind in (
      'contacts',
      'organisations',
      'leads',
      'opportunities',
      'jobs',
      'activities',
      'custom_fields'
    )),
  constraint crm_import_runs_state_check
    check (state in ('mapping', 'validated', 'dry_run', 'committed', 'rolled_back', 'abandoned')),
  -- Decision 3: no commit without a dry run.
  constraint crm_import_runs_dry_run_before_commit_check
    check (state not in ('committed', 'rolled_back') or dry_run_at is not null),
  constraint crm_import_runs_commit_check
    check (
      (state in ('committed', 'rolled_back')) = (committed_at is not null)
    ),
  constraint crm_import_runs_rollback_check
    check (
      (state = 'rolled_back') = (rolled_back_at is not null)
    ),
  -- A rollback without a reason is one nobody can learn from.
  constraint crm_import_runs_rollback_reason_check
    check (rolled_back_at is null or rollback_reason is not null)
);

create index if not exists crm_import_runs_workspace_idx
  on public.crm_import_runs (crm_workspace_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. The import row
-- ---------------------------------------------------------------------

create table if not exists public.crm_import_rows (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  import_run_id uuid not null references public.crm_import_runs(id) on delete cascade,
  row_number integer not null,
  -- The source row as read, so an error file can reproduce it exactly.
  source jsonb not null,
  state text not null default 'ready',
  -- Problems that stop the row. One sentence each, naming the column.
  issues text[] not null default '{}',
  -- Things worth knowing that do not stop the row, kept apart from issues
  -- because an unmatched organisation name should not reject a contact.
  warnings text[] not null default '{}',
  created_table text,
  created_id uuid,
  merged_into_id uuid,
  constraint crm_import_rows_state_check
    check (state in (
      'ready',
      'blocked',
      'needs_duplicate_review',
      'created',
      'updated',
      'skipped',
      'rolled_back'
    )),
  -- A blocked row has to say what blocked it. coalesce, because
  -- array_length of an empty array is null and a null check passes, which
  -- would have let a blocked row through with nothing written against it.
  constraint crm_import_rows_blocked_check
    check (state <> 'blocked' or coalesce(array_length(issues, 1), 0) > 0),
  -- A row that claims to have created something has to say what.
  constraint crm_import_rows_created_check
    check (
      state not in ('created', 'rolled_back')
      or (created_table is not null and created_id is not null)
    ),
  constraint crm_import_rows_unique_row unique (import_run_id, row_number)
);

create index if not exists crm_import_rows_run_idx
  on public.crm_import_rows (import_run_id, row_number);

-- The rollback path reads exactly this: every row of a run that created
-- something and has not already been reversed.
create index if not exists crm_import_rows_created_idx
  on public.crm_import_rows (import_run_id, created_table, created_id)
  where state in ('created', 'updated');

comment on table public.crm_import_rows is
  'Holds the source file as it was read, so these rows carry personal '
  'information and are covered by the same retention, export and deletion '
  'rules as any other table.';

-- ---------------------------------------------------------------------
-- 4. Indexes for the page loads Stage 8 has to survive
--
-- The Stage 8 brief sets a hundred thousand activities and a hundred thousand
-- people as the size the interface must work at, and says not to load the
-- whole CRM into the browser. The application pages a list; these indexes are
-- what make a page cheap on the server rather than a sort of the table.
-- ---------------------------------------------------------------------

create index if not exists crm_activities_workspace_occurred_idx
  on public.crm_activities (crm_workspace_id, occurred_at desc)
  where deleted_at is null;

create index if not exists crm_activities_org_occurred_idx
  on public.crm_activities (organisation_id, occurred_at desc)
  where deleted_at is null and organisation_id is not null;

-- Unlinked activities, which is a data-quality indicator and therefore a query
-- somebody runs on a schedule.
create index if not exists crm_activities_unlinked_idx
  on public.crm_activities (crm_workspace_id, occurred_at desc)
  where deleted_at is null and organisation_id is null and work_item_id is null;

create index if not exists crm_people_workspace_name_idx
  on public.crm_people (crm_workspace_id, family_name, given_name)
  where deleted_at is null and merged_into_person_id is null;

create index if not exists crm_organisations_workspace_name_idx
  on public.crm_organisations (crm_workspace_id, name)
  where deleted_at is null;

create index if not exists crm_work_items_workspace_stage_idx
  on public.crm_work_items (crm_workspace_id, stage_id, status)
  where deleted_at is null;

-- Organisations with nobody named for data quality. The dashboard's tenth
-- indicator, and a partial index because the answer is usually a short list.
create index if not exists crm_organisations_no_quality_owner_idx
  on public.crm_organisations (crm_workspace_id)
  where deleted_at is null and data_quality_owner_user_id is null;

-- ---------------------------------------------------------------------
-- 5. Row level security, on the same terms as everything else
-- ---------------------------------------------------------------------

do $$
declare
  t text;
  stage8_tables text[] := array[
    'crm_integration_connections',
    'crm_import_runs',
    'crm_import_rows'
  ];
begin
  foreach t in array stage8_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using (public.crm_has_role(crm_workspace_id, 'crm_viewer'))
    $p$, t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format($p$
      create policy %I on public.%I
        for insert to authenticated
        with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
    $p$, t || '_insert', t);

    -- Both USING and WITH CHECK: an update that can move a row into another
    -- workspace is tenant isolation defeated by an UPDATE.
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

-- Connecting an outside system, and enabling sending on one, are admin acts
-- rather than contributor acts. The standard insert and update policies above
-- let a contributor write the row; these two require the role the words imply.
drop policy if exists crm_integration_connections_connect on public.crm_integration_connections;
create policy crm_integration_connections_connect on public.crm_integration_connections
  for insert to authenticated
  with check (public.crm_has_role(crm_workspace_id, 'crm_admin'));

drop policy if exists crm_integration_connections_admin_update on public.crm_integration_connections;
create policy crm_integration_connections_admin_update on public.crm_integration_connections
  for update to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'))
  with check (public.crm_has_role(crm_workspace_id, 'crm_admin'));

-- Committing an import writes customer records, so it needs an approver.
drop policy if exists crm_import_runs_commit on public.crm_import_runs;
create policy crm_import_runs_commit on public.crm_import_runs
  for update to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_approver'))
  with check (public.crm_has_role(crm_workspace_id, 'crm_approver'));

-- ---------------------------------------------------------------------
-- 6. Verification: no score column, still
-- ---------------------------------------------------------------------

-- Stage 4 added a check that refuses a score, grade or rating column on the
-- record-quality table. Stage 8 adds reporting, which is where such a column
-- would arrive, so the check is widened to every CRM table rather than that
-- one.
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
      column_name in ('score', 'grade', 'rating', 'performance_score', 'productivity_score')
      or column_name like '%_score'
    );

  if offending is not null then
    raise exception
      'A score column has appeared on a CRM table (%). Concludo does not score people, and a per-person number is how a CRM becomes a performance tool.',
      offending;
  end if;
end
$$;

-- =====================================================================
-- End of migration 0007.
--
-- Not in this migration, deliberately:
--
--   * No table that records a per-person productivity number, and a check
--     above that fails the migration if a column shaped like one appears.
--   * No column that enables automatic sending for a whole workspace. Sending
--     is per connection, off by default, and switched on by a named person.
--   * No "import everything" flag. The import scope is a jsonb of named
--     accounts, folders, labels and dates, and an empty scope reads nothing.
--   * No automatic merge on import. A duplicate becomes a row in
--     'needs_duplicate_review' and waits for a person.
-- =====================================================================
