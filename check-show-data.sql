-- Check what data is stored for the "Christmas comes early" show
SELECT 
  id,
  title,
  daily_schedule,
  features,
  categories,
  start_date,
  end_date
FROM shows
WHERE title ILIKE '%christmas%'
ORDER BY created_at DESC
LIMIT 1;

-- Also check the raw submission data
SELECT 
  raw_payload->'description' as description,
  raw_payload->'features' as features,
  raw_payload->'categories' as categories,
  raw_payload->'dailySchedule' as daily_schedule
FROM scraped_shows_pending
WHERE raw_payload->>'name' ILIKE '%christmas%'
ORDER BY created_at DESC
LIMIT 1;
