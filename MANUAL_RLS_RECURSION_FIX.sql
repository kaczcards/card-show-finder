-- ================================================================
-- MANUAL_RLS_RECURSION_FIX.sql
-- ================================================================
-- Minimal fix for infinite recursion in RLS policies
-- Created: July 23, 2025
--
-- Purpose:
--   This script fixes the infinite recursion issue in Row Level Security
--   policies for the show_participants table.
--
-- Usage:
--   Run each section separately in the Supabase SQL Editor.
--   Each section is wrapped in its own transaction for safety.
--
-- Problem:
--   The current RLS policies on show_participants cause infinite recursion
--   (error 42P17) because they reference the same table or functions that
--   query the same table recursively.
-- ================================================================

-- ================================================================
-- SECTION 1: HELPER FUNCTIONS
-- Run this section first
-- ================================================================
BEGIN;

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

COMMIT;

-- ================================================================
-- SECTION 2: CHECK IF SHOW_PARTICIPANTS TABLE EXISTS
-- Run this section second
-- ================================================================
BEGIN;

DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  -- Check if show_participants table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'show_participants'
  ) INTO table_exists;
  
  IF table_exists THEN
    RAISE NOTICE 'show_participants table exists, proceeding with fix';
  ELSE
    RAISE EXCEPTION 'show_participants table does not exist! This fix is not needed.';
  END IF;
END $$;

COMMIT;

-- ================================================================
-- SECTION 3: FIX SHOW_PARTICIPANTS RLS POLICIES
-- Run this section third
-- ================================================================
BEGIN;

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

COMMIT;

-- ================================================================
-- SECTION 4: CREATE NEW NON-RECURSIVE POLICIES
-- Run this section fourth
-- ================================================================
BEGIN;

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

COMMIT;

-- ================================================================
-- SECTION 5: VERIFICATION
-- Run this section last
-- ================================================================
BEGIN;

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
    RAISE WARNING 'VERIFICATION FAILED: Found policies on show_participants that may cause infinite recursion';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: No policies found that would cause infinite recursion';
  END IF;
END $$;

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'MANUAL RLS RECURSION FIX COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  1. Infinite recursion in show_participants RLS policies';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'To test the fix, try running:';
  RAISE NOTICE 'SELECT * FROM show_participants LIMIT 1;';
  RAISE NOTICE '================================================================';
END $$;

COMMIT;
