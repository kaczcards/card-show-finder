/**
 * debug-collection-screen.js
 * 
 * Comprehensive debugging script to identify why the Collection screen isn't scrollable
 * and why the AttendeeWantLists component isn't showing.
 * 
 * This script:
 * 1. Tests if the corrected RPC function is working
 * 2. Checks if the AttendeeWantLists component is receiving the right props
 * 3. Tests the component's data loading logic
 * 4. Debugs layout and rendering issues
 * 5. Verifies scroll behavior and component height
 * 6. Checks for console errors preventing the component from rendering
 * 
 * Usage:
 * node debug-collection-screen.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
      } else if (error.message.includes('must appear in the GROUP BY clause')) {
        logTest('RPC function fixed', false, 'Function still has the GROUP BY issue');
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
 * Test 3: Analyze the AttendeeWantLists component
 */
async function analyzeAttendeeWantListsComponent() {
  console.log('\n=== Analyzing AttendeeWantLists Component ===');
  
  try {
    // Read the component file
    const componentPath = path.join(__dirname, 'src', 'components', 'AttendeeWantLists.tsx');
    
    if (!fs.existsSync(componentPath)) {
      logTest('AttendeeWantLists component exists', false, `File not found: ${componentPath}`);
      return false;
    }
    
    logTest('AttendeeWantLists component exists', true, `File found: ${componentPath}`);
    
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    
    // Check if the component imports the necessary hooks and services
    const hasImportUseEffect = componentContent.includes('useEffect');
    const hasImportUseState = componentContent.includes('useState');
    const hasImportShowWantListService = componentContent.includes('showWantListService');
    
    logTest('Component imports React hooks', hasImportUseEffect && hasImportUseState, {
      useEffect: hasImportUseEffect,
      useState: hasImportUseState
    });
    
    logTest('Component imports showWantListService', hasImportShowWantListService, {
      hasImport: hasImportShowWantListService
    });
    
    // Check if the component defines props correctly
    const hasPropsDefinition = componentContent.includes('interface') || 
                              componentContent.includes('type') || 
                              componentContent.includes('Props');
    
    logTest('Component defines props', hasPropsDefinition, {
      hasPropsDefinition: hasPropsDefinition
    });
    
    // Check if the component has the necessary state variables
    const hasWantListsState = componentContent.includes('wantLists') || 
                             componentContent.includes('attendeeWantLists');
    const hasLoadingState = componentContent.includes('loading') || 
                           componentContent.includes('isLoading');
    const hasErrorState = componentContent.includes('error');
    
    logTest('Component has necessary state', hasWantListsState && hasLoadingState, {
      hasWantListsState: hasWantListsState,
      hasLoadingState: hasLoadingState,
      hasErrorState: hasErrorState
    });
    
    // Check if the component calls the service
    const callsGetWantListsForMvpDealer = componentContent.includes('getWantListsForMvpDealer');
    const callsGetWantListsForShowOrganizer = componentContent.includes('getWantListsForShowOrganizer');
    const callsGetWantListsForShow = componentContent.includes('getWantListsForShow');
    
    logTest('Component calls want list service', 
      callsGetWantListsForMvpDealer || callsGetWantListsForShowOrganizer || callsGetWantListsForShow, {
        callsGetWantListsForMvpDealer: callsGetWantListsForMvpDealer,
        callsGetWantListsForShowOrganizer: callsGetWantListsForShowOrganizer,
        callsGetWantListsForShow: callsGetWantListsForShow
      }
    );
    
    // Check if the component renders a FlatList or ScrollView
    const usesFlatList = componentContent.includes('FlatList');
    const usesScrollView = componentContent.includes('ScrollView');
    
    logTest('Component uses scrollable container', usesFlatList || usesScrollView, {
      usesFlatList: usesFlatList,
      usesScrollView: usesScrollView
    });
    
    // Check for height or flex styling
    const hasHeightStyle = componentContent.includes('height:') || 
                          componentContent.includes('flex:');
    
    logTest('Component has height/flex styling', hasHeightStyle, {
      hasHeightStyle: hasHeightStyle
    });
    
    // Check for console logs that might help debugging
    const hasConsoleLog = componentContent.includes('console.log');
    
    logTest('Component has console logs', hasConsoleLog, {
      hasConsoleLog: hasConsoleLog
    });
    
    return true;
  } catch (err) {
    logTest('Component analysis', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 4: Check the showWantListService implementation
 */
async function checkShowWantListService() {
  console.log('\n=== Checking showWantListService Implementation ===');
  
  try {
    // Read the service file
    const servicePath = path.join(__dirname, 'src', 'services', 'showWantListService.ts');
    
    if (!fs.existsSync(servicePath)) {
      logTest('showWantListService exists', false, `File not found: ${servicePath}`);
      return false;
    }
    
    logTest('showWantListService exists', true, `File found: ${servicePath}`);
    
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    // Check if the service exports the necessary functions
    const exportsGetWantListsForMvpDealer = serviceContent.includes('export const getWantListsForMvpDealer');
    const exportsGetWantListsForShowOrganizer = serviceContent.includes('export const getWantListsForShowOrganizer');
    const exportsGetWantListsForShow = serviceContent.includes('export const getWantListsForShow');
    
    logTest('Service exports necessary functions', 
      exportsGetWantListsForMvpDealer || exportsGetWantListsForShowOrganizer || exportsGetWantListsForShow, {
        exportsGetWantListsForMvpDealer: exportsGetWantListsForMvpDealer,
        exportsGetWantListsForShowOrganizer: exportsGetWantListsForShowOrganizer,
        exportsGetWantListsForShow: exportsGetWantListsForShow
      }
    );
    
    // Check if the service calls the RPC function
    const callsRpcFunction = serviceContent.includes('get_visible_want_lists');
    
    logTest('Service calls RPC function', callsRpcFunction, {
      callsRpcFunction: callsRpcFunction
    });
    
    // Check if the service handles errors
    const handlesErrors = serviceContent.includes('error');
    
    logTest('Service handles errors', handlesErrors, {
      handlesErrors: handlesErrors
    });
    
    return true;
  } catch (err) {
    logTest('Service analysis', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 5: Debug layout and rendering issues
 */
async function debugLayoutAndRendering() {
  console.log('\n=== Debugging Layout and Rendering Issues ===');
  
  try {
    // Read the CollectionScreen.tsx file
    const screenPath = path.join(__dirname, 'src', 'screens', 'Collection', 'CollectionScreen.tsx');
    
    if (!fs.existsSync(screenPath)) {
      logTest('CollectionScreen exists', false, `File not found: ${screenPath}`);
      return false;
    }
    
    logTest('CollectionScreen exists', true, `File found: ${screenPath}`);
    
    const screenContent = fs.readFileSync(screenPath, 'utf8');
    
    // Check if the screen imports the AttendeeWantLists component
    const importsAttendeeWantLists = screenContent.includes('import AttendeeWantLists');
    
    logTest('Screen imports AttendeeWantLists', importsAttendeeWantLists, {
      importsAttendeeWantLists: importsAttendeeWantLists
    });
    
    // Check if the screen renders the AttendeeWantLists component
    const rendersAttendeeWantLists = screenContent.includes('<AttendeeWantLists');
    
    logTest('Screen renders AttendeeWantLists', rendersAttendeeWantLists, {
      rendersAttendeeWantLists: rendersAttendeeWantLists
    });
    
    // Check if the screen uses ScrollView or FlatList for scrolling
    const usesScrollView = screenContent.includes('ScrollView');
    const usesFlatList = screenContent.includes('FlatList');
    
    logTest('Screen uses scrollable container', usesScrollView || usesFlatList, {
      usesScrollView: usesScrollView,
      usesFlatList: usesFlatList
    });
    
    // Check if the screen has flex styling for the content
    const hasFlexStyling = screenContent.includes('flex: 1');
    
    logTest('Screen has flex styling', hasFlexStyling, {
      hasFlexStyling: hasFlexStyling
    });
    
    // Check if the screen has height styling for the content
    const hasHeightStyling = screenContent.includes('height:');
    
    logTest('Screen has height styling', hasHeightStyling, {
      hasHeightStyling: hasHeightStyling
    });
    
    // Check for any conditional rendering that might prevent the component from showing
    const hasConditionalRendering = screenContent.includes('isPrivileged') && 
                                  screenContent.includes('upcomingShows.length > 0');
    
    logTest('Screen has conditional rendering', hasConditionalRendering, {
      hasConditionalRendering: hasConditionalRendering
    });
    
    // Check for any feature flags or experimental flags
    const hasFeatureFlags = screenContent.includes('featureFlag') || 
                          screenContent.includes('experimental') ||
                          screenContent.includes('isEnabled');
    
    logTest('Screen has feature flags', hasFeatureFlags, {
      hasFeatureFlags: hasFeatureFlags
    });
    
    // Check for any database issue handling that might prevent rendering
    const hasDatabaseIssueHandling = screenContent.includes('hasDatabaseIssues');
    
    logTest('Screen has database issue handling', hasDatabaseIssueHandling, {
      hasDatabaseIssueHandling: hasDatabaseIssueHandling
    });
    
    // Extract the conditional rendering logic for the AttendeeWantLists component
    const renderingLogicMatch = screenContent.match(/\{([^{}]*AttendeeWantLists[^{}]*)\}/);
    const renderingLogic = renderingLogicMatch ? renderingLogicMatch[1].trim() : 'Not found';
    
    logTest('Extracted rendering logic', !!renderingLogicMatch, renderingLogic);
    
    // Check if there's a View wrapper with flex: 1 around AttendeeWantLists
    const hasFlexWrapper = screenContent.includes('<View style={{ flex: 1 }}>\n              <AttendeeWantLists');
    
    logTest('AttendeeWantLists has flex wrapper', hasFlexWrapper, {
      hasFlexWrapper: hasFlexWrapper
    });
    
    // Check if there are any styles that might limit the height of the component
    const hasHeightLimiting = screenContent.includes('maxHeight:') || 
                            screenContent.includes('height:') && 
                            !screenContent.includes('height: undefined');
    
    logTest('Screen has height limiting styles', hasHeightLimiting, {
      hasHeightLimiting: hasHeightLimiting
    });
    
    return true;
  } catch (err) {
    logTest('Layout and rendering debug', false, `Exception: ${err.message}`);
    return false;
  }
}

/**
 * Test 6: Check for console errors and warnings
 */
async function checkConsoleErrors() {
  console.log('\n=== Checking for Console Errors and Warnings ===');
  
  console.log('Note: This test requires manual inspection of the app console logs.');
  console.log('Please check your app console for errors and warnings related to:');
  console.log('1. AttendeeWantLists component');
  console.log('2. showWantListService');
  console.log('3. get_visible_want_lists RPC function');
  console.log('4. Layout or rendering issues');
  console.log('5. ScrollView or FlatList warnings');
  
  console.log('\nCommon errors to look for:');
  console.log('- "Cannot read property of undefined" errors');
  console.log('- RPC function errors');
  console.log('- State update on unmounted component warnings');
  console.log('- VirtualizedList warnings about cell measurements');
  console.log('- FlashList or FlatList warnings about missing keys');
  
  return true;
}

/**
 * Test 7: Verify scroll behavior and component height
 */
async function verifyScrollBehavior() {
  console.log('\n=== Verifying Scroll Behavior and Component Height ===');
  
  console.log('Note: This test requires manual inspection of the app.');
  console.log('Please check the following in your app:');
  console.log('1. Is the ScrollView/FlatList configured correctly?');
  console.log('2. Does the AttendeeWantLists component have a height?');
  console.log('3. Is the content overflowing but not scrollable?');
  console.log('4. Are there any parent components with overflow: hidden?');
  console.log('5. Is the ScrollView/FlatList nested inside another ScrollView?');
  
  console.log('\nPossible fixes to try:');
  console.log('1. Add contentContainerStyle={{ flexGrow: 1 }} to ScrollView');
  console.log('2. Ensure the component has a defined height or flex: 1');
  console.log('3. Check for nested ScrollViews (should be avoided)');
  console.log('4. Add style={{ flex: 1 }} to the component wrapper');
  console.log('5. Check for any fixed height constraints on parent containers');
  
  return true;
}

/**
 * Generate a final report on the issue
 */
function generateReport() {
  console.log('\n======================================================');
  console.log('COLLECTION SCREEN DEBUGGING RESULTS');
  console.log('======================================================');
  
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: \x1b[32m${testResults.passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${testResults.failed}\x1b[0m`);
  
  const allPassed = testResults.failed === 0 && testResults.passed > 0;
  
  console.log('\n======================================================');
  if (allPassed) {
    console.log('\x1b[32mALL TESTS PASSED\x1b[0m');
    console.log('The issue is likely related to layout or styling.');
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
    console.log('1. Check the AttendeeWantLists component for proper height/flex styling');
    console.log('2. Verify the ScrollView/FlatList configuration in both the component and screen');
    console.log('3. Add debug console logs to track component mounting and data loading');
    console.log('4. Check for any parent components with overflow: hidden or fixed height');
    console.log('5. Try adding contentContainerStyle={{ flexGrow: 1 }} to the ScrollView');
    console.log('6. Ensure the component has enough content to be scrollable');
    console.log('7. Check for any z-index issues that might be hiding the component');
    console.log('8. Verify that the hasDatabaseIssues() function is not preventing rendering');
  }
  
  return allPassed;
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('======================================================');
  console.log('DEBUGGING COLLECTION SCREEN SCROLL AND RENDERING ISSUES');
  console.log('======================================================');
  console.log(`MVP Dealer ID: ${MVP_DEALER_ID}`);
  console.log(`Show ID: ${SHOW_ID}`);
  console.log(`Attendee ID: ${ATTENDEE_ID}`);
  console.log('======================================================');
  
  try {
    // Run all tests
    await testRpcFunction();
    await testCollectionScreenLogic();
    await analyzeAttendeeWantListsComponent();
    await checkShowWantListService();
    await debugLayoutAndRendering();
    await checkConsoleErrors();
    await verifyScrollBehavior();
    
    // Generate final report
    generateReport();
    
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
    console.log('\nCollection screen debugging completed.');
  });
