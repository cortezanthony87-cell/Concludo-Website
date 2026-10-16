-- =====================================================================
-- Concludo CRM, migration 0008: relationship attention
--
-- Concludo Pty Ltd. Phase 2A-i.
--
-- Adds one table: the decisions people make about the eleven named attention
-- conditions. It does NOT add a table of computed signals, and that is the
-- most important thing in this file.
--
-- Five things in here are decisions rather than plumbing, and each is a
-- constraint rather than a convention the application remembers:
--
--   1. THERE IS NO SCORE COLUMN, AND THERE CANNOT BE ONE. The attention
--      figure is a count of named conditions, computed from the conditions
--      themselves. A weighted score is an opinion nobody can check, and a
--      score stored against an account is one GROUP BY from a league table of
--      the people who own those accounts. The verification block at the end of
--      this migration fails the deploy if a column shaped like one appears on
--      any CRM table, and this migration widens that check to cover the names
--      somebody would reach for here.
--
--   2. THERE IS NO OWNER COLUMN. Not on this table, and not on any view of
--      it. `decided_by` records who made a decision, which is an audit fact
--      about an act, and it is deliberately not an owner of the account. The
--      application has no function that groups anything in this table by a
--      user, and block 14 below fails the deploy if a view appears that does.
--
--   3. A DECISION CARRIES A REASON. `reason` is not null with a length check.
--      It is the only record of why something stopped being shown.
--
--   4. A DISMISSAL EXPIRES. `expires_at` is not null for a dismissal. A
--      dismissal that never ends is how an attention list quietly empties
--      itself: the decision was right about March and the product stops
--      mentioning the renewal in August. The check refuses a dismissal with no
--      end, and refuses one more than 180 days out.
--
--   5. THE SIGNALS THEMSELVES ARE NOT STORED. They are derived from records
--      that already exist, so a stored copy can disagree with the records, and
--      in a release with no job to refresh it every row would be stale the
--      moment somebody logged a call. The columns a materialising job will
--      need are here and nullable, so Phase 2A-ii writes into this table
--      rather than inventing a second one.
--
-- Depends on: 0001 to 0007.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------

create table if not exists public.crm_relationship_signals (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  -- Always an organisation. A person-level attention signal would be a
  -- judgement about a person, which this product does not make.
  organisation_id uuid not null references public.crm_organisations(id) on delete cascade,

  condition text not null,
  state text not null,

  -- Never blank. See decision 3.
  reason text not null,

  decided_by uuid not null,
  decided_at timestamptz not null default now(),

  -- Null is allowed only for an acknowledgement. See decision 4.
  expires_at timestamptz,

  -- What the condition said at the moment it was decided, so a reason read a
  -- year later has something to attach itself to.
  detail_at_decision text,

  -- Set only by the materialising job that Phase 2A-ii adds. Null while the
  -- signals are computed on read.
  computed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_relationship_signals_condition_check
    check (condition in (
      'single_contact_dependency',
      'no_executive_relationship',
      'no_interaction_90',
      'renewal_approaching',
      'service_issue_unresolved',
      'follow_ups_ignored',
      'no_stakeholder_coverage',
      'no_decision_maker',
      'no_next_engagement',
      'no_recorded_value',
      'plan_overdue_for_review'
    )),

  constraint crm_relationship_signals_state_check
    check (state in ('acknowledged', 'dismissed')),

  -- A reason of three words is not a reason.
  constraint crm_relationship_signals_reason_check
    check (length(btrim(reason)) >= 10),

  -- Decision 4, in two halves: a dismissal must end, and it may not end more
  -- than 180 days out.
  constraint crm_relationship_signals_dismissal_expires_check
    check (state <> 'dismissed' or expires_at is not null),
  constraint crm_relationship_signals_dismissal_window_check
    check (expires_at is null or expires_at <= decided_at + interval '180 days')
);

comment on table public.crm_relationship_signals is
  'Decisions people make about the eleven named attention conditions. Not the '
  'signals themselves, which are derived from records that already exist.';

comment on column public.crm_relationship_signals.decided_by is
  'Who made this decision. An audit fact about an act, never an owner of the '
  'account, and never grouped by.';

comment on column public.crm_relationship_signals.expires_at is
  'A dismissal ends. A dismissal that never ends is how an attention list '
  'quietly empties itself.';

-- The query the page actually runs: the live decisions for one workspace.
create index if not exists crm_relationship_signals_live_idx
  on public.crm_relationship_signals (crm_workspace_id, organisation_id, condition, decided_at desc);

-- Expiring decisions, for the job that will eventually tidy them.
create index if not exists crm_relationship_signals_expiry_idx
  on public.crm_relationship_signals (crm_workspace_id, expires_at)
  where expires_at is not null;

-- ---------------------------------------------------------------------
-- 2. Row level security, on the same terms as everything else
-- ---------------------------------------------------------------------

alter table public.crm_relationship_signals enable row level security;
alter table public.crm_relationship_signals force row level security;

drop policy if exists crm_relationship_signals_select on public.crm_relationship_signals;
create policy crm_relationship_signals_select on public.crm_relationship_signals
  for select to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_viewer'));

drop policy if exists crm_relationship_signals_insert on public.crm_relationship_signals;
create policy crm_relationship_signals_insert on public.crm_relationship_signals
  for insert to authenticated
  with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'));

-- Both USING and WITH CHECK, for the same reason as every other table: an
-- update that can move a row into another workspace is tenant isolation
-- defeated by an UPDATE.
drop policy if exists crm_relationship_signals_update on public.crm_relationship_signals;
create policy crm_relationship_signals_update on public.crm_relationship_signals
  for update to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
  with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'));

drop policy if exists crm_relationship_signals_delete on public.crm_relationship_signals;
create policy crm_relationship_signals_delete on public.crm_relationship_signals
  for delete to authenticated
  using (public.crm_has_role(crm_workspace_id, 'crm_admin'));

-- ---------------------------------------------------------------------
-- 3. A decision belongs to the workspace it names
-- ---------------------------------------------------------------------

create or replace function public.crm_relationship_signal_same_workspace()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  org_workspace uuid;
begin
  select crm_workspace_id into org_workspace
  from public.crm_organisations
  where id = new.organisation_id;

  if org_workspace is null or org_workspace <> new.crm_workspace_id then
    raise exception
      'A relationship signal must belong to the same workspace as the organisation it names.';
  end if;

  return new;
end
$$;

drop trigger if exists crm_relationship_signals_same_workspace
  on public.crm_relationship_signals;
create trigger crm_relationship_signals_same_workspace
  before insert or update on public.crm_relationship_signals
  for each row execute function public.crm_relationship_signal_same_workspace();

-- ---------------------------------------------------------------------
-- 4. Verification: no score, and no per-person rollup
-- ---------------------------------------------------------------------

-- Block 13 (widened). The Stage 8 check refuses score, grade, rating and
-- anything ending in _score. Phase 2 adds the names somebody would reach for
-- when building an attention figure.
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
        'relationship_score', 'weighting', 'weight'
      )
      or column_name like '%_score'
      or column_name like '%_ranking'
    );

  if offending is not null then
    raise exception
      'A score or ranking column has appeared on a CRM table (%). The attention figure is a count of named conditions, and a weighted score is one GROUP BY from a league table of the people who own the accounts.',
      offending;
  end if;
end
$$;

-- Block 14 (new). No view may group anything from the signal table by a user
-- column. This is the check that keeps the leaderboard out: the data is
-- shaped so that the rollup is possible, and only this refuses it.
do $$
declare
  offending text;
begin
  select string_agg(table_name, ', ')
  into offending
  from information_schema.views
  where table_schema = 'public'
    and view_definition ilike '%crm_relationship_signals%'
    and (
      view_definition ilike '%group by%decided_by%'
      or view_definition ilike '%group by%owner_user_id%'
      or view_definition ilike '%group by%user_id%'
    );

  if offending is not null then
    raise exception
      'A view groups relationship signals by a person (%). Concludo counts work, records and relationships, never people.',
      offending;
  end if;
end
$$;

-- =====================================================================
-- End of migration 0008.
--
-- Not in this migration, deliberately:
--
--   * No table of computed signals. They are derived on read, from records
--     that already exist, so there is nothing to go stale.
--   * No score, no weight, no ranking column, and a check that fails the
--     deploy if one appears.
--   * No owner column, and a check that fails the deploy if a view groups by
--     a person.
--   * No permanent dismissal. Every dismissal ends, and 180 days is the
--     longest one this schema will hold.
--   * No bulk-decision table. A reason typed once and applied to four hundred
--     signals is not a reason.
-- =====================================================================
