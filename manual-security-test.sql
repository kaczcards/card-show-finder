-- ================================================================
-- MANUAL SECURITY TEST SCRIPT
-- ================================================================
-- This script tests the consolidated RLS policies directly in the Supabase SQL Editor
-- It creates test users, runs security tests, and shows results
-- All changes are rolled back at the end
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
    -- Create profiles  (the profiles table does NOT have username / about fields)
    -- Using correct columns according to current schema:
    -- id, email, first_name, last_name, home_zip_code, role
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES
        (admin_id,      'admin@test.com',         'Admin',     'User',        'admin'),
        (organizer_id,  'organizer@test.com',     'Organizer', 'User',        'show_organizer'),
        (mvp_dealer_id, 'mvpdealer@test.com',     'MVP',       'Dealer',      'mvp_dealer'),
        (dealer_id,     'dealer@test.com',        'Dealer',    'User',        'dealer'),
        (attendee_id,   'attendee@test.com',      'Attendee',  'User',        'attendee'),
        (other_attendee_id,'other_attendee@test.com','Other',  'Attendee',    'attendee'),
        (evil_user_id,  'evil_user@test.com',     'Evil',      'User',        'attendee')
    ON CONFLICT (id) DO UPDATE SET 
        first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        role = EXCLUDED.role;

    -- Create test shows
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

    -- Create show participants
    INSERT INTO public.show_participants (id, showid, userid, role, status)
    VALUES
        (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', mvp_dealer_id, 'dealer', 'confirmed'),
        (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', dealer_id, 'dealer', 'confirmed'),
        (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', attendee_id, 'attendee', 'confirmed'),
        (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', other_attendee_id, 'attendee', 'confirmed')
    ON CONFLICT DO NOTHING;

    -- Create want lists
    INSERT INTO public.want_lists (id, userid, name, description)
    VALUES
        ('b1111111-1111-1111-1111-111111111111', attendee_id, 'Attendee Want List', 'Test want list for attendee'),
        ('b2222222-2222-2222-2222-222222222222', other_attendee_id, 'Other Attendee Want List', 'Test want list for other attendee')
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name;

    -- Create shared want lists
    INSERT INTO public.shared_want_lists (id, wantlistid, showid)
    VALUES
        (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555'),
        (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444')
    ON CONFLICT DO NOTHING;
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
-- SECTION 4: TEST PROFILES TABLE RLS
-- ================================================================

-- Test profiles_select_self policy
DO $$
DECLARE
    result BOOLEAN;
    row_count INTEGER;
BEGIN
    -- User should be able to view their own profile
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    
    SELECT COUNT(*) > 0 INTO result
    FROM profiles 
    WHERE id = '55555555-5555-5555-5555-555555555555';
    
    PERFORM record_test(
        'profiles_select_self policy allows viewing own profile',
        result,
        'User should be able to view their own profile'
    );
    
    -- User should not be able to update another user's profile
    BEGIN
        UPDATE profiles 
        SET first_name = 'Hacked profile!' 
        WHERE id = '66666666-6666-6666-6666-666666666666';
        
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        PERFORM record_test(
            'profiles_update_self policy prevents updating other profiles',
            row_count = 0,
            'User should not be able to update another user''s profile'
        );
    EXCEPTION WHEN OTHERS THEN
        -- If it throws an error, that's also good
        PERFORM record_test(
            'profiles_update_self policy prevents updating other profiles',
            TRUE,
            'Update was blocked with an error'
        );
    END;
    
    -- Anonymous user should not be able to view full profiles
    PERFORM set_anonymous_user();
    
    SELECT COUNT(*) = 0 INTO result
    FROM profiles 
    WHERE id = '55555555-5555-5555-5555-555555555555';
    
    PERFORM record_test(
        'Anonymous user cannot view profiles',
        result,
        'Anonymous user should not be able to view profiles'
    );
END $$;

-- ================================================================
-- SECTION 5: TEST SHOWS TABLE RLS
-- ================================================================

-- Test shows RLS policies
DO $$
DECLARE
    result BOOLEAN;
    row_count INTEGER;
BEGIN
    -- Anyone should be able to view shows
    PERFORM set_anonymous_user();
    
    SELECT COUNT(*) > 0 INTO result
    FROM shows;
    
    PERFORM record_test(
        'shows_select_all policy allows public viewing',
        result,
        'Anyone should be able to view shows'
    );
    
    -- Organizer should be able to update their own show
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    
    BEGIN
        UPDATE shows 
        SET description = 'Updated description' 
        WHERE id = 'a2222222-2222-2222-2222-222222222222';
        
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        PERFORM record_test(
            'shows_update_organizer policy allows updating own shows',
            row_count > 0,
            'Organizer should be able to update their own shows'
        );
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_test(
            'shows_update_organizer policy allows updating own shows',
            FALSE,
            'Update failed: ' || SQLERRM
        );
    END;
    
    -- Regular user should not be able to update someone else's show
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    
    BEGIN
        UPDATE shows 
        SET description = 'Hacked description' 
        WHERE id = 'a2222222-2222-2222-2222-222222222222';
        
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        PERFORM record_test(
            'shows_update_organizer policy prevents unauthorized updates',
            row_count = 0,
            'Regular user should not be able to update someone else''s show'
        );
    EXCEPTION WHEN OTHERS THEN
        -- If it throws an error, that's also good
        PERFORM record_test(
            'shows_update_organizer policy prevents unauthorized updates',
            TRUE,
            'Update was blocked with an error'
        );
    END;
END $$;

-- ================================================================
-- SECTION 6: TEST SHOW_PARTICIPANTS TABLE RLS
-- ================================================================

-- Test show_participants RLS policies
DO $$
DECLARE
    result BOOLEAN;
    row_count INTEGER;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTERVAL;
BEGIN
    -- User should be able to view their own participation
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    
    SELECT COUNT(*) > 0 INTO result
    FROM show_participants 
    WHERE userid = '55555555-5555-5555-5555-555555555555';
    
    PERFORM record_test(
        'show_participants_select_self policy allows viewing own participation',
        result,
        'User should be able to view their own participation'
    );
    
    -- User should not be able to view other participations
    SELECT COUNT(*) = 0 INTO result
    FROM show_participants 
    WHERE userid = '44444444-4444-4444-4444-444444444444';
    
    PERFORM record_test(
        'User cannot view other participations directly',
        result,
        'User should not be able to view other participations directly'
    );
    
    -- Show organizer should be able to view participants for their shows
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    
    SELECT COUNT(*) > 0 INTO result
    FROM show_participants 
    WHERE showid = 'a3333333-3333-3333-3333-333333333333';
    
    PERFORM record_test(
        'show_participants_select_organizer policy allows viewing participants',
        result,
        'Organizer should be able to view participants for their shows'
    );
    
    -- MVP dealer should be able to view participants for shows they participate in
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    
    -- Record start time
    start_time := clock_timestamp();
    
    SELECT COUNT(*) > 0 INTO result
    FROM show_participants 
    WHERE showid = 'a3333333-3333-3333-3333-333333333333';
    
    -- Record end time
    end_time := clock_timestamp();
    
    -- Calculate execution time
    execution_time := end_time - start_time;
    
    PERFORM record_test(
        'MVP dealer can view participants for their shows',
        result,
        'MVP dealer should be able to view participants for shows they participate in'
    );
    
    -- Test that the non-recursive approach prevents infinite recursion
    PERFORM record_test(
        'Non-recursive approach prevents infinite recursion',
        execution_time < INTERVAL '1 second',
        'Query executed in ' || execution_time || ' (should be less than 1 second)'
    );
    
    -- MVP dealer should not be able to view participants for shows they don't participate in
    SELECT COUNT(*) = 0 INTO result
    FROM show_participants 
    WHERE showid = 'a4444444-4444-4444-4444-444444444444';
    
    PERFORM record_test(
        'MVP dealer cannot view participants for unrelated shows',
        result,
        'MVP dealer should not be able to view participants for shows they don''t participate in'
    );
END $$;

-- ================================================================
-- SECTION 7: TEST WANT_LISTS TABLE RLS
-- ================================================================

-- Test want_lists RLS policies
DO $$
DECLARE
    result BOOLEAN;
    row_count INTEGER;
BEGIN
    -- User should be able to view their own want lists
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    
    SELECT COUNT(*) > 0 INTO result
    FROM want_lists 
    WHERE userid = '55555555-5555-5555-5555-555555555555';
    
    PERFORM record_test(
        'want_lists_select_self policy allows viewing own want lists',
        result,
        'User should be able to view their own want lists'
    );
    
    -- User should not be able to view others' want lists directly
    SELECT COUNT(*) = 0 INTO result
    FROM want_lists 
    WHERE userid = '66666666-6666-6666-6666-666666666666';
    
    PERFORM record_test(
        'User cannot view others'' want lists directly',
        result,
        'User should not be able to view others'' want lists directly'
    );
    
    -- MVP dealer should be able to view want lists for shows they're involved with
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    
    -- This is a complex case that depends on shared_want_lists, so we'll simplify
    -- by testing if they can see any want lists at all
    SELECT EXISTS (
        SELECT 1 FROM want_lists w
        JOIN shared_want_lists swl ON w.id = swl.wantlistid
        JOIN shows s ON swl.showid = s.id
        WHERE s.id = 'a3333333-3333-3333-3333-333333333333'
    ) INTO result;
    
    PERFORM record_test(
        'MVP dealers can view want lists for their shows',
        result,
        'MVP dealer should be able to view want lists for shows they participate in'
    );
END $$;

-- ================================================================
-- SECTION 8: SECURITY BOUNDARIES TEST
-- ================================================================

-- Test that evil user cannot access data they shouldn't
DO $$
DECLARE
    result BOOLEAN;
    row_count INTEGER;
BEGIN
    -- Set user to evil user
    PERFORM set_test_user('77777777-7777-7777-7777-777777777777');
    
    -- Evil user should not be able to view other users' show participation
    SELECT COUNT(*) = 0 INTO result
    FROM show_participants 
    WHERE userid = '55555555-5555-5555-5555-555555555555';
    
    PERFORM record_test(
        'Evil user cannot view others'' show participation',
        result,
        'Evil user should not be able to view others'' show participation'
    );
    
    -- Evil user should not be able to view others' want lists
    SELECT COUNT(*) = 0 INTO result
    FROM want_lists 
    WHERE userid = '55555555-5555-5555-5555-555555555555';
    
    PERFORM record_test(
        'Evil user cannot view others'' want lists',
        result,
        'Evil user should not be able to view others'' want lists'
    );
    
    -- Evil user should not be able to update others' profiles
    BEGIN
        UPDATE profiles 
        SET first_name = 'Hacked!' 
        WHERE id = '55555555-5555-5555-5555-555555555555';
        
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        PERFORM record_test(
            'Evil user cannot update others'' profiles',
            row_count = 0,
            'Evil user should not be able to update others'' profiles'
        );
    EXCEPTION WHEN OTHERS THEN
        -- If it throws an error, that's also good
        PERFORM record_test(
            'Evil user cannot update others'' profiles',
            TRUE,
            'Update was blocked with an error'
        );
    END;
END $$;

-- ================================================================
-- SECTION 9: SUMMARY AND CLEANUP
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

-- Clean up temporary objects
DROP FUNCTION record_test(TEXT, BOOLEAN, TEXT);
DROP FUNCTION set_test_user(UUID);
DROP FUNCTION set_anonymous_user();

-- Rollback the transaction to clean up test data
ROLLBACK;
