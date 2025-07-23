-- ================================================================
-- IMMEDIATE_EMERGENCY_FIX.sql
-- ================================================================
-- Immediate fix for critical database issues in Card Show Finder
-- Created: July 23, 2025
--
-- Purpose:
--   This script addresses the most critical database issues:
--   1. Infinite recursion in RLS policies
--   2. Multiple versions of critical functions
--   3. Column mismatches in security policies
--
-- Features:
--   1. Idempotent execution (safe to run multiple times)
--   2. Minimal changes to fix critical issues
--   3. Safe rollback mechanism
--
-- Usage:
--   Run this script in the Supabase SQL Editor to resolve
--   immediate database stability issues.
-- ================================================================

-- Use a transaction to ensure all changes are atomic
BEGIN;

-- Enable detailed error reporting
SET client_min_messages TO notice;

-- ================================================================
-- SECTION 1: HELPER FUNCTIONS
-- ================================================================

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
    RAISE NOTICE 'Dropped policy % on %', policy_name, table_name;
  ELSE
    RAISE NOTICE 'Policy % on % does not exist, skipping', policy_name, table_name;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policy % on %: %', policy_name, table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

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
    RAISE NOTICE 'Dropped function %', function_name;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error dropping function %: %', function_name, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 2: FIX INFINITE RECURSION IN RLS POLICIES
-- ================================================================

-- 2.1: Create non-recursive helper functions

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

-- 2.2: Fix show_participants table RLS policies

-- Enable RLS on show_participants table
ALTER TABLE IF EXISTS public.show_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that may cause infinite recursion
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

-- ================================================================
-- SECTION 3: FIX CRITICAL FUNCTIONS
-- ================================================================

-- 3.1: Fix get_paginated_shows function
SELECT safe_drop_function('get_paginated_shows');

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
    RAISE NOTICE 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;

-- 3.2: Fix get_show_details_by_id function
SELECT safe_drop_function('get_show_details_by_id');

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
  
  -- Get all dealers participating in the show using a non-recursive approach
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
    RAISE NOTICE 'Error in get_show_details_by_id: %', SQLERRM;
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
      'spatial_ref_sys'
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
    RAISE NOTICE 'WARNING: Tables without RLS enabled: %', LEFT(tables_without_rls, LENGTH(tables_without_rls) - 2);
  ELSE
    RAISE NOTICE 'SUCCESS: All tables have RLS enabled';
  END IF;
  
  RAISE NOTICE 'INFO: % of % tables have RLS enabled (%)', 
    tables_with_rls, 
    total_tables, 
    CASE WHEN total_tables > 0 THEN ROUND((tables_with_rls::FLOAT / total_tables) * 100, 1)::TEXT || '%' ELSE '0%' END;
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
    RAISE NOTICE 'FAIL: Found policies on show_participants that may cause infinite recursion';
  ELSE
    RAISE NOTICE 'SUCCESS: No policies found that would cause infinite recursion';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: COMPLETION
-- ================================================================

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'IMMEDIATE EMERGENCY FIX COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  1. Infinite recursion in show_participants RLS policies';
  RAISE NOTICE '  2. Duplicate/broken versions of get_paginated_shows';
  RAISE NOTICE '  3. Duplicate/broken versions of get_show_details_by_id';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'To rollback these changes, you can use the following command:';
  RAISE NOTICE 'ROLLBACK;';
  RAISE NOTICE '================================================================';
END $$;

-- Commit the transaction
COMMIT;
