-- minimal-rls-fix.sql
-- MINIMAL FIX for infinite recursion in RLS policies
-- This script only drops the problematic policies causing infinite recursion
-- without trying to recreate them. This will allow the app to function, even
-- if some features aren't fully available.

-- Start a transaction to ensure all changes happen or none
BEGIN;

-- Create a helper function to safely drop policies that may or may not exist
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

-- Drop the problematic policies that cause infinite recursion

-- 1. show_participants table policies
SELECT safe_drop_policy('show_participants_select_mvp_dealer', 'show_participants');
SELECT safe_drop_policy('show_participants_select_organizer', 'show_participants');

-- 2. want_lists table policies
SELECT safe_drop_policy('want_lists_select_mvp_dealer', 'want_lists');
SELECT safe_drop_policy('want_lists_select_organizer', 'want_lists');

-- 3. shared_want_lists table policies
SELECT safe_drop_policy('shared_want_lists_select_mvp_dealer', 'shared_want_lists');
SELECT safe_drop_policy('shared_want_lists_select_organizer', 'shared_want_lists');

-- Print completion message
DO $$
BEGIN
  RAISE NOTICE '=== Minimal RLS Policy Fix Complete ===';
  RAISE NOTICE 'Problematic policies have been removed to stop infinite recursion errors.';
  RAISE NOTICE 'To verify the fix, run: SELECT * FROM show_participants LIMIT 5;';
  RAISE NOTICE 'If the query returns without error, the fix is working.';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: Some features may be limited since policies were removed.';
  RAISE NOTICE 'This is a temporary fix to make the app usable. A complete fix';
  RAISE NOTICE 'with proper policies should be applied when possible.';
END;
$$;

-- Commit the transaction
COMMIT;
