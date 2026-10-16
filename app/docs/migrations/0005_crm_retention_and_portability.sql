-- =====================================================================
-- Concludo CRM, migration 0005: deletion, restoration, retention, export.
--
-- A CRM is the first part of Concludo that holds significant personal
-- information about people who are not users and have never agreed to
-- anything. That makes four operations load-bearing rather than
-- housekeeping:
--
-- - **Soft delete**, so a mistake is survivable.
-- - **Restore**, so a mistake is correctable by the person who made it rather
--   than by a support ticket.
-- - **Purge**, so a deletion promise is kept rather than described.
-- - **Export**, because APP 12 gives a person a right of access to
--   information held about them, and a right nobody can exercise is not a
--   right. There is no such routine anywhere in the application today, and the
--   CRM creates the first real need for one.
--
-- Every destructive routine respects a legal hold. A hold that can be
-- overridden by a scheduled job is not a hold.
--
-- Idempotent. Verified against PostgreSQL 16.13.
-- =====================================================================

-- The tables that carry the soft-delete triple, in one place, so the deletion
-- routines below cannot quietly miss one when a table is added.
create or replace function public.crm_soft_deletable_tables()
returns text[]
language sql
immutable
as $$
  select array[
    'crm_organisations', 'crm_people', 'crm_relationships', 'crm_leads',
    'crm_pipelines', 'crm_work_items', 'crm_activities', 'crm_email_references',
    'crm_notes', 'crm_tasks', 'crm_commitments', 'crm_decisions',
    'crm_products', 'crm_quotes', 'crm_order_references', 'crm_invoice_references',
    'crm_service_cases', 'crm_account_plans', 'crm_attachment_references',
    'crm_custom_field_definitions', 'crm_custom_object_definitions',
    'crm_custom_object_records', 'crm_evidence', 'crm_proposals'
  ];
$$;

-- =====================================================================
-- 1. Soft delete and restore
-- =====================================================================

create or replace function public.crm_soft_delete(
  p_table text,
  p_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_retain integer;
  v_before jsonb;
begin
  if not (p_table = any (public.crm_soft_deletable_tables())) then
    raise exception 'crm_soft_delete: % is not a soft-deletable table', p_table;
  end if;

  execute format('select crm_workspace_id, to_jsonb(t) from public.%I t where id = $1 and deleted_at is null', p_table)
    into v_workspace, v_before using p_id;

  if v_workspace is null then
    raise exception 'crm_soft_delete: % % does not exist or is already deleted', p_table, p_id;
  end if;

  if not public.crm_has_role(v_workspace, 'crm_contributor') then
    raise exception 'crm_soft_delete: removing a record requires the crm_contributor role';
  end if;

  select coalesce(retain_deleted_days, 30) into v_retain
  from public.crm_retention_policies
  where crm_workspace_id = v_workspace and subject_table = p_table;

  v_retain := coalesce(v_retain, 30);

  execute format(
    'update public.%I set deleted_at = now(), deleted_by = $1, purge_after = now() + ($2 || '' days'')::interval where id = $3',
    p_table
  ) using auth.uid(), v_retain::text, p_id;

  perform public.crm_record_audit(
    v_workspace, 'record_soft_deleted', p_table, p_id, v_before, null, 'user', 'success', p_reason
  );
end;
$$;

create or replace function public.crm_restore(
  p_table text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_after jsonb;
begin
  if not (p_table = any (public.crm_soft_deletable_tables())) then
    raise exception 'crm_restore: % is not a soft-deletable table', p_table;
  end if;

  execute format('select crm_workspace_id from public.%I where id = $1 and deleted_at is not null', p_table)
    into v_workspace using p_id;

  if v_workspace is null then
    raise exception 'crm_restore: % % is not in the deleted state', p_table, p_id;
  end if;

  if not public.crm_has_role(v_workspace, 'crm_contributor') then
    raise exception 'crm_restore: restoring a record requires the crm_contributor role';
  end if;

  execute format('update public.%I set deleted_at = null, deleted_by = null, purge_after = null where id = $1', p_table)
    using p_id;

  execute format('select to_jsonb(t) from public.%I t where id = $1', p_table)
    into v_after using p_id;

  perform public.crm_record_audit(
    v_workspace, 'record_restored', p_table, p_id, null, v_after
  );
end;
$$;

-- What is currently in the deleted state and how long is left on it. A
-- "recently deleted" view a person can actually act on, rather than a promise
-- that something is recoverable with no way to see it.
create or replace function public.crm_deleted_records(p_workspace_id uuid)
returns table (
  subject_table text,
  subject_id uuid,
  deleted_at timestamptz,
  purge_after timestamptz,
  days_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  if not public.crm_is_member(p_workspace_id) then
    raise exception 'crm_deleted_records: not a member of that workspace';
  end if;

  foreach t in array public.crm_soft_deletable_tables() loop
    return query execute format($q$
      select %L::text, id, deleted_at, purge_after,
             greatest(0, extract(day from (purge_after - now()))::integer)
      from public.%I
      where crm_workspace_id = $1 and deleted_at is not null
    $q$, t, t) using p_workspace_id;
  end loop;
end;
$$;

-- =====================================================================
-- 2. Purge
-- =====================================================================

create or replace function public.crm_purge_expired(p_workspace_id uuid default null)
returns table (subject_table text, purged integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  v_count integer;
begin
  foreach t in array public.crm_soft_deletable_tables() loop
    execute format($q$
      delete from public.%I x
      where x.deleted_at is not null
        and x.purge_after is not null
        and x.purge_after < now()
        and ($1 is null or x.crm_workspace_id = $1)
        -- A legal hold stops the purge, whatever the dates say. A hold a
        -- scheduled job can override is not a hold.
        and not exists (
          select 1 from public.crm_retention_policies p
          where p.crm_workspace_id = x.crm_workspace_id
            and p.legal_hold
        )
    $q$, t) using p_workspace_id;

    get diagnostics v_count = row_count;

    if v_count > 0 then
      subject_table := t;
      purged := v_count;
      return next;
    end if;
  end loop;
end;
$$;

comment on function public.crm_purge_expired(uuid) is
  'Destroys rows whose retention window has passed, unless the workspace is on legal hold. Intended to be called on a schedule; nothing in this repository schedules it, which is recorded in the limitations rather than implied by its existence.';

-- =====================================================================
-- 3. Export, for a workspace and for one person
-- =====================================================================

create or replace function public.crm_export_workspace(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := jsonb_build_object();
  v_rows jsonb;
  t text;
begin
  if not public.crm_has_role(p_workspace_id, 'crm_admin') then
    raise exception 'crm_export_workspace: exporting a whole workspace requires the crm_admin role';
  end if;

  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'crm\_%'
    order by tablename
  loop
    if t = 'crm_workspaces' then
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.id = $1', t)
        into v_rows using p_workspace_id;
    else
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.crm_workspace_id = $1', t)
        into v_rows using p_workspace_id;
    end if;

    v_result := v_result || jsonb_build_object(t, v_rows);
  end loop;

  perform public.crm_record_audit(
    p_workspace_id, 'workspace_exported', 'crm_workspaces', p_workspace_id
  );

  return v_result;
end;
$$;

-- Everything held about one person.
--
-- This is the APP 12 routine. It is deliberately a separate function from the
-- workspace export, because the question "what do you hold about me" is asked
-- by the person, not by the business, and answering it with a dump of the
-- whole CRM would be both useless and a disclosure of everybody else.
create or replace function public.crm_export_person(p_person_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_result jsonb;
begin
  select crm_workspace_id into v_workspace from public.crm_people where id = p_person_id;
  if v_workspace is null then
    raise exception 'crm_export_person: person % does not exist', p_person_id;
  end if;

  if not public.crm_has_role(v_workspace, 'crm_admin') then
    raise exception 'crm_export_person: exporting a person record requires the crm_admin role';
  end if;

  select jsonb_build_object(
    'person', (select to_jsonb(p) from public.crm_people p where p.id = p_person_id),
    'organisation_roles', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                           from public.crm_person_organisation_roles r where r.person_id = p_person_id),
    'relationships', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                      from public.crm_relationships x
                      where (x.from_kind = 'person' and x.from_id = p_person_id)
                         or (x.to_kind = 'person' and x.to_id = p_person_id)),
    'consent', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                from public.crm_consent_records c where c.person_id = p_person_id),
    'communication_preferences', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                                  from public.crm_communication_preferences c where c.person_id = p_person_id),
    'activities', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
                   from public.crm_activities a
                   where a.id in (select activity_id from public.crm_activity_participants
                                  where person_id = p_person_id)),
    'commitments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                    from public.crm_commitments c where c.owner_person_id = p_person_id),
    'evidence', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
                 from public.crm_evidence e
                 where e.subject_table = 'crm_people' and e.subject_id = p_person_id),
    'email_references', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
                         from public.crm_email_references m where m.person_id = p_person_id),
    'exported_at', to_jsonb(now())
  ) into v_result;

  perform public.crm_record_audit(
    v_workspace, 'person_exported', 'crm_people', p_person_id
  );

  return v_result;
end;
$$;

-- =====================================================================
-- 4. Erasure of one person
-- =====================================================================

-- Deliberately not a cascade.
--
-- Erasing a person must not silently remove the meeting they attended or the
-- commitment somebody else made to them, because those are records of the
-- business's own activity. What it removes is the identifying information.
-- The activity survives with the person unlinked, which is what a
-- business can honestly do and is also what keeps the history intact.
create or replace function public.crm_erase_person(
  p_person_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_before jsonb;
begin
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'crm_erase_person: a reason of at least ten characters is required';
  end if;

  select crm_workspace_id, to_jsonb(p) into v_workspace, v_before
  from public.crm_people p where p.id = p_person_id;

  if v_workspace is null then
    raise exception 'crm_erase_person: person % does not exist', p_person_id;
  end if;

  if not public.crm_has_role(v_workspace, 'crm_admin') then
    raise exception 'crm_erase_person: erasing a person requires the crm_admin role';
  end if;

  if exists (select 1 from public.crm_retention_policies
             where crm_workspace_id = v_workspace and legal_hold) then
    raise exception 'crm_erase_person: this workspace is on legal hold';
  end if;

  -- Identifying information goes.
  update public.crm_people
     set full_name = 'Erased at request',
         given_name = null, family_name = null,
         primary_email = null, secondary_email = null, phone = null,
         role_label = null,
         deleted_at = now(), deleted_by = auth.uid(), purge_after = now()
   where id = p_person_id;

  -- So does the quoted text of anything asserted about them, while the fact
  -- that an assertion existed survives for the audit trail.
  update public.crm_evidence
     set source_text = null,
         asserted_value = null,
         conflict_note = null
   where subject_table = 'crm_people' and subject_id = p_person_id;

  -- Participation becomes an unlinked record rather than disappearing.
  update public.crm_activity_participants
     set person_id = null, unresolved_name = 'Erased at request'
   where person_id = p_person_id;

  delete from public.crm_consent_records where person_id = p_person_id;
  delete from public.crm_communication_preferences where person_id = p_person_id;
  delete from public.crm_email_references where person_id = p_person_id;

  perform public.crm_record_audit(
    v_workspace, 'person_erased', 'crm_people', p_person_id,
    jsonb_build_object('had_record', true), null, 'user', 'success', p_reason
  );
end;
$$;

grant execute on function public.crm_soft_delete(text, uuid, text) to authenticated;
grant execute on function public.crm_restore(text, uuid) to authenticated;
grant execute on function public.crm_deleted_records(uuid) to authenticated;
grant execute on function public.crm_export_workspace(uuid) to authenticated;
grant execute on function public.crm_export_person(uuid) to authenticated;
grant execute on function public.crm_erase_person(uuid, text) to authenticated;
-- crm_purge_expired is deliberately NOT granted to authenticated. It is a
-- service-role routine: a client that can destroy rows past their window on
-- demand can destroy rows, and the window is the only thing making the
-- deletion recoverable in the first place.
