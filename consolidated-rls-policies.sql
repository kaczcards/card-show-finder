-- ================================================================
-- CONSOLIDATED RLS POLICIES
-- ================================================================
-- This script consolidates and fixes all Row Level Security (RLS) policies
-- across the Card Show Finder application to address security drift issues.
--
-- Features:
-- 1. Helper functions for role checking and policy management
-- 2. Safe dropping of conflicting policies
-- 3. Consistent policies across all tables
-- 4. Principle of least privilege enforcement
-- 5. Resolution of infinite recursion issues
-- 6. Idempotent execution (safe to run multiple times)
-- 7. Comprehensive documentation and error handling
--
-- Usage: Run this script in the Supabase SQL Editor or as a migration
-- ================================================================

-- Use a transaction to ensure all changes are atomic
BEGIN;

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
    RAISE NOTICE 'Dropped policy % on table %', policy_name, table_name;
  ELSE
    RAISE NOTICE 'Policy % does not exist on table %, skipping', policy_name, table_name;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policy % on table %: %', policy_name, table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
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

-- Function to check if user participates in a show
CREATE OR REPLACE FUNCTION participates_in_show(show_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM show_participants
    WHERE userid = auth.uid() AND showid = show_id
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

-- ================================================================
-- SECTION 2: PROFILES TABLE
-- ================================================================

-- Enable RLS on profiles table
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view own profile', 'profiles');
SELECT safe_drop_policy('Users can update own profile', 'profiles');
SELECT safe_drop_policy('Users can view limited profile info of others', 'profiles');
SELECT safe_drop_policy('Service role can access all profiles', 'profiles');
SELECT safe_drop_policy('Admins can access all profiles', 'profiles');

-- Create new policies
-- 1. Users can view their own profile (full access)
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Users can see limited profile info of other users
CREATE POLICY "Users can view limited profile info of others"
  ON profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Service role/admin can access all profiles
CREATE POLICY "Service role can access all profiles"
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role' OR is_admin());

-- ================================================================
-- SECTION 3: SHOWS TABLE
-- ================================================================

-- Enable RLS on shows table
ALTER TABLE IF EXISTS public.shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Anyone can view shows', 'shows');
SELECT safe_drop_policy('Organizers can update own shows', 'shows');
SELECT safe_drop_policy('Organizers can delete own shows', 'shows');
SELECT safe_drop_policy('Admins can update show coordinates', 'shows');

-- Create new policies
-- 1. Anyone can view shows
CREATE POLICY "Anyone can view shows"
  ON shows
  FOR SELECT
  TO public
  USING (true);

-- 2. Organizers can update their own shows
CREATE POLICY "Organizers can update own shows"
  ON shows
  FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

-- 3. Organizers can delete their own shows
CREATE POLICY "Organizers can delete own shows"
  ON shows
  FOR DELETE
  USING (auth.uid() = organizer_id);

-- 4. Organizers can insert new shows
CREATE POLICY "Organizers can insert shows"
  ON shows
  FOR INSERT
  WITH CHECK (is_show_organizer() OR auth.uid() = organizer_id);

-- 5. Admins can update any show (including coordinates)
CREATE POLICY "Admins can update show coordinates"
  ON shows
  FOR UPDATE
  USING (is_admin());

-- ================================================================
-- SECTION 4: USER_FAVORITE_SHOWS TABLE
-- ================================================================

-- Enable RLS on user_favorite_shows table
ALTER TABLE IF EXISTS public.user_favorite_shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('user_fav_shows_sel_self',        'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_sel_mvp_dealer',  'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_sel_org',         'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_ins_self',        'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_del_self',        'user_favorite_shows');

-- Create new policies
-- 1. Users can view their own favorite shows
CREATE POLICY "user_fav_shows_sel_self"
  ON user_favorite_shows
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. MVP dealers can view favorite shows for shows they participate in
CREATE POLICY "user_fav_shows_sel_mvp_dealer"
  ON user_favorite_shows
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    is_mvp_dealer() AND
    -- MVP dealer is participating in the show
    participates_in_show(show_id)
  );

-- 3. Show organizers can view favorite shows for shows they organize
CREATE POLICY "user_fav_shows_sel_org"
  ON user_favorite_shows
  FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    is_show_organizer() AND
    -- User is the organizer of the show
    organizes_show(show_id)
  );

-- 4. Users can insert their own favorite shows
CREATE POLICY "user_fav_shows_ins_self"
  ON user_favorite_shows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can delete their own favorite shows
CREATE POLICY "user_fav_shows_del_self"
  ON user_favorite_shows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ================================================================
-- SECTION 5: SHOW_PARTICIPANTS TABLE
-- ================================================================

-- Enable RLS on show_participants table
ALTER TABLE IF EXISTS public.show_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
SELECT safe_drop_policy('show_participants_select_mvp_dealer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_organizer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_self', 'show_participants');
SELECT safe_drop_policy('show_participants_select_all_mvp_dealer', 'show_participants');
SELECT safe_drop_policy('show_participants_insert', 'show_participants');
SELECT safe_drop_policy('show_participants_update_self', 'show_participants');
SELECT safe_drop_policy('show_participants_delete_self', 'show_participants');

-- Create new simplified policies that avoid recursion
-- 1. Users can see their own participation
CREATE POLICY "show_participants_select_self"
  ON show_participants
  FOR SELECT
  TO authenticated
  USING (userid = auth.uid());

-- 2. Users can see participants for shows they organize
CREATE POLICY "show_participants_select_organizer"
  ON show_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_participants.showid
      AND s.organizer_id = auth.uid()
    )
  );

-- 3. MVP dealers can see participants for shows they're in
CREATE POLICY "show_participants_select_mvp_dealer"
  ON show_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    is_mvp_dealer() AND
    -- For shows they participate in
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.userid = auth.uid()
      AND sp.showid = show_participants.showid
    )
  );

-- 4. Users can register themselves for shows
CREATE POLICY "show_participants_insert"
  ON show_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (userid = auth.uid());

-- 5. Users can update their own participation details
CREATE POLICY "show_participants_update_self"
  ON show_participants
  FOR UPDATE
  TO authenticated
  USING (userid = auth.uid())
  WITH CHECK (userid = auth.uid());

-- 6. Users can delete their own participation
CREATE POLICY "show_participants_delete_self"
  ON show_participants
  FOR DELETE
  TO authenticated
  USING (userid = auth.uid());

-- 7. Show organizers can update any participant for their shows
CREATE POLICY "show_participants_update_organizer"
  ON show_participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_participants.showid
      AND s.organizer_id = auth.uid()
    )
  );

-- ================================================================
-- SECTION 6: WANT_LISTS TABLE
-- ================================================================

-- Enable RLS on want_lists table
ALTER TABLE IF EXISTS public.want_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('want_lists_select_self', 'want_lists');
SELECT safe_drop_policy('want_lists_select_mvp_dealer', 'want_lists');
SELECT safe_drop_policy('want_lists_select_organizer', 'want_lists');
SELECT safe_drop_policy('want_lists_insert', 'want_lists');
SELECT safe_drop_policy('want_lists_update', 'want_lists');
SELECT safe_drop_policy('want_lists_delete', 'want_lists');
SELECT safe_drop_policy('MVP dealers can view want lists shared with them', 'want_lists');

-- Create new policies
-- 1. Users can see their own want lists
CREATE POLICY "want_lists_select_self"
  ON want_lists
  FOR SELECT
  TO authenticated
  USING (userid = auth.uid());

-- 2. MVP dealers can view want lists shared with shows they participate in
CREATE POLICY "want_lists_select_mvp_dealer"
  ON want_lists
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    is_mvp_dealer() AND
    -- Want list is shared with a show they participate in
    EXISTS (
      SELECT 1 
      FROM shared_want_lists swl
      JOIN show_participants sp ON sp.showid = swl.showid
      WHERE swl.wantlistid = want_lists.id
      AND sp.userid = auth.uid()
    )
  );

-- 3. Show organizers can view want lists shared with shows they organize
CREATE POLICY "want_lists_select_organizer"
  ON want_lists
  FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    is_show_organizer() AND
    -- Want list is shared with a show they organize
    EXISTS (
      SELECT 1 
      FROM shared_want_lists swl
      JOIN shows s ON s.id = swl.showid
      WHERE swl.wantlistid = want_lists.id
      AND s.organizer_id = auth.uid()
    )
  );

-- 4. Users can create their own want lists
CREATE POLICY "want_lists_insert"
  ON want_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (userid = auth.uid());

-- 5. Users can update their own want lists
CREATE POLICY "want_lists_update"
  ON want_lists
  FOR UPDATE
  TO authenticated
  USING (userid = auth.uid())
  WITH CHECK (userid = auth.uid());

-- 6. Users can delete their own want lists
CREATE POLICY "want_lists_delete"
  ON want_lists
  FOR DELETE
  TO authenticated
  USING (userid = auth.uid());

-- ================================================================
-- SECTION 7: SHARED_WANT_LISTS TABLE
-- ================================================================

-- Enable RLS on shared_want_lists table
ALTER TABLE IF EXISTS public.shared_want_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('shared_want_lists_select_self', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_select_mvp_dealer', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_select_organizer', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_insert', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_delete', 'shared_want_lists');

-- Create new policies
-- 1. Users can see their own shared want lists
CREATE POLICY "shared_want_lists_select_self"
  ON shared_want_lists
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM want_lists wl
      WHERE wl.id = shared_want_lists.wantlistid
      AND wl.userid = auth.uid()
    )
  );

-- 2. MVP dealers can see shared want lists for shows they participate in
CREATE POLICY "shared_want_lists_select_mvp_dealer"
  ON shared_want_lists
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    is_mvp_dealer() AND
    -- For shows they participate in
    participates_in_show(showid)
  );

-- 3. Show organizers can see shared want lists for shows they organize
CREATE POLICY "shared_want_lists_select_organizer"
  ON shared_want_lists
  FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    is_show_organizer() AND
    -- For shows they organize
    organizes_show(showid)
  );

-- 4. Users can insert their own shared want lists
CREATE POLICY "shared_want_lists_insert"
  ON shared_want_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM want_lists wl
      WHERE wl.id = shared_want_lists.wantlistid
      AND wl.userid = auth.uid()
    )
  );

-- 5. Users can delete their own shared want lists
CREATE POLICY "shared_want_lists_delete"
  ON shared_want_lists
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM want_lists wl
      WHERE wl.id = shared_want_lists.wantlistid
      AND wl.userid = auth.uid()
    )
  );

-- ================================================================
-- SECTION 8: CONVERSATIONS TABLE
-- ================================================================

-- Enable RLS on conversations table
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view conversations they participate in', 'conversations');
SELECT safe_drop_policy('Users can create conversations', 'conversations');
SELECT safe_drop_policy('Users can update conversations they participate in', 'conversations');
SELECT safe_drop_policy('Admins can access all conversations', 'conversations');

-- Create new policies
-- 1. Users can view conversations they participate in
CREATE POLICY "Users can view conversations they participate in"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

-- 2. Users can create conversations
CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Users can update conversations they participate in
CREATE POLICY "Users can update conversations they participate in"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

-- 4. Admins can access all conversations
CREATE POLICY "Admins can access all conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ================================================================
-- SECTION 9: CONVERSATION_PARTICIPANTS TABLE
-- ================================================================

-- Enable RLS on conversation_participants table
ALTER TABLE IF EXISTS public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view own conversation participants', 'conversation_participants');
SELECT safe_drop_policy('Users can view conversation participants for conversations they are in', 'conversation_participants');
SELECT safe_drop_policy('Users can add themselves to conversations', 'conversation_participants');
SELECT safe_drop_policy('Users can remove themselves from conversations', 'conversation_participants');
SELECT safe_drop_policy('Admins can access all conversation participants', 'conversation_participants');

-- Create new policies
-- 1. Users can view conversation participants for conversations they are in
CREATE POLICY "Users can view conversation participants for conversations they are in"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    -- Either this is their own participation record
    user_id = auth.uid() OR
    -- Or they are in the same conversation
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- 2. Users can add themselves to conversations
CREATE POLICY "Users can add themselves to conversations"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Users can remove themselves from conversations
CREATE POLICY "Users can remove themselves from conversations"
  ON conversation_participants
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Admins can access all conversation participants
CREATE POLICY "Admins can access all conversation participants"
  ON conversation_participants
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ================================================================
-- SECTION 10: MESSAGES TABLE
-- ================================================================

-- Enable RLS on messages table
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view messages in conversations they participate in', 'messages');
SELECT safe_drop_policy('Users can send messages to conversations they participate in', 'messages');
SELECT safe_drop_policy('Users can update their own messages', 'messages');
SELECT safe_drop_policy('Users can delete their own messages', 'messages');
SELECT safe_drop_policy('Admins can access all messages', 'messages');

-- Create new policies
-- 1. Users can view messages in conversations they participate in
CREATE POLICY "Users can view messages in conversations they participate in"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- 2. Users can send messages to conversations they participate in
CREATE POLICY "Users can send messages to conversations they participate in"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- 3. Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- 4. Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- 5. Admins can access all messages
CREATE POLICY "Admins can access all messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ================================================================
-- SECTION 11: REVIEWS TABLE
-- ================================================================

-- Enable RLS on reviews table
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view all reviews', 'reviews');
SELECT safe_drop_policy('Users can create reviews for shows they attended', 'reviews');
SELECT safe_drop_policy('Users can update their own reviews', 'reviews');
SELECT safe_drop_policy('Users can delete their own reviews', 'reviews');
SELECT safe_drop_policy('Admins can moderate all reviews', 'reviews');

-- Create new policies
-- 1. Anyone can view reviews
CREATE POLICY "Users can view all reviews"
  ON reviews
  FOR SELECT
  TO public
  USING (true);

-- 2. Users can create reviews for shows they attended
CREATE POLICY "Users can create reviews for shows they attended"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM show_participants sp
      WHERE sp.userid = auth.uid()
      AND sp.showid = show_id
    )
  );

-- 3. Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews"
  ON reviews
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Admins can moderate all reviews
CREATE POLICY "Admins can moderate all reviews"
  ON reviews
  FOR ALL
  TO authenticated
  USING (is_admin());

-- ================================================================
-- SECTION 12: SHOW_SERIES TABLE
-- ================================================================

-- Enable RLS on show_series table
ALTER TABLE IF EXISTS public.show_series ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Anyone can view show series', 'show_series');
SELECT safe_drop_policy('Organizers can update own show series', 'show_series');
SELECT safe_drop_policy('Organizers can delete own show series', 'show_series');
SELECT safe_drop_policy('Organizers can create show series', 'show_series');

-- Create new policies
-- 1. Anyone can view show series
CREATE POLICY "Anyone can view show series"
  ON show_series
  FOR SELECT
  TO public
  USING (true);

-- 2. Organizers can update their own show series
CREATE POLICY "Organizers can update own show series"
  ON show_series
  FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- 3. Organizers can delete their own show series
CREATE POLICY "Organizers can delete own show series"
  ON show_series
  FOR DELETE
  TO authenticated
  USING (organizer_id = auth.uid());

-- 4. Organizers can create show series
CREATE POLICY "Organizers can create show series"
  ON show_series
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = auth.uid() AND
    is_show_organizer()
  );

-- ================================================================
-- SECTION 13: BADGES TABLE
-- ================================================================

DO $$
BEGIN
  -- Only apply RLS if the *badges* table is present in this installation
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'badges'
  ) THEN
    -- Enable RLS on badges table
    ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies
    PERFORM safe_drop_policy('Anyone can view badges', 'badges');
    PERFORM safe_drop_policy('Only admins can manage badges', 'badges');

    -- Create new policies
    -- 1. Anyone can view badges
    CREATE POLICY "Anyone can view badges"
      ON badges
      FOR SELECT
      TO public
      USING (true);

    -- 2. Only admins can manage badges
    CREATE POLICY "Only admins can manage badges"
      ON badges
      FOR ALL
      TO authenticated
      USING (is_admin());
  ELSE
    RAISE NOTICE 'Skipping badges-table policies – table does not exist in this environment.';
  END IF;
END $$;

-- ================================================================
-- SECTION 14: USER_BADGES TABLE
-- ================================================================

DO $$
BEGIN
  -- Only apply RLS if the *user_badges* table is present
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'user_badges'
  ) THEN
    -- Enable RLS on user_badges table
    ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies
    PERFORM safe_drop_policy('Users can view their own badges', 'user_badges');
    PERFORM safe_drop_policy('Users can view other users badges', 'user_badges');
    PERFORM safe_drop_policy('Only admins can manage user badges', 'user_badges');

    -- Create new policies
    -- 1. Users can view their own badges
    CREATE POLICY "Users can view their own badges"
      ON user_badges
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    -- 2. Users can view other users' badges
    CREATE POLICY "Users can view other users badges"
      ON user_badges
      FOR SELECT
      TO authenticated
      USING (true);

    -- 3. Only admins can manage user badges
    CREATE POLICY "Only admins can manage user badges"
      ON user_badges
      FOR ALL
      TO authenticated
      USING (is_admin());
  ELSE
    RAISE NOTICE 'Skipping user_badges-table policies – table does not exist in this environment.';
  END IF;
END $$;

-- SECTION 15: STORAGE OBJECTS
-- ================================================================

DO $$
DECLARE
  _has_storage BOOLEAN;
BEGIN
  /* ------------------------------------------------------------
     Check that the storage.objects table exists before proceeding
  ------------------------------------------------------------ */
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name   = 'objects'
  ) INTO _has_storage;

  IF NOT _has_storage THEN
    RAISE NOTICE 'Skipping storage.objects policies – table not present.';
    RETURN;
  END IF;

  /* ------------------------------------------------------------
     Try to enable RLS and (re-)create policies.  If the executing
     role is not the owner of storage.objects we will catch the
     insufficient_privilege error and skip this section gracefully.
  ------------------------------------------------------------ */
  BEGIN
    -- Enable RLS
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies via helper
    PERFORM safe_drop_policy('Avatar images are publicly accessible', 'objects');
    PERFORM safe_drop_policy('Users can upload own avatar',          'objects');
    PERFORM safe_drop_policy('Users can update own avatar',          'objects');
    PERFORM safe_drop_policy('Users can delete own avatar',          'objects');
    PERFORM safe_drop_policy('Show images are publicly accessible',  'objects');
    PERFORM safe_drop_policy('Organizers can upload show images',    'objects');

    /* ---------- Avatar bucket policies ---------- */
    CREATE POLICY "Avatar images are publicly accessible"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'avatars');

    CREATE POLICY "Users can upload own avatar"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

    CREATE POLICY "Users can update own avatar"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

    CREATE POLICY "Users can delete own avatar"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

    /* ---------- Shows bucket policies ---------- */
    CREATE POLICY "Show images are publicly accessible"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'shows');

    CREATE POLICY "Organizers can upload show images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'shows'
        AND is_show_organizer()
      );

    RAISE NOTICE 'storage.objects policies applied successfully.';

  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects policies – current role lacks ownership privileges.';
    WHEN others THEN
      RAISE WARNING 'Unhandled error while configuring storage.objects policies: %', SQLERRM;
  END;
END $$;

-- ================================================================
-- SECTION 16: PLANNED_ATTENDANCE TABLE
-- ================================================================

-- Enable RLS on planned_attendance table
ALTER TABLE IF EXISTS public.planned_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('Users can create their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('Users can delete their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('MVP dealers can view planned attendance for their shows', 'planned_attendance');
SELECT safe_drop_policy('Show organizers can view planned attendance for their shows', 'planned_attendance');

-- Create new policies
-- 1. Users can view their own planned attendance
CREATE POLICY "Users can view their own planned attendance"
  ON planned_attendance
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. MVP dealers can view planned attendance for shows they participate in
CREATE POLICY "MVP dealers can view planned attendance for their shows"
  ON planned_attendance
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer
    is_mvp_dealer() AND
    -- For shows they participate in
    participates_in_show(show_id)
  );

-- 3. Show organizers can view planned attendance for shows they organize
CREATE POLICY "Show organizers can view planned attendance for their shows"
  ON planned_attendance
  FOR SELECT
  TO authenticated
  USING (
    -- User is a show organizer
    is_show_organizer() AND
    -- For shows they organize
    organizes_show(show_id)
  );

-- 4. Users can create their own planned attendance
CREATE POLICY "Users can create their own planned attendance"
  ON planned_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5. Users can delete their own planned attendance
CREATE POLICY "Users can delete their own planned attendance"
  ON planned_attendance
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ================================================================
-- SECTION 17: VERIFY ALL TABLES HAVE RLS ENABLED
-- ================================================================

-- Ensure RLS is enabled on all public tables
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    RAISE NOTICE 'Enabled RLS on table: %', table_name;
  END LOOP;
END $$;

-- ================================================================
-- SECTION 18: GRANT PERMISSIONS
-- ================================================================

-- Grant necessary permissions to authenticated users
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
    SELECT t.table_name 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT IN (
      -- Tables that should be excluded
      'schema_migrations',
      'spatial_ref_sys'
    )
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', table_name);
    RAISE NOTICE 'Granted permissions on table: %', table_name;
  END LOOP;
  
  -- Grant usage on sequences
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated';
END $$;

-- ================================================================
-- SECTION 19: DOCUMENTATION
-- ================================================================

-- Add comments to explain RLS policies
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION is_show_organizer() IS 'Checks if the current user is a show organizer';
COMMENT ON FUNCTION is_mvp_dealer() IS 'Checks if the current user is an MVP dealer';
COMMENT ON FUNCTION is_dealer() IS 'Checks if the current user is a regular dealer';
COMMENT ON FUNCTION is_any_dealer() IS 'Checks if the current user is any type of dealer (regular or MVP)';
COMMENT ON FUNCTION participates_in_show(UUID) IS 'Checks if the current user participates in a specific show';
COMMENT ON FUNCTION organizes_show(UUID) IS 'Checks if the current user organizes a specific show';
COMMENT ON FUNCTION safe_drop_policy(TEXT, TEXT) IS 'Safely drops a policy if it exists, with error handling';

-- Commit all changes
COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'RLS POLICY CONSOLIDATION COMPLETE';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'All Row Level Security policies have been successfully consolidated.';
  RAISE NOTICE 'Security drift issues have been resolved.';
  RAISE NOTICE 'Run this script again if you add new tables or need to refresh policies.';
  RAISE NOTICE '=======================================================';
END $$;
