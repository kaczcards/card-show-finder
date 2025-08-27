/**
 * debug-want-lists-access-detailed.js
 * 
 * This script provides detailed debugging for want list visibility issues
 * between MVP Dealers, Show Organizers, and Attendees.
 * 
 * It performs comprehensive checks on:
 * 1. User profiles (checking for duplicates)
 * 2. Show registrations and participants
 * 3. Want list data across all users
 * 4. RPC function existence and definition
 * 5. Complete data relationships for troubleshooting
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
 * Check user profiles and identify duplicates
 */
async function checkUserProfiles(userId) {
  console.log(`\n--- Checking User Profiles for ID: ${userId} ---`);
  
  try {
    // Check for multiple profiles with the same ID
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);
    
    if (error) throw error;
    
    if (!profiles || profiles.length === 0) {
      console.log(`❌ No profiles found for user ID: ${userId}`);
      return null;
    }
    
    console.log(`Found ${profiles.length} profile(s) for this user ID`);
    
    // Display all profiles found
    profiles.forEach((profile, index) => {
      console.log(`\nProfile #${index + 1}:`);
      console.log(`- Name: ${profile.first_name} ${profile.last_name || ''}`);
      console.log(`- Email: ${profile.email || 'N/A'}`);
      console.log(`- Role: ${profile.role || 'N/A'}`);
      console.log(`- Account Type: ${profile.account_type || 'N/A'}`);
      console.log(`- Subscription Status: ${profile.subscription_status || 'N/A'}`);
      console.log(`- Created At: ${profile.created_at || 'N/A'}`);
      console.log(`- Updated At: ${profile.updated_at || 'N/A'}`);
    });
    
    // Check if any profile has MVP dealer role
    const mvpDealerProfile = profiles.find(p => p.role === 'mvp_dealer');
    if (mvpDealerProfile) {
      console.log(`\n✅ Found an MVP dealer profile for this user`);
    } else {
      console.log(`\n❌ No MVP dealer profile found for this user`);
    }
    
    return profiles;
  } catch (err) {
    console.error('Error checking user profiles:', err.message);
    return null;
  }
}

/**
 * List all shows and their participants
 */
async function listAllShowsAndParticipants() {
  console.log(`\n--- Listing All Shows and Their Participants ---`);
  
  try {
    // Get all shows
    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(10); // Limit to 10 most recent shows for brevity
    
    if (showsError) throw showsError;
    
    if (!shows || shows.length === 0) {
      console.log(`❌ No shows found in the database`);
      return null;
    }
    
    console.log(`Found ${shows.length} shows in the database`);
    
    // For each show, get participants
    for (const show of shows) {
      console.log(`\nShow: ${show.title}`);
      console.log(`- ID: ${show.id}`);
      console.log(`- Dates: ${show.start_date} to ${show.end_date || show.start_date}`);
      console.log(`- Location: ${show.location}`);
      console.log(`- Organizer ID: ${show.organizer_id || 'N/A'}`);
      
      // Get participants for this show
      const { data: participants, error: partError } = await supabase
        .from('show_participants')
        .select('*, profiles:userid(first_name, last_name, role)')
        .eq('showid', show.id);
      
      if (partError) {
        console.log(`  ❌ Error fetching participants: ${partError.message}`);
        continue;
      }
      
      if (!participants || participants.length === 0) {
        console.log(`  ❌ No participants found for this show`);
        continue;
      }
      
      console.log(`  Found ${participants.length} participants:`);
      participants.forEach((p, i) => {
        const profile = p.profiles || {};
        console.log(`  ${i + 1}. User ID: ${p.userid}`);
        console.log(`     Name: ${profile.first_name || 'Unknown'} ${profile.last_name || ''}`);
        console.log(`     Role: ${profile.role || 'Unknown'}`);
        console.log(`     Status: ${p.status || 'Unknown'}`);
      });
      
      // Check if our specific users are participants
      const mvpDealerParticipation = participants.find(p => p.userid === MVP_DEALER_ID);
      const attendeeParticipation = participants.find(p => p.userid === ATTENDEE_ID);
      
      if (mvpDealerParticipation) {
        console.log(`  ✅ MVP Dealer (${MVP_DEALER_ID}) is registered for this show`);
      } else {
        console.log(`  ❌ MVP Dealer (${MVP_DEALER_ID}) is NOT registered for this show`);
      }
      
      if (attendeeParticipation) {
        console.log(`  ✅ Attendee (${ATTENDEE_ID}) is registered for this show`);
      } else {
        console.log(`  ❌ Attendee (${ATTENDEE_ID}) is NOT registered for this show`);
      }
      
      // Check if this is our specific show of interest
      if (show.id === SHOW_ID) {
        console.log(`  ✅ This is the specific show we're investigating (${SHOW_ID})`);
      }
    }
    
    return shows;
  } catch (err) {
    console.error('Error listing shows and participants:', err.message);
    return null;
  }
}

/**
 * List all users and their want lists
 */
async function listAllUsersAndWantLists() {
  console.log(`\n--- Listing All Users and Their Want Lists ---`);
  
  try {
    // Get all users with want lists
    const { data: wantLists, error: wlError } = await supabase
      .from('want_lists')
      .select('*, profiles:userid(first_name, last_name, role)')
      .order('updatedat', { ascending: false })
      .limit(20); // Limit to 20 most recent want lists for brevity
    
    if (wlError) throw wlError;
    
    if (!wantLists || wantLists.length === 0) {
      console.log(`❌ No want lists found in the database`);
      return null;
    }
    
    console.log(`Found ${wantLists.length} want lists in the database`);
    
    // Group want lists by user
    const userWantLists = {};
    wantLists.forEach(wl => {
      if (!userWantLists[wl.userid]) {
        userWantLists[wl.userid] = {
          profile: wl.profiles,
          wantLists: []
        };
      }
      userWantLists[wl.userid].wantLists.push(wl);
    });
    
    // Display want lists by user
    Object.entries(userWantLists).forEach(([userId, data]) => {
      const { profile, wantLists } = data;
      console.log(`\nUser: ${profile ? `${profile.first_name || 'Unknown'} ${profile.last_name || ''}` : 'Unknown'}`);
      console.log(`- ID: ${userId}`);
      console.log(`- Role: ${profile ? profile.role || 'Unknown' : 'Unknown'}`);
      console.log(`- Want Lists (${wantLists.length}):`);
      
      wantLists.forEach((wl, i) => {
        console.log(`  ${i + 1}. ID: ${wl.id}`);
        console.log(`     Content: ${wl.content.substring(0, 50)}${wl.content.length > 50 ? '...' : ''}`);
        console.log(`     Updated: ${wl.updatedat}`);
      });
    });
    
    // Check if our specific attendee has want lists
    const attendeeWantLists = userWantLists[ATTENDEE_ID];
    if (attendeeWantLists) {
      console.log(`\n✅ Attendee (${ATTENDEE_ID}) has ${attendeeWantLists.wantLists.length} want list(s)`);
    } else {
      console.log(`\n❌ Attendee (${ATTENDEE_ID}) has NO want lists`);
    }
    
    return wantLists;
  } catch (err) {
    console.error('Error listing users and want lists:', err.message);
    return null;
  }
}

/**
 * Check if the RPC function exists and examine its definition
 */
async function checkRpcFunctionDefinition() {
  console.log(`\n--- Checking RPC Function Definition ---`);
  
  try {
    // Check if the function exists by trying to call it with minimal parameters
    const { data: testResult, error: testError } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: '00000000-0000-0000-0000-000000000000', // Use a dummy UUID
      page: 1,
      page_size: 1
    });
    
    if (testError) {
      console.log(`❌ Error calling RPC function: ${testError.message}`);
      console.log(`   This suggests the function might not exist or has errors`);
    } else {
      console.log(`✅ RPC function exists and can be called`);
      console.log(`   Result: ${JSON.stringify(testResult, null, 2)}`);
    }
    
    // Try to get the function definition from pg_proc
    // Note: This requires elevated permissions and might not work with anon key
    console.log(`\nAttempting to retrieve function definition (requires elevated permissions):`);
    const { data: funcDef, error: funcError } = await supabase.rpc('get_function_definition', {
      function_name: 'get_visible_want_lists'
    });
    
    if (funcError) {
      console.log(`❌ Could not retrieve function definition: ${funcError.message}`);
      console.log(`   This is expected if using anon key without elevated permissions`);
    } else if (funcDef) {
      console.log(`✅ Function definition retrieved:`);
      console.log(funcDef);
    }
    
    // Check for the 'base' relation that was mentioned in the error
    console.log(`\nChecking for 'base' relation mentioned in the error:`);
    const { data: baseRelation, error: baseError } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('tablename', 'base');
    
    if (baseError) {
      console.log(`❌ Error checking for 'base' relation: ${baseError.message}`);
    } else if (!baseRelation || baseRelation.length === 0) {
      console.log(`❌ The 'base' relation does not exist in the database`);
      console.log(`   This explains the error: "relation 'base' does not exist"`);
    } else {
      console.log(`✅ The 'base' relation exists in the database`);
    }
    
    return { testResult, funcDef };
  } catch (err) {
    console.error('Error checking RPC function definition:', err.message);
    return null;
  }
}

/**
 * Check the specific show details and participants
 */
async function checkSpecificShow(showId) {
  console.log(`\n--- Checking Specific Show Details: ${showId} ---`);
  
  try {
    // Get show details
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
    console.log(`- ID: ${show.id}`);
    console.log(`- Dates: ${show.start_date} to ${show.end_date || show.start_date}`);
    console.log(`- Location: ${show.location}`);
    console.log(`- Organizer ID: ${show.organizer_id || 'N/A'}`);
    
    // Get all participants for this show
    const { data: participants, error: partError } = await supabase
      .from('show_participants')
      .select('*, profiles:userid(first_name, last_name, role)')
      .eq('showid', showId);
    
    if (partError) throw partError;
    
    if (!participants || participants.length === 0) {
      console.log(`❌ No participants found for this show`);
      return { show, participants: [] };
    }
    
    console.log(`\n✅ Found ${participants.length} participants for this show:`);
    participants.forEach((p, i) => {
      const profile = p.profiles || {};
      console.log(`${i + 1}. User ID: ${p.userid}`);
      console.log(`   Name: ${profile.first_name || 'Unknown'} ${profile.last_name || ''}`);
      console.log(`   Role: ${profile.role || 'Unknown'}`);
      console.log(`   Status: ${p.status || 'Unknown'}`);
    });
    
    // Check for our specific users
    const mvpDealerParticipation = participants.find(p => p.userid === MVP_DEALER_ID);
    const attendeeParticipation = participants.find(p => p.userid === ATTENDEE_ID);
    
    if (mvpDealerParticipation) {
      console.log(`\n✅ MVP Dealer (${MVP_DEALER_ID}) is registered for this show`);
      console.log(`- Status: ${mvpDealerParticipation.status}`);
      console.log(`- Role: ${mvpDealerParticipation.profiles?.role || 'Unknown'}`);
    } else {
      console.log(`\n❌ MVP Dealer (${MVP_DEALER_ID}) is NOT registered for this show`);
      console.log(`- This explains why want lists aren't visible - the dealer must be registered`);
    }
    
    if (attendeeParticipation) {
      console.log(`\n✅ Attendee (${ATTENDEE_ID}) is registered for this show`);
      console.log(`- Status: ${attendeeParticipation.status}`);
      console.log(`- Role: ${attendeeParticipation.profiles?.role || 'Unknown'}`);
    } else {
      console.log(`\n❌ Attendee (${ATTENDEE_ID}) is NOT registered for this show`);
      console.log(`- This explains why attendee's want lists aren't visible - they must be registered`);
    }
    
    return { show, participants };
  } catch (err) {
    console.error('Error checking specific show:', err.message);
    return null;
  }
}

/**
 * Create a custom helper function to check the RPC function definition
 */
async function createRpcHelperFunction() {
  console.log(`\n--- Creating Helper Function to Check RPC Definition ---`);
  
  try {
    // Create a helper function to get function definitions
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.get_function_definition(function_name TEXT)
        RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          func_def TEXT;
        BEGIN
          SELECT pg_get_functiondef(p.oid)
          INTO func_def
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public' AND p.proname = function_name;
          
          RETURN func_def;
        END;
        $$;
        
        GRANT EXECUTE ON FUNCTION public.get_function_definition(TEXT) TO authenticated;
      `
    });
    
    if (error) {
      console.log(`❌ Error creating helper function: ${error.message}`);
      console.log(`   This is expected if you don't have admin privileges`);
    } else {
      console.log(`✅ Helper function created successfully`);
    }
  } catch (err) {
    console.error('Error creating helper function:', err.message);
  }
}

/**
 * Test the visibility of want lists for the MVP dealer
 */
async function testWantListVisibility() {
  console.log(`\n--- Testing Want List Visibility for MVP Dealer ---`);
  
  try {
    // First, check if the MVP dealer has any upcoming shows
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', MVP_DEALER_ID);
    
    if (partError) throw partError;
    
    if (!participations || participations.length === 0) {
      console.log(`❌ MVP Dealer is not participating in any shows`);
      console.log(`   This explains why no want lists are visible - dealer must be registered for shows`);
      return null;
    }
    
    const showIds = participations.map(p => p.showid);
    console.log(`✅ MVP Dealer is participating in ${showIds.length} shows`);
    
    // Get upcoming shows from these IDs
    const currentDate = new Date().toISOString();
    const { data: upcomingShows, error: showsError } = await supabase
      .from('shows')
      .select('*')
      .in('id', showIds)
      .or(`end_date.gte.${currentDate},and(end_date.is.null,start_date.gte.${currentDate})`);
    
    if (showsError) throw showsError;
    
    if (!upcomingShows || upcomingShows.length === 0) {
      console.log(`❌ No upcoming shows found for this dealer`);
      console.log(`   This explains why no want lists are visible in the UI - no upcoming shows`);
      return null;
    }
    
    console.log(`✅ Found ${upcomingShows.length} upcoming shows for this dealer`);
    upcomingShows.forEach((show, i) => {
      console.log(`  Show ${i + 1}: ${show.title} (${show.start_date} to ${show.end_date || show.start_date})`);
    });
    
    // Check if there are attendees with want lists for these shows
    let foundWantLists = false;
    for (const show of upcomingShows) {
      console.log(`\nChecking attendees for show: ${show.title}`);
      
      // Get attendees for this show
      const { data: attendees, error: attendeesError } = await supabase
        .from('show_participants')
        .select('userid')
        .eq('showid', show.id)
        .in('status', ['registered', 'confirmed'])
        .neq('userid', MVP_DEALER_ID);
      
      if (attendeesError) {
        console.log(`  ❌ Error fetching attendees: ${attendeesError.message}`);
        continue;
      }
      
      if (!attendees || attendees.length === 0) {
        console.log(`  ❌ No attendees found for this show`);
        continue;
      }
      
      console.log(`  ✅ Found ${attendees.length} attendees for this show`);
      
      // Check if any of these attendees have want lists
      const attendeeIds = attendees.map(a => a.userid);
      const { data: wantLists, error: wlError } = await supabase
        .from('want_lists')
        .select('id, userid')
        .in('userid', attendeeIds);
      
      if (wlError) {
        console.log(`  ❌ Error fetching want lists: ${wlError.message}`);
        continue;
      }
      
      if (!wantLists || wantLists.length === 0) {
        console.log(`  ❌ No want lists found for attendees of this show`);
        continue;
      }
      
      console.log(`  ✅ Found ${wantLists.length} want lists for attendees of this show`);
      foundWantLists = true;
    }
    
    if (!foundWantLists) {
      console.log(`\n❌ No want lists found for any attendees of upcoming shows`);
      console.log(`   This explains why no want lists are visible - no data to display`);
    } else {
      console.log(`\n✅ Found want lists for attendees of upcoming shows`);
      console.log(`   These should be visible to the MVP dealer in the UI`);
    }
    
    return upcomingShows;
  } catch (err) {
    console.error('Error testing want list visibility:', err.message);
    return null;
  }
}

/**
 * Main function to run all checks
 */
async function main() {
  console.log('======================================================');
  console.log('DETAILED DEBUGGING FOR WANT LIST ACCESS');
  console.log('======================================================');
  
  // Create helper function for RPC definition checks
  await createRpcHelperFunction();
  
  // Step 1: Check user profiles (including duplicates)
  const userProfiles = await checkUserProfiles(MVP_DEALER_ID);
  
  // Step 2: Check specific show details and participants
  await checkSpecificShow(SHOW_ID);
  
  // Step 3: List all users and want lists
  await listAllUsersAndWantLists();
  
  // Step 4: Check RPC function definition
  await checkRpcFunctionDefinition();
  
  // Step 5: Test want list visibility for the MVP dealer
  await testWantListVisibility();
  
  // Step 6: List all shows and participants (for a complete picture)
  await listAllShowsAndParticipants();
  
  console.log('\n======================================================');
  console.log('SUMMARY AND RECOMMENDATIONS');
  console.log('======================================================');
  
  // Check if the user has an MVP dealer profile
  const hasMvpDealerProfile = userProfiles && userProfiles.some(p => p.role === 'mvp_dealer');
  
  if (!hasMvpDealerProfile) {
    console.log(`1. ❌ User does not have an MVP dealer profile`);
    console.log(`   Solution: Update the user's role to 'mvp_dealer' in the profiles table`);
  } else {
    console.log(`1. ✅ User has an MVP dealer profile`);
  }
  
  // Check for RPC function issues
  console.log(`\n2. RPC Function Issues:`);
  console.log(`   The error "relation 'base' does not exist" indicates a problem with the SQL function`);
  console.log(`   Solution: Check and fix the get_visible_want_lists function definition`);
  console.log(`   - Look for references to a CTE or table named 'base'`);
  console.log(`   - Ensure all table references are valid`);
  
  // Check for registration issues
  console.log(`\n3. Registration Issues:`);
  console.log(`   Both the MVP dealer and attendee need to be registered for the same show`);
  console.log(`   Solution: Register both users for the show using show_participants table`);
  
  // Check for want list data
  console.log(`\n4. Want List Data Issues:`);
  console.log(`   The attendee needs to have want lists in the database`);
  console.log(`   Solution: Create want lists for the attendee in the want_lists table`);
  
  // Check for UI rendering issues
  console.log(`\n5. UI Rendering Issues:`);
  console.log(`   The isPrivileged check in CollectionScreen.tsx should be working if user role is correct`);
  console.log(`   Solution: Verify that upcomingShows array is being populated and passed to AttendeeWantLists`);
  
  console.log(`\nNext Steps:`);
  console.log(`1. Fix the get_visible_want_lists RPC function`);
  console.log(`2. Register the MVP dealer for at least one upcoming show`);
  console.log(`3. Ensure attendees of that show have want lists`);
  console.log(`4. Verify the user's role is correctly set to 'mvp_dealer'`);
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
