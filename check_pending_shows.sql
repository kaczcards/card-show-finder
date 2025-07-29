-- =============================================
-- check_pending_shows.sql
-- Diagnostic query to verify scraper functionality
-- =============================================

-- Safely check if required tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'scraped_shows_pending'
  ) THEN
    RAISE NOTICE 'ERROR: scraped_shows_pending table does not exist. Migrations may not be applied.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'SUCCESS: Required tables exist, proceeding with diagnostics...';
END $$;

-- =============================================
-- 1. Count of total pending shows
-- =============================================
SELECT 
  COUNT(*) AS total_pending_shows,
  (SELECT COUNT(*) FROM public.scraped_shows_pending) AS total_shows_all_statuses
FROM 
  public.scraped_shows_pending
WHERE 
  status = 'PENDING';

-- =============================================
-- 2. Most recent 10 shows (any status)
-- =============================================
SELECT 
  id,
  status,
  source_url,
  raw_payload->>'name' AS show_name,
  created_at,
  CASE 
    WHEN normalized_json IS NOT NULL THEN 'Yes' 
    ELSE 'No' 
  END AS is_normalized
FROM 
  public.scraped_shows_pending
ORDER BY 
  created_at DESC
LIMIT 10;

-- =============================================
-- 3. Count by source URL (which scrapers are working)
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
-- 4. Scraping source status from control table
-- =============================================
SELECT 
  url,
  priority_score,
  last_success_at,
  last_error_at,
  error_streak,
  enabled,
  updated_at
FROM 
  public.scraping_sources
ORDER BY 
  priority_score DESC, 
  last_success_at DESC NULLS LAST;

-- =============================================
-- 5. Error detection - shows with issues
-- =============================================
SELECT 
  id,
  source_url,
  raw_payload->>'name' AS show_name,
  CASE
    WHEN raw_payload->>'startDate' IS NULL THEN 'Missing start date'
    WHEN raw_payload->>'name' IS NULL THEN 'Missing name'
    WHEN raw_payload->>'city' IS NULL AND raw_payload->>'state' IS NULL THEN 'Missing location'
    ELSE NULL
  END AS issue_type,
  created_at
FROM 
  public.scraped_shows_pending
WHERE
  raw_payload->>'startDate' IS NULL OR
  raw_payload->>'name' IS NULL OR
  (raw_payload->>'city' IS NULL AND raw_payload->>'state' IS NULL)
ORDER BY
  created_at DESC
LIMIT 20;
