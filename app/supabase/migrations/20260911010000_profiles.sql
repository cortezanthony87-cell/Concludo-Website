-- ==============================================================================
-- Concludo Workspace: User Profiles Table & Security Architecture
-- Tasklet 4: User Profiles System
-- ==============================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    plan TEXT NOT NULL DEFAULT 'free_preview',
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Add validation constraints on allowed values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_allowed_plan;
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_allowed_plan
    CHECK (plan IN ('free_preview', 'starter_trial', 'starter', 'pro_trial', 'pro', 'team', 'admin'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_allowed_role;
ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_allowed_role
    CHECK (role IN ('user', 'admin'));

-- 3. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Helper function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. RLS Policies:
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own initial profile" ON public.profiles;

-- RLS: Read own profile only (or admin)
CREATE POLICY "Users can read their own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR public.is_admin()
    );

-- RLS: Insert initial profile fallback
CREATE POLICY "Users can insert their own initial profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = id
        AND plan = 'free_preview'
        AND role = 'user'
    );

-- RLS: Update own profile
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6. Field Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();

    -- Check if call is from regular authenticated user
    IF auth.role() = 'authenticated' THEN
        -- If current user is not an admin, enforce strict immutable field rules
        IF NOT public.is_admin() THEN
            IF NEW.plan IS DISTINCT FROM OLD.plan THEN
                RAISE EXCEPTION 'Users are not permitted to change their plan';
            END IF;
            IF NEW.role IS DISTINCT FROM OLD.role THEN
                RAISE EXCEPTION 'Users are not permitted to change their role';
            END IF;
            IF NEW.email IS DISTINCT FROM OLD.email THEN
                RAISE EXCEPTION 'Users are not permitted to change their email directly';
            END IF;
            IF NEW.id IS DISTINCT FROM OLD.id THEN
                RAISE EXCEPTION 'Profile ID cannot be changed';
            END IF;
            IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                RAISE EXCEPTION 'Created date cannot be changed';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_profile_update ON public.profiles;
CREATE TRIGGER before_profile_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.protect_profile_fields();

-- 7. Trigger on auth.users for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, plan, role, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'free_preview',
        'user',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Backfill any existing users in auth.users
INSERT INTO public.profiles (id, email, full_name, plan, role, created_at, updated_at)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', ''), 
    'free_preview', 
    'user', 
    COALESCE(created_at, now()), 
    now()
FROM auth.users
ON CONFLICT (id) DO NOTHING;
