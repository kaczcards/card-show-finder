-- create-rpc-functions.sql
-- Purpose: Add RPC functions to replace complex SQL queries in TypeScript services
-- These functions improve type safety, security, and maintainability

-- Drop existing functions if they exist to allow for updates
DROP FUNCTION IF EXISTS public.find_direct_conversation;
DROP FUNCTION IF EXISTS public.create_direct_conversation;
DROP FUNCTION IF EXISTS public.create_group_conversation;
DROP FUNCTION IF EXISTS public.get_user_profile_with_stats;
DROP FUNCTION IF EXISTS public.search_shows_advanced;
DROP FUNCTION IF EXISTS public.get_conversation_with_participants;
DROP FUNCTION IF EXISTS public.mark_conversation_read;
DROP FUNCTION IF EXISTS public.get_user_permissions;

-- -----------------------------------------------------------------------------
-- Function: find_direct_conversation
-- -----------------------------------------------------------------------------
-- Finds an existing direct conversation between two users
-- Returns the conversation ID if found, null otherwise
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_direct_conversation(
  user_a text,
  user_b text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- Run with definer's privileges for security
AS $$
DECLARE
  conversation_id text;
BEGIN
  -- Find conversations where both users are participants
  SELECT c.id INTO conversation_id
  FROM conversations c
  JOIN conversation_participants pa ON c.id = pa.conversation_id AND pa.user_id = user_a
  JOIN conversation_participants pb ON c.id = pb.conversation_id AND pb.user_id = user_b
  WHERE c.type = 'direct'
  LIMIT 1;
  
  -- If not found, try legacy approach with messages table
  IF conversation_id IS NULL THEN
    SELECT DISTINCT conversation_id INTO conversation_id
    FROM messages
    WHERE (sender_id = user_a AND recipient_id = user_b) OR 
          (sender_id = user_b AND recipient_id = user_a)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN conversation_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in find_direct_conversation: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_direct_conversation TO authenticated;

-- -----------------------------------------------------------------------------
-- Function: create_direct_conversation
-- -----------------------------------------------------------------------------
-- Creates a new direct conversation between two users
-- Returns the conversation ID of the new conversation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_direct_conversation(
  user_a text,
  user_b text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_conversation_id text;
  user_a_profile jsonb;
  user_b_profile jsonb;
BEGIN
  -- Generate a new UUID for the conversation
  new_conversation_id := gen_random_uuid()::text;
  
  -- Get user profiles for display names and photos
  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'avatar_url', avatar_url
  ) INTO user_a_profile
  FROM profiles
  WHERE id = user_a;
  
  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'avatar_url', avatar_url
  ) INTO user_b_profile
  FROM profiles
  WHERE id = user_b;
  
  -- Create the conversation
  INSERT INTO conversations (id, type, created_at, updated_at)
  VALUES (new_conversation_id, 'direct', now(), now());
  
  -- Add participants
  INSERT INTO conversation_participants (conversation_id, user_id, display_name, photo_url)
  VALUES 
    (new_conversation_id, user_a, 
     COALESCE(user_a_profile->>'full_name', 'User'), 
     user_a_profile->>'avatar_url'),
    (new_conversation_id, user_b, 
     COALESCE(user_b_profile->>'full_name', 'User'), 
     user_b_profile->>'avatar_url');
  
  RETURN new_conversation_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in create_direct_conversation: %', SQLERRM;
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_direct_conversation TO authenticated;

-- -----------------------------------------------------------------------------
-- Function: create_group_conversation
-- -----------------------------------------------------------------------------
-- Creates a new group conversation with multiple participants
-- Optionally associates the conversation with a show
-- Returns the conversation ID of the new group
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  creator_id text,
  participant_ids text[],
  show_id text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_conversation_id text;
  participant_id text;
  user_profile jsonb;
  conversation_type text;
BEGIN
  -- Generate a new UUID for the conversation
  new_conversation_id := gen_random_uuid()::text;
  
  -- Determine conversation type
  conversation_type := CASE WHEN show_id IS NULL THEN 'group' ELSE 'show' END;
  
  -- Create the conversation
  INSERT INTO conversations (id, type, show_id, created_at, updated_at)
  VALUES (new_conversation_id, conversation_type, show_id, now(), now());
  
  -- Add the creator first
  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'avatar_url', avatar_url
  ) INTO user_profile
  FROM profiles
  WHERE id = creator_id;
  
  INSERT INTO conversation_participants (conversation_id, user_id, display_name, photo_url)
  VALUES (
    new_conversation_id, 
    creator_id, 
    COALESCE(user_profile->>'full_name', 'User'),
    user_profile->>'avatar_url'
  );
  
  -- Add all other participants
  FOREACH participant_id IN ARRAY participant_ids
  LOOP
    -- Skip if participant is the creator (already added)
    IF participant_id = creator_id THEN
      CONTINUE;
    END IF;
    
    -- Get participant profile
    SELECT jsonb_build_object(
      'id', id,
      'full_name', full_name,
      'avatar_url', avatar_url
    ) INTO user_profile
    FROM profiles
    WHERE id = participant_id;
    
    -- Add participant
    INSERT INTO conversation_participants (conversation_id, user_id, display_name, photo_url)
    VALUES (
      new_conversation_id, 
      participant_id, 
      COALESCE(user_profile->>'full_name', 'User'),
      user_profile->>'avatar_url'
    );
  END LOOP;
  
  RETURN new_conversation_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in create_group_conversation: %', SQLERRM;
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_conversation TO authenticated;

-- -----------------------------------------------------------------------------
-- Function: get_user_profile_with_stats
-- -----------------------------------------------------------------------------
-- Retrieves a user profile with additional statistics
-- Returns a JSONB object with profile data and aggregated stats
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile_with_stats(
  user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT 
    jsonb_build_object(
      'profile', jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'bio', p.bio,
        'role', p.role,
        'created_at', p.created_at,
        'updated_at', p.updated_at
      ),
      'stats', jsonb_build_object(
        'shows_attended', (
          SELECT COUNT(*) FROM show_attendees sa WHERE sa.user_id = p.id
        ),
        'shows_organized', (
          SELECT COUNT(*) FROM shows s WHERE s.organizer_id = p.id
        ),
        'unread_messages', (
          SELECT COUNT(*)
          FROM messages m
          JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
          WHERE cp.user_id = p.id
          AND NOT (m.read_by_user_ids @> ARRAY[p.id])
          AND m.sender_id != p.id
        ),
        'favorite_shows', (
          SELECT COUNT(*) FROM user_favorites uf WHERE uf.user_id = p.id
        )
      )
    ) INTO result
  FROM profiles p
  WHERE p.id = user_id;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_user_profile_with_stats: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_profile_with_stats TO authenticated;

-- -----------------------------------------------------------------------------
-- Function: search_shows_advanced
-- -----------------------------------------------------------------------------
-- Advanced show search with multiple filter options
-- Takes a JSONB object with search parameters
-- Returns paginated results with total count
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_shows_advanced(
  search_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lat float;
  lng float;
  radius_miles float;
  start_date timestamp with time zone;
  end_date timestamp with time zone;
  max_entry_fee numeric;
  categories text[];
  features jsonb;
  keyword text;
  page_size integer;
  page integer;
  status text;
  total_count integer;
  offset_val integer;
  results jsonb;
BEGIN
  -- Extract parameters from JSONB
  lat := (search_params->>'lat')::float;
  lng := (search_params->>'lng')::float;
  radius_miles := COALESCE((search_params->>'radius_miles')::float, 25);
  start_date := COALESCE((search_params->>'start_date')::timestamp with time zone, current_date);
  end_date := COALESCE((search_params->>'end_date')::timestamp with time zone, (current_date + interval '30 days'));
  max_entry_fee := (search_params->>'max_entry_fee')::numeric;
  categories := CASE WHEN search_params ? 'categories' THEN 
                  (SELECT array_agg(jsonb_array_elements_text(search_params->'categories')))
                ELSE NULL END;
  features := search_params->'features';
  keyword := search_params->>'keyword';
  page_size := COALESCE((search_params->>'page_size')::integer, 20);
  page := COALESCE((search_params->>'page')::integer, 1);
  status := COALESCE(search_params->>'status', 'ACTIVE');
  
  -- Calculate offset
  offset_val := (page - 1) * page_size;
  
  -- Get total count
  WITH filtered_shows AS (
    SELECT s.id
    FROM public.shows s
    WHERE
      -- Date range filters
      s.end_date >= CURRENT_DATE AND
      s.start_date <= end_date AND
      s.end_date >= start_date AND
      
      -- Status filter
      (status IS NULL OR s.status = status) AND
      
      -- Location filter (if coordinates provided)
      (
        (lat IS NULL OR lng IS NULL) OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326),
            radius_miles * 1609.34  -- Convert miles to meters
          )
        )
      ) AND
      
      -- Entry fee filter
      (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee) AND
      
      -- Categories filter
      (categories IS NULL OR s.categories && categories) AND
      
      -- Features filter (check if all requested features are present)
      (
        features IS NULL OR
        CASE 
          WHEN jsonb_typeof(features) = 'object' THEN
            s.features @> features
          ELSE 
            TRUE
        END
      ) AND
      
      -- Keyword search
      (
        keyword IS NULL OR
        s.title ILIKE '%' || keyword || '%' OR
        s.description ILIKE '%' || keyword || '%' OR
        s.location ILIKE '%' || keyword || '%'
      )
  )
  SELECT COUNT(*)::integer INTO total_count FROM filtered_shows;
  
  -- Get paginated results
  WITH filtered_shows AS (
    SELECT 
      s.*,
      -- Extract coordinates for easier client use
      ST_X(s.coordinates::geometry) AS longitude,
      ST_Y(s.coordinates::geometry) AS latitude,
      -- Calculate distance if coordinates provided
      CASE 
        WHEN lat IS NOT NULL AND lng IS NOT NULL THEN
          ST_DistanceSphere(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)
          ) / 1609.34  -- Convert meters to miles
        ELSE NULL
      END AS distance_miles
    FROM public.shows s
    WHERE
      -- Date range filters
      s.end_date >= CURRENT_DATE AND
      s.start_date <= end_date AND
      s.end_date >= start_date AND
      
      -- Status filter
      (status IS NULL OR s.status = status) AND
      
      -- Location filter (if coordinates provided)
      (
        (lat IS NULL OR lng IS NULL) OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326),
            radius_miles * 1609.34  -- Convert miles to meters
          )
        )
      ) AND
      
      -- Entry fee filter
      (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee) AND
      
      -- Categories filter
      (categories IS NULL OR s.categories && categories) AND
      
      -- Features filter
      (
        features IS NULL OR
        CASE 
          WHEN jsonb_typeof(features) = 'object' THEN
            s.features @> features
          ELSE 
            TRUE
        END
      ) AND
      
      -- Keyword search
      (
        keyword IS NULL OR
        s.title ILIKE '%' || keyword || '%' OR
        s.description ILIKE '%' || keyword || '%' OR
        s.location ILIKE '%' || keyword || '%'
      )
    ORDER BY
      -- Order by distance if coordinates provided, otherwise by start date
      CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN
        ST_DistanceSphere(
          s.coordinates,
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        )
      ELSE NULL END ASC NULLS LAST,
      s.start_date ASC
    LIMIT page_size
    OFFSET offset_val
  )
  SELECT jsonb_build_object(
    'data', jsonb_agg(
      jsonb_build_object(
        'id', fs.id,
        'title', fs.title,
        'description', fs.description,
        'location', fs.location,
        'address', fs.address,
        'start_date', fs.start_date,
        'end_date', fs.end_date,
        'entry_fee', fs.entry_fee,
        'image_url', fs.image_url,
        'status', fs.status,
        'organizer_id', fs.organizer_id,
        'features', fs.features,
        'categories', fs.categories,
        'created_at', fs.created_at,
        'updated_at', fs.updated_at,
        'coordinates', jsonb_build_object(
          'latitude', fs.latitude,
          'longitude', fs.longitude
        ),
        'distance_miles', fs.distance_miles
      )
    ),
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(total_count::float / page_size),
      'has_more', (offset_val + page_size) < total_count
    )
  ) INTO results
  FROM filtered_shows fs;
  
  RETURN COALESCE(results, jsonb_build_object(
    'data', jsonb_build_array(),
    'pagination', jsonb_build_object(
      'total_count', 0,
      'page_size', page_size,
      'current_page', page,
      'total_pages', 0,
      'has_more', false
    )
  ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in search_shows_advanced: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_shows_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_shows_advanced TO anon;

-- -----------------------------------------------------------------------------
-- Function: get_conversation_with_participants
-- -----------------------------------------------------------------------------
-- Gets full conversation details including participants and latest message
-- Returns a JSONB object with conversation data
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversation_with_participants(
  conversation_id text,
  current_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  unread_count integer;
  latest_message jsonb;
BEGIN
  -- Check if user is a participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = get_conversation_with_participants.conversation_id
    AND user_id = current_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'User is not a participant in this conversation');
  END IF;
  
  -- Get unread message count for current user
  SELECT COUNT(*) INTO unread_count
  FROM messages m
  WHERE m.conversation_id = get_conversation_with_participants.conversation_id
  AND m.sender_id != current_user_id
  AND NOT (m.read_by_user_ids @> ARRAY[current_user_id]);
  
  -- Get latest message
  SELECT jsonb_build_object(
    'id', m.id,
    'sender_id', m.sender_id,
    'message_text', m.message_text,
    'created_at', m.created_at,
    'sender_name', (
      SELECT cp.display_name
      FROM conversation_participants cp
      WHERE cp.conversation_id = m.conversation_id
      AND cp.user_id = m.sender_id
      LIMIT 1
    )
  ) INTO latest_message
  FROM messages m
  WHERE m.conversation_id = get_conversation_with_participants.conversation_id
  ORDER BY m.created_at DESC
  LIMIT 1;
  
  -- Build the complete result
  SELECT jsonb_build_object(
    'id', c.id,
    'type', c.type,
    'show_id', c.show_id,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'unread_count', unread_count,
    'last_message_text', latest_message->>'message_text',
    'last_message_timestamp', latest_message->>'created_at',
    'participants', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', cp.user_id,
          'display_name', cp.display_name,
          'photo_url', cp.photo_url
        )
      )
      FROM conversation_participants cp
      WHERE cp.conversation_id = c.id
    )
  ) INTO result
  FROM conversations c
  WHERE c.id = get_conversation_with_participants.conversation_id;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_conversation_with_participants: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_with_participants TO authenticated;

-- -----------------------------------------------------------------------------
-- Function: mark_conversation_read
-- -----------------------------------------------------------------------------
-- Marks all messages in a conversation as read by a specific user
-- Returns the number of messages marked as read
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  conversation_id text,
  user_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Check if user is a participant in the conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = mark_conversation_read.conversation_id
    AND user_id = mark_conversation_read.user_id
  ) THEN
    RETURN 0;
  END IF;
  
  -- Update messages that haven't been read by this user yet
  WITH updated_messages AS (
    UPDATE messages
    SET read_by_user_ids = array_append(read_by_user_ids, user_id)
    WHERE conversation_id = mark_conversation_read.conversation_id
    AND sender_id != user_id
    AND NOT (read_by_user_ids @> ARRAY[user_id])
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated_messages;
  
  -- Update the conversation's updated_at timestamp
  UPDATE conversations
  SET updated_at = now()
  WHERE id = conversation_id;
  
  RETURN updated_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in mark_conversation_read: %', SQLERRM;
    RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read TO authenticated;

-- -----------------------------------------------------------------------------
-- Function: get_user_permissions
-- -----------------------------------------------------------------------------
-- Gets user role and permissions
-- Returns a JSONB object with role and permissions data
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  subscription_status text;
  payment_status text;
  result jsonb;
BEGIN
  -- Get user role and subscription information
  SELECT 
    p.role,
    p.subscription_status,
    p.payment_status
  INTO
    user_role,
    subscription_status,
    payment_status
  FROM profiles p
  WHERE p.id = user_id;
  
  -- Define permissions based on role and subscription status
  SELECT jsonb_build_object(
    'role', user_role,
    'subscription_status', subscription_status,
    'payment_status', payment_status,
    'permissions', jsonb_build_object(
      -- Basic permissions
      'can_view_shows', TRUE,
      'can_favorite_shows', TRUE,
      
      -- Attendee permissions
      'can_attend_shows', TRUE,
      'can_create_want_lists', TRUE,
      
      -- Dealer permissions
      'can_create_tables', user_role IN ('dealer', 'mvp_dealer', 'show_organizer'),
      'can_list_inventory', user_role IN ('dealer', 'mvp_dealer', 'show_organizer'),
      
      -- MVP dealer permissions
      'can_broadcast_messages', user_role IN ('mvp_dealer', 'show_organizer'),
      'can_access_analytics', user_role IN ('mvp_dealer', 'show_organizer'),
      
      -- Show organizer permissions
      'can_create_shows', user_role = 'show_organizer',
      'can_manage_shows', user_role = 'show_organizer',
      
      -- Subscription-based permissions
      'has_active_subscription', subscription_status = 'active',
      'is_trial_user', payment_status = 'trial'
    ),
    'feature_access', jsonb_build_object(
      'messaging_v2', user_role IN ('mvp_dealer', 'show_organizer'),
      'advanced_search', TRUE,
      'dealer_analytics', user_role IN ('mvp_dealer', 'show_organizer') AND subscription_status = 'active'
    )
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_user_permissions: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions TO authenticated;

-- Add comment explaining the purpose of this migration
COMMENT ON SCHEMA public IS 'RPC functions added to replace complex SQL queries in TypeScript services';
