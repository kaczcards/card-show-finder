-- =========================================================
-- fix-show-coordinates-sql.sql
-- =========================================================
-- This script fixes coordinate format issues in the shows table:
-- 1. Identifies shows with incorrect coordinate formats
-- 2. Converts WKB hex coordinates to proper PostGIS POINT format
-- 3. Adds coordinates for shows in Indiana that are missing them
-- 4. Includes verification queries to check the results
-- =========================================================

-- Start a transaction so we can roll back if needed
BEGIN;

-- =========================================================
-- PART 1: Diagnostic queries to identify issues
-- =========================================================

-- Check how many shows have coordinates in WKB hex format
SELECT COUNT(*) AS shows_with_wkb_hex
FROM shows
WHERE coordinates::text LIKE '0101000020E6100000%';

-- Check how many shows are missing coordinates
SELECT COUNT(*) AS shows_missing_coordinates
FROM shows
WHERE coordinates IS NULL;

-- Check how many shows have coordinates in the correct format
SELECT COUNT(*) AS shows_with_correct_coordinates
FROM shows
WHERE coordinates IS NOT NULL AND coordinates::text NOT LIKE '0101000020E6100000%';

-- =========================================================
-- PART 2: Fix shows with WKB hex coordinates
-- =========================================================

-- Create a temporary table to store the mapping between WKB hex and POINT format
CREATE TEMP TABLE coordinate_mapping AS
SELECT 
    id,
    title,
    location,
    coordinates::text AS old_format,
    -- Extract coordinates from WKB format using PostGIS functions
    ST_AsText(coordinates) AS point_format,
    ST_X(coordinates) AS longitude,
    ST_Y(coordinates) AS latitude
FROM shows
WHERE coordinates::text LIKE '0101000020E6100000%';

-- View the mapping to verify extraction worked
SELECT * FROM coordinate_mapping;

-- Update shows with the correct POINT format
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(cm.longitude, cm.latitude), 4326)
FROM coordinate_mapping cm
WHERE shows.id = cm.id;

-- =========================================================
-- PART 3: Add coordinates for Indiana shows
-- =========================================================

-- Define coordinates for Indiana cities
-- These are approximate coordinates for various cities in Indiana

-- Update Indianapolis shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1581, 39.7684), 4326)
WHERE location LIKE '%Indianapolis%'
  AND coordinates IS NULL;

-- Update Carmel shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1180, 39.9784), 4326)
WHERE location LIKE '%Carmel%'
  AND coordinates IS NULL;

-- Update Fort Wayne shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.1394, 41.0793), 4326)
WHERE location LIKE '%Fort Wayne%'
  AND coordinates IS NULL;

-- Update South Bend shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.2520, 41.6764), 4326)
WHERE location LIKE '%South Bend%'
  AND coordinates IS NULL;

-- Update Fishers shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.0143, 39.9567), 4326)
WHERE location LIKE '%Fishers%'
  AND coordinates IS NULL;

-- Update Noblesville shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.0086, 40.0456), 4326)
WHERE location LIKE '%Noblesville%'
  AND coordinates IS NULL;

-- Update Muncie shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.3864, 40.1934), 4326)
WHERE location LIKE '%Muncie%'
  AND coordinates IS NULL;

-- Update Kokomo shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1336, 40.4865), 4326)
WHERE location LIKE '%Kokomo%'
  AND coordinates IS NULL;

-- Update Michigan City shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.8950, 41.7075), 4326)
WHERE location LIKE '%Michigan City%'
  AND coordinates IS NULL;

-- Update Greenwood shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1066, 39.6137), 4326)
WHERE location LIKE '%Greenwood%'
  AND coordinates IS NULL;

-- Update Schererville shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-87.4547, 41.4789), 4326)
WHERE location LIKE '%Schererville%'
  AND coordinates IS NULL;

-- Update Lake Station shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-87.2564, 41.5728), 4326)
WHERE location LIKE '%Lake Station%'
  AND coordinates IS NULL;

-- Update Salem shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1013, 38.6063), 4326)
WHERE location LIKE '%Salem%'
  AND coordinates IS NULL;

-- Update Crawfordsville shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.8744, 40.0411), 4326)
WHERE location LIKE '%Crawfordsville%'
  AND coordinates IS NULL;

-- Update Huntington shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.4953, 40.8831), 4326)
WHERE location LIKE '%Huntington%'
  AND coordinates IS NULL;

-- Update Marion shows
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.6593, 40.5584), 4326)
WHERE location LIKE '%Marion%'
  AND coordinates IS NULL;

-- =========================================================
-- PART 4: Verification queries
-- =========================================================

-- Check if any shows still have WKB hex coordinates
SELECT COUNT(*) AS remaining_shows_with_wkb_hex
FROM shows
WHERE coordinates::text LIKE '0101000020E6100000%';

-- Check how many shows are still missing coordinates
SELECT COUNT(*) AS remaining_shows_missing_coordinates
FROM shows
WHERE coordinates IS NULL;

-- Check how many shows now have coordinates in the correct format
SELECT COUNT(*) AS shows_with_correct_coordinates
FROM shows
WHERE coordinates IS NOT NULL AND coordinates::text NOT LIKE '0101000020E6100000%';

-- Test spatial query to make sure coordinates work with PostGIS functions
-- This tests if shows near Indianapolis (within 25 miles) can be found
SELECT 
    id,
    title,
    location,
    ST_AsText(coordinates) AS coordinates_text,
    ST_Distance(
        coordinates::geography,
        ST_SetSRID(ST_MakePoint(-86.1581, 39.7684), 4326)::geography
    ) / 1609.34 AS distance_miles
FROM shows
WHERE ST_DWithin(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(-86.1581, 39.7684), 4326)::geography,
    25 * 1609.34  -- 25 miles in meters
)
ORDER BY distance_miles;

-- If everything looks good, commit the transaction
COMMIT;

-- If there are issues, you can roll back with:
-- ROLLBACK;
