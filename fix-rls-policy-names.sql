-- ================================================================
-- FIX RLS POLICY NAMES - TRUNCATION ISSUE RESOLUTION
-- ================================================================
-- This script forcefully drops ALL existing RLS policies to fix the
-- truncation issue with long policy names (>63 characters).
--
-- Run this script BEFORE the consolidated-rls-policies.sql script
-- to ensure a clean slate for policy creation.
-- ================================================================

-- Use a transaction to ensure all changes are atomic
BEGIN;

-- ================================================================
-- SECTION 1: DROP ALL EXISTING POLICIES BY ACTUAL NAME
-- ================================================================

DO $$
DECLARE
    policy_record RECORD;
    drop_statement TEXT;
    policy_count INTEGER := 0;
BEGIN
    -- Log the start of the process
    RAISE NOTICE '=== STARTING RLS POLICY CLEANUP ===';
    
    -- Loop through all policies in the public schema
    FOR policy_record IN 
        SELECT 
            policyname,
            tablename,
            schemaname
        FROM 
            pg_policies
        WHERE 
            schemaname = 'public' OR
            schemaname = 'storage'
        ORDER BY 
            tablename, policyname
    LOOP
        -- Construct the DROP POLICY statement
        drop_statement := format('DROP POLICY IF EXISTS %I ON %I.%I;', 
                                policy_record.policyname, 
                                policy_record.schemaname, 
                                policy_record.tablename);
        
        -- Execute the statement
        BEGIN
            EXECUTE drop_statement;
            policy_count := policy_count + 1;
            RAISE NOTICE 'Dropped policy: % on %.%', 
                policy_record.policyname, 
                policy_record.schemaname, 
                policy_record.tablename;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to drop policy % on %.%: %', 
                    policy_record.policyname, 
                    policy_record.schemaname, 
                    policy_record.tablename,
                    SQLERRM;
        END;
    END LOOP;
    
    -- Log the completion
    RAISE NOTICE '=== COMPLETED RLS POLICY CLEANUP: % POLICIES DROPPED ===', policy_count;
END;
$$;

-- ================================================================
-- SECTION 2: VERIFY ALL POLICIES ARE DROPPED
-- ================================================================

DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    -- Count remaining policies in public schema
    SELECT COUNT(*) INTO remaining_count
    FROM pg_policies
    WHERE schemaname = 'public' OR schemaname = 'storage';
    
    -- Check if any policies remain
    IF remaining_count > 0 THEN
        RAISE WARNING '!!! WARNING: % policies still remain in the database !!!', remaining_count;
        RAISE WARNING 'These may need to be dropped manually.';
        
        -- List the remaining policies
        RAISE NOTICE '--- REMAINING POLICIES ---';
        FOR policy_record IN 
            SELECT policyname, tablename, schemaname
            FROM pg_policies
            WHERE schemaname = 'public' OR schemaname = 'storage'
            ORDER BY tablename, policyname
        LOOP
            RAISE NOTICE '  • % on %.%', 
                policy_record.policyname, 
                policy_record.schemaname, 
                policy_record.tablename;
        END LOOP;
    ELSE
        RAISE NOTICE '✓ SUCCESS: All policies have been dropped successfully.';
    END IF;
END;
$$;

-- ================================================================
-- SECTION 3: POLICY NAMING GUIDELINES
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '
=== POLICY NAMING GUIDELINES ===

To avoid PostgreSQL''s 63-character identifier limit, follow these naming conventions:

1. Use short, descriptive names: "profiles_select_self" instead of "Allow users to view their own profile information"
2. Follow the pattern: [table]_[operation]_[role]
   Examples:
   • profiles_select_self
   • shows_update_organizer
   • messages_insert_participant

3. Avoid redundant words like "allow", "users", "can", etc.
4. For complex conditions, focus on the primary role/action

The consolidated-rls-policies.sql script has been updated to use these naming conventions.
';
END;
$$;

-- ================================================================
-- SECTION 4: NEXT STEPS
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '
=== NEXT STEPS ===

1. Run the consolidated-rls-policies.sql script to create all policies with proper naming
2. Run verify-rls-policies.sql to confirm all policies are correctly applied
3. Test application functionality to ensure proper access controls
';
END;
$$;

-- Commit the transaction
COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'RLS POLICY CLEANUP COMPLETE';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'All existing RLS policies have been dropped.';
    RAISE NOTICE 'You can now safely run the consolidated-rls-policies.sql script.';
    RAISE NOTICE '=======================================================';
END;
$$;
