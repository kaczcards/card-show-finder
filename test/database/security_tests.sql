-- ================================================================
-- SECURITY TEST SUITE FOR CARD SHOW FINDER DATABASE
-- ================================================================
-- This file contains comprehensive pgTAP tests for database security validation.
-- It tests RLS policies, helper functions, access control boundaries, and more.
--
-- Usage: psql -d your_database -f test/database/security_tests.sql
--
-- Requirements:
--   - pgTAP extension must be installed: CREATE EXTENSION pgtap;
--   - Database must have RLS policies from consolidated-rls-policies.sql applied
--
-- CI/CD Usage:
--   - Run with pg_prove: pg_prove -d your_database test/database/security_tests.sql
-- ================================================================

-- Load the pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Begin transaction to ensure tests don't affect production data
BEGIN;

-- ================================================================
-- SECTION 1: TEST PLAN AND SETUP
-- ================================================================

-- Plan the tests
SELECT plan(200);  -- Adjust number based on actual test count

-- Create test users with different roles
CREATE OR REPLACE FUNCTION setup_test_users() RETURNS VOID AS $$
DECLARE
    test_attendee_id UUID := '11111111-1111-1111-1111-111111111111';
    test_dealer_id UUID := '22222222-2222-2222-2222-222222222222';
    test_mvp_dealer_id UUID := '33333333-3333-3333-3333-333333333333';
    test_organizer_id UUID := '44444444-4444-4444-4444-444444444444';
    test_admin_id UUID := '55555555-5555-5555-5555-555555555555';
BEGIN
    -- Create test users in auth.users (mock)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = test_attendee_id) THEN
        INSERT INTO auth.users (id, email) 
        VALUES 
            (test_attendee_id, 'test_attendee@example.com'),
            (test_dealer_id, 'test_dealer@example.com'),
            (test_mvp_dealer_id, 'test_mvp_dealer@example.com'),
            (test_organizer_id, 'test_organizer@example.com'),
            (test_admin_id, 'test_admin@example.com');
    END IF;
    
    -- Create profiles with different roles
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES
        (test_attendee_id, 'test_attendee', 'Test Attendee', 'attendee'),
        (test_dealer_id, 'test_dealer', 'Test Dealer', 'dealer'),
        (test_mvp_dealer_id, 'test_mvp_dealer', 'Test MVP Dealer', 'mvp_dealer'),
        (test_organizer_id, 'test_organizer', 'Test Organizer', 'show_organizer'),
        (test_admin_id, 'test_admin', 'Test Admin', 'show_organizer')
    ON CONFLICT (id) DO UPDATE 
    SET username = EXCLUDED.username, 
        full_name = EXCLUDED.full_name, 
        role = EXCLUDED.role;
    
    -- Add admin role to admin user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (test_admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create test data
CREATE OR REPLACE FUNCTION setup_test_data() RETURNS VOID AS $$
DECLARE
    test_attendee_id UUID := '11111111-1111-1111-1111-111111111111';
    test_dealer_id UUID := '22222222-2222-2222-2222-222222222222';
    test_mvp_dealer_id UUID := '33333333-3333-3333-3333-333333333333';
    test_organizer_id UUID := '44444444-4444-4444-4444-444444444444';
    test_admin_id UUID := '55555555-5555-5555-5555-555555555555';
    
    test_show_id1 UUID := '66666666-6666-6666-6666-666666666666';
    test_show_id2 UUID := '77777777-7777-7777-7777-777777777777';
    test_show_id3 UUID := '88888888-8888-8888-8888-888888888888';
    
    test_wantlist_id1 UUID := '99999999-9999-9999-9999-999999999999';
    test_wantlist_id2 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    test_conversation_id1 UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    test_conversation_id2 UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    
    test_series_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
BEGIN
    -- Create test shows
    INSERT INTO public.shows (id, title, location, start_date, end_date, organizer_id)
    VALUES
        (test_show_id1, 'Test Show 1', 'Test Location 1', CURRENT_DATE, CURRENT_DATE + 1, test_organizer_id),
        (test_show_id2, 'Test Show 2', 'Test Location 2', CURRENT_DATE + 7, CURRENT_DATE + 8, test_organizer_id),
        (test_show_id3, 'Test Show 3', 'Test Location 3', CURRENT_DATE + 14, CURRENT_DATE + 15, test_admin_id)
    ON CONFLICT (id) DO UPDATE 
    SET title = EXCLUDED.title, 
        location = EXCLUDED.location;
    
    -- Create test show series
    INSERT INTO public.show_series (id, title, organizer_id)
    VALUES (test_series_id, 'Test Series', test_organizer_id)
    ON CONFLICT (id) DO UPDATE 
    SET title = EXCLUDED.title;
    
    -- Link show to series
    UPDATE public.shows SET series_id = test_series_id WHERE id = test_show_id1;
    
    -- Create test show participants
    INSERT INTO public.show_participants (userid, showid, role)
    VALUES
        (test_attendee_id, test_show_id1, 'attendee'),
        (test_dealer_id, test_show_id1, 'dealer'),
        (test_mvp_dealer_id, test_show_id1, 'mvp_dealer'),
        (test_attendee_id, test_show_id2, 'attendee'),
        (test_mvp_dealer_id, test_show_id2, 'mvp_dealer'),
        (test_dealer_id, test_show_id3, 'dealer')
    ON CONFLICT (userid, showid) DO UPDATE 
    SET role = EXCLUDED.role;
    
    -- Create test planned attendance
    INSERT INTO public.planned_attendance (user_id, show_id)
    VALUES
        (test_attendee_id, test_show_id1),
        (test_attendee_id, test_show_id2),
        (test_dealer_id, test_show_id1),
        (test_mvp_dealer_id, test_show_id1)
    ON CONFLICT (user_id, show_id) DO NOTHING;
    
    -- Create test want lists
    INSERT INTO public.want_lists (id, userid, title, items)
    VALUES
        (test_wantlist_id1, test_attendee_id, 'Test Want List 1', '{"Card 1", "Card 2"}'),
        (test_wantlist_id2, test_dealer_id, 'Test Want List 2', '{"Card 3", "Card 4"}')
    ON CONFLICT (id) DO UPDATE 
    SET title = EXCLUDED.title, 
        items = EXCLUDED.items;
    
    -- Share want list with show
    INSERT INTO public.shared_want_lists (userid, showid, wantlistid)
    VALUES
        (test_attendee_id, test_show_id1, test_wantlist_id1),
        (test_dealer_id, test_show_id1, test_wantlist_id2)
    ON CONFLICT (userid, showid) DO NOTHING;
    
    -- Create test user favorite shows
    INSERT INTO public.user_favorite_shows (user_id, show_id)
    VALUES
        (test_attendee_id, test_show_id1),
        (test_dealer_id, test_show_id1),
        (test_mvp_dealer_id, test_show_id2),
        (test_organizer_id, test_show_id3)
    ON CONFLICT (user_id, show_id) DO NOTHING;
    
    -- Create test conversations
    INSERT INTO public.conversations (id, title, created_at)
    VALUES
        (test_conversation_id1, 'Test Conversation 1', NOW()),
        (test_conversation_id2, 'Test Conversation 2', NOW())
    ON CONFLICT (id) DO UPDATE 
    SET title = EXCLUDED.title;
    
    -- Create test conversation participants
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES
        (test_conversation_id1, test_attendee_id),
        (test_conversation_id1, test_dealer_id),
        (test_conversation_id2, test_mvp_dealer_id),
        (test_conversation_id2, test_organizer_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
    
    -- Create test messages
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES
        (test_conversation_id1, test_attendee_id, 'Test message from attendee'),
        (test_conversation_id1, test_dealer_id, 'Test message from dealer'),
        (test_conversation_id2, test_mvp_dealer_id, 'Test message from MVP dealer'),
        (test_conversation_id2, test_organizer_id, 'Test message from organizer')
    ON CONFLICT DO NOTHING;
    
    -- Create test reviews
    INSERT INTO public.reviews (show_id, user_id, rating, comment)
    VALUES
        (test_show_id1, test_attendee_id, 5, 'Great show!'),
        (test_show_id1, test_dealer_id, 4, 'Good show!'),
        (test_show_id2, test_attendee_id, 3, 'Average show.')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up test data
CREATE OR REPLACE FUNCTION teardown_test_data() RETURNS VOID AS $$
DECLARE
    test_attendee_id UUID := '11111111-1111-1111-1111-111111111111';
    test_dealer_id UUID := '22222222-2222-2222-2222-222222222222';
    test_mvp_dealer_id UUID := '33333333-3333-3333-3333-333333333333';
    test_organizer_id UUID := '44444444-4444-4444-4444-444444444444';
    test_admin_id UUID := '55555555-5555-5555-5555-555555555555';
    
    test_show_id1 UUID := '66666666-6666-6666-6666-666666666666';
    test_show_id2 UUID := '77777777-7777-7777-7777-777777777777';
    test_show_id3 UUID := '88888888-8888-8888-8888-888888888888';
    
    test_wantlist_id1 UUID := '99999999-9999-9999-9999-999999999999';
    test_wantlist_id2 UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    test_conversation_id1 UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    test_conversation_id2 UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    
    test_series_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
BEGIN
    -- Delete test data in reverse order of dependencies
    DELETE FROM public.reviews 
    WHERE user_id IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.messages 
    WHERE sender_id IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.conversation_participants 
    WHERE user_id IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.conversations 
    WHERE id IN (test_conversation_id1, test_conversation_id2);
    
    DELETE FROM public.user_favorite_shows 
    WHERE user_id IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.shared_want_lists 
    WHERE userid IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.want_lists 
    WHERE userid IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.planned_attendance 
    WHERE user_id IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.show_participants 
    WHERE userid IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    DELETE FROM public.shows 
    WHERE id IN (test_show_id1, test_show_id2, test_show_id3);
    
    DELETE FROM public.show_series 
    WHERE id = test_series_id;
    
    DELETE FROM public.user_roles 
    WHERE user_id = test_admin_id;
    
    DELETE FROM public.profiles 
    WHERE id IN (test_attendee_id, test_dealer_id, test_mvp_dealer_id, test_organizer_id, test_admin_id);
    
    -- In a real test environment, we would also delete from auth.users
    -- but we'll skip that here as it's usually handled differently in tests
END;
$$ LANGUAGE plpgsql;

-- Helper function to set the current user for testing
CREATE OR REPLACE FUNCTION set_test_user(user_id UUID) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('role', 'authenticated', false);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id)::text, false);
END;
$$ LANGUAGE plpgsql;

-- Helper function to reset the current user
CREATE OR REPLACE FUNCTION reset_test_user() RETURNS VOID AS $$
BEGIN
    PERFORM set_config('role', 'postgres', false);
    PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

-- Setup test data
SELECT setup_test_users();
SELECT setup_test_data();

-- ================================================================
-- SECTION 2: TEST HELPER FUNCTIONS
-- ================================================================

-- Test is_admin() function
SELECT function_returns('is_admin', 'boolean', 'is_admin() function should return boolean');

-- Test is_admin() with admin user
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT ok(is_admin(), 'is_admin() should return true for admin user');

-- Test is_admin() with non-admin user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(NOT is_admin(), 'is_admin() should return false for non-admin user');

-- Test is_show_organizer() function
SELECT function_returns('is_show_organizer', 'boolean', 'is_show_organizer() function should return boolean');

-- Test is_show_organizer() with organizer user
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT ok(is_show_organizer(), 'is_show_organizer() should return true for organizer user');

-- Test is_show_organizer() with non-organizer user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(NOT is_show_organizer(), 'is_show_organizer() should return false for non-organizer user');

-- Test is_mvp_dealer() function
SELECT function_returns('is_mvp_dealer', 'boolean', 'is_mvp_dealer() function should return boolean');

-- Test is_mvp_dealer() with MVP dealer user
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT ok(is_mvp_dealer(), 'is_mvp_dealer() should return true for MVP dealer user');

-- Test is_mvp_dealer() with non-MVP dealer user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(NOT is_mvp_dealer(), 'is_mvp_dealer() should return false for non-MVP dealer user');

-- Test is_dealer() function
SELECT function_returns('is_dealer', 'boolean', 'is_dealer() function should return boolean');

-- Test is_dealer() with dealer user
SELECT set_test_user('22222222-2222-2222-2222-222222222222');
SELECT ok(is_dealer(), 'is_dealer() should return true for dealer user');

-- Test is_dealer() with non-dealer user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(NOT is_dealer(), 'is_dealer() should return false for non-dealer user');

-- Test participates_in_show() function
SELECT function_returns('participates_in_show', ARRAY['uuid'], 'boolean', 
    'participates_in_show() function should return boolean');

-- Test participates_in_show() with participating user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(participates_in_show('66666666-6666-6666-6666-666666666666'), 
    'participates_in_show() should return true for user participating in show');

-- Test participates_in_show() with non-participating user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(NOT participates_in_show('88888888-8888-8888-8888-888888888888'), 
    'participates_in_show() should return false for user not participating in show');

-- Test organizes_show() function
SELECT function_returns('organizes_show', ARRAY['uuid'], 'boolean', 
    'organizes_show() function should return boolean');

-- Test organizes_show() with organizing user
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT ok(organizes_show('66666666-6666-6666-6666-666666666666'), 
    'organizes_show() should return true for user organizing show');

-- Test organizes_show() with non-organizing user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT ok(NOT organizes_show('66666666-6666-6666-6666-666666666666'), 
    'organizes_show() should return false for user not organizing show');

-- ================================================================
-- SECTION 3: TEST PROFILES TABLE RLS POLICIES
-- ================================================================

-- Test profiles table RLS policies
SELECT has_table('public', 'profiles', 'Should have profiles table');
SELECT has_column('public', 'profiles', 'id', 'Profiles table should have id column');
SELECT has_column('public', 'profiles', 'role', 'Profiles table should have role column');

-- Test users can view their own profile
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM profiles WHERE id = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[1::bigint],
    'User should be able to view their own profile'
);

-- Test users can see limited profile info of others
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM profiles WHERE id = ''22222222-2222-2222-2222-222222222222''',
    ARRAY[1::bigint],
    'User should be able to view other users profiles'
);

-- Test users can update their own profile
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'UPDATE profiles SET bio = ''Updated bio'' WHERE id = ''11111111-1111-1111-1111-111111111111''',
    'User should be able to update their own profile'
);

-- Test users cannot update other users' profiles
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE profiles SET bio = ''Unauthorized update'' WHERE id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to update other users profiles'
);

-- Test admin can view and update all profiles
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT results_eq(
    'SELECT COUNT(*) FROM profiles',
    ARRAY[5::bigint],
    'Admin should be able to view all profiles'
);

SELECT lives_ok(
    'UPDATE profiles SET bio = ''Admin update'' WHERE id = ''22222222-2222-2222-2222-222222222222''',
    'Admin should be able to update any profile'
);

-- ================================================================
-- SECTION 4: TEST SHOWS TABLE RLS POLICIES
-- ================================================================

-- Test shows table RLS policies
SELECT has_table('public', 'shows', 'Should have shows table');
SELECT has_column('public', 'shows', 'id', 'Shows table should have id column');
SELECT has_column('public', 'shows', 'organizer_id', 'Shows table should have organizer_id column');

-- Test anyone can view shows (public)
SELECT reset_test_user();
SELECT results_eq(
    'SELECT COUNT(*) FROM shows',
    ARRAY[3::bigint],
    'Public users should be able to view shows'
);

-- Test organizers can update their own shows
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'UPDATE shows SET description = ''Updated description'' WHERE id = ''66666666-6666-6666-6666-666666666666''',
    'Organizer should be able to update their own show'
);

-- Test organizers cannot update other organizers' shows
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT throws_ok(
    'UPDATE shows SET description = ''Unauthorized update'' WHERE id = ''88888888-8888-8888-8888-888888888888''',
    '42501',
    'new row violates row-level security policy',
    'Organizer should not be able to update other organizers shows'
);

-- Test organizers can delete their own shows
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'DELETE FROM shows WHERE id = ''77777777-7777-7777-7777-777777777777''',
    'Organizer should be able to delete their own show'
);

-- Test organizers can insert new shows
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'INSERT INTO shows (id, title, location, start_date, end_date, organizer_id) 
     VALUES (''77777777-7777-7777-7777-777777777777'', ''New Test Show'', ''New Location'', CURRENT_DATE + 30, CURRENT_DATE + 31, ''44444444-4444-4444-4444-444444444444'')',
    'Organizer should be able to insert new shows'
);

-- Test admin can update any show
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT lives_ok(
    'UPDATE shows SET description = ''Admin update'' WHERE id = ''66666666-6666-6666-6666-666666666666''',
    'Admin should be able to update any show'
);

-- ================================================================
-- SECTION 5: TEST USER_FAVORITE_SHOWS TABLE RLS POLICIES
-- ================================================================

-- Test user_favorite_shows table RLS policies
SELECT has_table('public', 'user_favorite_shows', 'Should have user_favorite_shows table');
SELECT has_column('public', 'user_favorite_shows', 'user_id', 'user_favorite_shows table should have user_id column');
SELECT has_column('public', 'user_favorite_shows', 'show_id', 'user_favorite_shows table should have show_id column');

-- Test users can view their own favorite shows
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM user_favorite_shows WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[1::bigint],
    'User should be able to view their own favorite shows'
);

-- Test users cannot view other users' favorite shows directly
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM user_favorite_shows WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    ARRAY[0::bigint],
    'User should not be able to view other users favorite shows directly'
);

-- Test MVP dealers can view favorite shows for shows they participate in
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT results_eq(
    'SELECT COUNT(*) FROM user_favorite_shows WHERE show_id = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'MVP dealer should be able to view favorite shows for shows they participate in'
);

-- Test show organizers can view favorite shows for shows they organize
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT results_eq(
    'SELECT COUNT(*) FROM user_favorite_shows WHERE show_id = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'Show organizer should be able to view favorite shows for shows they organize'
);

-- Test users can insert their own favorite shows
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO user_favorite_shows (user_id, show_id) VALUES (''11111111-1111-1111-1111-111111111111'', ''77777777-7777-7777-7777-777777777777'')',
    'User should be able to insert their own favorite shows'
);

-- Test users cannot insert favorite shows for other users
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO user_favorite_shows (user_id, show_id) VALUES (''22222222-2222-2222-2222-222222222222'', ''66666666-6666-6666-6666-666666666666'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to insert favorite shows for other users'
);

-- Test users can delete their own favorite shows
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM user_favorite_shows WHERE user_id = ''11111111-1111-1111-1111-111111111111'' AND show_id = ''77777777-7777-7777-7777-777777777777''',
    'User should be able to delete their own favorite shows'
);

-- Test users cannot delete other users' favorite shows
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'DELETE FROM user_favorite_shows WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to delete other users favorite shows'
);

-- ================================================================
-- SECTION 6: TEST SHOW_PARTICIPANTS TABLE RLS POLICIES
-- ================================================================

-- Test show_participants table RLS policies
SELECT has_table('public', 'show_participants', 'Should have show_participants table');
SELECT has_column('public', 'show_participants', 'userid', 'show_participants table should have userid column');
SELECT has_column('public', 'show_participants', 'showid', 'show_participants table should have showid column');

-- Test users can see their own participation
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM show_participants WHERE userid = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[2::bigint],
    'User should be able to view their own participation'
);

-- Test organizers can see participants for shows they organize
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT results_eq(
    'SELECT COUNT(*) FROM show_participants WHERE showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[3::bigint],
    'Show organizer should be able to view participants for shows they organize'
);

-- Test MVP dealers can see participants for shows they're in
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT results_eq(
    'SELECT COUNT(*) FROM show_participants WHERE showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[3::bigint],
    'MVP dealer should be able to view participants for shows they participate in'
);

-- Test users can register themselves for shows
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO show_participants (userid, showid, role) VALUES (''11111111-1111-1111-1111-111111111111'', ''88888888-8888-8888-8888-888888888888'', ''attendee'')',
    'User should be able to register themselves for shows'
);

-- Test users cannot register other users for shows
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO show_participants (userid, showid, role) VALUES (''22222222-2222-2222-2222-222222222222'', ''88888888-8888-8888-8888-888888888888'', ''attendee'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to register other users for shows'
);

-- Test users can update their own participation details
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'UPDATE show_participants SET role = ''attendee'' WHERE userid = ''11111111-1111-1111-1111-111111111111'' AND showid = ''66666666-6666-6666-6666-666666666666''',
    'User should be able to update their own participation details'
);

-- Test users cannot update other users' participation details
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE show_participants SET role = ''attendee'' WHERE userid = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to update other users participation details'
);

-- Test show organizers can update any participant for their shows
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'UPDATE show_participants SET role = ''dealer'' WHERE userid = ''11111111-1111-1111-1111-111111111111'' AND showid = ''66666666-6666-6666-6666-666666666666''',
    'Show organizer should be able to update any participant for their shows'
);

-- Test users can delete their own participation
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM show_participants WHERE userid = ''11111111-1111-1111-1111-111111111111'' AND showid = ''88888888-8888-8888-8888-888888888888''',
    'User should be able to delete their own participation'
);

-- ================================================================
-- SECTION 7: TEST WANT_LISTS TABLE RLS POLICIES
-- ================================================================

-- Test want_lists table RLS policies
SELECT has_table('public', 'want_lists', 'Should have want_lists table');
SELECT has_column('public', 'want_lists', 'id', 'want_lists table should have id column');
SELECT has_column('public', 'want_lists', 'userid', 'want_lists table should have userid column');

-- Test users can see their own want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM want_lists WHERE userid = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[1::bigint],
    'User should be able to view their own want lists'
);

-- Test users cannot see other users' want lists directly
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM want_lists WHERE userid = ''22222222-2222-2222-2222-222222222222''',
    ARRAY[0::bigint],
    'User should not be able to view other users want lists directly'
);

-- Test MVP dealers can view want lists shared with shows they participate in
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT results_eq(
    'SELECT COUNT(*) FROM want_lists w JOIN shared_want_lists s ON w.id = s.wantlistid WHERE s.showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'MVP dealer should be able to view want lists shared with shows they participate in'
);

-- Test show organizers can view want lists shared with shows they organize
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT results_eq(
    'SELECT COUNT(*) FROM want_lists w JOIN shared_want_lists s ON w.id = s.wantlistid WHERE s.showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'Show organizer should be able to view want lists shared with shows they organize'
);

-- Test users can create their own want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO want_lists (id, userid, title, items) VALUES (''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''11111111-1111-1111-1111-111111111111'', ''New Want List'', ''{"New Card 1", "New Card 2"}'')',
    'User should be able to create their own want lists'
);

-- Test users cannot create want lists for other users
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO want_lists (id, userid, title, items) VALUES (''dddddddd-dddd-dddd-dddd-dddddddddddd'', ''22222222-2222-2222-2222-222222222222'', ''Unauthorized Want List'', ''{"Card"}'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to create want lists for other users'
);

-- Test users can update their own want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'UPDATE want_lists SET title = ''Updated Want List'' WHERE userid = ''11111111-1111-1111-1111-111111111111''',
    'User should be able to update their own want lists'
);

-- Test users cannot update other users' want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE want_lists SET title = ''Unauthorized Update'' WHERE userid = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to update other users want lists'
);

-- Test users can delete their own want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM want_lists WHERE id = ''cccccccc-cccc-cccc-cccc-cccccccccccc'' AND userid = ''11111111-1111-1111-1111-111111111111''',
    'User should be able to delete their own want lists'
);

-- ================================================================
-- SECTION 8: TEST SHARED_WANT_LISTS TABLE RLS POLICIES
-- ================================================================

-- Test shared_want_lists table RLS policies
SELECT has_table('public', 'shared_want_lists', 'Should have shared_want_lists table');
SELECT has_column('public', 'shared_want_lists', 'userid', 'shared_want_lists table should have userid column');
SELECT has_column('public', 'shared_want_lists', 'showid', 'shared_want_lists table should have showid column');
SELECT has_column('public', 'shared_want_lists', 'wantlistid', 'shared_want_lists table should have wantlistid column');

-- Test users can see their own shared want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM shared_want_lists WHERE userid = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[1::bigint],
    'User should be able to view their own shared want lists'
);

-- Test MVP dealers can see shared want lists for shows they participate in
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT results_eq(
    'SELECT COUNT(*) FROM shared_want_lists WHERE showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'MVP dealer should be able to view shared want lists for shows they participate in'
);

-- Test show organizers can see shared want lists for shows they organize
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT results_eq(
    'SELECT COUNT(*) FROM shared_want_lists WHERE showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'Show organizer should be able to view shared want lists for shows they organize'
);

-- Test users can share their own want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO want_lists (id, userid, title, items) VALUES (''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'', ''11111111-1111-1111-1111-111111111111'', ''New Want List 2'', ''{"Card"}'')',
    'Set up new want list for sharing test'
);

SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO shared_want_lists (userid, showid, wantlistid) VALUES (''11111111-1111-1111-1111-111111111111'', ''77777777-7777-7777-7777-777777777777'', ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'')',
    'User should be able to share their own want lists'
);

-- Test users cannot share want lists they don't own
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO shared_want_lists (userid, showid, wantlistid) VALUES (''11111111-1111-1111-1111-111111111111'', ''77777777-7777-7777-7777-777777777777'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to share want lists they don''t own'
);

-- Test users can delete their own shared want lists
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM shared_want_lists WHERE userid = ''11111111-1111-1111-1111-111111111111'' AND showid = ''77777777-7777-7777-7777-777777777777''',
    'User should be able to delete their own shared want lists'
);

-- ================================================================
-- SECTION 9: TEST CONVERSATIONS TABLE RLS POLICIES
-- ================================================================

-- Test conversations table RLS policies
SELECT has_table('public', 'conversations', 'Should have conversations table');
SELECT has_column('public', 'conversations', 'id', 'conversations table should have id column');

-- Test users can view conversations they participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM conversations WHERE id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
    ARRAY[1::bigint],
    'User should be able to view conversations they participate in'
);

-- Test users cannot view conversations they don't participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM conversations WHERE id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
    ARRAY[0::bigint],
    'User should not be able to view conversations they don''t participate in'
);

-- Test users can create conversations
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO conversations (id, title, created_at) VALUES (''ffffffff-ffff-ffff-ffff-ffffffffffff'', ''New Conversation'', NOW())',
    'User should be able to create conversations'
);

-- Test users can update conversations they participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (''ffffffff-ffff-ffff-ffff-ffffffffffff'', ''11111111-1111-1111-1111-111111111111'')',
    'Add user to conversation for update test'
);

SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'UPDATE conversations SET title = ''Updated Conversation'' WHERE id = ''ffffffff-ffff-ffff-ffff-ffffffffffff''',
    'User should be able to update conversations they participate in'
);

-- Test users cannot update conversations they don't participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE conversations SET title = ''Unauthorized Update'' WHERE id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to update conversations they don''t participate in'
);

-- Test admin can access all conversations
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT results_eq(
    'SELECT COUNT(*) FROM conversations',
    ARRAY[3::bigint],
    'Admin should be able to access all conversations'
);

-- ================================================================
-- SECTION 10: TEST CONVERSATION_PARTICIPANTS TABLE RLS POLICIES
-- ================================================================

-- Test conversation_participants table RLS policies
SELECT has_table('public', 'conversation_participants', 'Should have conversation_participants table');
SELECT has_column('public', 'conversation_participants', 'conversation_id', 'conversation_participants table should have conversation_id column');
SELECT has_column('public', 'conversation_participants', 'user_id', 'conversation_participants table should have user_id column');

-- Test users can view conversation participants for conversations they are in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
    ARRAY[2::bigint],
    'User should be able to view conversation participants for conversations they are in'
);

-- Test users cannot view conversation participants for conversations they are not in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
    ARRAY[0::bigint],
    'User should not be able to view conversation participants for conversations they are not in'
);

-- Test users can add themselves to conversations
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''11111111-1111-1111-1111-111111111111'')',
    'User should be able to add themselves to conversations'
);

-- Test users cannot add other users to conversations
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''44444444-4444-4444-4444-444444444444'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to add other users to conversations'
);

-- Test users can remove themselves from conversations
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM conversation_participants WHERE conversation_id = ''cccccccc-cccc-cccc-cccc-cccccccccccc'' AND user_id = ''11111111-1111-1111-1111-111111111111''',
    'User should be able to remove themselves from conversations'
);

-- Test users cannot remove other users from conversations
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'DELETE FROM conversation_participants WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to remove other users from conversations'
);

-- Test admin can access all conversation participants
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT results_eq(
    'SELECT COUNT(*) FROM conversation_participants',
    ARRAY[5::bigint],
    'Admin should be able to access all conversation participants'
);

-- ================================================================
-- SECTION 11: TEST MESSAGES TABLE RLS POLICIES
-- ================================================================

-- Test messages table RLS policies
SELECT has_table('public', 'messages', 'Should have messages table');
SELECT has_column('public', 'messages', 'conversation_id', 'messages table should have conversation_id column');
SELECT has_column('public', 'messages', 'sender_id', 'messages table should have sender_id column');

-- Test users can view messages in conversations they participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM messages WHERE conversation_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
    ARRAY[2::bigint],
    'User should be able to view messages in conversations they participate in'
);

-- Test users cannot view messages in conversations they don't participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM messages WHERE conversation_id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
    ARRAY[0::bigint],
    'User should not be able to view messages in conversations they don''t participate in'
);

-- Test users can send messages to conversations they participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''11111111-1111-1111-1111-111111111111'', ''New test message'')',
    'User should be able to send messages to conversations they participate in'
);

-- Test users cannot send messages to conversations they don't participate in
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''11111111-1111-1111-1111-111111111111'', ''Unauthorized message'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to send messages to conversations they don''t participate in'
);

-- Test users cannot send messages as other users
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''22222222-2222-2222-2222-222222222222'', ''Impersonated message'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to send messages as other users'
);

-- Test users can update their own messages
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'UPDATE messages SET content = ''Updated message'' WHERE sender_id = ''11111111-1111-1111-1111-111111111111'' AND conversation_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''',
    'User should be able to update their own messages'
);

-- Test users cannot update other users' messages
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE messages SET content = ''Unauthorized update'' WHERE sender_id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to update other users'' messages'
);

-- Test users can delete their own messages
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM messages WHERE sender_id = ''11111111-1111-1111-1111-111111111111'' AND content = ''New test message''',
    'User should be able to delete their own messages'
);

-- ================================================================
-- SECTION 12: TEST REVIEWS TABLE RLS POLICIES
-- ================================================================

-- Test reviews table RLS policies
SELECT has_table('public', 'reviews', 'Should have reviews table');
SELECT has_column('public', 'reviews', 'show_id', 'reviews table should have show_id column');
SELECT has_column('public', 'reviews', 'user_id', 'reviews table should have user_id column');

-- Test anyone can view reviews
SELECT reset_test_user();
SELECT results_eq(
    'SELECT COUNT(*) FROM reviews',
    ARRAY[3::bigint],
    'Anyone should be able to view reviews'
);

-- Test users can create reviews for shows they attended
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO reviews (show_id, user_id, rating, comment) VALUES (''77777777-7777-7777-7777-777777777777'', ''11111111-1111-1111-1111-111111111111'', 4, ''Good show!'')',
    'User should be able to create reviews for shows they attended'
);

-- Test users cannot create reviews for shows they didn't attend
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO reviews (show_id, user_id, rating, comment) VALUES (''88888888-8888-8888-8888-888888888888'', ''11111111-1111-1111-1111-111111111111'', 1, ''Bad show!'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to create reviews for shows they didn''t attend'
);

-- Test users can update their own reviews
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'UPDATE reviews SET comment = ''Updated comment'' WHERE user_id = ''11111111-1111-1111-1111-111111111111'' AND show_id = ''66666666-6666-6666-6666-666666666666''',
    'User should be able to update their own reviews'
);

-- Test users cannot update other users' reviews
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE reviews SET comment = ''Unauthorized update'' WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to update other users'' reviews'
);

-- Test users can delete their own reviews
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM reviews WHERE user_id = ''11111111-1111-1111-1111-111111111111'' AND show_id = ''77777777-7777-7777-7777-777777777777''',
    'User should be able to delete their own reviews'
);

-- Test admin can moderate all reviews
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT lives_ok(
    'UPDATE reviews SET comment = ''Moderated comment'' WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    'Admin should be able to moderate all reviews'
);

-- ================================================================
-- SECTION 13: TEST SHOW_SERIES TABLE RLS POLICIES
-- ================================================================

-- Test show_series table RLS policies
SELECT has_table('public', 'show_series', 'Should have show_series table');
SELECT has_column('public', 'show_series', 'id', 'show_series table should have id column');
SELECT has_column('public', 'show_series', 'organizer_id', 'show_series table should have organizer_id column');

-- Test anyone can view show series
SELECT reset_test_user();
SELECT results_eq(
    'SELECT COUNT(*) FROM show_series',
    ARRAY[1::bigint],
    'Anyone should be able to view show series'
);

-- Test organizers can update their own show series
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'UPDATE show_series SET description = ''Updated description'' WHERE id = ''dddddddd-dddd-dddd-dddd-dddddddddddd''',
    'Organizer should be able to update their own show series'
);

-- Test organizers cannot update other organizers' show series
SELECT set_test_user('55555555-5555-5555-5555-555555555555');
SELECT throws_ok(
    'UPDATE show_series SET description = ''Unauthorized update'' WHERE id = ''dddddddd-dddd-dddd-dddd-dddddddddddd''',
    '42501',
    'new row violates row-level security policy',
    'Organizer should not be able to update other organizers'' show series'
);

-- Test organizers can delete their own show series
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'INSERT INTO show_series (id, title, organizer_id) VALUES (''ffffffff-ffff-ffff-ffff-ffffffffffff'', ''Test Series 2'', ''44444444-4444-4444-4444-444444444444'')',
    'Create test series for deletion'
);

SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'DELETE FROM show_series WHERE id = ''ffffffff-ffff-ffff-ffff-ffffffffffff''',
    'Organizer should be able to delete their own show series'
);

-- Test organizers can create show series
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT lives_ok(
    'INSERT INTO show_series (id, title, organizer_id) VALUES (''ffffffff-ffff-ffff-ffff-ffffffffffff'', ''New Test Series'', ''44444444-4444-4444-4444-444444444444'')',
    'Organizer should be able to create show series'
);

-- Test non-organizers cannot create show series
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO show_series (id, title, organizer_id) VALUES (''gggggggg-gggg-gggg-gggg-gggggggggggg'', ''Unauthorized Series'', ''11111111-1111-1111-1111-111111111111'')',
    '42501',
    'new row violates row-level security policy',
    'Non-organizer should not be able to create show series'
);

-- ================================================================
-- SECTION 14: TEST PLANNED_ATTENDANCE TABLE RLS POLICIES
-- ================================================================

-- Test planned_attendance table RLS policies
SELECT has_table('public', 'planned_attendance', 'Should have planned_attendance table');
SELECT has_column('public', 'planned_attendance', 'user_id', 'planned_attendance table should have user_id column');
SELECT has_column('public', 'planned_attendance', 'show_id', 'planned_attendance table should have show_id column');

-- Test users can view their own planned attendance
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM planned_attendance WHERE user_id = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[2::bigint],
    'User should be able to view their own planned attendance'
);

-- Test users cannot view other users' planned attendance directly
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM planned_attendance WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    ARRAY[0::bigint],
    'User should not be able to view other users'' planned attendance directly'
);

-- Test MVP dealers can view planned attendance for shows they participate in
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT results_eq(
    'SELECT COUNT(*) FROM planned_attendance WHERE show_id = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[3::bigint],
    'MVP dealer should be able to view planned attendance for shows they participate in'
);

-- Test show organizers can view planned attendance for shows they organize
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT results_eq(
    'SELECT COUNT(*) FROM planned_attendance WHERE show_id = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[3::bigint],
    'Show organizer should be able to view planned attendance for shows they organize'
);

-- Test users can create their own planned attendance
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'INSERT INTO planned_attendance (user_id, show_id) VALUES (''11111111-1111-1111-1111-111111111111'', ''88888888-8888-8888-8888-888888888888'')',
    'User should be able to create their own planned attendance'
);

-- Test users cannot create planned attendance for other users
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO planned_attendance (user_id, show_id) VALUES (''22222222-2222-2222-2222-222222222222'', ''66666666-6666-6666-6666-666666666666'')',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to create planned attendance for other users'
);

-- Test users can delete their own planned attendance
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
    'DELETE FROM planned_attendance WHERE user_id = ''11111111-1111-1111-1111-111111111111'' AND show_id = ''88888888-8888-8888-8888-888888888888''',
    'User should be able to delete their own planned attendance'
);

-- Test users cannot delete other users' planned attendance
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'DELETE FROM planned_attendance WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User should not be able to delete other users'' planned attendance'
);

-- ================================================================
-- SECTION 15: TEST CROSS-TABLE SECURITY RELATIONSHIPS
-- ================================================================

-- Test data isolation between users
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM profiles WHERE id = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[1::bigint],
    'User can only see their own profile'
);

-- Test MVP dealer access to attendee data
SELECT set_test_user('33333333-3333-3333-3333-333333333333');
SELECT results_eq(
    'SELECT COUNT(*) FROM want_lists w JOIN shared_want_lists s ON w.id = s.wantlistid WHERE s.showid = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'MVP dealer can access attendee want lists for shows they participate in'
);

-- Test show organizer access to attendee data
SELECT set_test_user('44444444-4444-4444-4444-444444444444');
SELECT results_eq(
    'SELECT COUNT(*) FROM user_favorite_shows WHERE show_id = ''66666666-6666-6666-6666-666666666666''',
    ARRAY[2::bigint],
    'Show organizer can access attendee favorites for shows they organize'
);

-- Test data isolation for conversations
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT COUNT(*) FROM messages WHERE conversation_id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
    ARRAY[0::bigint],
    'User cannot access messages in conversations they do not participate in'
);

-- Test security boundaries for reviews
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE reviews SET comment = ''Unauthorized update'' WHERE user_id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User cannot modify reviews they did not create'
);

-- ================================================================
-- SECTION 16: TEST EDGE CASES AND UNAUTHORIZED ACCESS ATTEMPTS
-- ================================================================

-- Test unauthorized show update
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE shows SET description = ''Unauthorized update'' WHERE id = ''66666666-6666-6666-6666-666666666666''',
    '42501',
    'new row violates row-level security policy',
    'Regular user cannot update shows'
);

-- Test unauthorized show series update
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE show_series SET description = ''Unauthorized update'' WHERE id = ''dddddddd-dddd-dddd-dddd-dddddddddddd''',
    '42501',
    'new row violates row-level security policy',
    'Regular user cannot update show series'
);

-- Test unauthorized want list access
SELECT set_test_user('22222222-2222-2222-2222-222222222222');
SELECT results_eq(
    'SELECT COUNT(*) FROM want_lists WHERE userid = ''11111111-1111-1111-1111-111111111111''',
    ARRAY[0::bigint],
    'User cannot directly access other users'' want lists'
);

-- Test unauthorized message sending as another user
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''22222222-2222-2222-2222-222222222222'', ''Impersonated message'')',
    '42501',
    'new row violates row-level security policy',
    'User cannot send messages as another user'
);

-- Test unauthorized profile update
SELECT set_test_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
    'UPDATE profiles SET bio = ''Unauthorized update'' WHERE id = ''22222222-2222-2222-2222-222222222222''',
    '42501',
    'new row violates row-level security policy',
    'User cannot update other users'' profiles'
);

-- ================================================================
-- SECTION 17: CLEAN UP
-- ================================================================

-- Clean up test data
SELECT teardown_test_data();

-- Drop test functions
DROP FUNCTION IF EXISTS setup_test_users();
DROP FUNCTION IF EXISTS setup_test_data();
DROP FUNCTION IF EXISTS teardown_test_data();
DROP FUNCTION IF EXISTS set_test_user(UUID);
DROP FUNCTION IF EXISTS reset_test_user();

-- Finish the tests
SELECT * FROM finish();

-- Rollback transaction to avoid affecting production data
ROLLBACK;
