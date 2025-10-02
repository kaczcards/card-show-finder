-- Direct SQL test for "Star Wars" search
-- Run this in Supabase SQL Editor to test the search logic

-- Test 1: Find any booth with "Star Wars" in notable_items
SELECT 
  sp.id,
  sp.userid,
  sp.notable_items,
  sp.specialty,
  sp.card_types,
  s.title,
  s.location,
  s.start_date,
  s.status
FROM show_participants sp
JOIN shows s ON sp.showid = s.id
WHERE sp.notable_items ILIKE '%Star Wars%';

-- Test 2: Test the search function directly
SELECT search_shows_advanced('{
  "lat": 40.0772001,
  "lng": -85.925938,
  "radius_miles": 50,
  "start_date": "2025-09-01",
  "end_date": "2025-12-31",
  "max_entry_fee": null,
  "categories": null,
  "features": null,
  "keyword": "Star Wars",
  "dealer_card_types": null,
  "page_size": 20,
  "page": 1
}'::jsonb);

-- Test 3: Check shows in Carmel area
SELECT 
  id,
  title,
  location,
  address,
  start_date,
  status,
  coordinates
FROM shows 
WHERE 
  location ILIKE '%Carmel%' 
  OR address ILIKE '%46032%'
  OR address ILIKE '%Carmel%';

-- Test 4: Find your specific registrations
-- Replace YOUR_USER_ID with your actual UUID from the first query results
-- SELECT 
--   sp.*,
--   s.title,
--   s.location,
--   s.start_date
-- FROM show_participants sp
-- JOIN shows s ON sp.showid = s.id  
-- WHERE sp.userid = 'YOUR_USER_ID';