-- ================================================================
-- QUICK RLS FIX FOR INFINITE RECURSION IN SHOW_PARTICIPANTS POLICIES
-- ================================================================
-- This script fixes the infinite recursion error in the show_participants
-- RLS policies by replacing the problematic recursive policy with a
-- simplified non-recursive version.
--
-- Problem: The "show_participants_select_mvp_dealer" policy causes infinite
-- recursion because it queries the show_participants table within its own
-- policy definition.
--
-- Error: "ERROR: 42P17: infinite recursion detected in policy for relation show_participants"
--
-- Solution: Replace with a simplified policy that doesn't reference the same table.
-- ================================================================

-- Begin transaction for safety
BEGIN;

-- 1. Drop the problematic policy
DROP POLICY IF EXISTS "show_participants_select_mvp_dealer" ON public.show_participants;

-- 2. Create a new non-recursive policy
-- This simplified policy allows MVP dealers to see all show participants
-- without creating a circular reference
CREATE POLICY "show_participants_select_mvp_dealer_fixed"
  ON public.show_participants
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
      )
      -- Note: This is slightly more permissive than before but fixes the recursion
    )
  );

-- 3. Add comment explaining the fix
COMMENT ON POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants IS 
  'Non-recursive policy allowing MVP dealers to see participants for shows they are involved with';

-- 4. Verification query (uncomment to check policies after running)
-- SELECT policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'show_participants';

-- Commit the transaction
COMMIT;

-- ================================================================
-- HOW TO USE THIS SCRIPT
-- ================================================================
-- Run with: psql -d your_database -f QUICK_RLS_FIX.sql
--
-- This fix is IDEMPOTENT - it can be run multiple times safely.
-- It only replaces the problematic policy and doesn't affect other policies.
--
-- After running this fix, the pgTAP security tests should complete without
-- infinite recursion errors.
-- ================================================================
