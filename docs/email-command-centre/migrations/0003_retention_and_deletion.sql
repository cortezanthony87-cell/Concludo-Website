-- Email Command Centre: retention, export and deletion
-- Concludo Workspace. Migration 0003. Run after 0002.
--
-- Three operations a person is entitled to, implemented as functions so the
-- behaviour lives with the data rather than in whichever service happens to
-- call it.
--
-- The honest part is in `ecc_delete_account_data`. It returns what it kept as
-- well as what it removed. A deletion routine that reports success while an
-- audit trail survives is a deletion routine that will eventually be quoted
-- back at us.

begin;

-- ---------------------------------------------------------------- retention

-- Deletes analysis older than the account's own retention window. It does not
-- touch mail, which is trivially true because Concludo holds none: there is no
-- message body in this schema to delete.
--
-- Threads and message metadata are kept while their analysis is swept, because
-- the thread row is what a later re-analysis attaches to and what the audit
-- trail refers to. What goes is the derived content: summaries, extractions,
-- priorities, drafts and alerts.

create or replace function ecc_retention_sweep(p_account_id uuid, p_now timestamptz default now())
returns table (swept_table text, rows_removed bigint)
language plpgsql
security invoker
as $$
declare
  v_days int;
  v_cutoff timestamptz;
  v_count bigint;
begin
  select analysis_retention_days into v_days from ecc_preference where account_id = p_account_id;
  if v_days is null then
    v_days := 365;
  end if;
  v_cutoff := p_now - make_interval(days => v_days);

  delete from ecc_extraction e
   where e.account_id = p_account_id
     and e.analysis_id in (
       select a.id from ecc_analysis a
        where a.account_id = p_account_id and a.updated_at < v_cutoff
     );
  get diagnostics v_count = row_count;
  return query select 'ecc_extraction'::text, v_count;

  delete from ecc_security_alert
   where account_id = p_account_id and created_at < v_cutoff;
  get diagnostics v_count = row_count;
  return query select 'ecc_security_alert'::text, v_count;

  delete from ecc_draft
   where account_id = p_account_id and updated_at < v_cutoff;
  get diagnostics v_count = row_count;
  return query select 'ecc_draft'::text, v_count;

  delete from ecc_analysis
   where account_id = p_account_id and updated_at < v_cutoff;
  get diagnostics v_count = row_count;
  return query select 'ecc_analysis'::text, v_count;

  -- Finished backlog sessions are working state, not a record. The decisions
  -- go with them.
  delete from ecc_backlog_session
   where account_id = p_account_id and status = 'complete' and updated_at < v_cutoff;
  get diagnostics v_count = row_count;
  return query select 'ecc_backlog_session'::text, v_count;

  insert into ecc_audit_event (owner_id, account_id, thread_id, kind, actor, description, at)
  select owner_id, p_account_id, null, 'retention_sweep', 'concludo-retention',
         format('Swept analysis older than %s days (cutoff %s). Mail was not touched: none is stored.', v_days, v_cutoff),
         p_now
    from ecc_account where id = p_account_id;
end;
$$;

comment on function ecc_retention_sweep is
  'Deletes analysis past the account retention window. Does not delete mail, because none is stored.';

-- ------------------------------------------------------------------- export

-- Everything held for one account, plus an explicit statement of what is NOT
-- included. An export that quietly omits something is worse than one that says
-- what it omits.

create or replace function ecc_export_account(p_account_id uuid)
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (
      select to_jsonb(a) - 'token_handle'
        from ecc_account a where a.id = p_account_id
    ),
    'preference', (select to_jsonb(p) from ecc_preference p where p.account_id = p_account_id),
    'capability_grants', coalesce((
      select jsonb_agg(to_jsonb(g)) from ecc_capability_grant g where g.account_id = p_account_id
    ), '[]'::jsonb),
    'threads', coalesce((
      select jsonb_agg(to_jsonb(t)) from ecc_thread t where t.account_id = p_account_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m)) from ecc_message m where m.account_id = p_account_id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(to_jsonb(x)) from ecc_attachment x where x.account_id = p_account_id
    ), '[]'::jsonb),
    'analyses', coalesce((
      select jsonb_agg(to_jsonb(an)) from ecc_analysis an where an.account_id = p_account_id
    ), '[]'::jsonb),
    'extractions', coalesce((
      select jsonb_agg(to_jsonb(e)) from ecc_extraction e where e.account_id = p_account_id
    ), '[]'::jsonb),
    'security_alerts', coalesce((
      select jsonb_agg(to_jsonb(s)) from ecc_security_alert s where s.account_id = p_account_id
    ), '[]'::jsonb),
    'drafts', coalesce((
      select jsonb_agg(to_jsonb(d)) from ecc_draft d where d.account_id = p_account_id
    ), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(to_jsonb(ap)) from ecc_action_approval ap where ap.account_id = p_account_id
    ), '[]'::jsonb),
    'backlog_sessions', coalesce((
      select jsonb_agg(to_jsonb(b)) from ecc_backlog_session b where b.account_id = p_account_id
    ), '[]'::jsonb),
    'backlog_decisions', coalesce((
      select jsonb_agg(to_jsonb(bd)) from ecc_backlog_decision bd where bd.account_id = p_account_id
    ), '[]'::jsonb),
    'corrections', coalesce((
      select jsonb_agg(to_jsonb(c)) from ecc_correction c where c.account_id = p_account_id
    ), '[]'::jsonb),
    'audit_events', coalesce((
      select jsonb_agg(to_jsonb(ae)) from ecc_audit_event ae where ae.account_id = p_account_id
    ), '[]'::jsonb),
    'not_included', jsonb_build_array(
      'Message bodies. Concludo does not store them: only metadata and the short quotes a source reference needs.',
      'Attachment contents. Processed in memory where enabled, never written.',
      'Access and refresh tokens. Held in the token store outside this database and never exported.',
      'The mail itself, which remains in the provider mailbox and is unaffected by anything here.'
    )
  );
$$;

comment on function ecc_export_account is
  'Everything held for one account, with an explicit not_included list. Never exports a token.';

-- ----------------------------------------------------------------- deletion

-- Removes the account's analysis and working state, and says what survives.
--
-- The audit trail survives by design: it is the record of what the system did,
-- it holds no message content, and deleting it would remove the evidence that
-- the deletion itself happened. The function reports that rather than implying
-- a clean erase.

create or replace function ecc_delete_account_data(
  p_account_id uuid,
  p_keep_audit boolean default true
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_owner uuid;
  v_removed jsonb := '{}'::jsonb;
  v_count bigint;
  v_audit_rows bigint;
begin
  select owner_id into v_owner from ecc_account where id = p_account_id;
  if v_owner is null then
    raise exception 'Account % does not exist, or is not yours to delete.', p_account_id;
  end if;

  delete from ecc_extraction where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('extractions', v_count);

  delete from ecc_security_alert where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('security_alerts', v_count);

  delete from ecc_draft where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('drafts', v_count);

  delete from ecc_action_approval where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('approvals', v_count);

  delete from ecc_backlog_decision where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('backlog_decisions', v_count);

  delete from ecc_backlog_session where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('backlog_sessions', v_count);

  delete from ecc_correction where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('corrections', v_count);

  delete from ecc_analysis where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('analyses', v_count);

  delete from ecc_attachment where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('attachments', v_count);

  delete from ecc_message where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('messages', v_count);

  delete from ecc_thread where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('threads', v_count);

  delete from ecc_capability_grant where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('capability_grants', v_count);

  delete from ecc_preference where account_id = p_account_id;
  get diagnostics v_count = row_count;
  v_removed := v_removed || jsonb_build_object('preferences', v_count);

  select count(*) into v_audit_rows from ecc_audit_event where account_id = p_account_id;

  if not p_keep_audit then
    -- Only an administrator with a direct connection can do this. The
    -- application role has no delete grant on the audit table, so this branch
    -- raises rather than silently succeeding when called by the application.
    delete from ecc_audit_event where account_id = p_account_id;
    get diagnostics v_count = row_count;
    v_removed := v_removed || jsonb_build_object('audit_events', v_count);
    v_audit_rows := 0;
  end if;

  -- The token handle is cleared here; revoking at the provider and destroying
  -- the stored token is the token store's own step, and it is listed in the
  -- retains block below until it reports back.
  update ecc_account
     set token_handle = null,
         sync_cursor = null,
         disconnected_at = now()
   where id = p_account_id;

  insert into ecc_audit_event (owner_id, account_id, thread_id, kind, actor, description)
  values (
    v_owner, p_account_id, null, 'account_data_deleted', 'concludo-privacy',
    format('Analysis and working state deleted for this account. Audit rows kept: %s.', v_audit_rows)
  );

  return jsonb_build_object(
    'account_id', p_account_id,
    'removed', v_removed,
    'retains', jsonb_build_array(
      format('%s audit events, which record what the system did and carry no message content.', v_audit_rows),
      'The ecc_account row itself, with its token handle and cursor cleared, so the same mailbox is not silently re-analysed later.',
      'Whatever the mail provider holds. Concludo cannot delete a message and has never had permission to.',
      'The stored token until the token store confirms its own destruction, which is a separate step outside this database.'
    ),
    'mail_deleted', false,
    'mail_note', 'No mail was deleted. Concludo stores analysis, not mail, and holds no capability that could delete a message.'
  );
end;
$$;

comment on function ecc_delete_account_data is
  'Deletes an account''s analysis and working state and returns both what went and what survives.';

commit;
