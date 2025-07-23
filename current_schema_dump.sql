

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."show_details" AS (
	"name" "text",
	"start_date" "date",
	"end_date" "date",
	"venue_name" "text",
	"city" "text",
	"state" character varying(2),
	"url" "text"
);


ALTER TYPE "public"."show_details" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found'
    );
  END IF;
  
  -- Check if show exists
  IF NOT EXISTS (SELECT 1 FROM public.shows WHERE id = p_show_id) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Show not found'
    );
  END IF;
  
  -- Check if favorite already exists
  IF EXISTS (SELECT 1 FROM public.user_favorite_shows WHERE user_id = p_user_id AND show_id = p_show_id) THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Show already favorited'
    );
  END IF;
  
  -- Add the favorite
  BEGIN
    INSERT INTO public.user_favorite_shows (user_id, show_id)
    VALUES (p_user_id, p_show_id);
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Show favorited successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
  END;
END;
$$;


ALTER FUNCTION "public"."add_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_reply"("p_user_id" "uuid", "p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_user_role TEXT;
  v_is_participant BOOLEAN;
  v_can_reply BOOLEAN;
  v_is_one_way BOOLEAN;
BEGIN
  -- Get user role
  SELECT LOWER(role) INTO v_user_role FROM profiles WHERE id = p_user_id;
  
  -- Check if user is a participant and can reply
  SELECT 
    EXISTS(SELECT 1 FROM conversation_participants WHERE user_id = p_user_id AND conversation_id = p_conversation_id),
    cp.can_reply
  INTO 
    v_is_participant, 
    v_can_reply
  FROM conversation_participants cp
  WHERE cp.user_id = p_user_id AND cp.conversation_id = p_conversation_id;
  
  -- Check if conversation is one-way
  SELECT EXISTS(
    SELECT 1 FROM conversations 
    WHERE id = p_conversation_id AND type = 'show'
  ) INTO v_is_one_way;
  
  -- DEALER cannot reply to any messages
  IF v_user_role = 'dealer' THEN
    RETURN FALSE;
  END IF;
  
  -- No one can reply to one-way broadcasts (unless they're the sender)
  IF v_is_one_way AND NOT EXISTS(
    SELECT 1 FROM messages 
    WHERE conversation_id = p_conversation_id 
    AND sender_id = p_user_id 
    LIMIT 1
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- User must be a participant and have reply permission
  RETURN v_is_participant AND v_can_reply;
END;
$$;


ALTER FUNCTION "public"."can_user_reply"("p_user_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_send_dm"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_show_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_sender_role TEXT;
  v_recipient_role TEXT;
  v_share_show BOOLEAN := FALSE;
BEGIN
  -- Get sender and recipient roles
  SELECT role INTO v_sender_role FROM profiles WHERE id = p_sender_id;
  SELECT role INTO v_recipient_role FROM profiles WHERE id = p_recipient_id;
  
  -- Convert roles to lowercase for consistency
  v_sender_role := LOWER(v_sender_role);
  v_recipient_role := LOWER(v_recipient_role);
  
  -- Check if sender and recipient share a show (if show_id provided)
  IF p_show_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM show_participants sp1
      JOIN show_participants sp2 ON sp1.showid = sp2.showid
      WHERE sp1.userid = p_sender_id AND sp2.userid = p_recipient_id AND sp1.showid = p_show_id
    ) INTO v_share_show;
  END IF;
  
  -- Apply role-based permission matrix
  
  -- ATTENDEE can message MVP_DEALER
  IF v_sender_role = 'attendee' AND v_recipient_role = 'mvp_dealer' THEN
    RETURN TRUE;
  END IF;
  
  -- MVP_DEALER can message ATTENDEE or DEALER if they share a show
  IF v_sender_role = 'mvp_dealer' AND (v_recipient_role = 'attendee' OR v_recipient_role = 'dealer') THEN
    IF p_show_id IS NULL OR v_share_show THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- MVP_DEALER can message SHOW_ORGANIZER
  IF v_sender_role = 'mvp_dealer' AND v_recipient_role = 'show_organizer' THEN
    RETURN TRUE;
  END IF;
  
  -- SHOW_ORGANIZER can message anyone
  IF v_sender_role = 'show_organizer' THEN
    RETURN TRUE;
  END IF;
  
  -- Default: deny permission
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_user_send_dm"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_show_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_use_broadcast_quota"("p_organizer_id" "uuid", "p_show_id" "uuid", "p_is_pre_show" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_quota_record RECORD;
  v_show_record RECORD;
  v_is_pre_show BOOLEAN;
  v_quota_remaining INTEGER;
BEGIN
  -- Get show information to determine if it's pre or post show
  SELECT * INTO v_show_record FROM shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN FALSE; -- Show not found
  END IF;
  
  -- Determine if we're pre-show or post-show based on current date vs. show date
  IF p_is_pre_show IS NULL THEN
    v_is_pre_show := CURRENT_TIMESTAMP < v_show_record.start_date;
  ELSE
    v_is_pre_show := p_is_pre_show;
  END IF;
  
  -- Get current quota record, creating if it doesn't exist
  INSERT INTO broadcast_quotas (organizer_id, show_id)
  VALUES (p_organizer_id, p_show_id)
  ON CONFLICT (organizer_id, show_id) DO NOTHING;
  
  SELECT * INTO v_quota_record 
  FROM broadcast_quotas
  WHERE organizer_id = p_organizer_id AND show_id = p_show_id;
  
  -- Check appropriate quota
  IF v_is_pre_show THEN
    v_quota_remaining := v_quota_record.pre_show_remaining;
  ELSE
    v_quota_remaining := v_quota_record.post_show_remaining;
  END IF;
  
  -- If no quota remaining, return false
  IF v_quota_remaining <= 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Decrement the appropriate quota
  IF v_is_pre_show THEN
    UPDATE broadcast_quotas
    SET pre_show_remaining = pre_show_remaining - 1,
        last_updated = now()
    WHERE organizer_id = p_organizer_id AND show_id = p_show_id;
  ELSE
    UPDATE broadcast_quotas
    SET post_show_remaining = post_show_remaining - 1,
        last_updated = now()
    WHERE organizer_id = p_organizer_id AND show_id = p_show_id;
  END IF;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_and_use_broadcast_quota"("p_organizer_id" "uuid", "p_show_id" "uuid", "p_is_pre_show" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_want_list_access"("viewer_id" "uuid", "show_id" "uuid") RETURNS TABLE("can_access" boolean, "user_role" "text", "reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the viewer's role
  SELECT role INTO user_role FROM profiles WHERE id = viewer_id;
  
  -- Check access based on role
  IF user_role = 'mvp_dealer' THEN
    -- Check if MVP dealer is participating in the show
    IF EXISTS (
      SELECT 1 FROM show_participants 
      WHERE userid = viewer_id AND showid = show_id
    ) THEN
      RETURN QUERY SELECT 
        TRUE as can_access, 
        user_role, 
        'MVP dealer is participating in this show' as reason;
    ELSE
      RETURN QUERY SELECT 
        FALSE as can_access, 
        user_role, 
        'MVP dealer is not participating in this show' as reason;
    END IF;
  ELSIF user_role = 'show_organizer' THEN
    -- Check if user is the organizer of the show
    IF EXISTS (
      SELECT 1 FROM shows 
      WHERE id = show_id AND organizer_id = viewer_id
    ) THEN
      RETURN QUERY SELECT 
        TRUE as can_access, 
        user_role, 
        'User is the organizer of this show' as reason;
    ELSE
      RETURN QUERY SELECT 
        FALSE as can_access, 
        user_role, 
        'User is not the organizer of this show' as reason;
    END IF;
  ELSE
    -- Other roles don't have access to others' want lists
    RETURN QUERY SELECT 
      FALSE as can_access, 
      user_role, 
      'User role does not have access to other users'' want lists' as reason;
  END IF;
END;
$$;


ALTER FUNCTION "public"."check_want_list_access"("viewer_id" "uuid", "show_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_show_series"("series_id" "uuid", "organizer_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    organizer_role TEXT;
    current_organizer_id UUID;
    result JSONB;
BEGIN
    -- Check if the organizer has the SHOW_ORGANIZER role
    SELECT role INTO organizer_role
    FROM public.profiles
    WHERE id = organizer_id;
    
    IF organizer_role != 'SHOW_ORGANIZER' THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Only users with SHOW_ORGANIZER role can claim show series',
            'code', 'INSUFFICIENT_PERMISSIONS'
        );
        RETURN result;
    END IF;
    
    -- Check if the series exists and is not already claimed
    SELECT organizer_id INTO current_organizer_id
    FROM public.show_series
    WHERE id = series_id;
    
    IF current_organizer_id IS NOT NULL AND current_organizer_id != organizer_id THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Show series is already claimed by another organizer',
            'code', 'ALREADY_CLAIMED'
        );
        RETURN result;
    END IF;
    
    -- Update the series organizer_id
    UPDATE public.show_series
    SET organizer_id = claim_show_series.organizer_id
    WHERE id = series_id
    RETURNING id, name, organizer_id, created_at, updated_at 
    INTO result;
    
    -- Return success response with show data
    result := jsonb_build_object(
        'success', true,
        'message', 'Show series successfully claimed',
        'data', result,
        'code', 'SUCCESS'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Error claiming show series: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
        RETURN result;
END;
$$;


ALTER FUNCTION "public"."claim_show_series"("series_id" "uuid", "organizer_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_show_series"("series_id" "uuid", "organizer_id" "uuid") IS 'Function to claim ownership of a show series by a show organizer';



CREATE OR REPLACE FUNCTION "public"."create_broadcast_message"("p_sender_id" "uuid", "p_show_id" "uuid", "p_message_text" "text", "p_recipient_roles" "text"[], "p_is_pre_show" boolean DEFAULT NULL::boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
  v_sender_role TEXT;
  v_can_broadcast BOOLEAN;
  v_quota_available BOOLEAN;
  v_recipient_ids UUID[];
BEGIN
  -- Validate sender role
  SELECT LOWER(role) INTO v_sender_role FROM profiles WHERE id = p_sender_id;
  
  -- Only SHOW_ORGANIZER and MVP_DEALER can broadcast
  IF v_sender_role NOT IN ('show_organizer', 'mvp_dealer') THEN
    RAISE EXCEPTION 'User does not have permission to broadcast messages';
  END IF;
  
  -- For show organizers, check and use quota
  IF v_sender_role = 'show_organizer' THEN
    SELECT check_and_use_broadcast_quota(p_sender_id, p_show_id, p_is_pre_show) INTO v_quota_available;
    
    IF NOT v_quota_available THEN
      RAISE EXCEPTION 'Broadcast quota exceeded for this show';
    END IF;
  END IF;
  
  -- For MVP dealers, ensure they're registered for this show
  IF v_sender_role = 'mvp_dealer' THEN
    IF NOT EXISTS(SELECT 1 FROM show_participants WHERE userid = p_sender_id AND showid = p_show_id) THEN
      RAISE EXCEPTION 'MVP Dealer must be registered for the show to broadcast';
    END IF;
    
    -- MVP dealers can only broadcast to attendees
    IF NOT (p_recipient_roles <@ ARRAY['attendee']::TEXT[]) THEN
      RAISE EXCEPTION 'MVP Dealers can only broadcast to attendees';
    END IF;
  END IF;
  
  -- Find recipients based on roles
  SELECT ARRAY_AGG(DISTINCT p.id) INTO v_recipient_ids
  FROM profiles p
  WHERE LOWER(p.role) = ANY(p_recipient_roles)
  AND p.id != p_sender_id
  AND (
    -- For show-specific broadcasts, include only users participating in the show
    p_show_id IS NULL OR EXISTS(
      SELECT 1 FROM show_participants sp
      WHERE sp.userid = p.id AND sp.showid = p_show_id
    )
  );
  
  -- Create conversation
  INSERT INTO conversations (type, show_id, last_message_text, last_message_timestamp)
  VALUES ('show', p_show_id, p_message_text, now())
  RETURNING id INTO v_conversation_id;
  
  -- Add sender as participant
  INSERT INTO conversation_participants (
    conversation_id, 
    user_id, 
    display_name,
    photo_url,
    role_when_added,
    can_reply
  )
  SELECT 
    v_conversation_id,
    p_sender_id,
    p.first_name || ' ' || COALESCE(p.last_name, ''),
    p.profile_image_url,
    p.role,
    TRUE
  FROM profiles p
  WHERE p.id = p_sender_id;
  
  -- Add recipients as participants
  INSERT INTO conversation_participants (
    conversation_id, 
    user_id, 
    display_name,
    photo_url,
    unread_count,
    role_when_added,
    can_reply
  )
  SELECT 
    v_conversation_id,
    p.id,
    p.first_name || ' ' || COALESCE(p.last_name, ''),
    p.profile_image_url,
    1,  -- Start with 1 unread message
    p.role,
    FALSE  -- Recipients can't reply to broadcasts
  FROM profiles p
  WHERE p.id = ANY(v_recipient_ids);
  
  -- Insert the broadcast message
  INSERT INTO messages (
    conversation_id,
    sender_id,
    message_text,
    read_by_user_ids,
    is_broadcast,
    show_context,
    is_one_way
  )
  VALUES (
    v_conversation_id,
    p_sender_id,
    p_message_text,
    ARRAY[p_sender_id]::UUID[],  -- Sender has read their own message
    TRUE,
    p_show_id,
    TRUE
  );
  
  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_broadcast_message"("p_sender_id" "uuid", "p_show_id" "uuid", "p_message_text" "text", "p_recipient_roles" "text"[], "p_is_pre_show" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_geography_point"("lat" double precision, "lng" double precision) RETURNS "public"."geography"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT validate_coordinates(lat, lng) THEN
    RAISE EXCEPTION 'Invalid coordinates: latitude=%, longitude=%', lat, lng;
  END IF;
  
  RETURN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY;
END;
$$;


ALTER FUNCTION "public"."create_geography_point"("lat" double precision, "lng" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_geography_point"("lat" double precision, "lng" double precision) IS 'Creates a PostGIS geography point from latitude and longitude';



CREATE OR REPLACE FUNCTION "public"."create_show_with_coordinates"("p_title" "text", "p_description" "text", "p_location" "text", "p_address" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_entry_fee" numeric, "p_image_url" "text", "p_latitude" double precision, "p_longitude" double precision, "p_features" "jsonb" DEFAULT NULL::"jsonb", "p_categories" "text"[] DEFAULT NULL::"text"[], "p_series_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."create_show_with_coordinates"("p_title" "text", "p_description" "text", "p_location" "text", "p_address" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_entry_fee" numeric, "p_image_url" "text", "p_latitude" double precision, "p_longitude" double precision, "p_features" "jsonb", "p_categories" "text"[], "p_series_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_show_with_coordinates"("p_title" "text", "p_description" "text", "p_location" "text", "p_address" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_entry_fee" numeric, "p_image_url" "text", "p_latitude" double precision, "p_longitude" double precision, "p_features" "jsonb", "p_categories" "text"[], "p_series_id" "uuid") IS 'Creates a new show with validated coordinates. This function safely handles coordinate validation
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



CREATE OR REPLACE FUNCTION "public"."debug_wkb_coordinates"("wkb_hex" "text") RETURNS TABLE("input_hex" "text", "latitude" double precision, "longitude" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wkb_hex AS input_hex,
    public.ST_Y_Float8(ST_GeomFromEWKB(decode(wkb_hex, 'hex'))::geography) AS latitude,
    public.ST_X_Float8(ST_GeomFromEWKB(decode(wkb_hex, 'hex'))::geography) AS longitude;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY
  SELECT 
    wkb_hex AS input_hex,
    NULL::double precision AS latitude,
    NULL::double precision AS longitude;
END;
$$;


ALTER FUNCTION "public"."debug_wkb_coordinates"("wkb_hex" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_unread"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN GREATEST(COALESCE(NEW.unread_count, 0) - 1, 0);  -- Minimum 0
END;
$$;


ALTER FUNCTION "public"."decrement_unread"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diagnose_want_list_issues"("viewer_id" "uuid", "test_attendee_id" "uuid" DEFAULT NULL::"uuid", "test_show_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("check_name" "text", "status" "text", "details" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
  show_count INT;
  favorite_count INT;
  want_list_count INT;
  show_participant_count INT;
  organized_show_count INT;
BEGIN
  -- Get the viewer's role
  SELECT role INTO user_role FROM profiles WHERE id = viewer_id;
  
  -- Check 1: Verify user role
  IF user_role IN ('mvp_dealer', 'show_organizer') THEN
    RETURN QUERY SELECT 
      'User Role' as check_name, 
      'PASS' as status, 
      'User has role: ' || user_role as details;
  ELSE
    RETURN QUERY SELECT 
      'User Role' as check_name, 
      'FAIL' as status, 
      'User has role ' || COALESCE(user_role, 'NULL') || ', needs mvp_dealer or show_organizer' as details;
    -- Exit early if role is incorrect
    RETURN;
  END IF;
  
  -- Check 2: For MVP dealers, verify they participate in shows
  IF user_role = 'mvp_dealer' THEN
    SELECT COUNT(*) INTO show_participant_count 
    FROM show_participants 
    WHERE userid = viewer_id;
    
    IF show_participant_count > 0 THEN
      RETURN QUERY SELECT 
        'Show Participation' as check_name, 
        'PASS' as status, 
        'User participates in ' || show_participant_count || ' shows' as details;
    ELSE
      RETURN QUERY SELECT 
        'Show Participation' as check_name, 
        'FAIL' as status, 
        'User does not participate in any shows' as details;
    END IF;
    
    -- Check for upcoming shows specifically
    SELECT COUNT(*) INTO show_count 
    FROM show_participants sp
    JOIN shows s ON sp.showid = s.id
    WHERE sp.userid = viewer_id
    AND s.start_date >= CURRENT_DATE;
    
    IF show_count > 0 THEN
      RETURN QUERY SELECT 
        'Upcoming Shows' as check_name, 
        'PASS' as status, 
        'User participates in ' || show_count || ' upcoming shows' as details;
    ELSE
      RETURN QUERY SELECT 
        'Upcoming Shows' as check_name, 
        'FAIL' as status, 
        'User does not participate in any upcoming shows' as details;
    END IF;
  END IF;
  
  -- Check 3: For show organizers, verify they organize shows
  IF user_role = 'show_organizer' THEN
    SELECT COUNT(*) INTO organized_show_count 
    FROM shows 
    WHERE organizer_id = viewer_id;
    
    IF organized_show_count > 0 THEN
      RETURN QUERY SELECT 
        'Show Organization' as check_name, 
        'PASS' as status, 
        'User organizes ' || organized_show_count || ' shows' as details;
    ELSE
      RETURN QUERY SELECT 
        'Show Organization' as check_name, 
        'FAIL' as status, 
        'User does not organize any shows' as details;
    END IF;
    
    -- Check for upcoming shows specifically
    SELECT COUNT(*) INTO show_count 
    FROM shows 
    WHERE organizer_id = viewer_id
    AND start_date >= CURRENT_DATE;
    
    IF show_count > 0 THEN
      RETURN QUERY SELECT 
        'Upcoming Shows' as check_name, 
        'PASS' as status, 
        'User organizes ' || show_count || ' upcoming shows' as details;
    ELSE
      RETURN QUERY SELECT 
        'Upcoming Shows' as check_name, 
        'FAIL' as status, 
        'User does not organize any upcoming shows' as details;
    END IF;
  END IF;
  
  -- Check 4: Verify there are favorites for the shows
  IF user_role = 'mvp_dealer' THEN
    SELECT COUNT(*) INTO favorite_count 
    FROM user_favorite_shows ufs
    JOIN show_participants sp ON ufs.show_id = sp.showid
    JOIN shows s ON ufs.show_id = s.id
    WHERE sp.userid = viewer_id
    AND s.start_date >= CURRENT_DATE;
  ELSIF user_role = 'show_organizer' THEN
    SELECT COUNT(*) INTO favorite_count 
    FROM user_favorite_shows ufs
    JOIN shows s ON ufs.show_id = s.id
    WHERE s.organizer_id = viewer_id
    AND s.start_date >= CURRENT_DATE;
  END IF;
  
  IF favorite_count > 0 THEN
    RETURN QUERY SELECT 
      'Show Favorites' as check_name, 
      'PASS' as status, 
      'Found ' || favorite_count || ' favorites for relevant shows' as details;
  ELSE
    RETURN QUERY SELECT 
      'Show Favorites' as check_name, 
      'FAIL' as status, 
      'No favorites found for relevant shows' as details;
  END IF;
  
  -- Check 5: Verify want lists exist for attendees
  IF user_role = 'mvp_dealer' THEN
    SELECT COUNT(*) INTO want_list_count 
    FROM want_lists wl
    JOIN user_favorite_shows ufs ON wl.userid = ufs.user_id
    JOIN show_participants sp ON ufs.show_id = sp.showid
    JOIN shows s ON ufs.show_id = s.id
    WHERE sp.userid = viewer_id
    AND s.start_date >= CURRENT_DATE
    AND NOT wl.content ILIKE '[INVENTORY]%'
    AND wl.content IS NOT NULL
    AND wl.content <> '';
  ELSIF user_role = 'show_organizer' THEN
    SELECT COUNT(*) INTO want_list_count 
    FROM want_lists wl
    JOIN user_favorite_shows ufs ON wl.userid = ufs.user_id
    JOIN shows s ON ufs.show_id = s.id
    WHERE s.organizer_id = viewer_id
    AND s.start_date >= CURRENT_DATE
    AND NOT wl.content ILIKE '[INVENTORY]%'
    AND wl.content IS NOT NULL
    AND wl.content <> '';
  END IF;
  
  IF want_list_count > 0 THEN
    RETURN QUERY SELECT 
      'Want Lists' as check_name, 
      'PASS' as status, 
      'Found ' || want_list_count || ' want lists for attendees of relevant shows' as details;
  ELSE
    RETURN QUERY SELECT 
      'Want Lists' as check_name, 
      'FAIL' as status, 
      'No want lists found for attendees of relevant shows' as details;
  END IF;
  
  -- Check 6: Specific test case if IDs are provided
  IF test_attendee_id IS NOT NULL AND test_show_id IS NOT NULL THEN
    -- Check if test attendee has favorited test show
    IF EXISTS (
      SELECT 1 FROM user_favorite_shows 
      WHERE user_id = test_attendee_id AND show_id = test_show_id
    ) THEN
      RETURN QUERY SELECT 
        'Test Favorite' as check_name, 
        'PASS' as status, 
        'Test attendee has favorited the test show' as details;
    ELSE
      RETURN QUERY SELECT 
        'Test Favorite' as check_name, 
        'FAIL' as status, 
        'Test attendee has NOT favorited the test show' as details;
    END IF;
    
    -- Check if test attendee has a want list
    IF EXISTS (
      SELECT 1 FROM want_lists 
      WHERE userid = test_attendee_id
      AND NOT content ILIKE '[INVENTORY]%'
      AND content IS NOT NULL
      AND content <> ''
    ) THEN
      RETURN QUERY SELECT 
        'Test Want List' as check_name, 
        'PASS' as status, 
        'Test attendee has a want list' as details;
    ELSE
      RETURN QUERY SELECT 
        'Test Want List' as check_name, 
        'FAIL' as status, 
        'Test attendee does NOT have a want list' as details;
    END IF;
    
    -- Check if the test show is in the future
    IF EXISTS (
      SELECT 1 FROM shows 
      WHERE id = test_show_id
      AND start_date >= CURRENT_DATE
    ) THEN
      RETURN QUERY SELECT 
        'Test Show Date' as check_name, 
        'PASS' as status, 
        'Test show is an upcoming show' as details;
    ELSE
      RETURN QUERY SELECT 
        'Test Show Date' as check_name, 
        'FAIL' as status, 
        'Test show is in the past' as details;
    END IF;
    
    -- Check if viewer has access to test show
    IF user_role = 'mvp_dealer' THEN
      IF EXISTS (
        SELECT 1 FROM show_participants 
        WHERE userid = viewer_id AND showid = test_show_id
      ) THEN
        RETURN QUERY SELECT 
          'Test Show Access' as check_name, 
          'PASS' as status, 
          'MVP dealer is participating in the test show' as details;
      ELSE
        RETURN QUERY SELECT 
          'Test Show Access' as check_name, 
          'FAIL' as status, 
          'MVP dealer is NOT participating in the test show' as details;
      END IF;
    ELSIF user_role = 'show_organizer' THEN
      IF EXISTS (
        SELECT 1 FROM shows 
        WHERE id = test_show_id AND organizer_id = viewer_id
      ) THEN
        RETURN QUERY SELECT 
          'Test Show Access' as check_name, 
          'PASS' as status, 
          'Show organizer is the organizer of the test show' as details;
      ELSE
        RETURN QUERY SELECT 
          'Test Show Access' as check_name, 
          'FAIL' as status, 
          'Show organizer is NOT the organizer of the test show' as details;
      END IF;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."diagnose_want_list_issues"("viewer_id" "uuid", "test_attendee_id" "uuid", "test_show_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."shows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "location" "text" NOT NULL,
    "address" "text" NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "entry_fee" numeric(10,2),
    "description" "text",
    "image_url" "text",
    "rating" numeric(2,1),
    "coordinates" "public"."geography"(Point,4326),
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "organizer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "start_time" "text",
    "end_time" "text",
    "website_url" "text",
    "series_id" "uuid"
);


ALTER TABLE "public"."shows" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shows"."series_id" IS 'References the show_series this show belongs to';



CREATE OR REPLACE FUNCTION "public"."find_filtered_shows"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "max_entry_fee" numeric DEFAULT NULL::numeric, "show_categories" "text"[] DEFAULT NULL::"text"[], "show_features" "text"[] DEFAULT NULL::"text"[]) RETURNS SETOF "public"."shows"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.shows
  WHERE
    -- Spatial filter
    ST_DWithin(
      coordinates::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    )
    -- Status filter - only active shows
    AND status = 'ACTIVE'
    -- Date filters
    -- Ensure the show's start date is on or after the provided start_date (if any)
    AND (start_date IS NULL OR shows.start_date >= start_date)
    -- Ensure the show's end date is on or before the provided end_date (if any)
    AND (end_date IS NULL OR shows.end_date <= end_date)
    -- IMPORTANT: Ensure the show's end date is in the future or present (excludes historical shows)
    AND shows.end_date >= NOW()
    -- Entry fee filter
    AND (max_entry_fee IS NULL OR entry_fee <= max_entry_fee)
    -- Category filter
    AND (show_categories IS NULL OR shows.categories && show_categories)
    -- Features filter - this is more complex as features are stored as JSONB
    AND (
      show_features IS NULL
      OR (
        CASE WHEN array_length(show_features, 1) > 0 THEN
          -- Check if all requested features exist in the show's features
          (SELECT bool_and(shows.features->feature = 'true')
           FROM unnest(show_features) AS feature)
        ELSE true
        END
      )
    )
  ORDER BY
    ST_Distance(
      coordinates::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;


ALTER FUNCTION "public"."find_filtered_shows"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_filtered_shows"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[]) IS 'Finds shows within a specified radius with additional filtering options.
Parameters:
  center_lat - Latitude of the center point
  center_lng - Longitude of the center point
  radius_miles - Radius in miles
  start_date - Optional minimum start date
  end_date - Optional maximum end date
  max_entry_fee - Optional maximum entry fee
  show_categories - Optional array of categories to filter by
  show_features - Optional array of features to filter by
Returns:
  All columns from the shows table for shows matching the filters,
  ordered by distance (closest first).
  Includes a fix to ensure only current or future shows are returned based on end_date.';



CREATE OR REPLACE FUNCTION "public"."find_filtered_shows"("start_date_filter" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date_filter" timestamp with time zone DEFAULT NULL::timestamp with time zone, "max_entry_fee" numeric DEFAULT NULL::numeric, "show_categories" "text"[] DEFAULT NULL::"text"[], "show_features" "text"[] DEFAULT NULL::"text"[], "center_lat" numeric DEFAULT NULL::numeric, "center_lng" numeric DEFAULT NULL::numeric, "radius_miles" numeric DEFAULT NULL::numeric) RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "title" "text", "description" "text", "start_date" "date", "end_date" "date", "start_time" "text", "end_time" "text", "location" "text", "latitude" numeric, "longitude" numeric, "entry_fee" numeric, "image_url" "text", "website_url" "text", "status" "text", "categories" "text"[], "features" "text"[], "organizer_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.created_at,
        s.title,
        s.description,
        s.start_date,
        s.end_date,
        s.start_time,
        s.end_time,
        s.location,
        ST_Y(s.coordinates::geometry) AS latitude,  -- Extract latitude (Y)
        ST_X(s.coordinates::geometry) AS longitude, -- Extract longitude (X)
        s.entry_fee,
        s.image_url,
        s.website_url,
        s.status,
        s.categories,
        s.features,
        s.organizer_id
    FROM public.shows s
    WHERE
        s.status = 'ACTIVE' AND
        s.start_date <= COALESCE(end_date_filter::date, s.start_date) AND
        s.end_date >= COALESCE(start_date_filter::date, s.end_date) AND
        s.entry_fee <= COALESCE(max_entry_fee, s.entry_fee) AND
        (show_categories IS NULL OR s.categories && show_categories) AND
        (show_features IS NULL OR s.features && show_features) AND
        -- Spatial filter: only apply if center coordinates and radius are provided
        (
            (center_lat IS NULL OR center_lng IS NULL OR radius_miles IS NULL) OR
            ST_DWithin(s.coordinates::geography, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography, radius_miles * 1609.34)
        )
    ORDER BY s.start_date ASC;
END;
$$;


ALTER FUNCTION "public"."find_filtered_shows"("start_date_filter" timestamp with time zone, "end_date_filter" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[], "center_lat" numeric, "center_lng" numeric, "radius_miles" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_shows_with_coordinates"("lat" double precision, "lng" double precision, "radius_miles" double precision) RETURNS TABLE("id" "uuid", "title" "text", "location" "text", "address" "text", "start_date" timestamp with time zone, "end_date" timestamp with time zone, "entry_fee" numeric, "description" "text", "image_url" "text", "rating" numeric, "coordinates" "public"."geography", "status" "text", "organizer_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "features" "jsonb", "categories" "text"[], "latitude" double precision, "longitude" double precision, "distance_miles" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    s.*,
    -- Extract latitude from the geography point
    public.ST_Y_Float8(s.coordinates) AS latitude,
    -- Extract longitude from the geography point
    public.ST_X_Float8(s.coordinates) AS longitude,
    -- Calculate the distance in miles (convert meters to miles)
    ST_Distance(
      s.coordinates,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1609.34 AS distance_miles
  FROM 
    public.shows s
  WHERE 
    -- Find shows within the specified radius
    ST_DWithin(
      s.coordinates,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.34 -- Convert miles to meters for ST_DWithin
    )
  ORDER BY 
    distance_miles ASC;
$$;


ALTER FUNCTION "public"."find_shows_with_coordinates"("lat" double precision, "lng" double precision, "radius_miles" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_shows_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) RETURNS SETOF "public"."shows"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.shows
  WHERE ST_DWithin(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_miles * 1609.34  -- Convert miles to meters
  )
  AND status = 'ACTIVE'  -- Only return active shows by default
  ORDER BY 
    ST_Distance(
      coordinates::geography, 
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;


ALTER FUNCTION "public"."find_shows_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_shows_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) IS 'Finds shows within a specified radius (in miles) from a center point.
Parameters:
  center_lat - Latitude of the center point
  center_lng - Longitude of the center point
  radius_miles - Radius in miles
Returns:
  All columns from the shows table for shows within the specified radius,
  ordered by distance (closest first).';



CREATE OR REPLACE FUNCTION "public"."fix_show_coordinates"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update shows with NULL coordinates to use a default value
  UPDATE public.shows
  SET coordinates = ST_SetSRID(ST_MakePoint(-85.925938, 40.0772001), 4326)::geography
  WHERE coordinates IS NULL;
  
  -- Log the update
  RAISE NOTICE 'Updated coordinates for shows with NULL coordinates';
END;
$$;


ALTER FUNCTION "public"."fix_show_coordinates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_show_coordinates"("show_id" "uuid", "new_latitude" double precision, "new_longitude" double precision, "admin_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  issue_exists BOOLEAN;
BEGIN
  -- First, check if the issue exists
  SELECT EXISTS(
    SELECT 1 FROM coordinate_issues 
    WHERE show_id = fix_show_coordinates.show_id AND resolved_at IS NULL
  ) INTO issue_exists;
  
  -- If no issue exists, return false
  IF NOT issue_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Validate the new coordinates
  IF new_latitude IS NULL OR new_longitude IS NULL OR
     new_latitude < -90 OR new_latitude > 90 OR
     new_longitude < -180 OR new_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates provided: lat=%, lng=%', new_latitude, new_longitude;
  END IF;
  
  -- Update the show coordinates using PostGIS function to create geography point
  -- ST_SetSRID(ST_Point(longitude, latitude), 4326)::geography creates a proper geography point
  UPDATE shows
  SET coordinates = ST_SetSRID(ST_Point(new_longitude, new_latitude), 4326)::geography
  WHERE id = show_id;
  
  -- Mark the issue as resolved
  UPDATE coordinate_issues
  SET 
    resolved_at = NOW(),
    resolved_by = admin_user_id
  WHERE 
    show_id = fix_show_coordinates.show_id AND 
    resolved_at IS NULL;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."fix_show_coordinates"("show_id" "uuid", "new_latitude" double precision, "new_longitude" double precision, "admin_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fix_show_coordinates"("show_id" "uuid", "new_latitude" double precision, "new_longitude" double precision, "admin_user_id" "uuid") IS 'Fixes show coordinates using PostGIS functions and marks the issue as resolved.';



CREATE OR REPLACE FUNCTION "public"."get_accessible_want_lists"("viewer_id" "uuid") RETURNS TABLE("want_list_id" "uuid", "attendee_id" "uuid", "attendee_name" "text", "show_id" "uuid", "show_title" "text", "content" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the viewer's role
  SELECT role INTO user_role FROM profiles WHERE id = viewer_id;
  
  -- Return different results based on role
  IF user_role = 'mvp_dealer' THEN
    -- For MVP dealers: return want lists for attendees of shows they participate in
    RETURN QUERY
      SELECT 
        wl.id as want_list_id,
        wl.userid as attendee_id,
        (p.first_name || ' ' || COALESCE(p.last_name, '')) as attendee_name,
        ufs.show_id,
        s.title as show_title,
        wl.content,
        wl.updatedat as updated_at
      FROM want_lists wl
      JOIN profiles p ON wl.userid = p.id
      JOIN user_favorite_shows ufs ON wl.userid = ufs.user_id
      JOIN shows s ON ufs.show_id = s.id
      JOIN show_participants sp ON ufs.show_id = sp.showid
      WHERE 
        sp.userid = viewer_id
        AND p.role IN ('attendee', 'dealer')
        AND NOT wl.content ILIKE '[INVENTORY]%'
        AND wl.content IS NOT NULL
        AND wl.content <> ''
        AND s.start_date >= CURRENT_DATE;
        
  ELSIF user_role = 'show_organizer' THEN
    -- For show organizers: return want lists for attendees of shows they organize
    RETURN QUERY
      SELECT 
        wl.id as want_list_id,
        wl.userid as attendee_id,
        (p.first_name || ' ' || COALESCE(p.last_name, '')) as attendee_name,
        ufs.show_id,
        s.title as show_title,
        wl.content,
        wl.updatedat as updated_at
      FROM want_lists wl
      JOIN profiles p ON wl.userid = p.id
      JOIN user_favorite_shows ufs ON wl.userid = ufs.user_id
      JOIN shows s ON ufs.show_id = s.id
      WHERE 
        s.organizer_id = viewer_id
        AND p.role IN ('attendee', 'dealer')
        AND NOT wl.content ILIKE '[INVENTORY]%'
        AND wl.content IS NOT NULL
        AND wl.content <> ''
        AND s.start_date >= CURRENT_DATE;
  ELSE
    -- Other roles only see their own want lists, return empty result
    RETURN QUERY
      SELECT 
        NULL::UUID as want_list_id,
        NULL::UUID as attendee_id,
        NULL::TEXT as attendee_name,
        NULL::UUID as show_id,
        NULL::TEXT as show_title,
        NULL::TEXT as content,
        NULL::TIMESTAMPTZ as updated_at
      WHERE FALSE;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_accessible_want_lists"("viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_shows_with_coordinates"() RETURNS TABLE("id" "uuid", "title" "text", "location" "text", "address" "text", "start_date" timestamp with time zone, "end_date" timestamp with time zone, "entry_fee" numeric, "description" "text", "image_url" "text", "rating" numeric, "coordinates" "public"."geography", "status" "text", "organizer_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "features" "jsonb", "categories" "text"[], "latitude" double precision, "longitude" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    s.*,
    -- Extract latitude from the geography point
    public.ST_Y_Float8(s.coordinates) AS latitude,
    -- Extract longitude from the geography point
    public.ST_X_Float8(s.coordinates) AS longitude
  FROM 
    public.shows s
  WHERE
    s.coordinates IS NOT NULL
  ORDER BY 
    s.start_date ASC;
$$;


ALTER FUNCTION "public"."get_all_shows_with_coordinates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_messages"("conversation_id" "uuid", "page_size" integer DEFAULT 20, "page" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_conversation_messages"("conversation_id" "uuid", "page_size" integer, "page" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conversation_messages"("conversation_id" "uuid", "page_size" integer, "page" integer) IS 'Retrieves messages for a specific conversation with pagination.
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



CREATE OR REPLACE FUNCTION "public"."get_conversations"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_conversations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_conversations"() IS 'Retrieves all conversations for the current user, including unread message counts.
Orders conversations by most recent message first.

Returns:
  A JSONB object containing:
  - data: Array of conversation objects with metadata and unread counts
  - error: Error message if unsuccessful';



CREATE OR REPLACE FUNCTION "public"."get_paginated_shows"("lat" double precision, "lng" double precision, "radius_miles" double precision DEFAULT 25, "start_date" timestamp with time zone DEFAULT CURRENT_DATE, "end_date" timestamp with time zone DEFAULT (CURRENT_DATE + '30 days'::interval), "max_entry_fee" numeric DEFAULT NULL::numeric, "categories" "text"[] DEFAULT NULL::"text"[], "features" "jsonb" DEFAULT NULL::"jsonb", "page_size" integer DEFAULT 20, "page" integer DEFAULT 1, "status" "text" DEFAULT 'ACTIVE'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    s.end_date >= CURRENT_DATE AND
    s.start_date <= get_paginated_shows.end_date AND
    s.coordinates IS NOT NULL AND
    ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography,
      get_paginated_shows.radius_miles * 1609.34
    ) AND
    s.status = get_paginated_shows.status AND
    (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee) AND
    (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories) AND
    (get_paginated_shows.features IS NULL OR (s.features @> get_paginated_shows.features));

  -- Get the paginated results using a WITH clause (FIXED: No more GROUP BY)
  WITH filtered_ordered_shows AS (
    SELECT 
      s.id,
      s.series_id,
      s.title,
      s.description,
      s.location,
      s.address,
      s.start_date,
      s.end_date,
      s.entry_fee,
      s.image_url,
      s.rating,
      s.coordinates,
      s.status,
      s.organizer_id,
      s.features,
      s.categories,
      s.created_at,
      s.updated_at,
      ST_Y(s.coordinates::geometry) AS latitude,
      ST_X(s.coordinates::geometry) AS longitude,
      ST_Distance(
        s.coordinates::geography,
        ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography
      ) / 1609.34 AS distance_miles
    FROM public.shows s
    WHERE
      s.end_date >= CURRENT_DATE AND
      s.start_date <= get_paginated_shows.end_date AND
      s.coordinates IS NOT NULL AND
      ST_DWithin(
        s.coordinates::geography,
        ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography,
        get_paginated_shows.radius_miles * 1609.34
      ) AND
      s.status = get_paginated_shows.status AND
      (get_paginated_shows.max_entry_fee IS NULL OR s.entry_fee <= get_paginated_shows.max_entry_fee) AND
      (get_paginated_shows.categories IS NULL OR s.categories && get_paginated_shows.categories) AND
      (get_paginated_shows.features IS NULL OR (s.features @> get_paginated_shows.features))
    ORDER BY 
      s.start_date ASC,
      ST_Distance(
        s.coordinates::geography, 
        ST_SetSRID(ST_MakePoint(get_paginated_shows.lng, get_paginated_shows.lat), 4326)::geography
      ) ASC
    LIMIT get_paginated_shows.page_size
    OFFSET offset_val
  )
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
        'latitude', s.latitude,
        'longitude', s.longitude,
        'distance_miles', s.distance_miles
      )
    ) INTO shows_data
  FROM filtered_ordered_shows s;
  
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
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."get_paginated_shows"("lat" double precision, "lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "categories" "text"[], "features" "jsonb", "page_size" integer, "page" integer, "status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_series_review_stats"("p_series_id" "uuid") RETURNS TABLE("average_rating" numeric, "total_reviews" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(AVG(r.rating)::NUMERIC(3,2), 0) as average_rating,
        COUNT(r.id) as total_reviews
    FROM public.reviews r
    WHERE r.series_id = p_series_id;
END;
$$;


ALTER FUNCTION "public"."get_series_review_stats"("p_series_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_series_review_stats"("p_series_id" "uuid") IS 'Function to calculate the average rating and total review count for a series';



CREATE OR REPLACE FUNCTION "public"."get_show_details_by_id"("show_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_show_details_by_id"("show_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_show_details_by_id"("show_id" "uuid") IS 'Gets detailed information about a show including organizer and participating dealers (now including show organizers who register as dealers)';



CREATE OR REPLACE FUNCTION "public"."get_show_with_coordinates"("show_id" "uuid") RETURNS TABLE("id" "uuid", "title" "text", "location" "text", "address" "text", "start_date" timestamp with time zone, "end_date" timestamp with time zone, "entry_fee" numeric, "description" "text", "image_url" "text", "rating" numeric, "coordinates" "public"."geography", "status" "text", "organizer_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "features" "jsonb", "categories" "text"[], "latitude" double precision, "longitude" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    s.*,
    -- Extract latitude from the geography point
    public.ST_Y_Float8(s.coordinates) AS latitude,
    -- Extract longitude from the geography point
    public.ST_X_Float8(s.coordinates) AS longitude
  FROM 
    public.shows s
  WHERE
    s.id = show_id;
$$;


ALTER FUNCTION "public"."get_show_with_coordinates"("show_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shows_with_coordinate_issues"("page_number" integer DEFAULT 1, "page_size" integer DEFAULT 10) RETURNS TABLE("issue_id" "uuid", "show_id" "uuid", "show_title" "text", "latitude" double precision, "longitude" double precision, "issue_type" "text", "created_at" timestamp with time zone, "resolved_at" timestamp with time zone, "resolved_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id AS issue_id,
    ci.show_id,
    s.title AS show_title,
    ci.latitude,
    ci.longitude,
    ci.issue_type,
    ci.created_at,
    ci.resolved_at,
    ci.resolved_by
  FROM 
    coordinate_issues ci
  JOIN 
    shows s ON ci.show_id = s.id
  WHERE 
    ci.resolved_at IS NULL
  ORDER BY 
    ci.created_at DESC
  LIMIT 
    page_size
  OFFSET 
    (page_number - 1) * page_size;
END;
$$;


ALTER FUNCTION "public"."get_shows_with_coordinate_issues"("page_number" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_conversations"("input_user_id" "uuid") RETURNS TABLE("id" "uuid", "type" "text", "show_id" "uuid", "participant_count" integer, "last_message_text" "text", "last_message_timestamp" timestamp with time zone, "unread_count" integer, "participants" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    -- Get all conversations the user is part of
    SELECT 
      c.id,
      c.type,
      c.show_id,
      c.last_message_text,
      c.last_message_timestamp,
      cp.unread_count
    FROM 
      conversations c
    JOIN 
      conversation_participants cp ON c.id = cp.conversation_id
    WHERE 
      cp.user_id = input_user_id
  ),
  participants_data AS (
    -- Get all other participants (excluding the requesting user)
    SELECT 
      conv_part.conversation_id,
      COUNT(conv_part.user_id) + 1 AS participant_count, -- +1 to include the requesting user
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'user_id', conv_part.user_id,
          'display_name', COALESCE(conv_part.display_name, prof.full_name, prof.username),
          'photo_url', COALESCE(conv_part.photo_url, prof.avatar_url)
        )
      ) FILTER (WHERE conv_part.user_id != input_user_id) AS participants_json
    FROM 
      conversation_participants conv_part
    LEFT JOIN
      profiles prof ON conv_part.user_id = prof.id
    GROUP BY 
      conv_part.conversation_id
  )
  
  SELECT 
    uc.id,
    uc.type,
    uc.show_id,
    COALESCE(pd.participant_count, 1) AS participant_count,
    uc.last_message_text,
    uc.last_message_timestamp,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(pd.participants_json, '[]'::JSONB) AS participants
  FROM 
    user_conversations uc
  LEFT JOIN
    participants_data pd ON uc.id = pd.conversation_id
  ORDER BY 
    uc.last_message_timestamp DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_user_conversations"("input_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_conversations"("input_user_id" "uuid") IS 'Efficiently fetches all conversations for a user with participants and unread counts';



CREATE OR REPLACE FUNCTION "public"."get_want_list_matches_for_dealer"("p_dealer_id" "uuid", "p_show_id" "uuid") RETURNS TABLE("want_list_id" "uuid", "attendee_id" "uuid", "attendee_username" "text", "want_list_content" "text", "matched_inventory_item_id" "uuid", "matched_inventory_item_title" "text", "match_type" "text", "match_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_dealer_role TEXT;
BEGIN
    -- Step 1: Verify the requesting user is an MVP Dealer. This is a critical security check.
    SELECT role INTO v_dealer_role
    FROM public.profiles
    WHERE id = p_dealer_id;

    -- Check for both uppercase and lowercase roles for resilience
    IF lower(v_dealer_role) != 'mvp_dealer' THEN
        RAISE EXCEPTION 'ACCESS_DENIED: User must be an MVP_DEALER to access want list matches.';
    END IF;

    -- Step 2: Return the query that performs the matching logic.
    RETURN QUERY
    WITH
    dealer_inventory AS (
        -- CTE to select all inventory items for the specified dealer and pre-process titles for searching.
        SELECT
            id,
            title,
            category,
            -- Creates a tsquery for 'all words' matching (e.g., '2018 & Topps & Trout').
            plainto_tsquery('english', title) as title_tsquery_all,
            -- Creates a tsquery for 'any word' matching (e.g., '2018 | Topps | Trout').
            websearch_to_tsquery('english', title) as title_tsquery_any
        FROM public.dealer_inventory_items
        WHERE user_id = p_dealer_id
    ),
    show_want_lists AS (
        -- CTE to get all want lists shared for the specified show, along with attendee info and a tsvector.
        SELECT
            wl.id as list_id,
            wl.userid as attendee_uid,
            p.username as att_username,
            wl.content,
            to_tsvector('english', wl.content) as content_tsv
        FROM public.shared_want_lists swl
        JOIN public.want_lists wl ON swl.wantlistid = wl.id
        JOIN public.profiles p ON wl.userid = p.id
        WHERE swl.showid = p_show_id
    ),
    all_matches AS (
        -- This CTE performs matching using different techniques and assigns a score.
        -- We use UNION ALL to combine results from different matching strategies.

        -- Strategy 1: Exact Title Match (Highest Priority)
        -- Checks if the dealer's inventory title appears exactly (case-insensitive) in the want list content.
        SELECT
            swl.list_id,
            swl.attendee_uid,
            swl.att_username,
            swl.content,
            di.id as inventory_id,
            di.title as inventory_title,
            'exact_title'::TEXT as match_type,
            1.0::NUMERIC as score
        FROM show_want_lists swl
        JOIN dealer_inventory di ON swl.content ILIKE '%' || di.title || '%'

        UNION ALL

        -- Strategy 2: All Keywords Match (High Priority)
        -- Checks if all keywords from the inventory title are present in the want list.
        SELECT
            swl.list_id,
            swl.attendee_uid,
            swl.att_username,
            swl.content,
            di.id,
            di.title,
            'all_keywords'::TEXT,
            -- Score is based on the ranking from full-text search.
            ts_rank(swl.content_tsv, di.title_tsquery_all)::NUMERIC as score
        FROM show_want_lists swl
        JOIN dealer_inventory di ON swl.content_tsv @@ di.title_tsquery_all

        UNION ALL

        -- Strategy 3: Any Keywords Match (Medium Priority)
        -- Checks if any keywords from the inventory title are present in the want list.
        SELECT
            swl.list_id,
            swl.attendee_uid,
            swl.att_username,
            swl.content,
            di.id,
            di.title,
            'any_keyword'::TEXT,
            ts_rank(swl.content_tsv, di.title_tsquery_any)::NUMERIC as score
        FROM show_want_lists swl
        JOIN dealer_inventory di ON swl.content_tsv @@ di.title_tsquery_any

        UNION ALL

        -- Strategy 4: Category Match (Lower Priority)
        -- Checks if the inventory item's category is mentioned in the want list content.
        SELECT
            swl.list_id,
            swl.attendee_uid,
            swl.att_username,
            swl.content,
            di.id,
            di.title,
            'category_match'::TEXT,
            0.1::NUMERIC as score -- Assign a low, fixed score for category matches
        FROM show_want_lists swl
        JOIN dealer_inventory di ON di.category IS NOT NULL AND swl.content ILIKE '%' || di.category || '%'
    ),
    ranked_matches AS (
        -- De-duplicate the matches, picking only the best match type for each
        -- want_list / inventory_item pair by ranking them based on score.
        SELECT
            *,
            ROW_NUMBER() OVER(PARTITION BY list_id, inventory_id ORDER BY score DESC) as rn
        FROM all_matches
    )
    -- Final selection of the best-ranked matches.
    SELECT
        rm.list_id,
        rm.attendee_uid,
        rm.att_username,
        rm.content,
        rm.inventory_id,
        rm.inventory_title,
        rm.match_type,
        rm.score
    FROM ranked_matches rm
    WHERE rm.rn = 1
    ORDER BY rm.list_id, rm.score DESC;

END;
$$;


ALTER FUNCTION "public"."get_want_list_matches_for_dealer"("p_dealer_id" "uuid", "p_show_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_want_list_matches_for_dealer"("p_dealer_id" "uuid", "p_show_id" "uuid") IS 'Aggregates want lists for a given show and matches them against an MVP dealer''s inventory.
Requires the dealer to have the ''MVP_DEALER'' role.
Matches are scored and ranked based on type: exact_title > all_keywords > any_keyword > category_match.
Limitations: Matching is based on free-text and is not guaranteed to be perfectly accurate.';



CREATE OR REPLACE FUNCTION "public"."handle_dealer_profile_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_dealer_profile_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  _initial_role text;
  _initial_account_type text;
begin
  -- Get the role from the new user's metadata
  _initial_role := new.raw_user_meta_data->>'role';

  -- Determine initial account_type based on the role provided during sign-up
  if _initial_role = 'dealer' or _initial_role = 'mvp_dealer' then
    _initial_account_type := 'dealer';
  elsif _initial_role = 'show_organizer' then
    _initial_account_type := 'organizer';
  else -- default to collector for 'attendee' or any unexpected role
    _initial_account_type := 'collector';
  end if;

  -- Insert the new profile, now including the calculated initial_account_type
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    home_zip_code,
    role, -- Initial role from signup metadata
    account_type -- Initial account_type based on role
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'firstName',
    new.raw_user_meta_data->>'lastName',
    new.raw_user_meta_data->>'homeZipCode',
    _initial_role,
    _initial_account_type
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_unread"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN LEAST(COALESCE(NEW.unread_count, 0) + 1, 999);  -- Cap at 999
END;
$$;


ALTER FUNCTION "public"."increment_unread"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_scraper_agent"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform net.http_post(
    url:='https://zmfqzegykwyrrvrpwylf.supabase.co/functions/v1/scraper-agent',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SERVICE_ROLE_KEY')
    )
  );
  return 'Function invoked';
end;
$$;


ALTER FUNCTION "public"."invoke_scraper_agent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'Checks if the current user has admin role';



CREATE OR REPLACE FUNCTION "public"."is_any_dealer"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (LOWER(role) = 'dealer' OR LOWER(role) = 'mvp_dealer')
  );
END;
$$;


ALTER FUNCTION "public"."is_any_dealer"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_any_dealer"() IS 'Checks if the current user has either dealer or mvp_dealer role';



CREATE OR REPLACE FUNCTION "public"."is_dealer"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'dealer'
  );
END;
$$;


ALTER FUNCTION "public"."is_dealer"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_dealer"() IS 'Checks if the current user has dealer role';



CREATE OR REPLACE FUNCTION "public"."is_mvp_dealer"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'mvp_dealer'
  );
END;
$$;


ALTER FUNCTION "public"."is_mvp_dealer"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_mvp_dealer"() IS 'Checks if the current user has mvp_dealer role';



CREATE OR REPLACE FUNCTION "public"."is_series_organizer"("p_series_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.show_series s
        WHERE 
            s.id = p_series_id
            AND s.organizer_id = p_user_id
    );
END;
$$;


ALTER FUNCTION "public"."is_series_organizer"("p_series_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_series_organizer"("p_series_id" "uuid", "p_user_id" "uuid") IS 'Function to check if a user is the organizer for a specific show series';



CREATE OR REPLACE FUNCTION "public"."is_series_organizer_for_review"("review_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    series_organizer_id UUID;
BEGIN
    SELECT s.organizer_id INTO series_organizer_id
    FROM public.reviews r
    JOIN public.show_series s ON r.series_id = s.id
    WHERE r.id = review_id;
    
    RETURN auth.uid() = series_organizer_id;
END;
$$;


ALTER FUNCTION "public"."is_series_organizer_for_review"("review_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_show_organizer"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND LOWER(role) = 'show_organizer'
  );
END;
$$;


ALTER FUNCTION "public"."is_show_organizer"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_show_organizer"() IS 'Checks if the current user has show_organizer role';



CREATE OR REPLACE FUNCTION "public"."log_null_coordinates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  lat DOUBLE PRECISION;
  lng DOUBLE PRECISION;
  is_valid BOOLEAN;
BEGIN
  -- Step 3: Handle null geography values properly
  IF NEW.coordinates IS NULL THEN
    -- Log the issue for null coordinates
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      NULL,
      NULL,
      'NULL_COORDINATES'
    );
    RETURN NEW;
  END IF;
  
  -- Step 4: Use PostGIS functions to extract coordinates from geography type
  -- Convert geography to geometry to extract coordinates
  -- ST_X gets longitude, ST_Y gets latitude from a point geometry
  BEGIN
    -- Convert to geometry first (geography to geometry conversion is needed for ST_X/ST_Y)
    lng := ST_X(NEW.coordinates::geometry);
    lat := ST_Y(NEW.coordinates::geometry);
    
    -- Check if extraction succeeded
    is_valid := true;
  EXCEPTION WHEN OTHERS THEN
    -- If conversion fails, log the error
    is_valid := false;
    
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      NULL,
      NULL,
      'INVALID_GEOMETRY'
    );
    
    RETURN NEW;
  END;
  
  -- Step 5: Validate coordinates using PostGIS functions
  -- Check if coordinates are valid (within proper ranges)
  IF lat IS NULL OR lng IS NULL OR 
     lat < -90 OR lat > 90 OR 
     lng < -180 OR lng > 180 THEN
    
    -- Log the issue for invalid coordinates
    INSERT INTO coordinate_issues (
      show_id, 
      latitude, 
      longitude, 
      issue_type
    ) VALUES (
      NEW.id,
      lat,
      lng,
      'INVALID_COORDINATES'
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_null_coordinates"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_null_coordinates"() IS 'Logs shows with null or invalid coordinates using PostGIS functions. Fixed to work with geography type instead of JSON.';



CREATE OR REPLACE FUNCTION "public"."log_rls_change"("action" "text", "object_type" "text", "object_name" "text", "details" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE NOTICE '% % %: %', action, object_type, object_name, COALESCE(details, '');
END;
$$;


ALTER FUNCTION "public"."log_rls_change"("action" "text", "object_type" "text", "object_name" "text", "details" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manually_sync_all_user_roles"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- This helper triggers the sync function for all existing users.
  UPDATE public.profiles SET updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."manually_sync_all_user_roles"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."manually_sync_all_user_roles"() IS 'A utility function to update all user roles by triggering the sync logic. Useful for a one-time data backfill.';



CREATE OR REPLACE FUNCTION "public"."messages_update_conversation_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update conversation's last message info
  UPDATE conversations
  SET 
    last_message_text = NEW.message_text,
    last_message_timestamp = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  -- Increment unread count for all participants except sender
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE 
    conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND unread_count < 999;  -- Cap at 999
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."messages_update_conversation_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moderate_delete_message"("p_message_id" "uuid", "p_moderator_id" "uuid", "p_reason" "text" DEFAULT 'Content violation'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_moderator_role TEXT;
  v_message_sender_id UUID;
  v_conversation_id UUID;
BEGIN
  -- Check if moderator has permission
  SELECT LOWER(role) INTO v_moderator_role FROM profiles WHERE id = p_moderator_id;
  
  IF v_moderator_role NOT IN ('show_organizer', 'admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Get message details
  SELECT sender_id, conversation_id INTO v_message_sender_id, v_conversation_id
  FROM messages
  WHERE id = p_message_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Show organizers can only moderate messages in their own shows
  IF v_moderator_role = 'show_organizer' AND NOT EXISTS(
    SELECT 1 
    FROM conversations c
    JOIN shows s ON c.show_id = s.id
    WHERE c.id = v_conversation_id AND s.organizer_id = p_moderator_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Perform soft delete
  UPDATE messages
  SET 
    is_deleted = TRUE,
    deleted_by = p_moderator_id,
    deleted_at = now(),
    deletion_reason = p_reason
  WHERE id = p_message_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."moderate_delete_message"("p_message_id" "uuid", "p_moderator_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision) RETURNS TABLE("id" integer, "name" "text", "date" timestamp without time zone, "start_time" time without time zone, "end_time" time without time zone, "address" "text", "city" "text", "state" "text", "zip_code" "text", "description" "text", "image_url" "text", "organizer_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "latitude" double precision, "longitude" double precision, "status" "text", "distance_miles" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.date,
        s.start_time,
        s.end_time,
        s.address,
        s.city,
        s.state,
        s.zip_code,
        s.description,
        s.image_url,
        s.organizer_id,
        s.created_at,
        s.updated_at,
        s.latitude,
        s.longitude,
        s.status,
        (point(s.longitude, s.latitude) <@> point(long, lat)) * 1.60934 AS distance_miles
    FROM
        shows s
    WHERE
        (point(s.longitude, s.latitude) <@> point(long, lat)) * 1.60934 < radius_miles
        AND s.date >= now()
        AND s.date <= now() + interval '30 days';
END;
$$;


ALTER FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision DEFAULT 25, "start_date" timestamp with time zone DEFAULT CURRENT_DATE, "end_date" timestamp with time zone DEFAULT (CURRENT_DATE + '30 days'::interval)) RETURNS TABLE("id" "uuid", "series_id" "uuid", "title" "text", "description" "text", "location" "text", "address" "text", "start_date" timestamp with time zone, "end_date" timestamp with time zone, "entry_fee" numeric, "image_url" "text", "rating" numeric, "coordinates" "public"."geometry", "status" "text", "organizer_id" "uuid", "features" "jsonb", "categories" "text"[], "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "latitude" double precision, "longitude" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
SELECT
    s.id, s.series_id, s.title, s.description, s.location, s.address, s.start_date,
    s.end_date, s.entry_fee, s.image_url, s.rating,
    s.coordinates::geometry, -- Explicitly cast back to geometry
    s.status,
    s.organizer_id, s.features, s.categories, s.created_at, s.updated_at,
    ST_Y(s.coordinates::geometry) as latitude,
    ST_X(s.coordinates::geometry) as longitude
FROM public.shows s
WHERE
    s.start_date >= start_date AND
    s.start_date <= end_date AND
    ST_DWithin(
        s.coordinates::geography,
        ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography,
        radius_miles * 1609.34
    ) AND
    s.status = 'ACTIVE'
ORDER BY
    ST_Distance(
        s.coordinates::geography,
        ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography
    ) ASC;
$$;


ALTER FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) IS 'Finds shows within a specified radius (in miles) from a center point. Returns all columns from the shows table plus extracted latitude and longitude, ordered by distance.';



CREATE OR REPLACE FUNCTION "public"."nearby_shows_earth_distance"("lat" double precision, "long" double precision, "radius_miles" double precision DEFAULT 25, "start_date" timestamp with time zone DEFAULT CURRENT_DATE, "end_date" timestamp with time zone DEFAULT (CURRENT_DATE + '30 days'::interval)) RETURNS TABLE("id" "uuid", "series_id" "uuid", "title" "text", "description" "text", "location" "text", "address" "text", "start_date" timestamp with time zone, "end_date" timestamp with time zone, "entry_fee" numeric, "image_url" "text", "rating" numeric, "coordinates" "public"."geometry", "status" "text", "organizer_id" "uuid", "features" "jsonb", "categories" "text"[], "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "latitude" double precision, "longitude" double precision)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
SELECT
    s.id, s.series_id, s.title, s.description, s.location, s.address, s.start_date,
    s.end_date, s.entry_fee, s.image_url, s.rating,
    s.coordinates::geometry, -- Explicitly cast back to geometry
    s.status,
    s.organizer_id, s.features, s.categories, s.created_at, s.updated_at,
    ST_Y(s.coordinates::geometry) as latitude,
    ST_X(s.coordinates::geometry) as longitude
FROM public.shows s
WHERE
    s.start_date >= start_date AND
    s.start_date <= end_date AND
    earth_distance(
        ll_to_earth(ST_Y(s.coordinates::geometry), ST_X(s.coordinates::geometry)),
        ll_to_earth(lat, long)
    ) <= radius_miles * 1609.34 AND
    s.status = 'ACTIVE'
ORDER BY
    earth_distance(
        ll_to_earth(ST_Y(s.coordinates::geometry), ST_X(s.coordinates::geometry)),
        ll_to_earth(lat, long)
    ) ASC;
$$;


ALTER FUNCTION "public"."nearby_shows_earth_distance"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."nearby_shows_earth_distance"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) IS 'Alternative implementation using cube/earthdistance extensions. Finds shows within a specified radius (in miles) from a center point, ordered by distance.';



CREATE OR REPLACE FUNCTION "public"."organizes_show"("show_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM shows
    WHERE id = show_id AND organizer_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."organizes_show"("show_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."organizes_show"("show_id" "uuid") IS 'Checks if the current user organizes a specific show';



CREATE OR REPLACE FUNCTION "public"."participates_in_conversation"("conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conversation_id AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."participates_in_conversation"("conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."participates_in_show"("show_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM show_participants
    WHERE userid = auth.uid() AND showid = show_id
  );
END;
$$;


ALTER FUNCTION "public"."participates_in_show"("show_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."participates_in_show"("show_id" "uuid") IS 'Checks if the current user participates in a specific show';



CREATE OR REPLACE FUNCTION "public"."participates_in_show_safe"("showid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."participates_in_show_safe"("showid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."participates_in_show_safe"("showid" "uuid") IS 'Safely checks if a user participates in a show without recursive queries';



CREATE OR REPLACE FUNCTION "public"."process_and_load_shows"() RETURNS TABLE("processed_count" integer, "error_count" integer)
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    raw_record RECORD;
    json_text TEXT;
    shows_array jsonb;
    show_item jsonb;
    p_processed_count INT := 0;
    p_error_count INT := 0;
BEGIN
    FOR raw_record IN SELECT * FROM public.raw_ai_responses LOOP
        BEGIN
            -- Find the start and end of the JSON array '[...]'
            json_text := substring(raw_record.ai_response_text from '\[.*\]');

            -- If a JSON array is found, process it
            IF json_text IS NOT NULL THEN
                shows_array := json_text::jsonb;

                FOR show_item IN SELECT * FROM jsonb_array_elements(shows_array) LOOP
                    BEGIN
                        -- Insert into the shows table, handling potential nulls
                        -- The COALESCE function provides a default value if a field is null
                        -- The NULLIF function converts empty strings '' to NULL
                        INSERT INTO public.shows (name, start_date, end_date, venue_name, city, state, url)
                        SELECT
                            NULLIF(trim(show_item->>'name'), ''),
                            (show_item->>'startDate')::DATE,
                            (show_item->>'endDate')::DATE,
                            NULLIF(trim(show_item->>'venueName'), ''),
                            NULLIF(trim(show_item->>'city'), ''),
                            NULLIF(upper(trim(show_item->>'state')), ''),
                            NULLIF(trim(show_item->>'url'), '')
                        -- This is the key: only process if the row has a name and a valid start date
                        WHERE NULLIF(trim(show_item->>'name'), '') IS NOT NULL
                          AND (show_item->>'startDate') IS NOT NULL
                          AND (show_item->>'startDate')::text ~ '^\d{4}-\d{2}-\d{2}$'
                        ON CONFLICT (name, start_date, city)
                        DO UPDATE SET
                          end_date = EXCLUDED.end_date,
                          venue_name = EXCLUDED.venue_name,
                          state = EXCLUDED.state,
                          url = EXCLUDED.url;

                        -- If the insert was successful, increment the counter
                        IF FOUND THEN
                            p_processed_count := p_processed_count + 1;
                        ELSE
                            p_error_count := p_error_count + 1;
                        END IF;
                    EXCEPTION
                        -- Catch errors for individual show items (e.g., bad date format)
                        WHEN others THEN
                            p_error_count := p_error_count + 1;
                    END;
                END LOOP;
            ELSE
                -- Could not find a JSON array in the text
                p_error_count := p_error_count + 1;
            END IF;
        EXCEPTION
            -- Catch errors for the entire raw record (e.g., malformed JSON)
            WHEN others THEN
                p_error_count := p_error_count + 1;
        END;
    END LOOP;

    -- Now, we can safely delete the processed records from the holding table
    DELETE FROM public.raw_ai_responses;

    RETURN QUERY SELECT p_processed_count, p_error_count;
END;
$_$;


ALTER FUNCTION "public"."process_and_load_shows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if favorite exists
  IF NOT EXISTS (SELECT 1 FROM public.user_favorite_shows WHERE user_id = p_user_id AND show_id = p_show_id) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Favorite not found'
    );
  END IF;
  
  -- Remove the favorite
  BEGIN
    DELETE FROM public.user_favorite_shows
    WHERE user_id = p_user_id AND show_id = p_show_id;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Show unfavorited successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
  END;
END;
$$;


ALTER FUNCTION "public"."remove_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_message"("p_message_id" "uuid", "p_reporter_id" "uuid", "p_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Ensure message exists
  IF NOT EXISTS(SELECT 1 FROM messages WHERE id = p_message_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure reporter is a participant in the conversation
  IF NOT EXISTS(
    SELECT 1 
    FROM messages m
    JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
    WHERE m.id = p_message_id AND cp.user_id = p_reporter_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Create report
  INSERT INTO reported_messages (
    message_id,
    reported_by,
    report_reason
  )
  VALUES (
    p_message_id,
    p_reporter_id,
    p_reason
  );
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."report_message"("p_message_id" "uuid", "p_reporter_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_show_broadcast_quotas"("p_organizer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Reset the broadcast quotas to their default values
    UPDATE public.profiles
    SET 
        pre_show_broadcasts_remaining = 2,
        post_show_broadcasts_remaining = 1
    WHERE id = p_organizer_id;
END;
$$;


ALTER FUNCTION "public"."reset_show_broadcast_quotas"("p_organizer_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_show_broadcast_quotas"("p_organizer_id" "uuid") IS 'Function to reset the broadcast quotas for a show organizer';



CREATE OR REPLACE FUNCTION "public"."safe_drop_policy"("policy_name" "text", "table_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."safe_drop_policy"("policy_name" "text", "table_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."safe_drop_policy"("policy_name" "text", "table_name" "text") IS 'Safely drops a policy if it exists, with error handling';



CREATE OR REPLACE FUNCTION "public"."send_broadcast_message"("p_series_id" "uuid", "p_show_id" "uuid", "p_organizer_id" "uuid", "p_message" "text", "p_broadcast_type" "text", "p_recipients" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    organizer_role TEXT;
    is_organizer BOOLEAN;
    quota_remaining INTEGER;
    result JSONB;
BEGIN
    -- Check if the organizer has the SHOW_ORGANIZER role
    SELECT role INTO organizer_role
    FROM public.profiles
    WHERE id = p_organizer_id;
    
    IF organizer_role != 'SHOW_ORGANIZER' THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Only users with SHOW_ORGANIZER role can send broadcasts',
            'code', 'INSUFFICIENT_PERMISSIONS'
        );
        RETURN result;
    END IF;
    
    -- Check if the user is the organizer for this series
    SELECT public.is_series_organizer(p_series_id, p_organizer_id) INTO is_organizer;
    
    IF NOT is_organizer THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'You can only send broadcasts for series you organize',
            'code', 'NOT_SERIES_ORGANIZER'
        );
        RETURN result;
    END IF;
    
    -- Check if there's quota remaining for this broadcast type
    IF p_broadcast_type = 'pre_show' THEN
        SELECT pre_show_broadcasts_remaining INTO quota_remaining
        FROM public.profiles
        WHERE id = p_organizer_id;
    ELSIF p_broadcast_type = 'post_show' THEN
        SELECT post_show_broadcasts_remaining INTO quota_remaining
        FROM public.profiles
        WHERE id = p_organizer_id;
    ELSE
        result := jsonb_build_object(
            'success', false,
            'message', 'Invalid broadcast type. Must be "pre_show" or "post_show"',
            'code', 'INVALID_BROADCAST_TYPE'
        );
        RETURN result;
    END IF;
    
    IF quota_remaining <= 0 THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'You have no remaining ' || p_broadcast_type || ' broadcasts',
            'code', 'QUOTA_EXCEEDED'
        );
        RETURN result;
    END IF;
    
    -- Insert the broadcast log
    INSERT INTO public.broadcast_logs (
        organizer_id,
        show_id,
        series_id,
        message_content,
        broadcast_type,
        recipients
    )
    VALUES (
        p_organizer_id,
        p_show_id,
        p_series_id,
        p_message,
        p_broadcast_type,
        p_recipients
    )
    RETURNING id, sent_at
    INTO result;
    
    -- Decrement the appropriate quota
    IF p_broadcast_type = 'pre_show' THEN
        UPDATE public.profiles
        SET pre_show_broadcasts_remaining = pre_show_broadcasts_remaining - 1
        WHERE id = p_organizer_id;
    ELSIF p_broadcast_type = 'post_show' THEN
        UPDATE public.profiles
        SET post_show_broadcasts_remaining = post_show_broadcasts_remaining - 1
        WHERE id = p_organizer_id;
    END IF;
    
    -- Return success response
    result := jsonb_build_object(
        'success', true,
        'message', 'Broadcast message sent successfully',
        'data', result,
        'code', 'SUCCESS'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'message', 'Error sending broadcast: ' || SQLERRM,
            'code', 'INTERNAL_ERROR'
        );
        RETURN result;
END;
$$;


ALTER FUNCTION "public"."send_broadcast_message"("p_series_id" "uuid", "p_show_id" "uuid", "p_organizer_id" "uuid", "p_message" "text", "p_broadcast_type" "text", "p_recipients" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_broadcast_message"("p_series_id" "uuid", "p_show_id" "uuid", "p_organizer_id" "uuid", "p_message" "text", "p_broadcast_type" "text", "p_recipients" "text"[]) IS 'Function to send a broadcast message to recipients of a show';



CREATE OR REPLACE FUNCTION "public"."send_message"("conversation_id" "uuid", "content" "text", "content_type" "text" DEFAULT 'text'::"text", "metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."send_message"("conversation_id" "uuid", "content" "text", "content_type" "text", "metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_message"("conversation_id" "uuid", "content" "text", "content_type" "text", "metadata" "jsonb") IS 'Sends a new message in a conversation and updates the conversation''s last message information.

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



CREATE OR REPLACE FUNCTION "public"."set_default_filter_preset"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If the new/updated preset is being set as default
    IF NEW.is_default = true THEN
        -- Set all other presets for this user to not default
        UPDATE filter_presets
        SET is_default = false
        WHERE user_id = NEW.user_id
          AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_default_filter_preset"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_role_when_added_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.role_when_added IS NULL THEN
    SELECT role INTO NEW.role_when_added 
    FROM profiles 
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_role_when_added_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."st_x_float8"("public"."geography") RETURNS double precision
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  -- Extract the X coordinate (longitude) from a geography point
  SELECT ST_X(ST_GeomFromEWKB($1::bytea)::geometry)::float8;
$_$;


ALTER FUNCTION "public"."st_x_float8"("public"."geography") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."st_y_float8"("public"."geography") RETURNS double precision
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  -- Extract the Y coordinate (latitude) from a geography point
  SELECT ST_Y(ST_GeomFromEWKB($1::bytea)::geometry)::float8;
$_$;


ALTER FUNCTION "public"."st_y_float8"("public"."geography") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_show_participants_from_planned_attendance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- When a user plans to attend a show, add them to show_participants if not already there
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.show_participants (userid, showid, role, created_at, updated_at)
    VALUES (NEW.user_id, NEW.show_id, 'attendee', NOW(), NOW())
    ON CONFLICT (userid, showid) DO NOTHING;
  
  -- When a user cancels attendance, remove them from show_participants if they're an attendee
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.show_participants
    WHERE userid = OLD.user_id
    AND showid = OLD.show_id
    AND role = 'attendee';
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_show_participants_from_planned_attendance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- This function sets the role based on account_type and subscription_status.
    -- Roles are now stored in LOWERCASE to accurately match application enums.
    IF NEW.account_type = 'organizer' THEN
        IF NEW.subscription_status = 'active' THEN NEW.role := 'show_organizer'; ELSE NEW.role := 'dealer'; END IF;
    ELSIF NEW.account_type = 'dealer' THEN
        IF NEW.subscription_status = 'active' THEN NEW.role := 'mvp_dealer'; ELSE NEW.role := 'dealer'; END IF;
    ELSIF NEW.account_type = 'collector' THEN
        NEW.role := 'attendee';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_role"() IS 'Automatically updates the user''s role based on their account_type and subscription_status. Intended for use in a trigger.';



CREATE OR REPLACE FUNCTION "public"."update_filter_presets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_filter_presets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_series_review_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update series stats if series_id is provided
    IF NEW.series_id IS NOT NULL THEN
        UPDATE public.show_series
        SET 
            average_rating = (
                SELECT AVG(rating)::numeric(3,2)
                FROM public.reviews
                WHERE series_id = NEW.series_id
            ),
            review_count = (
                SELECT COUNT(*)
                FROM public.reviews
                WHERE series_id = NEW.series_id
            )
        WHERE id = NEW.series_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_series_review_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_series_review_stats_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update series stats if series_id was provided
    IF OLD.series_id IS NOT NULL THEN
        UPDATE public.show_series
        SET 
            average_rating = (
                SELECT AVG(rating)::numeric(3,2)
                FROM public.reviews
                WHERE series_id = OLD.series_id
            ),
            review_count = (
                SELECT COUNT(*)
                FROM public.reviews
                WHERE series_id = OLD.series_id
            )
        WHERE id = OLD.series_id;
    END IF;
    
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."update_series_review_stats_on_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_show_series_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_show_series_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_want_list"("p_user_id" "uuid", "p_content" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
  want_list_id UUID;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found'
    );
  END IF;
  
  -- Check if want list exists for this user
  SELECT id INTO want_list_id FROM public.want_lists WHERE userid = p_user_id;
  
  -- Update or insert the want list
  BEGIN
    IF want_list_id IS NOT NULL THEN
      -- Update existing want list
      UPDATE public.want_lists
      SET content = p_content,
          updatedat = NOW()
      WHERE id = want_list_id;
      
      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Want list updated successfully',
        'id', want_list_id
      );
    ELSE
      -- Insert new want list
      INSERT INTO public.want_lists (userid, content, createdat, updatedat)
      VALUES (p_user_id, p_content, NOW(), NOW())
      RETURNING id INTO want_list_id;
      
      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Want list created successfully',
        'id', want_list_id
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
  END;
END;
$$;


ALTER FUNCTION "public"."update_want_list"("p_user_id" "uuid", "p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_shows"("shows_data" "public"."show_details"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  show public.show_details; -- This is the line we added
BEGIN
  FOREACH show IN ARRAY shows_data
  LOOP
    INSERT INTO public.shows (name, start_date, end_date, venue_name, city, state, url)
    VALUES (
      show.name,
      show.start_date,
      show.end_date,
      show.venue_name,
      show.city,
      show.state,
      show.url
    )
    ON CONFLICT (name, start_date, city) -- Make sure this matches your unique constraint
    DO UPDATE SET
      end_date = EXCLUDED.end_date,
      venue_name = EXCLUDED.venue_name,
      state = EXCLUDED.state,
      url = EXCLUDED.url;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."upsert_shows"("shows_data" "public"."show_details"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_coordinates"("lat" double precision, "lng" double precision) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_coordinates"("lat" double precision, "lng" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_coordinates"("lat" double precision, "lng" double precision) IS 'Validates that latitude and longitude are within valid ranges';



CREATE TABLE IF NOT EXISTS "public"."badges_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "requirement_count" integer
);


ALTER TABLE "public"."badges_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid",
    "show_id" "uuid",
    "series_id" "uuid",
    "message_content" "text" NOT NULL,
    "broadcast_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "recipients" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "broadcast_logs_broadcast_type_check" CHECK (("broadcast_type" = ANY (ARRAY['pre_show'::"text", 'post_show'::"text"]))),
    CONSTRAINT "broadcast_logs_message_content_check" CHECK (("length"("message_content") <= 1000))
);


ALTER TABLE "public"."broadcast_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."broadcast_logs"."broadcast_type" IS 'Type of broadcast: pre_show or post_show';



CREATE TABLE IF NOT EXISTS "public"."broadcast_quotas" (
    "organizer_id" "uuid" NOT NULL,
    "show_id" "uuid" NOT NULL,
    "pre_show_remaining" smallint DEFAULT 2,
    "post_show_remaining" smallint DEFAULT 1,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."broadcast_quotas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."card_shows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "location" "text" NOT NULL,
    "address" "text" NOT NULL,
    "dates" "daterange" NOT NULL,
    "times" "text",
    "entryfee" integer,
    "description" "text",
    "image" "text",
    "features" "text"[],
    "promoter_id" "uuid",
    "coordinate" "public"."geography"(Point,4326),
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."card_shows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "photo_url" "text",
    "unread_count" integer DEFAULT 0,
    "can_reply" boolean DEFAULT true,
    "role_when_added" "text"
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "show_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_message_text" "text",
    "last_message_timestamp" timestamp with time zone,
    CONSTRAINT "conversations_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'group'::"text", 'show'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coordinate_issues" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "show_id" "uuid" NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "issue_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."coordinate_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dealer_inventory_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "condition" "text",
    "price_range" "jsonb",
    "image_url" "text",
    "for_sale" boolean DEFAULT true NOT NULL,
    "for_trade" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dealer_inventory_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."dealer_inventory_items" IS 'Stores individual inventory items for dealers.';



COMMENT ON COLUMN "public"."dealer_inventory_items"."price_range" IS 'Stores price as a JSONB object for flexibility (fixed price or min/max range).';



CREATE TABLE IF NOT EXISTS "public"."dealer_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "description" "text",
    "website_url" "text",
    "instagram_url" "text",
    "twitter_url" "text",
    "facebook_url" "text",
    "business_email" "text",
    "business_phone" "text",
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "other_categories" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dealer_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."dealer_profiles" IS 'Stores business information for dealers and show organizers';



COMMENT ON COLUMN "public"."dealer_profiles"."business_name" IS 'Name of the dealer''s business or store';



COMMENT ON COLUMN "public"."dealer_profiles"."categories" IS 'Array of card categories the dealer specializes in';



COMMENT ON COLUMN "public"."dealer_profiles"."other_categories" IS 'Additional categories not covered by the predefined list';



CREATE TABLE IF NOT EXISTS "public"."filter_presets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."filter_presets" OWNER TO "postgres";


COMMENT ON TABLE "public"."filter_presets" IS 'Stores user-specific filter presets for the Card Show Finder app';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "read_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone,
    "deletion_reason" "text",
    "is_one_way" boolean DEFAULT false,
    "is_broadcast" boolean DEFAULT false,
    "show_context" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Stores messages between users';



COMMENT ON COLUMN "public"."messages"."id" IS 'Unique identifier for each message';



COMMENT ON COLUMN "public"."messages"."conversation_id" IS 'Groups messages into conversations between users';



COMMENT ON COLUMN "public"."messages"."sender_id" IS 'User ID of the message sender';



COMMENT ON COLUMN "public"."messages"."recipient_id" IS 'User ID of the message recipient';



COMMENT ON COLUMN "public"."messages"."content" IS 'Text content of the message';



COMMENT ON COLUMN "public"."messages"."created_at" IS 'Timestamp when the message was created';



COMMENT ON COLUMN "public"."messages"."read_at" IS 'Timestamp when the message was read (null if unread)';



CREATE TABLE IF NOT EXISTS "public"."planned_attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "show_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."planned_attendance" OWNER TO "postgres";


COMMENT ON TABLE "public"."planned_attendance" IS 'Tracks which shows users are planning to attend';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "home_zip_code" "text",
    "role" "text" DEFAULT 'ATTENDEE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "favorite_shows" "text"[] DEFAULT '{}'::"text"[],
    "attended_shows" "text"[] DEFAULT '{}'::"text"[],
    "account_type" character varying(20) DEFAULT 'collector'::character varying NOT NULL,
    "subscription_status" character varying(20) DEFAULT 'none'::character varying NOT NULL,
    "subscription_expiry" timestamp with time zone,
    "subscription_type" "text" DEFAULT 'none'::"text",
    "subscription_id" "text",
    "profile_image_url" "text",
    "business_name" "text",
    "dealer_bio" "text",
    "external_links" "jsonb",
    "dealer_specialties" "text"[],
    "banner_image_url" "text",
    "pre_show_broadcasts_remaining" integer DEFAULT 2,
    "post_show_broadcasts_remaining" integer DEFAULT 1,
    "phone_number" "text",
    "facebook_url" "text",
    "instagram_url" "text",
    "twitter_url" "text",
    "whatnot_url" "text",
    "ebay_store_url" "text",
    "favorite_shows_count" integer DEFAULT 0 NOT NULL,
    "payment_status" character varying(20) DEFAULT 'none'::character varying NOT NULL,
    CONSTRAINT "profiles_account_type_check" CHECK ((("account_type")::"text" = ANY ((ARRAY['collector'::character varying, 'dealer'::character varying, 'organizer'::character varying])::"text"[]))),
    CONSTRAINT "profiles_payment_status_check" CHECK ((("payment_status")::"text" = ANY ((ARRAY['trial'::character varying, 'paid'::character varying, 'none'::character varying])::"text"[]))),
    CONSTRAINT "profiles_subscription_status_check" CHECK ((("subscription_status")::"text" = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'none'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Ensured all user roles are stored in uppercase for consistency with application enums.';



COMMENT ON COLUMN "public"."profiles"."account_type" IS 'Type of user account: collector (free), dealer or organizer (paid)';



COMMENT ON COLUMN "public"."profiles"."subscription_status" IS 'Status of user subscription: active, expired, or none (for free accounts)';



COMMENT ON COLUMN "public"."profiles"."subscription_expiry" IS 'Date and time when the subscription expires (null for free accounts)';



COMMENT ON COLUMN "public"."profiles"."profile_image_url" IS 'URL for the dealer''s main profile image.';



COMMENT ON COLUMN "public"."profiles"."business_name" IS 'The official business name of the dealer.';



COMMENT ON COLUMN "public"."profiles"."dealer_bio" IS 'A short biography or description for the dealer''s profile.';



COMMENT ON COLUMN "public"."profiles"."external_links" IS 'A JSONB object to store external links, e.g., {"website": "url", "ebay": "url"}.';



COMMENT ON COLUMN "public"."profiles"."dealer_specialties" IS 'An array of strings listing the dealer''s specialties (e.g., vintage, modern, specific sports).';



COMMENT ON COLUMN "public"."profiles"."banner_image_url" IS 'URL for the dealer''s profile banner image.';



COMMENT ON COLUMN "public"."profiles"."pre_show_broadcasts_remaining" IS 'Number of pre-show broadcast messages the organizer can send';



COMMENT ON COLUMN "public"."profiles"."post_show_broadcasts_remaining" IS 'Number of post-show broadcast messages the organizer can send';



COMMENT ON COLUMN "public"."profiles"."facebook_url" IS 'Facebook profile URL for the user';



COMMENT ON COLUMN "public"."profiles"."instagram_url" IS 'Instagram profile URL for the user';



COMMENT ON COLUMN "public"."profiles"."twitter_url" IS 'Twitter/X profile URL for the user';



COMMENT ON COLUMN "public"."profiles"."whatnot_url" IS 'Whatnot store URL (for dealers)';



COMMENT ON COLUMN "public"."profiles"."ebay_store_url" IS 'eBay store URL (for dealers)';



COMMENT ON COLUMN "public"."profiles"."favorite_shows_count" IS 'Count of shows favourited by this user. Automatically maintained by triggers.';



COMMENT ON COLUMN "public"."profiles"."payment_status" IS 'Payment status of user: trial (free trial period), paid (paid subscription), or none (free accounts)';



CREATE TABLE IF NOT EXISTS "public"."raw_ai_responses" (
    "id" bigint NOT NULL,
    "source_url" "text",
    "ai_response_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."raw_ai_responses" OWNER TO "postgres";


ALTER TABLE "public"."raw_ai_responses" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."raw_ai_responses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reported_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "report_reason" "text" NOT NULL,
    "report_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "admin_notes" "text",
    CONSTRAINT "reported_messages_report_status_check" CHECK (("report_status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'dismissed'::"text", 'actioned'::"text"])))
);


ALTER TABLE "public"."reported_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "show_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "favorite_dealer" "text",
    "favorite_dealer_reason" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_name" "text",
    "series_id" "uuid",
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."reviews" IS 'Reviews for shows - updated structure for app compatibility';



COMMENT ON COLUMN "public"."reviews"."series_id" IS 'References the show_series this review is for';



CREATE OR REPLACE VIEW "public"."role_capabilities_v" AS
 SELECT "roles"."role",
    ("roles"."role" = 'attendee'::"text") AS "can_dm_attendee",
    ("roles"."role" = ANY (ARRAY['attendee'::"text", 'mvp_dealer'::"text", 'show_organizer'::"text"])) AS "can_dm_mvp_dealer",
    ("roles"."role" = ANY (ARRAY['mvp_dealer'::"text", 'show_organizer'::"text"])) AS "can_dm_dealer",
    ("roles"."role" = ANY (ARRAY['mvp_dealer'::"text", 'show_organizer'::"text"])) AS "can_dm_show_organizer",
    ("roles"."role" = ANY (ARRAY['attendee'::"text", 'mvp_dealer'::"text", 'show_organizer'::"text"])) AS "can_reply_to_dm",
    ("roles"."role" = ANY (ARRAY['mvp_dealer'::"text", 'show_organizer'::"text"])) AS "can_broadcast",
    ("roles"."role" = 'show_organizer'::"text") AS "has_broadcast_quota",
    ("roles"."role" = ANY (ARRAY['show_organizer'::"text", 'admin'::"text"])) AS "can_moderate"
   FROM ( SELECT "unnest"(ARRAY['attendee'::"text", 'dealer'::"text", 'mvp_dealer'::"text", 'show_organizer'::"text", 'admin'::"text"]) AS "role") "roles";


ALTER TABLE "public"."role_capabilities_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_want_lists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "userid" "uuid" NOT NULL,
    "showid" "uuid" NOT NULL,
    "wantlistid" "uuid" NOT NULL,
    "sharedat" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_want_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."show_inventory_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "participation_id" "uuid" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."show_inventory_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."show_inventory_items" IS 'Links a dealer''s inventory items to their participation in a specific show.';



CREATE TABLE IF NOT EXISTS "public"."show_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "userid" "uuid" NOT NULL,
    "showid" "uuid" NOT NULL,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "card_types" "text"[] DEFAULT '{}'::"text"[],
    "specialty" "text",
    "price_range" character varying(20),
    "notable_items" "text",
    "booth_location" "text",
    "payment_methods" "text"[] DEFAULT '{}'::"text"[],
    "open_to_trades" boolean DEFAULT false,
    "buying_cards" boolean DEFAULT false,
    "status" character varying(20) DEFAULT 'registered'::character varying,
    "role" "text" DEFAULT 'attendee'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "show_participants_price_range_check" CHECK ((("price_range")::"text" = ANY ((ARRAY['budget'::character varying, 'mid-range'::character varying, 'high-end'::character varying])::"text"[]))),
    CONSTRAINT "show_participants_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['registered'::character varying, 'confirmed'::character varying, 'cancelled'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."show_participants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."show_participants"."card_types" IS 'Types of cards the dealer primarily sells (e.g., vintage, modern, specific sports)';



COMMENT ON COLUMN "public"."show_participants"."specialty" IS 'Dealer''s niche or specialty (e.g., pre-war baseball, basketball rookies)';



COMMENT ON COLUMN "public"."show_participants"."price_range" IS 'General price point range (budget, mid-range, high-end)';



COMMENT ON COLUMN "public"."show_participants"."notable_items" IS 'Hot or hard-to-find items the dealer is known for';



COMMENT ON COLUMN "public"."show_participants"."booth_location" IS 'Information to help attendees find the dealer''s booth';



COMMENT ON COLUMN "public"."show_participants"."payment_methods" IS 'Payment types accepted by the dealer';



COMMENT ON COLUMN "public"."show_participants"."open_to_trades" IS 'Whether the dealer is open to trading cards';



COMMENT ON COLUMN "public"."show_participants"."buying_cards" IS 'Whether the dealer is interested in buying cards';



COMMENT ON COLUMN "public"."show_participants"."status" IS 'Status of the dealer''s participation in the show';



CREATE TABLE IF NOT EXISTS "public"."show_series" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "organizer_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "average_rating" numeric(3,2),
    "review_count" integer DEFAULT 0
);


ALTER TABLE "public"."show_series" OWNER TO "postgres";


COMMENT ON TABLE "public"."show_series" IS 'Stores information about recurring show series';



COMMENT ON COLUMN "public"."show_series"."organizer_id" IS 'References the profile ID of the user who organizes this series';



CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "badge_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "earned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_cards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "userid" "uuid" NOT NULL,
    "imageurl" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "category" "text",
    "iscompressed" boolean DEFAULT false,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "updatedat" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_favorite_shows" (
    "user_id" "uuid" NOT NULL,
    "show_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_favorite_shows" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_favorite_shows" IS 'Stores user favorite shows for quick retrieval and management.';



CREATE OR REPLACE VIEW "public"."valid_user_roles" AS
 SELECT 'ATTENDEE'::"text" AS "role"
UNION ALL
 SELECT 'DEALER'::"text" AS "role"
UNION ALL
 SELECT 'MVP_DEALER'::"text" AS "role"
UNION ALL
 SELECT 'SHOW_ORGANIZER'::"text" AS "role";


ALTER TABLE "public"."valid_user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."want_lists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "userid" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "createdat" timestamp with time zone DEFAULT "now"(),
    "updatedat" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."want_lists" OWNER TO "postgres";


COMMENT ON TABLE "public"."want_lists" IS 'Stores user want lists. MVP Dealers and Show Organizers can view want lists from attendees of their shows.';



CREATE TABLE IF NOT EXISTS "public"."zip_codes" (
    "zip_code" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zip_codes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."badges_definitions"
    ADD CONSTRAINT "badges_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_logs"
    ADD CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_quotas"
    ADD CONSTRAINT "broadcast_quotas_pkey" PRIMARY KEY ("organizer_id", "show_id");



ALTER TABLE ONLY "public"."card_shows"
    ADD CONSTRAINT "card_shows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coordinate_issues"
    ADD CONSTRAINT "coordinate_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dealer_inventory_items"
    ADD CONSTRAINT "dealer_inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dealer_profiles"
    ADD CONSTRAINT "dealer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."filter_presets"
    ADD CONSTRAINT "filter_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_attendance"
    ADD CONSTRAINT "planned_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_attendance"
    ADD CONSTRAINT "planned_attendance_user_id_show_id_key" UNIQUE ("user_id", "show_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_ai_responses"
    ADD CONSTRAINT "raw_ai_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_want_lists"
    ADD CONSTRAINT "shared_want_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_want_lists"
    ADD CONSTRAINT "shared_want_lists_userid_showid_key" UNIQUE ("userid", "showid");



ALTER TABLE ONLY "public"."show_inventory_items"
    ADD CONSTRAINT "show_inventory_items_inventory_id_participation_id_key" UNIQUE ("inventory_id", "participation_id");



ALTER TABLE ONLY "public"."show_inventory_items"
    ADD CONSTRAINT "show_inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."show_participants"
    ADD CONSTRAINT "show_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."show_participants"
    ADD CONSTRAINT "show_participants_userid_showid_key" UNIQUE ("userid", "showid");



ALTER TABLE ONLY "public"."show_series"
    ADD CONSTRAINT "show_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."filter_presets"
    ADD CONSTRAINT "unique_default_preset_per_user" UNIQUE ("user_id", "is_default") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."dealer_profiles"
    ADD CONSTRAINT "unique_user_dealer_profile" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_cards"
    ADD CONSTRAINT "user_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_favorite_shows"
    ADD CONSTRAINT "user_favorite_shows_pkey" PRIMARY KEY ("user_id", "show_id");



ALTER TABLE ONLY "public"."want_lists"
    ADD CONSTRAINT "want_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."want_lists"
    ADD CONSTRAINT "want_lists_userid_key" UNIQUE ("userid");



ALTER TABLE ONLY "public"."zip_codes"
    ADD CONSTRAINT "zip_codes_pkey" PRIMARY KEY ("zip_code");



CREATE INDEX "broadcast_logs_broadcast_type_idx" ON "public"."broadcast_logs" USING "btree" ("broadcast_type");



CREATE INDEX "broadcast_logs_organizer_id_idx" ON "public"."broadcast_logs" USING "btree" ("organizer_id");



CREATE INDEX "broadcast_logs_sent_at_idx" ON "public"."broadcast_logs" USING "btree" ("sent_at");



CREATE INDEX "broadcast_logs_series_id_idx" ON "public"."broadcast_logs" USING "btree" ("series_id");



CREATE INDEX "broadcast_logs_show_id_idx" ON "public"."broadcast_logs" USING "btree" ("show_id");



CREATE INDEX "coordinate_issues_resolved_idx" ON "public"."coordinate_issues" USING "btree" ("resolved_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "coordinate_issues_show_id_idx" ON "public"."coordinate_issues" USING "btree" ("show_id");



CREATE INDEX "dealer_profiles_user_id_idx" ON "public"."dealer_profiles" USING "btree" ("user_id");



CREATE INDEX "filter_presets_is_default_idx" ON "public"."filter_presets" USING "btree" ("is_default");



CREATE INDEX "filter_presets_user_id_idx" ON "public"."filter_presets" USING "btree" ("user_id");



CREATE INDEX "idx_card_shows_coordinate" ON "public"."card_shows" USING "gist" ("coordinate");



CREATE INDEX "idx_card_shows_dates" ON "public"."card_shows" USING "gist" ("dates");



CREATE INDEX "idx_card_shows_location" ON "public"."card_shows" USING "btree" ("location");



CREATE INDEX "idx_card_shows_status" ON "public"."card_shows" USING "btree" ("status");



CREATE INDEX "idx_dealer_inventory_category" ON "public"."dealer_inventory_items" USING "btree" ("category");



CREATE INDEX "idx_dealer_inventory_user_id" ON "public"."dealer_inventory_items" USING "btree" ("user_id");



CREATE INDEX "idx_gin_want_lists_content" ON "public"."want_lists" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



COMMENT ON INDEX "public"."idx_gin_want_lists_content" IS 'Enables efficient full-text search on the content of want lists for keyword matching.';



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_recipient_id" ON "public"."messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_planned_attendance_show_id" ON "public"."planned_attendance" USING "btree" ("show_id");



CREATE INDEX "idx_planned_attendance_user_id" ON "public"."planned_attendance" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_account_type" ON "public"."profiles" USING "btree" ("account_type");



CREATE INDEX "idx_profiles_dealer_specialties" ON "public"."profiles" USING "gin" ("dealer_specialties");



CREATE INDEX "idx_profiles_id" ON "public"."profiles" USING "btree" ("id");



CREATE INDEX "idx_profiles_payment_status" ON "public"."profiles" USING "btree" ("payment_status");



CREATE INDEX "idx_profiles_profile_image_url" ON "public"."profiles" USING "btree" ("profile_image_url");



CREATE INDEX "idx_profiles_subscription_status" ON "public"."profiles" USING "btree" ("subscription_status");



CREATE INDEX "idx_shared_want_lists_show_id" ON "public"."shared_want_lists" USING "btree" ("showid");



CREATE INDEX "idx_shared_want_lists_showid" ON "public"."shared_want_lists" USING "btree" ("showid");



COMMENT ON INDEX "public"."idx_shared_want_lists_showid" IS 'Crucial for dealers to efficiently query want lists shared at a specific show.';



CREATE INDEX "idx_shared_want_lists_user_id" ON "public"."shared_want_lists" USING "btree" ("userid");



CREATE INDEX "idx_shared_want_lists_userid" ON "public"."shared_want_lists" USING "btree" ("userid");



COMMENT ON INDEX "public"."idx_shared_want_lists_userid" IS 'Improves performance when querying for all shows a user has shared their want list with.';



CREATE INDEX "idx_shared_want_lists_want_list_id" ON "public"."shared_want_lists" USING "btree" ("wantlistid");



CREATE INDEX "idx_shared_want_lists_wantlistid" ON "public"."shared_want_lists" USING "btree" ("wantlistid");



CREATE INDEX "idx_show_inventory_inventory_id" ON "public"."show_inventory_items" USING "btree" ("inventory_id");



CREATE INDEX "idx_show_inventory_participation_id" ON "public"."show_inventory_items" USING "btree" ("participation_id");



CREATE INDEX "idx_show_participants_card_types" ON "public"."show_participants" USING "gin" ("card_types");



CREATE INDEX "idx_show_participants_price_range" ON "public"."show_participants" USING "btree" ("price_range");



CREATE INDEX "idx_show_participants_role" ON "public"."show_participants" USING "btree" ("role");



CREATE INDEX "idx_show_participants_show_id" ON "public"."show_participants" USING "btree" ("showid");



CREATE INDEX "idx_show_participants_showid" ON "public"."show_participants" USING "btree" ("showid");



CREATE INDEX "idx_show_participants_status" ON "public"."show_participants" USING "btree" ("status");



CREATE INDEX "idx_show_participants_user_id" ON "public"."show_participants" USING "btree" ("userid");



CREATE INDEX "idx_show_participants_userid" ON "public"."show_participants" USING "btree" ("userid");



CREATE INDEX "idx_shows_coordinates" ON "public"."shows" USING "gist" ("coordinates");



CREATE INDEX "idx_shows_organizer_id" ON "public"."shows" USING "btree" ("organizer_id");



CREATE INDEX "idx_shows_start_date" ON "public"."shows" USING "btree" ("start_date");



CREATE INDEX "idx_user_cards_user_id" ON "public"."user_cards" USING "btree" ("userid");



CREATE INDEX "idx_user_cards_userid" ON "public"."user_cards" USING "btree" ("userid");



CREATE INDEX "idx_want_lists_updatedat" ON "public"."want_lists" USING "btree" ("updatedat");



CREATE INDEX "idx_want_lists_user_id" ON "public"."want_lists" USING "btree" ("userid");



CREATE INDEX "idx_want_lists_userid" ON "public"."want_lists" USING "btree" ("userid");



COMMENT ON INDEX "public"."idx_want_lists_userid" IS 'Improves performance of fetching a want list for a specific user.';



CREATE INDEX "reviews_series_id_idx" ON "public"."reviews" USING "btree" ("series_id");



CREATE INDEX "show_coordinates_idx" ON "public"."shows" USING "gist" ("coordinates");



CREATE INDEX "show_participants_showid_idx" ON "public"."show_participants" USING "btree" ("showid");



CREATE INDEX "show_participants_userid_idx" ON "public"."show_participants" USING "btree" ("userid");



CREATE INDEX "show_series_organizer_id_idx" ON "public"."show_series" USING "btree" ("organizer_id");



CREATE INDEX "shows_series_id_idx" ON "public"."shows" USING "btree" ("series_id");



CREATE INDEX "user_favorite_shows_show_id_idx" ON "public"."user_favorite_shows" USING "btree" ("show_id");



CREATE INDEX "user_favorite_shows_user_id_idx" ON "public"."user_favorite_shows" USING "btree" ("user_id");



CREATE INDEX "want_lists_content_gin_idx" ON "public"."want_lists" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "want_lists_userid_idx" ON "public"."want_lists" USING "btree" ("userid");



CREATE OR REPLACE TRIGGER "messages_after_insert_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."messages_update_conversation_trigger"();



CREATE OR REPLACE TRIGGER "profiles_role_sync_trigger" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_role"();



CREATE OR REPLACE TRIGGER "reviews_delete_trigger" AFTER DELETE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_series_review_stats_on_delete"();



CREATE OR REPLACE TRIGGER "reviews_insert_trigger" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_series_review_stats"();



CREATE OR REPLACE TRIGGER "reviews_update_trigger" AFTER UPDATE ON "public"."reviews" FOR EACH ROW WHEN ((("old"."rating" IS DISTINCT FROM "new"."rating") OR ("old"."series_id" IS DISTINCT FROM "new"."series_id"))) EXECUTE FUNCTION "public"."update_series_review_stats"();



CREATE OR REPLACE TRIGGER "set_dealer_profile_updated_at" BEFORE UPDATE ON "public"."dealer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_dealer_profile_updated_at"();



CREATE OR REPLACE TRIGGER "set_default_filter_preset_trigger" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."filter_presets" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."set_default_filter_preset"();



CREATE OR REPLACE TRIGGER "set_role_when_added_trigger" BEFORE INSERT ON "public"."conversation_participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_role_when_added_trigger"();



CREATE OR REPLACE TRIGGER "trigger_log_null_coordinates" AFTER INSERT OR UPDATE OF "coordinates" ON "public"."shows" FOR EACH ROW EXECUTE FUNCTION "public"."log_null_coordinates"();



CREATE OR REPLACE TRIGGER "trigger_sync_show_participants" AFTER INSERT OR DELETE ON "public"."planned_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."sync_show_participants_from_planned_attendance"();



CREATE OR REPLACE TRIGGER "trigger_update_show_participants_updated_at" BEFORE UPDATE ON "public"."show_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_filter_presets_updated_at_trigger" BEFORE UPDATE ON "public"."filter_presets" FOR EACH ROW EXECUTE FUNCTION "public"."update_filter_presets_updated_at"();



CREATE OR REPLACE TRIGGER "update_show_series_updated_at_trigger" BEFORE UPDATE ON "public"."show_series" FOR EACH ROW EXECUTE FUNCTION "public"."update_show_series_updated_at"();



ALTER TABLE ONLY "public"."broadcast_logs"
    ADD CONSTRAINT "broadcast_logs_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_logs"
    ADD CONSTRAINT "broadcast_logs_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."show_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."broadcast_logs"
    ADD CONSTRAINT "broadcast_logs_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."broadcast_quotas"
    ADD CONSTRAINT "broadcast_quotas_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_quotas"
    ADD CONSTRAINT "broadcast_quotas_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."card_shows"
    ADD CONSTRAINT "card_shows_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id");



ALTER TABLE ONLY "public"."coordinate_issues"
    ADD CONSTRAINT "coordinate_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."coordinate_issues"
    ADD CONSTRAINT "coordinate_issues_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dealer_inventory_items"
    ADD CONSTRAINT "dealer_inventory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dealer_profiles"
    ADD CONSTRAINT "dealer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."filter_presets"
    ADD CONSTRAINT "filter_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_show_context_fkey" FOREIGN KEY ("show_context") REFERENCES "public"."shows"("id");



ALTER TABLE ONLY "public"."planned_attendance"
    ADD CONSTRAINT "planned_attendance_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_attendance"
    ADD CONSTRAINT "planned_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reported_messages"
    ADD CONSTRAINT "reported_messages_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."show_series"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_want_lists"
    ADD CONSTRAINT "shared_want_lists_showid_fkey" FOREIGN KEY ("showid") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_want_lists"
    ADD CONSTRAINT "shared_want_lists_userid_fkey" FOREIGN KEY ("userid") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_want_lists"
    ADD CONSTRAINT "shared_want_lists_wantlistid_fkey" FOREIGN KEY ("wantlistid") REFERENCES "public"."want_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."show_inventory_items"
    ADD CONSTRAINT "show_inventory_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."dealer_inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."show_inventory_items"
    ADD CONSTRAINT "show_inventory_items_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "public"."show_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."show_participants"
    ADD CONSTRAINT "show_participants_showid_fkey" FOREIGN KEY ("showid") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."show_participants"
    ADD CONSTRAINT "show_participants_userid_fkey" FOREIGN KEY ("userid") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."show_series"
    ADD CONSTRAINT "show_series_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."show_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges_definitions"("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_cards"
    ADD CONSTRAINT "user_cards_userid_fkey" FOREIGN KEY ("userid") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorite_shows"
    ADD CONSTRAINT "user_favorite_shows_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorite_shows"
    ADD CONSTRAINT "user_favorite_shows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."want_lists"
    ADD CONSTRAINT "want_lists_userid_fkey" FOREIGN KEY ("userid") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."badges_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_quotas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."card_shows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants_all_admin" ON "public"."conversation_participants" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "conversation_participants_delete_self" ON "public"."conversation_participants" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "conversation_participants_insert_self" ON "public"."conversation_participants" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "conversation_participants_select" ON "public"."conversation_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "conversation_participants_1"
  WHERE (("conversation_participants_1"."conversation_id" = "conversation_participants_1"."conversation_id") AND ("conversation_participants_1"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_all_admin" ON "public"."conversations" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "conversations_insert" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "conversations_select_participant" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "conversations_update_participant" ON "public"."conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."coordinate_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dealer_inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dealer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."filter_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_all_admin" ON "public"."messages" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "messages_delete_own" ON "public"."messages" FOR DELETE USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_insert_participant" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "messages_select_participant" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "messages_update_own" ON "public"."messages" FOR UPDATE USING (("sender_id" = "auth"."uid"())) WITH CHECK (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."planned_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planned_attendance_all_admin" ON "public"."planned_attendance" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "planned_attendance_delete_self" ON "public"."planned_attendance" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "planned_attendance_insert_self" ON "public"."planned_attendance" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "planned_attendance_select_mvp_dealer" ON "public"."planned_attendance" FOR SELECT USING (("public"."is_mvp_dealer"() AND (EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "planned_attendance"."show_id") AND ("shows"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "planned_attendance_select_organizer" ON "public"."planned_attendance" FOR SELECT USING (("public"."is_show_organizer"() AND (EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "planned_attendance"."show_id") AND ("shows"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "planned_attendance_select_self" ON "public"."planned_attendance" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_all_admin" ON "public"."profiles" USING ((("auth"."role"() = 'service_role'::"text") OR "public"."is_admin"()));



CREATE POLICY "profiles_select_others" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."raw_ai_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reported_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_all_admin" ON "public"."reviews" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "reviews_delete_own" ON "public"."reviews" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "reviews_insert_attendee" ON "public"."reviews" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."show_participants"
  WHERE (("show_participants"."showid" = "reviews"."show_id") AND ("show_participants"."userid" = "auth"."uid"()))))));



CREATE POLICY "reviews_select_all" ON "public"."reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reviews_update_own" ON "public"."reviews" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."shared_want_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shared_want_lists_all_admin" ON "public"."shared_want_lists" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "shared_want_lists_delete" ON "public"."shared_want_lists" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."want_lists"
  WHERE (("want_lists"."id" = "shared_want_lists"."wantlistid") AND ("want_lists"."userid" = "auth"."uid"())))));



CREATE POLICY "shared_want_lists_insert" ON "public"."shared_want_lists" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."want_lists"
  WHERE (("want_lists"."id" = "shared_want_lists"."wantlistid") AND ("want_lists"."userid" = "auth"."uid"())))));



CREATE POLICY "shared_want_lists_select_mvp_dealer" ON "public"."shared_want_lists" FOR SELECT USING (("public"."is_mvp_dealer"() AND ((EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "shared_want_lists"."showid") AND ("shows"."organizer_id" = "auth"."uid"())))) OR "public"."participates_in_show_safe"("showid"))));



CREATE POLICY "shared_want_lists_select_organizer" ON "public"."shared_want_lists" FOR SELECT USING (("public"."is_show_organizer"() AND (EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "shared_want_lists"."showid") AND ("shows"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "shared_want_lists_select_self" ON "public"."shared_want_lists" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."want_lists"
  WHERE (("want_lists"."id" = "shared_want_lists"."wantlistid") AND ("want_lists"."userid" = "auth"."uid"())))));



ALTER TABLE "public"."show_inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."show_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "show_participants_all_admin" ON "public"."show_participants" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "show_participants_delete_self" ON "public"."show_participants" FOR DELETE USING (("userid" = "auth"."uid"()));



CREATE POLICY "show_participants_insert" ON "public"."show_participants" FOR INSERT WITH CHECK (("userid" = "auth"."uid"()));



CREATE POLICY "show_participants_select_mvp_dealer_safe" ON "public"."show_participants" FOR SELECT TO "authenticated" USING (("public"."is_mvp_dealer"() AND (("userid" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."shows" "s"
  WHERE (("s"."id" = "show_participants"."showid") AND ("s"."organizer_id" = "auth"."uid"())))) OR "public"."participates_in_show_safe"("showid"))));



CREATE POLICY "show_participants_select_organizer" ON "public"."show_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "show_participants"."showid") AND ("shows"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "show_participants_select_self" ON "public"."show_participants" FOR SELECT TO "authenticated" USING (("userid" = "auth"."uid"()));



CREATE POLICY "show_participants_update_organizer" ON "public"."show_participants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "show_participants"."showid") AND ("shows"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "show_participants_update_self" ON "public"."show_participants" FOR UPDATE USING (("userid" = "auth"."uid"())) WITH CHECK (("userid" = "auth"."uid"()));



ALTER TABLE "public"."show_series" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "show_series_all_admin" ON "public"."show_series" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "show_series_delete_organizer" ON "public"."show_series" FOR DELETE USING (("organizer_id" = "auth"."uid"()));



CREATE POLICY "show_series_insert_organizer" ON "public"."show_series" FOR INSERT WITH CHECK ((("organizer_id" = "auth"."uid"()) AND "public"."is_show_organizer"()));



CREATE POLICY "show_series_select_all" ON "public"."show_series" FOR SELECT USING (true);



CREATE POLICY "show_series_update_organizer" ON "public"."show_series" FOR UPDATE USING (("organizer_id" = "auth"."uid"())) WITH CHECK (("organizer_id" = "auth"."uid"()));



ALTER TABLE "public"."shows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shows_delete_organizer" ON "public"."shows" FOR DELETE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "shows_insert_organizer" ON "public"."shows" FOR INSERT WITH CHECK ((("auth"."uid"() = "organizer_id") OR "public"."is_show_organizer"()));



CREATE POLICY "shows_select_all" ON "public"."shows" FOR SELECT USING (true);



CREATE POLICY "shows_update_admin" ON "public"."shows" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "shows_update_organizer" ON "public"."shows" FOR UPDATE USING (("auth"."uid"() = "organizer_id")) WITH CHECK (("auth"."uid"() = "organizer_id"));



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_fav_shows_all_admin" ON "public"."user_favorite_shows" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "user_fav_shows_del_self" ON "public"."user_favorite_shows" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_fav_shows_ins_self" ON "public"."user_favorite_shows" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_fav_shows_sel_mvp_dealer" ON "public"."user_favorite_shows" FOR SELECT USING (("public"."is_mvp_dealer"() AND (EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "user_favorite_shows"."show_id") AND ("shows"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "user_fav_shows_sel_org" ON "public"."user_favorite_shows" FOR SELECT USING (("public"."is_show_organizer"() AND (EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "user_favorite_shows"."show_id") AND ("shows"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "user_fav_shows_sel_self" ON "public"."user_favorite_shows" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_favorite_shows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."want_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "want_lists_all_admin" ON "public"."want_lists" USING (("public"."is_admin"() OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "want_lists_delete" ON "public"."want_lists" FOR DELETE USING (("userid" = "auth"."uid"()));



CREATE POLICY "want_lists_insert" ON "public"."want_lists" FOR INSERT WITH CHECK (("userid" = "auth"."uid"()));



CREATE POLICY "want_lists_select_mvp_dealer" ON "public"."want_lists" FOR SELECT USING (("public"."is_mvp_dealer"() AND (EXISTS ( SELECT 1
   FROM ("public"."shared_want_lists" "swl"
     JOIN "public"."shows" "s" ON (("swl"."showid" = "s"."id")))
  WHERE (("swl"."wantlistid" = "want_lists"."id") AND (("s"."organizer_id" = "auth"."uid"()) OR "public"."participates_in_show_safe"("s"."id")))))));



CREATE POLICY "want_lists_select_organizer" ON "public"."want_lists" FOR SELECT USING (("public"."is_show_organizer"() AND (EXISTS ( SELECT 1
   FROM ("public"."shared_want_lists" "swl"
     JOIN "public"."shows" "s" ON (("swl"."showid" = "s"."id")))
  WHERE (("swl"."wantlistid" = "want_lists"."id") AND ("s"."organizer_id" = "auth"."uid"()))))));



CREATE POLICY "want_lists_select_self" ON "public"."want_lists" FOR SELECT USING (("userid" = "auth"."uid"()));



CREATE POLICY "want_lists_update" ON "public"."want_lists" FOR UPDATE USING (("userid" = "auth"."uid"())) WITH CHECK (("userid" = "auth"."uid"()));



ALTER TABLE "public"."zip_codes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_user_reply"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_reply"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_reply"("p_user_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_user_send_dm"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_send_dm"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_send_dm"("p_sender_id" "uuid", "p_recipient_id" "uuid", "p_show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_use_broadcast_quota"("p_organizer_id" "uuid", "p_show_id" "uuid", "p_is_pre_show" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_use_broadcast_quota"("p_organizer_id" "uuid", "p_show_id" "uuid", "p_is_pre_show" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_use_broadcast_quota"("p_organizer_id" "uuid", "p_show_id" "uuid", "p_is_pre_show" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_want_list_access"("viewer_id" "uuid", "show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_want_list_access"("viewer_id" "uuid", "show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_want_list_access"("viewer_id" "uuid", "show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_show_series"("series_id" "uuid", "organizer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_show_series"("series_id" "uuid", "organizer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_show_series"("series_id" "uuid", "organizer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_broadcast_message"("p_sender_id" "uuid", "p_show_id" "uuid", "p_message_text" "text", "p_recipient_roles" "text"[], "p_is_pre_show" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_broadcast_message"("p_sender_id" "uuid", "p_show_id" "uuid", "p_message_text" "text", "p_recipient_roles" "text"[], "p_is_pre_show" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_broadcast_message"("p_sender_id" "uuid", "p_show_id" "uuid", "p_message_text" "text", "p_recipient_roles" "text"[], "p_is_pre_show" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_geography_point"("lat" double precision, "lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."create_geography_point"("lat" double precision, "lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_geography_point"("lat" double precision, "lng" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_show_with_coordinates"("p_title" "text", "p_description" "text", "p_location" "text", "p_address" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_entry_fee" numeric, "p_image_url" "text", "p_latitude" double precision, "p_longitude" double precision, "p_features" "jsonb", "p_categories" "text"[], "p_series_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_show_with_coordinates"("p_title" "text", "p_description" "text", "p_location" "text", "p_address" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_entry_fee" numeric, "p_image_url" "text", "p_latitude" double precision, "p_longitude" double precision, "p_features" "jsonb", "p_categories" "text"[], "p_series_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_show_with_coordinates"("p_title" "text", "p_description" "text", "p_location" "text", "p_address" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_entry_fee" numeric, "p_image_url" "text", "p_latitude" double precision, "p_longitude" double precision, "p_features" "jsonb", "p_categories" "text"[], "p_series_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_wkb_coordinates"("wkb_hex" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_wkb_coordinates"("wkb_hex" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_wkb_coordinates"("wkb_hex" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_unread"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_unread"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_unread"() TO "service_role";



GRANT ALL ON FUNCTION "public"."diagnose_want_list_issues"("viewer_id" "uuid", "test_attendee_id" "uuid", "test_show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."diagnose_want_list_issues"("viewer_id" "uuid", "test_attendee_id" "uuid", "test_show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diagnose_want_list_issues"("viewer_id" "uuid", "test_attendee_id" "uuid", "test_show_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."shows" TO "anon";
GRANT ALL ON TABLE "public"."shows" TO "authenticated";
GRANT ALL ON TABLE "public"."shows" TO "service_role";



GRANT ALL ON FUNCTION "public"."find_filtered_shows"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."find_filtered_shows"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_filtered_shows"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_filtered_shows"("start_date_filter" timestamp with time zone, "end_date_filter" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[], "center_lat" numeric, "center_lng" numeric, "radius_miles" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."find_filtered_shows"("start_date_filter" timestamp with time zone, "end_date_filter" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[], "center_lat" numeric, "center_lng" numeric, "radius_miles" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_filtered_shows"("start_date_filter" timestamp with time zone, "end_date_filter" timestamp with time zone, "max_entry_fee" numeric, "show_categories" "text"[], "show_features" "text"[], "center_lat" numeric, "center_lng" numeric, "radius_miles" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_shows_with_coordinates"("lat" double precision, "lng" double precision, "radius_miles" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_shows_with_coordinates"("lat" double precision, "lng" double precision, "radius_miles" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_shows_with_coordinates"("lat" double precision, "lng" double precision, "radius_miles" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_shows_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_shows_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_shows_within_radius"("center_lat" double precision, "center_lng" double precision, "radius_miles" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_show_coordinates"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_show_coordinates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_show_coordinates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_show_coordinates"("show_id" "uuid", "new_latitude" double precision, "new_longitude" double precision, "admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fix_show_coordinates"("show_id" "uuid", "new_latitude" double precision, "new_longitude" double precision, "admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_show_coordinates"("show_id" "uuid", "new_latitude" double precision, "new_longitude" double precision, "admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accessible_want_lists"("viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_want_lists"("viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_want_lists"("viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_shows_with_coordinates"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_shows_with_coordinates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_shows_with_coordinates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_messages"("conversation_id" "uuid", "page_size" integer, "page" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_messages"("conversation_id" "uuid", "page_size" integer, "page" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_messages"("conversation_id" "uuid", "page_size" integer, "page" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_paginated_shows"("lat" double precision, "lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "categories" "text"[], "features" "jsonb", "page_size" integer, "page" integer, "status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_paginated_shows"("lat" double precision, "lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "categories" "text"[], "features" "jsonb", "page_size" integer, "page" integer, "status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_paginated_shows"("lat" double precision, "lng" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "max_entry_fee" numeric, "categories" "text"[], "features" "jsonb", "page_size" integer, "page" integer, "status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_series_review_stats"("p_series_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_series_review_stats"("p_series_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_series_review_stats"("p_series_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_show_details_by_id"("show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_show_details_by_id"("show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_show_details_by_id"("show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_show_with_coordinates"("show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_show_with_coordinates"("show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_show_with_coordinates"("show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shows_with_coordinate_issues"("page_number" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shows_with_coordinate_issues"("page_number" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shows_with_coordinate_issues"("page_number" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations"("input_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations"("input_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations"("input_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_want_list_matches_for_dealer"("p_dealer_id" "uuid", "p_show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_want_list_matches_for_dealer"("p_dealer_id" "uuid", "p_show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_want_list_matches_for_dealer"("p_dealer_id" "uuid", "p_show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_dealer_profile_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_dealer_profile_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_dealer_profile_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_unread"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_unread"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_unread"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_scraper_agent"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_scraper_agent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_scraper_agent"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_any_dealer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_any_dealer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_any_dealer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_dealer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_dealer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dealer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_mvp_dealer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_mvp_dealer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_mvp_dealer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_series_organizer"("p_series_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_series_organizer"("p_series_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_series_organizer"("p_series_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_series_organizer_for_review"("review_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_series_organizer_for_review"("review_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_series_organizer_for_review"("review_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_show_organizer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_show_organizer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_show_organizer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_null_coordinates"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_null_coordinates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_null_coordinates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_rls_change"("action" "text", "object_type" "text", "object_name" "text", "details" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_rls_change"("action" "text", "object_type" "text", "object_name" "text", "details" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_rls_change"("action" "text", "object_type" "text", "object_name" "text", "details" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."manually_sync_all_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."manually_sync_all_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manually_sync_all_user_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."messages_update_conversation_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."messages_update_conversation_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."messages_update_conversation_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."moderate_delete_message"("p_message_id" "uuid", "p_moderator_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."moderate_delete_message"("p_message_id" "uuid", "p_moderator_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."moderate_delete_message"("p_message_id" "uuid", "p_moderator_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_shows"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."nearby_shows_earth_distance"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."nearby_shows_earth_distance"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nearby_shows_earth_distance"("lat" double precision, "long" double precision, "radius_miles" double precision, "start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."organizes_show"("show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."organizes_show"("show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."organizes_show"("show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."participates_in_conversation"("conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."participates_in_conversation"("conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."participates_in_conversation"("conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."participates_in_show"("show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."participates_in_show"("show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."participates_in_show"("show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."participates_in_show_safe"("showid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."participates_in_show_safe"("showid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."participates_in_show_safe"("showid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_and_load_shows"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_and_load_shows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_and_load_shows"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_favorite_show"("p_user_id" "uuid", "p_show_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_message"("p_message_id" "uuid", "p_reporter_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."report_message"("p_message_id" "uuid", "p_reporter_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_message"("p_message_id" "uuid", "p_reporter_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_show_broadcast_quotas"("p_organizer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_show_broadcast_quotas"("p_organizer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_show_broadcast_quotas"("p_organizer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_drop_policy"("policy_name" "text", "table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_drop_policy"("policy_name" "text", "table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_drop_policy"("policy_name" "text", "table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_broadcast_message"("p_series_id" "uuid", "p_show_id" "uuid", "p_organizer_id" "uuid", "p_message" "text", "p_broadcast_type" "text", "p_recipients" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."send_broadcast_message"("p_series_id" "uuid", "p_show_id" "uuid", "p_organizer_id" "uuid", "p_message" "text", "p_broadcast_type" "text", "p_recipients" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_broadcast_message"("p_series_id" "uuid", "p_show_id" "uuid", "p_organizer_id" "uuid", "p_message" "text", "p_broadcast_type" "text", "p_recipients" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_message"("conversation_id" "uuid", "content" "text", "content_type" "text", "metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."send_message"("conversation_id" "uuid", "content" "text", "content_type" "text", "metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_message"("conversation_id" "uuid", "content" "text", "content_type" "text", "metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_filter_preset"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_filter_preset"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_filter_preset"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_role_when_added_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_role_when_added_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_role_when_added_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x_float8"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x_float8"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x_float8"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y_float8"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y_float8"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y_float8"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_show_participants_from_planned_attendance"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_show_participants_from_planned_attendance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_show_participants_from_planned_attendance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_filter_presets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_filter_presets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_filter_presets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_series_review_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_series_review_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_series_review_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_series_review_stats_on_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_series_review_stats_on_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_series_review_stats_on_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_show_series_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_show_series_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_show_series_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_want_list"("p_user_id" "uuid", "p_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_want_list"("p_user_id" "uuid", "p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_want_list"("p_user_id" "uuid", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_shows"("shows_data" "public"."show_details"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_shows"("shows_data" "public"."show_details"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_shows"("shows_data" "public"."show_details"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_coordinates"("lat" double precision, "lng" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_coordinates"("lat" double precision, "lng" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_coordinates"("lat" double precision, "lng" double precision) TO "service_role";



GRANT ALL ON TABLE "public"."badges_definitions" TO "anon";
GRANT ALL ON TABLE "public"."badges_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."badges_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_logs" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_logs" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_quotas" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_quotas" TO "service_role";



GRANT ALL ON TABLE "public"."card_shows" TO "anon";
GRANT ALL ON TABLE "public"."card_shows" TO "authenticated";
GRANT ALL ON TABLE "public"."card_shows" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."coordinate_issues" TO "anon";
GRANT ALL ON TABLE "public"."coordinate_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."coordinate_issues" TO "service_role";



GRANT ALL ON TABLE "public"."dealer_inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."dealer_inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."dealer_inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."dealer_profiles" TO "anon";
GRANT ALL ON TABLE "public"."dealer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."dealer_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."filter_presets" TO "anon";
GRANT ALL ON TABLE "public"."filter_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."filter_presets" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT UPDATE("read_at") ON TABLE "public"."messages" TO "authenticated";



GRANT ALL ON TABLE "public"."planned_attendance" TO "anon";
GRANT ALL ON TABLE "public"."planned_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."raw_ai_responses" TO "anon";
GRANT ALL ON TABLE "public"."raw_ai_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_ai_responses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."raw_ai_responses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."raw_ai_responses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."raw_ai_responses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reported_messages" TO "anon";
GRANT ALL ON TABLE "public"."reported_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."reported_messages" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."role_capabilities_v" TO "anon";
GRANT ALL ON TABLE "public"."role_capabilities_v" TO "authenticated";
GRANT ALL ON TABLE "public"."role_capabilities_v" TO "service_role";



GRANT ALL ON TABLE "public"."shared_want_lists" TO "anon";
GRANT ALL ON TABLE "public"."shared_want_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_want_lists" TO "service_role";



GRANT ALL ON TABLE "public"."show_inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."show_inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."show_inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."show_participants" TO "anon";
GRANT ALL ON TABLE "public"."show_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."show_participants" TO "service_role";



GRANT ALL ON TABLE "public"."show_series" TO "anon";
GRANT ALL ON TABLE "public"."show_series" TO "authenticated";
GRANT ALL ON TABLE "public"."show_series" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_cards" TO "anon";
GRANT ALL ON TABLE "public"."user_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."user_cards" TO "service_role";



GRANT ALL ON TABLE "public"."user_favorite_shows" TO "anon";
GRANT ALL ON TABLE "public"."user_favorite_shows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorite_shows" TO "service_role";



GRANT ALL ON TABLE "public"."valid_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."valid_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."valid_user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."want_lists" TO "anon";
GRANT ALL ON TABLE "public"."want_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."want_lists" TO "service_role";



GRANT ALL ON TABLE "public"."zip_codes" TO "anon";
GRANT ALL ON TABLE "public"."zip_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."zip_codes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
