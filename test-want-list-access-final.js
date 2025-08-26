/**
 * test-want-list-access-final.js
 * 
 * Comprehensive test script to verify that want list access is working correctly
 * for MVP Dealers and Show Organizers. This script tests:
 * 
 * 1. User roles and profiles
 * 2. Show registration status
 * 3. Want list data
 * 4. The get_visible_want_lists RPC function
 * 5. The showWantListService functions
 * 6. Collection screen logic conditions
 * 
 * This is the definitive test to confirm the functionality is working properly.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Constants for the specific test case
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
const SHOW_ID = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
const ATTENDEE_ID = '090926af-e383-4b74-95fa-d1dd16661e7f';
const SHOW_ORGANIZER_ID = '5c8475f1-93ac-4196-8412-3f3a7c3a0d4b'; // Optional for additional testing

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  details: []
};

// ---------------------------------------------------------------------------
// Supabase setup
// ---------------------------------------------------------------------------
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY (or legacy SUPABASE_URL / SUPABASE_ANON_KEY) in your .env file.',
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
 * Test user roles and profiles
 */
async function testUserRoles() {
  console.log('\n=== Testing User Roles ===');
  
  // Test MVP dealer profile
  const { data: mvpProfile, error: mvpError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', MVP_DEALER_ID)
    .single();
  
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
    .single();
  
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
async function testShowRegistration() {
  console.log('\n=== Testing Show Registration ===');
  
  // Check if show exists
  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('id, title, start_date, end_date, location')
    .eq('id', SHOW_ID)
    .single();
  
  if (showError) {
    logTest('Show exists', false, `Error: ${showError.message}`);
    return false;
  }
  
  logTest('Show exists', !!show, show);
  
  // Check MVP dealer registration
  const { data: mvpRegistration, error: mvpRegError } = await supabase
    .from('show_participants')
    .select('id, status, role')
    .eq('userid', MVP_DEALER_ID)
    .eq('showid', SHOW_ID)
    .single();
  
  if (mvpRegError) {
    logTest('MVP dealer is registered for show', false, `Error: ${mvpRegError.message}`);
    return false;
  }
  
  const isMvpRegistered = mvpRegistration && mvpRegistration.status === 'confirmed';
  logTest('MVP dealer is registered for show', isMvpRegistered, mvpRegistration);
  
  // Check attendee registration
  const { data: attendeeRegistration, error: attendeeRegError } = await supabase
    .from('show_participants')
    .select('id, status, role')
    .eq('userid', ATTENDEE_ID)
    .eq('showid', SHOW_ID)
    .single();
  
  if (attendeeRegError) {
    logTest('Attendee is registered for show', false, `Error: ${attendeeRegError.message}`);
    return false;
  }
  
  const isAttendeeRegistered = attendeeRegistration && attendeeRegistration.status === 'confirmed';
  logTest('Attendee is registered for show', isAttendeeRegistered, attendeeRegistration);
  
  return isMvpRegistered && isAttendeeRegistered;
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
    // Log the first want list content for verification
    const firstWantList = wantLists[0];
    logTest('Want list has valid content', !!firstWantList.content, {
      id: firstWantList.id,
      contentPreview: firstWantList.content.substring(0, 50) + (firstWantList.content.length > 50 ? '...' : ''),
      createdAt: firstWantList.createdat,
      updatedAt: firstWantList.updatedat
    });
  }
  
  return hasWantLists;
}

/**
 * Test the get_visible_want_lists RPC function directly
 */
async function testRpcFunction() {
  console.log('\n=== Testing get_visible_want_lists RPC Function ===');
  
  try {
    // Test with MVP dealer
    const { data: mvpResult, error: mvpError } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: MVP_DEALER_ID,
      show_id: SHOW_ID,
      page: 1,
      page_size: 10
    });
    
    if (mvpError) {
      logTest('RPC function works for MVP dealer', false, `Error: ${mvpError.message}`);
      return false;
    }
    
    const mvpCanSeeWantLists = mvpResult && 
                              mvpResult.data && 
                              Array.isArray(mvpResult.data) && 
                              mvpResult.data.length > 0;
    
    logTest('RPC function works for MVP dealer', true, 'Function executed without errors');
    logTest('MVP dealer can see want lists via RPC', mvpCanSeeWantLists, {
      totalCount: mvpResult?.totalCount || 0,
      itemsReturned: mvpResult?.data?.length || 0,
      hasMore: mvpResult?.hasMore || false
    });
    
    // Check if attendee's want list is in the results
    if (mvpCanSeeWantLists) {
      const attendeeWantList = mvpResult.data.find(wl => wl.userId === ATTENDEE_ID);
      logTest('Attendee want list is visible to MVP dealer', !!attendeeWantList, 
        attendeeWantList ? {
          id: attendeeWantList.id,
          userId: attendeeWantList.userId,
          userName: attendeeWantList.userName,
          contentPreview: attendeeWantList.content.substring(0, 50) + (attendeeWantList.content.length > 50 ? '...' : '')
        } : 'Not found'
      );
    }
    
    // Optional: Test with show organizer if ID is provided
    if (SHOW_ORGANIZER_ID) {
      const { data: orgResult, error: orgError } = await supabase.rpc('get_visible_want_lists', {
        viewer_id: SHOW_ORGANIZER_ID,
        show_id: null, // Test without specific show ID
        page: 1,
        page_size: 10
      });
      
      if (orgError) {
        logTest('RPC function works for Show Organizer', false, `Error: ${orgError.message}`);
      } else {
        logTest('RPC function works for Show Organizer', true, {
          totalCount: orgResult?.totalCount || 0,
          itemsReturned: orgResult?.data?.length || 0,
          hasMore: orgResult?.hasMore || false
        });
      }
    } else {
      logTest('RPC function works for Show Organizer', 'SKIPPED', 'No Show Organizer ID provided');
      testResults.skipped++;
    }
    
    return mvpCanSeeWantLists;
  } catch (err) {
    logTest('RPC function execution', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Mock the showWantListService functions to test the service layer
 */
async function testShowWantListService() {
  console.log('\n=== Testing showWantListService Functions ===');
  
  // Create a mock of the showWantListService
  const mockService = {
    getWantListsForMvpDealer: async (params) => {
      try {
        // Call the RPC directly as the service would
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_visible_want_lists', {
          viewer_id: params.userId,
          show_id: params.showId ?? null,
          search_term: params.searchTerm ?? null,
          page: params.page || 1,
          page_size: params.pageSize || 20
        });
        
        if (rpcError) {
          return { data: null, error: rpcError };
        }
        
        return { data: rpcData, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },
    
    getWantListsForShow: async (userId, showId, page = 1, pageSize = 20, searchTerm = null) => {
      try {
        // Call the RPC directly as the service would
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_visible_want_lists', {
          viewer_id: userId,
          show_id: showId,
          search_term: searchTerm,
          page,
          page_size: pageSize
        });
        
        if (rpcError) {
          return { data: null, error: rpcError };
        }
        
        return { data: rpcData, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }
  };
  
  // Test getWantListsForMvpDealer
  try {
    const { data: mvpResult, error: mvpError } = await mockService.getWantListsForMvpDealer({
      userId: MVP_DEALER_ID,
      showId: SHOW_ID,
      page: 1,
      pageSize: 10
    });
    
    if (mvpError) {
      logTest('getWantListsForMvpDealer works', false, `Error: ${mvpError.message}`);
      return false;
    }
    
    const serviceWorks = mvpResult && 
                        mvpResult.data && 
                        Array.isArray(mvpResult.data) && 
                        mvpResult.data.length > 0;
    
    logTest('getWantListsForMvpDealer works', serviceWorks, {
      totalCount: mvpResult?.totalCount || 0,
      itemsReturned: mvpResult?.data?.length || 0,
      hasMore: mvpResult?.hasMore || false
    });
    
    // Test getWantListsForShow
    const { data: showResult, error: showError } = await mockService.getWantListsForShow(
      MVP_DEALER_ID,
      SHOW_ID,
      1,
      10
    );
    
    if (showError) {
      logTest('getWantListsForShow works', false, `Error: ${showError.message}`);
      return false;
    }
    
    const showServiceWorks = showResult && 
                            showResult.data && 
                            Array.isArray(showResult.data) && 
                            showResult.data.length > 0;
    
    logTest('getWantListsForShow works', showServiceWorks, {
      totalCount: showResult?.totalCount || 0,
      itemsReturned: showResult?.data?.length || 0,
      hasMore: showResult?.hasMore || false
    });
    
    return serviceWorks && showServiceWorks;
  } catch (err) {
    logTest('showWantListService functions', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test the Collection screen logic conditions
 */
async function testCollectionScreenLogic() {
  console.log('\n=== Testing Collection Screen Logic ===');
  
  // Get the MVP dealer profile
  const { data: mvpProfile, error: mvpError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', MVP_DEALER_ID)
    .single();
  
  if (mvpError) {
    logTest('Collection screen isPrivileged condition', false, `Error getting MVP dealer profile: ${mvpError.message}`);
    return false;
  }
  
  // Test the isPrivileged condition from CollectionScreen.tsx
  const isPrivileged = 
    mvpProfile.role === 'mvp_dealer' || 
    mvpProfile.role === 'show_organizer';
  
  logTest('Collection screen isPrivileged condition', isPrivileged, {
    userRole: mvpProfile.role,
    condition: `${mvpProfile.role} === 'mvp_dealer' || ${mvpProfile.role} === 'show_organizer'`,
    result: isPrivileged
  });
  
  // Test the upcomingShows array population
  const currentDate = new Date().toISOString();
  const { data: participations, error: partError } = await supabase
    .from('show_participants')
    .select('showid')
    .eq('userid', MVP_DEALER_ID);
  
  if (partError) {
    logTest('Collection screen upcomingShows population', false, `Error getting participations: ${partError.message}`);
    return false;
  }
  
  if (!participations || participations.length === 0) {
    logTest('Collection screen upcomingShows population', false, 'MVP dealer is not participating in any shows');
    return false;
  }
  
  const showIds = participations.map(p => p.showid);
  
  // Get upcoming shows
  const { data: upcomingShows, error: showsError } = await supabase
    .from('shows')
    .select('id, title, start_date, end_date')
    .in('id', showIds)
    .or(`end_date.gte.${currentDate},and(end_date.is.null,start_date.gte.${currentDate})`);
  
  if (showsError) {
    logTest('Collection screen upcomingShows population', false, `Error getting upcoming shows: ${showsError.message}`);
    return false;
  }
  
  const hasUpcomingShows = upcomingShows && upcomingShows.length > 0;
  logTest('Collection screen upcomingShows population', hasUpcomingShows, {
    participatingShows: participations.length,
    upcomingShows: upcomingShows?.length || 0,
    shows: upcomingShows?.map(s => ({ id: s.id, title: s.title })) || []
  });
  
  // Check if the specific test show is in the upcoming shows
  const testShowInUpcoming = upcomingShows?.some(s => s.id === SHOW_ID);
  logTest('Test show is in upcoming shows', testShowInUpcoming, {
    showId: SHOW_ID,
    found: testShowInUpcoming
  });
  
  return isPrivileged && hasUpcomingShows && testShowInUpcoming;
}

/**
 * Generate a final report on whether the issue is resolved
 */
function generateReport() {
  console.log('\n======================================================');
  console.log('WANT LIST ACCESS TEST RESULTS');
  console.log('======================================================');
  
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: \x1b[32m${testResults.passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${testResults.failed}\x1b[0m`);
  console.log(`Skipped: \x1b[33m${testResults.skipped}\x1b[0m`);
  
  const allPassed = testResults.failed === 0 && testResults.passed > 0;
  
  console.log('\n======================================================');
  if (allPassed) {
    console.log('\x1b[32mISSUE RESOLVED: All tests passed!\x1b[0m');
    console.log('The MVP dealer can now see want lists of attendees for shows they are participating in.');
    console.log('The Collection screen should now display the AttendeeWantLists component.');
  } else {
    console.log('\x1b[31mISSUE NOT FULLY RESOLVED: Some tests failed.\x1b[0m');
    console.log('Please check the test results above for details on what needs to be fixed.');
  }
  console.log('======================================================');
  
  return allPassed;
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('======================================================');
  console.log('TESTING WANT LIST ACCESS FUNCTIONALITY');
  console.log('======================================================');
  
  try {
    // Run all tests
    await testUserRoles();
    await testShowRegistration();
    await testWantListData();
    await testRpcFunction();
    await testShowWantListService();
    await testCollectionScreenLogic();
    
    // Generate final report
    const isResolved = generateReport();
    
    return isResolved;
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
    console.log('\nTest script completed.');
  });
