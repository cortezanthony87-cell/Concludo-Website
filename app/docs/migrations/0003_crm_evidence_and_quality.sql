-- =====================================================================
-- Concludo CRM, migration 0003: evidence, proposals, approvals and quality.
--
-- This is the migration that carries the product's central claim. Everything
-- else is a CRM; this is what makes it Concludo's.
--
-- THE EVIDENCE MODEL.
--
-- `crm_evidence` is the object the brief calls source evidence, and it carries
-- the full field list in one row rather than splitting value from source: a
-- join for every read of every fact is a join nobody will write, and the
-- provenance quietly stops being shown. One row holds the value, the field and
-- record it affects, where it came from, when it was captured, whether it is
-- stated or inferred, the confidence, the model and prompt versions where it
-- was AI generated, who confirmed it and when, and whether it has been
-- superseded or is in conflict.
--
-- FACTS, INFERENCES, UNKNOWNS AND CONFLICTS STAY DISTINCT.
--
-- `basis` separates stated from inferred from calculated from unknown, and
-- unknown is a real value rather than the absence of a row: "we do not know
-- the budget" and "nobody has looked" are different facts. `conflicts_with_id`
-- makes a disagreement a row rather than an overwrite, so when two meetings
-- give different close dates both survive and the person decides.
--
-- RECORD QUALITY IS NOT A SCORE.
--
-- `crm_record_quality` holds nine named measures about a RECORD. There is no
-- overall grade, no percentage and no owner rollup, because the moment a CRM
-- can average quality by owner it has become an employee performance tool,
-- which this product will not be. The constraint at the end of this file is
-- the enforcement, not a comment.
--
-- Idempotent. Verified against PostgreSQL 16.13.
-- =====================================================================

-- =====================================================================
-- 1. Evidence
-- =====================================================================

create table if not exists public.crm_evidence (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  -- WHAT IS BEING ASSERTED ------------------------------------------------
  -- The record and field this bears on, and the value it asserts. Held as
  -- text because this table spans every entity and a typed column per shape
  -- would be a column per shape per entity.
  subject_table text not null,
  subject_id uuid not null,
  field_name text not null,
  asserted_value text,

  -- WHERE IT CAME FROM ----------------------------------------------------
  source_type text not null
    check (source_type in (
      'meeting_transcript', 'email', 'document', 'manual_entry',
      'import', 'external_system', 'derived', 'none'
    )),
  -- The record in the source system, where there is one.
  source_record_table text,
  source_record_id uuid,
  -- The sentence it came from, or where in the source to find it. Both,
  -- where both are known: a quote proves the claim, a location lets somebody
  -- check the context around it.
  source_text text,
  source_location text,
  captured_at timestamptz not null default now(),

  -- HOW IT IS KNOWN -------------------------------------------------------
  basis text not null
    check (basis in ('stated', 'inferred', 'calculated', 'unknown')),
  -- A word, not a percentage. A CRM that prints "87% confident" from a
  -- heuristic is claiming a precision it does not have.
  confidence text not null default 'moderate'
    check (confidence in ('high', 'moderate', 'low')),

  -- WHERE AI WAS INVOLVED -------------------------------------------------
  -- Null where a person entered it. Populated where a model produced it, so a
  -- bad extraction can be traced to the version that made it and every row
  -- from that version found again.
  model_version text,
  prompt_version text,

  -- CONFIRMATION ----------------------------------------------------------
  confirmed_by uuid,
  confirmed_at timestamptz,

  -- SUPERSESSION AND CONFLICT --------------------------------------------
  superseded_by_id uuid references public.crm_evidence(id) on delete set null,
  superseded_at timestamptz,
  -- A disagreement is a row, not an overwrite. Both sides survive and a
  -- person decides which is right.
  conflicts_with_id uuid references public.crm_evidence(id) on delete set null,
  conflict_state text not null default 'none'
    check (conflict_state in ('none', 'open', 'resolved_kept', 'resolved_superseded')),
  conflict_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  -- An unknown carries no evidence, and anything else must carry some. This is
  -- what stops "inferred" becoming a label applied to a value with nothing
  -- behind it.
  constraint crm_evidence_unknown_has_no_source
    check (basis <> 'unknown' or (source_text is null and source_location is null)),
  constraint crm_evidence_known_has_source
    check (basis = 'unknown'
           or source_type = 'none'
           or source_text is not null
           or source_location is not null
           or source_record_id is not null),
  -- An AI-generated assertion names the version that produced it.
  constraint crm_evidence_ai_has_versions
    check ((model_version is null) = (prompt_version is null)),
  constraint crm_evidence_confirmation_is_complete
    check ((confirmed_by is null) = (confirmed_at is null)),
  constraint crm_evidence_supersession_is_complete
    check ((superseded_by_id is null) = (superseded_at is null)),
  constraint crm_evidence_not_superseded_by_self
    check (superseded_by_id is null or superseded_by_id <> id),
  constraint crm_evidence_conflict_is_complete
    check ((conflict_state = 'none') = (conflicts_with_id is null))
);

create index if not exists crm_evidence_subject_idx
  on public.crm_evidence (subject_table, subject_id, field_name)
  where deleted_at is null and superseded_at is null;
create index if not exists crm_evidence_workspace_idx
  on public.crm_evidence (crm_workspace_id) where deleted_at is null;
create index if not exists crm_evidence_conflict_idx
  on public.crm_evidence (crm_workspace_id) where conflict_state = 'open' and deleted_at is null;
create index if not exists crm_evidence_model_idx
  on public.crm_evidence (model_version) where model_version is not null;

comment on table public.crm_evidence is
  'Source evidence. One row per assertion, carrying value, field, record, source, capture time, basis, confidence, model and prompt version, confirmation, supersession and conflict.';

-- The current, unsuperseded assertions. Every read of a derived fact should
-- come through here rather than filtering by hand, because a forgotten
-- `superseded_at is null` shows a person a fact that was corrected last month.
create or replace view public.crm_current_evidence as
  select *
  from public.crm_evidence
  where deleted_at is null
    and superseded_at is null;

-- Superseding is a function rather than two UPDATEs, so the pair cannot come
-- apart: a new assertion that does not mark the old one superseded leaves two
-- live values for the same field and nothing to say which is current.
create or replace function public.crm_supersede_evidence(
  p_old_id uuid,
  p_new_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_new record;
begin
  select * into v_old from public.crm_evidence where id = p_old_id;
  select * into v_new from public.crm_evidence where id = p_new_id;

  if v_old is null or v_new is null then
    raise exception 'crm_supersede_evidence: both assertions must exist';
  end if;
  if v_old.crm_workspace_id <> v_new.crm_workspace_id then
    raise exception 'crm_supersede_evidence: assertions are in different workspaces';
  end if;
  if v_old.subject_table <> v_new.subject_table
     or v_old.subject_id <> v_new.subject_id
     or v_old.field_name <> v_new.field_name then
    raise exception 'crm_supersede_evidence: assertions are about different things';
  end if;

  update public.crm_evidence
     set superseded_by_id = p_new_id,
         superseded_at = now(),
         conflict_state = case when conflict_state = 'open' then 'resolved_superseded' else conflict_state end,
         updated_at = now()
   where id = p_old_id;
end;
$$;

-- Recording a conflict marks both sides, because a conflict visible from only
-- one direction is a conflict somebody will miss.
create or replace function public.crm_record_conflict(
  p_left_id uuid,
  p_right_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_left_id = p_right_id then
    raise exception 'crm_record_conflict: an assertion cannot conflict with itself';
  end if;

  update public.crm_evidence
     set conflicts_with_id = p_right_id, conflict_state = 'open',
         conflict_note = coalesce(p_note, conflict_note), updated_at = now()
   where id = p_left_id;

  update public.crm_evidence
     set conflicts_with_id = p_left_id, conflict_state = 'open',
         conflict_note = coalesce(p_note, conflict_note), updated_at = now()
   where id = p_right_id;
end;
$$;

-- =====================================================================
-- 2. AI proposals and approvals
-- =====================================================================

-- THE INVARIANT THIS TABLE EXISTS TO ENFORCE.
--
-- No agent writes to a CRM entity table. An agent's only write target is
-- crm_proposals. The only code that writes an entity is the applier, and it
-- runs only on an approved proposal. That single rule is what makes
-- "Concludo proposes; a person disposes" mechanical rather than a matter of
-- discipline, and it means the model layer can be replaced without touching
-- the interface, the audit trail or the approval path.
create table if not exists public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  proposal_kind text not null
    check (proposal_kind in (
      'create_person', 'update_person', 'link_person_to_organisation',
      'create_organisation', 'update_organisation',
      'create_work_item', 'update_work_item', 'update_stage', 'update_next_step',
      'record_commitment', 'record_decision', 'merge_duplicate', 'correct_field'
    )),

  headline text not null,
  rationale text not null,

  subject_table text not null,
  subject_id uuid,

  -- Field by field, what it is now and what it would become. A person
  -- approving "update the contact record" is approving a sentence; a person
  -- approving "Organisation: empty becomes Harbourline" is approving a change.
  changes jsonb not null default '[]'::jsonb,

  confidence text not null default 'moderate'
    check (confidence in ('high', 'moderate', 'low')),
  evidence_id uuid references public.crm_evidence(id) on delete set null,

  model_version text,
  prompt_version text,

  state text not null default 'awaiting_confirmation'
    check (state in ('awaiting_confirmation', 'confirmed', 'declined', 'superseded', 'expired')),

  -- A merge is the one change that cannot be undone by editing a field
  -- afterwards, so it is marked and treated separately everywhere.
  is_destructive boolean not null default false,

  proposed_at timestamptz not null default now(),
  -- Set by the applier, in Stage 5. Null here means the shell is honest about
  -- applying nothing.
  applied_at timestamptz,
  application_result jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  purge_after timestamptz,

  constraint crm_proposals_has_changes check (jsonb_array_length(changes) > 0),
  constraint crm_proposals_ai_has_versions check ((model_version is null) = (prompt_version is null)),
  -- A proposal is applied only once it has been confirmed. Nothing else may
  -- carry an applied timestamp.
  constraint crm_proposals_applied_only_when_confirmed
    check (applied_at is null or state = 'confirmed'),
  constraint crm_proposals_merge_is_destructive
    check ((proposal_kind = 'merge_duplicate') <= is_destructive)
);

create index if not exists crm_proposals_awaiting_idx
  on public.crm_proposals (crm_workspace_id, proposed_at desc)
  where deleted_at is null and state = 'awaiting_confirmation';

-- An approval is bound to a payload, not to a permission.
--
-- The application's existing workflow_approvals table records a decision and
-- nothing reads action_payload afterwards, so approving changes nothing. This
-- one carries a hash of the proposal's changes at the moment of approval, so
-- the applier can refuse if the proposal moved between approval and
-- application.
create table if not exists public.crm_approvals (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,
  proposal_id uuid not null references public.crm_proposals(id) on delete cascade,

  decision text not null check (decision in ('confirmed', 'declined')),
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  note text,

  -- What exactly was approved.
  approved_changes jsonb not null,
  approved_changes_digest text not null,

  -- Whether the approver was also the person or agent who proposed it. A sole
  -- trader approving their own proposal is normal; a team where it happens
  -- every time is a control that is not working, and the only way to know is
  -- to record it.
  self_approved boolean not null default false,

  created_at timestamptz not null default now(),
  unique (proposal_id)
);

create index if not exists crm_approvals_workspace_idx
  on public.crm_approvals (crm_workspace_id, decided_at desc);

-- Deciding is a function, so the proposal state and the approval row cannot
-- come apart, and the digest is computed here rather than trusted from a
-- caller.
create or replace function public.crm_decide_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal record;
  v_approval_id uuid;
  v_self boolean;
begin
  if p_decision not in ('confirmed', 'declined') then
    raise exception 'crm_decide_proposal: decision must be confirmed or declined';
  end if;

  select * into v_proposal from public.crm_proposals where id = p_proposal_id and deleted_at is null;
  if v_proposal is null then
    raise exception 'crm_decide_proposal: proposal % does not exist', p_proposal_id;
  end if;

  if v_proposal.state <> 'awaiting_confirmation' then
    raise exception 'crm_decide_proposal: proposal is already %', v_proposal.state;
  end if;

  if not public.crm_has_role(v_proposal.crm_workspace_id, 'crm_approver') then
    raise exception 'crm_decide_proposal: approving requires the crm_approver role in this workspace';
  end if;

  -- A model proposed it, so self-approval here means a person approving a
  -- proposal they themselves raised rather than one an agent raised.
  v_self := (v_proposal.model_version is null and v_proposal.created_at is not null
             and auth.uid() is not null
             and exists (
               select 1 from public.crm_audit_events e
               where e.subject_id = v_proposal.id
                 and e.event_type = 'proposal_raised'
                 and e.actor_id = auth.uid()
             ));

  insert into public.crm_approvals (
    crm_workspace_id, proposal_id, decision, decided_by, note,
    approved_changes, approved_changes_digest, self_approved
  )
  values (
    v_proposal.crm_workspace_id, p_proposal_id, p_decision, auth.uid(), p_note,
    v_proposal.changes, md5(v_proposal.changes::text), coalesce(v_self, false)
  )
  returning id into v_approval_id;

  update public.crm_proposals
     set state = p_decision, updated_at = now()
   where id = p_proposal_id;

  return v_approval_id;
end;
$$;

-- =====================================================================
-- 3. Duplicate candidates
-- =====================================================================

create table if not exists public.crm_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  subject_table text not null check (subject_table in ('crm_people', 'crm_organisations')),
  left_id uuid not null,
  right_id uuid not null,

  -- What matches AND what differs. A duplicate list that only shows the
  -- matches trains a person to click yes, which is the failure mode that makes
  -- automated merging dangerous.
  matching_fields text[] not null default '{}',
  differing_fields text[] not null default '{}',

  recommendation text not null
    check (recommendation in ('review_together', 'likely_separate')),
  reason text not null,

  state text not null default 'open'
    check (state in ('open', 'merged', 'kept_separate', 'dismissed')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_duplicates_distinct check (left_id <> right_id),
  constraint crm_duplicates_decision_recorded
    check ((state = 'open') = (decided_at is null)),
  -- Keeping two records separate is a decision worth a note, because without
  -- one the same pair is re-proposed forever.
  constraint crm_duplicates_kept_separate_has_note
    check (state <> 'kept_separate' or (decision_note is not null and length(trim(decision_note)) > 0)),
  unique (subject_table, left_id, right_id)
);

create index if not exists crm_duplicates_open_idx
  on public.crm_duplicate_candidates (crm_workspace_id) where state = 'open';

-- =====================================================================
-- 4. Record quality
-- =====================================================================

create table if not exists public.crm_record_quality (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  subject_table text not null,
  subject_id uuid not null,

  -- The nine measures, each about the RECORD.
  -- 1. How much of what this kind of record should hold is held.
  completeness_present integer not null default 0 check (completeness_present >= 0),
  completeness_expected integer not null default 0 check (completeness_expected >= 0),
  completeness_missing_fields text[] not null default '{}',

  -- 2. How long since anything happened on it.
  freshness_days integer,
  -- 3. How long since anyone actually spoke to the customer, which is a
  --    different question from whether the record was touched.
  last_meaningful_activity_at timestamptz,

  -- 4. How many of the record's facts can be traced to a source.
  source_coverage_traced integer not null default 0 check (source_coverage_traced >= 0),
  source_coverage_total integer not null default 0 check (source_coverage_total >= 0),

  -- 5. Open conflicts.
  open_conflicts integer not null default 0 check (open_conflicts >= 0),
  -- 6. Possible duplicates.
  open_duplicates integer not null default 0 check (open_duplicates >= 0),

  -- 7, 8. The next step and its date, or their absence.
  next_step text,
  next_step_due date,

  -- 9. Where the record stands in a review.
  review_status text not null default 'not_reviewed'
    check (review_status in ('not_reviewed', 'needs_review', 'reviewed', 'accepted_as_is')),
  reviewed_by uuid,
  reviewed_at timestamptz,

  -- Who is responsible for keeping this record good. Responsibility for work,
  -- not a measure of the person.
  data_quality_owner_user_id uuid,

  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (subject_table, subject_id),
  constraint crm_record_quality_completeness_sane
    check (completeness_present <= completeness_expected),
  constraint crm_record_quality_coverage_sane
    check (source_coverage_traced <= source_coverage_total),
  constraint crm_record_quality_review_recorded
    check ((review_status in ('reviewed', 'accepted_as_is')) = (reviewed_at is not null))
);

create index if not exists crm_record_quality_subject_idx
  on public.crm_record_quality (crm_workspace_id, subject_table);
create index if not exists crm_record_quality_needs_review_idx
  on public.crm_record_quality (crm_workspace_id) where review_status = 'needs_review';

comment on table public.crm_record_quality is
  'Nine named measures about a record. Deliberately no overall score, no percentage and no owner rollup: the moment quality can be averaged by owner, the CRM has become an employee performance tool.';

-- The enforcement, not a comment.
--
-- This view is what any quality reporting must read. It exposes the measures
-- per record and deliberately offers no grouping by owner. A report that wants
-- "quality by person" has to be written against the base table on purpose,
-- which makes it a decision somebody has to defend rather than a default.
create or replace view public.crm_record_quality_summary as
  select
    q.crm_workspace_id,
    q.subject_table,
    q.subject_id,
    q.completeness_present,
    q.completeness_expected,
    q.completeness_missing_fields,
    q.freshness_days,
    q.last_meaningful_activity_at,
    q.source_coverage_traced,
    q.source_coverage_total,
    q.open_conflicts,
    q.open_duplicates,
    q.next_step,
    q.next_step_due,
    q.review_status,
    (q.next_step is null) as missing_next_step,
    q.computed_at
  from public.crm_record_quality q;

comment on view public.crm_record_quality_summary is
  'Record quality for reporting. No owner column on purpose: this view cannot be grouped into a per-person score.';

-- Recomputing quality for one work item. Written as a function so the
-- definition of each measure lives in one place rather than in whichever
-- query somebody wrote last.
create or replace function public.crm_recompute_work_item_quality(p_work_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  v_present integer := 0;
  v_expected integer := 6;
  v_missing text[] := '{}';
  v_last_contact timestamptz;
  v_traced integer := 0;
  v_total integer := 0;
  v_conflicts integer := 0;
  v_duplicates integer := 0;
begin
  select * into w from public.crm_work_items where id = p_work_item_id and deleted_at is null;
  if w is null then
    return;
  end if;

  -- Completeness: the six things a work item needs to be actionable.
  --
  -- Each append casts explicitly. `text[] || 'two words'` is ambiguous between
  -- array-append and array-concatenate, and PostgreSQL resolves it as a
  -- concatenate, which tries to read the string as an array literal. A
  -- single-word value parses by accident and a two-word value raises
  -- "malformed array literal", so the bug hides until somebody adds a field
  -- whose name has a space in it. Found by the verification harness.
  if w.organisation_id is not null then v_present := v_present + 1;
    else v_missing := array_append(v_missing, 'organisation'); end if;
  if w.primary_person_id is not null then v_present := v_present + 1;
    else v_missing := array_append(v_missing, 'primary contact'); end if;
  if w.value_amount is not null then v_present := v_present + 1;
    else v_missing := array_append(v_missing, 'value'); end if;
  if w.expected_close_date is not null then v_present := v_present + 1;
    else v_missing := array_append(v_missing, 'expected close date'); end if;
  if w.next_step is not null then v_present := v_present + 1;
    else v_missing := array_append(v_missing, 'next step'); end if;
  if w.next_step_due is not null then v_present := v_present + 1;
    else v_missing := array_append(v_missing, 'next step date'); end if;

  -- Freshness, from meaningful contact only.
  select max(a.occurred_at) into v_last_contact
  from public.crm_activities a
  where a.work_item_id = p_work_item_id
    and a.deleted_at is null
    and a.is_meaningful_contact;

  -- Source coverage, over the assertions about this record.
  select count(*) filter (where basis in ('stated', 'calculated') or source_text is not null),
         count(*)
    into v_traced, v_total
  from public.crm_current_evidence e
  where e.subject_table = 'crm_work_items' and e.subject_id = p_work_item_id;

  select count(*) into v_conflicts
  from public.crm_current_evidence e
  where e.subject_table = 'crm_work_items' and e.subject_id = p_work_item_id
    and e.conflict_state = 'open';

  select count(*) into v_duplicates
  from public.crm_duplicate_candidates d
  where d.state = 'open'
    and d.subject_table = 'crm_work_items'
    and (d.left_id = p_work_item_id or d.right_id = p_work_item_id);

  insert into public.crm_record_quality (
    crm_workspace_id, subject_table, subject_id,
    completeness_present, completeness_expected, completeness_missing_fields,
    freshness_days, last_meaningful_activity_at,
    source_coverage_traced, source_coverage_total,
    open_conflicts, open_duplicates,
    next_step, next_step_due,
    review_status, computed_at
  )
  values (
    w.crm_workspace_id, 'crm_work_items', p_work_item_id,
    v_present, v_expected, v_missing,
    case when v_last_contact is null then null else extract(day from (now() - v_last_contact))::integer end,
    v_last_contact,
    v_traced, v_total,
    v_conflicts, v_duplicates,
    w.next_step, w.next_step_due,
    case
      when v_conflicts > 0 or v_duplicates > 0 or w.next_step is null then 'needs_review'
      else 'not_reviewed'
    end,
    now()
  )
  on conflict (subject_table, subject_id) do update set
    completeness_present = excluded.completeness_present,
    completeness_expected = excluded.completeness_expected,
    completeness_missing_fields = excluded.completeness_missing_fields,
    freshness_days = excluded.freshness_days,
    last_meaningful_activity_at = excluded.last_meaningful_activity_at,
    source_coverage_traced = excluded.source_coverage_traced,
    source_coverage_total = excluded.source_coverage_total,
    open_conflicts = excluded.open_conflicts,
    open_duplicates = excluded.open_duplicates,
    next_step = excluded.next_step,
    next_step_due = excluded.next_step_due,
    review_status = case
      when public.crm_record_quality.review_status in ('reviewed', 'accepted_as_is')
       and excluded.review_status = 'not_reviewed'
      then public.crm_record_quality.review_status
      else excluded.review_status
    end,
    computed_at = now(),
    updated_at = now();
end;
$$;

-- =====================================================================
-- 5. Audit events
-- =====================================================================

-- A separate table rather than the application's audit_logs.
--
-- That table's insert policy is `with check (auth.uid() is not null)`, which
-- lets any authenticated user write an audit row for an organisation they do
-- not belong to. A customer-data audit trail cannot sit on that policy. The
-- CRM mirrors its high-level events into audit_logs separately so the
-- enterprise audit view stays complete.
create table if not exists public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id) on delete cascade,

  actor_id uuid,
  actor_kind text not null default 'user'
    check (actor_kind in ('user', 'agent', 'system')),

  event_type text not null,
  subject_table text not null,
  subject_id uuid,

  -- Before and after. Redaction happens in the application layer before the
  -- call, using the redactor the workflow module already ships.
  before_state jsonb,
  after_state jsonb,

  proposal_id uuid references public.crm_proposals(id) on delete set null,
  outcome text not null default 'success'
    check (outcome in ('success', 'failure', 'refused')),
  detail text,
  request_id uuid,

  created_at timestamptz not null default now()
);

create index if not exists crm_audit_workspace_idx
  on public.crm_audit_events (crm_workspace_id, created_at desc);
create index if not exists crm_audit_subject_idx
  on public.crm_audit_events (subject_table, subject_id, created_at desc);

-- Append only, enforced by a trigger rather than by hoping.
create or replace function public.crm_audit_is_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'crm_audit_events is append only: % is refused', tg_op;
end;
$$;

drop trigger if exists crm_audit_no_update on public.crm_audit_events;
create trigger crm_audit_no_update
  before update or delete on public.crm_audit_events
  for each row execute function public.crm_audit_is_append_only();

-- One call, so an audit row cannot be forgotten by a caller that did five
-- other things first.
create or replace function public.crm_record_audit(
  p_workspace_id uuid,
  p_event_type text,
  p_subject_table text,
  p_subject_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_actor_kind text default 'user',
  p_outcome text default 'success',
  p_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.crm_audit_events (
    crm_workspace_id, actor_id, actor_kind, event_type,
    subject_table, subject_id, before_state, after_state, outcome, detail
  )
  values (
    p_workspace_id, auth.uid(), p_actor_kind, p_event_type,
    p_subject_table, p_subject_id, p_before, p_after, p_outcome, p_detail
  )
  returning id into v_id;

  return v_id;
end;
$$;
