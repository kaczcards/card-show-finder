-- fix-want-list-access-issues.sql
-- Comprehensive script to fix want list access issues for MVP Dealers and Show Organizers

-- Start transaction for safety
BEGIN;

-- Set client_min_messages to notice to see progress
SET client_min_messages TO notice;

RAISE NOTICE '--- Starting want list access fixes ---';

-- 1. Fix the get_visible_want_lists RPC function
RAISE NOTICE '1. Fixing get_visible_want_lists RPC function...';

CREATE OR REPLACE FUNCTION public.get_visible_want_lists(
  viewer_id UUID,
  show_id UUID DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  page INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_offset INTEGER := GREATEST(0, (page - 1) * page_size);
  total_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Identify the viewer's role
  SELECT role INTO v_role FROM profiles WHERE id = viewer_id;

  IF v_role NOT IN ('mvp_dealer','show_organizer') THEN
    RETURN jsonb_build_object('error', 'unauthorized_role');
  END IF;

  -- First, get the relevant shows (avoiding named CTE)
  CREATE TEMP TABLE temp_relevant_shows ON COMMIT DROP AS
  SELECT s.id
  FROM shows s
  WHERE (s.end_date >= NOW() OR (s.end_date IS NULL AND s.start_date >= NOW()))
    AND (
      (v_role = 'mvp_dealer' AND EXISTS (
        SELECT 1 FROM show_participants spd
        WHERE spd.showid = s.id AND spd.userid = viewer_id AND spd.status IN ('registered','confirmed')
      ))
      OR
      (v_role = 'show_organizer' AND s.organizer_id = viewer_id)
    )
    AND (show_id IS NULL OR s.id = show_id);

  -- Count total matches (avoiding named CTE)
  SELECT COUNT(*) INTO total_count
  FROM temp_relevant_shows rs
  JOIN show_participants spa ON spa.showid = rs.id AND spa.status IN ('registered','confirmed')
  JOIN profiles p            ON p.id = spa.userid AND p.role IN ('attendee','dealer','mvp_dealer')
  JOIN want_lists wl         ON wl.userid = spa.userid
  JOIN shows s               ON s.id = rs.id
  WHERE wl.content IS NOT NULL
    AND wl.content <> ''
    AND wl.content NOT ILIKE '[INVENTORY]%'
    AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%');

  -- Get paged results (avoiding named CTE)
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',            wl.id,
        'userId',        wl.userid,
        'userName',      (p.first_name || ' ' || COALESCE(p.last_name,'')),
        'userRole',      p.role,
        'showId',        s.id,
        'showTitle',     s.title,
        'showStartDate', s.start_date,
        'showLocation',  s.location,
        'content',       wl.content,
        'updatedAt',     wl.updatedat
      )
    ) FILTER (WHERE TRUE), jsonb_build_array()),
    'totalCount', total_count,
    'page', page,
    'pageSize', page_size,
    'hasMore', (v_offset + page_size) < total_count
  ) INTO result
  FROM temp_relevant_shows rs
  JOIN show_participants spa ON spa.showid = rs.id AND spa.status IN ('registered','confirmed')
  JOIN profiles p            ON p.id = spa.userid AND p.role IN ('attendee','dealer','mvp_dealer')
  JOIN want_lists wl         ON wl.userid = spa.userid
  JOIN shows s               ON s.id = rs.id
  WHERE wl.content IS NOT NULL
    AND wl.content <> ''
    AND wl.content NOT ILIKE '[INVENTORY]%'
    AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%')
  ORDER BY wl.updatedat DESC
  LIMIT page_size OFFSET v_offset;

  -- Drop the temp table (will also be dropped on COMMIT)
  DROP TABLE IF EXISTS temp_relevant_shows;

  RETURN COALESCE(result, jsonb_build_object(
    'data', jsonb_build_array(),
    'totalCount', 0,
    'page', page,
    'pageSize', page_size,
    'hasMore', FALSE
  ));
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;

RAISE NOTICE 'RPC function fixed successfully.';

-- 2. Create the missing user profile for the MVP dealer
RAISE NOTICE '2. Creating MVP dealer profile...';

-- Check if MVP dealer profile exists
DO $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = '84ec4c75-1c32-46f6-b0bb-7930869a4c81') INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'MVP dealer profile already exists, updating role...';
    
    UPDATE profiles 
    SET role = 'mvp_dealer',
        account_type = 'dealer',
        subscription_status = 'active',
        payment_status = 'paid'
    WHERE id = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
  ELSE
    RAISE NOTICE 'Creating new MVP dealer profile...';
    
    INSERT INTO profiles (
      id, 
      first_name, 
      last_name, 
      email, 
      role, 
      home_zip_code,
      account_type,
      subscription_status,
      payment_status,
      created_at,
      updated_at
    ) VALUES (
      '84ec4c75-1c32-46f6-b0bb-7930869a4c81',
      'John',
      'Dealer',
      'mvp_dealer@example.com',
      'mvp_dealer',
      '90210',
      'dealer',
      'active',
      'paid',
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- 3. Create a profile for the attendee user
RAISE NOTICE '3. Creating attendee profile...';

-- Check if attendee profile exists
DO $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = '090926af-e383-4b74-95fa-d1dd16661e7f') INTO profile_exists;
  
  IF profile_exists THEN
    RAISE NOTICE 'Attendee profile already exists, updating role...';
    
    UPDATE profiles 
    SET role = 'attendee',
        account_type = 'collector',
        subscription_status = 'none',
        payment_status = 'none'
    WHERE id = '090926af-e383-4b74-95fa-d1dd16661e7f';
  ELSE
    RAISE NOTICE 'Creating new attendee profile...';
    
    INSERT INTO profiles (
      id, 
      first_name, 
      last_name, 
      email, 
      role, 
      home_zip_code,
      account_type,
      subscription_status,
      payment_status,
      created_at,
      updated_at
    ) VALUES (
      '090926af-e383-4b74-95fa-d1dd16661e7f',
      'Alice',
      'Attendee',
      'attendee@example.com',
      'attendee',
      '90210',
      'collector',
      'none',
      'none',
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- 4. Register both users for the specific show
RAISE NOTICE '4. Registering users for the show...';

-- Check if show exists
DO $$
DECLARE
  show_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM shows WHERE id = 'f8f057ec-7000-4caf-b8e3-5f261dead14c') INTO show_exists;
  
  IF NOT show_exists THEN
    RAISE EXCEPTION 'Show with ID f8f057ec-7000-4caf-b8e3-5f261dead14c does not exist!';
  END IF;
END $$;

-- Register MVP dealer for the show
DO $$
DECLARE
  participation_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM show_participants 
    WHERE userid = '84ec4c75-1c32-46f6-b0bb-7930869a4c81' 
    AND showid = 'f8f057ec-7000-4caf-b8e3-5f261dead14c'
  ) INTO participation_exists;
  
  IF participation_exists THEN
    RAISE NOTICE 'MVP dealer already registered for the show, updating status...';
    
    UPDATE show_participants 
    SET status = 'confirmed', 
        role = 'mvp_dealer',
        updated_at = NOW()
    WHERE userid = '84ec4c75-1c32-46f6-b0bb-7930869a4c81' 
    AND showid = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
  ELSE
    RAISE NOTICE 'Registering MVP dealer for the show...';
    
    INSERT INTO show_participants (
      id,
      userid,
      showid,
      status,
      role,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      '84ec4c75-1c32-46f6-b0bb-7930869a4c81',
      'f8f057ec-7000-4caf-b8e3-5f261dead14c',
      'confirmed',
      'mvp_dealer',
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- Register attendee for the show
DO $$
DECLARE
  participation_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM show_participants 
    WHERE userid = '090926af-e383-4b74-95fa-d1dd16661e7f' 
    AND showid = 'f8f057ec-7000-4caf-b8e3-5f261dead14c'
  ) INTO participation_exists;
  
  IF participation_exists THEN
    RAISE NOTICE 'Attendee already registered for the show, updating status...';
    
    UPDATE show_participants 
    SET status = 'confirmed', 
        role = 'attendee',
        updated_at = NOW()
    WHERE userid = '090926af-e383-4b74-95fa-d1dd16661e7f' 
    AND showid = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
  ELSE
    RAISE NOTICE 'Registering attendee for the show...';
    
    INSERT INTO show_participants (
      id,
      userid,
      showid,
      status,
      role,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      '090926af-e383-4b74-95fa-d1dd16661e7f',
      'f8f057ec-7000-4caf-b8e3-5f261dead14c',
      'confirmed',
      'attendee',
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- 5. Create sample want lists for the attendee
RAISE NOTICE '5. Creating sample want lists for the attendee...';

-- Check if attendee already has want lists
DO $$
DECLARE
  want_lists_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO want_lists_count
  FROM want_lists
  WHERE userid = '090926af-e383-4b74-95fa-d1dd16661e7f';
  
  IF want_lists_count > 0 THEN
    RAISE NOTICE 'Attendee already has % want lists, skipping creation...', want_lists_count;
  ELSE
    RAISE NOTICE 'Creating sample want lists for attendee...';
    
    -- Create first want list
    INSERT INTO want_lists (
      id,
      userid,
      content,
      createdat,
      updatedat
    ) VALUES (
      gen_random_uuid(),
      '090926af-e383-4b74-95fa-d1dd16661e7f',
      'Looking for:
- 2018 Bowman Chrome Shohei Ohtani RC
- 2018 Topps Update Juan Soto RC
- Any Mike Trout parallels
- 2023 Bowman 1st Chrome autos',
      NOW(),
      NOW()
    );
    
    -- Create second want list
    INSERT INTO want_lists (
      id,
      userid,
      content,
      createdat,
      updatedat
    ) VALUES (
      gen_random_uuid(),
      '090926af-e383-4b74-95fa-d1dd16661e7f',
      'Vintage cards wanted:
- 1956 Topps Mickey Mantle
- Any 1950s Hank Aaron
- 1960s Roberto Clemente
- T206 commons in good condition',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    );
  END IF;
END $$;

-- 6. Add debugging/verification queries
RAISE NOTICE '6. Running verification queries...';

-- Verify MVP dealer profile
RAISE NOTICE 'Verifying MVP dealer profile:';
SELECT id, first_name, last_name, role, account_type, subscription_status
FROM profiles
WHERE id = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';

-- Verify attendee profile
RAISE NOTICE 'Verifying attendee profile:';
SELECT id, first_name, last_name, role, account_type, subscription_status
FROM profiles
WHERE id = '090926af-e383-4b74-95fa-d1dd16661e7f';

-- Verify show registrations
RAISE NOTICE 'Verifying show registrations:';
SELECT sp.userid, p.first_name, p.last_name, p.role, sp.showid, sp.status, s.title, s.start_date
FROM show_participants sp
JOIN profiles p ON p.id = sp.userid
JOIN shows s ON s.id = sp.showid
WHERE sp.showid = 'f8f057ec-7000-4caf-b8e3-5f261dead14c'
AND sp.userid IN ('84ec4c75-1c32-46f6-b0bb-7930869a4c81', '090926af-e383-4b74-95fa-d1dd16661e7f');

-- Verify want lists
RAISE NOTICE 'Verifying want lists:';
SELECT id, userid, LEFT(content, 50) as content_preview, createdat, updatedat
FROM want_lists
WHERE userid = '090926af-e383-4b74-95fa-d1dd16661e7f';

-- Test the RPC function
RAISE NOTICE 'Testing get_visible_want_lists RPC function:';
SELECT * FROM get_visible_want_lists(
  '84ec4c75-1c32-46f6-b0bb-7930869a4c81',
  'f8f057ec-7000-4caf-b8e3-5f261dead14c',
  NULL,
  1,
  10
);

RAISE NOTICE '--- Want list access fixes completed successfully ---';

-- Commit the transaction
COMMIT;
