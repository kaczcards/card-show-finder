-- ================================================================
-- QUICK SECURITY CHECK
-- ================================================================
-- Simple script to verify consolidated RLS setup is working correctly
-- Checks helper functions, RLS status, policies, and recursion issues
-- ================================================================

-- Begin transaction for safety (will be rolled back)
BEGIN;

-- Track pass/fail counts
DO $$
DECLARE
    pass_count INT := 0;
    fail_count INT := 0;
    
    -- Helper function check variables
    function_exists BOOLEAN;
    
    -- RLS check variables
    rls_enabled BOOLEAN;
    
    -- Policy check variables
    policy_count INT;
    
    -- Performance check variables
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTERVAL;
BEGIN
    RAISE NOTICE '=== QUICK SECURITY CHECK STARTED ===';
    
    -- 1. CHECK HELPER FUNCTIONS EXIST
    RAISE NOTICE '';
    RAISE NOTICE '1. CHECKING HELPER FUNCTIONS:';
    
    -- Check is_admin()
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'is_admin'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ is_admin() function exists';
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ is_admin() function missing!';
        fail_count := fail_count + 1;
    END IF;
    
    -- Check participates_in_show_safe()
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'participates_in_show_safe'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ participates_in_show_safe() function exists';
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ participates_in_show_safe() function missing!';
        fail_count := fail_count + 1;
    END IF;
    
    -- 2. CHECK RLS IS ENABLED
    RAISE NOTICE '';
    RAISE NOTICE '2. CHECKING RLS STATUS:';
    
    -- Check profiles table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'profiles'
    INTO rls_enabled;
    
    IF COALESCE(rls_enabled, FALSE) THEN
        RAISE NOTICE '✅ RLS enabled on profiles table';
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ RLS NOT enabled on profiles table!';
        fail_count := fail_count + 1;
    END IF;
    
    -- Check show_participants table
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'show_participants'
    INTO rls_enabled;
    
    IF COALESCE(rls_enabled, FALSE) THEN
        RAISE NOTICE '✅ RLS enabled on show_participants table';
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ RLS NOT enabled on show_participants table!';
        fail_count := fail_count + 1;
    END IF;
    
    -- 3. CHECK POLICIES EXIST
    RAISE NOTICE '';
    RAISE NOTICE '3. CHECKING POLICIES:';
    
    -- Check show_participants policies
    SELECT COUNT(*) FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'show_participants'
    INTO policy_count;
    
    IF policy_count > 0 THEN
        RAISE NOTICE '✅ Found % policies on show_participants table', policy_count;
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ No policies found on show_participants table!';
        fail_count := fail_count + 1;
    END IF;
    
    -- 4. CHECK FOR INFINITE RECURSION
    RAISE NOTICE '';
    RAISE NOTICE '4. CHECKING FOR INFINITE RECURSION:';
    
    -- Time a simple shows query
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM shows LIMIT 5;
    end_time := clock_timestamp();
    execution_time := end_time - start_time;
    
    IF execution_time < INTERVAL '1 second' THEN
        RAISE NOTICE '✅ Shows query completed in %', execution_time;
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ Shows query took too long: %', execution_time;
        fail_count := fail_count + 1;
    END IF;
    
    -- Time a show_participants query
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM show_participants LIMIT 5;
    end_time := clock_timestamp();
    execution_time := end_time - start_time;
    
    IF execution_time < INTERVAL '1 second' THEN
        RAISE NOTICE '✅ Show_participants query completed in %', execution_time;
        pass_count := pass_count + 1;
    ELSE
        RAISE NOTICE '❌ Show_participants query took too long: %', execution_time;
        fail_count := fail_count + 1;
    END IF;
    
    -- SUMMARY
    RAISE NOTICE '';
    RAISE NOTICE '=== SECURITY CHECK SUMMARY ===';
    RAISE NOTICE 'Passed: %', pass_count;
    RAISE NOTICE 'Failed: %', fail_count;
    
    IF fail_count = 0 THEN
        RAISE NOTICE '✅ ALL CHECKS PASSED - Consolidated RLS appears to be working correctly';
    ELSE
        RAISE NOTICE '❌ % CHECKS FAILED - Consolidated RLS may have issues', fail_count;
    END IF;
END $$;

-- Rollback transaction (no changes made)
ROLLBACK;
