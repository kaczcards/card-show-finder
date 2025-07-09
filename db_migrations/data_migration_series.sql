-- db_migrations/data_migration_series.sql
-- Data migration script to group existing shows into series and update references

-- Enable better error reporting
SET client_min_messages TO 'notice';

-- Start transaction for atomicity
BEGIN;

-- Create a temporary table to store show groupings
CREATE TEMP TABLE show_groups AS
WITH grouped_shows AS (
    SELECT 
        title,
        location,
        address,
        COUNT(*) as instance_count,
        MIN(id) as first_show_id,
        MIN(created_at) as first_created_at,
        STRING_AGG(id::text, ',') as show_ids,
        COALESCE(organizer_id, NULL) as most_common_organizer,
        STRING_AGG(DISTINCT COALESCE(description, ''), ' | ') as combined_description
    FROM 
        shows
    GROUP BY 
        title, location, address, organizer_id
    HAVING 
        COUNT(*) >= 1
)
SELECT 
    title,
    location,
    address,
    instance_count,
    first_show_id,
    first_created_at,
    show_ids,
    most_common_organizer,
    combined_description,
    uuid_generate_v4() as new_series_id
FROM 
    grouped_shows;

-- Log the grouping results
DO $$
DECLARE
    total_groups INTEGER;
    total_shows INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_groups FROM show_groups;
    SELECT SUM(instance_count) INTO total_shows FROM show_groups;
    
    RAISE NOTICE 'Found % show groups covering % individual shows', total_groups, total_shows;
END $$;

-- Insert new entries into show_series table
INSERT INTO show_series (id, name, organizer_id, description, created_at)
SELECT 
    new_series_id,
    title as name,
    most_common_organizer as organizer_id,
    combined_description as description,
    first_created_at as created_at
FROM 
    show_groups;

-- Log the series creation
DO $$
DECLARE
    series_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO series_count FROM show_series;
    RAISE NOTICE 'Created % show series records', series_count;
END $$;

-- Create a mapping table to help with review migration
CREATE TEMP TABLE show_to_series_map AS
SELECT 
    s.id as show_id,
    sg.new_series_id as series_id
FROM 
    shows s
JOIN 
    show_groups sg ON s.title = sg.title AND s.location = sg.location AND s.address = sg.address;

-- Update shows with their series_id
UPDATE shows s
SET series_id = m.series_id
FROM show_to_series_map m
WHERE s.id = m.show_id;

-- Log the show updates
DO $$
DECLARE
    updated_shows INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_shows FROM shows WHERE series_id IS NOT NULL;
    RAISE NOTICE 'Updated % shows with series_id references', updated_shows;
END $$;

-- Back up existing reviews before migration
CREATE TABLE IF NOT EXISTS reviews_backup_before_series_migration AS 
SELECT * FROM reviews;

-- Log the backup
DO $$
DECLARE
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO backup_count FROM reviews_backup_before_series_migration;
    RAISE NOTICE 'Backed up % reviews to reviews_backup_before_series_migration', backup_count;
END $$;

-- Create a temporary table for review migration
CREATE TEMP TABLE review_migration AS
WITH review_mapping AS (
    SELECT 
        r.id as review_id,
        r.show_id,
        m.series_id,
        r.user_id,
        r.rating,
        r.comment,
        r.created_at,
        r.updated_at,
        -- If multiple reviews exist for the same user+series, we'll keep the most recent
        ROW_NUMBER() OVER (PARTITION BY r.user_id, m.series_id ORDER BY r.created_at DESC) as rn
    FROM 
        reviews r
    JOIN 
        show_to_series_map m ON r.show_id = m.show_id
)
SELECT 
    review_id,
    show_id,
    series_id,
    user_id,
    rating,
    comment,
    created_at,
    updated_at
FROM 
    review_mapping
WHERE 
    rn = 1; -- Keep only the most recent review per user+series

-- Insert reviews into the new reviews table structure
INSERT INTO reviews (id, series_id, user_id, rating, comment, created_at, updated_at)
SELECT 
    uuid_generate_v4() as id, -- Generate new IDs to avoid conflicts
    series_id,
    user_id,
    rating,
    comment,
    created_at,
    updated_at
FROM 
    review_migration;

-- Log the review migration
DO $$
DECLARE
    original_count INTEGER;
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM reviews_backup_before_series_migration;
    SELECT COUNT(*) INTO migrated_count FROM reviews;
    RAISE NOTICE 'Migrated reviews: % original reviews consolidated into % series-based reviews', 
                 original_count, migrated_count;
END $$;

-- Update series average ratings based on migrated reviews
UPDATE show_series ss
SET 
    average_rating = avg_ratings.avg_rating,
    review_count = avg_ratings.review_count
FROM (
    SELECT 
        series_id, 
        AVG(rating)::numeric(3,2) as avg_rating,
        COUNT(*) as review_count
    FROM 
        reviews
    GROUP BY 
        series_id
) as avg_ratings
WHERE ss.id = avg_ratings.series_id;

-- Log the rating updates
DO $$
DECLARE
    updated_series INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_series FROM show_series WHERE average_rating IS NOT NULL;
    RAISE NOTICE 'Updated ratings for % show series', updated_series;
END $$;

-- Clean up temporary tables
DROP TABLE show_groups;
DROP TABLE show_to_series_map;
DROP TABLE review_migration;

-- Commit the transaction if everything succeeded
COMMIT;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Data migration completed successfully!';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '- Created show_series records for all existing shows';
    RAISE NOTICE '- Updated shows with series_id references';
    RAISE NOTICE '- Migrated reviews to reference series instead of individual shows';
    RAISE NOTICE '- Calculated average ratings for each series';
    RAISE NOTICE '';
    RAISE NOTICE 'Original reviews are backed up in reviews_backup_before_series_migration';
END $$;
