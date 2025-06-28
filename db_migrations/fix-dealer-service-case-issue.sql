-- db_migrations/fix-dealer-service-case-issue.sql
--
-- This migration standardizes the casing of user roles in the `profiles` table.
-- It converts all existing lowercase role names (e.g., 'dealer', 'mvp_dealer')
-- to their uppercase equivalents (e.g., 'DEALER', 'MVP_DEALER') to ensure
-- consistency with the UserRole enum used throughout the application code.
--
-- This fixes issues where role-based logic fails because of a case mismatch
-- between the database and the application code.

-- Update all roles in the profiles table to their uppercase equivalent.
-- The WHERE clause ensures that this operation is idempotent, meaning it
-- will only update rows that are not already in uppercase and can be
-- run multiple times without causing issues.
UPDATE public.profiles
SET role = UPPER(role)
WHERE role IS NOT NULL AND role != UPPER(role);

-- Add a comment to confirm the action.
COMMENT ON TABLE public.profiles IS 'Ensured all user roles are stored in uppercase for consistency with application enums.';

-- Instructions for applying this migration:
-- 1. Connect to your Supabase project using the SQL Editor.
-- 2. Paste this SQL script into a new query.
-- 3. Execute the query to apply the changes.
-- 4. Verify the changes by running: SELECT DISTINCT role FROM public.profiles;
--    The output should now show all roles in uppercase (e.g., ATTENDEE, DEALER, MVP_DEALER).
