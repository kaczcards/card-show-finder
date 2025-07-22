-- ================================================================
-- SIMPLE SECURITY VALIDATION SCRIPT
-- ================================================================
-- This script validates the consolidated RLS security setup without
-- creating any new data. It checks:
--   1. Helper functions exist and work
--   2. RLS is enabled on key tables
--   3. Required policies exist
--   4. Basic security boundaries
-- ================================================================

-- Begin transaction to ensure we don't modify any data
BEGIN;

-- ================================================================
-- SECTION 1: TEST SETUP
-- ================================================================

-- Create a temporary table to store test results
CREATE TEMPORARY TABLE security_validation_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN,
    details TEXT
);

-- Function to record test results
CREATE OR REPLACE FUNCTION record_validation(p_test_name TEXT, p_passed BOOLEAN, p_details TEXT DEFAULT NULL) 
RETURNS VOID AS $$
BEGIN
    INSERT INTO security_validation_results (test_name, passed, details)
    VALUES (p_test_name, p_passed, p_details)
    ON CONFLICT (test_name) DO UPDATE
    SET passed = EXCLUDED.passed, details = EXCLUDED.details;
    
    -- Also output to console
    IF p_passed THEN
        RAISE NOTICE '✅ PASS: %', p_test_name;
    ELSE
        RAISE NOTICE '❌ FAIL: % - %', p_test_name, COALESCE(p_details, 'Test failed');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 2: VALIDATE HELPER FUNCTIONS
-- ================================================================

-- Check if helper functions exist
DO $$
DECLARE
    function_exists BOOLEAN;
BEGIN
    -- Check is_admin() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'is_admin'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'is_admin() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
    
    -- Check is_show_organizer() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'is_show_organizer'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'is_show_organizer() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
    
    -- Check is_mvp_dealer() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'is_mvp_dealer'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'is_mvp_dealer() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
    
    -- Check is_dealer() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'is_dealer'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'is_dealer() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
    
    -- Check is_any_dealer() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'is_any_dealer'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'is_any_dealer() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
    
    -- Check participates_in_show_safe() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'participates_in_show_safe'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'participates_in_show_safe() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
    
    -- Check organizes_show() function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'organizes_show'
    ) INTO function_exists;
    
    PERFORM record_validation(
        'organizes_show() function exists',
        function_exists,
        CASE WHEN function_exists THEN 'Function is properly defined'
             ELSE 'Function is missing - consolidated RLS may not be applied'
        END
    );
END $$;

-- ================================================================
-- SECTION 3: VALIDATE RLS IS ENABLED
-- ================================================================

-- Check if RLS is enabled on key tables
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    -- Check profiles table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'profiles'
    INTO rls_enabled;
    
    PERFORM record_validation(
        'RLS enabled on profiles table',
        COALESCE(rls_enabled, FALSE),
        CASE WHEN COALESCE(rls_enabled, FALSE) THEN 'RLS is properly enabled'
             ELSE 'RLS is not enabled - security risk!'
        END
    );
    
    -- Check shows table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'shows'
    INTO rls_enabled;
    
    PERFORM record_validation(
        'RLS enabled on shows table',
        COALESCE(rls_enabled, FALSE),
        CASE WHEN COALESCE(rls_enabled, FALSE) THEN 'RLS is properly enabled'
             ELSE 'RLS is not enabled - security risk!'
        END
    );
    
    -- Check show_participants table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'show_participants'
    INTO rls_enabled;
    
    PERFORM record_validation(
        'RLS enabled on show_participants table',
        COALESCE(rls_enabled, FALSE),
        CASE WHEN COALESCE(rls_enabled, FALSE) THEN 'RLS is properly enabled'
             ELSE 'RLS is not enabled - security risk!'
        END
    );
    
    -- Check want_lists table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'want_lists'
    INTO rls_enabled;
    
    PERFORM record_validation(
        'RLS enabled on want_lists table',
        COALESCE(rls_enabled, FALSE),
        CASE WHEN COALESCE(rls_enabled, FALSE) THEN 'RLS is properly enabled'
             ELSE 'RLS is not enabled - security risk!'
        END
    );
    
    -- Check shared_want_lists table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'shared_want_lists'
    INTO rls_enabled;
    
    PERFORM record_validation(
        'RLS enabled on shared_want_lists table',
        COALESCE(rls_enabled, FALSE),
        CASE WHEN COALESCE(rls_enabled, FALSE) THEN 'RLS is properly enabled'
             ELSE 'RLS is not enabled - security risk!'
        END
    );
    
    -- Check conversations table if it exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
        SELECT rowsecurity FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'conversations'
        INTO rls_enabled;
        
        PERFORM record_validation(
            'RLS enabled on conversations table',
            COALESCE(rls_enabled, FALSE),
            CASE WHEN COALESCE(rls_enabled, FALSE) THEN 'RLS is properly enabled'
                 ELSE 'RLS is not enabled - security risk!'
            END
        );
    END IF;
END $$;

-- ================================================================
-- SECTION 4: VALIDATE POLICIES EXIST
-- ================================================================

-- Check if required policies exist
DO $$
DECLARE
    policy_exists BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check profiles table policies
    SELECT COUNT(*) > 0 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles'
    INTO policy_exists;
    
    SELECT COUNT(*) FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles'
    INTO policy_count;
    
    PERFORM record_validation(
        'Profiles table has policies',
        policy_exists,
        CASE WHEN policy_exists THEN policy_count || ' policies found'
             ELSE 'No policies found - security risk!'
        END
    );
    
    -- Check shows table policies
    SELECT COUNT(*) > 0 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'shows'
    INTO policy_exists;
    
    SELECT COUNT(*) FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'shows'
    INTO policy_count;
    
    PERFORM record_validation(
        'Shows table has policies',
        policy_exists,
        CASE WHEN policy_exists THEN policy_count || ' policies found'
             ELSE 'No policies found - security risk!'
        END
    );
    
    -- Check show_participants table policies
    SELECT COUNT(*) > 0 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'show_participants'
    INTO policy_exists;
    
    SELECT COUNT(*) FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'show_participants'
    INTO policy_count;
    
    PERFORM record_validation(
        'Show_participants table has policies',
        policy_exists,
        CASE WHEN policy_exists THEN policy_count || ' policies found'
             ELSE 'No policies found - security risk!'
        END
    );
    
    -- Check for non-recursive policy (fixed policy)
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'show_participants'
        AND (policyname LIKE '%mvp_dealer_safe%' OR policyname LIKE '%mvp_dealer_fixed%')
    ) INTO policy_exists;
    
    PERFORM record_validation(
        'Non-recursive show_participants policy exists',
        policy_exists,
        CASE WHEN policy_exists THEN 'Safe non-recursive policy found'
             ELSE 'No safe non-recursive policy found - risk of infinite recursion!'
        END
    );
    
    -- Check want_lists table policies
    SELECT COUNT(*) > 0 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'want_lists'
    INTO policy_exists;
    
    SELECT COUNT(*) FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'want_lists'
    INTO policy_count;
    
    PERFORM record_validation(
        'Want_lists table has policies',
        policy_exists,
        CASE WHEN policy_exists THEN policy_count || ' policies found'
             ELSE 'No policies found - security risk!'
        END
    );
END $$;

-- ================================================================
-- SECTION 5: VALIDATE HELPER FUNCTION IMPLEMENTATIONS
-- ================================================================

-- Check if helper functions are implemented correctly
DO $$
DECLARE
    function_body TEXT;
    is_correct BOOLEAN;
BEGIN
    -- Check is_admin() implementation
    SELECT prosrc FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
    INTO function_body;
    
    -- Check if it uses profiles table (not user_roles)
    is_correct := function_body LIKE '%FROM profiles%' AND function_body NOT LIKE '%FROM user_roles%';
    
    PERFORM record_validation(
        'is_admin() uses profiles table',
        is_correct,
        CASE WHEN is_correct THEN 'Function correctly uses profiles table'
             ELSE 'Function may be using incorrect table - check implementation'
        END
    );
    
    -- Check participates_in_show_safe() implementation
    SELECT prosrc FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'participates_in_show_safe'
    INTO function_body;
    
    -- Check if it avoids querying show_participants
    is_correct := function_body NOT LIKE '%FROM show_participants%';
    
    PERFORM record_validation(
        'participates_in_show_safe() avoids recursion',
        is_correct,
        CASE WHEN is_correct THEN 'Function correctly avoids recursive queries'
             ELSE 'Function may cause infinite recursion - check implementation'
        END
    );
END $$;

-- ================================================================
-- SECTION 6: BASIC SMOKE TEST
-- ================================================================

-- Basic smoke test with current user
DO $$
DECLARE
    current_user_id UUID;
    can_view_shows BOOLEAN;
    execution_time INTERVAL;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Record if we're authenticated
    PERFORM record_validation(
        'Current user is authenticated',
        current_user_id IS NOT NULL,
        CASE WHEN current_user_id IS NOT NULL THEN 'User ID: ' || current_user_id
             ELSE 'Not authenticated - some tests may be skipped'
        END
    );
    
    -- Check if current user can view shows
    BEGIN
        SELECT EXISTS(SELECT 1 FROM shows LIMIT 1) INTO can_view_shows;
        
        PERFORM record_validation(
            'Current user can view shows',
            can_view_shows,
            'Public shows are accessible'
        );
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_validation(
            'Current user can view shows',
            FALSE,
            'Error: ' || SQLERRM
        );
    END;
    
    -- Test performance of show_participants query (check for infinite recursion)
    IF current_user_id IS NOT NULL THEN
        start_time := clock_timestamp();
        
        BEGIN
            PERFORM COUNT(*) FROM show_participants LIMIT 10;
            end_time := clock_timestamp();
            execution_time := end_time - start_time;
            
            PERFORM record_validation(
                'Show participants query completes quickly',
                execution_time < INTERVAL '1 second',
                'Query executed in ' || execution_time
            );
        EXCEPTION WHEN OTHERS THEN
            PERFORM record_validation(
                'Show participants query completes quickly',
                FALSE,
                'Error: ' || SQLERRM
            );
        END;
    END IF;
END $$;

-- ================================================================
-- SECTION 7: SUMMARY
-- ================================================================

-- Print summary of test results
DO $$
DECLARE
    total_tests INTEGER;
    passed_tests INTEGER;
    failed_tests INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE passed), COUNT(*) FILTER (WHERE NOT passed)
    INTO total_tests, passed_tests, failed_tests
    FROM security_validation_results;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'SECURITY VALIDATION SUMMARY';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Total checks: %', total_tests;
    RAISE NOTICE 'Passed: %', passed_tests;
    RAISE NOTICE 'Failed: %', failed_tests;
    RAISE NOTICE '================================================================';
    
    -- List failed tests if any
    IF failed_tests > 0 THEN
        RAISE NOTICE 'FAILED CHECKS:';
        FOR i IN (SELECT test_name, details FROM security_validation_results WHERE NOT passed ORDER BY test_name) LOOP
            RAISE NOTICE '❌ %: %', i.test_name, i.details;
        END LOOP;
        RAISE NOTICE '================================================================';
    END IF;
    
    -- Overall result
    IF failed_tests = 0 THEN
        RAISE NOTICE '✅ ALL SECURITY CHECKS PASSED!';
        RAISE NOTICE 'The consolidated RLS policies appear to be correctly configured.';
    ELSE
        RAISE NOTICE '❌ SECURITY VALIDATION FAILED!';
        RAISE NOTICE 'Please review the failed checks and fix the issues.';
    END IF;
    RAISE NOTICE '================================================================';
END $$;

-- Clean up temporary objects
DROP FUNCTION record_validation(TEXT, BOOLEAN, TEXT);

-- Rollback the transaction to ensure we don't modify any data
ROLLBACK;
