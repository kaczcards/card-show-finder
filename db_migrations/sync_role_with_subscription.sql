-- db_migrations/sync_role_with_subscription.sql
--
-- This migration automates the synchronization between a user's subscription status
-- and their assigned role in the `profiles` table. It ensures that when a user's
-- subscription becomes active or expires, their role is updated accordingly.
--
-- This file contains three main parts:
-- 1. A function (`sync_user_role`) that contains the core logic for determining the correct role.
-- 2. A trigger (`profiles_role_sync_trigger`) that automatically calls the function on data changes.
-- 3. A utility function (`manually_sync_all_user_roles`) to backfill roles for existing users.

-- Part 1: The Role Synchronization Function
-- This function is the heart of the automation. It is designed to be executed by a trigger
-- before an insert or update on the `profiles` table.

CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- This function checks the account_type and subscription_status of the incoming row
    -- and sets the `role` field accordingly. Roles are stored in UPPERCASE

    -- Case 1: The user is a Show Organizer
    IF NEW.account_type = 'organizer' THEN
        IF NEW.subscription_status = 'active' THEN
            NEW.role := 'SHOW_ORGANIZER';
        ELSE
            -- If an organizer's subscription is not active, they revert to a base dealer role.
            NEW.role := 'DEALER';
        END IF;

    -- Case 2: The user is a Dealer
    ELSIF NEW.account_type = 'dealer' THEN
        IF NEW.subscription_status = 'active' THEN
            -- An active dealer subscription grants the 'mvp_dealer' role.
            NEW.role := 'MVP_DEALER';
        ELSE
            -- If a dealer's subscription is not active, they are a standard 'dealer'.
            NEW.role := 'DEALER';
        END IF;

    -- Case 3: The user is a standard collector/attendee
    ELSIF NEW.account_type = 'collector' THEN
        NEW.role := 'ATTENDEE';
    END IF;

    -- Return the modified row to be inserted or updated.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_user_role() IS 'Automatically updates the user''s role based on their account_type and subscription_status. Intended for use in a trigger.';


-- Part 2: The Trigger
-- This trigger ensures the `sync_user_role` function is called automatically whenever a
-- user's profile is created or modified.

-- Drop the trigger first if it already exists to ensure the script is re-runnable.
DROP TRIGGER IF EXISTS profiles_role_sync_trigger ON public.profiles;

CREATE TRIGGER profiles_role_sync_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role();

COMMENT ON TRIGGER profiles_role_sync_trigger ON public.profiles IS 'Ensures the user''s role is always in sync with their subscription status and account type before any data change.';


-- Part 3: Manual Sync Utility Function
-- This function provides a way to manually update all existing users. This is useful
-- to run once after applying this migration to fix any out-of-sync roles.

CREATE OR REPLACE FUNCTION public.manually_sync_all_user_roles()
RETURNS void AS $$
BEGIN
    -- By updating a field on every row, we cause the `profiles_role_sync_trigger`
    -- to fire for each user, which in turn executes the role synchronization logic.
    -- This is an efficient way to backfill the data without rewriting the logic.
    RAISE NOTICE 'Starting manual sync of all user roles...';
    UPDATE public.profiles
    SET updated_at = NOW(); -- Triggering an update on each row.
    RAISE NOTICE 'Manual sync completed.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.manually_sync_all_user_roles() IS 'A utility function to update all user roles by triggering the sync logic. Useful for a one-time data backfill.';

-- How to use this migration:
-- 1. Apply this SQL file to your Supabase database via the SQL Editor.
-- 2. After applying, run the manual sync function once to correct all existing user roles by executing:
--    SELECT public.manually_sync_all_user_roles();
-- 3. From now on, roles will be updated automatically whenever a profile's subscription status or account type changes.
