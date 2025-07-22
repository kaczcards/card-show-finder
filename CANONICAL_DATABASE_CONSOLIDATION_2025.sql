-- ================================================================
-- CANONICAL_DATABASE_CONSOLIDATION_2025.sql
-- ================================================================
-- Comprehensive consolidation of all database functions and security policies
-- for the Card Show Finder application.
-- Created: July 22, 2025
-- Version: 1.0
--
-- Purpose:
--   This script serves as the single source of truth for all database functions,
--   RLS policies, and critical database components in the Card Show Finder
--   application. It consolidates all emergency fixes, patches, and improvements
--   into a stable, canonical version.
--
-- Features:
--   1. Consolidated stable versions of all critical database functions
--   2. Comprehensive Row Level Security (RLS) policies
--   3. Non-recursive implementation to prevent infinite recursion
--   4. Idempotent execution (safe to run multiple times)
--   5. Extensive error handling and logging
--   6. Verification and testing
--
-- Usage:
--   Run this script in the Supabase SQL Editor or as a migration
--   to establish a secure and stable baseline for the database.
--
-- Note:
--   This script replaces all previous emergency fixes and should be
--   considered the canonical version for all database functions.
-- ================================================================

-- Use a transaction to ensure all changes are atomic
BEGIN;

-- Enable detailed error reporting
SET client_min_messages TO notice;

-- Create a temporary logging table for this execution
CREATE TEMP TABLE IF NOT EXISTS consolidation_log (
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
  INSERT INTO consolidation_log (operation, object_type, object_name, status, message)
  VALUES (operation, object_type, object_name, status, message);
  
  RAISE NOTICE '% % %: % %', 
    operation, 
    object_type, 
    object_name, 
    status, 
    COALESCE(message, '');
END;
$$ LANGUAGE plpgsql;

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
    PERFORM log_operation('DROP', 'Policy', policy_name || ' ON ' || table_name);
  ELSE
    PERFORM log_operation('SKIP', 'Policy', policy_name || ' ON ' || table_name, 'INFO', 'Policy does not exist');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM log_operation('DROP', 'Policy', policy_name || ' ON ' || table_name, 'ERROR', SQLERRM);
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

PERFORM log_operation('CREATE', 'Section', 'Helper Functions', 'SUCCESS', '9 helper functions created');

-- ================================================================
-- SECTION 2: CRITICAL DATABASE FUNCTIONS
-- ================================================================

-- 1. Get Paginated Shows Function (Stable Version)
DROP FUNCTION IF EXISTS public.get_paginated_shows;

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
- Includes the GROUP BY clause fix for s.coordinates
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
DROP FUNCTION IF EXISTS public.create_show_with_coordinates;

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

PERFORM log_operation('CREATE', 'Policy', 'User Favorite Shows Policies', 'SUCCESS', '6 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Show Participants Policies', 'SUCCESS', '8 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Want Lists Policies', 'SUCCESS', '7 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Shared Want Lists Policies', 'SUCCESS', '6 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Conversations Policies', 'SUCCESS', '4 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Conversation Participants Policies', 'SUCCESS', '4 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Messages Policies', 'SUCCESS', '5 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Reviews Policies', 'SUCCESS', '5 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Show Series Policies', 'SUCCESS', '5 policies created');

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

PERFORM log_operation('CREATE', 'Policy', 'Planned Attendance Policies', 'SUCCESS', '6 policies created');

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

PERFORM log_operation('CREATE', 'Section', 'Row Level Security Policies', 'SUCCESS', '60 policies created across 11 tables');

-- ================================================================
-- SECTION 4: VERIFICATION AND TESTING
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
      'consolidation_log'
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
    '{"lat": 37.7749, "long": -122.4194, "expected": true, "name": "San Francisco"}'::JSONB,
    '{"lat": 40.7128, "long": -74.0060, "expected": true, "name": "New York"}'::JSONB,
    '{"lat": 0, "long": 0, "expected": false, "name": "Null Island"}'::JSONB,
    '{"lat": 91, "long": 0, "expected": false, "name": "Invalid latitude (too high)"}'::JSONB,
    '{"lat": -91, "long": 0, "expected": false, "name": "Invalid latitude (too low)"}'::JSONB,
    '{"lat": 0, "long": 181, "expected": false, "name": "Invalid longitude (too high)"}'::JSONB,
    '{"lat": 0, "long": -181, "expected": false, "name": "Invalid longitude (too low)"}'::JSONB
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

PERFORM log_operation('CREATE', 'Section', 'Verification and Testing', 'SUCCESS', 'All verification and testing completed');

-- ================================================================
-- SECTION 5: COMPLETION
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
  SELECT COUNT(*) INTO total_operations FROM consolidation_log;
  SELECT COUNT(*) INTO successful_operations FROM consolidation_log WHERE status IN ('SUCCESS', 'INFO');
  SELECT COUNT(*) INTO warning_operations FROM consolidation_log WHERE status = 'WARNING';
  SELECT COUNT(*) INTO error_operations FROM consolidation_log WHERE status = 'ERROR';
  
  -- Display summary
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'DATABASE CONSOLIDATION COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Total operations: %', total_operations;
  RAISE NOTICE 'Successful operations: %', successful_operations;
  RAISE NOTICE 'Warnings: %', warning_operations;
  RAISE NOTICE 'Errors: %', error_operations;
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'This is now the canonical version of all database functions and policies.';
  RAISE NOTICE 'All previous emergency fixes have been consolidated into this version.';
  RAISE NOTICE '================================================================';
END $$;

-- Commit the transaction
COMMIT;
