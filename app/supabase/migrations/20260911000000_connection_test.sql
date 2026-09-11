-- ==============================================================================
-- Concludo Workspace: Supabase Connection Test Table
-- Tasklet 2: Supabase Verification
-- ==============================================================================

-- 1. Create connection_test table
CREATE TABLE IF NOT EXISTS public.connection_test (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.connection_test ENABLE ROW LEVEL SECURITY;

-- 3. Create public read policy so client-side test can query the row
CREATE POLICY "Allow anon read access on connection_test"
    ON public.connection_test
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4. Insert test row
INSERT INTO public.connection_test (message)
VALUES ('Supabase connected')
ON CONFLICT DO NOTHING;
