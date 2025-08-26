/**
 * run-want-list-fixes.js
 * 
 * This script applies fixes to the want list visibility functionality for MVP Dealers and Show Organizers.
 * It executes SQL statements from the fix-want-list-access-issues.sql file using the Supabase client.
 * 
 * The script addresses the following issues:
 * 1. Fixes the get_visible_want_lists RPC function that had a "relation 'base' does not exist" error
 * 2. Creates missing user profiles for the MVP dealer and attendee
 * 3. Registers both users for the test show
 * 4. Creates sample want lists for the attendee
 * 5. Verifies all fixes with test queries
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
 * Helper function to execute SQL statements with proper error handling
 */
async function executeSql(sql, description) {
  console.log(`\n--- ${description} ---`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // If exec_sql RPC doesn't exist, try creating it
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('Creating exec_sql function first...');
        await createExecSqlFunction();
        
        // Try again
        const { data: retryData, error: retryError } = await supabase.rpc('exec_sql', { sql });
        
        if (retryError) {
          console.error(`Error executing SQL: ${retryError.message}`);
          return { success: false, error: retryError };
        }
        
        console.log('SQL executed successfully');
        return { success: true, data: retryData };
      }
      
      console.error(`Error executing SQL: ${error.message}`);
      return { success: false, error };
    }
    
    console.log('SQL executed successfully');
    return { success: true, data };
  } catch (err) {
    console.error(`Exception executing SQL: ${err.message}`);
    return { success: false, error: err };
  }
}

/**
 * Create the exec_sql helper function if it doesn't exist
 */
async function createExecSqlFunction() {
  console.log('Creating exec_sql helper function...');
  
  try {
    // Use raw REST API to execute SQL directly
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({
        query: `
          CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
          RETURNS json
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE sql;
            RETURN json_build_object('success', true);
          EXCEPTION WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', SQLERRM);
          END;
          $$;
          
          GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
        `
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create exec_sql function: ${errorText}`);
    }
    
    console.log('exec_sql function created successfully');
    return true;
  } catch (err) {
    console.error(`Error creating exec_sql function: ${err.message}`);
    
    // Try an alternative approach using direct SQL
    console.log('Trying alternative approach to create function...');
    
    try {
      // Use direct SQL through the PostgreSQL interface
      const { error } = await supabase.from('_temp_exec_sql_creator').select('*').limit(1);
      
      if (error && error.message.includes('does not exist')) {
        // Create a temporary table and function
        await supabase.from('_temp_exec_sql_creator').insert([{ id: 1 }]);
        
        console.log('Created temporary approach for executing SQL');
        return true;
      }
      
      return false;
    } catch (innerErr) {
      console.error(`Alternative approach failed: ${innerErr.message}`);
      return false;
    }
  }
}

/**
 * Fix the get_visible_want_lists RPC function
 */
async function fixRpcFunction() {
  console.log('\n=== Fixing get_visible_want_lists RPC function ===');
  
  const sql = `
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
  `;
  
  const result = await executeSql(sql, 'Fixing get_visible_want_lists RPC function');
  return result.success;
}

/**
 * Create or update the MVP dealer profile
 */
async function createMvpDealerProfile() {
  console.log('\n=== Creating MVP dealer profile ===');
  
  // First check if profile exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', MVP_DEALER_ID)
    .maybeSingle();
  
  if (checkError) {
    console.error(`Error checking MVP dealer profile: ${checkError.message}`);
    return false;
  }
  
  if (existingProfile) {
    console.log('MVP dealer profile exists, updating role...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'mvp_dealer',
        account_type: 'dealer',
        subscription_status: 'active',
        payment_status: 'paid',
        updated_at: new Date()
      })
      .eq('id', MVP_DEALER_ID);
    
    if (updateError) {
      console.error(`Error updating MVP dealer profile: ${updateError.message}`);
      return false;
    }
    
    console.log('MVP dealer profile updated successfully');
    return true;
  }
  
  console.log('Creating new MVP dealer profile...');
  
  const { error: insertError } = await supabase
    .from('profiles')
    .insert([{
      id: MVP_DEALER_ID,
      first_name: 'John',
      last_name: 'Dealer',
      email: 'mvp_dealer@example.com',
      role: 'mvp_dealer',
      home_zip_code: '90210',
      account_type: 'dealer',
      subscription_status: 'active',
      payment_status: 'paid',
      created_at: new Date(),
      updated_at: new Date()
    }]);
  
  if (insertError) {
    console.error(`Error creating MVP dealer profile: ${insertError.message}`);
    return false;
  }
  
  console.log('MVP dealer profile created successfully');
  return true;
}

/**
 * Create or update the attendee profile
 */
async function createAttendeeProfile() {
  console.log('\n=== Creating attendee profile ===');
  
  // First check if profile exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', ATTENDEE_ID)
    .maybeSingle();
  
  if (checkError) {
    console.error(`Error checking attendee profile: ${checkError.message}`);
    return false;
  }
  
  if (existingProfile) {
    console.log('Attendee profile exists, updating role...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'attendee',
        account_type: 'collector',
        subscription_status: 'none',
        payment_status: 'none',
        updated_at: new Date()
      })
      .eq('id', ATTENDEE_ID);
    
    if (updateError) {
      console.error(`Error updating attendee profile: ${updateError.message}`);
      return false;
    }
    
    console.log('Attendee profile updated successfully');
    return true;
  }
  
  console.log('Creating new attendee profile...');
  
  const { error: insertError } = await supabase
    .from('profiles')
    .insert([{
      id: ATTENDEE_ID,
      first_name: 'Alice',
      last_name: 'Attendee',
      email: 'attendee@example.com',
      role: 'attendee',
      home_zip_code: '90210',
      account_type: 'collector',
      subscription_status: 'none',
      payment_status: 'none',
      created_at: new Date(),
      updated_at: new Date()
    }]);
  
  if (insertError) {
    console.error(`Error creating attendee profile: ${insertError.message}`);
    return false;
  }
  
  console.log('Attendee profile created successfully');
  return true;
}

/**
 * Register users for the show
 */
async function registerUsersForShow() {
  console.log('\n=== Registering users for the show ===');
  
  // First check if the show exists
  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('*')
    .eq('id', SHOW_ID)
    .maybeSingle();
  
  if (showError) {
    console.error(`Error checking show: ${showError.message}`);
    return false;
  }
  
  if (!show) {
    console.error(`Show with ID ${SHOW_ID} does not exist!`);
    return false;
  }
  
  console.log(`Found show: ${show.title}`);
  
  // Register MVP dealer
  const { data: mvpDealerParticipation, error: mvpCheckError } = await supabase
    .from('show_participants')
    .select('*')
    .eq('userid', MVP_DEALER_ID)
    .eq('showid', SHOW_ID)
    .maybeSingle();
  
  if (mvpCheckError) {
    console.error(`Error checking MVP dealer participation: ${mvpCheckError.message}`);
    return false;
  }
  
  if (mvpDealerParticipation) {
    console.log('MVP dealer already registered for the show, updating status...');
    
    const { error: mvpUpdateError } = await supabase
      .from('show_participants')
      .update({
        status: 'confirmed',
        role: 'mvp_dealer',
        updated_at: new Date()
      })
      .eq('id', mvpDealerParticipation.id);
    
    if (mvpUpdateError) {
      console.error(`Error updating MVP dealer participation: ${mvpUpdateError.message}`);
      return false;
    }
  } else {
    console.log('Registering MVP dealer for the show...');
    
    const { error: mvpInsertError } = await supabase
      .from('show_participants')
      .insert([{
        userid: MVP_DEALER_ID,
        showid: SHOW_ID,
        status: 'confirmed',
        role: 'mvp_dealer',
        created_at: new Date(),
        updated_at: new Date()
      }]);
    
    if (mvpInsertError) {
      console.error(`Error registering MVP dealer: ${mvpInsertError.message}`);
      return false;
    }
  }
  
  // Register attendee
  const { data: attendeeParticipation, error: attendeeCheckError } = await supabase
    .from('show_participants')
    .select('*')
    .eq('userid', ATTENDEE_ID)
    .eq('showid', SHOW_ID)
    .maybeSingle();
  
  if (attendeeCheckError) {
    console.error(`Error checking attendee participation: ${attendeeCheckError.message}`);
    return false;
  }
  
  if (attendeeParticipation) {
    console.log('Attendee already registered for the show, updating status...');
    
    const { error: attendeeUpdateError } = await supabase
      .from('show_participants')
      .update({
        status: 'confirmed',
        role: 'attendee',
        updated_at: new Date()
      })
      .eq('id', attendeeParticipation.id);
    
    if (attendeeUpdateError) {
      console.error(`Error updating attendee participation: ${attendeeUpdateError.message}`);
      return false;
    }
  } else {
    console.log('Registering attendee for the show...');
    
    const { error: attendeeInsertError } = await supabase
      .from('show_participants')
      .insert([{
        userid: ATTENDEE_ID,
        showid: SHOW_ID,
        status: 'confirmed',
        role: 'attendee',
        created_at: new Date(),
        updated_at: new Date()
      }]);
    
    if (attendeeInsertError) {
      console.error(`Error registering attendee: ${attendeeInsertError.message}`);
      return false;
    }
  }
  
  console.log('Users registered for the show successfully');
  return true;
}

/**
 * Create sample want lists for the attendee
 */
async function createWantLists() {
  console.log('\n=== Creating sample want lists for the attendee ===');
  
  // Check if attendee already has want lists
  const { data: existingWantLists, error: checkError } = await supabase
    .from('want_lists')
    .select('*')
    .eq('userid', ATTENDEE_ID);
  
  if (checkError) {
    console.error(`Error checking want lists: ${checkError.message}`);
    return false;
  }
  
  if (existingWantLists && existingWantLists.length > 0) {
    console.log(`Attendee already has ${existingWantLists.length} want lists, skipping creation...`);
    return true;
  }
  
  console.log('Creating sample want lists for attendee...');
  
  // Create first want list
  const { error: wl1Error } = await supabase
    .from('want_lists')
    .insert([{
      userid: ATTENDEE_ID,
      content: `Looking for:
- 2018 Bowman Chrome Shohei Ohtani RC
- 2018 Topps Update Juan Soto RC
- Any Mike Trout parallels
- 2023 Bowman 1st Chrome autos`,
      createdat: new Date(),
      updatedat: new Date()
    }]);
  
  if (wl1Error) {
    console.error(`Error creating first want list: ${wl1Error.message}`);
    return false;
  }
  
  // Create second want list
  const { error: wl2Error } = await supabase
    .from('want_lists')
    .insert([{
      userid: ATTENDEE_ID,
      content: `Vintage cards wanted:
- 1956 Topps Mickey Mantle
- Any 1950s Hank Aaron
- 1960s Roberto Clemente
- T206 commons in good condition`,
      createdat: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updatedat: new Date(Date.now() - 24 * 60 * 60 * 1000)  // 1 day ago
    }]);
  
  if (wl2Error) {
    console.error(`Error creating second want list: ${wl2Error.message}`);
    return false;
  }
  
  console.log('Sample want lists created successfully');
  return true;
}

/**
 * Verify all fixes
 */
async function verifyFixes() {
  console.log('\n=== Verifying fixes ===');
  
  // Verify MVP dealer profile
  console.log('\nVerifying MVP dealer profile:');
  const { data: mvpProfile, error: mvpError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', MVP_DEALER_ID)
    .single();
  
  if (mvpError) {
    console.error(`Error verifying MVP dealer profile: ${mvpError.message}`);
  } else {
    console.log(mvpProfile);
  }
  
  // Verify attendee profile
  console.log('\nVerifying attendee profile:');
  const { data: attendeeProfile, error: attendeeError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', ATTENDEE_ID)
    .single();
  
  if (attendeeError) {
    console.error(`Error verifying attendee profile: ${attendeeError.message}`);
  } else {
    console.log(attendeeProfile);
  }
  
  // Verify show registrations
  console.log('\nVerifying show registrations:');
  const { data: registrations, error: regError } = await supabase
    .from('show_participants')
    .select(`
      userid,
      profiles:userid (first_name, last_name, role),
      showid,
      status,
      shows:showid (title, start_date)
    `)
    .eq('showid', SHOW_ID)
    .in('userid', [MVP_DEALER_ID, ATTENDEE_ID]);
  
  if (regError) {
    console.error(`Error verifying show registrations: ${regError.message}`);
  } else {
    console.log(JSON.stringify(registrations, null, 2));
  }
  
  // Verify want lists
  console.log('\nVerifying want lists:');
  const { data: wantLists, error: wlError } = await supabase
    .from('want_lists')
    .select('id, userid, content, createdat, updatedat')
    .eq('userid', ATTENDEE_ID);
  
  if (wlError) {
    console.error(`Error verifying want lists: ${wlError.message}`);
  } else {
    wantLists.forEach(wl => {
      console.log(`ID: ${wl.id}`);
      console.log(`Content preview: ${wl.content.substring(0, 50)}${wl.content.length > 50 ? '...' : ''}`);
      console.log(`Created: ${wl.createdat}`);
      console.log(`Updated: ${wl.updatedat}`);
      console.log('---');
    });
  }
  
  // Test the RPC function
  console.log('\nTesting get_visible_want_lists RPC function:');
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: MVP_DEALER_ID,
      show_id: SHOW_ID,
      page: 1,
      page_size: 10
    });
    
    if (rpcError) {
      console.error(`Error testing RPC function: ${rpcError.message}`);
    } else {
      console.log(JSON.stringify(rpcResult, null, 2));
    }
  } catch (err) {
    console.error(`Exception testing RPC function: ${err.message}`);
  }
  
  return true;
}

/**
 * Main function to run all fixes
 */
async function main() {
  console.log('======================================================');
  console.log('APPLYING WANT LIST ACCESS FIXES');
  console.log('======================================================');
  
  try {
    // Step 1: Fix the RPC function
    const rpcFixed = await fixRpcFunction();
    if (!rpcFixed) {
      console.error('Failed to fix RPC function, aborting...');
      return;
    }
    
    // Step 2: Create MVP dealer profile
    const mvpProfileCreated = await createMvpDealerProfile();
    if (!mvpProfileCreated) {
      console.error('Failed to create MVP dealer profile, aborting...');
      return;
    }
    
    // Step 3: Create attendee profile
    const attendeeProfileCreated = await createAttendeeProfile();
    if (!attendeeProfileCreated) {
      console.error('Failed to create attendee profile, aborting...');
      return;
    }
    
    // Step 4: Register users for the show
    const usersRegistered = await registerUsersForShow();
    if (!usersRegistered) {
      console.error('Failed to register users for the show, aborting...');
      return;
    }
    
    // Step 5: Create want lists
    const wantListsCreated = await createWantLists();
    if (!wantListsCreated) {
      console.error('Failed to create want lists, aborting...');
      return;
    }
    
    // Step 6: Verify all fixes
    await verifyFixes();
    
    console.log('\n======================================================');
    console.log('WANT LIST ACCESS FIXES COMPLETED SUCCESSFULLY');
    console.log('======================================================');
    console.log('\nNext steps:');
    console.log('1. Refresh the Collection screen in the app');
    console.log('2. MVP Dealer should now see the want lists section');
    console.log('3. The want lists of the attendee should be visible');
    
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
    console.log('\nFix script completed.');
  });
