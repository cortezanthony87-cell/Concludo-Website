-- Email Command Centre: core schema
-- Concludo Workspace. Migration 0001.
--
-- Postgres, for Supabase. Three rules shaped every table below.
--
-- 1. Every row that holds mail-derived content carries both `owner_id` and
--    `account_id`. Row-level security is keyed to `owner_id`, and `account_id`
--    makes a cross-account bug visible in the data rather than only in a log.
--
-- 2. Analysis is stored. Mail is not. There is no `messages.body` column,
--    because Concludo is not a second mailbox with its own retention period.
--    What is kept of a message is its identifier, its participants, its
--    timestamps and the short quotes a source reference needs.
--
-- 3. The audit table is append-only at the grant level, not by convention.
--    The application role has INSERT and SELECT on it and nothing else.
--
-- Safe to run more than once. Every statement is guarded.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- accounts

create table if not exists ecc_account (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  provider        text not null check (provider in ('microsoft365', 'google', 'synthetic')),
  account_type    text not null check (account_type in ('work', 'personal')),
  label           text not null,
  primary_address text not null,
  owned_addresses text[] not null default '{}',
  time_zone       text not null default 'Australia/Melbourne',
  -- A reference into the token store. Never a token. The store lives outside
  -- this database and this column is an opaque handle to it.
  token_handle    text,
  connected_at    timestamptz,
  disconnected_at timestamptz,
  last_sync_at    timestamptz,
  -- Delta token (Microsoft) or history id (Google). Advanced only by a
  -- synchronisation that completed every page.
  sync_cursor     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, provider, primary_address)
);

comment on column ecc_account.token_handle is
  'Opaque reference into the external token store. Never an access or refresh token.';

-- Capability grants, one row per granted capability. Denied capabilities have
-- no row and cannot get one: the check constraint lists the only three that
-- are grantable at all.

create table if not exists ecc_capability_grant (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references ecc_account (id) on delete cascade,
  capability  text not null check (
    capability in ('process_attachment_contents', 'write_draft_to_mailbox', 'combined_account_view')
  ),
  granted_at  timestamptz not null default now(),
  granted_by  uuid not null references auth.users (id),
  revoked_at  timestamptz,
  unique (account_id, capability)
);

comment on table ecc_capability_grant is
  'Only the three opt-in capabilities can appear here. The seventeen denied capabilities are refused by the check constraint as well as by the application.';

-- Preferences.

create table if not exists ecc_preference (
  account_id               uuid primary key references ecc_account (id) on delete cascade,
  owner_id                 uuid not null references auth.users (id) on delete cascade,
  working_hours_start      time not null default '08:30',
  working_hours_end        time not null default '17:30',
  working_days             int[] not null default '{1,2,3,4,5}',
  time_zone                text not null default 'Australia/Melbourne',
  reply_tone               text not null default 'plain',
  sign_off                 text not null default 'Thanks',
  priority_contacts        text[] not null default '{}',
  priority_domains         text[] not null default '{}',
  always_escalate          text[] not null default '{}',
  excluded_senders         text[] not null default '{}',
  excluded_folders         text[] not null default '{archive,sent,spam,junk,bin,trash}',
  may_write_drafts         boolean not null default false,
  analysis_retention_days  int not null default 365 check (analysis_retention_days between 7 and 2555),
  updated_at               timestamptz not null default now()
);

-- ----------------------------------------------------------------- threads

create table if not exists ecc_thread (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade,
  account_id          uuid not null references ecc_account (id) on delete cascade,
  provider_thread_id  text not null,
  subject             text not null,
  folder              text not null,
  labels              text[] not null default '{}',
  first_message_at    timestamptz not null,
  last_message_at     timestamptz not null,
  participants        text[] not null default '{}',
  is_read             boolean not null default false,
  last_message_from_self boolean not null default false,
  duplicate_of        uuid references ecc_thread (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (account_id, provider_thread_id)
);

-- Message metadata. No body column, deliberately.

create table if not exists ecc_message (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  account_id           uuid not null references ecc_account (id) on delete cascade,
  thread_id            uuid not null references ecc_thread (id) on delete cascade,
  provider_message_id  text not null,
  sent_at              timestamptz not null,
  from_address         text not null,
  from_display_name    text,
  to_addresses         text[] not null default '{}',
  cc_addresses         text[] not null default '{}',
  reply_to_address     text,
  subject              text not null,
  is_from_self         boolean not null default false,
  is_read              boolean not null default false,
  attachment_count     int not null default 0,
  -- An injection attempt is recorded as an observation. `handling` has one
  -- legal value, because the module never acts on what it finds.
  injection_detected   boolean not null default false,
  injection_summary    text,
  injection_handling   text check (injection_handling is null or injection_handling = 'ignored'),
  created_at           timestamptz not null default now(),
  unique (account_id, provider_message_id)
);

comment on table ecc_message is
  'Message metadata only. There is no body column: Concludo stores analysis, not a copy of the mailbox.';

create table if not exists ecc_attachment (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references ecc_account (id) on delete cascade,
  message_id  uuid not null references ecc_message (id) on delete cascade,
  file_name   text not null,
  mime_type   text not null,
  size_bytes  bigint not null,
  -- False unless the person turned on attachment processing. Contents are held
  -- in memory during analysis and never written here.
  contents_read boolean not null default false,
  why_not_read  text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- analysis

create table if not exists ecc_analysis (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users (id) on delete cascade,
  account_id           uuid not null references ecc_account (id) on delete cascade,
  thread_id            uuid not null references ecc_thread (id) on delete cascade,
  analysed             boolean not null default false,
  -- Provenance. All seven fields the brief requires are mandatory for an
  -- analysed row, enforced by the check constraint at the end of this block.
  model                text,
  prompt_version       text,
  schema_version       text,
  generated_at         timestamptz,
  confidence           text check (confidence is null or confidence in ('high', 'medium', 'low')),
  one_line_summary     text,
  why_it_matters       text,
  recommended_next_step text,
  sender_request       text,
  current_status       text not null default 'unclear' check (
    current_status in (
      'waiting_on_user', 'waiting_on_other', 'decision_required', 'action_required',
      'information_only', 'resolved', 'security_review', 'unclear'
    )
  ),
  priority_score       int not null default 0 check (priority_score between 0 and 100),
  priority_band        text not null default 'low' check (
    priority_band in ('immediate', 'today', 'soon', 'batch', 'low')
  ),
  priority_reasons     text[] not null default '{}',
  -- The eleven weighted factors, as {key, value, reason}.
  priority_factors     jsonb not null default '[]'::jsonb,
  escalation_reason    text,
  reply_required       boolean not null default false,
  reply_reason         text,
  category             text,
  sensitivity          text check (sensitivity is null or sensitivity in ('standard', 'sensitive')),
  is_bulk              boolean not null default false,
  estimated_effort_minutes int,
  recommended_follow_up_date timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (thread_id),
  constraint ecc_analysis_provenance check (
    analysed = false
    or (model is not null and prompt_version is not null and schema_version is not null
        and generated_at is not null and confidence is not null)
  )
);

comment on constraint ecc_analysis_provenance on ecc_analysis is
  'An analysed row must carry its provenance. A generated field without model, prompt version, schema version, timestamp and confidence cannot be stored.';

-- Extractions. One table, discriminated by kind, because they share every
-- column that matters: an owner, a date, a basis, a confidence and a source.

create table if not exists ecc_extraction (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  account_id    uuid not null references ecc_account (id) on delete cascade,
  thread_id     uuid not null references ecc_thread (id) on delete cascade,
  analysis_id   uuid not null references ecc_analysis (id) on delete cascade,
  kind          text not null check (
    kind in ('deadline', 'action', 'decision_made', 'decision_required',
             'commitment', 'open_question', 'conflict', 'risk', 'fact_to_verify')
  ),
  description   text not null,
  owner_label   text,
  owner_is_self boolean,
  due_at        timestamptz,
  -- The field the whole product rests on. A date a person acts on must say
  -- whether the sender wrote it or Concludo worked it out.
  basis         text not null check (basis in ('stated', 'inferred', 'calculated')),
  confidence    text not null check (confidence in ('high', 'medium', 'low')),
  consequence   text,
  status        text,
  estimated_minutes int,
  answered      boolean,
  -- Source references: [{message_id, quote}]. Non-empty for anything extracted
  -- from a message, enforced below.
  sources       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  constraint ecc_extraction_has_source check (jsonb_array_length(sources) > 0)
);

comment on constraint ecc_extraction_has_source on ecc_extraction is
  'Every extraction names the message it came from. A fact with no source cannot be stored, because a person cannot check it.';

create table if not exists ecc_security_alert (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  account_id      uuid not null references ecc_account (id) on delete cascade,
  thread_id       uuid not null references ecc_thread (id) on delete cascade,
  flags           text[] not null,
  severity        text not null check (severity in ('high', 'medium', 'low')),
  explanation     text not null,
  recommended_check text not null,
  -- One legal value. The module advises; it never blocks, quarantines or
  -- deletes, and the column says so rather than leaving room.
  disposition     text not null default 'advisory' check (disposition = 'advisory'),
  sources         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------------ drafts

create table if not exists ecc_draft (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  account_id    uuid not null references ecc_account (id) on delete cascade,
  thread_id     uuid not null references ecc_thread (id) on delete cascade,
  status        text not null check (
    status in ('available', 'clarification_required', 'withheld_for_safety', 'not_recommended')
  ),
  withheld_reason text,
  -- {concise, warm, detailed}. Null unless status is 'available'.
  variants      jsonb,
  from_address  text,
  recipients    jsonb not null default '[]'::jsonb,
  subject       text,
  attachment_ids uuid[] not null default '{}',
  commitments_in_draft text[] not null default '{}',
  missing_information  text[] not null default '{}',
  model         text,
  prompt_version text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Approvals. One row per approved action per payload. Nothing external happens
-- without a matching row, and a row matches only the exact payload it was
-- given for.

create table if not exists ecc_action_approval (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users (id) on delete cascade,
  account_id      uuid not null references ecc_account (id) on delete cascade,
  thread_id       uuid references ecc_thread (id) on delete cascade,
  action_kind     text not null check (
    action_kind in ('save_draft_to_mailbox', 'send_reviewed_draft', 'archive_messages',
                    'create_task', 'create_reminder')
  ),
  -- The six-field fingerprint for a draft, or a digest of the item ids.
  payload_fingerprint text not null,
  approved_summary    text not null,
  approved_snapshot   jsonb not null,
  approved_by         uuid not null references auth.users (id),
  approved_at         timestamptz not null default now(),
  -- Set when the payload changed after approval. An approval is never edited;
  -- it is superseded.
  invalidated_at      timestamptz,
  invalidated_fields  text[] not null default '{}',
  -- Set only when the action actually ran. Null means approved and not acted
  -- on, which is the normal state in this release for every kind.
  executed_at         timestamptz,
  unique (account_id, action_kind, payload_fingerprint)
);

comment on table ecc_action_approval is
  'An approval authorises one action on one payload. In this release only save_draft_to_mailbox can ever be executed, and only with the matching capability grant.';

-- ---------------------------------------------------------- backlog sessions

create table if not exists ecc_backlog_session (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  account_id    uuid not null references ecc_account (id) on delete cascade,
  -- The selection, so a resumed session rebuilds the same batch.
  selection     jsonb not null,
  -- Thread ids in order. Not the analysis: a stored summary goes stale, and a
  -- resumed session showing a stale summary is worse than no session.
  thread_order  uuid[] not null,
  cursor_index  int not null default 0 check (cursor_index >= 0),
  status        text not null default 'active' check (status in ('active', 'paused', 'complete')),
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  paused_at     timestamptz,
  completed_at  timestamptz
);

create table if not exists ecc_backlog_decision (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references ecc_account (id) on delete cascade,
  session_id  uuid not null references ecc_backlog_session (id) on delete cascade,
  thread_id   uuid not null references ecc_thread (id) on delete cascade,
  state       text not null check (
    state in ('reviewed', 'reply_drafted', 'approved', 'waiting', 'deferred',
              'no_action', 'manual_review', 'security_review')
  ),
  note        text,
  decided_at  timestamptz not null default now(),
  unique (session_id, thread_id)
);

comment on table ecc_backlog_decision is
  'A record of what a person decided. Not one of the eight states performs an action.';

-- -------------------------------------------------------------- corrections

create table if not exists ecc_correction (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  account_id    uuid not null references ecc_account (id) on delete cascade,
  thread_id     uuid not null references ecc_thread (id) on delete cascade,
  field_path    text not null,
  was           text,
  now_is        text,
  corrected_by  uuid not null references auth.users (id),
  corrected_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- audit trail

create table if not exists ecc_audit_event (
  id          bigserial primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references ecc_account (id) on delete cascade,
  thread_id   uuid,
  kind        text not null,
  actor       text not null,
  -- A record of what the system did. No message content: see the retention
  -- note in docs/PRIVACY_DELETION.md and the test that asserts it.
  description text not null,
  at          timestamptz not null default now()
);

comment on table ecc_audit_event is
  'Append only. The application role has INSERT and SELECT and nothing else. No message bodies.';

-- ------------------------------------------------------------------ indexes

-- Every index leads with the owner or the account, because every query does.
create index if not exists ecc_thread_account_last_message
  on ecc_thread (account_id, last_message_at desc);
create index if not exists ecc_thread_owner
  on ecc_thread (owner_id);
create index if not exists ecc_thread_account_folder
  on ecc_thread (account_id, folder);
create index if not exists ecc_message_thread_sent
  on ecc_message (thread_id, sent_at);
create index if not exists ecc_message_account_provider
  on ecc_message (account_id, provider_message_id);
create index if not exists ecc_analysis_account_band_score
  on ecc_analysis (account_id, priority_band, priority_score desc);
create index if not exists ecc_analysis_account_status
  on ecc_analysis (account_id, current_status);
-- The deadline queries sort on this and filter by owner, so the partial index
-- keeps it small: most extractions carry no date.
create index if not exists ecc_extraction_due
  on ecc_extraction (account_id, due_at)
  where due_at is not null;
create index if not exists ecc_extraction_thread_kind
  on ecc_extraction (thread_id, kind);
create index if not exists ecc_security_alert_account
  on ecc_security_alert (account_id, severity);
create index if not exists ecc_draft_account_status
  on ecc_draft (account_id, status);
create index if not exists ecc_approval_lookup
  on ecc_action_approval (account_id, action_kind, payload_fingerprint);
create index if not exists ecc_backlog_session_owner_status
  on ecc_backlog_session (owner_id, status, updated_at desc);
create index if not exists ecc_audit_account_at
  on ecc_audit_event (account_id, at desc);

-- -------------------------------------------------------- updated_at trigger

create or replace function ecc_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['ecc_account', 'ecc_thread', 'ecc_analysis', 'ecc_draft', 'ecc_backlog_session']
  loop
    execute format(
      'drop trigger if exists %I_touch on %I; create trigger %I_touch before update on %I for each row execute function ecc_touch_updated_at();',
      t, t, t, t
    );
  end loop;
end
$$;

commit;
