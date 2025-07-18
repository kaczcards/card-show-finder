-- ================================================================
-- IDEMPOTENT RLS POLICY FIX FOR SHOW_PARTICIPANTS TABLE
-- ================================================================
-- This script safely fixes the infinite recursion error in the show_participants
-- RLS policies. It can be run multiple times without causing errors.
--
-- Problem: The "show_participants_select_mvp_dealer" policy causes infinite
-- recursion because it queries the show_participants table within its own
-- policy definition.
--
-- Error: "ERROR: 42P17: infinite recursion detected in policy for relation show_participants"
--
-- Solution: Replace with simplified policies that don't reference the same table.
-- ================================================================

-- Begin transaction for safety
BEGIN;

-- ================================================================
-- STEP 1: VERIFY TABLE EXISTS AND RLS IS ENABLED
-- ================================================================
DO $$
DECLARE
  table_exists BOOLEAN;
  rls_enabled BOOLEAN;
BEGIN
  -- Check if the table exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'show_participants'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'Table public.show_participants does not exist. No action needed.';
    RETURN;
  END IF;
  
  -- Check if RLS is enabled
  SELECT relrowsecurity
  FROM pg_class
  WHERE relname = 'show_participants'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  INTO rls_enabled;
  
  IF NOT rls_enabled THEN
    RAISE NOTICE 'Row Level Security is not enabled on show_participants. No RLS policies to fix.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Table exists and RLS is enabled. Proceeding with policy fixes...';
END $$;

-- ================================================================
-- STEP 2: IDENTIFY EXISTING POLICIES
-- ================================================================
DO $$
DECLARE
  problematic_policy_exists BOOLEAN;
  fixed_policy_exists BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check if problematic policy exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'show_participants'
    AND schemaname = 'public'
    AND policyname = 'show_participants_select_mvp_dealer'
  ) INTO problematic_policy_exists;
  
  -- Check if fixed policy already exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'show_participants'
    AND schemaname = 'public'
    AND policyname = 'show_participants_select_mvp_dealer_fixed'
  ) INTO fixed_policy_exists;
  
  -- Get total policy count
  SELECT COUNT(*)
  FROM pg_policies
  WHERE tablename = 'show_participants'
  AND schemaname = 'public'
  INTO policy_count;
  
  RAISE NOTICE 'Found % policies on show_participants table', policy_count;
  RAISE NOTICE 'Problematic policy exists: %', problematic_policy_exists;
  RAISE NOTICE 'Fixed policy exists: %', fixed_policy_exists;
END $$;

-- ================================================================
-- STEP 3: SAFELY DROP EXISTING POLICIES
-- ================================================================
DO $$
BEGIN
  -- Always try to drop the problematic policy if it exists
  EXECUTE 'DROP POLICY IF EXISTS "show_participants_select_mvp_dealer" ON public.show_participants';
  RAISE NOTICE 'Dropped problematic policy (if it existed)';
  
  -- Drop the fixed policy if it exists (to recreate with current definition)
  EXECUTE 'DROP POLICY IF EXISTS "show_participants_select_mvp_dealer_fixed" ON public.show_participants';
  RAISE NOTICE 'Dropped existing fixed policy (if it existed)';
END $$;

-- ================================================================
-- STEP 4: CREATE NEW NON-RECURSIVE POLICY
-- ================================================================
DO $$
BEGIN
  -- Create the fixed policy
  EXECUTE '
  CREATE POLICY "show_participants_select_mvp_dealer_fixed"
    ON public.show_participants
    FOR SELECT
    TO authenticated
    USING (
      -- User is an MVP dealer (this function doesn''t query show_participants)
      is_mvp_dealer() AND
      (
        -- Simple self-check without recursion
        userid = auth.uid() OR
        -- Check if they''re an organizer of the show
        EXISTS (
          SELECT 1 FROM shows s
          WHERE s.id = show_participants.showid
          AND s.organizer_id = auth.uid()
        )
      )
    )';
    
  RAISE NOTICE 'Created new non-recursive policy: show_participants_select_mvp_dealer_fixed';
  
  -- Add comment explaining the fix
  EXECUTE '
  COMMENT ON POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants IS 
    ''Non-recursive policy allowing MVP dealers to see participants for shows they are involved with''';
END $$;

-- ================================================================
-- STEP 5: VERIFY THE FIX
-- ================================================================
DO $$
DECLARE
  fixed_policy_exists BOOLEAN;
  problematic_policy_exists BOOLEAN;
BEGIN
  -- Check if fixed policy exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'show_participants'
    AND schemaname = 'public'
    AND policyname = 'show_participants_select_mvp_dealer_fixed'
  ) INTO fixed_policy_exists;
  
  -- Check if problematic policy still exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'show_participants'
    AND schemaname = 'public'
    AND policyname = 'show_participants_select_mvp_dealer'
  ) INTO problematic_policy_exists;
  
  IF fixed_policy_exists AND NOT problematic_policy_exists THEN
    RAISE NOTICE '✓ Fix successfully applied! The infinite recursion issue has been resolved.';
  ELSIF NOT fixed_policy_exists THEN
    RAISE WARNING '⚠ Fixed policy was not created. Check for errors above.';
  ELSIF problematic_policy_exists THEN
    RAISE WARNING '⚠ Problematic policy still exists. Check for errors above.';
  END IF;
END $$;

-- ================================================================
-- STEP 6: LIST CURRENT POLICIES (FOR REFERENCE)
-- ================================================================
DO $$
DECLARE
  policy_rec RECORD;
BEGIN
  RAISE NOTICE '------------------------------------------------------';
  RAISE NOTICE 'Current policies on public.show_participants:';
  RAISE NOTICE '------------------------------------------------------';
  
  FOR policy_rec IN
    SELECT policyname, cmd, roles::text
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'show_participants'
    ORDER BY policyname
  LOOP
    RAISE NOTICE 'Policy: % | Command: % | Roles: %', 
      policy_rec.policyname, 
      policy_rec.cmd, 
      policy_rec.roles;
  END LOOP;
  
  RAISE NOTICE '------------------------------------------------------';
END $$;

-- Commit the transaction
COMMIT;

-- ================================================================
-- HOW TO USE THIS SCRIPT
-- ================================================================
-- For LOCAL PostgreSQL:
--   psql -d your_database -f IDEMPOTENT_RLS_FIX.sql
--
-- For Supabase:
--   PGPASSWORD=your_password psql -h db.your-project.supabase.co -p 5432 -U postgres -d postgres -f IDEMPOTENT_RLS_FIX.sql
--
-- Via Supabase Dashboard:
--   1. Go to SQL Editor
--   2. Paste this entire script
--   3. Click "Run"
--
-- This script is IDEMPOTENT - it can be run multiple times safely.
-- It will check for existing policies and handle them appropriately.
-- ================================================================
