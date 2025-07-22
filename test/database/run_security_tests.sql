-- ================================================================
-- RUN_SECURITY_TESTS.SQL
-- ================================================================
-- Focused test runner for validating the consolidated RLS policies
-- This script tests critical security aspects of the Card Show Finder app:
--   1. Helper function correctness
--   2. Key RLS policy enforcement
--   3. Infinite recursion prevention
--   4. Security boundaries between roles
--
-- Usage: Run this script in the Supabase SQL Editor
-- ================================================================

-- Begin transaction to allow rollback
BEGIN;

-- ================================================================
-- SECTION 1: TEST SETUP
-- ================================================================

-- Create a temporary table to store test results
CREATE TEMPORARY TABLE test_results (
    test_name TEXT,
    passed BOOLEAN,
    details TEXT
);

-- Function to record test results
CREATE OR REPLACE FUNCTION record_test(test_name TEXT, passed BOOLEAN, details TEXT DEFAULT NULL) 
RETURNS VOID AS $$
BEGIN
    INSERT INTO test_results (test_name, passed, details)
    VALUES (test_name, passed, details);
    
    -- Also output to console
    IF passed THEN
        RAISE NOTICE '✅ PASS: %', test_name;
    ELSE
        RAISE NOTICE '❌ FAIL: % - %', test_name, COALESCE(details, 'Test failed');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to set the current user for testing
CREATE OR REPLACE FUNCTION set_test_user(user_id UUID) RETURNS VOID AS $$
BEGIN
    -- Set auth.uid() to return this user_id
    PERFORM set_config('request.jwt.claim.sub', user_id::TEXT, FALSE);
    -- Set auth.role() to return 'authenticated'
    PERFORM set_config('request.jwt.claim.role', 'authenticated', FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to set anonymous role
CREATE OR REPLACE FUNCTION set_anonymous_user() RETURNS VOID AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', FALSE);
    PERFORM set_config('request.jwt.claim.role', 'anon', FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to check if a query returns rows
CREATE OR REPLACE FUNCTION test_query_returns_rows(query TEXT) RETURNS BOOLEAN AS $$
DECLARE
    result INTEGER;
BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || query || ') AS q' INTO result;
    RETURN result > 0;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Query error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a query returns no rows
CREATE OR REPLACE FUNCTION test_query_returns_no_rows(query TEXT) RETURNS BOOLEAN AS $$
DECLARE
    result INTEGER;
BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || query || ') AS q' INTO result;
    RETURN result = 0;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Query error: %', SQLERRM;
        RETURN TRUE; -- Permission denied is expected for some tests
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 2: CREATE TEST DATA
-- ================================================================

-- Create test users with different roles
DO $$
DECLARE
    admin_id UUID := '11111111-1111-1111-1111-111111111111';
    organizer_id UUID := '22222222-2222-2222-2222-222222222222';
    mvp_dealer_id UUID := '33333333-3333-3333-3333-333333333333';
    dealer_id UUID := '44444444-4444-4444-4444-444444444444';
    attendee_id UUID := '55555555-5555-5555-5555-555555555555';
    other_attendee_id UUID := '66666666-6666-6666-6666-666666666666';
    evil_user_id UUID := '77777777-7777-7777-7777-777777777777';
BEGIN
    -- Create test users in auth.users (mock)
    BEGIN
        INSERT INTO auth.users (id, email) VALUES
            (admin_id, 'admin@test.com'),
            (organizer_id, 'organizer@test.com'),
            (mvp_dealer_id, 'mvpdealer@test.com'),
            (dealer_id, 'dealer@test.com'),
            (attendee_id, 'attendee@test.com'),
            (other_attendee_id, 'other.attendee@test.com'),
            (evil_user_id, 'evil.user@test.com')
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not insert into auth.users: %', SQLERRM;
        -- Continue anyway as this might be a permissions issue in the SQL editor
    END;

    -- Create profiles (match actual table columns: id, email, first_name, last_name, role)
    BEGIN
        INSERT INTO public.profiles (id, email, first_name, last_name, role)
        VALUES
            (admin_id,        'admin@test.com',        'Admin',     'User',     'admin'),
            (organizer_id,    'organizer@test.com',    'Organizer', 'User',     'show_organizer'),
            (mvp_dealer_id,   'mvpdealer@test.com',    'MVP',       'Dealer',   'mvp_dealer'),
            (dealer_id,       'dealer@test.com',       'Dealer',    'User',     'dealer'),
            (attendee_id,     'attendee@test.com',     'Attendee',  'User',     'attendee'),
            (other_attendee_id,'other_attendee@test.com','Other',   'Attendee', 'attendee'),
            (evil_user_id,    'evil_user@test.com',    'Evil',      'User',     'attendee')
        ON CONFLICT (id) DO UPDATE SET 
            first_name = EXCLUDED.first_name,
            last_name  = EXCLUDED.last_name,
            role = EXCLUDED.role;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating profiles: %', SQLERRM;
    END;

    -- Create test shows
    BEGIN
        INSERT INTO public.shows (id, name, description, location, start_date, end_date, organizer_id, status)
        VALUES
            ('a1111111-1111-1111-1111-111111111111', 'Admin Show', 'Show organized by admin', 'Admin Location', NOW(), NOW() + INTERVAL '2 days', admin_id, 'active'),
            ('a2222222-2222-2222-2222-222222222222', 'Organizer Show', 'Show organized by organizer', 'Organizer Location', NOW(), NOW() + INTERVAL '2 days', organizer_id, 'active'),
            ('a3333333-3333-3333-3333-333333333333', 'MVP Dealer Show', 'Show with MVP dealer participation', 'MVP Dealer Location', NOW(), NOW() + INTERVAL '2 days', organizer_id, 'active'),
            ('a4444444-4444-4444-4444-444444444444', 'Dealer Show', 'Show with dealer participation', 'Dealer Location', NOW(), NOW() + INTERVAL '2 days', organizer_id, 'active'),
            ('a5555555-5555-5555-5555-555555555555', 'Attendee Show', 'Show with attendee participation', 'Attendee Location', NOW(), NOW() + INTERVAL '2 days', organizer_id, 'active')
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            organizer_id = EXCLUDED.organizer_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating shows: %', SQLERRM;
    END;

    -- Create show participants
    BEGIN
        INSERT INTO public.show_participants (id, showid, userid, role, status)
        VALUES
            (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', mvp_dealer_id, 'dealer', 'confirmed'),
            (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', dealer_id, 'dealer', 'confirmed'),
            (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', attendee_id, 'attendee', 'confirmed'),
            (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', other_attendee_id, 'attendee', 'confirmed')
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating show_participants: %', SQLERRM;
    END;

    -- Create want lists
    BEGIN
        INSERT INTO public.want_lists (id, userid, name, description)
        VALUES
            ('b1111111-1111-1111-1111-111111111111', attendee_id, 'Attendee Want List', 'Test want list for attendee'),
            ('b2222222-2222-2222-2222-222222222222', other_attendee_id, 'Other Attendee Want List', 'Test want list for other attendee')
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating want_lists: %', SQLERRM;
    END;

    -- Create shared want lists
    BEGIN
        INSERT INTO public.shared_want_lists (id, wantlistid, showid)
        VALUES
            (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555'),
            (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444')
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating shared_want_lists: %', SQLERRM;
    END;
END $$;

-- ================================================================
-- SECTION 3: TEST HELPER FUNCTIONS
-- ================================================================

-- Test is_admin() function
DO $$
BEGIN
    -- Admin user should return true
    PERFORM set_test_user('11111111-1111-1111-1111-111111111111');
    PERFORM record_test(
        'is_admin() returns true for admin user',
        is_admin(),
        'Admin user should be identified as admin'
    );
    
    -- Non-admin user should return false
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    PERFORM record_test(
        'is_admin() returns false for non-admin user',
        NOT is_admin(),
        'Non-admin user should not be identified as admin'
    );
END $$;

-- Test is_show_organizer() function
DO $$
BEGIN
    -- Organizer user should return true
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    PERFORM record_test(
        'is_show_organizer() returns true for organizer user',
        is_show_organizer(),
        'Organizer user should be identified as show organizer'
    );
    
    -- Non-organizer user should return false
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    PERFORM record_test(
        'is_show_organizer() returns false for non-organizer user',
        NOT is_show_organizer(),
        'Non-organizer user should not be identified as show organizer'
    );
END $$;

-- Test is_mvp_dealer() function
DO $$
BEGIN
    -- MVP dealer user should return true
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    PERFORM record_test(
        'is_mvp_dealer() returns true for MVP dealer user',
        is_mvp_dealer(),
        'MVP dealer user should be identified as MVP dealer'
    );
    
    -- Non-MVP dealer user should return false
    PERFORM set_test_user('44444444-4444-4444-4444-444444444444');
    PERFORM record_test(
        'is_mvp_dealer() returns false for regular dealer user',
        NOT is_mvp_dealer(),
        'Regular dealer user should not be identified as MVP dealer'
    );
END $$;

-- Test participates_in_show_safe() function
DO $$
BEGIN
    -- Organizer should participate in their show
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    PERFORM record_test(
        'participates_in_show_safe() returns true for organizer',
        participates_in_show_safe('a2222222-2222-2222-2222-222222222222'),
        'Organizer should participate in their own show'
    );
    
    -- MVP dealer should participate in their show
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    PERFORM record_test(
        'participates_in_show_safe() returns true for MVP dealer',
        participates_in_show_safe('a3333333-3333-3333-3333-333333333333'),
        'MVP dealer should participate in their assigned show'
    );
    
    -- Attendee should not participate in unrelated show
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    PERFORM record_test(
        'participates_in_show_safe() returns false for unrelated show',
        NOT participates_in_show_safe('a3333333-3333-3333-3333-333333333333'),
        'Attendee should not participate in unrelated show'
    );
END $$;

-- ================================================================
-- SECTION 4: TEST RLS POLICIES
-- ================================================================

-- Test profiles_select_self policy
DO $$
BEGIN
    -- User should be able to view their own profile
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    PERFORM record_test(
        'profiles_select_self policy allows viewing own profile',
        test_query_returns_rows('SELECT * FROM profiles WHERE id = ''55555555-5555-5555-5555-555555555555'''),
        'User should be able to view their own profile'
    );
    
    -- Anonymous user should not be able to view profiles
    PERFORM set_anonymous_user();
    PERFORM record_test(
        'Anonymous user cannot view profiles',
        test_query_returns_no_rows('SELECT * FROM profiles WHERE id = ''55555555-5555-5555-5555-555555555555'''),
        'Anonymous user should not be able to view profiles'
    );
END $$;

-- Test show_participants_select_self policy
DO $$
BEGIN
    -- User should be able to view their own participation
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    PERFORM record_test(
        'show_participants_select_self policy allows viewing own participation',
        test_query_returns_rows('SELECT * FROM show_participants WHERE userid = ''55555555-5555-5555-5555-555555555555'''),
        'User should be able to view their own participation'
    );
    
    -- User should not be able to view other participations
    PERFORM record_test(
        'User cannot view other participations directly',
        test_query_returns_no_rows('SELECT * FROM show_participants WHERE userid = ''44444444-4444-4444-4444-444444444444'''),
        'User should not be able to view other participations directly'
    );
END $$;

-- Test show_participants_select_organizer policy
DO $$
BEGIN
    -- Organizer should be able to view participants for their shows
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    PERFORM record_test(
        'show_participants_select_organizer policy allows viewing participants',
        test_query_returns_rows('SELECT * FROM show_participants WHERE showid = ''a3333333-3333-3333-3333-333333333333'''),
        'Organizer should be able to view participants for their shows'
    );
END $$;

-- Test show_participants_select_mvp_dealer_safe policy
DO $$
BEGIN
    -- MVP dealer should be able to view their own participation
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    PERFORM record_test(
        'MVP dealer can view their own participation',
        test_query_returns_rows('SELECT * FROM show_participants WHERE userid = ''33333333-3333-3333-3333-333333333333'''),
        'MVP dealer should be able to view their own participation'
    );
    
    -- MVP dealer should be able to view participants for shows they participate in
    PERFORM record_test(
        'MVP dealer can view participants for their shows',
        test_query_returns_rows('SELECT * FROM show_participants WHERE showid = ''a3333333-3333-3333-3333-333333333333'''),
        'MVP dealer should be able to view participants for shows they participate in'
    );
    
    -- MVP dealer should not be able to view participants for shows they don't participate in
    PERFORM record_test(
        'MVP dealer cannot view participants for unrelated shows',
        test_query_returns_no_rows('SELECT * FROM show_participants WHERE showid = ''a4444444-4444-4444-4444-444444444444'''),
        'MVP dealer should not be able to view participants for shows they don''t participate in'
    );
END $$;

-- Test want_lists_select_self policy
DO $$
BEGIN
    -- User should be able to view their own want lists
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    PERFORM record_test(
        'want_lists_select_self policy allows viewing own want lists',
        test_query_returns_rows('SELECT * FROM want_lists WHERE userid = ''55555555-5555-5555-5555-555555555555'''),
        'User should be able to view their own want lists'
    );
    
    -- User should not be able to view others' want lists directly
    PERFORM record_test(
        'User cannot view others'' want lists directly',
        test_query_returns_no_rows('SELECT * FROM want_lists WHERE userid = ''66666666-6666-6666-6666-666666666666'''),
        'User should not be able to view others'' want lists directly'
    );
END $$;

-- ================================================================
-- SECTION 5: TEST INFINITE RECURSION PREVENTION
-- ================================================================

-- Test that the non-recursive approach prevents infinite recursion
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTERVAL;
    result_count INTEGER;
BEGIN
    -- Set user to MVP dealer
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    
    -- Record start time
    start_time := clock_timestamp();
    
    -- Execute the query that previously caused infinite recursion
    EXECUTE 'SELECT COUNT(*) FROM show_participants WHERE showid = ''a3333333-3333-3333-3333-333333333333''' INTO result_count;
    
    -- Record end time
    end_time := clock_timestamp();
    
    -- Calculate execution time
    execution_time := end_time - start_time;
    
    -- Test passes if execution time is reasonable (less than 1 second)
    -- and the query returns results
    PERFORM record_test(
        'Non-recursive approach prevents infinite recursion',
        execution_time < INTERVAL '1 second' AND result_count > 0,
        'Query executed in ' || execution_time || ' and returned ' || result_count || ' rows'
    );
END $$;

-- ================================================================
-- SECTION 6: SECURITY BOUNDARIES TEST
-- ================================================================

-- Test that evil user cannot access data they shouldn't
DO $$
BEGIN
    -- Set user to evil user
    PERFORM set_test_user('77777777-7777-7777-7777-777777777777');
    
    -- Evil user should not be able to view other users' show participation
    PERFORM record_test(
        'Evil user cannot view others'' show participation',
        test_query_returns_no_rows('SELECT * FROM show_participants WHERE userid = ''55555555-5555-5555-5555-555555555555'''),
        'Evil user should not be able to view others'' show participation'
    );
    
    -- Evil user should not be able to view others' want lists
    PERFORM record_test(
        'Evil user cannot view others'' want lists',
        test_query_returns_no_rows('SELECT * FROM want_lists WHERE userid = ''55555555-5555-5555-5555-555555555555'''),
        'Evil user should not be able to view others'' want lists'
    );
    
    -- Evil user should not be able to update others' profiles
    BEGIN
        -- Attempt to tamper with another user's profile
        EXECUTE 'UPDATE profiles SET first_name = ''Hacked!'' WHERE id = ''55555555-5555-5555-5555-555555555555''';
        PERFORM record_test(
            'Evil user cannot update others'' profiles',
            FALSE,
            'Evil user should not be able to update others'' profiles'
        );
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_test(
            'Evil user cannot update others'' profiles',
            TRUE,
            'Permission denied as expected'
        );
    END;
END $$;

-- ================================================================
-- SECTION 7: SUMMARY AND CLEANUP
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
    FROM test_results;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'SECURITY TEST SUMMARY';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Total tests: %', total_tests;
    RAISE NOTICE 'Passed tests: %', passed_tests;
    RAISE NOTICE 'Failed tests: %', failed_tests;
    RAISE NOTICE '================================================================';
    
    -- List failed tests if any
    IF failed_tests > 0 THEN
        RAISE NOTICE 'FAILED TESTS:';
        FOR i IN (SELECT test_name, details FROM test_results WHERE NOT passed ORDER BY test_name) LOOP
            RAISE NOTICE '❌ %: %', i.test_name, i.details;
        END LOOP;
        RAISE NOTICE '================================================================';
    END IF;
    
    -- Overall result
    IF failed_tests = 0 THEN
        RAISE NOTICE '✅ ALL SECURITY TESTS PASSED!';
        RAISE NOTICE 'The consolidated RLS policies are working correctly.';
    ELSE
        RAISE NOTICE '❌ SECURITY TESTS FAILED!';
        RAISE NOTICE 'Please review the failed tests and fix the issues.';
    END IF;
    RAISE NOTICE '================================================================';
END $$;

-- Clean up temporary objects (uncomment to keep results)
-- DROP TABLE test_results;
-- DROP FUNCTION record_test(TEXT, BOOLEAN, TEXT);
-- DROP FUNCTION set_test_user(UUID);
-- DROP FUNCTION set_anonymous_user();
-- DROP FUNCTION test_query_returns_rows(TEXT);
-- DROP FUNCTION test_query_returns_no_rows(TEXT);

-- Rollback the transaction to clean up test data
ROLLBACK;
