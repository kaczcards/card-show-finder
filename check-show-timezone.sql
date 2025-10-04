-- Check the specific show's time data
SELECT 
  id,
  title,
  start_date,
  end_date,
  daily_schedule,
  created_at
FROM shows
WHERE id = 'cd842344-8d47-48ff-82c0-c018620d50d3';

-- Also check the raw submitted data
SELECT 
  id,
  raw_payload->>'name' as show_name,
  raw_payload->'dailySchedule' as daily_schedule,
  raw_payload->>'startDate' as start_date,
  created_at
FROM scraped_shows_pending
WHERE status = 'APPROVED'
ORDER BY created_at DESC
LIMIT 5;
