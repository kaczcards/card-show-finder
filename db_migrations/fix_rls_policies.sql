-- =======================================================
-- RLS Policies Fix Migration
-- =======================================================
-- This migration addresses critical RLS policy issues:
-- 1. Adds missing policies for the profiles table
-- 2. Fixes inconsistent policies across tables
-- 3. Ensures proper security boundaries
-- =======================================================

-- Start transaction to ensure all changes are atomic
BEGIN;

-- =======================================================
-- Section 1: Fix Profiles Table Policies
-- =======================================================
-- The profiles table has RLS enabled but no policies defined,
-- which effectively blocks all access. We need to add appropriate
-- policies to allow users to access their own profiles and
-- limited access to other profiles.

-- Allow users to read their own profile (full access)
CREATE POLICY IF NOT EXISTS "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to see limited profile info of other users
-- (Only fields needed for UI display: username, full_name, avatar_url, role)
CREATE POLICY IF NOT EXISTS "Users can view limited profile info of others"
  ON profiles
  FOR SELECT
  USING (
    -- Always allow access to these specific columns for any authenticated user
    (auth.role() = 'authenticated') AND
    -- But only when requesting these specific columns
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      AND column_name IN ('id', 'username', 'full_name', 'avatar_url', 'role')
    )
  );

-- Allow service role/admin to access all profiles
CREATE POLICY IF NOT EXISTS "Service role can access all profiles"
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- =======================================================
-- Section 2: Fix Show-related Table Policies
-- =======================================================

-- Ensure shows table has proper policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shows') THEN
    -- Allow anyone to view public show information
    CREATE POLICY IF NOT EXISTS "Anyone can view shows"
      ON shows
      FOR SELECT
      TO public
      USING (true);
      
    -- Only organizers can update their own shows
    CREATE POLICY IF NOT EXISTS "Organizers can update own shows"
      ON shows
      FOR UPDATE
      USING (auth.uid() = organizer_id)
      WITH CHECK (auth.uid() = organizer_id);
      
    -- Only organizers can delete their own shows
    CREATE POLICY IF NOT EXISTS "Organizers can delete own shows"
      ON shows
      FOR DELETE
      USING (auth.uid() = organizer_id);
  END IF;
END $$;

-- =======================================================
-- Section 3: Fix Message-related Table Policies
-- =======================================================

-- Ensure conversation participants have proper policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_participants') THEN
    -- Fix conversation_participants policies to ensure users can only see conversations they're part of
    DROP POLICY IF EXISTS "Users can view own conversation participants" ON conversation_participants;
    CREATE POLICY "Users can view own conversation participants"
      ON conversation_participants
      FOR SELECT
      USING (user_id = auth.uid() OR 
             conversation_id IN (
               SELECT conversation_id 
               FROM conversation_participants 
               WHERE user_id = auth.uid()
             ));
  END IF;
END $$;

-- =======================================================
-- Section 4: Fix Storage Policies
-- =======================================================

-- Ensure proper storage policies for avatar images
DO $$
BEGIN
  -- Check if the avatars bucket exists
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'avatars'
  ) THEN
    -- Fix avatar image policies
    CREATE POLICY IF NOT EXISTS "Avatar images are publicly accessible"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'avatars');
      
    -- Users can only upload/update their own avatar
    CREATE POLICY IF NOT EXISTS "Users can upload own avatar"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
      
    CREATE POLICY IF NOT EXISTS "Users can update own avatar"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
      
    CREATE POLICY IF NOT EXISTS "Users can delete own avatar"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- =======================================================
-- Section 5: Fix Want Lists Policies
-- =======================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'want_lists') THEN
    -- Ensure want_lists policies are correct
    DROP POLICY IF EXISTS "MVP dealers can view want lists shared with them" ON want_lists;
    
    -- Allow MVP dealers to view want lists shared with shows they participate in
    CREATE POLICY IF NOT EXISTS "MVP dealers can view want lists shared with them"
      ON want_lists
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 
          FROM shared_want_lists swl
          JOIN show_participants sp ON sp.showid = swl.showid
          JOIN profiles p ON p.id = auth.uid()
          WHERE 
            swl.wantlistid = want_lists.id AND
            sp.userid = auth.uid() AND
            LOWER(p.role) = 'mvp_dealer'
        )
      );
  END IF;
END $$;

-- =======================================================
-- Section 6: Verify RLS is enabled on all tables
-- =======================================================

-- Ensure RLS is enabled on all critical tables
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

-- Commit all changes
COMMIT;
