-- ================================================================
-- Quick Script to Approve a Pending Show
-- ================================================================
-- Use this to approve shows from the scraped_shows_pending table
-- and publish them to the shows table (making them visible in the app)
-- ================================================================

-- STEP 1: Find the ID of the show you want to approve
-- Run this to see all pending shows:
SELECT 
  id,
  raw_payload->>'name' AS show_name,
  raw_payload->>'startDate' AS start_date,
  raw_payload->>'venueName' AS venue,
  created_at,
  status
FROM public.scraped_shows_pending
WHERE status = 'PENDING'
ORDER BY created_at DESC;

-- STEP 2: Copy the ID from above and use it below
-- Replace 'YOUR-SHOW-ID-HERE' with the actual UUID

-- Example: SELECT public.approve_pending_show('12345678-1234-1234-1234-123456789abc');
SELECT public.approve_pending_show('YOUR-SHOW-ID-HERE');

-- ================================================================
-- That's it! The show is now published to the shows table
-- and will appear in the app immediately!
-- ================================================================

-- OPTIONAL: Verify the show was published
-- Check the shows table:
SELECT 
  id,
  title,
  location,
  address,
  start_date,
  status,
  created_at
FROM public.shows
ORDER BY created_at DESC
LIMIT 5;
