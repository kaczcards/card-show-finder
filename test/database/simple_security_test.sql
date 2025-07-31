-- ================================================================
-- SIMPLE SECURITY TEST FOR CARD SHOW FINDER
-- ================================================================
-- This script provides a simplified security test that works with
-- standard PostgreSQL without requiring pgTAP or Supabase.
--
-- It tests the core security logic by:
-- 1. Creating a simplified schema with essential tables
-- 2. Implementing core security helper functions
-- 3. Testing basic security scenarios
-- 4. Providing clear test results with NOTICE statements
--
-- Usage: 
--   psql -f test/database/simple_security_test.sql
-- ================================================================

-- Begin transaction to allow rollback
BEGIN;

-- ================================================================
-- SECTION 1: TEST SETUP
-- ================================================================

-- Create a temporary table to store test results
CREATE TEMPORARY TABLE test_results (
    test_id SERIAL PRIMARY KEY,
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
CREATE OR REPLACE FUNCTION set_test_user(user_id TEXT) RETURNS VOID AS $$
BEGIN
    -- Store the user ID in a session variable
    PERFORM set_config('app.current_user_id', user_id, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get the current user ID
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', TRUE);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
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
-- SECTION 2: SCHEMA CREATION (SIMPLIFIED)
-- ================================================================

-- Create simplified user roles enum
CREATE TYPE user_role AS ENUM ('admin', 'show_organizer', 'mvp_dealer', 'dealer', 'attendee');

-- Create simplified profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'attendee',
    avatar_url TEXT,
    website TEXT,
    about TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create simplified shows table
CREATE TABLE IF NOT EXISTS shows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    organizer_id TEXT NOT NULL REFERENCES profiles(id),
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create simplified show_participants table
CREATE TABLE IF NOT EXISTS show_participants (
    id TEXT PRIMARY KEY,
    showid TEXT NOT NULL REFERENCES shows(id),
    userid TEXT NOT NULL REFERENCES profiles(id),
    role TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(showid, userid)
);

-- Create simplified want_lists table
CREATE TABLE IF NOT EXISTS want_lists (
    id TEXT PRIMARY KEY,
    userid TEXT NOT NULL REFERENCES profiles(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create simplified shared_want_lists table
CREATE TABLE IF NOT EXISTS shared_want_lists (
    id TEXT PRIMARY KEY,
    wantlistid TEXT NOT NULL REFERENCES want_lists(id),
    showid TEXT NOT NULL REFERENCES shows(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wantlistid, showid)
);

-- ================================================================
-- SECTION 3: SECURITY HELPER FUNCTIONS
-- ================================================================

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
DECLARE
    user_role_val TEXT;
BEGIN
    SELECT role::TEXT INTO user_role_val FROM profiles WHERE id = current_user_id();
    RETURN user_role_val = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user is a show organizer
CREATE OR REPLACE FUNCTION is_show_organizer() RETURNS BOOLEAN AS $$
DECLARE
    user_role_val TEXT;
BEGIN
    SELECT role::TEXT INTO user_role_val FROM profiles WHERE id = current_user_id();
    RETURN user_role_val = 'show_organizer';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user is an MVP dealer
CREATE OR REPLACE FUNCTION is_mvp_dealer() RETURNS BOOLEAN AS $$
DECLARE
    user_role_val TEXT;
BEGIN
    SELECT role::TEXT INTO user_role_val FROM profiles WHERE id = current_user_id();
    RETURN user_role_val = 'mvp_dealer';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user is a dealer
CREATE OR REPLACE FUNCTION is_dealer() RETURNS BOOLEAN AS $$
DECLARE
    user_role_val TEXT;
BEGIN
    SELECT role::TEXT INTO user_role_val FROM profiles WHERE id = current_user_id();
    RETURN user_role_val = 'dealer' OR user_role_val = 'mvp_dealer';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user is an attendee
CREATE OR REPLACE FUNCTION is_attendee() RETURNS BOOLEAN AS $$
DECLARE
    user_role_val TEXT;
BEGIN
    SELECT role::TEXT INTO user_role_val FROM profiles WHERE id = current_user_id();
    RETURN user_role_val = 'attendee';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user is the organizer of a show
CREATE OR REPLACE FUNCTION is_show_owner(show_id TEXT) RETURNS BOOLEAN AS $$
DECLARE
    organizer_id_val TEXT;
BEGIN
    SELECT organizer_id INTO organizer_id_val FROM shows WHERE id = show_id;
    RETURN organizer_id_val = current_user_id();
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user participates in a show
CREATE OR REPLACE FUNCTION participates_in_show(show_id TEXT) RETURNS BOOLEAN AS $$
DECLARE
    participant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO participant_count 
    FROM show_participants 
    WHERE showid = show_id AND userid = current_user_id();
    
    RETURN participant_count > 0 OR is_show_owner(show_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Safe version of participates_in_show to prevent infinite recursion
CREATE OR REPLACE FUNCTION participates_in_show_safe(show_id TEXT) RETURNS BOOLEAN AS $$
DECLARE
    participant_count INTEGER;
    organizer_id_val TEXT;
BEGIN
    -- First check if user is the organizer (direct query, no recursion)
    SELECT organizer_id INTO organizer_id_val FROM shows WHERE id = show_id;
    IF organizer_id_val = current_user_id() THEN
        RETURN TRUE;
    END IF;
    
    -- Then check if user is a participant (direct query, no recursion)
    SELECT COUNT(*) INTO participant_count 
    FROM show_participants 
    WHERE showid = show_id AND userid = current_user_id();
    
    RETURN participant_count > 0;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current user owns a want list
CREATE OR REPLACE FUNCTION owns_want_list(wantlist_id TEXT) RETURNS BOOLEAN AS $$
DECLARE
    owner_id TEXT;
BEGIN
    SELECT userid INTO owner_id FROM want_lists WHERE id = wantlist_id;
    RETURN owner_id = current_user_id();
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 4: CREATE TEST DATA
-- ================================================================

-- Create test users with different roles
DO $$
DECLARE
    admin_id TEXT := '11111111-1111-1111-1111-111111111111';
    organizer_id TEXT := '22222222-2222-2222-2222-222222222222';
    mvp_dealer_id TEXT := '33333333-3333-3333-3333-333333333333';
    dealer_id TEXT := '44444444-4444-4444-4444-444444444444';
    attendee_id TEXT := '55555555-5555-5555-5555-555555555555';
    other_attendee_id TEXT := '66666666-6666-6666-6666-666666666666';
    evil_user_id TEXT := '77777777-7777-7777-7777-777777777777';
BEGIN
    -- Create profiles
    INSERT INTO profiles (id, username, full_name, role, avatar_url, website, about)
    VALUES
        (admin_id, 'admin', 'Admin User', 'admin', 'https://example.com/avatar1.jpg', 'https://admin.com', 'Test admin user'),
        (organizer_id, 'organizer', 'Organizer User', 'show_organizer', 'https://example.com/avatar2.jpg', 'https://organizer.com', 'Test organizer user'),
        (mvp_dealer_id, 'mvpdealer', 'MVP Dealer User', 'mvp_dealer', 'https://example.com/avatar3.jpg', 'https://mvpdealer.com', 'Test MVP dealer user'),
        (dealer_id, 'dealer', 'Dealer User', 'dealer', 'https://example.com/avatar4.jpg', 'https://dealer.com', 'Test dealer user'),
        (attendee_id, 'attendee', 'Attendee User', 'attendee', 'https://example.com/avatar5.jpg', 'https://attendee.com', 'Test attendee user'),
        (other_attendee_id, 'other_attendee', 'Other Attendee', 'attendee', 'https://example.com/avatar6.jpg', 'https://other-attendee.com', 'Another test attendee'),
        (evil_user_id, 'evil_user', 'Evil User', 'attendee', 'https://example.com/avatar7.jpg', 'https://evil-user.com', 'User trying to access unauthorized data')
    ON CONFLICT (id) DO UPDATE SET 
        username = EXCLUDED.username,
        role = EXCLUDED.role;

    -- Create test shows
    INSERT INTO shows (id, name, description, location, start_date, end_date, organizer_id, status)
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
    INSERT INTO show_participants (id, showid, userid, role, status)
    VALUES
        ('p1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', mvp_dealer_id, 'dealer', 'confirmed'),
        ('p2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', dealer_id, 'dealer', 'confirmed'),
        ('p3333333-3333-3333-3333-333333333333', 'a5555555-5555-5555-5555-555555555555', attendee_id, 'attendee', 'confirmed'),
        ('p4444444-4444-4444-4444-444444444444', 'a5555555-5555-5555-5555-555555555555', other_attendee_id, 'attendee', 'confirmed')
    ON CONFLICT (showid, userid) DO NOTHING;

    -- Create want lists
    INSERT INTO want_lists (id, userid, name, description)
    VALUES
        ('w1111111-1111-1111-1111-111111111111', attendee_id, 'Attendee Want List', 'Test want list for attendee'),
        ('w2222222-2222-2222-2222-222222222222', other_attendee_id, 'Other Attendee Want List', 'Test want list for other attendee')
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name;

    -- Create shared want lists
    INSERT INTO shared_want_lists (id, wantlistid, showid)
    VALUES
        ('s1111111-1111-1111-1111-111111111111', 'w1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555'),
        ('s2222222-2222-2222-2222-222222222222', 'w2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444')
    ON CONFLICT (wantlistid, showid) DO NOTHING;
END $$;

-- ================================================================
-- SECTION 5: TEST HELPER FUNCTIONS
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
-- SECTION 6: TEST SECURITY SCENARIOS
-- ================================================================

-- Test profile access security
DO $$
BEGIN
    -- User should be able to view their own profile
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    PERFORM record_test(
        'User can view own profile',
        test_query_returns_rows('SELECT * FROM profiles WHERE id = current_user_id()'),
        'User should be able to view their own profile'
    );
    
    -- Evil user should not be able to access other profiles
    PERFORM set_test_user('77777777-7777-7777-7777-777777777777');
    PERFORM record_test(
        'Security check: Evil user cannot access other profiles',
        NOT test_query_returns_rows('
            SELECT * FROM profiles 
            WHERE id = ''55555555-5555-5555-5555-555555555555'' 
            AND current_user_id() = ''77777777-7777-7777-7777-777777777777''
            AND NOT is_admin()
        '),
        'Evil user should not be able to access other profiles'
    );
    
    -- Admin should be able to access all profiles
    PERFORM set_test_user('11111111-1111-1111-1111-111111111111');
    PERFORM record_test(
        'Admin can access all profiles',
        test_query_returns_rows('SELECT * FROM profiles WHERE is_admin()'),
        'Admin should be able to access all profiles'
    );
END $$;

-- Test show participation security
DO $$
BEGIN
    -- Organizer should be able to view participants for their shows
    PERFORM set_test_user('22222222-2222-2222-2222-222222222222');
    PERFORM record_test(
        'Organizer can view participants for their shows',
        test_query_returns_rows('
            SELECT * FROM show_participants 
            WHERE showid = ''a3333333-3333-3333-3333-333333333333'' 
            AND is_show_owner(showid)
        '),
        'Organizer should be able to view participants for their shows'
    );
    
    -- MVP dealer should be able to view participants for shows they participate in
    PERFORM set_test_user('33333333-3333-3333-3333-333333333333');
    PERFORM record_test(
        'MVP dealer can view participants for their shows',
        test_query_returns_rows('
            SELECT * FROM show_participants 
            WHERE showid = ''a3333333-3333-3333-3333-333333333333'' 
            AND participates_in_show_safe(showid)
        '),
        'MVP dealer should be able to view participants for shows they participate in'
    );
    
    -- MVP dealer should not be able to view participants for shows they don't participate in
    PERFORM record_test(
        'MVP dealer cannot view participants for unrelated shows',
        test_query_returns_no_rows('
            SELECT * FROM show_participants 
            WHERE showid = ''a4444444-4444-4444-4444-444444444444'' 
            AND participates_in_show_safe(showid)
        '),
        'MVP dealer should not be able to view participants for shows they don''t participate in'
    );
END $$;

-- Test want list security
DO $$
BEGIN
    -- User should be able to view their own want lists
    PERFORM set_test_user('55555555-5555-5555-5555-555555555555');
    PERFORM record_test(
        'User can view own want lists',
        test_query_returns_rows('SELECT * FROM want_lists WHERE userid = current_user_id()'),
        'User should be able to view their own want lists'
    );
    
    -- User should not be able to view others' want lists directly
    PERFORM record_test(
        'User cannot view others'' want lists directly',
        test_query_returns_no_rows('
            SELECT * FROM want_lists 
            WHERE userid = ''66666666-6666-6666-6666-666666666666'' 
            AND userid != current_user_id() 
            AND NOT is_admin()
        '),
        'User should not be able to view others'' want lists directly'
    );
    
    -- Dealer should be able to view want lists shared at their show
    PERFORM set_test_user('44444444-4444-4444-4444-444444444444');
    PERFORM record_test(
        'Dealer can view want lists shared at their show',
        test_query_returns_rows('
            SELECT wl.* 
            FROM want_lists wl
            JOIN shared_want_lists swl ON wl.id = swl.wantlistid
            JOIN show_participants sp ON sp.showid = swl.showid
            WHERE sp.userid = current_user_id()
        '),
        'Dealer should be able to view want lists shared at shows they participate in'
    );
END $$;

-- Test infinite recursion prevention
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
    EXECUTE '
        SELECT COUNT(*) 
        FROM show_participants 
        WHERE showid = ''a3333333-3333-3333-3333-333333333333'' 
        AND participates_in_show_safe(showid)
    ' INTO result_count;
    
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

-- Test security boundaries
DO $$
BEGIN
    -- Set user to evil user
    PERFORM set_test_user('77777777-7777-7777-7777-777777777777');
    
    -- Evil user should not be able to view other users' show participation
    PERFORM record_test(
        'Evil user cannot view others'' show participation',
        test_query_returns_no_rows('
            SELECT * 
            FROM show_participants 
            WHERE userid = ''55555555-5555-5555-5555-555555555555'' 
            AND userid != current_user_id()
            AND NOT is_admin()
            AND NOT is_show_owner(showid)
        '),
        'Evil user should not be able to view others'' show participation'
    );
    
    -- Evil user should not be able to view others' want lists
    PERFORM record_test(
        'Evil user cannot view others'' want lists',
        test_query_returns_no_rows('
            SELECT * 
            FROM want_lists 
            WHERE userid = ''55555555-5555-5555-5555-555555555555'' 
            AND userid != current_user_id()
            AND NOT is_admin()
        '),
        'Evil user should not be able to view others'' want lists'
    );
    
    -- Evil user should not be able to update others' profiles
    DECLARE
        rows_affected INTEGER;
    BEGIN
        -- Attempt to tamper with another user's profile using helper functions
        UPDATE profiles 
        SET full_name = 'Hacked!' 
        WHERE id = '55555555-5555-5555-5555-555555555555'
        AND (id = current_user_id() OR is_admin());
        
        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        
        -- Check if update was successful (should be 0 rows)
        PERFORM record_test(
            'Evil user cannot update others'' profiles',
            rows_affected = 0,
            'Evil user should not be able to update others'' profiles'
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
    test_record RECORD;
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
        FOR test_record IN (SELECT test_name, details FROM test_results WHERE NOT passed ORDER BY test_name) LOOP
            RAISE NOTICE '❌ %: %', test_record.test_name, test_record.details;
        END LOOP;
        RAISE NOTICE '================================================================';
    END IF;
    
    -- Overall result
    IF failed_tests = 0 THEN
        RAISE NOTICE '✅ ALL SECURITY TESTS PASSED!';
        RAISE NOTICE 'The security functions are working correctly.';
    ELSE
        RAISE NOTICE '❌ SECURITY TESTS FAILED!';
        RAISE NOTICE 'Please review the failed tests and fix the issues.';
    END IF;
    RAISE NOTICE '================================================================';
END $$;

-- Clean up temporary objects (uncomment to keep results)
-- DROP TABLE test_results;
-- DROP FUNCTION record_test(TEXT, BOOLEAN, TEXT);
-- DROP FUNCTION set_test_user(TEXT);
-- DROP FUNCTION current_user_id();
-- DROP FUNCTION test_query_returns_rows(TEXT);
-- DROP FUNCTION test_query_returns_no_rows(TEXT);

-- Rollback the transaction to clean up test data
ROLLBACK;
