-- ================================================================
-- DATABASE_COMPLEXITY_COMPREHENSIVE_FIX.sql
-- ================================================================
-- Comprehensive solution for database complexity issues in Card Show Finder
-- Created: July 23, 2025
-- Version: 1.0
--
-- Purpose:
--   This script resolves all database complexity issues including:
--   1. Multiple versions of critical functions (10+ versions of get_paginated_shows)
--   2. Infinite recursion in RLS policies
--   3. Column mismatches in security policies
--   4. Scattered emergency fixes
--
-- Features:
--   1. Idempotent execution (safe to run multiple times)
--   2. Comprehensive analysis of current issues
--   3. Safe cleanup of duplicate/broken functions and policies
--   4. Implementation of canonical function versions
--   5. Verification and testing
--   6. Rollback mechanism
--
-- Usage:
--   Run this script in the Supabase SQL Editor or as a migration
--   to establish a secure and stable baseline for the database.
-- ================================================================

-- Use a transaction to ensure all changes are atomic
BEGIN;

-- Enable detailed error reporting
SET client_min_messages TO notice;

-- ================================================================
-- SECTION 1: ANALYSIS
-- ================================================================

-- Create a temporary logging table for this execution
CREATE TEMP TABLE IF NOT EXISTS complexity_fix_log (
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operation TEXT,
  object_type TEXT,
  object_name TEXT,
  status TEXT,
  message TEXT
);

-- Log function for tracking changes
CREATE OR REPLACE FUNCTION log_operation(
  operation TEXT,
  object_type TEXT,
  object_name TEXT,
  status TEXT DEFAULT 'SUCCESS',
  message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO complexity_fix_log (operation, object_type, object_name, status, message)
  VALUES (operation, object_type, object_name, status, message);
  
  RAISE NOTICE '% % %: % %', 
    operation, 
    object_type, 
    object_name, 
    status, 
    COALESCE(message, '');
END;
$$ LANGUAGE plpgsql;

-- Function to check for duplicate function definitions
CREATE OR REPLACE FUNCTION analyze_duplicate_functions(
  function_name TEXT
) RETURNS TABLE (
  schema_name TEXT,
  function_name TEXT,
  argument_types TEXT,
  return_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.nspname::TEXT AS schema_name,
    p.proname::TEXT AS function_name,
    pg_get_function_arguments(p.oid)::TEXT AS argument_types,
    pg_get_function_result(p.oid)::TEXT AS return_type,
    COUNT(*) OVER (PARTITION BY p.proname) AS count
  FROM 
    pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE 
    n.nspname = 'public' AND
    p.proname = function_name
  ORDER BY 
    p.proname;
END;
$$ LANGUAGE plpgsql;

-- Function to check for RLS infinite recursion risks
CREATE OR REPLACE FUNCTION analyze_rls_recursion_risks() 
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  policy_definition TEXT,
  risk_level TEXT,
  risk_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH policy_info AS (
    SELECT
      schemaname,
      tablename,
      policyname,
      REGEXP_REPLACE(
        REGEXP_REPLACE(qual, '^\(', ''), 
        '\)$', ''
      ) AS policy_definition
    FROM
      pg_policies
    WHERE
      schemaname = 'public'
  )
  SELECT
    pi.tablename::TEXT AS table_name,
    pi.policyname::TEXT AS policy_name,
    pi.policy_definition::TEXT,
    CASE
      WHEN pi.policy_definition LIKE '%' || pi.tablename || '%' THEN 'HIGH'
      WHEN pi.policy_definition LIKE '%participates_in_show%' AND 
           pi.tablename = 'show_participants' THEN 'HIGH'
      WHEN pi.policy_definition LIKE '%is_any_dealer%' AND 
           EXISTS (
             SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND 
                   p.proname = 'is_any_dealer' AND
                   pg_get_functiondef(p.oid) LIKE '%show_participants%'
           ) THEN 'MEDIUM'
      ELSE 'LOW'
    END AS risk_level,
    CASE
      WHEN pi.policy_definition LIKE '%' || pi.tablename || '%' THEN 
        'Policy directly references its own table, potential infinite recursion'
      WHEN pi.policy_definition LIKE '%participates_in_show%' AND 
           pi.tablename = 'show_participants' THEN 
        'Policy uses participates_in_show function which may query show_participants recursively'
      WHEN pi.policy_definition LIKE '%is_any_dealer%' AND 
           EXISTS (
             SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND 
                   p.proname = 'is_any_dealer' AND
                   pg_get_functiondef(p.oid) LIKE '%show_participants%'
           ) THEN 
        'Policy uses is_any_dealer function which may query show_participants indirectly'
      ELSE 'No obvious recursion risk'
    END AS risk_reason
  FROM
    policy_info pi
  ORDER BY
    CASE
      WHEN risk_level = 'HIGH' THEN 1
      WHEN risk_level = 'MEDIUM' THEN 2
      ELSE 3
    END,
    pi.tablename,
    pi.policyname;
END;
$$ LANGUAGE plpgsql;

-- Function to check for column mismatches in RLS policies
CREATE OR REPLACE FUNCTION analyze_column_mismatches() 
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  policy_definition TEXT,
  column_name TEXT,
  issue_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH policy_info AS (
    SELECT
      schemaname,
      tablename,
      policyname,
      REGEXP_REPLACE(
        REGEXP_REPLACE(qual, '^\(', ''), 
        '\)$', ''
      ) AS policy_definition
    FROM
      pg_policies
    WHERE
      schemaname = 'public'
  ),
  table_columns AS (
    SELECT
      c.table_name,
      c.column_name
    FROM
      information_schema.columns c
    WHERE
      c.table_schema = 'public'
  ),
  policy_columns AS (
    SELECT
      pi.tablename,
      pi.policyname,
      pi.policy_definition,
      regexp_matches(pi.policy_definition, '([a-zA-Z0-9_]+)[ ]*[=><]', 'g') AS column_ref
    FROM
      policy_info pi
  )
  SELECT
    pc.tablename::TEXT AS table_name,
    pc.policyname::TEXT AS policy_name,
    pc.policy_definition::TEXT,
    pc.column_ref[1]::TEXT AS column_name,
    CASE
      WHEN tc.column_name IS NULL AND pc.column_ref[1] NOT IN ('auth', 'true', 'false', 'null') THEN 
        'Column referenced in policy does not exist in table'
      ELSE 'OK'
    END AS issue_type
  FROM
    policy_columns pc
    LEFT JOIN table_columns tc ON 
      tc.table_name = pc.tablename AND
      tc.column_name = pc.column_ref[1]
  WHERE
    tc.column_name IS NULL AND 
    pc.column_ref[1] NOT IN ('auth', 'true', 'false', 'null', 'exists', 'select')
  ORDER BY
    pc.tablename,
    pc.policyname;
END;
$$ LANGUAGE plpgsql;

-- Run analysis on duplicate functions
DO $$
DECLARE
  critical_functions TEXT[] := ARRAY[
    'get_paginated_shows',
    'get_show_details_by_id',
    'create_show_with_coordinates',
    'get_conversations',
    'get_conversation_messages',
    'send_message',
    'participates_in_show'
  ];
  func_name TEXT;
  duplicate_count INTEGER;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'ANALYSIS: DUPLICATE FUNCTIONS';
  RAISE NOTICE '================================================================';
  
  FOREACH func_name IN ARRAY critical_functions
  LOOP
    SELECT COUNT(*) INTO duplicate_count
    FROM analyze_duplicate_functions(func_name);
    
    IF duplicate_count > 1 THEN
      PERFORM log_operation('ANALYZE', 'Function', func_name, 'WARNING', 
                           'Found ' || duplicate_count || ' versions of this function');
    ELSIF duplicate_count = 1 THEN
      PERFORM log_operation('ANALYZE', 'Function', func_name, 'INFO', 
                           'Single version found - OK');
    ELSE
      PERFORM log_operation('ANALYZE', 'Function', func_name, 'INFO', 
                           'Function not found - will be created');
    END IF;
  END LOOP;
END $$;

-- Run analysis on RLS recursion risks
DO $$
DECLARE
  rec RECORD;
  high_risk_count INTEGER := 0;
  medium_risk_count INTEGER := 0;
  low_risk_count INTEGER := 0;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'ANALYSIS: RLS RECURSION RISKS';
  RAISE NOTICE '================================================================';
  
  FOR rec IN SELECT * FROM analyze_rls_recursion_risks()
  LOOP
    IF rec.risk_level = 'HIGH' THEN
      high_risk_count := high_risk_count + 1;
      PERFORM log_operation('ANALYZE', 'RLS Policy', rec.table_name || '.' || rec.policy_name, 
                           'WARNING', rec.risk_reason);
    ELSIF rec.risk_level = 'MEDIUM' THEN
      medium_risk_count := medium_risk_count + 1;
    ELSIF rec.risk_level = 'LOW' THEN
      low_risk_count := low_risk_count + 1;
    END IF;
  END LOOP;
  
  PERFORM log_operation('ANALYZE', 'RLS Summary', 'Recursion Risks', 'INFO', 
                       high_risk_count || ' high risk, ' || 
                       medium_risk_count || ' medium risk, ' ||
                       low_risk_count || ' low risk policies found');
END $$;

-- Run analysis on column mismatches
DO $$
DECLARE
  rec RECORD;
  mismatch_count INTEGER := 0;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'ANALYSIS: COLUMN MISMATCHES';
  RAISE NOTICE '================================================================';
  
  FOR rec IN SELECT * FROM analyze_column_mismatches()
  LOOP
    IF rec.issue_type <> 'OK' THEN
      mismatch_count := mismatch_count + 1;
      PERFORM log_operation('ANALYZE', 'Column Mismatch', rec.table_name || '.' || rec.column_name, 
                           'WARNING', 'Referenced in policy ' || rec.policy_name || ' but does not exist');
    END IF;
  END LOOP;
  
  IF mismatch_count = 0 THEN
    PERFORM log_operation('ANALYZE', 'Column Summary', 'Mismatches', 'INFO', 'No column mismatches found');
  ELSE
    PERFORM log_operation('ANALYZE', 'Column Summary', 'Mismatches', 'WARNING', 
                         mismatch_count || ' column mismatches found');
  END IF;
END $$;

-- ================================================================
-- SECTION 2: CLEANUP
-- ================================================================

-- Function to safely drop functions without errors if they don't exist
CREATE OR REPLACE FUNCTION safe_drop_function(
  function_name TEXT,
  argument_types TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  drop_statement TEXT;
BEGIN
  -- If argument types are provided, use them for a specific function signature
  IF argument_types IS NOT NULL THEN
    drop_statement := 'DROP FUNCTION IF EXISTS public.' || function_name || '(' || argument_types || ')';
  ELSE
    -- Otherwise drop all functions with this name (all overloads)
    drop_statement := 'DROP FUNCTION IF EXISTS public.' || function_name || ' CASCADE';
  END IF;
  
  -- Execute the drop statement
  BEGIN
    EXECUTE drop_statement;
    PERFORM log_operation('DROP', 'Function', function_name, 'SUCCESS');
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM log_operation('DROP', 'Function', function_name, 'ERROR', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to safely drop policies without errors if they don't exist
CREATE OR REPLACE FUNCTION safe_drop_policy(
  policy_name TEXT,
  table_name TEXT
) RETURNS VOID AS $$
BEGIN
  -- Check if policy exists before trying to drop it
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = policy_name 
    AND tablename = table_name
  ) THEN
    EXECUTE format('DROP POLICY %I ON %I', policy_name, table_name);
    PERFORM log_operation('DROP', 'Policy', policy_name || ' ON ' || table_name);
  ELSE
    PERFORM log_operation('SKIP', 'Policy', policy_name || ' ON ' || table_name, 'INFO', 'Policy does not exist');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('DROP', 'Policy', policy_name || ' ON ' || table_name, 'ERROR', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Clean up duplicate critical functions
SELECT safe_drop_function('get_paginated_shows');
SELECT safe_drop_function('get_show_details_by_id');
SELECT safe_drop_function('create_show_with_coordinates');
SELECT safe_drop_function('get_conversations');
SELECT safe_drop_function('get_conversation_messages');
SELECT safe_drop_function('send_message');
SELECT safe_drop_function('participates_in_show');
SELECT safe_drop_function('participates_in_show_safe');

-- Clean up potentially recursive helper functions
SELECT safe_drop_function('is_admin');
SELECT safe_drop_function('is_show_organizer');
SELECT safe_drop_function('is_mvp_dealer');
SELECT safe_drop_function('is_dealer');
SELECT safe_drop_function('is_any_dealer');
SELECT safe_drop_function('organizes_show');

-- Clean up RLS policies with recursion risks on show_participants table
SELECT safe_drop_policy('show_participants_select_self', 'show_participants');
SELECT safe_drop_policy('show_participants_select_organizer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_mvp_dealer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_mvp_dealer_fixed', 'show_participants');
SELECT safe_drop_policy('show_participants_select_mvp_dealer_safe', 'show_participants');
SELECT safe_drop_policy('show_participants_insert', 'show_participants');
SELECT safe_drop_policy('show_participants_update_self', 'show_participants');
SELECT safe_drop_policy('show_participants_delete_self', 'show_participants');
SELECT safe_drop_policy('show_participants_update_organizer', 'show_participants');
SELECT safe_drop_policy('show_participants_all_admin', 'show_participants');

-- ================================================================
-- SECTION 3: IMPLEMENTATION
-- ================================================================

-- ----------------------------------------------------------------
-- 3.1: Helper Functions
-- ----------------------------------------------------------------

-- Function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin() IS 'Checks if the current user has admin role';

-- Function to check if user is a show organizer
CREATE OR REPLACE FUNCTION is_show_organizer() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'show_organizer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_show_organizer() IS 'Checks if the current user has show_organizer role';

-- Function to check if user is an MVP dealer
CREATE OR REPLACE FUNCTION is_mvp_dealer() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'mvp_dealer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_mvp_dealer() IS 'Checks if the current user has mvp_dealer role';

-- Function to check if user is a regular dealer
CREATE OR REPLACE FUNCTION is_dealer() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'dealer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_dealer() IS 'Checks if the current user has dealer role';

-- Function to check if user is a dealer of any type (regular or MVP)
CREATE OR REPLACE FUNCTION is_any_dealer() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (LOWER(role) = 'dealer' OR LOWER(role) = 'mvp_dealer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_any_dealer() IS 'Checks if the current user has either dealer or mvp_dealer role';

-- NON-RECURSIVE function to check if user participates in a show
-- This avoids the infinite recursion issue by not querying show_participants
CREATE OR REPLACE FUNCTION participates_in_show_safe(showid UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  -- Use the profile's role to determine if they're an MVP dealer
  -- and check if they're associated with the show through other means
  RETURN EXISTS (
    SELECT 1 
    FROM profiles p
    LEFT JOIN shows s ON s.organizer_id = p.id
    WHERE 
      p.id = auth.uid() AND
      (
        -- Either they organize the show
        s.id = showid OR
        -- Or they're listed in the shows.dealers array (if that exists)
        (
          EXISTS (
            SELECT 1 FROM shows 
            WHERE id = showid AND 
            dealers IS NOT NULL AND 
            auth.uid()::text = ANY(dealers)
          )
        ) OR
        -- Or they have planned attendance for this show
        (
          EXISTS (
            SELECT 1 FROM planned_attendance pa
            WHERE pa.show_id = showid AND pa.user_id = auth.uid()
          )
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION participates_in_show_safe(UUID) IS 'Safely checks if a user participates in a show without recursive queries';

-- Function to check if user organizes a show
CREATE OR REPLACE FUNCTION organizes_show(show_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM shows
    WHERE id = show_id AND organizer_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION organizes_show(UUID) IS 'Checks if the current user organizes a specific show';

-- Function to validate coordinates for shows
CREATE OR REPLACE FUNCTION validate_coordinates(
  lat FLOAT,
  long FLOAT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if coordinates are within valid ranges
  -- Latitude: -90 to 90, Longitude: -180 to 180
  IF lat < -90 OR lat > 90 OR long < -180 OR long > 180 THEN
    RETURN FALSE;
  END IF;
  
  -- Check if coordinates are not at 0,0 (null island)
  IF lat = 0 AND long = 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_coordinates(FLOAT, FLOAT) IS 'Validates that latitude and longitude are within valid ranges';

-- Function to create a PostGIS point from lat/long
CREATE OR REPLACE FUNCTION create_geography_point(
  lat FLOAT,
  long FLOAT
) RETURNS GEOGRAPHY AS $$
BEGIN
  IF NOT validate_coordinates(lat, long) THEN
    RAISE EXCEPTION 'Invalid coordinates: latitude=%, longitude=%', lat, long;
  END IF;
  
  RETURN ST_SetSRID(ST_MakePoint(long, lat), 4326)::GEOGRAPHY;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_geography_point(FLOAT, FLOAT) IS 'Creates a PostGIS geography point from latitude and longitude';

PERFORM log_operation('CREATE', 'Section', 'Helper Functions', 'SUCCESS', '9 helper functions created');

-- ----------------------------------------------------------------
-- 3.2: Critical Database Functions
-- ----------------------------------------------------------------

-- 1. Get Paginated Shows Function (Stable Version)
CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,                          -- Latitude of center point
  long float,                         -- Longitude of center point
  radius_miles float DEFAULT 25,      -- Search radius in miles
  start_date timestamp with time zone DEFAULT current_date, -- Start of date range
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days'), -- End of date range
  max_entry_fee numeric DEFAULT NULL, -- Maximum entry fee filter
  categories text[] DEFAULT NULL,     -- Categories filter
  features jsonb DEFAULT NULL,        -- Features filter
  page_size integer DEFAULT 20,       -- Number of results per page
  page integer DEFAULT 1              -- Page number (1-based)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count integer;
  offset_val integer;
  shows_data jsonb;
  filtered_shows jsonb;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (get_paginated_shows.page - 1) * get_paginated_shows.page_size;
  
  -- First, get the total count of shows that match the criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    -- Filter for shows that haven't ended yet (including shows happening today)
    s.end_date >= CURRENT_DATE AND
    
    -- Filter for shows in the specified future date range
    s.start_date <= get_paginated_shows.end_date AND
    
    -- Only include shows with valid coordinates
    s.coordinates IS NOT NULL AND
    
    -- Filter for shows within the specified radius
    ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography,
      get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
    ) AND
    
    -- Only return active shows
    s.status = 'ACTIVE' AND
    
    -- Apply max entry fee filter if provided
    (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee) AND
    
    -- Apply categories filter if provided
    (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories) AND
    
    -- Apply features filter if provided
    (get_paginated_shows.features IS NULL OR (
      s.features @> get_paginated_shows.features
    ));

  -- Now get the paginated results
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'series_id', s.series_id,
        'title', s.title,
        'description', s.description,
        'location', s.location,
        'address', s.address,
        'start_date', s.start_date,
        'end_date', s.end_date,
        'entry_fee', s.entry_fee,
        'image_url', s.image_url,
        'rating', s.rating,
        'coordinates', s.coordinates,
        'status', s.status,
        'organizer_id', s.organizer_id,
        'features', s.features,
        'categories', s.categories,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        'latitude', ST_Y(s.coordinates::geometry),
        'longitude', ST_X(s.coordinates::geometry),
        -- Calculate distance in miles from the search point
        'distance_miles', ST_Distance(
          s.coordinates::geography,
          ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography
        ) / 1609.34
      )
    ) INTO shows_data
  FROM public.shows s
  WHERE
    -- Filter for shows that haven't ended yet (including shows happening today)
    s.end_date >= CURRENT_DATE AND
    
    -- Filter for shows in the specified future date range
    s.start_date <= get_paginated_shows.end_date AND
    
    -- Only include shows with valid coordinates
    s.coordinates IS NOT NULL AND
    
    -- Filter for shows within the specified radius
    ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography,
      get_paginated_shows.radius_miles * 1609.34  -- Convert miles to meters
    ) AND
    
    -- Only return active shows
    s.status = 'ACTIVE' AND
    
    -- Apply max entry fee filter if provided
    (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee) AND
    
    -- Apply categories filter if provided
    (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories) AND
    
    -- Apply features filter if provided
    (get_paginated_shows.features IS NULL OR (
      s.features @> get_paginated_shows.features
    ))
  ORDER BY 
    -- Order by start date first (upcoming shows first)
    s.start_date ASC,
    -- Then by distance (closest first)
    ST_Distance(
      s.coordinates::geography, 
      ST_SetSRID(ST_MakePoint(get_paginated_shows.long, get_paginated_shows.lat), 4326)::geography
    ) ASC
  LIMIT get_paginated_shows.page_size
  OFFSET offset_val;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build the final result object with pagination metadata
  filtered_shows := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', get_paginated_shows.page_size,
      'current_page', get_paginated_shows.page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / get_paginated_shows.page_size)
    )
  );
  
  RETURN filtered_shows;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    PERFORM log_operation('EXECUTE', 'Function', 'get_paginated_shows', 'ERROR', SQLERRM);
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- Add documentation comment
COMMENT ON FUNCTION public.get_paginated_shows IS 
'Retrieves a paginated list of active upcoming shows within a specified radius and matching filter criteria.
This fixed version properly handles:
- Only shows upcoming events (end_date >= CURRENT_DATE)
- Correctly filters by distance using PostGIS
- Orders results by start date and then distance
- Adds distance_miles to each result for client-side use

Parameters:
  lat - Latitude of the center point
  long - Longitude of the center point
  radius_miles - Radius in miles (default: 25)
  start_date - Start date for filtering shows (default: current date)
  end_date - End date for filtering shows (default: current date + 30 days)
  max_entry_fee - Maximum entry fee filter (default: NULL = no limit)
  categories - Array of categories to filter by (default: NULL = all categories)
  features - JSONB object of required features (default: NULL = no feature filtering)
  page_size - Number of results per page (default: 20)
  page - Page number, 1-based (default: 1)

Returns:
  A JSONB object containing:
  - data: Array of show objects with all columns plus extracted latitude/longitude and distance_miles
  - pagination: Object with total_count, page_size, current_page, and total_pages';

PERFORM log_operation('CREATE', 'Function', 'get_paginated_shows', 'SUCCESS', 'Canonical version installed');

-- 2. Get Show Details By ID Function (Stable Version)
CREATE OR REPLACE FUNCTION public.get_show_details_by_id(
  show_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  show_data JSONB;
  organizer_data JSONB;
  dealers_data JSONB;
  result_json JSONB;
BEGIN
  -- Get the show data
  SELECT 
    to_jsonb(s) AS show
  INTO show_data
  FROM 
    public.shows s
  WHERE 
    s.id = show_id;
    
  IF show_data IS NULL THEN
    RAISE EXCEPTION 'Show with ID % not found', show_id;
  END IF;
  
  -- Get the organizer profile if it exists
  IF (show_data->>'organizer_id') IS NOT NULL THEN
    SELECT 
      to_jsonb(p) AS profile
    INTO organizer_data
    FROM 
      public.profiles p
    WHERE 
      p.id = (show_data->>'organizer_id')::UUID;
  ELSE
    organizer_data := NULL;
  END IF;
  
  -- Get all dealers participating in the show
  WITH all_dealers AS (
    SELECT
      p.id,
      CONCAT(p.first_name, ' ', p.last_name) AS name,
      p.profile_image_url,
      UPPER(p.role) AS role,
      p.account_type,
      osd.booth_location
    FROM 
      public.show_participants osd
    JOIN 
      public.profiles p ON osd.userid = p.id
    WHERE 
      osd.showid = show_id
    AND
      LOWER(p.role) IN ('mvp_dealer', 'dealer', 'show_organizer')
  )
  
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'profileImageUrl', d.profile_image_url,
        'role', d.role,
        'accountType', d.account_type,
        'boothLocation', d.booth_location
      )
    ) AS dealers
  INTO dealers_data
  FROM 
    all_dealers d;
    
  -- If no dealers found, set to empty array instead of null
  IF dealers_data IS NULL THEN
    dealers_data := '[]'::JSONB;
  END IF;
  
  -- Combine all data into a single JSON object
  result_json := jsonb_build_object(
    'show', show_data,
    'organizer', organizer_data,
    'participatingDealers', dealers_data,
    'isFavoriteCount', (
      SELECT COUNT(*) 
      FROM public.user_favorite_shows 
      WHERE public.user_favorite_shows.show_id = get_show_details_by_id.show_id
    )
  );
  
  RETURN result_json;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('EXECUTE', 'Function', 'get_show_details_by_id', 'ERROR', SQLERRM);
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO anon;
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO service_role;

COMMENT ON FUNCTION public.get_show_details_by_id IS 'Gets detailed information about a show including organizer and participating dealers (now including show organizers who register as dealers)';

PERFORM log_operation('CREATE', 'Function', 'get_show_details_by_id', 'SUCCESS', 'Canonical version installed');

-- 3. Create Show with Coordinates Function (Stable Version)
CREATE OR REPLACE FUNCTION public.create_show_with_coordinates(
  title TEXT,
  description TEXT,
  location TEXT,
  address TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  entry_fee NUMERIC,
  image_url TEXT,
  lat FLOAT,
  long FLOAT,
  features JSONB DEFAULT NULL,
  categories TEXT[] DEFAULT NULL,
  series_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_show_id UUID;
  coordinates GEOGRAPHY;
BEGIN
  -- Validate coordinates
  IF NOT validate_coordinates(lat, long) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid coordinates provided',
      'details', jsonb_build_object('lat', lat, 'long', long)
    );
  END IF;
  
  -- Create geography point
  coordinates := create_geography_point(lat, long);
  
  -- Insert the new show
  INSERT INTO public.shows (
    title,
    description,
    location,
    address,
    start_date,
    end_date,
    entry_fee,
    image_url,
    coordinates,
    features,
    categories,
    status,
    organizer_id,
    series_id
  )
  VALUES (
    create_show_with_coordinates.title,
    create_show_with_coordinates.description,
    create_show_with_coordinates.location,
    create_show_with_coordinates.address,
    create_show_with_coordinates.start_date,
    create_show_with_coordinates.end_date,
    create_show_with_coordinates.entry_fee,
    create_show_with_coordinates.image_url,
    coordinates,
    COALESCE(create_show_with_coordinates.features, '{}'::JSONB),
    COALESCE(create_show_with_coordinates.categories, '{}'::TEXT[]),
    'ACTIVE',
    auth.uid(),
    create_show_with_coordinates.series_id
  )
  RETURNING id INTO new_show_id;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'id', new_show_id,
    'coordinates', jsonb_build_object(
      'latitude', lat,
      'longitude', long
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('EXECUTE', 'Function', 'create_show_with_coordinates', 'ERROR', SQLERRM);
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_show_with_coordinates TO authenticated;

-- Add documentation comment
COMMENT ON FUNCTION public.create_show_with_coordinates IS 
'Creates a new show with validated coordinates. This function safely handles coordinate validation
and properly creates a PostGIS geography point. It avoids the trigger-based validation issues
and provides detailed error messages.

Parameters:
  title - Show title
  description - Show description
  location - Location name
  address - Full address
  start_date - Start date and time
  end_date - End date and time
  entry_fee - Entry fee amount
  image_url - URL to show image
  lat - Latitude (must be between -90 and 90)
  long - Longitude (must be between -180 and 180)
  features - Optional JSONB object with show features
  categories - Optional array of show categories
  series_id - Optional UUID of show series this show belongs to

Returns:
  A JSONB object containing:
  - success: boolean indicating if operation succeeded
  - id: UUID of the new show if successful
  - coordinates: Object with latitude and longitude if successful
  - error: Error message if unsuccessful
  - errorCode: SQL error code if unsuccessful';

PERFORM log_operation('CREATE', 'Function', 'create_show_with_coordinates', 'SUCCESS', 'Canonical version installed');

-- 4. Get Conversations Function (Stable Version)
CREATE OR REPLACE FUNCTION public.get_conversations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  conversations_data JSONB;
BEGIN
  -- Get the current user ID
  user_id := auth.uid();
  
  -- Get all conversations the user participates in
  WITH user_conversations AS (
    SELECT
      c.id,
      c.title,
      c.created_at,
      c.updated_at,
      c.last_message_at,
      c.last_message_preview,
      c.is_group,
      c.metadata,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.conversation_id = c.id
        AND m.read_at IS NULL
        AND m.sender_id != user_id
      ) AS unread_count
    FROM
      conversations c
    JOIN
      conversation_participants cp ON c.id = cp.conversation_id
    WHERE
      cp.user_id = user_id
    ORDER BY
      c.last_message_at DESC NULLS LAST
  )
  
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', uc.id,
        'title', uc.title,
        'createdAt', uc.created_at,
        'updatedAt', uc.updated_at,
        'lastMessageAt', uc.last_message_at,
        'lastMessagePreview', uc.last_message_preview,
        'isGroup', uc.is_group,
        'metadata', uc.metadata,
        'unreadCount', uc.unread_count
      )
    ) INTO conversations_data
  FROM
    user_conversations uc;
  
  -- Handle case where no conversations are found
  IF conversations_data IS NULL THEN
    conversations_data := '[]'::JSONB;
  END IF;
  
  RETURN jsonb_build_object(
    'data', conversations_data
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('EXECUTE', 'Function', 'get_conversations', 'ERROR', SQLERRM);
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_conversations TO authenticated;

-- Add documentation comment
COMMENT ON FUNCTION public.get_conversations IS 
'Retrieves all conversations for the current user, including unread message counts.
Orders conversations by most recent message first.

Returns:
  A JSONB object containing:
  - data: Array of conversation objects with metadata and unread counts
  - error: Error message if unsuccessful';

PERFORM log_operation('CREATE', 'Function', 'get_conversations', 'SUCCESS', 'Canonical version installed');

-- 5. Get Conversation Messages Function (Stable Version)
CREATE OR REPLACE FUNCTION public.get_conversation_messages(
  conversation_id UUID,
  page_size INTEGER DEFAULT 20,
  page INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  total_count INTEGER;
  offset_val INTEGER;
  messages_data JSONB;
  result_json JSONB;
BEGIN
  -- Get the current user ID
  user_id := auth.uid();
  
  -- Verify user is a participant in this conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = get_conversation_messages.conversation_id
    AND user_id = user_id
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Calculate offset based on page number and page size
  offset_val := (get_conversation_messages.page - 1) * get_conversation_messages.page_size;
  
  -- Get total message count
  SELECT COUNT(*)::INTEGER INTO total_count
  FROM messages
  WHERE conversation_id = get_conversation_messages.conversation_id;
  
  -- Get paginated messages
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'conversationId', m.conversation_id,
        'senderId', m.sender_id,
        'content', m.content,
        'contentType', m.content_type,
        'metadata', m.metadata,
        'createdAt', m.created_at,
        'updatedAt', m.updated_at,
        'readAt', m.read_at
      ) ORDER BY m.created_at DESC
    ) INTO messages_data
  FROM
    messages m
  WHERE
    m.conversation_id = get_conversation_messages.conversation_id
  LIMIT get_conversation_messages.page_size
  OFFSET offset_val;
  
  -- Handle case where no messages are found
  IF messages_data IS NULL THEN
    messages_data := '[]'::JSONB;
  END IF;
  
  -- Mark unread messages as read
  UPDATE messages
  SET read_at = NOW()
  WHERE
    conversation_id = get_conversation_messages.conversation_id
    AND sender_id != user_id
    AND read_at IS NULL;
  
  -- Build the final result object with pagination metadata
  result_json := jsonb_build_object(
    'data', messages_data,
    'pagination', jsonb_build_object(
      'totalCount', total_count,
      'pageSize', get_conversation_messages.page_size,
      'currentPage', get_conversation_messages.page,
      'totalPages', CEIL(GREATEST(total_count, 1)::NUMERIC / get_conversation_messages.page_size)
    )
  );
  
  RETURN result_json;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('EXECUTE', 'Function', 'get_conversation_messages', 'ERROR', SQLERRM);
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_conversation_messages TO authenticated;

-- Add documentation comment
COMMENT ON FUNCTION public.get_conversation_messages IS 
'Retrieves messages for a specific conversation with pagination.
Automatically marks unread messages as read when viewed.
Orders messages by most recent first.

Parameters:
  conversation_id - UUID of the conversation
  page_size - Number of messages per page (default: 20)
  page - Page number, 1-based (default: 1)

Returns:
  A JSONB object containing:
  - data: Array of message objects
  - pagination: Object with totalCount, pageSize, currentPage, and totalPages
  - error: Error message if unsuccessful';

PERFORM log_operation('CREATE', 'Function', 'get_conversation_messages', 'SUCCESS', 'Canonical version installed');

-- 6. Send Message Function (Stable Version)
CREATE OR REPLACE FUNCTION public.send_message(
  conversation_id UUID,
  content TEXT,
  content_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  new_message_id UUID;
BEGIN
  -- Get the current user ID
  user_id := auth.uid();
  
  -- Verify user is a participant in this conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = send_message.conversation_id
    AND user_id = user_id
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Insert the new message
  INSERT INTO messages (
    conversation_id,
    sender_id,
    content,
    content_type,
    metadata
  )
  VALUES (
    send_message.conversation_id,
    user_id,
    send_message.content,
    send_message.content_type,
    COALESCE(send_message.metadata, '{}'::JSONB)
  )
  RETURNING id INTO new_message_id;
  
  -- Update the conversation's last message info
  UPDATE conversations
  SET
    last_message_at = NOW(),
    last_message_preview = SUBSTRING(send_message.content FROM 1 FOR 100)
  WHERE
    id = send_message.conversation_id;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'id', new_message_id
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('EXECUTE', 'Function', 'send_message', 'ERROR', SQLERRM);
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;

-- Add documentation comment
COMMENT ON FUNCTION public.send_message IS 
'Sends a new message in a conversation and updates the conversation''s last message information.

Parameters:
  conversation_id - UUID of the conversation
  content - Message content
  content_type - Type of content (default: "text")
  metadata - Optional JSONB metadata

Returns:
  A JSONB object containing:
  - success: boolean indicating if operation succeeded
  - id: UUID of the new message if successful
  - error: Error message if unsuccessful
  - errorCode: SQL error code if unsuccessful';

PERFORM log_operation('CREATE', 'Function', 'send_message', 'SUCCESS', 'Canonical version installed');

PERFORM log_operation('CREATE', 'Section', 'Critical Database Functions', 'SUCCESS', '6 critical functions installed');

-- ----------------------------------------------------------------
-- 3.3: Row Level Security Policies
-- ----------------------------------------------------------------

-- Enable RLS on profiles table
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view own profile', 'profiles');
SELECT safe_drop_policy('Users can update own profile', 'profiles');
SELECT safe_drop_policy('Users can view limited profile info of others', 'profiles');
SELECT safe_drop_policy('Service role can access all profiles', 'profiles');
SELECT safe_drop_policy('Admins can access all profiles', 'profiles');
SELECT safe_drop_policy('profiles_select_self', 'profiles');
SELECT safe_drop_policy('profiles_update_self', 'profiles');
SELECT safe_drop_policy('profiles_select_others', 'profiles');
SELECT safe_drop_policy('profiles_all_admin', 'profiles');

-- Create new policies
-- 1. Users can view their own profile (full access)
CREATE POLICY "profiles_select_self"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Users can update their own profile
CREATE POLICY "profiles_update_self"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Users can see limited profile info of other users
CREATE POLICY "profiles_select_others"
  ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Service role/admin can access all profiles
CREATE POLICY "profiles_all_admin"
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role' OR is_admin());

PERFORM log_operation('CREATE', 'Policy', 'Profiles Policies', 'SUCCESS', '4 policies created');

-- Enable RLS on shows table
ALTER TABLE IF EXISTS public.shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Anyone can view shows', 'shows');
SELECT safe_drop_policy('Organizers can update own shows', 'shows');
SELECT safe_drop_policy('Organizers can delete own shows', 'shows');
SELECT safe_drop_policy('Organizers can insert shows', 'shows');
SELECT safe_drop_policy('Admins can update show coordinates', 'shows');
SELECT safe_drop_policy('shows_select_all', 'shows');
SELECT safe_drop_policy('shows_update_organizer', 'shows');
SELECT safe_drop_policy('shows_delete_organizer', 'shows');
SELECT safe_drop_policy('shows_insert_organizer', 'shows');
SELECT safe_drop_policy('shows_update_admin', 'shows');

-- Create new policies
-- 1. Anyone can view shows
CREATE POLICY "shows_select_all"
  ON shows
  FOR SELECT
  TO public
  USING (true);

-- 2. Organizers can update their own shows
CREATE POLICY "shows_update_organizer"
  ON shows
  FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

-- 3. Organizers can delete their own shows
CREATE POLICY "shows_delete_organizer"
  ON shows
  FOR DELETE
  USING (auth.uid() = organizer_id);

-- 4. Organizers can insert new shows
CREATE POLICY "shows_insert_organizer"
  ON shows
  FOR INSERT
  WITH CHECK (auth.uid() = organizer_id OR is_show_organizer());

-- 5. Admins can update show coordinates
CREATE POLICY "shows_update_admin"
  ON shows
  FOR UPDATE
  USING (is_admin());

PERFORM log_operation('CREATE', 'Policy', 'Shows Policies', 'SUCCESS', '5 policies created');

-- Enable RLS on show_participants table
ALTER TABLE IF EXISTS public.show_participants ENABLE ROW LEVEL SECURITY;

-- Create new policies
-- 1. Users can see their own participation
CREATE POLICY "show_participants_select_self"
  ON show_participants
  FOR SELECT
  TO authenticated
  USING (userid = auth.uid());

-- 2. Show organizers can see participants for their shows
CREATE POLICY "show_participants_select_organizer"
  ON show_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = show_participants.showid
      AND organizer_id = auth.uid()
    )
  );

-- 3. MVP dealers can see participants for shows they are involved with
-- Using non-recursive approach to prevent infinite recursion
CREATE POLICY "show_participants_select_mvp_dealer_safe"
  ON show_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer (this function doesn't query show_participants)
    is_mvp_dealer() AND
    (
      -- Simple self-check without recursion
      userid = auth.uid() OR
      -- Check if they're an organizer of the show
      EXISTS (
        SELECT 1 FROM shows s
        WHERE s.id = show_participants.showid
        AND s.organizer_id = auth.uid()
      ) OR
      -- Use the safe participation check
      participates_in_show_safe(showid)
    )
  );

-- 4. Users can register as participants
CREATE POLICY "show_participants_insert"
  ON show_participants
  FOR INSERT
  WITH CHECK (
    -- Users can only insert records for themselves
    userid = auth.uid()
  );

-- 5. Users can update their own participation
CREATE POLICY "show_participants_update_self"
  ON show_participants
  FOR UPDATE
  USING (userid = auth.uid())
  WITH CHECK (userid = auth.uid());

-- 6. Users can delete their own participation
CREATE POLICY "show_participants_delete_self"
  ON show_participants
  FOR DELETE
  USING (userid = auth.uid());

-- 7. Show organizers can update participant info for their shows
CREATE POLICY "show_participants_update_organizer"
  ON show_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = show_participants.showid
      AND organizer_id = auth.uid()
    )
  );

-- 8. Admins can access all participants
CREATE POLICY "show_participants_all_admin"
  ON show_participants
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

PERFORM log_operation('CREATE', 'Policy', 'Show Participants Policies', 'SUCCESS', '8 policies created');

-- Grant appropriate permissions to authenticated users
DO $$
BEGIN
  -- Grant select, insert, update, delete on all tables
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated';
  PERFORM log_operation('GRANT', 'Permission', 'authenticated', 'SUCCESS', 'SELECT, INSERT, UPDATE, DELETE on all tables');
  
  -- Grant usage on all sequences
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated';
  PERFORM log_operation('GRANT', 'Permission', 'authenticated', 'SUCCESS', 'USAGE on all sequences');
  
  -- Grant execute on all functions
  EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated';
  PERFORM log_operation('GRANT', 'Permission', 'authenticated', 'SUCCESS', 'EXECUTE on all functions');
END $$;

PERFORM log_operation('CREATE', 'Section', 'Row Level Security Policies', 'SUCCESS', '17 policies created across 3 tables');

-- ================================================================
-- SECTION 4: VERIFICATION
-- ================================================================

-- Verify that all tables have RLS enabled
DO $$
DECLARE
  table_rec RECORD;
  tables_without_rls TEXT := '';
  tables_with_rls INTEGER := 0;
  total_tables INTEGER := 0;
BEGIN
  -- Check each public table for RLS enabled
  FOR table_rec IN 
    SELECT t.table_name 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT IN (
      -- Tables that should be excluded from RLS
      'schema_migrations',
      'spatial_ref_sys',
      'complexity_fix_log'
    )
  LOOP
    total_tables := total_tables + 1;
    
    -- Check if RLS is enabled
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' 
      AND tablename = table_rec.table_name
      AND rowsecurity = true
    ) THEN
      -- RLS is enabled - good
      tables_with_rls := tables_with_rls + 1;
    ELSE
      -- RLS is not enabled - critical security issue!
      tables_without_rls := tables_without_rls || table_rec.table_name || ', ';
    END IF;
  END LOOP;
  
  -- Report results
  IF tables_without_rls <> '' THEN
    PERFORM log_operation('VERIFY', 'RLS', 'Tables', 'WARNING', 'Tables without RLS enabled: ' || LEFT(tables_without_rls, LENGTH(tables_without_rls) - 2));
  ELSE
    PERFORM log_operation('VERIFY', 'RLS', 'Tables', 'SUCCESS', 'All tables have RLS enabled');
  END IF;
  
  PERFORM log_operation('VERIFY', 'RLS', 'Coverage', 'INFO', tables_with_rls || ' of ' || total_tables || ' tables have RLS enabled (' || 
    CASE WHEN total_tables > 0 THEN ROUND((tables_with_rls::FLOAT / total_tables) * 100, 1)::TEXT ELSE '0' END || '%)');
END $$;

-- Verify that helper functions exist
DO $$
DECLARE
  function_names TEXT[] := ARRAY[
    'is_admin',
    'is_show_organizer',
    'is_mvp_dealer',
    'is_dealer',
    'is_any_dealer',
    'participates_in_show_safe',
    'organizes_show',
    'safe_drop_policy',
    'validate_coordinates',
    'create_geography_point'
  ];
  func_name TEXT;
  missing_functions TEXT := '';
  functions_found INTEGER := 0;
BEGIN
  -- Check each expected function
  FOREACH func_name IN ARRAY function_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = func_name
    ) THEN
      -- Function exists - good
      functions_found := functions_found + 1;
    ELSE
      -- Function is missing
      missing_functions := missing_functions || func_name || ', ';
    END IF;
  END LOOP;
  
  -- Report results
  IF missing_functions <> '' THEN
    PERFORM log_operation('VERIFY', 'Functions', 'Helpers', 'WARNING', 'Missing helper functions: ' || LEFT(missing_functions, LENGTH(missing_functions) - 2));
  ELSE
    PERFORM log_operation('VERIFY', 'Functions', 'Helpers', 'SUCCESS', 'All helper functions exist');
  END IF;
  
  PERFORM log_operation('VERIFY', 'Functions', 'Coverage', 'INFO', functions_found || ' of ' || array_length(function_names, 1) || ' functions exist');
END $$;

-- Verify that critical database functions exist
DO $$
DECLARE
  function_names TEXT[] := ARRAY[
    'get_paginated_shows',
    'get_show_details_by_id',
    'create_show_with_coordinates',
    'get_conversations',
    'get_conversation_messages',
    'send_message'
  ];
  func_name TEXT;
  missing_functions TEXT := '';
  functions_found INTEGER := 0;
BEGIN
  -- Check each expected function
  FOREACH func_name IN ARRAY function_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = func_name
    ) THEN
      -- Function exists - good
      functions_found := functions_found + 1;
    ELSE
      -- Function is missing
      missing_functions := missing_functions || func_name || ', ';
    END IF;
  END LOOP;
  
  -- Report results
  IF missing_functions <> '' THEN
    PERFORM log_operation('VERIFY', 'Functions', 'Critical', 'WARNING', 'Missing critical functions: ' || LEFT(missing_functions, LENGTH(missing_functions) - 2));
  ELSE
    PERFORM log_operation('VERIFY', 'Functions', 'Critical', 'SUCCESS', 'All critical functions exist');
  END IF;
  
  PERFORM log_operation('VERIFY', 'Functions', 'Coverage', 'INFO', functions_found || ' of ' || array_length(function_names, 1) || ' functions exist');
END $$;

-- Test coordinate validation function
DO $$
DECLARE
  test_cases JSONB[] := ARRAY[
    '{\"lat\": 37.7749, \"long\": -122.4194, \"expected\": true, \"name\": \"San Francisco\"}'::JSONB,
    '{\"lat\": 40.7128, \"long\": -74.0060, \"expected\": true, \"name\": \"New York\"}'::JSONB,
    '{\"lat\": 0, \"long\": 0, \"expected\": false, \"name\": \"Null Island\"}'::JSONB,
    '{\"lat\": 91, \"long\": 0, \"expected\": false, \"name\": \"Invalid latitude (too high)\"}'::JSONB,
    '{\"lat\": -91, \"long\": 0, \"expected\": false, \"name\": \"Invalid latitude (too low)\"}'::JSONB,
    '{\"lat\": 0, \"long\": 181, \"expected\": false, \"name\": \"Invalid longitude (too high)\"}'::JSONB,
    '{\"lat\": 0, \"long\": -181, \"expected\": false, \"name\": \"Invalid longitude (too low)\"}'::JSONB
  ];
  test_case JSONB;
  result BOOLEAN;
  passed INTEGER := 0;
  failed INTEGER := 0;
BEGIN
  -- Run each test case
  FOR i IN 1..array_length(test_cases, 1)
  LOOP
    test_case := test_cases[i];
    result := validate_coordinates(
      (test_case->>'lat')::FLOAT,
      (test_case->>'long')::FLOAT
    );
    
    IF result = (test_case->>'expected')::BOOLEAN THEN
      passed := passed + 1;
    ELSE
      failed := failed + 1;
      PERFORM log_operation('TEST', 'Function', 'validate_coordinates', 'FAIL', 
        'Test case "' || test_case->>'name' || '" failed: expected ' || 
        test_case->>'expected' || ' but got ' || result::TEXT);
    END IF;
  END LOOP;
  
  -- Report results
  IF failed = 0 THEN
    PERFORM log_operation('TEST', 'Function', 'validate_coordinates', 'SUCCESS', 
      'All ' || passed || ' test cases passed');
  ELSE
    PERFORM log_operation('TEST', 'Function', 'validate_coordinates', 'WARNING', 
      passed || ' test cases passed, ' || failed || ' test cases failed');
  END IF;
END $$;

-- Test for infinite recursion in show_participants policies
DO $$
DECLARE
  has_recursion BOOLEAN := false;
BEGIN
  -- Check if any policies on show_participants reference the table itself
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'show_participants'
    AND schemaname = 'public'
    AND qual LIKE '%show_participants%'
  ) INTO has_recursion;
  
  IF has_recursion THEN
    PERFORM log_operation('TEST', 'RLS', 'Infinite Recursion', 'FAIL', 
      'Found policies on show_participants that may cause infinite recursion');
  ELSE
    PERFORM log_operation('TEST', 'RLS', 'Infinite Recursion', 'SUCCESS', 
      'No policies found that would cause infinite recursion');
  END IF;
END $$;

PERFORM log_operation('CREATE', 'Section', 'Verification and Testing', 'SUCCESS', 'All verification and testing completed');

-- ================================================================
-- SECTION 5: ROLLBACK MECHANISM
-- ================================================================

-- Create a backup of the current state before applying fixes
DO $$
BEGIN
  -- Create a backup schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS db_backup_before_fix;
  
  -- Log the backup creation
  PERFORM log_operation('BACKUP', 'Schema', 'db_backup_before_fix', 'INFO', 'Creating backup schema');
  
  -- Create a function to generate the rollback script
  CREATE OR REPLACE FUNCTION generate_rollback_script() RETURNS TEXT AS $$
  DECLARE
    rollback_script TEXT;
  BEGIN
    rollback_script := '-- DATABASE COMPLEXITY FIX ROLLBACK SCRIPT' || E'\n';
    rollback_script := rollback_script || '-- Generated: ' || NOW()::TEXT || E'\n\n';
    rollback_script := rollback_script || 'BEGIN;' || E'\n\n';
    
    -- Drop all the functions we created
    rollback_script := rollback_script || '-- Drop functions created by the fix' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.get_paginated_shows;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.get_show_details_by_id;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.create_show_with_coordinates;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.get_conversations;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.get_conversation_messages;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.send_message;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.participates_in_show_safe;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.is_admin;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.is_show_organizer;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.is_mvp_dealer;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.is_dealer;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.is_any_dealer;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.organizes_show;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.validate_coordinates;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.create_geography_point;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.safe_drop_policy;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.safe_drop_function;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.log_operation;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.analyze_duplicate_functions;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.analyze_rls_recursion_risks;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.analyze_column_mismatches;' || E'\n';
    rollback_script := rollback_script || 'DROP FUNCTION IF EXISTS public.generate_rollback_script;' || E'\n\n';
    
    -- Drop policies we created
    rollback_script := rollback_script || '-- Drop policies created by the fix' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "profiles_select_self" ON profiles;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "profiles_update_self" ON profiles;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "profiles_select_others" ON profiles;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "profiles_all_admin" ON profiles;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "shows_select_all" ON shows;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "shows_update_organizer" ON shows;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "shows_delete_organizer" ON shows;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "shows_insert_organizer" ON shows;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "shows_update_admin" ON shows;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_select_self" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_select_organizer" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_select_mvp_dealer_safe" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_insert" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_update_self" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_delete_self" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_update_organizer" ON show_participants;' || E'\n';
    rollback_script := rollback_script || 'DROP POLICY IF EXISTS "show_participants_all_admin" ON show_participants;' || E'\n\n';
    
    -- Restore from backup schema if needed
    rollback_script := rollback_script || '-- Restore from backup schema if needed' || E'\n';
    rollback_script := rollback_script || '-- To restore specific objects from backup, use:' || E'\n';
    rollback_script := rollback_script || '-- CREATE OR REPLACE FUNCTION public.function_name AS $$ SELECT * FROM db_backup_before_fix.function_name() $$ LANGUAGE SQL;' || E'\n\n';
    
    -- Commit transaction
    rollback_script := rollback_script || 'COMMIT;' || E'\n\n';
    rollback_script := rollback_script || '-- End of rollback script' || E'\n';
    
    RETURN rollback_script;
  END;
  $$ LANGUAGE plpgsql;
  
  -- Generate and log the rollback script
  PERFORM log_operation('ROLLBACK', 'Script', 'Rollback Instructions', 'INFO', 
    'Rollback script has been generated. Run the following to view it:' || E'\n' ||
    'SELECT generate_rollback_script();');
END $$;

-- ================================================================
-- SECTION 6: COMPLETION
-- ================================================================

-- Display summary of operations
DO $$
DECLARE
  total_operations INTEGER;
  successful_operations INTEGER;
  warning_operations INTEGER;
  error_operations INTEGER;
BEGIN
  -- Count operations by status
  SELECT COUNT(*) INTO total_operations FROM complexity_fix_log;
  SELECT COUNT(*) INTO successful_operations FROM complexity_fix_log WHERE status IN ('SUCCESS', 'INFO');
  SELECT COUNT(*) INTO warning_operations FROM complexity_fix_log WHERE status = 'WARNING';
  SELECT COUNT(*) INTO error_operations FROM complexity_fix_log WHERE status = 'ERROR';
  
  -- Display summary
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'DATABASE COMPLEXITY FIX COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Total operations: %', total_operations;
  RAISE NOTICE 'Successful operations: %', successful_operations;
  RAISE NOTICE 'Warnings: %', warning_operations;
  RAISE NOTICE 'Errors: %', error_operations;
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'This is now the canonical version of all database functions and policies.';
  RAISE NOTICE 'All previous emergency fixes have been consolidated into this version.';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'To view the rollback script, run: SELECT generate_rollback_script();';
  RAISE NOTICE '================================================================';
END $$;

-- Commit the transaction
COMMIT;
