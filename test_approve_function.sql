-- Test the approve_pending_show function directly in SQL Editor
-- This will show us the exact error

-- First, let's see what pending shows we have
SELECT 
  id,
  status,
  raw_payload->>'name' as show_name,
  raw_payload->>'startDate' as start_date,
  created_at
FROM scraped_shows_pending
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 5;

-- Now let's try to approve the first one
-- REPLACE 'your-show-id-here' with the actual ID from above
-- SELECT approve_pending_show('your-show-id-here'::uuid);

-- To see the full error, run this:
-- DO $$
-- DECLARE
--   result JSONB;
-- BEGIN
--   result := approve_pending_show('your-show-id-here'::uuid);
--   RAISE NOTICE 'Result: %', result;
-- END $$;
