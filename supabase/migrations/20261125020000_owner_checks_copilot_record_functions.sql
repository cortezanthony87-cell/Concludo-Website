-- Migration 2: owner checks on record functions whose table has a user_id column (live project dikthezsghsssnwtctem)
-- Scope: copilot_conversations and copilot_prompts only (6 functions).
-- NOT included: executive_briefing, knowledge_node, lesson_learned, strategic_briefing, strategic_digital_twin,
-- strategic_scenario (18 functions). Their tables have no user_id column; per the brief, stopped and reported.
-- Same names, arguments and return types as before. Refusal is 'return false', as the functions already signal failure.
-- p_user_id is kept in the signature but never used for authorisation.

create or replace function public.soft_delete_copilot_conversation(p_conversation_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_rec record;
    v_by uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select user_id into v_rec
    from public.copilot_conversations
    where id = p_conversation_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_rec.user_id is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    update public.copilot_conversations
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = now() + interval '30 days',
        updated_at = now()
    where id = p_conversation_id
      and deleted_at is null;
    return found;
end;
$function$;

create or replace function public.restore_copilot_conversation(p_conversation_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_rec record;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select user_id into v_rec
    from public.copilot_conversations
    where id = p_conversation_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_rec.user_id is distinct from v_uid then
        return false;
    end if;

    update public.copilot_conversations
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_conversation_id
      and deleted_at is not null;
    return found;
end;
$function$;

create or replace function public.permanent_delete_copilot_conversation(p_conversation_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_rec record;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select user_id, team_id into v_rec
    from public.copilot_conversations
    where id = p_conversation_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_rec.user_id is distinct from v_uid then
        return false;
    end if;

    -- Strict check: Legal Hold must block permanent deletion
    if public.is_record_on_legal_hold(v_rec.user_id, v_rec.team_id) then
        raise exception 'Cannot permanently delete conversation: An active legal hold applies.';
    end if;

    delete from public.copilot_conversations
    where id = p_conversation_id;

    return found;
end;
$function$;

create or replace function public.soft_delete_copilot_prompt(p_prompt_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_rec record;
    v_by uuid;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select user_id into v_rec
    from public.copilot_prompts
    where id = p_prompt_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_rec.user_id is distinct from v_uid then
        return false;
    end if;

    v_by := case when coalesce(auth.role(), '') = 'service_role' then coalesce(p_user_id, v_uid) else v_uid end;

    update public.copilot_prompts
    set deleted_at = now(),
        deleted_by = v_by,
        purge_after = now() + interval '30 days',
        updated_at = now()
    where id = p_prompt_id
      and deleted_at is null;
    return found;
end;
$function$;

create or replace function public.restore_copilot_prompt(p_prompt_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_rec record;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select user_id into v_rec
    from public.copilot_prompts
    where id = p_prompt_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_rec.user_id is distinct from v_uid then
        return false;
    end if;

    update public.copilot_prompts
    set deleted_at = null,
        deleted_by = null,
        purge_after = null,
        updated_at = now()
    where id = p_prompt_id
      and deleted_at is not null;
    return found;
end;
$function$;

create or replace function public.permanent_delete_copilot_prompt(p_prompt_id uuid, p_user_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
    v_uid uuid;
    v_rec record;
begin
    v_uid := auth.uid();
    if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
        return false;
    end if;

    select user_id, team_id into v_rec
    from public.copilot_prompts
    where id = p_prompt_id;

    if not found then
        return false;
    end if;

    if coalesce(auth.role(), '') <> 'service_role' and v_rec.user_id is distinct from v_uid then
        return false;
    end if;

    -- Strict check: Legal Hold must block permanent deletion
    if public.is_record_on_legal_hold(v_rec.user_id, v_rec.team_id) then
        raise exception 'Cannot permanently delete prompt: An active legal hold applies.';
    end if;

    delete from public.copilot_prompts
    where id = p_prompt_id;

    return found;
end;
$function$;
