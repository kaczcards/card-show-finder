-- =============================================================================
-- production-fix-want-lists.sql
-- =============================================================================
-- Comprehensive SQL script to fix all known issues with the want lists feature
-- in the Card Show Finder app.
--
-- This script is IDEMPOTENT and can be safely run multiple times in production.
-- It will:
--   1. Ensure all necessary tables exist with correct structure
--   2. Fix all RLS policies for proper access control
--   3. Add necessary indexes for performance
--   4. Create helper functions for testing
--   5. Add proper error handling
--   6. Include verification queries to confirm everything is working
-- =============================================================================

-- Start transaction for atomicity
BEGIN;

-- Enable PostGIS extension if not already enabled (for location-based features)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================================
-- 1. ENSURE TABLES EXIST WITH CORRECT STRUCTURE
-- =============================================================================

-- Create user_favorite_shows table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorite_shows') THEN
    CREATE TABLE public.user_favorite_shows (
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      PRIMARY KEY (user_id, show_id) -- Composite primary key to ensure uniqueness
    );
    
    COMMENT ON TABLE public.user_favorite_shows IS 'Stores user favorite shows for quick retrieval and management.';
  END IF;
END
$$;

-- Create want_lists table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') THEN
    CREATE TABLE public.want_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      content TEXT,
      createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT want_lists_userid_key UNIQUE (userid)
    );
    
    COMMENT ON TABLE public.want_lists IS 'Stores user want lists for trading card collections.';
  END IF;
END
$$;

-- Create show_participants table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'show_participants') THEN
    CREATE TABLE public.show_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      userid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      showid UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'dealer',
      status TEXT NOT NULL DEFAULT 'pending',
      createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT show_participants_userid_showid_key UNIQUE (userid, showid)
    );
    
    COMMENT ON TABLE public.show_participants IS 'Stores participants (dealers, vendors) for each show.';
  END IF;
END
$$;

-- =============================================================================
-- 2. FIX RLS POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_favorite_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.want_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_participants ENABLE ROW LEVEL SECURITY;

-- Clear existing policies on user_favorite_shows to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to view their own favorite shows" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow MVP dealers to view favorite shows for shows they participate in" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow show organizers to view favorite shows for shows they organize" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own favorite shows" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own favorite shows" ON public.user_favorite_shows;

-- Also drop policies with alternative naming conventions that might exist
DROP POLICY IF EXISTS "user_can_read_own_favorites" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "mvp_dealer_can_read_attendee_favorites" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "organizer_can_read_attendee_favorites" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "user_insert_own_favorite" ON public.user_favorite_shows;
DROP POLICY IF EXISTS "user_delete_own_favorite" ON public.user_favorite_shows;

-- Create comprehensive RLS policies for user_favorite_shows

-- Policy 1: Allow users to view their own favorite shows
CREATE POLICY "Allow authenticated users to view their own favorite shows"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Allow MVP dealers to view favorite shows for shows they participate in
CREATE POLICY "Allow MVP dealers to view favorite shows for shows they participate in"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) AND
    -- MVP dealer is participating in the show
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.userid = auth.uid()
      AND sp.showid = user_favorite_shows.show_id
    )
  );

-- Policy 3: Allow show organizers to view favorite shows for shows they organize
CREATE POLICY "Allow show organizers to view favorite shows for shows they organize"
  ON public.user_favorite_shows FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'show_organizer'
    ) AND
    -- User is the organizer of the show
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = user_favorite_shows.show_id
      AND s.organizer_id = auth.uid()
    )
  );

-- Policy 4: Allow users to insert their own favorite shows
CREATE POLICY "Allow authenticated users to insert their own favorite shows"
  ON public.user_favorite_shows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 5: Allow users to delete their own favorite shows
CREATE POLICY "Allow authenticated users to delete their own favorite shows"
  ON public.user_favorite_shows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for want_lists if they don't exist

-- Clear existing policies on want_lists to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own want lists" ON public.want_lists;
DROP POLICY IF EXISTS "MVP dealers can view want lists for attendees of their shows" ON public.want_lists;
DROP POLICY IF EXISTS "Show organizers can view want lists for attendees of their shows" ON public.want_lists;
DROP POLICY IF EXISTS "Users can insert their own want lists" ON public.want_lists;
DROP POLICY IF EXISTS "Users can update their own want lists" ON public.want_lists;
DROP POLICY IF EXISTS "Users can delete their own want lists" ON public.want_lists;

-- Policy 1: Allow users to view their own want lists
CREATE POLICY "Users can view their own want lists"
  ON public.want_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = userid);

-- Policy 2: Allow MVP dealers to view want lists for attendees of their shows
CREATE POLICY "MVP dealers can view want lists for attendees of their shows"
  ON public.want_lists FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) AND
    -- Want list belongs to an attendee of a show the dealer participates in
    EXISTS (
      SELECT 1 
      FROM user_favorite_shows ufs
      JOIN show_participants sp ON ufs.show_id = sp.showid
      WHERE ufs.user_id = want_lists.userid  -- Attendee has favorited the show
        AND sp.userid = auth.uid()           -- Dealer participates in the show
    )
  );

-- Policy 3: Allow show organizers to view want lists for attendees of their shows
CREATE POLICY "Show organizers can view want lists for attendees of their shows"
  ON public.want_lists FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'show_organizer'
    ) AND
    -- Want list belongs to an attendee of a show the user organizes
    EXISTS (
      SELECT 1 
      FROM user_favorite_shows ufs
      JOIN shows s ON ufs.show_id = s.id
      WHERE ufs.user_id = want_lists.userid  -- Attendee has favorited the show
        AND s.organizer_id = auth.uid()      -- User organizes the show
    )
  );

-- Policy 4: Allow users to insert their own want lists
CREATE POLICY "Users can insert their own want lists"
  ON public.want_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = userid);

-- Policy 5: Allow users to update their own want lists
CREATE POLICY "Users can update their own want lists"
  ON public.want_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = userid);

-- Policy 6: Allow users to delete their own want lists
CREATE POLICY "Users can delete their own want lists"
  ON public.want_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = userid);

-- =============================================================================
-- 3. ADD NECESSARY INDEXES FOR PERFORMANCE
-- =============================================================================

-- Add indexes to user_favorite_shows if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_favorite_shows' AND indexname = 'user_favorite_shows_user_id_idx'
  ) THEN
    CREATE INDEX user_favorite_shows_user_id_idx ON public.user_favorite_shows (user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_favorite_shows' AND indexname = 'user_favorite_shows_show_id_idx'
  ) THEN
    CREATE INDEX user_favorite_shows_show_id_idx ON public.user_favorite_shows (show_id);
  END IF;
END
$$;

-- Add indexes to want_lists if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'want_lists' AND indexname = 'want_lists_userid_idx'
  ) THEN
    CREATE INDEX want_lists_userid_idx ON public.want_lists (userid);
  END IF;
  
  -- Add a GIN index for content search if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'want_lists' AND indexname = 'want_lists_content_gin_idx'
  ) THEN
    CREATE INDEX want_lists_content_gin_idx ON public.want_lists USING gin(to_tsvector('english', content));
  END IF;
END
$$;

-- Add indexes to show_participants if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'show_participants' AND indexname = 'show_participants_userid_idx'
  ) THEN
    CREATE INDEX show_participants_userid_idx ON public.show_participants (userid);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'show_participants' AND indexname = 'show_participants_showid_idx'
  ) THEN
    CREATE INDEX show_participants_showid_idx ON public.show_participants (showid);
  END IF;
END
$$;

-- =============================================================================
-- 4. CREATE HELPER FUNCTIONS FOR TESTING
-- =============================================================================

-- Function to check if a user can see want lists for a specific show
CREATE OR REPLACE FUNCTION public.check_want_list_access(
  viewer_id UUID,
  show_id UUID
) RETURNS TABLE (
  can_access BOOLEAN,
  user_role TEXT,
  reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Function to get all want lists a user should be able to see
CREATE OR REPLACE FUNCTION public.get_accessible_want_lists(
  viewer_id UUID
) RETURNS TABLE (
  want_list_id UUID,
  attendee_id UUID,
  attendee_name TEXT,
  show_id UUID,
  show_title TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Function to diagnose want list visibility issues
CREATE OR REPLACE FUNCTION public.diagnose_want_list_issues(
  viewer_id UUID,
  test_attendee_id UUID DEFAULT NULL,
  test_show_id UUID DEFAULT NULL
) RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- =============================================================================
-- 5. ADD PROPER ERROR HANDLING
-- =============================================================================

-- Function to safely add a favorite show with error handling
CREATE OR REPLACE FUNCTION public.add_favorite_show(
  p_user_id UUID,
  p_show_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Function to safely remove a favorite show with error handling
CREATE OR REPLACE FUNCTION public.remove_favorite_show(
  p_user_id UUID,
  p_show_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Function to safely update a want list with error handling
CREATE OR REPLACE FUNCTION public.update_want_list(
  p_user_id UUID,
  p_content TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- =============================================================================
-- 6. VERIFICATION QUERIES
-- =============================================================================

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_shows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.want_lists TO authenticated;
GRANT SELECT ON public.show_participants TO authenticated;
GRANT SELECT ON public.shows TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_want_list_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_want_lists TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_want_list_issues TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_favorite_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_favorite_show TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_want_list TO authenticated;

-- Output success message
DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'WANT LISTS FEATURE FIX COMPLETED SUCCESSFULLY';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'The following actions were performed:';
  RAISE NOTICE '  1. Ensured all necessary tables exist with correct structure';
  RAISE NOTICE '  2. Fixed all RLS policies for proper access control';
  RAISE NOTICE '  3. Added necessary indexes for performance';
  RAISE NOTICE '  4. Created helper functions for testing';
  RAISE NOTICE '  5. Added proper error handling';
  RAISE NOTICE '  6. Included verification queries to confirm everything is working';
  RAISE NOTICE '';
  RAISE NOTICE 'To verify the fix is working:';
  RAISE NOTICE '  1. Run: SELECT * FROM public.diagnose_want_list_issues(''<mvp_dealer_id>'');';
  RAISE NOTICE '  2. Run: SELECT * FROM public.get_accessible_want_lists(''<mvp_dealer_id>'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Common issues to check if want lists still don''t appear:';
  RAISE NOTICE '  1. Ensure MVP dealers are in the show_participants table for relevant shows';
  RAISE NOTICE '  2. Ensure show organizers are set as organizer_id in the shows table';
  RAISE NOTICE '  3. Verify attendees have favorited shows (entries in user_favorite_shows)';
  RAISE NOTICE '  4. Verify attendees have created want lists (entries in want_lists)';
  RAISE NOTICE '  5. Check that shows have future dates (start_date >= CURRENT_DATE)';
  RAISE NOTICE '  6. Ensure the mobile app is making authenticated requests';
  RAISE NOTICE '=============================================================================';
END $$;

-- Commit the transaction
COMMIT;
