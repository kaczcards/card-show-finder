/**
 * debug-want-lists-access.js
 * 
 * This script debugs issues with want list visibility for MVP Dealers and Show Organizers.
 * It specifically checks:
 * 1. User role for the MVP Dealer
 * 2. Registration status for the specific show
 * 3. Attendee want lists and registration status
 * 4. RPC function for want list visibility
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Supabase setup
// ---------------------------------------------------------------------------
// Priority order:
//   1. Expo public env vars (used by the mobile app)
//   2. Legacy vars (SUPABASE_URL / SUPABASE_ANON_KEY)
//   3. Service-role key as a last-resort fallback (admin scripts / CI)
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

// Constants for the specific test case
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
const SHOW_ID = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
const ATTENDEE_ID = '090926af-e383-4b74-95fa-d1dd16661e7f';

/**
 * Check user profile and role
 */
async function checkUserRole(userId) {
  console.log(`\n--- Checking User Role for ID: ${userId} ---`);
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    if (!profile) {
      console.log(`❌ User with ID ${userId} not found`);
      return null;
    }
    
    console.log(`✅ User found: ${profile.first_name} ${profile.last_name}`);
    console.log(`✅ User role: ${profile.role}`);
    console.log(`✅ Account type: ${profile.account_type}`);
    console.log(`✅ Subscription status: ${profile.subscription_status}`);
    
    // Check if the user is an MVP dealer
    const isMvpDealer = profile.role === 'mvp_dealer';
    console.log(`${isMvpDealer ? '✅' : '❌'} User is ${isMvpDealer ? '' : 'NOT '}an MVP dealer`);
    
    return profile;
  } catch (err) {
    console.error('Error checking user role:', err.message);
    return null;
  }
}

/**
 * Check show registration status
 */
async function checkShowRegistration(userId, showId) {
  console.log(`\n--- Checking Show Registration for User: ${userId}, Show: ${showId} ---`);
  
  try {
    // Get show details first
    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('*')
      .eq('id', showId)
      .single();
    
    if (showError) throw showError;
    
    if (!show) {
      console.log(`❌ Show with ID ${showId} not found`);
      return null;
    }
    
    console.log(`✅ Show found: ${show.title}`);
    console.log(`✅ Show dates: ${show.start_date} to ${show.end_date}`);
    console.log(`✅ Show location: ${show.location}`);
    
    // Check if the user is registered for this show
    const { data: participation, error } = await supabase
      .from('show_participants')
      .select('*')
      .eq('userid', userId)
      .eq('showid', showId)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!participation) {
      console.log(`❌ User is NOT registered for this show`);
      return null;
    }
    
    console.log(`✅ User IS registered for this show`);
    console.log(`✅ Registration status: ${participation.status}`);
    console.log(`✅ Registration role: ${participation.role}`);
    console.log(`✅ Registration ID: ${participation.id}`);
    
    return participation;
  } catch (err) {
    console.error('Error checking show registration:', err.message);
    return null;
  }
}

/**
 * Check attendee want lists and registration status
 */
async function checkAttendeeWantList(attendeeId, showId) {
  console.log(`\n--- Checking Attendee Want Lists for ID: ${attendeeId} ---`);
  
  try {
    // Check if attendee is registered for the show
    const { data: participation, error: partError } = await supabase
      .from('show_participants')
      .select('*')
      .eq('userid', attendeeId)
      .eq('showid', showId)
      .maybeSingle();
    
    if (partError) throw partError;
    
    if (!participation) {
      console.log(`❌ Attendee is NOT registered for this show`);
    } else {
      console.log(`✅ Attendee IS registered for this show`);
      console.log(`✅ Registration status: ${participation.status}`);
      console.log(`✅ Registration role: ${participation.role}`);
    }
    
    // Check if attendee has want lists
    const { data: wantLists, error: wlError } = await supabase
      .from('want_lists')
      .select('*')
      .eq('userid', attendeeId);
    
    if (wlError) throw wlError;
    
    if (!wantLists || wantLists.length === 0) {
      console.log(`❌ Attendee has NO want lists`);
      return null;
    }
    
    console.log(`✅ Attendee has ${wantLists.length} want list(s)`);
    wantLists.forEach((wl, i) => {
      console.log(`  Want List ${i + 1}:`);
      console.log(`  - ID: ${wl.id}`);
      console.log(`  - Content: ${wl.content.substring(0, 50)}${wl.content.length > 50 ? '...' : ''}`);
      console.log(`  - Created: ${wl.createdat}`);
      console.log(`  - Updated: ${wl.updatedat}`);
    });
    
    return wantLists;
  } catch (err) {
    console.error('Error checking attendee want lists:', err.message);
    return null;
  }
}

/**
 * Test the get_visible_want_lists RPC function
 */
async function testVisibleWantLists(userId, showId) {
  console.log(`\n--- Testing get_visible_want_lists RPC Function ---`);
  
  try {
    // Call the RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: userId,
      show_id: showId,
      search_term: null,
      page: 1,
      page_size: 20
    });
    
    if (rpcError) {
      console.log(`❌ RPC function call failed: ${rpcError.message}`);
      return null;
    }
    
    if (!rpcData) {
      console.log(`❌ RPC function returned no data`);
      return null;
    }
    
    console.log(`✅ RPC function call successful`);
    
    if (rpcData.error) {
      console.log(`❌ RPC function returned error: ${rpcData.error}`);
      return null;
    }
    
    if (!rpcData.data || !Array.isArray(rpcData.data) || rpcData.data.length === 0) {
      console.log(`❌ No want lists found through RPC function`);
      return rpcData;
    }
    
    console.log(`✅ Found ${rpcData.data.length} want lists through RPC function`);
    console.log(`✅ Total count: ${rpcData.totalCount}`);
    console.log(`✅ Has more: ${rpcData.hasMore}`);
    
    // Check if the attendee's want list is in the results
    const attendeeWantList = rpcData.data.find(wl => wl.userId === ATTENDEE_ID);
    if (attendeeWantList) {
      console.log(`✅ Attendee's want list IS visible to the MVP dealer`);
    } else {
      console.log(`❌ Attendee's want list is NOT visible to the MVP dealer`);
    }
    
    return rpcData;
  } catch (err) {
    console.error('Error testing RPC function:', err.message);
    return null;
  }
}

/**
 * Check for issues with Collection Screen logic
 */
async function checkCollectionScreenLogic(userProfile) {
  console.log(`\n--- Checking Collection Screen Logic ---`);
  
  if (!userProfile) {
    console.log(`❌ Cannot check logic without user profile`);
    return;
  }
  
  // Check the isPrivileged condition from CollectionScreen.tsx
  const isPrivileged = 
    userProfile.role === 'mvp_dealer' || 
    userProfile.role === 'show_organizer';
  
  console.log(`${isPrivileged ? '✅' : '❌'} isPrivileged condition: ${isPrivileged}`);
  console.log(`Role check: user.role (${userProfile.role}) === 'mvp_dealer' is ${userProfile.role === 'mvp_dealer'}`);
  
  if (!isPrivileged) {
    console.log(`❌ The AttendeeWantLists component would NOT be rendered for this user`);
    console.log(`   This explains why the want lists section is not visible`);
  } else {
    console.log(`✅ The AttendeeWantLists component SHOULD be rendered for this user`);
    console.log(`   Check for other issues like upcomingShows array being empty`);
  }
}

/**
 * Check if the upcomingShows array is being populated
 */
async function checkUpcomingShows(userId) {
  console.log(`\n--- Checking Upcoming Shows for User: ${userId} ---`);
  
  try {
    // Get current date in ISO format
    const currentDate = new Date().toISOString();
    
    // Get shows the user is participating in
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', userId);
    
    if (partError) throw partError;
    
    if (!participations || participations.length === 0) {
      console.log(`❌ User is not participating in any shows`);
      return [];
    }
    
    const showIds = participations.map(p => p.showid);
    console.log(`✅ User is participating in ${showIds.length} shows`);
    
    // Get upcoming shows from these IDs
    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('*')
      .in('id', showIds)
      .or(`end_date.gte.${currentDate},and(end_date.is.null,start_date.gte.${currentDate})`);
    
    if (showsError) throw showsError;
    
    if (!shows || shows.length === 0) {
      console.log(`❌ No upcoming shows found for this user`);
      return [];
    }
    
    console.log(`✅ Found ${shows.length} upcoming shows for this user`);
    shows.forEach((show, i) => {
      console.log(`  Show ${i + 1}: ${show.title} (${show.start_date} to ${show.end_date})`);
    });
    
    return shows;
  } catch (err) {
    console.error('Error checking upcoming shows:', err.message);
    return [];
  }
}

/**
 * Main function to run all checks
 */
async function main() {
  console.log('======================================================');
  console.log('DEBUGGING WANT LIST ACCESS FOR MVP DEALER');
  console.log('======================================================');
  
  // Step 1: Check user role
  const userProfile = await checkUserRole(MVP_DEALER_ID);
  
  // Step 2: Check show registration
  const showRegistration = await checkShowRegistration(MVP_DEALER_ID, SHOW_ID);
  
  // Step 3: Check attendee want lists
  const attendeeWantLists = await checkAttendeeWantList(ATTENDEE_ID, SHOW_ID);
  
  // Step 4: Test RPC function
  const rpcResults = await testVisibleWantLists(MVP_DEALER_ID, SHOW_ID);
  
  // Step 5: Check Collection Screen logic
  await checkCollectionScreenLogic(userProfile);
  
  // Step 6: Check upcoming shows array
  await checkUpcomingShows(MVP_DEALER_ID);
  
  console.log('\n======================================================');
  console.log('SUMMARY');
  console.log('======================================================');
  
  if (!userProfile || userProfile.role !== 'mvp_dealer') {
    console.log(`❌ User is not an MVP dealer - this would prevent want list access`);
  } else if (!showRegistration) {
    console.log(`❌ User is not registered for the show - this would prevent want list access`);
  } else if (!attendeeWantLists || attendeeWantLists.length === 0) {
    console.log(`❌ Attendee has no want lists - nothing to display`);
  } else if (!rpcResults || !rpcResults.data || rpcResults.data.length === 0) {
    console.log(`❌ RPC function returns no want lists - check database permissions`);
  } else {
    console.log(`✅ All checks passed - want lists should be visible`);
    console.log(`   If they're still not showing, check the Collection screen UI rendering`);
    console.log(`   and ensure the upcomingShows array is being passed to AttendeeWantLists`);
  }
}

// Run the script
main()
  .catch(err => {
    console.error('Unhandled error:', err);
  })
  .finally(() => {
    // Close the connection
    console.log('\nDebug script completed.');
    process.exit(0);
  });
