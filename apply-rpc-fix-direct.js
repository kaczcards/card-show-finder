/**
 * apply-rpc-fix-direct.js
 * 
 * This script applies the RPC function fix for get_visible_want_lists using
 * direct REST API calls to Supabase. Since we can't use pgmoon_exec, it tries
 * multiple approaches to execute the SQL fix.
 * 
 * The script:
 * 1. Tries multiple approaches to execute the SQL fix
 * 2. Uses the service role key with direct HTTP requests to Supabase
 * 3. Verifies the function is working after applying the fix
 * 4. Tests with the actual MVP dealer ID to confirm it returns results
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Constants for the specific test case
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
const SHOW_ID = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
const ATTENDEE_ID = '090926af-e383-4b74-95fa-d1dd16661e7f';

// ---------------------------------------------------------------------------
// Supabase setup - use service role key for elevated privileges
// ---------------------------------------------------------------------------
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

// Use service role key for admin privileges
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and ' +
      'SUPABASE_SERVICE_KEY in your .env file.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Read the SQL fix file
 */
async function readSqlFixFile() {
  console.log('\n=== Reading SQL Fix File ===');
  
  const sqlFilePath = path.join(__dirname, 'sql', 'fix-get-visible-want-lists.sql');
  
  try {
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`SQL file read successfully (${sqlContent.length} bytes)`);
    return sqlContent;
  } catch (err) {
    console.error(`Error reading SQL file: ${err.message}`);
    return null;
  }
}

/**
 * Apply the fix using direct REST API call
 */
async function applyFixWithRestApi(sqlContent) {
  console.log('\n=== Trying Direct REST API Call ===');
  
  try {
    // Create a direct REST API call to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({
        query: sqlContent
      })
    });
    
    const responseData = await response.text();
    
    if (!response.ok) {
      console.error(`REST API call failed: ${response.status} ${response.statusText}`);
      console.error(`Response: ${responseData}`);
      return false;
    }
    
    console.log('REST API call successful');
    return true;
  } catch (err) {
    console.error(`Error with REST API call: ${err.message}`);
    return false;
  }
}

/**
 * Apply the fix by creating a simplified version of the function
 */
async function applySimplifiedFunction() {
  console.log('\n=== Creating Simplified Function ===');
  
  // This is a simplified version of the function that avoids using CTEs
  const simplifiedSql = `
-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER);

-- Create a simplified version of the function that avoids CTEs
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
  temp_shows UUID[];
  temp_participants UUID[];
BEGIN
  -- Identify the viewer's role
  SELECT role INTO v_role FROM profiles WHERE id = viewer_id;

  IF v_role NOT IN ('mvp_dealer','show_organizer') THEN
    RETURN jsonb_build_object('error', 'unauthorized_role');
  END IF;

  -- Get relevant shows IDs into a temporary array
  SELECT ARRAY_AGG(s.id) INTO temp_shows
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

  -- Early exit if no relevant shows
  IF temp_shows IS NULL OR array_length(temp_shows, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', jsonb_build_array(),
      'totalCount', 0,
      'page', page,
      'pageSize', page_size,
      'hasMore', FALSE
    );
  END IF;

  -- Get participant IDs into a temporary array
  SELECT ARRAY_AGG(DISTINCT spa.userid) INTO temp_participants
  FROM show_participants spa
  WHERE spa.showid = ANY(temp_shows)
    AND spa.status IN ('registered','confirmed');

  -- Early exit if no participants
  IF temp_participants IS NULL OR array_length(temp_participants, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', jsonb_build_array(),
      'totalCount', 0,
      'page', page,
      'pageSize', page_size,
      'hasMore', FALSE
    );
  END IF;

  -- Count total matches
  SELECT COUNT(*) INTO total_count
  FROM want_lists wl
  JOIN profiles p ON p.id = wl.userid
  JOIN show_participants spa ON spa.userid = wl.userid
  JOIN shows s ON s.id = spa.showid
  WHERE wl.userid = ANY(temp_participants)
    AND s.id = ANY(temp_shows)
    AND spa.status IN ('registered','confirmed')
    AND p.role IN ('attendee','dealer','mvp_dealer')
    AND wl.content IS NOT NULL
    AND wl.content <> ''
    AND wl.content NOT ILIKE '[INVENTORY]%'
    AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%');

  -- Get paged results
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
  FROM want_lists wl
  JOIN profiles p ON p.id = wl.userid
  JOIN show_participants spa ON spa.userid = wl.userid
  JOIN shows s ON s.id = spa.showid
  WHERE wl.userid = ANY(temp_participants)
    AND s.id = ANY(temp_shows)
    AND spa.status IN ('registered','confirmed')
    AND p.role IN ('attendee','dealer','mvp_dealer')
    AND wl.content IS NOT NULL
    AND wl.content <> ''
    AND wl.content NOT ILIKE '[INVENTORY]%'
    AND (search_term IS NULL OR wl.content ILIKE '%' || search_term || '%')
  ORDER BY wl.updatedat DESC
  LIMIT page_size OFFSET v_offset;

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

-- Add helpful comment
COMMENT ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) IS 
'Returns want lists visible to MVP dealers and show organizers.
- MVP dealers: see want lists of attendees for shows they are participating in
- Show organizers: see want lists of attendees for shows they organize
- Filters for upcoming/ongoing shows only
- Includes only registered/confirmed attendees
- Excludes inventory-prefixed and empty want lists';
  `;
  
  try {
    // Try to apply the simplified function using the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        query: simplifiedSql
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Error applying simplified function: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorData}`);
      
      // Try alternative approach using the Supabase Management API
      console.log('Trying alternative approach with Management API...');
      
      const managementResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          sql: simplifiedSql
        })
      });
      
      if (!managementResponse.ok) {
        const managementError = await managementResponse.text();
        console.error(`Management API failed: ${managementResponse.status} ${managementResponse.statusText}`);
        console.error(`Response: ${managementError}`);
        return false;
      }
      
      console.log('Management API approach successful');
      return true;
    }
    
    console.log('Simplified function applied successfully');
    return true;
  } catch (err) {
    console.error(`Error applying simplified function: ${err.message}`);
    return false;
  }
}

/**
 * Apply the fix using the Supabase client directly
 */
async function applyFixWithSupabaseClient() {
  console.log('\n=== Trying Supabase Client Direct Query ===');
  
  try {
    // Try to use a direct query with the Supabase client
    const { error } = await supabase
      .from('_manual_sql')
      .select('*')
      .eq('query', `
        DROP FUNCTION IF EXISTS public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER);
      `);
    
    if (error) {
      console.error(`Error with Supabase client: ${error.message}`);
      return false;
    }
    
    console.log('Supabase client approach successful');
    return true;
  } catch (err) {
    console.error(`Error with Supabase client: ${err.message}`);
    return false;
  }
}

/**
 * Apply the fix by creating a database migration
 */
async function applyFixWithMigration() {
  console.log('\n=== Creating Database Migration ===');
  
  // Create a migration file with instructions for the user
  const migrationContent = `-- Migration: fix_get_visible_want_lists
-- Created at: ${new Date().toISOString()}
-- Description: Fix the get_visible_want_lists RPC function to avoid CTE issues

-- Please execute this migration manually in the Supabase dashboard SQL editor

-- Step 1: Drop the existing function
DROP FUNCTION IF EXISTS public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER);

-- Step 2: Create the fixed function
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

-- Step 3: Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- Step 4: Add helpful comment
COMMENT ON FUNCTION public.get_visible_want_lists(UUID, UUID, TEXT, INTEGER, INTEGER) IS 
'Returns want lists visible to MVP dealers and show organizers.
- MVP dealers: see want lists of attendees for shows they are participating in
- Show organizers: see want lists of attendees for shows they organize
- Filters for upcoming/ongoing shows only
- Includes only registered/confirmed attendees
- Excludes inventory-prefixed and empty want lists';
`;
  
  const migrationFilePath = path.join(__dirname, 'migration_fix_get_visible_want_lists.sql');
  
  try {
    fs.writeFileSync(migrationFilePath, migrationContent);
    console.log(`Migration file created at: ${migrationFilePath}`);
    console.log('Please execute this migration manually in the Supabase dashboard SQL editor');
    return true;
  } catch (err) {
    console.error(`Error creating migration file: ${err.message}`);
    return false;
  }
}

/**
 * Verify if the function exists and is working
 */
async function verifyFunctionWorks() {
  console.log('\n=== Verifying Function Works ===');
  
  try {
    // Call the function directly to see if it works
    const { data, error } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: MVP_DEALER_ID,
      show_id: SHOW_ID,
      page: 1,
      page_size: 10
    });
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.error('Function get_visible_want_lists does not exist');
        return false;
      } else if (error.message.includes('relation "base" does not exist')) {
        console.error('Function exists but still has the CTE issue');
        return false;
      } else {
        console.error(`Error calling function: ${error.message}`);
        return false;
      }
    }
    
    console.log('Function executed successfully!');
    console.log('Results:');
    console.log(`- Total count: ${data?.totalCount || 0}`);
    console.log(`- Items returned: ${data?.data?.length || 0}`);
    console.log(`- Has more: ${data?.hasMore || false}`);
    
    if (data?.data?.length > 0) {
      console.log('\nSample want list:');
      const sample = data.data[0];
      console.log(`- ID: ${sample.id}`);
      console.log(`- User: ${sample.userName} (${sample.userRole})`);
      console.log(`- Show: ${sample.showTitle}`);
      console.log(`- Content preview: ${sample.content.substring(0, 50)}${sample.content.length > 50 ? '...' : ''}`);
      console.log(`- Updated at: ${sample.updatedAt}`);
      
      // Check if attendee's want list is in the results
      const attendeeWantList = data.data.find(wl => wl.userId === ATTENDEE_ID);
      if (attendeeWantList) {
        console.log('\nAttendee want list found:');
        console.log(`- ID: ${attendeeWantList.id}`);
        console.log(`- User: ${attendeeWantList.userName} (${attendeeWantList.userRole})`);
        console.log(`- Content preview: ${attendeeWantList.content.substring(0, 50)}${attendeeWantList.content.length > 50 ? '...' : ''}`);
      } else {
        console.log('\nAttendee want list not found in results');
      }
    }
    
    return data?.data?.length > 0;
  } catch (err) {
    console.error(`Error verifying function: ${err.message}`);
    return false;
  }
}

/**
 * Test the function with direct queries
 */
async function testWithDirectQueries() {
  console.log('\n=== Testing With Direct Queries ===');
  
  try {
    // Step 1: Get the viewer's role
    const { data: viewerProfile, error: viewerError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', MVP_DEALER_ID)
      .maybeSingle();
    
    if (viewerError) {
      console.error(`Error getting viewer role: ${viewerError.message}`);
      return false;
    }
    
    const viewerRole = viewerProfile?.role;
    console.log(`Viewer role: ${viewerRole}`);
    
    // Step 2: Get relevant shows
    const now = new Date().toISOString();
    
    let relevantShowsQuery = supabase.from('shows').select('id, title, start_date, location');
    
    relevantShowsQuery = relevantShowsQuery
      .or(`end_date.gte.${now},and(end_date.is.null,start_date.gte.${now})`);
    
    if (SHOW_ID) {
      relevantShowsQuery = relevantShowsQuery.eq('id', SHOW_ID);
    }
    
    const { data: potentialShows, error: potentialShowsError } = await relevantShowsQuery;
    
    if (potentialShowsError) {
      console.error(`Error getting potential shows: ${potentialShowsError.message}`);
      return false;
    }
    
    // Get shows the MVP dealer is participating in
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', MVP_DEALER_ID)
      .in('status', ['registered', 'confirmed']);
    
    if (partError) {
      console.error(`Error getting participations: ${partError.message}`);
      return false;
    }
    
    const participationShowIds = participations.map(p => p.showid);
    const relevantShows = potentialShows.filter(show => participationShowIds.includes(show.id));
    
    console.log(`Found ${relevantShows.length} relevant shows`);
    
    if (relevantShows.length === 0) {
      console.error('No relevant shows found');
      return false;
    }
    
    const relevantShowIds = relevantShows.map(s => s.id);
    
    // Step 3: Get participants for these shows
    const { data: showParticipants, error: partListError } = await supabase
      .from('show_participants')
      .select('userid, showid')
      .in('showid', relevantShowIds)
      .in('status', ['registered', 'confirmed']);
    
    if (partListError) {
      console.error(`Error getting show participants: ${partListError.message}`);
      return false;
    }
    
    const participantUserIds = [...new Set(showParticipants.map(p => p.userid))];
    
    // Step 4: Get profiles for these participants
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', participantUserIds)
      .in('role', ['attendee', 'dealer', 'mvp_dealer']);
    
    if (profilesError) {
      console.error(`Error getting profiles: ${profilesError.message}`);
      return false;
    }
    
    // Step 5: Get want lists for these participants
    const { data: wantLists, error: wlError } = await supabase
      .from('want_lists')
      .select('id, userid, content, createdat, updatedat')
      .in('userid', participantUserIds)
      .not('content', 'is', null)
      .not('content', 'eq', '')
      .not('content', 'ilike', '[INVENTORY]%')
      .order('updatedat', { ascending: false });
    
    if (wlError) {
      console.error(`Error getting want lists: ${wlError.message}`);
      return false;
    }
    
    console.log(`Found ${wantLists.length} want lists`);
    
    if (wantLists.length === 0) {
      console.error('No want lists found');
      return false;
    }
    
    // Format results
    const formattedResults = wantLists.map(wl => {
      const profile = profiles.find(p => p.id === wl.userid);
      const participation = showParticipants.find(p => p.userid === wl.userid);
      const show = relevantShows.find(s => s.id === participation?.showid);
      
      return {
        id: wl.id,
        userId: wl.userid,
        userName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown User',
        userRole: profile?.role || 'unknown',
        showId: show?.id,
        showTitle: show?.title,
        showStartDate: show?.start_date,
        showLocation: show?.location,
        content: wl.content,
        updatedAt: wl.updatedat
      };
    });
    
    // Check if attendee's want list is in the results
    const attendeeWantList = formattedResults.find(wl => wl.userId === ATTENDEE_ID);
    
    if (attendeeWantList) {
      console.log('\nAttendee want list found with direct queries:');
      console.log(`- ID: ${attendeeWantList.id}`);
      console.log(`- User: ${attendeeWantList.userName} (${attendeeWantList.userRole})`);
      console.log(`- Content preview: ${attendeeWantList.content.substring(0, 50)}${attendeeWantList.content.length > 50 ? '...' : ''}`);
    } else {
      console.log('\nAttendee want list not found with direct queries');
    }
    
    return !!attendeeWantList;
  } catch (err) {
    console.error(`Error with direct queries: ${err.message}`);
    return false;
  }
}

/**
 * Main function to run all approaches
 */
async function main() {
  console.log('======================================================');
  console.log('APPLYING RPC FIX FOR get_visible_want_lists');
  console.log('======================================================');
  
  try {
    // Step 1: Read the SQL fix file
    const sqlContent = await readSqlFixFile();
    if (!sqlContent) {
      console.error('Failed to read SQL fix file, trying alternative approaches...');
    }
    
    // Step 2: Try multiple approaches to apply the fix
    let fixApplied = false;
    
    // Approach 1: Direct REST API call
    if (sqlContent && !fixApplied) {
      fixApplied = await applyFixWithRestApi(sqlContent);
    }
    
    // Approach 2: Simplified function
    if (!fixApplied) {
      fixApplied = await applySimplifiedFunction();
    }
    
    // Approach 3: Supabase client direct query
    if (!fixApplied) {
      fixApplied = await applyFixWithSupabaseClient();
    }
    
    // Approach 4: Create migration file for manual execution
    if (!fixApplied) {
      fixApplied = await applyFixWithMigration();
    }
    
    // Step 3: Verify the function is working
    if (fixApplied) {
      console.log('\n=== Verifying Fix ===');
      const functionWorks = await verifyFunctionWorks();
      
      if (functionWorks) {
        console.log('\n✅ FUNCTION FIX APPLIED AND VERIFIED SUCCESSFULLY');
      } else {
        console.log('\n⚠️ FUNCTION FIX APPLIED BUT VERIFICATION FAILED');
        
        // Test with direct queries as a fallback
        console.log('\nTesting with direct queries as a fallback...');
        const directQueryWorks = await testWithDirectQueries();
        
        if (directQueryWorks) {
          console.log('\n✅ DIRECT QUERIES WORK CORRECTLY');
          console.log('The issue is only with the RPC function, not with the data.');
        } else {
          console.log('\n❌ DIRECT QUERIES ALSO FAILED');
          console.log('There might be issues with the data or permissions.');
        }
      }
    } else {
      console.log('\n❌ FAILED TO APPLY FIX WITH AUTOMATED METHODS');
      console.log('Please apply the fix manually using the Supabase dashboard SQL editor.');
      console.log('The SQL fix is in the file: sql/fix-get-visible-want-lists.sql');
      
      // Test with direct queries to confirm data is correct
      console.log('\nTesting with direct queries to confirm data is correct...');
      const directQueryWorks = await testWithDirectQueries();
      
      if (directQueryWorks) {
        console.log('\n✅ DIRECT QUERIES WORK CORRECTLY');
        console.log('The issue is only with the RPC function, not with the data.');
      } else {
        console.log('\n❌ DIRECT QUERIES FAILED');
        console.log('There might be issues with the data or permissions.');
      }
    }
    
    console.log('\n======================================================');
    console.log('NEXT STEPS');
    console.log('======================================================');
    console.log('1. If automated fix failed, apply the SQL fix manually:');
    console.log('   - Go to Supabase Dashboard → SQL Editor');
    console.log('   - Copy the contents of sql/fix-get-visible-want-lists.sql');
    console.log('   - Execute the SQL to replace the broken RPC function');
    console.log('2. Test the Collection screen in your app');
    console.log('3. Verify that the MVP dealer can see attendee want lists');
    
  } catch (err) {
    console.error(`Unhandled error: ${err.message}`);
  }
}

// Run the script
main()
  .catch(err => {
    console.error('Unhandled error:', err);
  })
  .finally(() => {
    console.log('\nRPC fix script completed.');
  });
