-- db_migrations/fix-rls-infinite-recursion.sql
-- Fix for infinite recursion in RLS policies for show_participants and want_lists tables
-- Error: "infinite recursion detected in policy for relation show_participants"

-- Start transaction to ensure all changes happen or none
BEGIN;

-- Create helper function to safely drop policies (making script idempotent)
CREATE OR REPLACE FUNCTION safe_drop_policy(policy_name TEXT, table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Check if policy exists before dropping
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = policy_name 
    AND tablename = table_name
  ) THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    RAISE NOTICE 'Dropped policy % on table %', policy_name, table_name;
  ELSE
    RAISE NOTICE 'Policy % does not exist on table %', policy_name, table_name;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policy % on table %: %', policy_name, table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 1. Fix show_participants_select_mvp_dealer policy
-- Drop the existing policy with recursion issue
SELECT safe_drop_policy('show_participants_select_mvp_dealer', 'show_participants');

-- Create new policy without recursion
-- This policy allows MVP dealers to see participants for shows they're involved in
-- without querying the show_participants table recursively
CREATE POLICY show_participants_select_mvp_dealer ON public.show_participants
  FOR SELECT USING (
    -- Check if current user is an MVP dealer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    ) 
    AND (
      -- The participant is the current user (always allow users to see their own records)
      userid = auth.uid()
      OR
      -- The show is one that the current user is participating in
      -- This is determined by the showid matching shows the dealer is in
      showid IN (
        -- Subquery to get shows the dealer is in (without recursive reference)
        SELECT s.id FROM shows s
        WHERE EXISTS (
          -- Check if dealer is explicitly listed in the show's participants
          -- without referring to the show_participants table
          SELECT 1 FROM planned_attendance pa
          WHERE pa.show_id = s.id AND pa.user_id = auth.uid()
        )
        OR s.organizer_id = auth.uid() -- Dealer is the organizer
      )
    )
  );

-- 2. Fix want_lists_select_mvp_dealer policy
-- Drop the existing policy with recursion issue
SELECT safe_drop_policy('want_lists_select_mvp_dealer', 'want_lists');

-- Create new policy without recursion
-- This policy allows MVP dealers to see want lists from attendees of shows they're participating in
CREATE POLICY want_lists_select_mvp_dealer ON public.want_lists
  FOR SELECT USING (
    -- Check if current user is an MVP dealer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'mvp_dealer'
    )
    AND (
      -- The want list belongs to the current user (always allow users to see their own records)
      userid = auth.uid()
      OR
      -- The want list owner is attending a show where the dealer is also involved
      userid IN (
        -- Get users who are attending shows that the dealer is involved with
        -- This avoids the recursive join between show_participants tables
        WITH dealer_shows AS (
          -- First get shows the dealer is involved with (without recursive reference)
          SELECT s.id FROM shows s
          WHERE EXISTS (
            SELECT 1 FROM planned_attendance pa
            WHERE pa.show_id = s.id AND pa.user_id = auth.uid()
          )
          OR s.organizer_id = auth.uid() -- Dealer is the organizer
        )
        -- Then get users attending those shows
        SELECT DISTINCT pa.user_id
        FROM planned_attendance pa
        WHERE pa.show_id IN (SELECT id FROM dealer_shows)
        AND pa.user_id != auth.uid() -- Exclude the dealer themselves
      )
    )
  );

-- 3. Fix want_lists_select_organizer policy
-- Drop the existing policy with potential recursion issue
SELECT safe_drop_policy('want_lists_select_organizer', 'want_lists');

-- Create new policy without recursion
-- This policy allows show organizers to see want lists from attendees of their shows
CREATE POLICY want_lists_select_organizer ON public.want_lists
  FOR SELECT USING (
    -- Check if current user is a show organizer
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'show_organizer'
    )
    AND (
      -- The want list belongs to the current user (always allow users to see their own records)
      userid = auth.uid()
      OR
      -- The want list owner is attending a show organized by this user
      userid IN (
        -- Get users who are attending shows organized by this user
        SELECT DISTINCT pa.user_id
        FROM planned_attendance pa
        JOIN shows s ON pa.show_id = s.id
        WHERE s.organizer_id = auth.uid()
        AND pa.user_id != auth.uid() -- Exclude the organizer themselves
      )
    )
  );

-- 4. Fix show_participants_select_organizer policy
-- Drop the existing policy with potential recursion issue
SELECT safe_drop_policy('show_participants_select_organizer', 'show_participants');

-- Create new policy without recursion
-- This policy allows show organizers to see all participants for their shows
CREATE POLICY show_participants_select_organizer ON public.show_participants
  FOR SELECT USING (
    -- The show is organized by the current user
    showid IN (
      SELECT id FROM shows
      WHERE organizer_id = auth.uid()
    )
  );

-- Print completion message
DO $$
BEGIN
  RAISE NOTICE 'RLS policy infinite recursion fix complete.';
  RAISE NOTICE 'Fixed policies:';
  RAISE NOTICE '  - show_participants_select_mvp_dealer';
  RAISE NOTICE '  - want_lists_select_mvp_dealer';
  RAISE NOTICE '  - want_lists_select_organizer';
  RAISE NOTICE '  - show_participants_select_organizer';
END $$;

-- Commit the transaction
COMMIT;
