-- Migration: 20250722000000_fix_show_participants_infinite_recursion.sql
-- Description: Fixes infinite recursion in show_participants RLS policies
-- The "show_participants_select_mvp_dealer" policy causes infinite recursion
-- because it queries the show_participants table within its own policy definition.

-- Begin transaction for safety
BEGIN;

-- 1. Create a helper function to check participation without recursion
-- This function will be used by the policy to avoid querying show_participants
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

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "show_participants_select_mvp_dealer" ON public.show_participants;

-- 3. Create a new non-recursive policy
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

-- 4. Create a fallback policy for all users to see their own participation
-- This ensures users can always see their own entries regardless of other policies
CREATE POLICY IF NOT EXISTS "show_participants_select_self"
  ON public.show_participants
  FOR SELECT
  TO authenticated
  USING (userid = auth.uid());

-- 5. Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION public.participates_in_show_safe(UUID) TO authenticated;

-- 6. Add comment explaining the fix
COMMENT ON POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants IS 
  'Non-recursive policy allowing MVP dealers to see participants for shows they are involved with';

COMMENT ON FUNCTION public.participates_in_show_safe(UUID) IS
  'Helper function to safely check if a user participates in a show without causing recursive policy evaluation';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: Fixed infinite recursion in show_participants RLS policies';
  RAISE NOTICE 'Created helper function: participates_in_show_safe';
  RAISE NOTICE 'Replaced policy: show_participants_select_mvp_dealer → show_participants_select_mvp_dealer_fixed';
END $$;

-- Commit the transaction
COMMIT;
