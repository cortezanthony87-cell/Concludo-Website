-- ==============================================================================
-- Concludo Workspace: Native Calendar & Execution Layer Schema
-- Concludo Calendar Handover Tasklet 2 - Wave 1
-- The Seven Binding Rules:
-- 1. Native only (zero external sync/tokens).
-- 2. Every item keeps its source (project, meeting, output, reference).
-- 3. Never invent an owner or a date.
-- 4. Never score, rank, or rate a person.
-- 5. Nothing deleted quietly (soft delete + immutable audit).
-- 6. Private by default. Always. (Creator-only unless assigned or approved to shared calendar).
-- 7. Brand tokens canonical (#16263F, #21395C, #E2B53C, #BC8A1C, #F4F6FA, #FFFFFF).
-- ==============================================================================

-- 1. Calendars table (Personal by default, Shared in Team tier only)
CREATE TABLE IF NOT EXISTS public.calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('personal', 'project', 'team', 'department', 'board', 'governance')),
    color TEXT NOT NULL DEFAULT '#16263F',
    is_shared BOOLEAN NOT NULL DEFAULT false,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON public.calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_calendars_org_id ON public.calendars(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendars_deleted_at ON public.calendars(deleted_at);

-- 2. Calendar Items table
CREATE TABLE IF NOT EXISTS public.calendar_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID REFERENCES public.calendars(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    owner_name TEXT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('task', 'event', 'milestone', 'review', 'follow_up', 'board_action', 'timeline_activity')),
    title TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    reference TEXT, -- e.g. ACT-001, RSK-002, DEC-004
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'waiting', 'blocked', 'review', 'completed', 'cancelled')),
    status_reason TEXT, -- mandatory for waiting, blocked, cancelled
    due_date DATE,
    due_time TIME,
    date_inferred BOOLEAN NOT NULL DEFAULT false,
    start_date DATE,
    end_date DATE,
    progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    review_type TEXT CHECK (review_type IN ('decision', 'risk', 'compliance', 'audit', 'governance', 'strategy', 'policy')),
    review_cadence TEXT CHECK (review_cadence IN ('once', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
    review_expires_on DATE,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'assigned', 'pending', 'shared')),
    
    -- Lineage & source preservation (Rule 2)
    source_type TEXT CHECK (source_type IN ('meeting', 'report', 'project', 'decision_register', 'risk_register', 'board_paper', 'other')),
    source_id TEXT,
    source_title TEXT,
    source_reference TEXT, -- e.g. TR-001
    source_occurred_at TIMESTAMPTZ,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    output_id UUID REFERENCES public.outputs(id) ON DELETE SET NULL,
    idempotency_key TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_items_creator ON public.calendar_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_owner ON public.calendar_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_org ON public.calendar_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_due_date ON public.calendar_items(due_date);
CREATE INDEX IF NOT EXISTS idx_calendar_items_status ON public.calendar_items(status);
CREATE INDEX IF NOT EXISTS idx_calendar_items_visibility ON public.calendar_items(visibility);
CREATE INDEX IF NOT EXISTS idx_calendar_items_idempotency ON public.calendar_items(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_calendar_items_deleted ON public.calendar_items(deleted_at);

-- 3. Calendar Share Requests (Approvals)
CREATE TABLE IF NOT EXISTS public.calendar_share_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
    target_calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'declined')),
    decline_reason TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Calendar Dependencies
CREATE TABLE IF NOT EXISTS public.calendar_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
    depends_on_item_id UUID NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'finish_to_start' CHECK (type IN ('finish_to_start', 'start_to_start', 'finish_to_finish')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Calendar Generations (Generate to Calendar tracking & 60s Undo window)
CREATE TABLE IF NOT EXISTS public.calendar_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    options JSONB NOT NULL,
    idempotency_key TEXT NOT NULL,
    items_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    undone_at TIMESTAMPTZ DEFAULT NULL
);

-- 6. Calendar Audit (Append only, immutable)
CREATE TABLE IF NOT EXISTS public.calendar_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_audit_object ON public.calendar_audit(object_id);
CREATE INDEX IF NOT EXISTS idx_calendar_audit_actor ON public.calendar_audit(actor_id);

-- Enable RLS on all tables
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_share_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_audit ENABLE ROW LEVEL SECURITY;

-- Grant permissions
REVOKE ALL ON public.calendars FROM anon;
REVOKE ALL ON public.calendar_items FROM anon;
REVOKE ALL ON public.calendar_share_requests FROM anon;
REVOKE ALL ON public.calendar_dependencies FROM anon;
REVOKE ALL ON public.calendar_generations FROM anon;
REVOKE ALL ON public.calendar_audit FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.calendars TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calendar_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calendar_share_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calendar_dependencies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calendar_generations TO authenticated;
GRANT SELECT, INSERT ON public.calendar_audit TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- RLS Policies: Calendars
DROP POLICY IF EXISTS "Users can read own calendars and shared org calendars" ON public.calendars;
CREATE POLICY "Users can read own calendars and shared org calendars" ON public.calendars
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR (
            is_shared = true
            AND organization_id IS NOT NULL
            AND organization_id IN (
                SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can create own calendars" ON public.calendars;
CREATE POLICY "Users can create own calendars" ON public.calendars
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own calendars" ON public.calendars;
CREATE POLICY "Users can update own calendars" ON public.calendars
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- RLS Policies: Calendar Items (Strict Privacy by Default Rule 6)
-- A user reads an item ONLY when:
-- 1. They created it (creator_id = auth.uid())
-- 2. They are the assigned owner (owner_id = auth.uid())
-- 3. It is visibility = 'shared' on a shared calendar the user is member of
DROP POLICY IF EXISTS "Strict private by default item read policy" ON public.calendar_items;
CREATE POLICY "Strict private by default item read policy" ON public.calendar_items
    FOR SELECT TO authenticated
    USING (
        creator_id = auth.uid()
        OR owner_id = auth.uid()
        OR (
            visibility = 'shared'
            AND calendar_id IN (
                SELECT id FROM public.calendars
                WHERE is_shared = true
                AND (
                    user_id = auth.uid()
                    OR organization_id IN (
                        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert own calendar items" ON public.calendar_items;
CREATE POLICY "Users can insert own calendar items" ON public.calendar_items
    FOR INSERT TO authenticated
    WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own or assigned items" ON public.calendar_items;
CREATE POLICY "Users can update own or assigned items" ON public.calendar_items
    FOR UPDATE TO authenticated
    USING (
        creator_id = auth.uid()
        OR owner_id = auth.uid()
    );

-- Audit log insert policy: actors can insert their own actions
DROP POLICY IF EXISTS "Authenticated users can record audit entries" ON public.calendar_audit;
CREATE POLICY "Authenticated users can record audit entries" ON public.calendar_audit
    FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can read audit for accessible items" ON public.calendar_audit;
CREATE POLICY "Authenticated users can read audit for accessible items" ON public.calendar_audit
    FOR SELECT TO authenticated
    USING (actor_id = auth.uid());

-- Generations policy
DROP POLICY IF EXISTS "Users manage own generations" ON public.calendar_generations;
CREATE POLICY "Users manage own generations" ON public.calendar_generations
    FOR ALL TO authenticated
    USING (user_id = auth.uid());
