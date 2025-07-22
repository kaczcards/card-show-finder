-- FULLY_IDEMPOTENT_recursion_fix.sql
-- Description: Fixes infinite recursion in show_participants RLS policies
-- This script is fully idempotent and can be run multiple times safely
-- It will drop and recreate all relevant policies and functions

-- Begin transaction for safety
BEGIN;

-- ================================================================
-- 1. Create or replace helper function for non-recursive participation check
-- ================================================================
CREATE OR REPLACE FUNCTION public.participates_in_show_safe(showid UUID) 
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

-- ================================================================
-- 2. Drop ALL existing related policies (with error handling)
-- ================================================================
DO $$
BEGIN
  -- Drop the problematic policy that causes infinite recursion
  BEGIN
    DROP POLICY "show_participants_select_mvp_dealer" ON public.show_participants;
    RAISE NOTICE 'Dropped policy: show_participants_select_mvp_dealer';
  EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE 'Policy show_participants_select_mvp_dealer does not exist, skipping drop';
  END;

  -- Drop the fixed policy (in case it was partially created before)
  BEGIN
    DROP POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants;
    RAISE NOTICE 'Dropped policy: show_participants_select_mvp_dealer_fixed';
  EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE 'Policy show_participants_select_mvp_dealer_fixed does not exist, skipping drop';
  END;

  -- Drop the self-select policy (in case it exists)
  BEGIN
    DROP POLICY "show_participants_select_self" ON public.show_participants;
    RAISE NOTICE 'Dropped policy: show_participants_select_self';
  EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE 'Policy show_participants_select_self does not exist, skipping drop';
  END;
END $$;

-- ================================================================
-- 3. Create new non-recursive policy for MVP dealers
-- ================================================================
DO $$
BEGIN
  CREATE POLICY "show_participants_select_mvp_dealer_fixed"
    ON public.show_participants
    FOR SELECT
    TO authenticated
    USING (
      -- User is an MVP dealer (this function doesn't query show_participants)
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
      ) AND
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
  RAISE NOTICE 'Created policy: show_participants_select_mvp_dealer_fixed';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy show_participants_select_mvp_dealer_fixed already exists, recreating...';
    DROP POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants;
    
    CREATE POLICY "show_participants_select_mvp_dealer_fixed"
      ON public.show_participants
      FOR SELECT
      TO authenticated
      USING (
        -- User is an MVP dealer (this function doesn't query show_participants)
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
        ) AND
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
    RAISE NOTICE 'Recreated policy: show_participants_select_mvp_dealer_fixed';
END $$;

-- ================================================================
-- 4. Create fallback policy for all users to see their own participation
-- ================================================================
DO $$
BEGIN
  CREATE POLICY "show_participants_select_self"
    ON public.show_participants
    FOR SELECT
    TO authenticated
    USING (userid = auth.uid());
  RAISE NOTICE 'Created policy: show_participants_select_self';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy show_participants_select_self already exists, recreating...';
    DROP POLICY "show_participants_select_self" ON public.show_participants;
    
    CREATE POLICY "show_participants_select_self"
      ON public.show_participants
      FOR SELECT
      TO authenticated
      USING (userid = auth.uid());
    RAISE NOTICE 'Recreated policy: show_participants_select_self';
END $$;

-- ================================================================
-- 5. Grant execute permission on the helper function
-- ================================================================
GRANT EXECUTE ON FUNCTION public.participates_in_show_safe(UUID) TO authenticated;

-- ================================================================
-- 6. Add documentation comments
-- ================================================================
COMMENT ON POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants IS 
  'Non-recursive policy allowing MVP dealers to see participants for shows they are involved with';

COMMENT ON FUNCTION public.participates_in_show_safe(UUID) IS
  'Helper function to safely check if a user participates in a show without causing recursive policy evaluation';

-- ================================================================
-- 7. Verification queries
-- ================================================================
DO $$
DECLARE
  policy_count INTEGER;
  function_exists BOOLEAN;
BEGIN
  -- Check if the problematic policy is gone
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'show_participants'
  AND polname = 'show_participants_select_mvp_dealer';
  
  IF policy_count > 0 THEN
    RAISE WARNING 'VERIFICATION FAILED: Problematic policy still exists!';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: Problematic policy was removed';
  END IF;
  
  -- Check if fixed policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'show_participants'
  AND polname = 'show_participants_select_mvp_dealer_fixed';
  
  IF policy_count = 0 THEN
    RAISE WARNING 'VERIFICATION FAILED: Fixed policy was not created!';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: Fixed policy exists';
  END IF;
  
  -- Check if self-select policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'show_participants'
  AND polname = 'show_participants_select_self';
  
  IF policy_count = 0 THEN
    RAISE WARNING 'VERIFICATION FAILED: Self-select policy was not created!';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: Self-select policy exists';
  END IF;
  
  -- Check if helper function exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'participates_in_show_safe'
  ) INTO function_exists;
  
  IF NOT function_exists THEN
    RAISE WARNING 'VERIFICATION FAILED: Helper function was not created!';
  ELSE
    RAISE NOTICE 'VERIFICATION PASSED: Helper function exists';
  END IF;
  
  -- Summary
  RAISE NOTICE '=== FIX SUMMARY ===';
  RAISE NOTICE 'Fixed infinite recursion in show_participants RLS policies';
  RAISE NOTICE 'Created/updated helper function: participates_in_show_safe';
  RAISE NOTICE 'Replaced policy: show_participants_select_mvp_dealer → show_participants_select_mvp_dealer_fixed';
  RAISE NOTICE 'Added/updated self-select policy: show_participants_select_self';
END $$;

-- Commit the transaction
COMMIT;

-- ================================================================
-- 8. Test query (uncomment to run)
-- ================================================================
/*
-- Set role to authenticated for testing
SET ROLE authenticated;

-- Test query with a real show UUID (replace with an actual UUID)
SELECT * FROM show_participants LIMIT 5;

-- Reset role
RESET ROLE;
*/
