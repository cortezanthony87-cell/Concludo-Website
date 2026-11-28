-- Migration: 20261128000100_draft_logs_and_system_alerts.sql
-- Description: Usage log and spend alert tables used by the draft-meeting-record function.
-- Metadata only. No transcript text, no item text, no model output is stored here.
-- Status: Staged only. Not applied to production. Apply only on Anthony's written approval.

CREATE TABLE IF NOT EXISTS public.draft_logs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  meeting_id      TEXT,
  user_id         UUID,
  model           TEXT,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  latency_ms      INTEGER,
  drafting_method TEXT NOT NULL,
  outcome         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS draft_logs_user_month_idx ON public.draft_logs (user_id, created_at);

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_key        TEXT NOT NULL UNIQUE,
  alert_type       TEXT NOT NULL,
  threshold_aud    NUMERIC,
  actual_spend_aud NUMERIC,
  recipient_email  TEXT
);

-- Row level security on, no policies: only the service role (the function) can read or write.
ALTER TABLE public.draft_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.draft_logs FROM anon, authenticated;
REVOKE ALL ON public.system_alerts FROM anon, authenticated;
