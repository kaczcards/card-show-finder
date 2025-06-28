--
-- SQL SCRIPT: Fix Row Level Security (RLS) Policies for Show Participation
--
-- PURPOSE: This script corrects the RLS policies on the `show_participants` table.
-- The primary issue it solves is the "new row violates row-level security policy"
-- error that prevents users, including MVP Dealers, from registering for shows.
--
-- This script will:
--  1. Display the current (problematic) RLS policies for diagnosis.
--  2. Remove the old policies to ensure a clean state.
--  3. Create a new, correct set of policies that allow:
--     - Any authenticated user to INSERT their own participation record.
--     - Users to SELECT, UPDATE, and DELETE their own records.
--     - Show Organizers to SELECT all records for shows they own.
--  4. Display the new policies for verification.
--

-- ----------------------------------------------------------------------------
-- STEP 1: Diagnostic - Show current RLS policies on the table
-- ----------------------------------------------------------------------------
-- Run this section first to see what policies are currently active.
SELECT
    policyname,
    permissive,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM
    pg_policies
WHERE
    tablename = 'show_participants';


-- ----------------------------------------------------------------------------
-- STEP 2: Drop all existing policies on `show_participants`
-- ----------------------------------------------------------------------------
-- This ensures we start with a clean slate and avoid conflicts.
-- It is safe to run these even if the policies don't exist.
DROP POLICY IF EXISTS "Allow authenticated users to insert their own participation" ON public.show_participants;
DROP POLICY IF EXISTS "Users can view their own participation records" ON public.show_participants;
DROP POLICY IF EXISTS "Users can update their own participation records" ON public.show_participants;
DROP POLICY IF EXISTS "Users can delete their own participation records" ON public.show_participants;
DROP POLICY IF EXISTS "Show organizers can view participants for their shows" ON public.show_participants;
-- Dropping older, potentially conflicting policies from previous migrations
DROP POLICY IF EXISTS show_participants_update_dealer ON public.show_participants;
DROP POLICY IF EXISTS show_participants_select_organizer ON public.show_participants;


-- ----------------------------------------------------------------------------
-- STEP 3: Create the new, correct RLS policies
-- ----------------------------------------------------------------------------

-- Policy 1: Allow INSERT for authenticated users (THE MAIN FIX)
-- This policy allows any logged-in user to register for a show.
-- The `WITH CHECK` clause is a security measure that ensures a user can only
-- create a participation record for themselves (i.e., `userid` must match their own ID).
CREATE POLICY "Allow authenticated users to insert their own participation"
ON public.show_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = userid);

-- Policy 2: Allow SELECT for owners
-- Lets users see their own registration details.
CREATE POLICY "Users can view their own participation records"
ON public.show_participants
FOR SELECT
TO authenticated
USING (auth.uid() = userid);

-- Policy 3: Allow UPDATE for owners
-- Lets users update their own booth information.
CREATE POLICY "Users can update their own participation records"
ON public.show_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = userid)
WITH CHECK (auth.uid() = userid);

-- Policy 4: Allow DELETE for owners
-- Lets users cancel their own registration.
CREATE POLICY "Users can delete their own participation records"
ON public.show_participants
FOR DELETE
TO authenticated
USING (auth.uid() = userid);

-- Policy 5: Allow SELECT for Show Organizers
-- This allows a user whose ID matches the `organizer_id` on a `shows` record
-- to see all the participants for that specific show.
CREATE POLICY "Show organizers can view participants for their shows"
ON public.show_participants
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.shows s
        WHERE s.id = show_participants.showid
        AND s.organizer_id = auth.uid()
    )
);


-- ----------------------------------------------------------------------------
-- STEP 4: Verification - Show the new policies
-- ----------------------------------------------------------------------------
-- After running the script, this query will show the newly created policies.
-- You should see the five policies defined above.
SELECT
    policyname,
    permissive,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM
    pg_policies
WHERE
    tablename = 'show_participants';

-- ----------------------------------------------------------------------------
-- HOW TO USE THIS SCRIPT:
-- 1. Go to your Supabase project dashboard.
-- 2. Navigate to the "SQL Editor".
-- 3. Click "New query".
-- 4. Copy and paste the entire content of this file into the editor.
-- 5. Click "RUN".
-- 6. Check the results panel to ensure the new policies are listed correctly.
-- 7. After applying this fix, try registering for a show again in the app.
--    You may need to "Refresh Session" on the profile screen first.
-- ----------------------------------------------------------------------------
