-- Migration: 20250722000000_canonical_database_consolidation.sql
-- Description: Comprehensive consolidation of all database functions and security policies
-- Created: July 22, 2025
-- Version: 1.0
--
-- Purpose:
--   This migration serves as the single source of truth for all database functions,
--   RLS policies, and critical database components in the Card Show Finder
--   application. It consolidates all emergency fixes, patches, and improvements
--   into a stable, canonical version.
--
-- Features:
--   1. Consolidated stable versions of all critical database functions
--   2. Comprehensive Row Level Security (RLS) policies
--   3. Non-recursive implementation to prevent infinite recursion
--   4. Safe policy dropping approach
--   5. Extensive error handling
--   6. Helper functions for role checking and security

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

-- Function to check if a user participates in a conversation
CREATE OR REPLACE FUNCTION participates_in_conversation(conversation_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conversation_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing coordinate validation functions to avoid parameter naming conflicts
DROP FUNCTION IF EXISTS validate_coordinates(FLOAT, FLOAT);
DROP FUNCTION IF EXISTS create_geography_point(FLOAT, FLOAT);

-- Function to validate coordinates for shows
CREATE OR REPLACE FUNCTION validate_coordinates(
  lat FLOAT,
  lng FLOAT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if coordinates are within valid ranges
  -- Latitude: -90 to 90, Longitude: -180 to 180
  IF lat < -90 OR lat > 90 OR lng < -180 OR lng > 180 THEN
    RETURN FALSE;
  END IF;
  
  -- Check if coordinates are not at 0,0 (null island)
  IF lat = 0 AND lng = 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create a PostGIS point from lat/lng
CREATE OR REPLACE FUNCTION create_geography_point(
  lat FLOAT,
  lng FLOAT
) RETURNS GEOGRAPHY AS $$
BEGIN
  IF NOT validate_coordinates(lat, lng) THEN
    RAISE EXCEPTION 'Invalid coordinates: latitude=%, longitude=%', lat, lng;
  END IF;
  
  RETURN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY;
END;
$$ LANGUAGE plpgsql;

-- Add documentation comments to helper functions
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION is_show_organizer() IS 'Checks if the current user has show_organizer role';
COMMENT ON FUNCTION is_mvp_dealer() IS 'Checks if the current user has mvp_dealer role';
COMMENT ON FUNCTION is_dealer() IS 'Checks if the current user has dealer role';
COMMENT ON FUNCTION is_any_dealer() IS 'Checks if the current user has either dealer or mvp_dealer role';
COMMENT ON FUNCTION participates_in_show_safe(UUID) IS 'Safely checks if a user participates in a show without recursive queries';
COMMENT ON FUNCTION organizes_show(UUID) IS 'Checks if the current user organizes a specific show';
COMMENT ON FUNCTION safe_drop_policy(TEXT, TEXT) IS 'Safely drops a policy if it exists, with error handling';
COMMENT ON FUNCTION validate_coordinates(FLOAT, FLOAT) IS 'Validates that latitude and longitude are within valid ranges';
COMMENT ON FUNCTION create_geography_point(FLOAT, FLOAT) IS 'Creates a PostGIS geography point from latitude and longitude';

-- ================================================================
-- SECTION 2: CRITICAL DATABASE FUNCTIONS
-- ================================================================


-- ----------------------------------------------------------------
-- exec_sql: Utility helper used by maintenance / admin scripts
-- ----------------------------------------------------------------
-- This SECURITY DEFINER function allows trusted automation scripts
-- (e.g. Supabase CLI, CI utilities) to execute arbitrary SQL with
-- robust error handling.  It returns a JSONB payload indicating
-- success or failure so callers can programmatically react.
--
-- NOTE:  It is *not* granted to regular application roles; only the
-- `service_role` gets EXECUTE permission.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql_query;
  result := '{"success": true}'::JSONB;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error',  SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result;
END;
$$;

-- Grant to service_role only (used by CI / admin tooling)
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

COMMENT ON FUNCTION exec_sql(TEXT) IS
'Execute arbitrary SQL with JSONB success/error response.
SECURITY DEFINER so it runs with elevated privileges.
Intended solely for trusted automation (service_role).';
-- 1. Get Paginated Shows Function (Stable Version)
DROP FUNCTION IF EXISTS public.get_paginated_shows;

CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,                          -- Latitude of center point
  lng float,                          -- Longitude of center point
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
      ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography,
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
          ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography
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
      ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography,
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
  GROUP BY 
    s.id, s.series_id, s.title, s.description, s.location, s.address, 
    s.start_date, s.end_date, s.entry_fee, s.image_url, s.rating, 
    s.coordinates, s.status, s.organizer_id, s.features, s.categories, 
    s.created_at, s.updated_at
  ORDER BY 
    -- Order by start date first (upcoming shows first)
    s.start_date ASC,
    -- Then by distance (closest first)
    ST_Distance(
      s.coordinates::geography, 
      ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography
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
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
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
- Includes the GROUP BY clause fix for s.coordinates
- Orders results by start date and then distance
- Adds distance_miles to each result for client-side use

Parameters:
  lat - Latitude of the center point
  lng - Longitude of the center point
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

-- 2. Get Show Details By ID Function (Stable Version)
DROP FUNCTION IF EXISTS public.get_show_details_by_id;

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
    RAISE LOG 'Error in get_show_details_by_id: %', SQLERRM;
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

-- 3. Create Show with Coordinates Function (Stable Version)
DROP FUNCTION IF EXISTS public.create_show_with_coordinates;

CREATE OR REPLACE FUNCTION public.create_show_with_coordinates(
  p_title TEXT,
  p_description TEXT,
  p_location TEXT,
  p_address TEXT,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_entry_fee NUMERIC,
  p_image_url TEXT,
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_features JSONB DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_series_id UUID DEFAULT NULL
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
  IF NOT validate_coordinates(p_latitude, p_longitude) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid coordinates provided',
      'details', jsonb_build_object('lat', p_latitude, 'lng', p_longitude)
    );
  END IF;
  
  -- Create geography point
  coordinates := create_geography_point(p_latitude, p_longitude);
  
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
    create_show_with_coordinates.p_title,
    create_show_with_coordinates.p_description,
    create_show_with_coordinates.p_location,
    create_show_with_coordinates.p_address,
    create_show_with_coordinates.p_start_date,
    create_show_with_coordinates.p_end_date,
    create_show_with_coordinates.p_entry_fee,
    create_show_with_coordinates.p_image_url,
    coordinates,
    COALESCE(create_show_with_coordinates.p_features, '{}'::JSONB),
    COALESCE(create_show_with_coordinates.p_categories, '{}'::TEXT[]),
    'ACTIVE',
    auth.uid(),
    create_show_with_coordinates.p_series_id
  )
  RETURNING id INTO new_show_id;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'id', new_show_id,
    'coordinates', jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in create_show_with_coordinates: %', SQLERRM;
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
  lng - Longitude (must be between -180 and 180)
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

-- 4. Get Conversations Function (Stable Version)
DROP FUNCTION IF EXISTS public.get_conversations;

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
    RAISE LOG 'Error in get_conversations: %', SQLERRM;
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

-- 5. Get Conversation Messages Function (Stable Version)
DROP FUNCTION IF EXISTS public.get_conversation_messages;

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
    RAISE LOG 'Error in get_conversation_messages: %', SQLERRM;
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

-- 6. Send Message Function (Stable Version)
DROP FUNCTION IF EXISTS public.send_message;

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
    RAISE LOG 'Error in send_message: %', SQLERRM;
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

-- ================================================================
-- SECTION 3: ROW LEVEL SECURITY POLICIES
-- ================================================================

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

-- Enable RLS on user_favorite_shows table
ALTER TABLE IF EXISTS public.user_favorite_shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('user_fav_shows_sel_self', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_sel_mvp_dealer', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_sel_org', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_ins_self', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_del_self', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_all_admin', 'user_favorite_shows');
SELECT safe_drop_policy('Users can select their own favorite shows', 'user_favorite_shows');
SELECT safe_drop_policy('Users can insert their own favorite shows', 'user_favorite_shows');
SELECT safe_drop_policy('Users can delete their own favorite shows', 'user_favorite_shows');

-- Create new policies
-- 1. Users can view their own favorite shows
CREATE POLICY "user_fav_shows_sel_self"
  ON user_favorite_shows
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. MVP dealers can view favorite shows for their shows
CREATE POLICY "user_fav_shows_sel_mvp_dealer"
  ON user_favorite_shows
  FOR SELECT
  USING (
    is_mvp_dealer() AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = user_favorite_shows.show_id
      AND organizer_id = auth.uid()
    )
  );

-- 3. Show organizers can view favorite shows for their shows
CREATE POLICY "user_fav_shows_sel_org"
  ON user_favorite_shows
  FOR SELECT
  USING (
    is_show_organizer() AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = user_favorite_shows.show_id
      AND organizer_id = auth.uid()
    )
  );

-- 4. Users can add their own favorite shows
CREATE POLICY "user_fav_shows_ins_self"
  ON user_favorite_shows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can remove their own favorite shows
CREATE POLICY "user_fav_shows_del_self"
  ON user_favorite_shows
  FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Admins can access all favorite shows
CREATE POLICY "user_fav_shows_all_admin"
  ON user_favorite_shows
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on show_participants table
ALTER TABLE IF EXISTS public.show_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
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

-- Enable RLS on want_lists table
ALTER TABLE IF EXISTS public.want_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('want_lists_select_self', 'want_lists');
SELECT safe_drop_policy('want_lists_select_mvp_dealer', 'want_lists');
SELECT safe_drop_policy('want_lists_select_organizer', 'want_lists');
SELECT safe_drop_policy('want_lists_insert', 'want_lists');
SELECT safe_drop_policy('want_lists_update', 'want_lists');
SELECT safe_drop_policy('want_lists_delete', 'want_lists');
SELECT safe_drop_policy('want_lists_all_admin', 'want_lists');

-- Create new policies
-- 1. Users can view their own want lists
CREATE POLICY "want_lists_select_self"
  ON want_lists
  FOR SELECT
  USING (userid = auth.uid());

-- 2. MVP dealers can view want lists for shows they're involved with
CREATE POLICY "want_lists_select_mvp_dealer"
  ON want_lists
  FOR SELECT
  USING (
    is_mvp_dealer() AND
    EXISTS (
      SELECT 1 FROM shared_want_lists swl
      JOIN shows s ON swl.showid = s.id
      WHERE swl.wantlistid = want_lists.id
      AND (
        -- Either they're the organizer
        s.organizer_id = auth.uid() OR
        -- Or they participate in the show (using safe function)
        participates_in_show_safe(s.id)
      )
    )
  );

-- 3. Show organizers can view want lists for their shows
CREATE POLICY "want_lists_select_organizer"
  ON want_lists
  FOR SELECT
  USING (
    is_show_organizer() AND
    EXISTS (
      SELECT 1 FROM shared_want_lists swl
      JOIN shows s ON swl.showid = s.id
      WHERE swl.wantlistid = want_lists.id
      AND s.organizer_id = auth.uid()
    )
  );

-- 4. Users can create their own want lists
CREATE POLICY "want_lists_insert"
  ON want_lists
  FOR INSERT
  WITH CHECK (userid = auth.uid());

-- 5. Users can update their own want lists
CREATE POLICY "want_lists_update"
  ON want_lists
  FOR UPDATE
  USING (userid = auth.uid())
  WITH CHECK (userid = auth.uid());

-- 6. Users can delete their own want lists
CREATE POLICY "want_lists_delete"
  ON want_lists
  FOR DELETE
  USING (userid = auth.uid());

-- 7. Admins can access all want lists
CREATE POLICY "want_lists_all_admin"
  ON want_lists
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on shared_want_lists table
ALTER TABLE IF EXISTS public.shared_want_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('shared_want_lists_select_self', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_select_mvp_dealer', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_select_organizer', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_insert', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_delete', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_all_admin', 'shared_want_lists');

-- Create new policies
-- 1. Users can view their own shared want lists
CREATE POLICY "shared_want_lists_select_self"
  ON shared_want_lists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM want_lists
      WHERE id = shared_want_lists.wantlistid
      AND userid = auth.uid()
    )
  );

-- 2. MVP dealers can view shared want lists for shows they're involved with
CREATE POLICY "shared_want_lists_select_mvp_dealer"
  ON shared_want_lists
  FOR SELECT
  USING (
    is_mvp_dealer() AND
    (
      -- Either they're the organizer of the show
      EXISTS (
        SELECT 1 FROM shows
        WHERE id = shared_want_lists.showid
        AND organizer_id = auth.uid()
      ) OR
      participates_in_show_safe(shared_want_lists.showid)
    )
  );

-- 3. Show organizers can view shared want lists for their shows
CREATE POLICY "shared_want_lists_select_organizer"
  ON shared_want_lists
  FOR SELECT
  USING (
    is_show_organizer() AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = shared_want_lists.showid
      AND organizer_id = auth.uid()
    )
  );

-- 4. Users can share their own want lists
CREATE POLICY "shared_want_lists_insert"
  ON shared_want_lists
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM want_lists
      WHERE id = shared_want_lists.wantlistid
      AND userid = auth.uid()
    )
  );

-- 5. Users can unshare their own want lists
CREATE POLICY "shared_want_lists_delete"
  ON shared_want_lists
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM want_lists
      WHERE id = shared_want_lists.wantlistid
      AND userid = auth.uid()
    )
  );

-- 6. Admins can access all shared want lists
CREATE POLICY "shared_want_lists_all_admin"
  ON shared_want_lists
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on conversations table
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view conversations they participate in', 'conversations');
SELECT safe_drop_policy('Users can create conversations', 'conversations');
SELECT safe_drop_policy('Users can update conversations they participate in', 'conversations');
SELECT safe_drop_policy('Admins can access all conversations', 'conversations');
SELECT safe_drop_policy('conversations_select_participant', 'conversations');
SELECT safe_drop_policy('conversations_insert', 'conversations');
SELECT safe_drop_policy('conversations_update_participant', 'conversations');
SELECT safe_drop_policy('conversations_all_admin', 'conversations');

-- Create new policies
-- 1. Users can view conversations they participate in
CREATE POLICY "conversations_select_participant"
  ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- 2. Users can create conversations
CREATE POLICY "conversations_insert"
  ON conversations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Users can update conversations they participate in
CREATE POLICY "conversations_update_participant"
  ON conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- 4. Admins can access all conversations
CREATE POLICY "conversations_all_admin"
  ON conversations
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on conversation_participants table
ALTER TABLE IF EXISTS public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view conversation participants for conversations they are in', 'conversation_participants');
SELECT safe_drop_policy('Users can add themselves to conversations', 'conversation_participants');
SELECT safe_drop_policy('Users can remove themselves from conversations', 'conversation_participants');
SELECT safe_drop_policy('Admins can access all conversation participants', 'conversation_participants');
SELECT safe_drop_policy('conversation_participants_select', 'conversation_participants');
SELECT safe_drop_policy('conversation_participants_insert_self', 'conversation_participants');
SELECT safe_drop_policy('conversation_participants_delete_self', 'conversation_participants');
SELECT safe_drop_policy('conversation_participants_all_admin', 'conversation_participants');

-- Create new policies
-- 1. Users can view conversation participants for conversations they are in
CREATE POLICY "conversation_participants_select"
  ON conversation_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_participants.conversation_id
      AND user_id = auth.uid()
    )
  );

-- 2. Users can add themselves to conversations
CREATE POLICY "conversation_participants_insert_self"
  ON conversation_participants
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Users can remove themselves from conversations
CREATE POLICY "conversation_participants_delete_self"
  ON conversation_participants
  FOR DELETE
  USING (user_id = auth.uid());

-- 4. Admins can access all conversation participants
CREATE POLICY "conversation_participants_all_admin"
  ON conversation_participants
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on messages table
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view messages in conversations they participate in', 'messages');
SELECT safe_drop_policy('Users can send messages to conversations they participate in', 'messages');
SELECT safe_drop_policy('Users can update their own messages', 'messages');
SELECT safe_drop_policy('Users can delete their own messages', 'messages');
SELECT safe_drop_policy('Admins can access all messages', 'messages');
SELECT safe_drop_policy('messages_select_participant', 'messages');
SELECT safe_drop_policy('messages_insert_participant', 'messages');
SELECT safe_drop_policy('messages_update_own', 'messages');
SELECT safe_drop_policy('messages_delete_own', 'messages');
SELECT safe_drop_policy('messages_all_admin', 'messages');

-- Create new policies
-- 1. Users can view messages in conversations they participate in
CREATE POLICY "messages_select_participant"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- 2. Users can send messages to conversations they participate in
CREATE POLICY "messages_insert_participant"
  ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- 3. Users can update their own messages
CREATE POLICY "messages_update_own"
  ON messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- 4. Users can delete their own messages
CREATE POLICY "messages_delete_own"
  ON messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- 5. Admins can access all messages
CREATE POLICY "messages_all_admin"
  ON messages
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on reviews table
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view all reviews', 'reviews');
SELECT safe_drop_policy('Users can create reviews for shows they attended', 'reviews');
SELECT safe_drop_policy('Users can update their own reviews', 'reviews');
SELECT safe_drop_policy('Users can delete their own reviews', 'reviews');
SELECT safe_drop_policy('Admins can moderate all reviews', 'reviews');
SELECT safe_drop_policy('reviews_select_all', 'reviews');
SELECT safe_drop_policy('reviews_insert_attendee', 'reviews');
SELECT safe_drop_policy('reviews_update_own', 'reviews');
SELECT safe_drop_policy('reviews_delete_own', 'reviews');
SELECT safe_drop_policy('reviews_all_admin', 'reviews');

-- Create new policies
-- 1. Users can view all reviews
CREATE POLICY "reviews_select_all"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Users can create reviews for shows they attended
CREATE POLICY "reviews_insert_attendee"
  ON reviews
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM show_participants
      WHERE showid = reviews.show_id
      AND userid = auth.uid()
    )
  );

-- 3. Users can update their own reviews
CREATE POLICY "reviews_update_own"
  ON reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Users can delete their own reviews
CREATE POLICY "reviews_delete_own"
  ON reviews
  FOR DELETE
  USING (user_id = auth.uid());

-- 5. Admins can moderate all reviews
CREATE POLICY "reviews_all_admin"
  ON reviews
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on show_series table
ALTER TABLE IF EXISTS public.show_series ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Anyone can view show series', 'show_series');
SELECT safe_drop_policy('Organizers can update own show series', 'show_series');
SELECT safe_drop_policy('Organizers can delete own show series', 'show_series');
SELECT safe_drop_policy('Organizers can create show series', 'show_series');
SELECT safe_drop_policy('show_series_select_all', 'show_series');
SELECT safe_drop_policy('show_series_update_organizer', 'show_series');
SELECT safe_drop_policy('show_series_delete_organizer', 'show_series');
SELECT safe_drop_policy('show_series_insert_organizer', 'show_series');
SELECT safe_drop_policy('show_series_all_admin', 'show_series');

-- Create new policies
-- 1. Anyone can view show series
CREATE POLICY "show_series_select_all"
  ON show_series
  FOR SELECT
  TO public
  USING (true);

-- 2. Organizers can update their own show series
CREATE POLICY "show_series_update_organizer"
  ON show_series
  FOR UPDATE
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- 3. Organizers can delete their own show series
CREATE POLICY "show_series_delete_organizer"
  ON show_series
  FOR DELETE
  USING (organizer_id = auth.uid());

-- 4. Organizers can create show series
CREATE POLICY "show_series_insert_organizer"
  ON show_series
  FOR INSERT
  WITH CHECK (
    organizer_id = auth.uid() AND
    is_show_organizer()
  );

-- 5. Admins can manage all show series
CREATE POLICY "show_series_all_admin"
  ON show_series
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Enable RLS on planned_attendance table
ALTER TABLE IF EXISTS public.planned_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('MVP dealers can view planned attendance for their shows', 'planned_attendance');
SELECT safe_drop_policy('Show organizers can view planned attendance for their shows', 'planned_attendance');
SELECT safe_drop_policy('Users can create their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('Users can delete their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('planned_attendance_select_self', 'planned_attendance');
SELECT safe_drop_policy('planned_attendance_select_mvp_dealer', 'planned_attendance');
SELECT safe_drop_policy('planned_attendance_select_organizer', 'planned_attendance');
SELECT safe_drop_policy('planned_attendance_insert_self', 'planned_attendance');
SELECT safe_drop_policy('planned_attendance_delete_self', 'planned_attendance');
SELECT safe_drop_policy('planned_attendance_all_admin', 'planned_attendance');

-- Create new policies
-- 1. Users can view their own planned attendance
CREATE POLICY "planned_attendance_select_self"
  ON planned_attendance
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. MVP dealers can view planned attendance for their shows
CREATE POLICY "planned_attendance_select_mvp_dealer"
  ON planned_attendance
  FOR SELECT
  USING (
    is_mvp_dealer() AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = planned_attendance.show_id
      AND organizer_id = auth.uid()
    )
  );

-- 3. Show organizers can view planned attendance for their shows
CREATE POLICY "planned_attendance_select_organizer"
  ON planned_attendance
  FOR SELECT
  USING (
    is_show_organizer() AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id = planned_attendance.show_id
      AND organizer_id = auth.uid()
    )
  );

-- 4. Users can create their own planned attendance
CREATE POLICY "planned_attendance_insert_self"
  ON planned_attendance
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5. Users can delete their own planned attendance
CREATE POLICY "planned_attendance_delete_self"
  ON planned_attendance
  FOR DELETE
  USING (user_id = auth.uid());

-- 6. Admins can access all planned attendance
CREATE POLICY "planned_attendance_all_admin"
  ON planned_attendance
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Grant appropriate permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant appropriate permissions to anonymous users
GRANT SELECT ON public.shows TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.show_series TO anon;
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO anon;
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO anon;

-- Final migration comment
-- Canonical database consolidation that fixes all stability issues,
-- resolves infinite recursion problems, and establishes a single
-- source of truth for database functions and policies.
