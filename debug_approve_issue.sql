-- Debug script to find the exact issue
-- Run this in Supabase SQL Editor

-- Step 1: Check column types
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'scraped_shows_pending'
  AND column_name IN ('raw_payload', 'normalized_json', 'geocoded_json')
ORDER BY column_name;

-- Step 2: Get the pending show data
SELECT 
  id,
  status,
  raw_payload,
  pg_typeof(raw_payload) as payload_type
FROM scraped_shows_pending
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 1;

-- Step 3: Check what columns exist in the shows table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'shows'
ORDER BY ordinal_position;

-- Step 4: Try to call the function and see the exact error
-- First get the ID from Step 2, then uncomment and run this:
-- SELECT approve_pending_show('PASTE_ID_HERE'::uuid);
