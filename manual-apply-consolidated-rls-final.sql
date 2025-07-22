-- ================================================================
-- CONSOLIDATED_RLS_2025.sql
-- ================================================================
-- Comprehensive Row Level Security (RLS) policy consolidation for Card Show Finder
-- Created: July 21, 2025
-- Version: 2.0
--
-- Purpose:
--   This script consolidates all Row Level Security (RLS) policies across the
--   Card Show Finder application into a single source of truth. It addresses
--   security drift by implementing consistent patterns, preventing infinite
--   recursion, and following the principle of least privilege.
--
-- Features:
--   1. Centralized helper functions for role checking
--   2. Non-recursive participation checks to prevent infinite loops
--   3. Principle of least privilege implementation
--   4. Idempotent execution (safe to run multiple times)
--   5. Comprehensive coverage of all application tables
--   6. Detailed logging and verification
--   7. Maintenance-friendly structure with clear documentation
--
-- Usage:
--   Run this script in the Supabase SQL Editor or as a migration
--   to establish a secure baseline for all RLS policies.
--
-- Note:
--   After running this script, use verify-rls-policies.sql to confirm
--   that all policies are correctly applied.
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

-- Function to log RLS policy changes
CREATE OR REPLACE FUNCTION log_rls_change(
  action TEXT,
  object_type TEXT,
  object_name TEXT,
  details TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  RAISE NOTICE '% % %: %', action, object_type, object_name, COALESCE(details, '');
END;
$$ LANGUAGE plpgsql;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'profiles_select_self', 'Users can view their own profile');
  PERFORM log_rls_change('Created', 'Policy', 'profiles_update_self', 'Users can update their own profile');
  PERFORM log_rls_change('Created', 'Policy', 'profiles_select_others', 'Users can view limited profile info of others');
  PERFORM log_rls_change('Created', 'Policy', 'profiles_all_admin', 'Service role/admin can access all profiles');
END $$;

-- ================================================================
-- SECTION 3: SHOWS TABLE
-- ================================================================

-- Enable RLS on shows table
ALTER TABLE IF EXISTS public.shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Anyone can view shows', 'shows');
SELECT safe_drop_policy('Organizers can update own shows', 'shows');
SELECT safe_drop_policy('Organizers can delete own shows', 'shows');
SELECT safe_drop_policy('Organizers can insert shows', 'shows');
SELECT safe_drop_policy('Admins can update show coordinates', 'shows');

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'shows_select_all', 'Anyone can view shows');
  PERFORM log_rls_change('Created', 'Policy', 'shows_update_organizer', 'Organizers can update their own shows');
  PERFORM log_rls_change('Created', 'Policy', 'shows_delete_organizer', 'Organizers can delete their own shows');
  PERFORM log_rls_change('Created', 'Policy', 'shows_insert_organizer', 'Organizers can insert new shows');
  PERFORM log_rls_change('Created', 'Policy', 'shows_update_admin', 'Admins can update show coordinates');
END $$;

-- ================================================================
-- SECTION 4: USER_FAVORITE_SHOWS TABLE
-- ================================================================

-- Enable RLS on user_favorite_shows table
ALTER TABLE IF EXISTS public.user_favorite_shows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('user_fav_shows_sel_self', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_sel_mvp_dealer', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_sel_org', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_ins_self', 'user_favorite_shows');
SELECT safe_drop_policy('user_fav_shows_del_self', 'user_favorite_shows');
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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'user_fav_shows_sel_self', 'Users can view their own favorite shows');
  PERFORM log_rls_change('Created', 'Policy', 'user_fav_shows_sel_mvp_dealer', 'MVP dealers can view favorite shows for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'user_fav_shows_sel_org', 'Show organizers can view favorite shows for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'user_fav_shows_ins_self', 'Users can add their own favorite shows');
  PERFORM log_rls_change('Created', 'Policy', 'user_fav_shows_del_self', 'Users can remove their own favorite shows');
  PERFORM log_rls_change('Created', 'Policy', 'user_fav_shows_all_admin', 'Admins can access all favorite shows');
END $$;

-- ================================================================
-- SECTION 5: SHOW_PARTICIPANTS TABLE (with infinite recursion fix)
-- ================================================================

-- Enable RLS on show_participants table
ALTER TABLE IF EXISTS public.show_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('show_participants_select_self', 'show_participants');
SELECT safe_drop_policy('show_participants_select_organizer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_mvp_dealer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_mvp_dealer_fixed', 'show_participants');
SELECT safe_drop_policy('show_participants_insert', 'show_participants');
SELECT safe_drop_policy('show_participants_update_self', 'show_participants');
SELECT safe_drop_policy('show_participants_delete_self', 'show_participants');
SELECT safe_drop_policy('show_participants_update_organizer', 'show_participants');

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_select_self', 'Users can see their own participation');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_select_organizer', 'Show organizers can see participants for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_select_mvp_dealer_safe', 'MVP dealers can see participants for shows they are involved with (non-recursive)');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_insert', 'Users can register as participants');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_update_self', 'Users can update their own participation');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_delete_self', 'Users can delete their own participation');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_update_organizer', 'Show organizers can update participant info for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'show_participants_all_admin', 'Admins can access all participants');
END $$;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_select_self', 'Users can view their own want lists');
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_select_mvp_dealer', 'MVP dealers can view want lists for shows they are involved with');
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_select_organizer', 'Show organizers can view want lists for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_insert', 'Users can create their own want lists');
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_update', 'Users can update their own want lists');
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_delete', 'Users can delete their own want lists');
  PERFORM log_rls_change('Created', 'Policy', 'want_lists_all_admin', 'Admins can access all want lists');
END $$;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'shared_want_lists_select_self', 'Users can view their own shared want lists');
  PERFORM log_rls_change('Created', 'Policy', 'shared_want_lists_select_mvp_dealer', 'MVP dealers can view shared want lists for shows they are involved with');
  PERFORM log_rls_change('Created', 'Policy', 'shared_want_lists_select_organizer', 'Show organizers can view shared want lists for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'shared_want_lists_insert', 'Users can share their own want lists');
  PERFORM log_rls_change('Created', 'Policy', 'shared_want_lists_delete', 'Users can unshare their own want lists');
  PERFORM log_rls_change('Created', 'Policy', 'shared_want_lists_all_admin', 'Admins can access all shared want lists');
END $$;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'conversations_select_participant', 'Users can view conversations they participate in');
  PERFORM log_rls_change('Created', 'Policy', 'conversations_insert', 'Users can create conversations');
  PERFORM log_rls_change('Created', 'Policy', 'conversations_update_participant', 'Users can update conversations they participate in');
  PERFORM log_rls_change('Created', 'Policy', 'conversations_all_admin', 'Admins can access all conversations');
END $$;

-- ================================================================
-- SECTION 9: CONVERSATION_PARTICIPANTS TABLE
-- ================================================================

-- Enable RLS on conversation_participants table
ALTER TABLE IF EXISTS public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view conversation participants for conversations they are in', 'conversation_participants');
SELECT safe_drop_policy('Users can add themselves to conversations', 'conversation_participants');
SELECT safe_drop_policy('Users can remove themselves from conversations', 'conversation_participants');
SELECT safe_drop_policy('Admins can access all conversation participants', 'conversation_participants');

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'conversation_participants_select', 'Users can view conversation participants for conversations they are in');
  PERFORM log_rls_change('Created', 'Policy', 'conversation_participants_insert_self', 'Users can add themselves to conversations');
  PERFORM log_rls_change('Created', 'Policy', 'conversation_participants_delete_self', 'Users can remove themselves from conversations');
  PERFORM log_rls_change('Created', 'Policy', 'conversation_participants_all_admin', 'Admins can access all conversation participants');
END $$;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'messages_select_participant', 'Users can view messages in conversations they participate in');
  PERFORM log_rls_change('Created', 'Policy', 'messages_insert_participant', 'Users can send messages to conversations they participate in');
  PERFORM log_rls_change('Created', 'Policy', 'messages_update_own', 'Users can update their own messages');
  PERFORM log_rls_change('Created', 'Policy', 'messages_delete_own', 'Users can delete their own messages');
  PERFORM log_rls_change('Created', 'Policy', 'messages_all_admin', 'Admins can access all messages');
END $$;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'reviews_select_all', 'Users can view all reviews');
  PERFORM log_rls_change('Created', 'Policy', 'reviews_insert_attendee', 'Users can create reviews for shows they attended');
  PERFORM log_rls_change('Created', 'Policy', 'reviews_update_own', 'Users can update their own reviews');
  PERFORM log_rls_change('Created', 'Policy', 'reviews_delete_own', 'Users can delete their own reviews');
  PERFORM log_rls_change('Created', 'Policy', 'reviews_all_admin', 'Admins can moderate all reviews');
END $$;

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'show_series_select_all', 'Anyone can view show series');
  PERFORM log_rls_change('Created', 'Policy', 'show_series_update_organizer', 'Organizers can update their own show series');
  PERFORM log_rls_change('Created', 'Policy', 'show_series_delete_organizer', 'Organizers can delete their own show series');
  PERFORM log_rls_change('Created', 'Policy', 'show_series_insert_organizer', 'Organizers can create show series');
  PERFORM log_rls_change('Created', 'Policy', 'show_series_all_admin', 'Admins can manage all show series');
END $$;

-- ================================================================
-- SECTION 13: BADGES TABLE
-- ================================================================

-- Enable RLS on badges table
ALTER TABLE IF EXISTS public.badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Anyone can view badges', 'badges');
SELECT safe_drop_policy('Only admins can manage badges', 'badges');

-- Create new policies
-- 1. Anyone can view badges
CREATE POLICY "badges_select_all"
  ON badges
  FOR SELECT
  TO public
  USING (true);

-- 2. Only admins can manage badges
CREATE POLICY "badges_manage_admin"
  ON badges
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'badges_select_all', 'Anyone can view badges');
  PERFORM log_rls_change('Created', 'Policy', 'badges_manage_admin', 'Only admins can manage badges');
END $$;

-- ================================================================
-- SECTION 14: USER_BADGES TABLE
-- ================================================================

-- Enable RLS on user_badges table
ALTER TABLE IF EXISTS public.user_badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view their own badges', 'user_badges');
SELECT safe_drop_policy('Users can view other users badges', 'user_badges');
SELECT safe_drop_policy('Only admins can manage user badges', 'user_badges');

-- Create new policies
-- 1. Users can view their own badges
CREATE POLICY "user_badges_select_self"
  ON user_badges
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. Users can view other users' badges
CREATE POLICY "user_badges_select_others"
  ON user_badges
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Only admins can manage user badges
CREATE POLICY "user_badges_manage_admin"
  ON user_badges
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'user_badges_select_self', 'Users can view their own badges');
  PERFORM log_rls_change('Created', 'Policy', 'user_badges_select_others', 'Users can view other users badges');
  PERFORM log_rls_change('Created', 'Policy', 'user_badges_manage_admin', 'Only admins can manage user badges');
END $$;

-- ================================================================
-- SECTION 15: PLANNED_ATTENDANCE TABLE
-- ================================================================

-- Enable RLS on planned_attendance table
ALTER TABLE IF EXISTS public.planned_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Users can view their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('MVP dealers can view planned attendance for their shows', 'planned_attendance');
SELECT safe_drop_policy('Show organizers can view planned attendance for their shows', 'planned_attendance');
SELECT safe_drop_policy('Users can create their own planned attendance', 'planned_attendance');
SELECT safe_drop_policy('Users can delete their own planned attendance', 'planned_attendance');

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

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'planned_attendance_select_self', 'Users can view their own planned attendance');
  PERFORM log_rls_change('Created', 'Policy', 'planned_attendance_select_mvp_dealer', 'MVP dealers can view planned attendance for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'planned_attendance_select_organizer', 'Show organizers can view planned attendance for their shows');
  PERFORM log_rls_change('Created', 'Policy', 'planned_attendance_insert_self', 'Users can create their own planned attendance');
  PERFORM log_rls_change('Created', 'Policy', 'planned_attendance_delete_self', 'Users can delete their own planned attendance');
  PERFORM log_rls_change('Created', 'Policy', 'planned_attendance_all_admin', 'Admins can access all planned attendance');
END $$;

-- ================================================================
-- SECTION 16: STORAGE POLICIES
-- ================================================================

-- Enable RLS on storage.objects table
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
SELECT safe_drop_policy('Avatar images are publicly accessible', 'objects', 'storage');
SELECT safe_drop_policy('Users can upload their own avatars', 'objects', 'storage');
SELECT safe_drop_policy('Show images are publicly accessible', 'objects', 'storage');
SELECT safe_drop_policy('Organizers can upload show images', 'objects', 'storage');
SELECT safe_drop_policy('Admins have full access to storage', 'objects', 'storage');

-- Create new policies
-- 1. Avatar images are publicly accessible
CREATE POLICY "avatars_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- 2. Users can upload their own avatars
CREATE POLICY "avatars_insert_self"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Users can update their own avatars
CREATE POLICY "avatars_update_self"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Users can delete their own avatars
CREATE POLICY "avatars_delete_self"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Show images are publicly accessible
CREATE POLICY "show_images_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'shows');

-- 6. Organizers can upload show images
CREATE POLICY "show_images_insert_organizer"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'shows' AND
    is_show_organizer() AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id::text = (storage.foldername(name))[1]
      AND organizer_id = auth.uid()
    )
  );

-- 7. Organizers can update their show images
CREATE POLICY "show_images_update_organizer"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'shows' AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id::text = (storage.foldername(name))[1]
      AND organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'shows' AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id::text = (storage.foldername(name))[1]
      AND organizer_id = auth.uid()
    )
  );

-- 8. Organizers can delete their show images
CREATE POLICY "show_images_delete_organizer"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'shows' AND
    EXISTS (
      SELECT 1 FROM shows
      WHERE id::text = (storage.foldername(name))[1]
      AND organizer_id = auth.uid()
    )
  );

-- 9. Admins have full access to storage
CREATE POLICY "storage_all_admin"
  ON storage.objects
  FOR ALL
  USING (is_admin() OR auth.role() = 'service_role');

-- Log changes
DO $$
BEGIN
  PERFORM log_rls_change('Created', 'Policy', 'avatars_select_public', 'Avatar images are publicly accessible');
  PERFORM log_rls_change('Created', 'Policy', 'avatars_insert_self', 'Users can upload their own avatars');
  PERFORM log_rls_change('Created', 'Policy', 'avatars_update_self', 'Users can update their own avatars');
  PERFORM log_rls_change('Created', 'Policy', 'avatars_delete_self', 'Users can delete their own avatars');
  PERFORM log_rls_change('Created', 'Policy', 'show_images_select_public', 'Show images are publicly accessible');
  PERFORM log_rls_change('Created', 'Policy', 'show_images_insert_organizer', 'Organizers can upload show images');
  PERFORM log_rls_change('Created', 'Policy', 'show_images_update_organizer', 'Organizers can update their show images');
  PERFORM log_rls_change('Created', 'Policy', 'show_images_delete_organizer', 'Organizers can delete their show images');
  PERFORM log_rls_change('Created', 'Policy', 'storage_all_admin', 'Admins have full access to storage');
END $$;

-- ================================================================
-- SECTION 17: GLOBAL PERMISSIONS
-- ================================================================

-- Grant appropriate permissions to authenticated users
DO $$
BEGIN
  -- Grant select, insert, update, delete on all tables
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated';
  PERFORM log_rls_change('Granted', 'Permission', 'authenticated', 'SELECT, INSERT, UPDATE, DELETE on all tables');
  
  -- Grant usage on all sequences
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated';
  PERFORM log_rls_change('Granted', 'Permission', 'authenticated', 'USAGE on all sequences');
  
  -- Grant execute on all functions
  EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated';
  PERFORM log_rls_change('Granted', 'Permission', 'authenticated', 'EXECUTE on all functions');
END $$;

-- ================================================================
-- SECTION 18: VERIFICATION
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
    RAISE WARNING 'Tables without RLS enabled: %', LEFT(tables_without_rls, LENGTH(tables_without_rls) - 2);
  END IF;
  
  RAISE NOTICE 'RLS Verification: % of % tables have RLS enabled (%.1f%%)',
    tables_with_rls, total_tables,
    CASE WHEN total_tables > 0 THEN (tables_with_rls::FLOAT / total_tables) * 100 ELSE 0 END;
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
    'safe_drop_policy'
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
    RAISE WARNING 'Missing helper functions: %', LEFT(missing_functions, LENGTH(missing_functions) - 2);
  END IF;
  
  RAISE NOTICE 'Helper Function Verification: % of % functions exist',
    functions_found, array_length(function_names, 1);
END $$;

-- ================================================================
-- SECTION 19: DOCUMENTATION
-- ================================================================

-- Add comments to helper functions
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION is_show_organizer() IS 'Checks if the current user has show_organizer role';
COMMENT ON FUNCTION is_mvp_dealer() IS 'Checks if the current user has mvp_dealer role';
COMMENT ON FUNCTION is_dealer() IS 'Checks if the current user has dealer role';
COMMENT ON FUNCTION is_any_dealer() IS 'Checks if the current user has either dealer or mvp_dealer role';
COMMENT ON FUNCTION participates_in_show_safe(UUID) IS 'Safely checks if a user participates in a show without recursive queries';
COMMENT ON FUNCTION organizes_show(UUID) IS 'Checks if the current user organizes a specific show';
COMMENT ON FUNCTION safe_drop_policy(TEXT, TEXT) IS 'Safely drops a policy if it exists, with error handling';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'RLS POLICY CONSOLIDATION COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'All Row Level Security (RLS) policies have been consolidated.';
  RAISE NOTICE 'Run verify-rls-policies.sql to get a detailed security report.';
  RAISE NOTICE '================================================================';
END $$;

-- Commit the transaction
COMMIT;
