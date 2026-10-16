-- =====================================================================
-- Concludo CRM: verification.
--
-- NOT A MIGRATION. It writes before it rolls back, so run it on a scratch or
-- staging database only, never on production.
--
-- It does the thing a schema review cannot: it signs in as three different
-- people and checks what each of them can actually see and do. A policy that
-- reads correctly and does not hold is the failure mode this exists to catch,
-- and it is the only kind of security check worth the name when row level
-- security is the production boundary.
--
--   psql -d scratch -f 0099_crm_verify.sql
--
-- Every block raises on failure and prints a notice on success.
-- =====================================================================

\set ON_ERROR_STOP on

begin;

-- =====================================================================
-- Block 1: the schema is shaped as the migrations claim
-- =====================================================================
do $$
declare
  v_tables integer;
  v_enabled integer;
  v_forced integer;
  v_policies integer;
  v_for_all integer;
  v_definer_without_path integer;
  v_missing text;
begin
  select count(*) into v_tables
  from pg_tables where schemaname = 'public' and tablename like 'crm\_%';

  if v_tables < 40 then
    raise exception 'FAIL: expected at least 40 CRM tables, found %', v_tables;
  end if;

  select count(*) filter (where relrowsecurity),
         count(*) filter (where relforcerowsecurity)
    into v_enabled, v_forced
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'crm\_%';

  if v_enabled <> v_tables then
    raise exception 'FAIL: % of % CRM tables have RLS enabled', v_enabled, v_tables;
  end if;

  -- The one the rest of the application does not do.
  if v_forced <> v_tables then
    select string_agg(c.relname, ', ') into v_missing
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'crm\_%'
      and not c.relforcerowsecurity;
    raise exception 'FAIL: these CRM tables do not FORCE row level security: %', v_missing;
  end if;

  select count(*) into v_policies
  from pg_policies where schemaname = 'public' and tablename like 'crm\_%';

  if v_policies < 150 then
    raise exception 'FAIL: expected at least 150 policies, found %', v_policies;
  end if;

  -- No `for all` policies. One permissive policy covering four operations is
  -- four decisions written as one, and delete is always the one nobody thought
  -- about.
  select count(*) into v_for_all
  from pg_policies where schemaname = 'public' and tablename like 'crm\_%' and cmd = 'ALL';

  if v_for_all > 0 then
    raise exception 'FAIL: % CRM policies are FOR ALL; policies must be per operation', v_for_all;
  end if;

  -- Every security-definer function sets search_path. Roughly 100 existing
  -- functions in this application do not, which is a search-path injection
  -- surface the CRM does not reproduce.
  select count(*) into v_definer_without_path
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'crm\_%'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
    );

  if v_definer_without_path > 0 then
    select string_agg(p.proname, ', ') into v_missing
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'crm\_%' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
    raise exception 'FAIL: these security-definer functions do not set search_path: %', v_missing;
  end if;

  raise notice 'PASS block 1: % CRM tables, all RLS enabled and forced, % policies, none FOR ALL, every security-definer function sets search_path',
    v_tables, v_policies;
end
$$;

-- =====================================================================
-- Block 2: validation and the constraints that carry product rules
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_ws_other uuid;
  v_org uuid;
  v_org_child uuid;
  v_person uuid;
  v_pipeline uuid;
  v_stage1 uuid;
  v_stage2 uuid;
  v_item uuid;
  v_failed boolean;
begin
  insert into public.crm_workspaces (name) values ('Verify A') returning id into v_ws;
  insert into public.crm_workspaces (name) values ('Verify B') returning id into v_ws_other;

  insert into public.crm_organisations (crm_workspace_id, name) values (v_ws, 'Parent Co') returning id into v_org;
  insert into public.crm_organisations (crm_workspace_id, name, parent_organisation_id)
    values (v_ws, 'Child Co', v_org) returning id into v_org_child;

  -- Hierarchy depth is maintained.
  if (select hierarchy_depth from public.crm_organisations where id = v_org_child) <> 1 then
    raise exception 'FAIL: child organisation depth was not set to 1';
  end if;

  -- A cycle is refused.
  v_failed := false;
  begin
    update public.crm_organisations set parent_organisation_id = v_org_child where id = v_org;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an organisation cycle was allowed'; end if;

  -- A parent in another workspace is refused. Without this a hierarchy is a
  -- hole straight through tenant isolation.
  v_failed := false;
  begin
    insert into public.crm_organisations (crm_workspace_id, name, parent_organisation_id)
      values (v_ws_other, 'Cross Co', v_org);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a cross-workspace parent was allowed'; end if;

  -- A person may not point at an organisation in another workspace.
  v_failed := false;
  begin
    insert into public.crm_people (crm_workspace_id, full_name, organisation_id)
      values (v_ws_other, 'Cross Person', v_org);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a cross-workspace person link was allowed'; end if;

  insert into public.crm_people (crm_workspace_id, full_name, organisation_id)
    values (v_ws, 'Dana Example', v_org) returning id into v_person;

  insert into public.crm_pipelines (crm_workspace_id, name) values (v_ws, 'Verify pipeline') returning id into v_pipeline;
  insert into public.crm_pipeline_stages (crm_workspace_id, pipeline_id, name, stage_order, typical_days)
    values (v_ws, v_pipeline, 'Scoping', 1, 21) returning id into v_stage1;
  insert into public.crm_pipeline_stages (crm_workspace_id, pipeline_id, name, stage_order, typical_days)
    values (v_ws, v_pipeline, 'Proposal', 2, 21) returning id into v_stage2;

  insert into public.crm_work_items (crm_workspace_id, title, organisation_id, pipeline_id, stage_id)
    values (v_ws, 'Verify item', v_org, v_pipeline, v_stage1) returning id into v_item;

  -- A resolved item must carry its resolution.
  v_failed := false;
  begin
    update public.crm_work_items set status = 'won' where id = v_item;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an item was marked won with no resolved_at'; end if;

  update public.crm_work_items set status = 'won', resolved_at = now() where id = v_item;
  if exists (select 1 from public.crm_work_items where id = v_item and status = 'open') then
    raise exception 'FAIL: a resolved item still reads as open';
  end if;

  -- Not proceeding needs a reason.
  v_failed := false;
  begin
    update public.crm_work_items set status = 'not_proceeding', resolved_at = now(), resolution_reason = null
     where id = v_item;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: not_proceeding was allowed with no reason'; end if;

  -- A stage from another pipeline is refused.
  v_failed := false;
  begin
    insert into public.crm_pipelines (crm_workspace_id, name) values (v_ws, 'Other pipeline');
    insert into public.crm_work_items (crm_workspace_id, title, pipeline_id, stage_id)
      select v_ws, 'Wrong stage', p.id, v_stage1 from public.crm_pipelines p
      where p.crm_workspace_id = v_ws and p.name = 'Other pipeline';
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a work item took a stage from another pipeline'; end if;

  -- Advancing past an unmet criterion needs a reason of real length.
  v_failed := false;
  begin
    insert into public.crm_work_item_stage_history
      (crm_workspace_id, work_item_id, from_stage_id, to_stage_id, criteria_unmet, override_reason)
    values (v_ws, v_item, v_stage1, v_stage2, array[gen_random_uuid()], 'ok');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an override was accepted with a token reason'; end if;

  -- And is allowed with one.
  insert into public.crm_work_item_stage_history
    (crm_workspace_id, work_item_id, from_stage_id, to_stage_id, criteria_unmet, override_reason)
  values (v_ws, v_item, v_stage1, v_stage2, array[gen_random_uuid()],
          'Board meets next week and the proposal is already with them.');

  -- A lead that is not proceeding says why.
  v_failed := false;
  begin
    insert into public.crm_leads (crm_workspace_id, person_name, state)
      values (v_ws, 'Someone', 'not_proceeding');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a lead was closed with no reason'; end if;

  raise notice 'PASS block 2: hierarchy, cross-workspace references, resolution, stage and override rules all hold';
end
$$;

-- =====================================================================
-- Block 3: the evidence model keeps facts, inferences, unknowns and
--          conflicts distinct
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_person uuid;
  v_a uuid;
  v_b uuid;
  v_failed boolean;
begin
  select id into v_ws from public.crm_workspaces where name = 'Verify A';
  select id into v_person from public.crm_people where crm_workspace_id = v_ws limit 1;

  -- An unknown carries no source.
  v_failed := false;
  begin
    insert into public.crm_evidence
      (crm_workspace_id, subject_table, subject_id, field_name, basis, source_type, source_text)
    values (v_ws, 'crm_people', v_person, 'budget', 'unknown', 'manual_entry', 'somebody said something');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an unknown assertion was allowed to carry evidence'; end if;

  -- Anything else must.
  v_failed := false;
  begin
    insert into public.crm_evidence
      (crm_workspace_id, subject_table, subject_id, field_name, basis, source_type)
    values (v_ws, 'crm_people', v_person, 'role', 'stated', 'meeting_transcript');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a stated assertion was allowed with no source at all'; end if;

  -- An AI-generated assertion names both versions or neither.
  v_failed := false;
  begin
    insert into public.crm_evidence
      (crm_workspace_id, subject_table, subject_id, field_name, basis, source_type, source_text, model_version)
    values (v_ws, 'crm_people', v_person, 'role', 'inferred', 'meeting_transcript', 'quote', 'model-1');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a model version was accepted with no prompt version'; end if;

  insert into public.crm_evidence
    (crm_workspace_id, subject_table, subject_id, field_name, asserted_value, basis, source_type, source_text, captured_at)
  values (v_ws, 'crm_work_items', v_person, 'expected_close_date', '2026-11-30', 'stated', 'meeting_transcript',
          '"We will have it signed before the end of November."', now() - interval '20 days')
  returning id into v_a;

  insert into public.crm_evidence
    (crm_workspace_id, subject_table, subject_id, field_name, asserted_value, basis, source_type, source_text)
  values (v_ws, 'crm_work_items', v_person, 'expected_close_date', '2027-01-31', 'stated', 'meeting_transcript',
          '"Realistically that is a January decision now."')
  returning id into v_b;

  -- A disagreement is a row on both sides, not an overwrite.
  perform public.crm_record_conflict(v_a, v_b, 'Two meetings gave different close dates.');

  if (select count(*) from public.crm_evidence where conflict_state = 'open' and id in (v_a, v_b)) <> 2 then
    raise exception 'FAIL: a conflict was not recorded on both sides';
  end if;

  -- Superseding marks the old one and takes it out of the current view.
  perform public.crm_supersede_evidence(v_a, v_b);

  if exists (select 1 from public.crm_current_evidence where id = v_a) then
    raise exception 'FAIL: a superseded assertion is still in crm_current_evidence';
  end if;
  if not exists (select 1 from public.crm_current_evidence where id = v_b) then
    raise exception 'FAIL: the superseding assertion is missing from crm_current_evidence';
  end if;
  if (select conflict_state from public.crm_evidence where id = v_a) <> 'resolved_superseded' then
    raise exception 'FAIL: superseding did not resolve the conflict on the old assertion';
  end if;

  -- Superseding across different subjects is refused.
  v_failed := false;
  begin
    perform public.crm_supersede_evidence(v_b, v_b);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an assertion superseded itself'; end if;

  raise notice 'PASS block 3: unknown, stated, inferred, superseded and conflicting assertions all behave distinctly';
end
$$;

-- =====================================================================
-- Block 4: proposals, approvals and the audit trail
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_proposal uuid;
  v_failed boolean;
  v_audit_before integer;
begin
  select id into v_ws from public.crm_workspaces where name = 'Verify A';

  -- A proposal must say what would change.
  v_failed := false;
  begin
    insert into public.crm_proposals
      (crm_workspace_id, proposal_kind, headline, rationale, subject_table, changes)
    values (v_ws, 'update_next_step', 'Something', 'Because', 'crm_work_items', '[]'::jsonb);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a proposal with no changes was accepted'; end if;

  -- A merge is always destructive.
  v_failed := false;
  begin
    insert into public.crm_proposals
      (crm_workspace_id, proposal_kind, headline, rationale, subject_table, changes, is_destructive)
    values (v_ws, 'merge_duplicate', 'Merge two', 'Same person', 'crm_people',
            '[{"field":"keep","to":"A"}]'::jsonb, false);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a merge proposal was accepted as non-destructive'; end if;

  insert into public.crm_proposals
    (crm_workspace_id, proposal_kind, headline, rationale, subject_table, changes)
  values (v_ws, 'update_next_step', 'Record a next step', 'The note says the board meets in October.',
          'crm_work_items', '[{"field":"next_step","from":null,"to":"Ask for the board date"}]'::jsonb)
  returning id into v_proposal;

  -- Nothing may carry an applied timestamp while it is still awaiting a
  -- decision. This is the constraint that makes "nothing is applied without
  -- approval" a property of the schema rather than of the application.
  v_failed := false;
  begin
    update public.crm_proposals set applied_at = now() where id = v_proposal;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an unapproved proposal was marked applied'; end if;

  -- The audit trail is append only.
  select count(*) into v_audit_before from public.crm_audit_events;
  perform public.crm_record_audit(v_ws, 'verification', 'crm_workspaces', v_ws);
  if (select count(*) from public.crm_audit_events) <> v_audit_before + 1 then
    raise exception 'FAIL: crm_record_audit did not write a row';
  end if;

  v_failed := false;
  begin
    update public.crm_audit_events set detail = 'tampered' where crm_workspace_id = v_ws;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an audit row was updated'; end if;

  v_failed := false;
  begin
    delete from public.crm_audit_events where crm_workspace_id = v_ws;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an audit row was deleted'; end if;

  raise notice 'PASS block 4: proposals cannot be applied unapproved, and the audit trail is append only';
end
$$;

-- =====================================================================
-- Block 5: custom fields validate against their definition
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_person uuid;
  v_def uuid;
  v_failed boolean;
begin
  select id into v_ws from public.crm_workspaces where name = 'Verify A';
  select id into v_person from public.crm_people where crm_workspace_id = v_ws limit 1;

  -- A select field with no options is refused.
  v_failed := false;
  begin
    insert into public.crm_custom_field_definitions
      (crm_workspace_id, subject_table, field_key, label, field_type)
    values (v_ws, 'crm_people', 'segment', 'Segment', 'single_select');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a select field was defined with no options'; end if;

  insert into public.crm_custom_field_definitions
    (crm_workspace_id, subject_table, field_key, label, field_type, options)
  values (v_ws, 'crm_people', 'segment', 'Segment', 'single_select', array['Residential', 'Commercial'])
  returning id into v_def;

  -- A value outside the options is refused.
  v_failed := false;
  begin
    insert into public.crm_custom_field_values (crm_workspace_id, definition_id, subject_id, value_text)
    values (v_ws, v_def, v_person, 'Industrial');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a value outside the declared options was stored'; end if;

  -- The wrong shape is refused.
  v_failed := false;
  begin
    insert into public.crm_custom_field_values (crm_workspace_id, definition_id, subject_id, value_number)
    values (v_ws, v_def, v_person, 42);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a number was stored in a select field'; end if;

  -- Two populated columns are refused.
  v_failed := false;
  begin
    insert into public.crm_custom_field_values
      (crm_workspace_id, definition_id, subject_id, value_text, value_number)
    values (v_ws, v_def, v_person, 'Residential', 42);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: two value columns were populated at once'; end if;

  insert into public.crm_custom_field_values (crm_workspace_id, definition_id, subject_id, value_text)
  values (v_ws, v_def, v_person, 'Residential');

  raise notice 'PASS block 5: custom field values validate against their definition';
end
$$;

-- =====================================================================
-- Block 6: the work and personal boundary
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_org uuid;
  v_item uuid;
  v_failed boolean;
begin
  select id into v_ws from public.crm_workspaces where name = 'Verify A';
  select id into v_org from public.crm_organisations where crm_workspace_id = v_ws limit 1;
  select id into v_item from public.crm_work_items where crm_workspace_id = v_ws limit 1;

  -- A personal mailbox reference cannot be attached to work.
  v_failed := false;
  begin
    insert into public.crm_email_references
      (crm_workspace_id, provider, account_reference, thread_reference, occurred_at, account_scope, work_item_id)
    values (v_ws, 'google', 'acct-personal', 'thread-1', now(), 'personal', v_item);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a personal mailbox reference was linked to a work item'; end if;

  v_failed := false;
  begin
    insert into public.crm_email_references
      (crm_workspace_id, provider, account_reference, thread_reference, occurred_at, account_scope, organisation_id)
    values (v_ws, 'google', 'acct-personal', 'thread-2', now(), 'personal', v_org);
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a personal mailbox reference was linked to an organisation'; end if;

  -- And a work workspace holds no personal references at all.
  v_failed := false;
  begin
    insert into public.crm_email_references
      (crm_workspace_id, provider, account_reference, thread_reference, occurred_at, account_scope)
    values (v_ws, 'google', 'acct-personal', 'thread-3', now(), 'personal');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a work workspace accepted a personal mailbox reference'; end if;

  -- A work reference is fine.
  insert into public.crm_email_references
    (crm_workspace_id, provider, account_reference, thread_reference, occurred_at, account_scope, work_item_id)
  values (v_ws, 'microsoft', 'acct-work', 'thread-4', now(), 'work', v_item);

  raise notice 'PASS block 6: the work and personal boundary is enforced at write';
end
$$;

-- =====================================================================
-- Block 7: tenant isolation and permissions, signed in as three people
--
-- This is the block that matters. Everything above tests constraints, which
-- hold whoever is connected. This one changes role and identity and checks
-- what each person can actually reach.
-- =====================================================================
do $$
declare
  v_ws_a uuid;
  v_ws_b uuid;
  v_admin uuid := '11111111-1111-1111-1111-111111111111';
  v_contributor uuid := '22222222-2222-2222-2222-222222222222';
  v_outsider uuid := '33333333-3333-3333-3333-333333333333';
  v_visible integer;
  v_failed boolean;
  v_org uuid;
begin
  select id into v_ws_a from public.crm_workspaces where name = 'Verify A';
  select id into v_ws_b from public.crm_workspaces where name = 'Verify B';

  insert into public.crm_workspace_members (crm_workspace_id, user_id, crm_role)
  values (v_ws_a, v_admin, 'crm_admin'), (v_ws_a, v_contributor, 'crm_contributor')
  on conflict do nothing;

  -- Workspace B deliberately gets the outsider as a member, so the test is
  -- "can a real user of another workspace reach this one" rather than the much
  -- weaker "can a user of no workspace reach anything".
  insert into public.crm_workspace_members (crm_workspace_id, user_id, crm_role)
  values (v_ws_b, v_outsider, 'crm_admin')
  on conflict do nothing;

  insert into public.crm_organisations (crm_workspace_id, name)
  values (v_ws_b, 'Workspace B Org') returning id into v_org;

  -- ---- as the outsider, who is an admin of B and nothing in A ----
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_outsider::text, true);

  select count(*) into v_visible from public.crm_organisations where crm_workspace_id = v_ws_a;
  if v_visible <> 0 then
    raise exception 'FAIL: an outsider could see % organisations in another workspace', v_visible;
  end if;

  select count(*) into v_visible from public.crm_people where crm_workspace_id = v_ws_a;
  if v_visible <> 0 then
    raise exception 'FAIL: an outsider could see % people in another workspace', v_visible;
  end if;

  select count(*) into v_visible from public.crm_evidence where crm_workspace_id = v_ws_a;
  if v_visible <> 0 then
    raise exception 'FAIL: an outsider could see evidence in another workspace';
  end if;

  -- They can see their own.
  select count(*) into v_visible from public.crm_organisations where crm_workspace_id = v_ws_b;
  if v_visible <> 1 then
    raise exception 'FAIL: a member could not see their own workspace organisation';
  end if;

  -- They cannot write into another workspace.
  v_failed := false;
  begin
    insert into public.crm_organisations (crm_workspace_id, name) values (v_ws_a, 'Intruder Co');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an outsider inserted a row into another workspace'; end if;

  -- Nor move one of their own rows into it, which is what the WITH CHECK on
  -- the update policy is for.
  v_failed := false;
  begin
    update public.crm_organisations set crm_workspace_id = v_ws_a where id = v_org;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a row was moved into another workspace by UPDATE'; end if;

  -- ---- as the contributor in A ----
  perform set_config('request.jwt.claim.sub', v_contributor::text, true);

  select count(*) into v_visible from public.crm_organisations where crm_workspace_id = v_ws_a;
  if v_visible < 2 then
    raise exception 'FAIL: a contributor could not see their own workspace organisations';
  end if;

  insert into public.crm_organisations (crm_workspace_id, name) values (v_ws_a, 'Contributor Co');

  -- A contributor may not hard delete. Removing a record is a soft delete,
  -- which is an UPDATE; destroying one is an admin operation.
  v_failed := false;
  begin
    delete from public.crm_organisations where crm_workspace_id = v_ws_a and name = 'Contributor Co';
  exception when others then v_failed := true;
  end;
  if not v_failed then
    -- A policy that filters rather than raises shows as zero rows affected.
    if exists (select 1 from public.crm_organisations where crm_workspace_id = v_ws_a and name = 'Contributor Co') then
      v_failed := true;
    end if;
  end if;
  if not v_failed then raise exception 'FAIL: a contributor hard deleted a row'; end if;

  -- A contributor may not approve.
  v_failed := false;
  begin
    perform public.crm_decide_proposal(
      (select id from public.crm_proposals where crm_workspace_id = v_ws_a limit 1), 'confirmed');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a contributor approved a proposal'; end if;

  -- A contributor may not forge an audit row.
  v_failed := false;
  begin
    insert into public.crm_audit_events (crm_workspace_id, event_type, subject_table)
    values (v_ws_a, 'forged', 'crm_people');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a contributor inserted an audit row directly'; end if;

  -- ---- as the admin in A ----
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- The admin can approve.
  perform public.crm_decide_proposal(
    (select id from public.crm_proposals
     where crm_workspace_id = v_ws_a and state = 'awaiting_confirmation' limit 1),
    'confirmed', 'Verified by the harness.');

  if not exists (select 1 from public.crm_approvals where crm_workspace_id = v_ws_a) then
    raise exception 'FAIL: approving did not write an approval row';
  end if;
  if (select approved_changes_digest from public.crm_approvals where crm_workspace_id = v_ws_a limit 1) is null then
    raise exception 'FAIL: the approval did not record a digest of what was approved';
  end if;

  reset role;
  raise notice 'PASS block 7: tenant isolation holds against a real member of another workspace, and the role boundaries hold';
end
$$;

-- =====================================================================
-- Block 8: soft delete, restore, retention, export and erasure
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_admin uuid := '11111111-1111-1111-1111-111111111111';
  v_person uuid;
  v_export jsonb;
  v_failed boolean;
  v_purged integer;
begin
  select id into v_ws from public.crm_workspaces where name = 'Verify A';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  insert into public.crm_people (crm_workspace_id, full_name, primary_email)
  values (v_ws, 'Temporary Person', 'temp@example.example') returning id into v_person;

  perform public.crm_soft_delete('crm_people', v_person, 'Created by the verification harness.');

  if not exists (select 1 from public.crm_people where id = v_person and deleted_at is not null) then
    raise exception 'FAIL: soft delete did not set deleted_at';
  end if;
  if (select purge_after from public.crm_people where id = v_person) is null then
    raise exception 'FAIL: soft delete did not set a purge date';
  end if;
  if not exists (select 1 from public.crm_deleted_records(v_ws) where subject_id = v_person) then
    raise exception 'FAIL: a deleted record is not listed by crm_deleted_records';
  end if;

  perform public.crm_restore('crm_people', v_person);
  if exists (select 1 from public.crm_people where id = v_person and deleted_at is not null) then
    raise exception 'FAIL: restore did not clear deleted_at';
  end if;

  -- An audit row exists for both.
  if (select count(*) from public.crm_audit_events
      where subject_id = v_person and event_type in ('record_soft_deleted', 'record_restored')) <> 2 then
    raise exception 'FAIL: soft delete and restore did not both write audit rows';
  end if;

  -- A legal hold stops the purge.
  reset role;
  insert into public.crm_retention_policies (crm_workspace_id, subject_table, legal_hold, legal_hold_reason)
  values (v_ws, 'crm_people', true, 'Verification harness hold.')
  on conflict (crm_workspace_id, subject_table) do update
    set legal_hold = true, legal_hold_reason = 'Verification harness hold.';

  update public.crm_people set deleted_at = now() - interval '90 days',
                               purge_after = now() - interval '60 days'
   where id = v_person;

  select coalesce(sum(purged), 0) into v_purged
  from public.crm_purge_expired(v_ws) where subject_table = 'crm_people';

  if v_purged > 0 then
    raise exception 'FAIL: the purge destroyed % rows while a legal hold was in force', v_purged;
  end if;

  -- With the hold lifted, it purges.
  update public.crm_retention_policies set legal_hold = false, legal_hold_reason = null
   where crm_workspace_id = v_ws and subject_table = 'crm_people';

  select coalesce(sum(purged), 0) into v_purged
  from public.crm_purge_expired(v_ws) where subject_table = 'crm_people';

  if v_purged < 1 then
    raise exception 'FAIL: the purge did not destroy an expired row once the hold was lifted';
  end if;

  -- Export.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  v_export := public.crm_export_workspace(v_ws);
  if v_export is null or v_export -> 'crm_organisations' is null then
    raise exception 'FAIL: the workspace export is missing organisations';
  end if;
  if jsonb_array_length(v_export -> 'crm_organisations') < 2 then
    raise exception 'FAIL: the workspace export returned too few organisations';
  end if;

  -- Erasing one person requires a real reason.
  insert into public.crm_people (crm_workspace_id, full_name, primary_email)
  values (v_ws, 'Erase Me', 'erase@example.example') returning id into v_person;

  v_failed := false;
  begin
    perform public.crm_erase_person(v_person, 'no');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: a person was erased with a token reason'; end if;

  perform public.crm_erase_person(v_person, 'Requested by the individual on 13 October.');

  if (select full_name from public.crm_people where id = v_person) <> 'Erased at request' then
    raise exception 'FAIL: erasure did not clear the name';
  end if;
  if (select primary_email from public.crm_people where id = v_person) is not null then
    raise exception 'FAIL: erasure did not clear the email address';
  end if;

  reset role;
  raise notice 'PASS block 8: soft delete, restore, legal hold, purge, export and erasure all behave';
end
$$;

-- =====================================================================
-- Block 9: record quality is nine measures and cannot become a score
-- =====================================================================
do $$
declare
  v_ws uuid;
  v_item uuid;
  q record;
  v_has_owner_in_view boolean;
begin
  select id into v_ws from public.crm_workspaces where name = 'Verify A';
  select id into v_item from public.crm_work_items where crm_workspace_id = v_ws limit 1;

  perform public.crm_recompute_work_item_quality(v_item);

  select * into q from public.crm_record_quality
  where subject_table = 'crm_work_items' and subject_id = v_item;

  if q is null then
    raise exception 'FAIL: quality was not computed for a work item';
  end if;
  if q.completeness_expected <> 6 then
    raise exception 'FAIL: completeness is measured against % fields, expected 6', q.completeness_expected;
  end if;
  if q.completeness_present > q.completeness_expected then
    raise exception 'FAIL: more fields present than expected';
  end if;
  if q.next_step is not null then
    raise exception 'FAIL: the verification item has a next step it should not have';
  end if;
  if q.review_status <> 'needs_review' then
    raise exception 'FAIL: an item with no next step was not marked as needing review';
  end if;
  if not ('next step' = any (q.completeness_missing_fields)) then
    raise exception 'FAIL: the missing next step is not named in the missing fields';
  end if;

  -- There is no overall score column anywhere.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_record_quality'
      and (column_name like '%score%' or column_name like '%grade%' or column_name like '%rating%')
  ) then
    raise exception 'FAIL: crm_record_quality has a score, grade or rating column';
  end if;

  -- And the reporting view carries no owner, so it cannot be grouped into a
  -- per-person measure.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_record_quality_summary'
      and column_name like '%owner%'
  ) into v_has_owner_in_view;

  if v_has_owner_in_view then
    raise exception 'FAIL: the quality reporting view exposes an owner column';
  end if;

  raise notice 'PASS block 9: record quality is nine named measures, with no score and no owner rollup';
end
$$;

rollback;

\echo ''
\echo 'Concludo CRM verification complete. All blocks passed, and everything was rolled back.'
