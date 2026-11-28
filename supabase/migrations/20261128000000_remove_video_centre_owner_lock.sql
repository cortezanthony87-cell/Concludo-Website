-- Concludo Video Meeting Centre: Removal Migration
-- Drops video meeting centre tables and owner verification function from public schema.
-- Applied on production and staging databases.

DROP TABLE IF EXISTS public.video_meeting_notes CASCADE;
DROP TABLE IF EXISTS public.video_meeting_preparations CASCADE;
DROP FUNCTION IF EXISTS public.is_video_owner() CASCADE;
DROP TABLE IF EXISTS public.video_centre_owner CASCADE;
