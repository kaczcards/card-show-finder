-- =============================================
-- fix_scraping_sources.sql
-- 
-- This script fixes the incorrect Sports Collectors Digest URL
-- and provides diagnostics on the scraping system
-- =============================================

-- =============================================
-- 1. Display current scraping sources
-- =============================================
SELECT 
  id,
  url,
  priority_score,
  enabled,
  last_success_at,
  last_error_at,
  error_streak,
  updated_at
FROM 
  public.scraping_sources
ORDER BY 
  priority_score DESC;

-- =============================================
-- 2. Update the incorrect Sports Collectors Digest URL
-- =============================================
UPDATE public.scraping_sources
SET 
  url = 'https://sportscollectorsdigest.com/',
  updated_at = NOW(),
  error_streak = 0,  -- Reset error streak
  last_error_at = NULL  -- Clear last error timestamp
WHERE 
  url = 'https://www.sportscollectorsdigest.com/events/card-shows/'
RETURNING 
  id, url, priority_score, enabled, updated_at;

-- =============================================
-- 3. Display updated scraping sources
-- =============================================
SELECT 
  id,
  url,
  priority_score,
  enabled,
  last_success_at,
  last_error_at,
  error_streak,
  updated_at
FROM 
  public.scraping_sources
ORDER BY 
  priority_score DESC;

-- =============================================
-- 4. Check current scraped_shows_pending table
-- =============================================
SELECT 
  COUNT(*) AS total_pending_shows,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) AS approved_count,
  COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) AS rejected_count,
  MIN(created_at) AS oldest_show,
  MAX(created_at) AS newest_show
FROM 
  public.scraped_shows_pending;

-- =============================================
-- 5. Most recent 10 shows (any status)
-- =============================================
SELECT 
  id,
  status,
  source_url,
  raw_payload->>'name' AS show_name,
  raw_payload->>'city' AS city,
  raw_payload->>'state' AS state,
  raw_payload->>'startDate' AS start_date,
  created_at
FROM 
  public.scraped_shows_pending
ORDER BY 
  created_at DESC
LIMIT 10;

-- =============================================
-- 6. Count by source URL (which scrapers are working)
-- =============================================
SELECT 
  source_url,
  COUNT(*) AS total_shows,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_shows,
  COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) AS approved_shows,
  COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) AS rejected_shows,
  MIN(created_at) AS first_scraped,
  MAX(created_at) AS last_scraped
FROM 
  public.scraped_shows_pending
GROUP BY 
  source_url
ORDER BY 
  COUNT(*) DESC;

-- =============================================
-- 7. Check if the tables exist (diagnostic)
-- =============================================
DO $$
BEGIN
  -- Check if scraped_shows_pending exists
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'scraped_shows_pending'
  ) THEN
    RAISE NOTICE 'Table scraped_shows_pending exists.';
  ELSE
    RAISE NOTICE 'ERROR: Table scraped_shows_pending does not exist!';
  END IF;
  
  -- Check if scraping_sources exists
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'scraping_sources'
  ) THEN
    RAISE NOTICE 'Table scraping_sources exists.';
  ELSE
    RAISE NOTICE 'ERROR: Table scraping_sources does not exist!';
  END IF;
END $$;

-- =============================================
-- 8. Verify the fix by triggering a new scrape
-- =============================================
-- Note: This is a comment only. After running this SQL,
-- you should trigger the scraper-agent function to test
-- if the fixed URL now successfully extracts shows:
--
-- curl -X POST "https://your-project-ref.supabase.co/functions/v1/scraper-agent" \
--   -H "Authorization: Bearer your-service-role-key" \
--   -H "Content-Type: application/json"
