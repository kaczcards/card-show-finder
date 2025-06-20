BEGIN;

-- Create mapping table
CREATE TEMP TABLE coordinate_mapping AS
SELECT 
    id,
    title,
    location,
    ST_X(coordinates) AS longitude,
    ST_Y(coordinates) AS latitude
FROM shows
WHERE coordinates::text LIKE '0101000020E6100000%';

-- Fix WKB hex coordinates
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(cm.longitude, cm.latitude), 4326)
FROM coordinate_mapping cm
WHERE shows.id = cm.id;

-- Add coordinates for Indiana cities
UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1581, 39.7684), 4326)
WHERE location LIKE '%Indianapolis%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1180, 39.9784), 4326)
WHERE location LIKE '%Carmel%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.1394, 41.0793), 4326)
WHERE location LIKE '%Fort Wayne%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.2520, 41.6764), 4326)
WHERE location LIKE '%South Bend%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.0143, 39.9567), 4326)
WHERE location LIKE '%Fishers%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.0086, 40.0456), 4326)
WHERE location LIKE '%Noblesville%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.3864, 40.1934), 4326)
WHERE location LIKE '%Muncie%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1336, 40.4865), 4326)
WHERE location LIKE '%Kokomo%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.8950, 41.7075), 4326)
WHERE location LIKE '%Michigan City%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1066, 39.6137), 4326)
WHERE location LIKE '%Greenwood%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-87.4547, 41.4789), 4326)
WHERE location LIKE '%Schererville%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-87.2564, 41.5728), 4326)
WHERE location LIKE '%Lake Station%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.1013, 38.6063), 4326)
WHERE location LIKE '%Salem%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-86.8744, 40.0411), 4326)
WHERE location LIKE '%Crawfordsville%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.4953, 40.8831), 4326)
WHERE location LIKE '%Huntington%' AND coordinates IS NULL;

UPDATE shows
SET coordinates = ST_SetSRID(ST_MakePoint(-85.6593, 40.5584), 4326)
WHERE location LIKE '%Marion%' AND coordinates IS NULL;

COMMIT;
