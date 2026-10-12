-- Email Command Centre: migration verification
-- Concludo Workspace. Not a migration. Run it after 0001 to 0003, on a scratch
-- database, to prove the things the other three files claim.
--
-- Each check raises on failure, so a clean run is the result. Run it with
-- ON_ERROR_STOP=1 or the failures scroll past.
--
--   psql -v ON_ERROR_STOP=1 -f 0099_verify.sql
--
-- It creates two users and two accounts, then tries to cross every boundary
-- the schema is supposed to hold: read another person's rows, write a child
-- row against the wrong account, change an audit line, store an extraction
-- with no source, store an analysed row with no provenance, and grant a denied
-- capability. Every one has to fail.

begin;

-- Notices are the output of this file: each block raises one when it passes.
set local client_min_messages to notice;

do $$
declare
  v_alex uuid;
  v_sam uuid;
  v_alex_work uuid;
  v_alex_personal uuid;
  v_thread uuid;
  v_analysis uuid;
  v_audit_id bigint;
  v_count int;
  v_result jsonb;
  v_failed text;
begin
  -- Two people, each with their own account.
  insert into auth.users default values returning id into v_alex;
  insert into auth.users default values returning id into v_sam;

  insert into ecc_account (owner_id, provider, account_type, label, primary_address, owned_addresses)
  values (v_alex, 'synthetic', 'work', 'Work', 'alex@practice.example', array['alex@practice.example'])
  returning id into v_alex_work;

  insert into ecc_account (owner_id, provider, account_type, label, primary_address, owned_addresses)
  values (v_alex, 'synthetic', 'personal', 'Personal', 'alex@home.example', array['alex@home.example'])
  returning id into v_alex_personal;

  insert into ecc_preference (account_id, owner_id) values (v_alex_work, v_alex);

  insert into ecc_thread (
    owner_id, account_id, provider_thread_id, subject, folder,
    first_message_at, last_message_at, participants
  )
  values (
    v_alex, v_alex_work, 'prov-1', 'A test thread', 'inbox',
    now() - interval '2 days', now() - interval '1 day', array['someone@client.example']
  )
  returning id into v_thread;

  /* ---------------------------------------------- 1. provenance constraint */

  begin
    insert into ecc_analysis (owner_id, account_id, thread_id, analysed)
    values (v_alex, v_alex_work, v_thread, true);
    raise exception 'FAILED: an analysed row with no provenance was stored.';
  exception
    when check_violation then null;
  end;

  insert into ecc_analysis (
    owner_id, account_id, thread_id, analysed, model, prompt_version, schema_version,
    generated_at, confidence, one_line_summary, priority_score, priority_band
  )
  values (
    v_alex, v_alex_work, v_thread, true, 'synthetic-no-model', 'icc-2026-10', 'ecc-analysis-v2',
    now(), 'high', 'A test analysis.', 62, 'today'
  )
  returning id into v_analysis;

  /* -------------------------------------------- 2. every extraction has a source */

  begin
    insert into ecc_extraction (
      owner_id, account_id, thread_id, analysis_id, kind, description, basis, confidence
    )
    values (v_alex, v_alex_work, v_thread, v_analysis, 'deadline', 'No source', 'stated', 'high');
    raise exception 'FAILED: an extraction with no source was stored.';
  exception
    when check_violation then null;
  end;

  insert into ecc_extraction (
    owner_id, account_id, thread_id, analysis_id, kind, description, basis, confidence, due_at, sources
  )
  values (
    v_alex, v_alex_work, v_thread, v_analysis, 'deadline', 'Reply by Friday', 'stated', 'high',
    now() + interval '3 days',
    '[{"message_id": "prov-m-1", "quote": "by Friday"}]'::jsonb
  );

  /* ------------------------------------- 3. an inferred date cannot pose as stated */

  begin
    insert into ecc_extraction (
      owner_id, account_id, thread_id, analysis_id, kind, description, basis, confidence, sources
    )
    values (
      v_alex, v_alex_work, v_thread, v_analysis, 'deadline', 'Guessed', 'guessed', 'low',
      '[{"message_id": "x", "quote": "y"}]'::jsonb
    );
    raise exception 'FAILED: an unknown basis was accepted.';
  exception
    when check_violation then null;
  end;

  /* ------------------------------------------- 4. the account boundary trigger */

  begin
    insert into ecc_analysis (
      owner_id, account_id, thread_id, analysed, model, prompt_version, schema_version,
      generated_at, confidence
    )
    values (
      v_alex, v_alex_personal, v_thread, true, 'm', 'p', 's', now(), 'high'
    );
    raise exception 'FAILED: a personal-account analysis was attached to a work thread.';
  exception
    when raise_exception then
      if position('never combined' in sqlerrm) = 0 then
        raise exception 'FAILED: the cross-account refusal did not explain itself: %', sqlerrm;
      end if;
    when unique_violation then null;
  end;

  /* ---------------------------------------- 5. denied capabilities cannot be granted */

  foreach v_failed in array array['send_message', 'archive_message', 'delete_message', 'modify_labels', 'create_calendar_event']
  loop
    begin
      insert into ecc_capability_grant (owner_id, account_id, capability, granted_by)
      values (v_alex, v_alex_work, v_failed, v_alex);
      raise exception 'FAILED: the denied capability % was granted.', v_failed;
    exception
      when check_violation then null;
    end;
  end loop;

  insert into ecc_capability_grant (owner_id, account_id, capability, granted_by)
  values (v_alex, v_alex_work, 'write_draft_to_mailbox', v_alex);

  /* --------------------------------------- 6. a security alert is always advisory */

  begin
    insert into ecc_security_alert (
      owner_id, account_id, thread_id, flags, severity, explanation, recommended_check, disposition
    )
    values (
      v_alex, v_alex_work, v_thread, array['suspicious_link'], 'medium', 'A test alert.',
      'Ring them.', 'quarantined'
    );
    raise exception 'FAILED: a non-advisory disposition was stored.';
  exception
    when check_violation then null;
  end;

  /* ------------------------------------------- 7. approvals are per action, per payload */

  insert into ecc_action_approval (
    owner_id, account_id, thread_id, action_kind, payload_fingerprint,
    approved_summary, approved_snapshot, approved_by
  )
  values (
    v_alex, v_alex_work, v_thread, 'save_draft_to_mailbox', 'pl-abc-1',
    'A draft', '{"body": "text"}'::jsonb, v_alex
  );

  begin
    insert into ecc_action_approval (
      owner_id, account_id, thread_id, action_kind, payload_fingerprint,
      approved_summary, approved_snapshot, approved_by
    )
    values (
      v_alex, v_alex_work, v_thread, 'save_draft_to_mailbox', 'pl-abc-1',
      'The same payload twice', '{"body": "text"}'::jsonb, v_alex
    );
    raise exception 'FAILED: the same payload was approved twice.';
  exception
    when unique_violation then null;
  end;

  begin
    insert into ecc_action_approval (
      owner_id, account_id, thread_id, action_kind, payload_fingerprint,
      approved_summary, approved_snapshot, approved_by
    )
    values (
      v_alex, v_alex_work, v_thread, 'forward_message', 'pl-abc-2',
      'Not a declared action', '{}'::jsonb, v_alex
    );
    raise exception 'FAILED: an undeclared action kind was approved.';
  exception
    when check_violation then null;
  end;

  /* ------------------------------------------ 8. the eight backlog states, and no others */

  insert into ecc_backlog_session (owner_id, account_id, selection, thread_order)
  values (v_alex, v_alex_work, '{"batchSize": 25}'::jsonb, array[v_thread]);

  begin
    insert into ecc_backlog_decision (owner_id, account_id, session_id, thread_id, state)
    select v_alex, v_alex_work, s.id, v_thread, 'archived'
      from ecc_backlog_session s where s.account_id = v_alex_work limit 1;
    raise exception 'FAILED: a ninth backlog state was accepted.';
  exception
    when check_violation then null;
  end;

  insert into ecc_backlog_decision (owner_id, account_id, session_id, thread_id, state)
  select v_alex, v_alex_work, s.id, v_thread, 'reviewed'
    from ecc_backlog_session s where s.account_id = v_alex_work limit 1;

  /* ----------------------------------------------------- 9. export is honest */

  insert into ecc_audit_event (owner_id, account_id, kind, actor, description)
  values (v_alex, v_alex_work, 'thread_analysed', 'concludo-pipeline', 'A test audit line.')
  returning id into v_audit_id;

  v_result := ecc_export_account(v_alex_work);

  if v_result -> 'account' ? 'token_handle' then
    raise exception 'FAILED: the export carried a token handle.';
  end if;
  if jsonb_array_length(v_result -> 'not_included') < 3 then
    raise exception 'FAILED: the export does not say what it left out.';
  end if;
  if jsonb_array_length(v_result -> 'threads') <> 1 then
    raise exception 'FAILED: the export is missing the thread.';
  end if;

  /* -------------------------------------------- 10. deletion says what survives */

  v_result := ecc_delete_account_data(v_alex_work);

  if (v_result -> 'mail_deleted')::boolean then
    raise exception 'FAILED: the deletion claimed to delete mail.';
  end if;
  if jsonb_array_length(v_result -> 'retains') < 3 then
    raise exception 'FAILED: the deletion does not name what survives.';
  end if;

  select count(*) into v_count from ecc_analysis where account_id = v_alex_work;
  if v_count <> 0 then
    raise exception 'FAILED: analysis survived the deletion.';
  end if;

  select count(*) into v_count from ecc_thread where account_id = v_alex_work;
  if v_count <> 0 then
    raise exception 'FAILED: threads survived the deletion.';
  end if;

  select count(*) into v_count from ecc_audit_event where account_id = v_alex_work;
  if v_count < 2 then
    raise exception 'FAILED: the audit trail did not survive, and the retains block says it does.';
  end if;

  select count(*) into v_count
    from ecc_account where id = v_alex_work and token_handle is null and disconnected_at is not null;
  if v_count <> 1 then
    raise exception 'FAILED: the account was not disconnected and its handle not cleared.';
  end if;

  raise notice 'All schema checks passed.';
end
$$;

/* -------------------------------------- 11. row-level security, as a real user */

-- Everything above ran as the owner, which `force row level security` does not
-- exempt but which also holds no JWT. These two blocks set a claim and check
-- that one person cannot see another's rows.

do $$
declare
  v_a uuid;
  v_b uuid;
  v_seen int;
begin
  insert into auth.users default values returning id into v_a;
  insert into auth.users default values returning id into v_b;

  insert into ecc_account (owner_id, provider, account_type, label, primary_address)
  values (v_a, 'synthetic', 'work', 'A work', 'a@example.invalid');
  insert into ecc_account (owner_id, provider, account_type, label, primary_address)
  values (v_b, 'synthetic', 'work', 'B work', 'b@example.invalid');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  select count(*) into v_seen from ecc_account;
  if v_seen <> 1 then
    raise exception 'FAILED: user A can see % accounts, and should see 1.', v_seen;
  end if;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  select count(*) into v_seen from ecc_account;
  if v_seen <> 1 then
    raise exception 'FAILED: user B can see % accounts, and should see 1.', v_seen;
  end if;

  -- Writing a row owned by somebody else is refused by the insert policy.
  begin
    insert into ecc_account (owner_id, provider, account_type, label, primary_address)
    values (v_a, 'synthetic', 'work', 'Planted', 'planted@example.invalid');
    raise exception 'FAILED: user B inserted a row owned by user A.';
  exception
    when insufficient_privilege then null;
  end;

  reset role;
  raise notice 'Row-level security checks passed.';
end
$$;

/* ------------------------------------------- 12. the audit trail is append only */

do $$
declare
  v_c uuid;
  v_account uuid;
begin
  insert into auth.users default values returning id into v_c;
  insert into ecc_account (owner_id, provider, account_type, label, primary_address)
  values (v_c, 'synthetic', 'work', 'C work', 'c@example.invalid')
  returning id into v_account;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_c::text, true);

  insert into ecc_audit_event (owner_id, account_id, kind, actor, description)
  values (v_c, v_account, 'thread_analysed', 'concludo-pipeline', 'Original line.');

  begin
    update ecc_audit_event set description = 'Rewritten.' where owner_id = v_c;
    raise exception 'FAILED: an audit line was rewritten.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from ecc_audit_event where owner_id = v_c;
    raise exception 'FAILED: an audit line was deleted.';
  exception
    when insufficient_privilege then null;
  end;

  reset role;
  raise notice 'Audit append-only checks passed.';
end
$$;

rollback;
