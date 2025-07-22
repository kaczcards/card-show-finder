-- ================================================================
-- COMPREHENSIVE RLS SECURITY TEST SUITE
-- ================================================================
-- This test suite validates the consolidated RLS policies implemented
-- in CONSOLIDATED_RLS_2025.sql using pgTAP.
--
-- It provides comprehensive testing of:
-- 1. All helper functions
-- 2. Every RLS policy on every table
-- 3. Security boundaries between different user roles
-- 4. Cross-table relationship security
-- 5. CRUD operations permissions
-- 6. Data isolation between users
-- 7. Admin access controls
-- 8. Performance (no infinite recursion)
-- 9. Edge cases and attack vectors
-- 10. Complete coverage of the consolidated RLS implementation
--
-- Usage:
--   psql -f test/database/comprehensive_rls_security_tests.sql
--
-- Dependencies:
--   - pgtap extension
--   - CONSOLIDATED_RLS_2025.sql must be applied first
-- ================================================================

-- Load pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Begin transaction
BEGIN;

-- Plan the tests
SELECT plan(500); -- Adjust number based on actual test count

-- ================================================================
-- SECTION 1: TEST SETUP AND HELPER FUNCTIONS
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
    INSERT INTO auth.users (id, email) VALUES
        (admin_id, 'admin@test.com'),
        (organizer_id, 'organizer@test.com'),
        (mvp_dealer_id, 'mvpdealer@test.com'),
        (dealer_id, 'dealer@test.com'),
        (attendee_id, 'attendee@test.com'),
        (other_attendee_id, 'other.attendee@test.com'),
        (evil_user_id, 'evil.user@test.com')
    ON CONFLICT (id) DO NOTHING;

    -- Create profiles
    INSERT INTO public.profiles (id, username, full_name, role, avatar_url, website, about)
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

    -- Add admin to user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

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

    -- Create conversations
    INSERT INTO public.conversations (id, title, created_at)
    VALUES
        ('c1111111-1111-1111-1111-111111111111', 'Attendee-Dealer Conversation', NOW()),
        ('c2222222-2222-2222-2222-222222222222', 'Private Conversation', NOW())
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title;

    -- Create conversation participants
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES
        ('c1111111-1111-1111-1111-111111111111', attendee_id),
        ('c1111111-1111-1111-1111-111111111111', dealer_id),
        ('c2222222-2222-2222-2222-222222222222', attendee_id),
        ('c2222222-2222-2222-2222-222222222222', other_attendee_id)
    ON CONFLICT DO NOTHING;

    -- Create messages
    INSERT INTO public.messages (id, conversation_id, sender_id, content, created_at)
    VALUES
        (gen_random_uuid(), 'c1111111-1111-1111-1111-111111111111', attendee_id, 'Hello from attendee', NOW()),
        (gen_random_uuid(), 'c1111111-1111-1111-1111-111111111111', dealer_id, 'Hello from dealer', NOW()),
        (gen_random_uuid(), 'c2222222-2222-2222-2222-222222222222', attendee_id, 'Private message from attendee', NOW()),
        (gen_random_uuid(), 'c2222222-2222-2222-2222-222222222222', other_attendee_id, 'Private message from other attendee', NOW())
    ON CONFLICT DO NOTHING;

    -- Create reviews
    INSERT INTO public.reviews (id, show_id, user_id, rating, comment, created_at)
    VALUES
        (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', attendee_id, 5, 'Great show!', NOW()),
        (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', other_attendee_id, 4, 'Good show', NOW())
    ON CONFLICT DO NOTHING;

    -- Create show series
    INSERT INTO public.show_series (id, name, description, organizer_id)
    VALUES
        ('d1111111-1111-1111-1111-111111111111', 'Organizer Series', 'Test series by organizer', organizer_id),
        ('d2222222-2222-2222-2222-222222222222', 'Admin Series', 'Test series by admin', admin_id)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name;

    -- Create planned attendance
    INSERT INTO public.planned_attendance (id, user_id, show_id, status)
    VALUES
        (gen_random_uuid(), attendee_id, 'a3333333-3333-3333-3333-333333333333', 'confirmed'),
        (gen_random_uuid(), other_attendee_id, 'a4444444-4444-4444-4444-444444444444', 'confirmed')
    ON CONFLICT DO NOTHING;

    -- Create user favorite shows
    INSERT INTO public.user_favorite_shows (user_id, show_id)
    VALUES
        (attendee_id, 'a3333333-3333-3333-3333-333333333333'),
        (other_attendee_id, 'a4444444-4444-4444-4444-444444444444')
    ON CONFLICT DO NOTHING;

END $$;

-- Function to set the current user for testing
CREATE OR REPLACE FUNCTION set_test_user(user_id UUID) RETURNS VOID AS $$
BEGIN
    -- Set auth.uid() to return this user_id
    PERFORM set_config('request.jwt.claim.sub', user_id::TEXT, FALSE);
    -- Set auth.role() to return 'authenticated'
    PERFORM set_config('request.jwt.claim.role', 'authenticated', FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to clear the current user
CREATE OR REPLACE FUNCTION clear_test_user() RETURNS VOID AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', FALSE);
    PERFORM set_config('request.jwt.claim.role', '', FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to set anonymous role
CREATE OR REPLACE FUNCTION set_anonymous_user() RETURNS VOID AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

-- Function to check if a query returns no rows
CREATE OR REPLACE FUNCTION test_query_returns_no_rows(query TEXT) RETURNS BOOLEAN AS $$
DECLARE
    result INTEGER;
BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || query || ') AS q' INTO result;
    RETURN result = 0;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- SECTION 2: HELPER FUNCTION TESTS
-- ================================================================

-- Test is_admin() function
SELECT subtest(
    'Testing is_admin() function',
    ARRAY[
        -- Admin user should return true
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            is_admin(),
            'is_admin() should return true for admin user'
        ),
        
        -- Non-admin user should return false
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            NOT is_admin(),
            'is_admin() should return false for non-admin user'
        ),
        
        -- Anonymous user should return false
        test_function(
            'clear_test_user',
            ARRAY[]::TEXT[],
            'Clearing test user'
        ),
        test_function(
            'set_anonymous_user',
            ARRAY[]::TEXT[],
            'Setting anonymous user'
        ),
        ok(
            NOT is_admin(),
            'is_admin() should return false for anonymous user'
        )
    ]
);

-- Test is_show_organizer() function
SELECT subtest(
    'Testing is_show_organizer() function',
    ARRAY[
        -- Organizer user should return true
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            is_show_organizer(),
            'is_show_organizer() should return true for organizer user'
        ),
        
        -- Non-organizer user should return false
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            NOT is_show_organizer(),
            'is_show_organizer() should return false for non-organizer user'
        )
    ]
);

-- Test is_mvp_dealer() function
SELECT subtest(
    'Testing is_mvp_dealer() function',
    ARRAY[
        -- MVP dealer user should return true
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            is_mvp_dealer(),
            'is_mvp_dealer() should return true for MVP dealer user'
        ),
        
        -- Non-MVP dealer user should return false
        test_function(
            'set_test_user',
            ARRAY['44444444-4444-4444-4444-444444444444'::UUID],
            'Setting test user to regular dealer'
        ),
        ok(
            NOT is_mvp_dealer(),
            'is_mvp_dealer() should return false for regular dealer user'
        )
    ]
);

-- Test is_dealer() function
SELECT subtest(
    'Testing is_dealer() function',
    ARRAY[
        -- Regular dealer user should return true
        test_function(
            'set_test_user',
            ARRAY['44444444-4444-4444-4444-444444444444'::UUID],
            'Setting test user to regular dealer'
        ),
        ok(
            is_dealer(),
            'is_dealer() should return true for regular dealer user'
        ),
        
        -- Non-dealer user should return false
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            NOT is_dealer(),
            'is_dealer() should return false for attendee user'
        )
    ]
);

-- Test is_any_dealer() function
SELECT subtest(
    'Testing is_any_dealer() function',
    ARRAY[
        -- Regular dealer user should return true
        test_function(
            'set_test_user',
            ARRAY['44444444-4444-4444-4444-444444444444'::UUID],
            'Setting test user to regular dealer'
        ),
        ok(
            is_any_dealer(),
            'is_any_dealer() should return true for regular dealer user'
        ),
        
        -- MVP dealer user should return true
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            is_any_dealer(),
            'is_any_dealer() should return true for MVP dealer user'
        ),
        
        -- Non-dealer user should return false
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            NOT is_any_dealer(),
            'is_any_dealer() should return false for attendee user'
        )
    ]
);

-- Test participates_in_show_safe() function
SELECT subtest(
    'Testing participates_in_show_safe() function',
    ARRAY[
        -- Organizer should participate in their show
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            participates_in_show_safe('a2222222-2222-2222-2222-222222222222'::UUID),
            'Organizer should participate in their own show'
        ),
        
        -- MVP dealer should participate in their show
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            participates_in_show_safe('a3333333-3333-3333-3333-333333333333'::UUID),
            'MVP dealer should participate in their assigned show'
        ),
        
        -- Attendee should not participate in unrelated show
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            NOT participates_in_show_safe('a3333333-3333-3333-3333-333333333333'::UUID),
            'Attendee should not participate in unrelated show'
        ),
        
        -- Attendee should participate in their show
        ok(
            participates_in_show_safe('a5555555-5555-5555-5555-555555555555'::UUID),
            'Attendee should participate in their assigned show'
        ),
        
        -- Evil user should not participate in any show
        test_function(
            'set_test_user',
            ARRAY['77777777-7777-7777-7777-777777777777'::UUID],
            'Setting test user to evil user'
        ),
        ok(
            NOT participates_in_show_safe('a5555555-5555-5555-5555-555555555555'::UUID),
            'Evil user should not participate in any show'
        )
    ]
);

-- Test organizes_show() function
SELECT subtest(
    'Testing organizes_show() function',
    ARRAY[
        -- Organizer should organize their show
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            organizes_show('a2222222-2222-2222-2222-222222222222'::UUID),
            'Organizer should organize their own show'
        ),
        
        -- Organizer should not organize other shows
        ok(
            NOT organizes_show('a3333333-3333-3333-3333-333333333333'::UUID),
            'Organizer should not organize other shows'
        ),
        
        -- Non-organizer should not organize any shows
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            NOT organizes_show('a2222222-2222-2222-2222-222222222222'::UUID),
            'Attendee should not organize any shows'
        )
    ]
);

-- Test participates_in_conversation() function
SELECT subtest(
    'Testing participates_in_conversation() function',
    ARRAY[
        -- Attendee should participate in their conversation
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            participates_in_conversation('c1111111-1111-1111-1111-111111111111'::UUID),
            'Attendee should participate in their conversation'
        ),
        
        -- Dealer should participate in conversation with attendee
        test_function(
            'set_test_user',
            ARRAY['44444444-4444-4444-4444-444444444444'::UUID],
            'Setting test user to dealer'
        ),
        ok(
            participates_in_conversation('c1111111-1111-1111-1111-111111111111'::UUID),
            'Dealer should participate in conversation with attendee'
        ),
        
        -- MVP dealer should not participate in unrelated conversation
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            NOT participates_in_conversation('c1111111-1111-1111-1111-111111111111'::UUID),
            'MVP dealer should not participate in unrelated conversation'
        ),
        
        -- Evil user should not participate in any conversation
        test_function(
            'set_test_user',
            ARRAY['77777777-7777-7777-7777-777777777777'::UUID],
            'Setting test user to evil user'
        ),
        ok(
            NOT participates_in_conversation('c1111111-1111-1111-1111-111111111111'::UUID),
            'Evil user should not participate in any conversation'
        )
    ]
);

-- ================================================================
-- SECTION 3: PROFILES TABLE POLICY TESTS
-- ================================================================

-- Test profiles_select_self policy
SELECT subtest(
    'Testing profiles_select_self policy',
    ARRAY[
        -- User should be able to view their own profile
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM profiles WHERE id = ''55555555-5555-5555-5555-555555555555'''),
            'User should be able to view their own profile'
        ),
        
        -- Anonymous user should not be able to view profiles
        test_function(
            'clear_test_user',
            ARRAY[]::TEXT[],
            'Clearing test user'
        ),
        test_function(
            'set_anonymous_user',
            ARRAY[]::TEXT[],
            'Setting anonymous user'
        ),
        ok(
            test_query_returns_no_rows('SELECT * FROM profiles WHERE id = ''55555555-5555-5555-5555-555555555555'''),
            'Anonymous user should not be able to view profiles'
        )
    ]
);

-- Test profiles_update_self policy
SELECT subtest(
    'Testing profiles_update_self policy',
    ARRAY[
        -- User should be able to update their own profile
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'UPDATE profiles SET about = ''Updated about text'' WHERE id = ''55555555-5555-5555-5555-555555555555''',
            'User should be able to update their own profile'
        ),
        
        -- User should not be able to update other profiles
        throws_ok(
            'UPDATE profiles SET about = ''Hacked about text'' WHERE id = ''44444444-4444-4444-4444-444444444444''',
            '42501',
            'permission denied for table profiles',
            'User should not be able to update other profiles'
        )
    ]
);

-- Test profiles_select_others policy
SELECT subtest(
    'Testing profiles_select_others policy',
    ARRAY[
        -- User should be able to view other profiles
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM profiles WHERE id = ''44444444-4444-4444-4444-444444444444'''),
            'User should be able to view other profiles'
        )
    ]
);

-- Test profiles_all_admin policy
SELECT subtest(
    'Testing profiles_all_admin policy',
    ARRAY[
        -- Admin should be able to update any profile
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        lives_ok(
            'UPDATE profiles SET about = ''Admin updated about text'' WHERE id = ''44444444-4444-4444-4444-444444444444''',
            'Admin should be able to update any profile'
        ),
        
        -- Admin should be able to delete profiles
        lives_ok(
            'DELETE FROM profiles WHERE id = ''77777777-7777-7777-7777-777777777777''',
            'Admin should be able to delete profiles'
        ),
        
        -- Restore the deleted profile for further tests
        lives_ok(
            'INSERT INTO profiles (id, username, full_name, role) VALUES (''77777777-7777-7777-7777-777777777777'', ''evil_user_restored'', ''Evil User Restored'', ''attendee'')',
            'Restoring deleted profile for further tests'
        )
    ]
);

-- ================================================================
-- SECTION 4: SHOWS TABLE POLICY TESTS
-- ================================================================

-- Test shows_select_all policy
SELECT subtest(
    'Testing shows_select_all policy',
    ARRAY[
        -- Authenticated user should be able to view shows
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM shows'),
            'Authenticated user should be able to view shows'
        ),
        
        -- Anonymous user should be able to view shows
        test_function(
            'clear_test_user',
            ARRAY[]::TEXT[],
            'Clearing test user'
        ),
        test_function(
            'set_anonymous_user',
            ARRAY[]::TEXT[],
            'Setting anonymous user'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM shows'),
            'Anonymous user should be able to view shows'
        )
    ]
);

-- Test shows_update_organizer policy
SELECT subtest(
    'Testing shows_update_organizer policy',
    ARRAY[
        -- Organizer should be able to update their own shows
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        lives_ok(
            'UPDATE shows SET description = ''Updated description'' WHERE id = ''a2222222-2222-2222-2222-222222222222''',
            'Organizer should be able to update their own shows'
        ),
        
        -- Organizer should not be able to update other shows
        throws_ok(
            'UPDATE shows SET description = ''Hacked description'' WHERE id = ''a1111111-1111-1111-1111-111111111111''',
            '42501',
            'permission denied for table shows',
            'Organizer should not be able to update other shows'
        ),
        
        -- Non-organizer should not be able to update any shows
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        throws_ok(
            'UPDATE shows SET description = ''Hacked description'' WHERE id = ''a2222222-2222-2222-2222-222222222222''',
            '42501',
            'permission denied for table shows',
            'Non-organizer should not be able to update any shows'
        )
    ]
);

-- Test shows_delete_organizer policy
SELECT subtest(
    'Testing shows_delete_organizer policy',
    ARRAY[
        -- Create a temporary show for deletion test
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        lives_ok(
            'INSERT INTO shows (id, name, description, location, start_date, end_date, organizer_id, status) VALUES (''a9999999-9999-9999-9999-999999999999'', ''Temp Show'', ''Temp description'', ''Temp Location'', NOW(), NOW() + INTERVAL ''2 days'', ''22222222-2222-2222-2222-222222222222'', ''active'')',
            'Creating temporary show for deletion test'
        ),
        
        -- Organizer should be able to delete their own shows
        lives_ok(
            'DELETE FROM shows WHERE id = ''a9999999-9999-9999-9999-999999999999''',
            'Organizer should be able to delete their own shows'
        ),
        
        -- Organizer should not be able to delete other shows
        throws_ok(
            'DELETE FROM shows WHERE id = ''a1111111-1111-1111-1111-111111111111''',
            '42501',
            'permission denied for table shows',
            'Organizer should not be able to delete other shows'
        ),
        
        -- Non-organizer should not be able to delete any shows
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        throws_ok(
            'DELETE FROM shows WHERE id = ''a2222222-2222-2222-2222-222222222222''',
            '42501',
            'permission denied for table shows',
            'Non-organizer should not be able to delete any shows'
        )
    ]
);

-- Test shows_insert_organizer policy
SELECT subtest(
    'Testing shows_insert_organizer policy',
    ARRAY[
        -- Organizer should be able to insert shows
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        lives_ok(
            'INSERT INTO shows (id, name, description, location, start_date, end_date, organizer_id, status) VALUES (''a8888888-8888-8888-8888-888888888888'', ''New Show'', ''New description'', ''New Location'', NOW(), NOW() + INTERVAL ''2 days'', ''22222222-2222-2222-2222-222222222222'', ''active'')',
            'Organizer should be able to insert shows'
        ),
        
        -- Organizer should not be able to insert shows for others
        throws_ok(
            'INSERT INTO shows (id, name, description, location, start_date, end_date, organizer_id, status) VALUES (''a7777777-7777-7777-7777-777777777777'', ''Fake Show'', ''Fake description'', ''Fake Location'', NOW(), NOW() + INTERVAL ''2 days'', ''11111111-1111-1111-1111-111111111111'', ''active'')',
            '42501',
            'permission denied for table shows',
            'Organizer should not be able to insert shows for others'
        ),
        
        -- Non-organizer should not be able to insert shows
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        throws_ok(
            'INSERT INTO shows (id, name, description, location, start_date, end_date, organizer_id, status) VALUES (''a6666666-6666-6666-6666-666666666666'', ''Fake Show'', ''Fake description'', ''Fake Location'', NOW(), NOW() + INTERVAL ''2 days'', ''55555555-5555-5555-5555-555555555555'', ''active'')',
            '42501',
            'permission denied for table shows',
            'Non-organizer should not be able to insert shows'
        )
    ]
);

-- Test shows_update_admin policy
SELECT subtest(
    'Testing shows_update_admin policy',
    ARRAY[
        -- Admin should be able to update any show
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        lives_ok(
            'UPDATE shows SET description = ''Admin updated description'' WHERE id = ''a2222222-2222-2222-2222-222222222222''',
            'Admin should be able to update any show'
        )
    ]
);

-- ================================================================
-- SECTION 5: SHOW_PARTICIPANTS TABLE POLICY TESTS
-- ================================================================

-- Test show_participants_select_self policy
SELECT subtest(
    'Testing show_participants_select_self policy',
    ARRAY[
        -- User should be able to view their own participation
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM show_participants WHERE userid = ''55555555-5555-5555-5555-555555555555'''),
            'User should be able to view their own participation'
        ),
        
        -- User should not be able to view other participations
        ok(
            test_query_returns_no_rows('SELECT * FROM show_participants WHERE userid = ''44444444-4444-4444-4444-444444444444'''),
            'User should not be able to view other participations directly'
        )
    ]
);

-- Test show_participants_select_organizer policy
SELECT subtest(
    'Testing show_participants_select_organizer policy',
    ARRAY[
        -- Organizer should be able to view participants for their shows
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM show_participants WHERE showid = ''a2222222-2222-2222-2222-222222222222'''),
            'Organizer should be able to view participants for their shows'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM show_participants WHERE showid = ''a3333333-3333-3333-3333-333333333333'''),
            'Organizer should be able to view participants for other shows they organize'
        ),
        
        -- Organizer should not be able to view participants for shows they don't organize
        ok(
            test_query_returns_no_rows('SELECT * FROM show_participants WHERE showid = ''a1111111-1111-1111-1111-111111111111'''),
            'Organizer should not be able to view participants for shows they don''t organize'
        )
    ]
);

-- Test show_participants_select_mvp_dealer_safe policy
SELECT subtest(
    'Testing show_participants_select_mvp_dealer_safe policy',
    ARRAY[
        -- MVP dealer should be able to view their own participation
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM show_participants WHERE userid = ''33333333-3333-3333-3333-333333333333'''),
            'MVP dealer should be able to view their own participation'
        ),
        
        -- MVP dealer should be able to view participants for shows they participate in
        ok(
            test_query_returns_rows('SELECT * FROM show_participants WHERE showid = ''a3333333-3333-3333-3333-333333333333'''),
            'MVP dealer should be able to view participants for shows they participate in'
        ),
        
        -- MVP dealer should not be able to view participants for shows they don't participate in
        ok(
            test_query_returns_no_rows('SELECT * FROM show_participants WHERE showid = ''a4444444-4444-4444-4444-444444444444'''),
            'MVP dealer should not be able to view participants for shows they don''t participate in'
        )
    ]
);

-- Test show_participants_insert policy
SELECT subtest(
    'Testing show_participants_insert policy',
    ARRAY[
        -- User should be able to register themselves as participants
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO show_participants (id, showid, userid, role, status) VALUES (gen_random_uuid(), ''a2222222-2222-2222-2222-222222222222'', ''55555555-5555-5555-5555-555555555555'', ''attendee'', ''pending'')',
            'User should be able to register themselves as participants'
        ),
        
        -- User should not be able to register others as participants
        throws_ok(
            'INSERT INTO show_participants (id, showid, userid, role, status) VALUES (gen_random_uuid(), ''a2222222-2222-2222-2222-222222222222'', ''66666666-6666-6666-6666-666666666666'', ''attendee'', ''pending'')',
            '42501',
            'permission denied for table show_participants',
            'User should not be able to register others as participants'
        )
    ]
);

-- Test show_participants_update_self policy
SELECT subtest(
    'Testing show_participants_update_self policy',
    ARRAY[
        -- User should be able to update their own participation
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'UPDATE show_participants SET status = ''confirmed'' WHERE userid = ''55555555-5555-5555-5555-555555555555'' AND showid = ''a5555555-5555-5555-5555-555555555555''',
            'User should be able to update their own participation'
        ),
        
        -- User should not be able to update others' participation
        throws_ok(
            'UPDATE show_participants SET status = ''cancelled'' WHERE userid = ''44444444-4444-4444-4444-444444444444''',
            '42501',
            'permission denied for table show_participants',
            'User should not be able to update others'' participation'
        )
    ]
);

-- Test show_participants_delete_self policy
SELECT subtest(
    'Testing show_participants_delete_self policy',
    ARRAY[
        -- Create a temporary participation for deletion test
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO show_participants (id, showid, userid, role, status) VALUES (gen_random_uuid(), ''a1111111-1111-1111-1111-111111111111'', ''55555555-5555-5555-5555-555555555555'', ''attendee'', ''pending'')',
            'Creating temporary participation for deletion test'
        ),
        
        -- User should be able to delete their own participation
        lives_ok(
            'DELETE FROM show_participants WHERE userid = ''55555555-5555-5555-5555-555555555555'' AND showid = ''a1111111-1111-1111-1111-111111111111''',
            'User should be able to delete their own participation'
        ),
        
        -- User should not be able to delete others' participation
        throws_ok(
            'DELETE FROM show_participants WHERE userid = ''44444444-4444-4444-4444-444444444444''',
            '42501',
            'permission denied for table show_participants',
            'User should not be able to delete others'' participation'
        )
    ]
);

-- Test show_participants_update_organizer policy
SELECT subtest(
    'Testing show_participants_update_organizer policy',
    ARRAY[
        -- Organizer should be able to update participant info for their shows
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        lives_ok(
            'UPDATE show_participants SET status = ''confirmed'' WHERE showid = ''a3333333-3333-3333-3333-333333333333''',
            'Organizer should be able to update participant info for their shows'
        ),
        
        -- Organizer should not be able to update participant info for shows they don't organize
        throws_ok(
            'UPDATE show_participants SET status = ''confirmed'' WHERE showid = ''a1111111-1111-1111-1111-111111111111''',
            '42501',
            'permission denied for table show_participants',
            'Organizer should not be able to update participant info for shows they don''t organize'
        )
    ]
);

-- Test show_participants_all_admin policy
SELECT subtest(
    'Testing show_participants_all_admin policy',
    ARRAY[
        -- Admin should be able to view all participants
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM show_participants'),
            'Admin should be able to view all participants'
        ),
        
        -- Admin should be able to update any participant
        lives_ok(
            'UPDATE show_participants SET status = ''confirmed'' WHERE showid = ''a5555555-5555-5555-5555-555555555555''',
            'Admin should be able to update any participant'
        ),
        
        -- Admin should be able to delete any participant
        lives_ok(
            'DELETE FROM show_participants WHERE showid = ''a5555555-5555-5555-5555-555555555555'' AND userid = ''66666666-6666-6666-6666-666666666666''',
            'Admin should be able to delete any participant'
        ),
        
        -- Restore the deleted participant for further tests
        lives_ok(
            'INSERT INTO show_participants (id, showid, userid, role, status) VALUES (gen_random_uuid(), ''a5555555-5555-5555-5555-555555555555'', ''66666666-6666-6666-6666-666666666666'', ''attendee'', ''confirmed'')',
            'Restoring deleted participant for further tests'
        )
    ]
);

-- ================================================================
-- SECTION 6: WANT_LISTS TABLE POLICY TESTS
-- ================================================================

-- Test want_lists_select_self policy
SELECT subtest(
    'Testing want_lists_select_self policy',
    ARRAY[
        -- User should be able to view their own want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM want_lists WHERE userid = ''55555555-5555-5555-5555-555555555555'''),
            'User should be able to view their own want lists'
        ),
        
        -- User should not be able to view others' want lists directly
        ok(
            test_query_returns_no_rows('SELECT * FROM want_lists WHERE userid = ''66666666-6666-6666-6666-666666666666'''),
            'User should not be able to view others'' want lists directly'
        )
    ]
);

-- Test want_lists_select_mvp_dealer policy
SELECT subtest(
    'Testing want_lists_select_mvp_dealer policy',
    ARRAY[
        -- MVP dealer should be able to view want lists for shows they're involved with
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM want_lists WHERE id = ''b1111111-1111-1111-1111-111111111111'''),
            'MVP dealer should be able to view want lists for shows they''re involved with'
        ),
        
        -- MVP dealer should not be able to view want lists for shows they're not involved with
        ok(
            test_query_returns_no_rows('SELECT * FROM want_lists WHERE id = ''b2222222-2222-2222-2222-222222222222'''),
            'MVP dealer should not be able to view want lists for shows they''re not involved with'
        )
    ]
);

-- Test want_lists_select_organizer policy
SELECT subtest(
    'Testing want_lists_select_organizer policy',
    ARRAY[
        -- Organizer should be able to view want lists for their shows
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM want_lists WHERE id IN (SELECT wantlistid FROM shared_want_lists WHERE showid = ''a5555555-5555-5555-5555-555555555555'')'),
            'Organizer should be able to view want lists for their shows'
        )
    ]
);

-- Test want_lists_insert policy
SELECT subtest(
    'Testing want_lists_insert policy',
    ARRAY[
        -- User should be able to create their own want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO want_lists (id, userid, name, description) VALUES (''b3333333-3333-3333-3333-333333333333'', ''55555555-5555-5555-5555-555555555555'', ''New Want List'', ''Test description'')',
            'User should be able to create their own want lists'
        ),
        
        -- User should not be able to create want lists for others
        throws_ok(
            'INSERT INTO want_lists (id, userid, name, description) VALUES (''b4444444-4444-4444-4444-444444444444'', ''66666666-6666-6666-6666-666666666666'', ''Fake Want List'', ''Fake description'')',
            '42501',
            'permission denied for table want_lists',
            'User should not be able to create want lists for others'
        )
    ]
);

-- Test want_lists_update policy
SELECT subtest(
    'Testing want_lists_update policy',
    ARRAY[
        -- User should be able to update their own want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'UPDATE want_lists SET description = ''Updated description'' WHERE userid = ''55555555-5555-5555-5555-555555555555''',
            'User should be able to update their own want lists'
        ),
        
        -- User should not be able to update others' want lists
        throws_ok(
            'UPDATE want_lists SET description = ''Hacked description'' WHERE userid = ''66666666-6666-6666-6666-666666666666''',
            '42501',
            'permission denied for table want_lists',
            'User should not be able to update others'' want lists'
        )
    ]
);

-- Test want_lists_delete policy
SELECT subtest(
    'Testing want_lists_delete policy',
    ARRAY[
        -- User should be able to delete their own want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'DELETE FROM want_lists WHERE id = ''b3333333-3333-3333-3333-333333333333''',
            'User should be able to delete their own want lists'
        ),
        
        -- User should not be able to delete others' want lists
        throws_ok(
            'DELETE FROM want_lists WHERE userid = ''66666666-6666-6666-6666-666666666666''',
            '42501',
            'permission denied for table want_lists',
            'User should not be able to delete others'' want lists'
        )
    ]
);

-- Test want_lists_all_admin policy
SELECT subtest(
    'Testing want_lists_all_admin policy',
    ARRAY[
        -- Admin should be able to view all want lists
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM want_lists'),
            'Admin should be able to view all want lists'
        ),
        
        -- Admin should be able to update any want list
        lives_ok(
            'UPDATE want_lists SET description = ''Admin updated description'' WHERE id = ''b1111111-1111-1111-1111-111111111111''',
            'Admin should be able to update any want list'
        ),
        
        -- Admin should be able to delete any want list
        lives_ok(
            'INSERT INTO want_lists (id, userid, name, description) VALUES (''b9999999-9999-9999-9999-999999999999'', ''55555555-5555-5555-5555-555555555555'', ''Temp Want List'', ''Temp description'')',
            'Creating temporary want list for deletion test'
        ),
        lives_ok(
            'DELETE FROM want_lists WHERE id = ''b9999999-9999-9999-9999-999999999999''',
            'Admin should be able to delete any want list'
        )
    ]
);

-- ================================================================
-- SECTION 7: SHARED_WANT_LISTS TABLE POLICY TESTS
-- ================================================================

-- Test shared_want_lists_select_self policy
SELECT subtest(
    'Testing shared_want_lists_select_self policy',
    ARRAY[
        -- User should be able to view their own shared want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM shared_want_lists WHERE wantlistid = ''b1111111-1111-1111-1111-111111111111'''),
            'User should be able to view their own shared want lists'
        ),
        
        -- User should not be able to view others' shared want lists directly
        ok(
            test_query_returns_no_rows('SELECT * FROM shared_want_lists WHERE wantlistid = ''b2222222-2222-2222-2222-222222222222'''),
            'User should not be able to view others'' shared want lists directly'
        )
    ]
);

-- Test shared_want_lists_select_mvp_dealer policy
SELECT subtest(
    'Testing shared_want_lists_select_mvp_dealer policy',
    ARRAY[
        -- MVP dealer should be able to view shared want lists for shows they're involved with
        test_function(
            'set_test_user',
            ARRAY['33333333-3333-3333-3333-333333333333'::UUID],
            'Setting test user to MVP dealer'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM shared_want_lists WHERE showid = ''a3333333-3333-3333-3333-333333333333'''),
            'MVP dealer should be able to view shared want lists for shows they''re involved with'
        ),
        
        -- MVP dealer should not be able to view shared want lists for shows they're not involved with
        ok(
            test_query_returns_no_rows('SELECT * FROM shared_want_lists WHERE showid = ''a4444444-4444-4444-4444-444444444444'''),
            'MVP dealer should not be able to view shared want lists for shows they''re not involved with'
        )
    ]
);

-- Test shared_want_lists_select_organizer policy
SELECT subtest(
    'Testing shared_want_lists_select_organizer policy',
    ARRAY[
        -- Organizer should be able to view shared want lists for their shows
        test_function(
            'set_test_user',
            ARRAY['22222222-2222-2222-2222-222222222222'::UUID],
            'Setting test user to organizer'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM shared_want_lists WHERE showid = ''a5555555-5555-5555-5555-555555555555'''),
            'Organizer should be able to view shared want lists for their shows'
        ),
        
        -- Organizer should not be able to view shared want lists for shows they don't organize
        ok(
            test_query_returns_no_rows('SELECT * FROM shared_want_lists WHERE showid = ''a1111111-1111-1111-1111-111111111111'''),
            'Organizer should not be able to view shared want lists for shows they don''t organize'
        )
    ]
);

-- Test shared_want_lists_insert policy
SELECT subtest(
    'Testing shared_want_lists_insert policy',
    ARRAY[
        -- User should be able to share their own want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO want_lists (id, userid, name, description) VALUES (''b5555555-5555-5555-5555-555555555555'', ''55555555-5555-5555-5555-555555555555'', ''Another Want List'', ''Another description'')',
            'Creating another want list for sharing test'
        ),
        lives_ok(
            'INSERT INTO shared_want_lists (id, wantlistid, showid) VALUES (gen_random_uuid(), ''b5555555-5555-5555-5555-555555555555'', ''a2222222-2222-2222-2222-222222222222'')',
            'User should be able to share their own want lists'
        ),
        
        -- User should not be able to share others' want lists
        throws_ok(
            'INSERT INTO shared_want_lists (id, wantlistid, showid) VALUES (gen_random_uuid(), ''b2222222-2222-2222-2222-222222222222'', ''a2222222-2222-2222-2222-222222222222'')',
            '42501',
            'permission denied for table shared_want_lists',
            'User should not be able to share others'' want lists'
        )
    ]
);

-- Test shared_want_lists_delete policy
SELECT subtest(
    'Testing shared_want_lists_delete policy',
    ARRAY[
        -- User should be able to unshare their own want lists
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'DELETE FROM shared_want_lists WHERE wantlistid = ''b5555555-5555-5555-5555-555555555555''',
            'User should be able to unshare their own want lists'
        ),
        
        -- User should not be able to unshare others' want lists
        throws_ok(
            'DELETE FROM shared_want_lists WHERE wantlistid = ''b2222222-2222-2222-2222-222222222222''',
            '42501',
            'permission denied for table shared_want_lists',
            'User should not be able to unshare others'' want lists'
        )
    ]
);

-- Test shared_want_lists_all_admin policy
SELECT subtest(
    'Testing shared_want_lists_all_admin policy',
    ARRAY[
        -- Admin should be able to view all shared want lists
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM shared_want_lists'),
            'Admin should be able to view all shared want lists'
        ),
        
        -- Admin should be able to share any want list
        lives_ok(
            'INSERT INTO shared_want_lists (id, wantlistid, showid) VALUES (gen_random_uuid(), ''b5555555-5555-5555-5555-555555555555'', ''a1111111-1111-1111-1111-111111111111'')',
            'Admin should be able to share any want list'
        ),
        
        -- Admin should be able to unshare any want list
        lives_ok(
            'DELETE FROM shared_want_lists WHERE wantlistid = ''b5555555-5555-5555-5555-555555555555''',
            'Admin should be able to unshare any want list'
        )
    ]
);

-- ================================================================
-- SECTION 8: CONVERSATIONS TABLE POLICY TESTS
-- ================================================================

-- Test conversations_select_participant policy
SELECT subtest(
    'Testing conversations_select_participant policy',
    ARRAY[
        -- User should be able to view conversations they participate in
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM conversations WHERE id = ''c1111111-1111-1111-1111-111111111111'''),
            'User should be able to view conversations they participate in'
        ),
        
        -- User should not be able to view conversations they don't participate in
        ok(
            test_query_returns_no_rows('SELECT * FROM conversations WHERE id NOT IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ''55555555-5555-5555-5555-555555555555'')'),
            'User should not be able to view conversations they don''t participate in'
        )
    ]
);

-- Test conversations_insert policy
SELECT subtest(
    'Testing conversations_insert policy',
    ARRAY[
        -- User should be able to create conversations
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO conversations (id, title, created_at) VALUES (''c3333333-3333-3333-3333-333333333333'', ''New Conversation'', NOW())',
            'User should be able to create conversations'
        )
    ]
);

-- Test conversations_update_participant policy
SELECT subtest(
    'Testing conversations_update_participant policy',
    ARRAY[
        -- User should be able to update conversations they participate in
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'UPDATE conversations SET title = ''Updated Title'' WHERE id = ''c1111111-1111-1111-1111-111111111111''',
            'User should be able to update conversations they participate in'
        ),
        
        -- User should not be able to update conversations they don't participate in
        throws_ok(
            'UPDATE conversations SET title = ''Hacked Title'' WHERE id NOT IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ''55555555-5555-5555-5555-555555555555'')',
            '42501',
            'permission denied for table conversations',
            'User should not be able to update conversations they don''t participate in'
        )
    ]
);

-- Test conversations_all_admin policy
SELECT subtest(
    'Testing conversations_all_admin policy',
    ARRAY[
        -- Admin should be able to view all conversations
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM conversations'),
            'Admin should be able to view all conversations'
        ),
        
        -- Admin should be able to update any conversation
        lives_ok(
            'UPDATE conversations SET title = ''Admin Updated Title'' WHERE id = ''c2222222-2222-2222-2222-222222222222''',
            'Admin should be able to update any conversation'
        ),
        
        -- Admin should be able to delete any conversation
        lives_ok(
            'DELETE FROM conversations WHERE id = ''c3333333-3333-3333-3333-333333333333''',
            'Admin should be able to delete any conversation'
        )
    ]
);

-- ================================================================
-- SECTION 9: CONVERSATION_PARTICIPANTS TABLE POLICY TESTS
-- ================================================================

-- Test conversation_participants_select policy
SELECT subtest(
    'Testing conversation_participants_select policy',
    ARRAY[
        -- User should be able to view participants for conversations they are in
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM conversation_participants WHERE conversation_id = ''c1111111-1111-1111-1111-111111111111'''),
            'User should be able to view participants for conversations they are in'
        ),
        
        -- User should not be able to view participants for conversations they are not in
        ok(
            test_query_returns_no_rows('SELECT * FROM conversation_participants WHERE conversation_id NOT IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ''55555555-5555-5555-5555-555555555555'')'),
            'User should not be able to view participants for conversations they are not in'
        )
    ]
);

-- Test conversation_participants_insert_self policy
SELECT subtest(
    'Testing conversation_participants_insert_self policy',
    ARRAY[
        -- Create a new conversation for testing
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO conversations (id, title, created_at) VALUES (''c4444444-4444-4444-4444-444444444444'', ''Test Conversation'', NOW())',
            'Creating a new conversation for testing'
        ),
        
        -- User should be able to add themselves to conversations
        lives_ok(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (''c4444444-4444-4444-4444-444444444444'', ''55555555-5555-5555-5555-555555555555'')',
            'User should be able to add themselves to conversations'
        ),
        
        -- User should not be able to add others to conversations
        throws_ok(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (''c4444444-4444-4444-4444-444444444444'', ''66666666-6666-6666-6666-666666666666'')',
            '42501',
            'permission denied for table conversation_participants',
            'User should not be able to add others to conversations'
        )
    ]
);

-- Test conversation_participants_delete_self policy
SELECT subtest(
    'Testing conversation_participants_delete_self policy',
    ARRAY[
        -- User should be able to remove themselves from conversations
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'DELETE FROM conversation_participants WHERE conversation_id = ''c4444444-4444-4444-4444-444444444444'' AND user_id = ''55555555-5555-5555-5555-555555555555''',
            'User should be able to remove themselves from conversations'
        ),
        
        -- User should not be able to remove others from conversations
        throws_ok(
            'DELETE FROM conversation_participants WHERE user_id = ''44444444-4444-4444-4444-444444444444''',
            '42501',
            'permission denied for table conversation_participants',
            'User should not be able to remove others from conversations'
        )
    ]
);

-- Test conversation_participants_all_admin policy
SELECT subtest(
    'Testing conversation_participants_all_admin policy',
    ARRAY[
        -- Admin should be able to view all conversation participants
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM conversation_participants'),
            'Admin should be able to view all conversation participants'
        ),
        
        -- Admin should be able to add anyone to any conversation
        lives_ok(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (''c4444444-4444-4444-4444-444444444444'', ''77777777-7777-7777-7777-777777777777'')',
            'Admin should be able to add anyone to any conversation'
        ),
        
        -- Admin should be able to remove anyone from any conversation
        lives_ok(
            'DELETE FROM conversation_participants WHERE conversation_id = ''c4444444-4444-4444-4444-444444444444'' AND user_id = ''77777777-7777-7777-7777-777777777777''',
            'Admin should be able to remove anyone from any conversation'
        )
    ]
);

-- ================================================================
-- SECTION 10: MESSAGES TABLE POLICY TESTS
-- ================================================================

-- Test messages_select_participant policy
SELECT subtest(
    'Testing messages_select_participant policy',
    ARRAY[
        -- User should be able to view messages in conversations they participate in
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM messages WHERE conversation_id = ''c1111111-1111-1111-1111-111111111111'''),
            'User should be able to view messages in conversations they participate in'
        ),
        
        -- User should not be able to view messages in conversations they don't participate in
        ok(
            test_query_returns_no_rows('SELECT * FROM messages WHERE conversation_id NOT IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ''55555555-5555-5555-5555-555555555555'')'),
            'User should not be able to view messages in conversations they don''t participate in'
        )
    ]
);

-- Test messages_insert_participant policy
SELECT subtest(
    'Testing messages_insert_participant policy',
    ARRAY[
        -- User should be able to send messages to conversations they participate in
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (gen_random_uuid(), ''c1111111-1111-1111-1111-111111111111'', ''55555555-5555-5555-5555-555555555555'', ''Test message'', NOW())',
            'User should be able to send messages to conversations they participate in'
        ),
        
        -- User should not be able to send messages to conversations they don't participate in
        throws_ok(
            'INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (gen_random_uuid(), ''c4444444-4444-4444-4444-444444444444'', ''55555555-5555-5555-5555-555555555555'', ''Hacked message'', NOW())',
            '42501',
            'permission denied for table messages',
            'User should not be able to send messages to conversations they don''t participate in'
        ),
        
        -- User should not be able to send messages as someone else
        throws_ok(
            'INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (gen_random_uuid(), ''c1111111-1111-1111-1111-111111111111'', ''44444444-4444-4444-4444-444444444444'', ''Impersonated message'', NOW())',
            '42501',
            'permission denied for table messages',
            'User should not be able to send messages as someone else'
        )
    ]
);

-- Test messages_update_own policy
SELECT subtest(
    'Testing messages_update_own policy',
    ARRAY[
        -- Find a message from the current user for testing
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'UPDATE messages SET content = ''Updated message'' WHERE sender_id = ''55555555-5555-5555-5555-555555555555'' AND conversation_id = ''c1111111-1111-1111-1111-111111111111''',
            'User should be able to update their own messages'
        ),
        
        -- User should not be able to update others' messages
        throws_ok(
            'UPDATE messages SET content = ''Hacked message'' WHERE sender_id = ''44444444-4444-4444-4444-444444444444''',
            '42501',
            'permission denied for table messages',
            'User should not be able to update others'' messages'
        )
    ]
);

-- Test messages_delete_own policy
SELECT subtest(
    'Testing messages_delete_own policy',
    ARRAY[
        -- User should be able to delete their own messages
        test_function(
            'set_test_user',
            ARRAY['55555555-5555-5555-5555-555555555555'::UUID],
            'Setting test user to attendee'
        ),
        lives_ok(
            'INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (''m9999999-9999-9999-9999-999999999999'', ''c1111111-1111-1111-1111-111111111111'', ''55555555-5555-5555-5555-555555555555'', ''Temporary message'', NOW())',
            'Creating temporary message for deletion test'
        ),
        lives_ok(
            'DELETE FROM messages WHERE id = ''m9999999-9999-9999-9999-999999999999''',
            'User should be able to delete their own messages'
        ),
        
        -- User should not be able to delete others' messages
        throws_ok(
            'DELETE FROM messages WHERE sender_id = ''44444444-4444-4444-4444-444444444444''',
            '42501',
            'permission denied for table messages',
            'User should not be able to delete others'' messages'
        )
    ]
);

-- Test messages_all_admin policy
SELECT subtest(
    'Testing messages_all_admin policy',
    ARRAY[
        -- Admin should be able to view all messages
        test_function(
            'set_test_user',
            ARRAY['11111111-1111-1111-1111-111111111111'::UUID],
            'Setting test user to admin'
        ),
        ok(
            test_query_returns_rows('SELECT * FROM messages'),
            'Admin should be able to view all messages'
        ),
        
        -- Admin should be able to update any message
        lives_ok(
            'UPDATE messages SET content = ''Admin updated message'' WHERE conversation_id = ''c1111111-1111-1111-1111-111111111111'' LIMIT 1',
            'Admin should be able to update any message'
        ),
        
        -- Admin should be able to delete any message
        lives_ok(
            'INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (''m8888888-8888-8888-8888-888888888888'', ''c1111111-1111-1111-1111-111111111111'', ''55555555-5555-5555-5555-555555555555'', ''Temporary message for admin deletion'', NOW