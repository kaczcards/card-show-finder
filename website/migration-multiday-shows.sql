-- ================================================================
-- Migration: Add Multi-Day Support and Organizer Info
-- ================================================================
-- This adds support for multi-day shows with different hours per day
-- Plus organizer contact information
-- ================================================================

-- Add organizer fields to shows table
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS organizer_name TEXT,
ADD COLUMN IF NOT EXISTS organizer_email TEXT,
ADD COLUMN IF NOT EXISTS daily_schedule JSONB;

-- Add organizer fields to scraped_shows_pending table
ALTER TABLE public.scraped_shows_pending
ADD COLUMN IF NOT EXISTS organizer_name TEXT,
ADD COLUMN IF NOT EXISTS organizer_email TEXT;

-- Add comments
COMMENT ON COLUMN public.shows.organizer_name IS 'Name of the show organizer for follow-up';
COMMENT ON COLUMN public.shows.organizer_email IS 'Email of the show organizer for follow-up';
COMMENT ON COLUMN public.shows.daily_schedule IS 'JSON array of daily schedules: [{"date": "2025-10-04", "startTime": "08:00", "endTime": "16:00"}]';

COMMENT ON COLUMN public.scraped_shows_pending.organizer_name IS 'Name of the show organizer who submitted';
COMMENT ON COLUMN public.scraped_shows_pending.organizer_email IS 'Email of the show organizer who submitted';

-- ================================================================
-- Example of daily_schedule JSON format:
-- ================================================================
-- Single day show:
-- [
--   {"date": "2025-10-04", "startTime": "08:00", "endTime": "14:00"}
-- ]
--
-- Multi-day show with different hours:
-- [
--   {"date": "2025-10-04", "startTime": "08:00", "endTime": "16:00"},
--   {"date": "2025-10-05", "startTime": "12:00", "endTime": "20:00"},
--   {"date": "2025-10-06", "startTime": "09:00", "endTime": "15:00"}
-- ]
-- ================================================================

-- Create an index on daily_schedule for faster queries
CREATE INDEX IF NOT EXISTS idx_shows_daily_schedule ON public.shows USING GIN (daily_schedule);

-- Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shows' 
  AND column_name IN ('organizer_name', 'organizer_email', 'daily_schedule')
ORDER BY column_name;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'scraped_shows_pending' 
  AND column_name IN ('organizer_name', 'organizer_email')
ORDER BY column_name;

-- ================================================================
-- Done! Tables are ready for multi-day shows.
-- ================================================================
