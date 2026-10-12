-- Migration: Add country, city, and timezone to profiles table
-- Author: Anthony Cortez / Concludo Architecture
-- Date: 2026-10-12

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Melbourne';

-- Update existing profiles to Australia/Melbourne default if null
UPDATE public.profiles
SET timezone = 'Australia/Melbourne'
WHERE timezone IS NULL;

-- Allow authenticated users to update their own country, city, and timezone
GRANT UPDATE (country, city, timezone) ON public.profiles TO authenticated;

-- Update trigger handle_new_user to capture country, city, timezone from auth metadata if present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        country,
        city,
        timezone,
        plan,
        role,
        created_at,
        updated_at,
        trial_start_date,
        trial_end_date
    )
    VALUES (
        NEW.id,
        NEW.email,
        NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
        NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'country', '')), ''),
        NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'city', '')), ''),
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'timezone'), ''), 'Australia/Melbourne'),
        'pro_subscription_trial',
        'user',
        now(),
        now(),
        now(),
        now() + interval '14 days'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        country = COALESCE(EXCLUDED.country, public.profiles.country),
        city = COALESCE(EXCLUDED.city, public.profiles.city),
        timezone = COALESCE(EXCLUDED.timezone, public.profiles.timezone);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
