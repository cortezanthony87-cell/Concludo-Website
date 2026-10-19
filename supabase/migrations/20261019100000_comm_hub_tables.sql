-- =====================================================================
-- Concludo Communication Hub, migration 0010: Release 0 tables only,
-- timeline read model, record rooms, and strict row level security.
--
-- Concludo Pty Ltd. Release 0 (R0 Demo).
--
-- Follows all Concludo CRM rules:
-- 1. Every table has tenant column crm_workspace_id.
-- 2. Row level security is enabled and FORCED on every comm_ table.
-- 3. One policy per operation (SELECT, INSERT, UPDATE, DELETE), never FOR ALL.
-- 4. Soft deletion via deleted_at.
-- 5. No columns ending in _score, _ranking, or _per_user.
-- 6. No view grouped by a user column.
-- 7. Scope: Release 0 only (9 tables). No R1-R5 tables (no spaces, invitations, files, templates).
-- 8. Direct DML bypasses revoked on read models.
-- =====================================================================

-- 1. comm_conversations
create table if not exists public.comm_conversations (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  kind text not null check (kind in ('dm', 'group', 'channel', 'record_room', 'space_room')),
  title text not null,
  record_table text check (record_table in ('crm_organisations', 'crm_work_items', 'crm_opportunities', 'crm_projects', 'crm_leads')),
  record_id uuid,
  space_id uuid,
  is_private boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint comm_conversations_space_room_check check (
    (kind = 'space_room' and space_id is not null) or
    (kind <> 'space_room' and space_id is null)
  )
);

create index if not exists comm_conversations_workspace_idx
  on public.comm_conversations (crm_workspace_id, created_at desc)
  where deleted_at is null;

create index if not exists comm_conversations_record_idx
  on public.comm_conversations (crm_workspace_id, record_table, record_id)
  where deleted_at is null;

-- 2. comm_conversation_members
create table if not exists public.comm_conversation_members (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  conversation_id uuid not null references public.comm_conversations(id),
  member_kind text not null default 'user' check (member_kind in ('user', 'space_member')),
  member_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  muted boolean not null default false,
  deleted_at timestamptz,
  constraint comm_conversation_members_unique unique (conversation_id, member_kind, member_id)
);

create index if not exists comm_conversation_members_lookup_idx
  on public.comm_conversation_members (conversation_id, member_id)
  where deleted_at is null;

-- 3. comm_messages
create table if not exists public.comm_messages (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  conversation_id uuid not null references public.comm_conversations(id),
  parent_message_id uuid references public.comm_messages(id),
  author_kind text not null default 'user' check (author_kind in ('user', 'space_member', 'agent')),
  author_id uuid not null,
  body text not null,
  body_format text not null default 'plain' check (body_format in ('plain', 'markdown')),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists comm_messages_conversation_idx
  on public.comm_messages (conversation_id, created_at desc)
  where deleted_at is null;

create index if not exists comm_messages_workspace_idx
  on public.comm_messages (crm_workspace_id, created_at desc)
  where deleted_at is null;

-- 4. comm_message_records
create table if not exists public.comm_message_records (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  message_id uuid not null references public.comm_messages(id),
  record_table text not null check (record_table in ('crm_organisations', 'crm_work_items', 'crm_opportunities', 'crm_projects', 'crm_leads')),
  record_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint comm_message_records_unique unique (message_id, record_table, record_id)
);

create index if not exists comm_message_records_lookup_idx
  on public.comm_message_records (record_table, record_id)
  where deleted_at is null;

-- 5. comm_message_mentions
create table if not exists public.comm_message_mentions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  message_id uuid not null references public.comm_messages(id),
  mentioned_kind text not null default 'user' check (mentioned_kind in ('user', 'space_member')),
  mentioned_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint comm_message_mentions_unique unique (message_id, mentioned_kind, mentioned_id)
);

create index if not exists comm_message_mentions_lookup_idx
  on public.comm_message_mentions (mentioned_id)
  where deleted_at is null;

-- 6. comm_reactions
create table if not exists public.comm_reactions (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  message_id uuid not null references public.comm_messages(id),
  member_kind text not null default 'user' check (member_kind in ('user', 'space_member')),
  member_id uuid not null,
  reaction text not null check (char_length(reaction) <= 32),
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint comm_reactions_unique unique (message_id, member_kind, member_id, reaction)
);

-- 7. comm_pins
create table if not exists public.comm_pins (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  conversation_id uuid not null references public.comm_conversations(id),
  message_id uuid not null references public.comm_messages(id),
  pinned_by uuid not null,
  pinned_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint comm_pins_unique unique (conversation_id, message_id)
);

create index if not exists comm_pins_conversation_idx
  on public.comm_pins (conversation_id, pinned_at desc)
  where deleted_at is null;

-- 8. comm_timeline_items (Unified timeline read model)
create table if not exists public.comm_timeline_items (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  record_table text not null check (record_table in ('crm_organisations', 'crm_work_items', 'crm_opportunities', 'crm_projects', 'crm_leads')),
  record_id uuid not null,
  event_at timestamptz not null,
  item_type text not null check (item_type in ('email', 'message', 'meeting', 'file_shared', 'task', 'ai_proposal', 'decision', 'space_created')),
  title text not null,
  actor_kind text not null default 'user' check (actor_kind in ('user', 'space_member', 'system', 'agent')),
  actor_id uuid,
  source_table text not null,
  source_id uuid not null,
  visibility text not null default 'internal',
  detail jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists comm_timeline_items_lookup_idx
  on public.comm_timeline_items (crm_workspace_id, record_table, record_id, event_at desc)
  where deleted_at is null;

-- 9. comm_notifications
create table if not exists public.comm_notifications (
  id uuid primary key default gen_random_uuid(),
  crm_workspace_id uuid not null references public.crm_workspaces(id),
  recipient_kind text not null default 'user' check (recipient_kind in ('user', 'space_member')),
  recipient_id uuid not null,
  type text not null check (type in ('mention', 'approval', 'reply', 'request')),
  source_table text not null,
  source_id uuid not null,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists comm_notifications_recipient_idx
  on public.comm_notifications (recipient_id, read_at)
  where deleted_at is null;

-- =====================================================================
-- Row Level Security for all 9 R0 comm_ tables
-- =====================================================================
-- Helper functions for non-recursive, leak-free conversation and message access checks
create or replace function public.comm_can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.comm_conversations c
    where c.id = p_conversation_id
      and c.deleted_at is null
      and public.crm_is_member(c.crm_workspace_id)
      and (
        (not c.is_private and public.crm_has_role(c.crm_workspace_id, 'crm_viewer'))
        or exists (
          select 1
          from public.comm_conversation_members m
          where m.conversation_id = c.id
            and m.member_id = auth.uid()
            and m.left_at is null
            and m.deleted_at is null
        )
      )
  );
$$;

create or replace function public.comm_can_access_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.comm_messages m
    join public.comm_conversations c on c.id = m.conversation_id
    where m.id = p_message_id
      and m.deleted_at is null
      and c.deleted_at is null
      and public.crm_is_member(c.crm_workspace_id)
      and (
        (not c.is_private and public.crm_has_role(c.crm_workspace_id, 'crm_viewer'))
        or exists (
          select 1
          from public.comm_conversation_members mem
          where mem.conversation_id = c.id
            and mem.member_id = auth.uid()
            and mem.left_at is null
            and mem.deleted_at is null
        )
      )
  );
$$;

grant execute on function public.comm_can_access_conversation(uuid) to authenticated;
grant execute on function public.comm_can_access_message(uuid) to authenticated;

do $$
declare
  t text;
  comm_tables text[] := array[
    'comm_conversations',
    'comm_conversation_members',
    'comm_messages',
    'comm_message_records',
    'comm_message_mentions',
    'comm_reactions',
    'comm_pins',
    'comm_timeline_items',
    'comm_notifications'
  ];
begin
  foreach t in array comm_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  end loop;

  -- 1. comm_conversations: non-private record rooms readable by members of the workspace with crm_viewer;
  -- private conversations require membership row.
  create policy comm_conversations_select on public.comm_conversations
    for select to authenticated
    using (public.comm_can_access_conversation(id));

  create policy comm_conversations_insert on public.comm_conversations
    for insert to authenticated
    with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'));

  create policy comm_conversations_update on public.comm_conversations
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_conversation(id))
    with check (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_conversation(id));

  create policy comm_conversations_delete on public.comm_conversations
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin') and public.comm_can_access_conversation(id));

  -- 2. comm_conversation_members: accessible only if conversation is accessible
  create policy comm_conversation_members_select on public.comm_conversation_members
    for select to authenticated
    using (public.comm_can_access_conversation(conversation_id));

  create policy comm_conversation_members_insert on public.comm_conversation_members
    for insert to authenticated
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and exists (select 1 from public.comm_conversations c where c.id = conversation_id and c.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_conversation_members_update on public.comm_conversation_members
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_conversation(conversation_id))
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and exists (select 1 from public.comm_conversations c where c.id = conversation_id and c.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_conversation_members_delete on public.comm_conversation_members
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin') and public.comm_can_access_conversation(conversation_id));

  -- 3. comm_messages: readable only if conversation is accessible
  create policy comm_messages_select on public.comm_messages
    for select to authenticated
    using (public.comm_can_access_conversation(conversation_id));

  create policy comm_messages_insert on public.comm_messages
    for insert to authenticated
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and exists (select 1 from public.comm_conversations c where c.id = conversation_id and c.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_messages_update on public.comm_messages
    for update to authenticated
    using (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and (author_id = auth.uid() or public.crm_has_role(crm_workspace_id, 'crm_admin'))
    )
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and (author_id = auth.uid() or public.crm_has_role(crm_workspace_id, 'crm_admin'))
      and exists (select 1 from public.comm_conversations c where c.id = conversation_id and c.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_messages_delete on public.comm_messages
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin') and public.comm_can_access_conversation(conversation_id));

  -- 4. comm_message_records: accessible only if parent message is accessible
  create policy comm_message_records_select on public.comm_message_records
    for select to authenticated
    using (public.comm_can_access_message(message_id));

  create policy comm_message_records_insert on public.comm_message_records
    for insert to authenticated
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_message(message_id)
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_message_records_update on public.comm_message_records
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_message(message_id))
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_message(message_id)
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_message_records_delete on public.comm_message_records
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin') and public.comm_can_access_message(message_id));

  -- 5. comm_message_mentions: accessible only if parent message is accessible
  create policy comm_message_mentions_select on public.comm_message_mentions
    for select to authenticated
    using (public.comm_can_access_message(message_id));

  create policy comm_message_mentions_insert on public.comm_message_mentions
    for insert to authenticated
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_message(message_id)
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_message_mentions_update on public.comm_message_mentions
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_message(message_id))
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_message(message_id)
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_message_mentions_delete on public.comm_message_mentions
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin') and public.comm_can_access_message(message_id));

  -- 6. comm_reactions: accessible only if parent message is accessible
  create policy comm_reactions_select on public.comm_reactions
    for select to authenticated
    using (public.comm_can_access_message(message_id));

  create policy comm_reactions_insert on public.comm_reactions
    for insert to authenticated
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_message(message_id)
      and member_id = auth.uid()
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_reactions_update on public.comm_reactions
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_message(message_id) and member_id = auth.uid())
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_message(message_id)
      and member_id = auth.uid()
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_reactions_delete on public.comm_reactions
    for delete to authenticated
    using ((member_id = auth.uid() or public.crm_has_role(crm_workspace_id, 'crm_admin')) and public.comm_can_access_message(message_id));

  -- 7. comm_pins: accessible only if conversation is accessible
  create policy comm_pins_select on public.comm_pins
    for select to authenticated
    using (public.comm_can_access_conversation(conversation_id));

  create policy comm_pins_insert on public.comm_pins
    for insert to authenticated
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and public.comm_can_access_message(message_id)
      and exists (select 1 from public.comm_conversations c where c.id = conversation_id and c.crm_workspace_id = crm_workspace_id)
      and exists (select 1 from public.comm_messages m where m.id = message_id and m.conversation_id = conversation_id)
    );

  create policy comm_pins_update on public.comm_pins
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor') and public.comm_can_access_conversation(conversation_id))
    with check (
      public.crm_has_role(crm_workspace_id, 'crm_contributor')
      and public.comm_can_access_conversation(conversation_id)
      and exists (select 1 from public.comm_conversations c where c.id = conversation_id and c.crm_workspace_id = crm_workspace_id)
    );

  create policy comm_pins_delete on public.comm_pins
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin') and public.comm_can_access_conversation(conversation_id));

  -- 8. comm_timeline_items (Read model: strictly internal view, direct DML revoked)
  create policy comm_timeline_items_select on public.comm_timeline_items
    for select to authenticated
    using (
      public.crm_is_member(crm_workspace_id) and (visibility = 'internal' or visibility is null)
    );

  create policy comm_timeline_items_insert on public.comm_timeline_items
    for insert to authenticated
    with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'));

  create policy comm_timeline_items_update on public.comm_timeline_items
    for update to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_contributor'))
    with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'));

  create policy comm_timeline_items_delete on public.comm_timeline_items
    for delete to authenticated
    using (public.crm_has_role(crm_workspace_id, 'crm_admin'));

  -- Revoke direct DML on read model to enforce commit() write path
  revoke insert, update, delete on public.comm_timeline_items from authenticated;

  -- 9. comm_notifications: user sees and updates only their own notifications
  create policy comm_notifications_select on public.comm_notifications
    for select to authenticated
    using (
      public.crm_is_member(crm_workspace_id) and recipient_id = auth.uid()
    );

  create policy comm_notifications_insert on public.comm_notifications
    for insert to authenticated
    with check (public.crm_has_role(crm_workspace_id, 'crm_contributor'));

  create policy comm_notifications_update on public.comm_notifications
    for update to authenticated
    using (public.crm_is_member(crm_workspace_id) and recipient_id = auth.uid())
    with check (public.crm_is_member(crm_workspace_id) and recipient_id = auth.uid());

  create policy comm_notifications_delete on public.comm_notifications
    for delete to authenticated
    using (public.crm_is_member(crm_workspace_id) and recipient_id = auth.uid());
end
$$;

-- Direct write audit trigger: ensures all direct database writes to conversations and messages
-- are audited in crm_audit_events
create or replace function public.comm_audit_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_rec_id uuid;
begin
  if (tg_op = 'DELETE') then
    v_ws := old.crm_workspace_id;
    v_rec_id := old.id;
    perform public.crm_record_audit(
      v_ws,
      tg_table_name || '_deleted',
      tg_table_name,
      v_rec_id,
      to_jsonb(old),
      null,
      'user',
      'success',
      tg_table_name || ' record deleted'
    );
    return old;
  elsif (tg_op = 'UPDATE') then
    v_ws := new.crm_workspace_id;
    v_rec_id := new.id;
    perform public.crm_record_audit(
      v_ws,
      tg_table_name || '_updated',
      tg_table_name,
      v_rec_id,
      to_jsonb(old),
      to_jsonb(new),
      'user',
      'success',
      tg_table_name || ' record updated'
    );
    return new;
  elsif (tg_op = 'INSERT') then
    v_ws := new.crm_workspace_id;
    v_rec_id := new.id;
    perform public.crm_record_audit(
      v_ws,
      tg_table_name || '_created',
      tg_table_name,
      v_rec_id,
      null,
      to_jsonb(new),
      'user',
      'success',
      tg_table_name || ' record created'
    );
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists comm_conversations_audit_trigger on public.comm_conversations;
create trigger comm_conversations_audit_trigger
  after insert or update or delete on public.comm_conversations
  for each row execute function public.comm_audit_log_trigger();

drop trigger if exists comm_messages_audit_trigger on public.comm_messages;
create trigger comm_messages_audit_trigger
  after insert or update or delete on public.comm_messages
  for each row execute function public.comm_audit_log_trigger();


-- Verification check against score, ranking or per_user columns
do $$
declare
  offending text;
begin
  select string_agg(table_name || '.' || column_name, ', ')
  into offending
  from information_schema.columns
  where table_schema = 'public'
    and (table_name like 'comm_%' or table_name like 'crm_%')
    and (
      column_name in (
        'score', 'grade', 'rating',
        'performance_score', 'productivity_score',
        'attention_score', 'health_score', 'engagement_score', 'risk_score',
        'relationship_score', 'weighting', 'weight',
        'reads_per_user', 'read_count_by_user', 'activity_score', 'usage_score'
      )
      or column_name like '%_score'
      or column_name like '%_ranking'
      or column_name like '%_per_user'
    );

  if offending is not null then
    raise exception
      'A score, ranking or per-user column has appeared on a CRM or Comm table (%). Concludo counts work, records and relationships, never people.',
      offending;
  end if;
end
$$;
