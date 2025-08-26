/**
 * test-rpc-after-fix.js
 * 
 * This script tests if the get_visible_want_lists RPC function is working
 * after applying the SQL fix and debugs why the AttendeeWantLists component
 * isn't showing in the Collection screen.
 * 
 * It specifically checks:
 * 1. If the RPC function returns data for the MVP dealer
 * 2. If the Collection screen logic conditions are met
 * 3. If there are upcoming shows for the MVP dealer
 * 4. If the isPrivileged condition is working
 * 5. The specific issue preventing the want lists section from appearing
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Constants - using exact MVP dealer ID from logs
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
 * Test 1: Test the RPC function directly
 */
async function testRpcFunction() {
  console.log('\n=== Testing RPC Function ===');
  
  try {
    console.log(`Testing with MVP dealer ID: ${MVP_DEALER_ID}`);
    
    // Call the RPC function directly
    const { data, error } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: MVP_DEALER_ID,
      show_id: SHOW_ID,
      page: 1,
      page_size: 10
    });
    
    if (error) {
      if (error.message.includes('does not exist')) {
        logTest('RPC function exists', false, 'Function does not exist');
      } else if (error.message.includes('relation "base" does not exist')) {
        logTest('RPC function fixed', false, 'Function still has the CTE issue');
      } else {
        logTest('RPC function execution', false, `Error: ${error.message}`);
      }
      return false;
    }
    
    logTest('RPC function exists', true, 'Function exists and executes without errors');
    
    // Check if the function returns data
    const hasData = data && data.data && Array.isArray(data.data) && data.data.length > 0;
    logTest('RPC function returns data', hasData, {
      totalCount: data?.totalCount || 0,
      itemsReturned: data?.data?.length || 0,
      hasMore: data?.hasMore || false
    });
    
    if (hasData) {
      // Log the first want list for verification
      const firstWantList = data.data[0];
      logTest('Want list data is valid', true, {
        id: firstWantList.id,
        userId: firstWantList.userId,
        userName: firstWantList.userName,
        userRole: firstWantList.userRole,
        showTitle: firstWantList.showTitle,
        contentPreview: firstWantList.content.substring(0, 50) + (firstWantList.content.length > 50 ? '...' : '')
      });
      
      // Check if attendee's want list is in the results
      const attendeeWantList = data.data.find(wl => wl.userId === ATTENDEE_ID);
      logTest('Attendee want list is visible', !!attendeeWantList, 
        attendeeWantList ? {
          id: attendeeWantList.id,
          userName: attendeeWantList.userName,
          userRole: attendeeWantList.userRole,
          contentPreview: attendeeWantList.content.substring(0, 50) + (attendeeWantList.content.length > 50 ? '...' : '')
        } : 'Not found'
      );
    }
    
    return hasData;
  } catch (err) {
    logTest('RPC function test', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 2: Check Collection screen logic conditions
 */
async function testCollectionScreenLogic() {
  console.log('\n=== Testing Collection Screen Logic ===');
  
  try {
    // Get the MVP dealer profile
    const { data: mvpProfile, error: mvpError } = await supabase
      .from('profiles')
      .select('role, account_type, subscription_status')
      .eq('id', MVP_DEALER_ID)
      .maybeSingle();
    
    if (mvpError) {
      logTest('Get MVP dealer profile', false, `Error: ${mvpError.message}`);
      return false;
    }
    
    logTest('Get MVP dealer profile', !!mvpProfile, mvpProfile);
    
    // Check the isPrivileged condition
    // From CollectionScreen.tsx: const isPrivileged = role === 'mvp_dealer' || role === 'show_organizer';
    const isPrivileged = mvpProfile && (
      mvpProfile.role === 'mvp_dealer' || 
      mvpProfile.role === 'show_organizer'
    );
    
    logTest('isPrivileged condition', isPrivileged, {
      role: mvpProfile?.role,
      condition: `${mvpProfile?.role} === 'mvp_dealer' || ${mvpProfile?.role} === 'show_organizer'`,
      result: isPrivileged
    });
    
    // Check if there are upcoming shows
    const currentDate = new Date().toISOString();
    
    // Get show participations for the MVP dealer
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', MVP_DEALER_ID)
      .in('status', ['registered', 'confirmed']);
    
    if (partError) {
      logTest('Get show participations', false, `Error: ${partError.message}`);
      return false;
    }
    
    logTest('Get show participations', !!participations && participations.length > 0, {
      count: participations?.length || 0,
      participations: participations || []
    });
    
    if (!participations || participations.length === 0) {
      return false;
    }
    
    const showIds = participations.map(p => p.showid);
    
    // Get upcoming shows
    const { data: upcomingShows, error: showsError } = await supabase
      .from('shows')
      .select('id, title, start_date, end_date, location')
      .in('id', showIds)
      .or(`end_date.gte.${currentDate},and(end_date.is.null,start_date.gte.${currentDate})`);
    
    if (showsError) {
      logTest('Get upcoming shows', false, `Error: ${showsError.message}`);
      return false;
    }
    
    const hasUpcomingShows = upcomingShows && upcomingShows.length > 0;
    logTest('Has upcoming shows', hasUpcomingShows, {
      count: upcomingShows?.length || 0,
      shows: upcomingShows?.map(s => ({ id: s.id, title: s.title, startDate: s.start_date })) || []
    });
    
    // Check if the specific test show is in the upcoming shows
    const testShowInUpcoming = upcomingShows?.some(s => s.id === SHOW_ID);
    logTest('Test show is upcoming', testShowInUpcoming, {
      showId: SHOW_ID,
      found: testShowInUpcoming
    });
    
    // Debug the specific component rendering condition from CollectionScreen.tsx
    // The condition is typically: isPrivileged && upcomingShows.length > 0
    const shouldRenderComponent = isPrivileged && hasUpcomingShows;
    logTest('Should render AttendeeWantLists component', shouldRenderComponent, {
      isPrivileged: isPrivileged,
      hasUpcomingShows: hasUpcomingShows,
      condition: `${isPrivileged} && ${hasUpcomingShows}`,
      result: shouldRenderComponent
    });
    
    return shouldRenderComponent;
  } catch (err) {
    logTest('Collection screen logic test', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 3: Debug the component import and rendering in CollectionScreen.tsx
 */
async function debugComponentRendering() {
  console.log('\n=== Debugging Component Rendering ===');
  
  try {
    // Check if the AttendeeWantLists component is imported in CollectionScreen.tsx
    console.log('Checking CollectionScreen.tsx for AttendeeWantLists import and rendering...');
    console.log('This requires manual inspection of the code.');
    
    // Check if the showWantListService is properly imported and used
    console.log('\nChecking showWantListService usage...');
    
    // Simulate the service call that would happen in the component
    const { data: wantListsData, error: wlError } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: MVP_DEALER_ID,
      show_id: null, // null to get all shows
      page: 1,
      page_size: 20
    });
    
    if (wlError) {
      logTest('showWantListService call simulation', false, `Error: ${wlError.message}`);
      return false;
    }
    
    const hasWantListData = wantListsData && 
                           wantListsData.data && 
                           Array.isArray(wantListsData.data) && 
                           wantListsData.data.length > 0;
    
    logTest('showWantListService returns data', hasWantListData, {
      totalCount: wantListsData?.totalCount || 0,
      itemsReturned: wantListsData?.data?.length || 0,
      hasMore: wantListsData?.hasMore || false
    });
    
    // Check for console logs in the app that might indicate why the component isn't rendering
    console.log('\nChecking for console logs in the app...');
    console.log('Look for logs related to AttendeeWantLists, isPrivileged, or upcomingShows in the app console.');
    
    // Check if the component is conditionally rendered but hidden by CSS
    console.log('\nChecking if the component is rendered but hidden...');
    console.log('Inspect the DOM in the app to see if the component exists but is hidden by CSS.');
    
    return hasWantListData;
  } catch (err) {
    logTest('Component rendering debug', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 4: Check if the component is imported and rendered in CollectionScreen.tsx
 */
async function checkComponentImplementation() {
  console.log('\n=== Checking Component Implementation ===');
  
  try {
    // This is a manual check that requires looking at the code
    console.log('Please check CollectionScreen.tsx for the following:');
    console.log('1. Import statement: import { AttendeeWantLists } from "../components/AttendeeWantLists";');
    console.log('2. Rendering condition: {isPrivileged && upcomingShows.length > 0 && <AttendeeWantLists />}');
    
    // Check if the component props are correctly passed
    console.log('\nCheck if the component props are correctly passed:');
    console.log('<AttendeeWantLists userId={user?.id} showIds={upcomingShows.map(show => show.id)} />');
    
    // Check if the component is imported but not used
    console.log('\nCheck if the component is imported but not used in the render method.');
    
    // Check if there are any conditional flags preventing rendering
    console.log('\nCheck for any feature flags or conditional rendering logic:');
    console.log('Example: {isPrivileged && upcomingShows.length > 0 && !isFeatureDisabled && <AttendeeWantLists />}');
    
    return true;
  } catch (err) {
    logTest('Component implementation check', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Generate a final report on the issue
 */
function generateReport() {
  console.log('\n======================================================');
  console.log('RPC FUNCTION AND COMPONENT RENDERING TEST RESULTS');
  console.log('======================================================');
  
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: \x1b[32m${testResults.passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${testResults.failed}\x1b[0m`);
  
  const allPassed = testResults.failed === 0 && testResults.passed > 0;
  
  console.log('\n======================================================');
  if (allPassed) {
    console.log('\x1b[32mRPC FUNCTION IS WORKING CORRECTLY\x1b[0m');
    console.log('The issue is likely with the component implementation or rendering condition.');
  } else {
    console.log('\x1b[31mISSUES DETECTED\x1b[0m');
    console.log('Please check the test results above for details on what needs to be fixed.');
  }
  console.log('======================================================');
  
  // Provide specific recommendations based on test results
  console.log('\nRecommendations:');
  
  if (testResults.details.some(d => d.name === 'RPC function exists' && d.status === 'FAIL')) {
    console.log('1. The RPC function does not exist. Apply the SQL fix again.');
  } else if (testResults.details.some(d => d.name === 'RPC function returns data' && d.status === 'FAIL')) {
    console.log('1. The RPC function exists but returns no data. Check the function logic and data conditions.');
  } else if (testResults.details.some(d => d.name === 'Should render AttendeeWantLists component' && d.status === 'FAIL')) {
    console.log('1. The rendering conditions are not met. Check isPrivileged and upcomingShows in the Collection screen.');
  } else {
    console.log('1. Check if the AttendeeWantLists component is properly imported and rendered in CollectionScreen.tsx');
    console.log('2. Verify the component is receiving the correct props (userId and showIds)');
    console.log('3. Look for any conditional logic or feature flags that might be preventing rendering');
    console.log('4. Check the app console for any errors related to the component');
  }
  
  return allPassed;
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('======================================================');
  console.log('TESTING RPC FUNCTION AND COMPONENT RENDERING');
  console.log('======================================================');
  console.log(`MVP Dealer ID: ${MVP_DEALER_ID}`);
  console.log(`Show ID: ${SHOW_ID}`);
  console.log(`Attendee ID: ${ATTENDEE_ID}`);
  console.log('======================================================');
  
  try {
    // Run all tests
    const rpcWorks = await testRpcFunction();
    const logicWorks = await testCollectionScreenLogic();
    await debugComponentRendering();
    await checkComponentImplementation();
    
    // Generate final report
    generateReport();
    
    return rpcWorks && logicWorks;
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
    console.log('\nRPC function and component rendering test completed.');
  });
