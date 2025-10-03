-- ================================================================
-- Check Table Schema for scraped_shows_pending
-- ================================================================
-- This helps diagnose the data type issue
-- ================================================================

-- Check the column types
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'scraped_shows_pending'
ORDER BY ordinal_position;

-- Check a sample of the data
SELECT 
  id,
  raw_payload,
  normalized_json,
  pg_typeof(raw_payload) as raw_payload_type,
  pg_typeof(normalized_json) as normalized_json_type,
  status
FROM public.scraped_shows_pending
LIMIT 1;
