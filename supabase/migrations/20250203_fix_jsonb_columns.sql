-- Migration: 20250203_fix_jsonb_columns.sql
-- Description: Convert TEXT columns to JSONB in scraped_shows_pending table
-- Created: February 3, 2025

-- Check current column types
DO $$
BEGIN
  RAISE NOTICE 'Current column types for scraped_shows_pending:';
END $$;

-- Convert raw_payload from TEXT to JSONB if it's not already
DO $$
BEGIN
  -- Check if raw_payload is TEXT
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'scraped_shows_pending' 
    AND column_name = 'raw_payload' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'Converting raw_payload from TEXT to JSONB...';
    ALTER TABLE public.scraped_shows_pending 
    ALTER COLUMN raw_payload TYPE JSONB USING raw_payload::JSONB;
    RAISE NOTICE '✓ raw_payload converted to JSONB';
  ELSE
    RAISE NOTICE '✓ raw_payload is already JSONB';
  END IF;
END $$;

-- Convert normalized_json from TEXT to JSONB if it's not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'scraped_shows_pending' 
    AND column_name = 'normalized_json' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'Converting normalized_json from TEXT to JSONB...';
    ALTER TABLE public.scraped_shows_pending 
    ALTER COLUMN normalized_json TYPE JSONB USING normalized_json::JSONB;
    RAISE NOTICE '✓ normalized_json converted to JSONB';
  ELSE
    RAISE NOTICE '✓ normalized_json is already JSONB';
  END IF;
END $$;

-- Convert geocoded_json from TEXT to JSONB if it's not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'scraped_shows_pending' 
    AND column_name = 'geocoded_json' 
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE 'Converting geocoded_json from TEXT to JSONB...';
    ALTER TABLE public.scraped_shows_pending 
    ALTER COLUMN geocoded_json TYPE JSONB USING geocoded_json::JSONB;
    RAISE NOTICE '✓ geocoded_json converted to JSONB';
  ELSE
    RAISE NOTICE '✓ geocoded_json is already JSONB';
  END IF;
END $$;

-- Verify the changes
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'scraped_shows_pending'
  AND column_name IN ('raw_payload', 'normalized_json', 'geocoded_json')
ORDER BY column_name;

-- Done
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Column type conversion completed!';
  RAISE NOTICE 'All JSON columns are now JSONB type';
  RAISE NOTICE '========================================';
END $$;
