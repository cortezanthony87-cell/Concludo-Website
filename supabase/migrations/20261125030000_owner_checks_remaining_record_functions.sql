-- Migration 3: owner checks on the remaining 18 record functions (live project dikthezsghsssnwtctem)
-- Tables and owner columns (decided by Claude, Step 0 checked): executive_briefings.generated_by,
-- knowledge_nodes.owner_id, lessons_learned.created_by, strategic_briefings.generated_by,
-- strategic_digital_twins.created_by, strategic_scenarios.created_by.
-- Same names, arguments and return types. Refusal returns false (the functions' existing failure signal).
-- Caller-supplied user ids are never used for authorisation. Owner-only; no team admin rule.
-- Existing legal hold checks and existing not-found results are kept.
-- Not found: knowledge_node and lesson_learned functions returned TRUE for a missing record before, and still do.

create or replace function public.soft_delete_executive_briefing(p_briefing_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_by uuid;
    v_retention_days int := 30;
    v_purge_date timestamptz;
    v_team_id uuid;
    v_org_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select generated_by, team_id, organization_id into v_owner, v_team_id, v_org_id
    from public.executive_briefings
    where id = p_briefing_id and deleted_at is null;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    if v_org_id is not null then
        select retention_days into v_retention_days
        from public.retention_policies
        where organization_id = v_org_id and entity_type = 'endpoint_report';
    end if;

    if v_retention_days is null then
        v_retention_days := 30;
    end if;

    if v_retention_days = -1 then
        v_purge_date := null;
    else
        v_purge_date := now() + (v_retention_days || ' days')::interval;
    end if;

    update public.executive_briefings
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = v_purge_date,
        updated_at = now()
    where id = p_briefing_id;

    return true;
end;
$function$;


create or replace function public.restore_executive_briefing(p_briefing_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select generated_by into v_owner
    from public.executive_briefings
    where id = p_briefing_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    update public.executive_briefings
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_briefing_id
      and deleted_at is not null;

    return found;
end;
$function$;


create or replace function public.permanent_delete_executive_briefing(p_briefing_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_team_id uuid;
    v_org_id uuid;
    v_is_held boolean := false;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select generated_by, team_id, organization_id into v_owner, v_team_id, v_org_id
    from public.executive_briefings
    where id = p_briefing_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    if v_org_id is not null then
        select exists (
            select 1 from public.legal_holds where organization_id = v_org_id and status = 'active'
        ) into v_is_held;
    end if;

    if not v_is_held and public.is_record_on_legal_hold(v_owner, v_team_id) then
        v_is_held := true;
    end if;

    -- Block permanent deletion if record is on legal hold
    if v_is_held then
        raise exception 'Cannot permanently delete record: Active Legal Hold in effect.';
    end if;

    delete from public.executive_briefings
    where id = p_briefing_id;

    return true;
end;
$function$;


create or replace function public.soft_delete_knowledge_node(p_node_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_by uuid;
    v_retention_days int := 30;
    v_org_id uuid;
    v_purge_time timestamptz;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select owner_id, organization_id into v_owner, v_org_id
    from public.knowledge_nodes
    where id = p_node_id;

    if not found then
        return true;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    if v_org_id is not null then
        select retention_days into v_retention_days
        from public.retention_policies
        where organization_id = v_org_id and entity_type = 'project';
        if v_retention_days is null then v_retention_days := 30; end if;
    end if;

    if v_retention_days = -1 then
        v_purge_time := null;
    else
        v_purge_time := now() + (v_retention_days || ' days')::interval;
    end if;

    update public.knowledge_nodes
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = v_purge_time,
        updated_at = now()
    where id = p_node_id;

    update public.knowledge_relationships
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = v_purge_time,
        updated_at = now()
    where source_node_id = p_node_id or target_node_id = p_node_id;

    return true;
end;
$function$;


create or replace function public.restore_knowledge_node(p_node_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select owner_id into v_owner
    from public.knowledge_nodes
    where id = p_node_id;

    if not found then
        return true;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    update public.knowledge_nodes
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_node_id;

    update public.knowledge_relationships
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where source_node_id = p_node_id or target_node_id = p_node_id;

    return true;
end;
$function$;


create or replace function public.permanent_delete_knowledge_node(p_node_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_org_id uuid;
    v_team_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select organization_id, owner_id, team_id into v_org_id, v_owner, v_team_id
    from public.knowledge_nodes
    where id = p_node_id;

    if not found then
        return true;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    if (v_org_id is not null and exists (
        select 1 from public.legal_holds where organization_id = v_org_id and status = 'active'
    )) or public.is_record_on_legal_hold(v_owner, v_team_id) then
        raise exception 'Cannot permanently delete record: Active Legal Hold in effect.';
    end if;

    delete from public.knowledge_nodes
    where id = p_node_id;

    return true;
end;
$function$;


create or replace function public.soft_delete_lesson_learned(p_lesson_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_by uuid;
    v_retention_days int := 30;
    v_org_id uuid;
    v_purge_time timestamptz;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select created_by, organization_id into v_owner, v_org_id
    from public.lessons_learned
    where id = p_lesson_id;

    if not found then
        return true;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    if v_org_id is not null then
        select retention_days into v_retention_days
        from public.retention_policies
        where organization_id = v_org_id and entity_type = 'project';
        if v_retention_days is null then v_retention_days := 30; end if;
    end if;

    if v_retention_days = -1 then
        v_purge_time := null;
    else
        v_purge_time := now() + (v_retention_days || ' days')::interval;
    end if;

    update public.lessons_learned
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = v_purge_time,
        updated_at = now()
    where id = p_lesson_id;

    return true;
end;
$function$;


create or replace function public.restore_lesson_learned(p_lesson_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select created_by into v_owner
    from public.lessons_learned
    where id = p_lesson_id;

    if not found then
        return true;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    update public.lessons_learned
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_lesson_id;

    return true;
end;
$function$;


create or replace function public.permanent_delete_lesson_learned(p_lesson_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_org_id uuid;
    v_team_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select organization_id, created_by, team_id into v_org_id, v_owner, v_team_id
    from public.lessons_learned
    where id = p_lesson_id;

    if not found then
        return true;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    if (v_org_id is not null and exists (
        select 1 from public.legal_holds where organization_id = v_org_id and status = 'active'
    )) or public.is_record_on_legal_hold(v_owner, v_team_id) then
        raise exception 'Cannot permanently delete record: Active Legal Hold in effect.';
    end if;

    delete from public.lessons_learned
    where id = p_lesson_id;

    return true;
end;
$function$;


create or replace function public.soft_delete_strategic_briefing(p_briefing_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_by uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select generated_by into v_owner
    from public.strategic_briefings
    where id = p_briefing_id and deleted_at is null;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    update public.strategic_briefings
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = now() + interval '30 days',
        updated_at = now()
    where id = p_briefing_id
      and deleted_at is null;
    return found;
end;
$function$;


create or replace function public.restore_strategic_briefing(p_briefing_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select generated_by into v_owner
    from public.strategic_briefings
    where id = p_briefing_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    update public.strategic_briefings
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_briefing_id
      and deleted_at is not null;
    return found;
end;
$function$;


create or replace function public.permanent_delete_strategic_briefing(p_briefing_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_org_id uuid;
    v_team_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select organization_id, generated_by, team_id into v_org_id, v_owner, v_team_id
    from public.strategic_briefings
    where id = p_briefing_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    -- Strict check: Legal Hold must block permanent deletion
    if (v_org_id is not null and exists (
        select 1 from public.legal_holds where organization_id = v_org_id and status = 'active'
    )) or public.is_record_on_legal_hold(v_owner, v_team_id) then
        raise exception 'Cannot permanently delete briefing: An active legal hold applies.';
    end if;

    delete from public.strategic_briefings
    where id = p_briefing_id;

    return found;
end;
$function$;


create or replace function public.soft_delete_strategic_digital_twin(p_twin_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_by uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select created_by into v_owner
    from public.strategic_digital_twins
    where id = p_twin_id and deleted_at is null;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    update public.strategic_digital_twins
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = now() + interval '30 days',
        updated_at = now()
    where id = p_twin_id
      and deleted_at is null;
    return found;
end;
$function$;


create or replace function public.restore_strategic_digital_twin(p_twin_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select created_by into v_owner
    from public.strategic_digital_twins
    where id = p_twin_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    update public.strategic_digital_twins
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_twin_id
      and deleted_at is not null;
    return found;
end;
$function$;


create or replace function public.permanent_delete_strategic_digital_twin(p_twin_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_org_id uuid;
    v_team_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select organization_id, created_by, team_id into v_org_id, v_owner, v_team_id
    from public.strategic_digital_twins
    where id = p_twin_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    -- Strict check: Legal Hold must block permanent deletion
    if (v_org_id is not null and exists (
        select 1 from public.legal_holds where organization_id = v_org_id and status = 'active'
    )) or public.is_record_on_legal_hold(v_owner, v_team_id) then
        raise exception 'Cannot permanently delete digital twin: An active legal hold applies.';
    end if;

    delete from public.strategic_digital_twins
    where id = p_twin_id;

    return found;
end;
$function$;


create or replace function public.soft_delete_strategic_scenario(p_scenario_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_by uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select created_by into v_owner
    from public.strategic_scenarios
    where id = p_scenario_id and deleted_at is null;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    update public.strategic_scenarios
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = now() + interval '30 days',
        updated_at = now()
    where id = p_scenario_id
      and deleted_at is null;
    return found;
end;
$function$;


create or replace function public.restore_strategic_scenario(p_scenario_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select created_by into v_owner
    from public.strategic_scenarios
    where id = p_scenario_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    update public.strategic_scenarios
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_scenario_id
      and deleted_at is not null;
    return found;
end;
$function$;


create or replace function public.permanent_delete_strategic_scenario(p_scenario_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_owner uuid;
    v_org_id uuid;
    v_team_id uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select organization_id, created_by, team_id into v_org_id, v_owner, v_team_id
    from public.strategic_scenarios
    where id = p_scenario_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_owner is distinct from v_uid then
        return false;
    end if;

    -- Strict check: Legal Hold must block permanent deletion
    if (v_org_id is not null and exists (
        select 1 from public.legal_holds where organization_id = v_org_id and status = 'active'
    )) or public.is_record_on_legal_hold(v_owner, v_team_id) then
        raise exception 'Cannot permanently delete scenario: An active legal hold applies.';
    end if;

    delete from public.strategic_scenarios
    where id = p_scenario_id;

    return found;
end;
$function$;

