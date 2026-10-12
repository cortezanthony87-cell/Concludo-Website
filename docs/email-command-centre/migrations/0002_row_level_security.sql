-- Email Command Centre: row-level security and grants
-- Concludo Workspace. Migration 0002. Run after 0001.
--
-- The rule: a person can read and write only their own rows, the audit trail
-- can be added to and never changed, and nothing in the schema is readable
-- without a policy. Postgres denies by default once RLS is enabled, so the
-- `enable row level security` lines below are the security control and the
-- policies are the narrow exceptions to them.
--
-- Two things worth stating plainly.
--
-- `force row level security` is set as well as `enable`. Without it, the table
-- owner bypasses every policy, which means a migration run as the owner, or a
-- function running as the owner, reads everything. That is exactly the path by
-- which "we have RLS" turns out not to be true.
--
-- The audit table gets INSERT and SELECT and nothing else. An audit trail the
-- application can update is a log, not an audit trail.

begin;

-- ------------------------------------------------------------ enable RLS

do $$
declare
  t text;
begin
  foreach t in array array[
    'ecc_account', 'ecc_capability_grant', 'ecc_preference', 'ecc_thread',
    'ecc_message', 'ecc_attachment', 'ecc_analysis', 'ecc_extraction',
    'ecc_security_alert', 'ecc_draft', 'ecc_action_approval',
    'ecc_backlog_session', 'ecc_backlog_decision', 'ecc_correction',
    'ecc_audit_event'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
  end loop;
end
$$;

-- ------------------------------------------------- the owner-scoped policies

-- One policy shape for every table that carries `owner_id`. Written out per
-- table rather than generated, so a reader can see each one and a reviewer can
-- diff them. Each is scoped to the authenticated role: the anonymous role gets
-- nothing anywhere.

do $$
declare
  t text;
begin
  foreach t in array array[
    'ecc_account', 'ecc_capability_grant', 'ecc_preference', 'ecc_thread',
    'ecc_message', 'ecc_attachment', 'ecc_analysis', 'ecc_extraction',
    'ecc_security_alert', 'ecc_draft', 'ecc_action_approval',
    'ecc_backlog_session', 'ecc_backlog_decision', 'ecc_correction'
  ]
  loop
    execute format('drop policy if exists %I_select_own on %I;', t, t);
    execute format(
      'create policy %I_select_own on %I for select to authenticated using (owner_id = auth.uid());',
      t, t
    );

    execute format('drop policy if exists %I_insert_own on %I;', t, t);
    execute format(
      'create policy %I_insert_own on %I for insert to authenticated with check (owner_id = auth.uid());',
      t, t
    );

    execute format('drop policy if exists %I_update_own on %I;', t, t);
    execute format(
      'create policy %I_update_own on %I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());',
      t, t
    );

    execute format('drop policy if exists %I_delete_own on %I;', t, t);
    execute format(
      'create policy %I_delete_own on %I for delete to authenticated using (owner_id = auth.uid());',
      t, t
    );
  end loop;
end
$$;

-- ------------------------------------------------------- the audit exception

-- Readable and writable by its owner, and never changeable by anyone. There is
-- deliberately no update policy and no delete policy: with RLS forced and no
-- policy present, both are denied outright rather than merely discouraged.

drop policy if exists ecc_audit_select_own on ecc_audit_event;
create policy ecc_audit_select_own on ecc_audit_event
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists ecc_audit_insert_own on ecc_audit_event;
create policy ecc_audit_insert_own on ecc_audit_event
  for insert to authenticated with check (owner_id = auth.uid());

-- ----------------------------------------- the account-consistency constraint

-- RLS stops one person reading another's rows. It does not stop one of a
-- person's OWN accounts from being written against another of their accounts,
-- which is the work-and-personal separation the product promises. That needs a
-- constraint of its own.
--
-- A trigger rather than a foreign key, because the check is across two columns
-- that each have their own reference: the child's account must be the same
-- account its parent thread belongs to.

create or replace function ecc_assert_same_account() returns trigger as $$
declare
  parent_account uuid;
begin
  if new.thread_id is null then
    return new;
  end if;
  select account_id into parent_account from ecc_thread where id = new.thread_id;
  if parent_account is null then
    raise exception 'Thread % does not exist.', new.thread_id;
  end if;
  if parent_account <> new.account_id then
    raise exception
      'Refusing the write: the row is for account % and its thread belongs to account %. Work and personal accounts are never combined.',
      new.account_id, parent_account;
  end if;
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ecc_message', 'ecc_analysis', 'ecc_extraction', 'ecc_security_alert',
    'ecc_draft', 'ecc_backlog_decision', 'ecc_correction'
  ]
  loop
    execute format('drop trigger if exists %I_same_account on %I;', t, t);
    execute format(
      'create trigger %I_same_account before insert or update on %I for each row execute function ecc_assert_same_account();',
      t, t
    );
  end loop;
end
$$;

-- --------------------------------------------------------- role level grants

-- The anonymous role gets nothing. Stated explicitly rather than relying on
-- the default, because a later `grant ... to public` somewhere else in the
-- schema would otherwise reach these tables.

do $$
declare
  t text;
begin
  foreach t in array array[
    'ecc_account', 'ecc_capability_grant', 'ecc_preference', 'ecc_thread',
    'ecc_message', 'ecc_attachment', 'ecc_analysis', 'ecc_extraction',
    'ecc_security_alert', 'ecc_draft', 'ecc_action_approval',
    'ecc_backlog_session', 'ecc_backlog_decision', 'ecc_correction',
    'ecc_audit_event'
  ]
  loop
    execute format('revoke all on %I from anon;', t);
  end loop;
end
$$;

-- The authenticated role gets what the policies allow, except on the audit
-- table, where update and delete are revoked at the grant level as well. Two
-- independent controls on the one table that must not be rewritten.

do $$
declare
  t text;
begin
  foreach t in array array[
    'ecc_account', 'ecc_capability_grant', 'ecc_preference', 'ecc_thread',
    'ecc_message', 'ecc_attachment', 'ecc_analysis', 'ecc_extraction',
    'ecc_security_alert', 'ecc_draft', 'ecc_action_approval',
    'ecc_backlog_session', 'ecc_backlog_decision', 'ecc_correction'
  ]
  loop
    execute format('grant select, insert, update, delete on %I to authenticated;', t);
  end loop;
end
$$;

grant select, insert on ecc_audit_event to authenticated;
revoke update, delete on ecc_audit_event from authenticated;
grant usage, select on sequence ecc_audit_event_id_seq to authenticated;

commit;
