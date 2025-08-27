/**
 * test-direct-queries.js
 * 
 * This script bypasses the RPC function and tests want list visibility
 * using direct Supabase queries. It implements the same logic as the
 * get_visible_want_lists RPC function but in JavaScript.
 * 
 * Purpose:
 * - Verify that the data is correct and accessible
 * - Confirm the logic works before fixing the RPC function
 * - Demonstrate what data should be returned when the RPC is fixed
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Constants for the specific test case
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
const SHOW_ID = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
const ATTENDEE_ID = '090926af-e383-4b74-95fa-d1dd16661e7f';

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// ---------------------------------------------------------------------------
// Supabase setup
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
 * Helper function to log test results
 */
function logTest(name, result, details = null) {
  const status = result ? 'PASS' : 'FAIL';
  const color = result ? '\x1b[32m' : '\x1b[31m'; // Green for pass, red for fail
  console.log(`${color}[${status}]\x1b[0m ${name}`);
  
  if (details) {
    if (typeof details === 'object') {
      console.log(JSON.stringify(details, null, 2));
    } else {
      console.log(details);
    }
  }
  
  testResults.total++;
  if (result) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  testResults.details.push({
    name,
    status,
    details
  });
  
  return result;
}

/**
 * Test user profiles and roles
 */
async function testUserProfiles() {
  console.log('\n=== Testing User Profiles ===');
  
  // Test MVP dealer profile
  const { data: mvpProfile, error: mvpError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', MVP_DEALER_ID)
    .maybeSingle();
  
  if (mvpError) {
    logTest('MVP dealer profile exists', false, `Error: ${mvpError.message}`);
    return false;
  }
  
  const isMvpDealer = mvpProfile && mvpProfile.role === 'mvp_dealer';
  logTest('MVP dealer profile exists', !!mvpProfile, mvpProfile);
  logTest('MVP dealer has correct role', isMvpDealer, `Role: ${mvpProfile?.role}`);
  
  // Test attendee profile
  const { data: attendeeProfile, error: attendeeError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', ATTENDEE_ID)
    .maybeSingle();
  
  if (attendeeError) {
    logTest('Attendee profile exists', false, `Error: ${attendeeError.message}`);
    return false;
  }
  
  const isAttendee = attendeeProfile && attendeeProfile.role === 'attendee';
  logTest('Attendee profile exists', !!attendeeProfile, attendeeProfile);
  logTest('Attendee has correct role', isAttendee, `Role: ${attendeeProfile?.role}`);
  
  return isMvpDealer && isAttendee;
}

/**
 * Test show registration status
 */
async function testShowRegistrations() {
  console.log('\n=== Testing Show Registrations ===');
  
  // Check if show exists
  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('id, title, start_date, end_date, location')
    .eq('id', SHOW_ID)
    .maybeSingle();
  
  if (showError) {
    logTest('Show exists', false, `Error: ${showError.message}`);
    return false;
  }
  
  logTest('Show exists', !!show, show);
  
  // Check if show is upcoming/ongoing
  const now = new Date();
  const isUpcoming = show && (
    (show.end_date && new Date(show.end_date) >= now) || 
    (!show.end_date && show.start_date && new Date(show.start_date) >= now)
  );
  
  logTest('Show is upcoming/ongoing', isUpcoming, {
    now: now.toISOString(),
    startDate: show?.start_date,
    endDate: show?.end_date
  });
  
  // Check MVP dealer registration
  const { data: mvpRegistrations, error: mvpRegError } = await supabase
    .from('show_participants')
    .select('id, status, role')
    .eq('userid', MVP_DEALER_ID)
    .eq('showid', SHOW_ID);
  
  if (mvpRegError) {
    logTest('MVP dealer is registered for show', false, `Error: ${mvpRegError.message}`);
    return false;
  }
  
  const mvpRegistration = mvpRegistrations && mvpRegistrations.length > 0 ? mvpRegistrations[0] : null;
  const isMvpRegistered = mvpRegistration && ['registered', 'confirmed'].includes(mvpRegistration.status);
  logTest('MVP dealer is registered for show', isMvpRegistered, mvpRegistration);
  
  // Check attendee registration
  const { data: attendeeRegistrations, error: attendeeRegError } = await supabase
    .from('show_participants')
    .select('id, status, role')
    .eq('userid', ATTENDEE_ID)
    .eq('showid', SHOW_ID);
  
  if (attendeeRegError) {
    logTest('Attendee is registered for show', false, `Error: ${attendeeRegError.message}`);
    return false;
  }
  
  const attendeeRegistration = attendeeRegistrations && attendeeRegistrations.length > 0 ? attendeeRegistrations[0] : null;
  const isAttendeeRegistered = attendeeRegistration && ['registered', 'confirmed'].includes(attendeeRegistration.status);
  logTest('Attendee is registered for show', isAttendeeRegistered, attendeeRegistration);
  
  return isUpcoming && isMvpRegistered && isAttendeeRegistered;
}

/**
 * Test want list data
 */
async function testWantListData() {
  console.log('\n=== Testing Want List Data ===');
  
  // Check if attendee has want lists
  const { data: wantLists, error: wlError } = await supabase
    .from('want_lists')
    .select('id, content, createdat, updatedat')
    .eq('userid', ATTENDEE_ID);
  
  if (wlError) {
    logTest('Attendee has want lists', false, `Error: ${wlError.message}`);
    return false;
  }
  
  const hasWantLists = wantLists && wantLists.length > 0;
  logTest('Attendee has want lists', hasWantLists, `Found ${wantLists?.length || 0} want lists`);
  
  if (hasWantLists) {
    // Check if want lists have valid content
    const validWantLists = wantLists.filter(wl => 
      wl.content && 
      wl.content.trim() !== '' && 
      !wl.content.toUpperCase().startsWith('[INVENTORY]')
    );
    
    logTest('Attendee has valid want lists', validWantLists.length > 0, 
      `Found ${validWantLists.length} valid want lists out of ${wantLists.length} total`);
    
    if (validWantLists.length > 0) {
      // Log the first valid want list for verification
      const firstWantList = validWantLists[0];
      logTest('Want list has valid content', true, {
        id: firstWantList.id,
        contentPreview: firstWantList.content.substring(0, 50) + (firstWantList.content.length > 50 ? '...' : ''),
        createdAt: firstWantList.createdat,
        updatedAt: firstWantList.updatedat
      });
    }
    
    return validWantLists.length > 0;
  }
  
  return false;
}

/**
 * Test direct query implementation of get_visible_want_lists logic
 */
async function testDirectQuery() {
  console.log('\n=== Testing Direct Query Implementation ===');
  
  try {
    // Step 1: Get the viewer's role
    const { data: viewerProfile, error: viewerError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', MVP_DEALER_ID)
      .maybeSingle();
    
    if (viewerError) {
      logTest('Get viewer role', false, `Error: ${viewerError.message}`);
      return false;
    }
    
    const viewerRole = viewerProfile?.role;
    logTest('Get viewer role', !!viewerRole, `Role: ${viewerRole}`);
    
    if (!viewerRole || !['mvp_dealer', 'show_organizer'].includes(viewerRole)) {
      logTest('Viewer has authorized role', false, `Unauthorized role: ${viewerRole}`);
      return false;
    }
    
    logTest('Viewer has authorized role', true, `Role: ${viewerRole}`);
    
    // Step 2: Get relevant shows - using simpler approach
    const now = new Date().toISOString();
    
    // For MVP dealers, get shows they are participating in
    let relevantShowsQuery = supabase.from('shows').select('id, title, start_date, location');
    
    // Add date filter for upcoming/ongoing shows
    relevantShowsQuery = relevantShowsQuery
      .or(`end_date.gte.${now},and(end_date.is.null,start_date.gte.${now})`);
    
    // Add filter for specific show if provided
    if (SHOW_ID) {
      relevantShowsQuery = relevantShowsQuery.eq('id', SHOW_ID);
    }
    
    const { data: potentialShows, error: potentialShowsError } = await relevantShowsQuery;
    
    if (potentialShowsError) {
      logTest('Get potential shows', false, `Error: ${potentialShowsError.message}`);
      return false;
    }
    
    // Now get the shows the MVP dealer is participating in
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', MVP_DEALER_ID)
      .in('status', ['registered', 'confirmed']);
    
    if (partError) {
      logTest('Get dealer participations', false, `Error: ${partError.message}`);
      return false;
    }
    
    // Filter shows to only those the dealer is participating in
    const participationShowIds = participations.map(p => p.showid);
    const relevantShows = potentialShows.filter(show => participationShowIds.includes(show.id));
    
    const hasRelevantShows = relevantShows && relevantShows.length > 0;
    logTest('Get relevant shows', hasRelevantShows, 
      `Found ${relevantShows?.length || 0} relevant shows`);
    
    if (!hasRelevantShows) {
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
      logTest('Get show participants', false, `Error: ${partListError.message}`);
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
      logTest('Get participant profiles', false, `Error: ${profilesError.message}`);
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
      logTest('Get want lists', false, `Error: ${wlError.message}`);
      return false;
    }
    
    const hasWantLists = wantLists && wantLists.length > 0;
    logTest('Get want lists', hasWantLists, 
      `Found ${wantLists?.length || 0} want lists`);
    
    if (!hasWantLists) {
      return false;
    }
    
    // Step 6: Format results as the RPC function would
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
    logTest('Attendee want list is visible to MVP dealer', !!attendeeWantList, 
      attendeeWantList ? {
        id: attendeeWantList.id,
        userId: attendeeWantList.userId,
        userName: attendeeWantList.userName,
        contentPreview: attendeeWantList.content.substring(0, 50) + (attendeeWantList.content.length > 50 ? '...' : '')
      } : 'Not found'
    );
    
    // Display the final results
    console.log('\nFormatted Results (First 3):');
    console.log(JSON.stringify(formattedResults.slice(0, 3), null, 2));
    
    return !!attendeeWantList;
  } catch (err) {
    logTest('Direct query implementation', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Generate a final report
 */
function generateReport() {
  console.log('\n======================================================');
  console.log('DIRECT QUERY TEST RESULTS');
  console.log('======================================================');
  
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: \x1b[32m${testResults.passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${testResults.failed}\x1b[0m`);
  
  const allPassed = testResults.failed === 0 && testResults.passed > 0;
  
  console.log('\n======================================================');
  if (allPassed) {
    console.log('\x1b[32mDATA LAYER IS WORKING CORRECTLY\x1b[0m');
    console.log('The issue is only with the RPC function, not with the data.');
    console.log('The SQL fix for the RPC function should resolve the issue.');
  } else {
    console.log('\x1b[31mDATA LAYER HAS ISSUES\x1b[0m');
    console.log('There are problems with the data or permissions that need to be fixed.');
    console.log('Please check the test results above for details.');
  }
  console.log('======================================================');
  
  return allPassed;
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('======================================================');
  console.log('TESTING WANT LIST ACCESS WITH DIRECT QUERIES');
  console.log('======================================================');
  
  try {
    // Run all tests
    await testUserProfiles();
    await testShowRegistrations();
    await testWantListData();
    await testDirectQuery();
    
    // Generate final report
    const dataLayerWorking = generateReport();
    
    if (dataLayerWorking) {
      console.log('\nNext steps:');
      console.log('1. Apply the SQL fix for the get_visible_want_lists RPC function');
      console.log('2. Use the Supabase dashboard to execute the SQL in fix-get-visible-want-lists.sql');
      console.log('3. Test the Collection screen in the app');
    } else {
      console.log('\nNext steps:');
      console.log('1. Fix the data issues identified above');
      console.log('2. Run this test again to verify the data layer is working');
      console.log('3. Then apply the SQL fix for the RPC function');
    }
    
    return dataLayerWorking;
  } catch (err) {
    console.error(`Unhandled error: ${err.message}`);
    return false;
  }
}

// Run the script
main()
  .catch(err => {
    console.error('Unhandled error:', err);
  })
  .finally(() => {
    console.log('\nDirect query test completed.');
  });
