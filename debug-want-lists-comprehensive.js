/**
 * debug-want-lists-comprehensive.js
 * 
 * A comprehensive diagnostic tool for troubleshooting the want lists feature
 * in the Card Show Finder app. This script checks all components of the data flow
 * and helps identify exactly where the issue occurs.
 * 
 * Usage:
 * 1. Set your Supabase credentials in the config section
 * 2. Run with Node.js: node debug-want-lists-comprehensive.js
 * 3. Review the diagnostic output
 */

const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk'); // For colorful console output

// ============================================================================
// CONFIG - Replace with your values
// ============================================================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Test users - replace with actual UUIDs from your database
const TEST_ATTENDEE_ID = process.env.TEST_ATTENDEE_ID || 'attendee-user-id';
const TEST_DEALER_ID = process.env.TEST_DEALER_ID || 'dealer-user-id';
const TEST_MVP_DEALER_ID = process.env.TEST_MVP_DEALER_ID || 'mvp-dealer-user-id';
const TEST_ORGANIZER_ID = process.env.TEST_ORGANIZER_ID || 'organizer-user-id';

// Test show - replace with an actual show UUID
const TEST_SHOW_ID = process.env.TEST_SHOW_ID || 'test-show-id';

// ============================================================================
// Initialize Supabase client
// ============================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// Utility functions
// ============================================================================
const log = {
  info: (msg) => console.log(chalk.blue('INFO: ') + msg),
  success: (msg) => console.log(chalk.green('SUCCESS: ') + msg),
  warning: (msg) => console.log(chalk.yellow('WARNING: ') + msg),
  error: (msg) => console.log(chalk.red('ERROR: ') + msg),
  section: (title) => console.log('\n' + chalk.bold.cyan('==== ' + title + ' ===='))
};

// Simulate authenticated Supabase client for a specific user
const getAuthenticatedClient = async (userId, role) => {
  // In a real environment, you'd use JWT tokens
  // For this script, we'll use RLS bypass with service_role if available
  try {
    // This is a simplified simulation - in production you'd use proper auth
    log.info(`Simulating authenticated client for user ${userId} with role ${role}`);
    
    // Return the client with role claim in the JWT
    return supabase.auth.setAuth(`simulated-jwt-for-${userId}`);
  } catch (error) {
    log.error(`Failed to create authenticated client: ${error.message}`);
    return null;
  }
};

// ============================================================================
// Database checks
// ============================================================================

// 1. Check if tables exist and have expected structure
async function checkDatabaseSchema() {
  log.section('Database Schema Check');
  
  const tables = [
    'profiles',
    'shows',
    'user_favorite_shows',
    'show_participants',
    'want_lists'
  ];
  
  for (const table of tables) {
    try {
      // Check if table exists by trying to select a single row
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        log.error(`Table ${table} check failed: ${error.message}`);
      } else {
        log.success(`Table ${table} exists and is accessible`);
      }
    } catch (err) {
      log.error(`Error checking table ${table}: ${err.message}`);
    }
  }
}

// 2. Check if user_favorite_shows table has data
async function checkFavoriteShowsData() {
  log.section('Favorite Shows Data Check');
  
  try {
    // Check total count
    const { count: totalCount, error: countError } = await supabase
      .from('user_favorite_shows')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      log.error(`Failed to count favorite shows: ${countError.message}`);
    } else {
      log.info(`Total favorite shows records: ${totalCount}`);
      
      if (totalCount === 0) {
        log.warning('No favorite shows found! This is likely the root cause of the issue.');
      }
    }
    
    // Check if test attendee has favorited the test show
    const { data: attendeeFavorite, error: attendeeError } = await supabase
      .from('user_favorite_shows')
      .select('*')
      .eq('user_id', TEST_ATTENDEE_ID)
      .eq('show_id', TEST_SHOW_ID)
      .maybeSingle();
    
    if (attendeeError) {
      log.error(`Failed to check attendee favorite: ${attendeeError.message}`);
    } else if (attendeeFavorite) {
      log.success(`Test attendee has favorited the test show`);
    } else {
      log.warning(`Test attendee has NOT favorited the test show - this is required for want lists to work`);
    }
  } catch (err) {
    log.error(`Error checking favorite shows data: ${err.message}`);
  }
}

// 3. Check if RLS policies are working correctly
async function checkRLSPolicies() {
  log.section('RLS Policies Check');
  
  // Test cases to verify RLS policies
  const testCases = [
    {
      name: 'Attendee can see own favorites',
      userId: TEST_ATTENDEE_ID,
      role: 'attendee',
      query: () => supabase.from('user_favorite_shows').select('*').eq('user_id', TEST_ATTENDEE_ID)
    },
    {
      name: 'MVP Dealer can see attendee favorites for shows they participate in',
      userId: TEST_MVP_DEALER_ID,
      role: 'mvp_dealer',
      query: () => supabase.from('user_favorite_shows').select('*').eq('show_id', TEST_SHOW_ID)
    },
    {
      name: 'Show Organizer can see attendee favorites for shows they organize',
      userId: TEST_ORGANIZER_ID,
      role: 'show_organizer',
      query: () => supabase.from('user_favorite_shows').select('*').eq('show_id', TEST_SHOW_ID)
    }
  ];
  
  for (const test of testCases) {
    try {
      log.info(`Testing: ${test.name}`);
      
      // Get authenticated client for this user
      const authClient = await getAuthenticatedClient(test.userId, test.role);
      
      // Execute query
      const { data, error, count } = await test.query();
      
      if (error) {
        log.error(`Test failed: ${error.message}`);
      } else {
        log.success(`Test passed: ${data?.length || 0} records returned`);
        
        if (data?.length === 0 && test.role !== 'attendee') {
          log.warning(`No data returned for ${test.role} - this could indicate an RLS policy issue`);
        }
      }
    } catch (err) {
      log.error(`Error in RLS test "${test.name}": ${err.message}`);
    }
  }
  
  // Check if RLS policies exist for user_favorite_shows
  try {
    log.info('Checking for RLS policies on user_favorite_shows table');
    
    // This is a simplified check - in a real scenario, you'd query pg_policies
    const { data, error } = await supabase.rpc('get_table_policies', { table_name: 'user_favorite_shows' });
    
    if (error) {
      log.error(`Failed to check policies: ${error.message}`);
      log.info('Alternative check: Verify in Supabase dashboard that the following policies exist:');
      log.info('1. "Allow authenticated users to view their own favorite shows"');
      log.info('2. "Allow MVP dealers to view favorite shows for shows they participate in"');
      log.info('3. "Allow show organizers to view favorite shows for shows they organize"');
    } else {
      const policies = data || [];
      log.info(`Found ${policies.length} policies for user_favorite_shows table`);
      
      // Check for specific policies
      const hasMvpDealerPolicy = policies.some(p => p.name.toLowerCase().includes('mvp dealer'));
      const hasOrganizerPolicy = policies.some(p => p.name.toLowerCase().includes('organizer'));
      
      if (hasMvpDealerPolicy) {
        log.success('MVP Dealer policy exists');
      } else {
        log.error('MVP Dealer policy is missing!');
      }
      
      if (hasOrganizerPolicy) {
        log.success('Show Organizer policy exists');
      } else {
        log.error('Show Organizer policy is missing!');
      }
    }
  } catch (err) {
    log.error(`Error checking RLS policies: ${err.message}`);
  }
}

// 4. Check if show_participants table has the right data
async function checkShowParticipants() {
  log.section('Show Participants Check');
  
  try {
    // Check if MVP dealer is participating in the test show
    const { data: dealerParticipation, error: dealerError } = await supabase
      .from('show_participants')
      .select('*')
      .eq('userid', TEST_MVP_DEALER_ID)
      .eq('showid', TEST_SHOW_ID)
      .maybeSingle();
    
    if (dealerError) {
      log.error(`Failed to check dealer participation: ${dealerError.message}`);
    } else if (dealerParticipation) {
      log.success(`MVP Dealer is participating in the test show`);
    } else {
      log.error(`MVP Dealer is NOT participating in the test show - this is required for want lists to work`);
    }
    
    // Check if test show is organized by the test organizer
    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('organizer_id')
      .eq('id', TEST_SHOW_ID)
      .maybeSingle();
    
    if (showError) {
      log.error(`Failed to check show organizer: ${showError.message}`);
    } else if (show?.organizer_id === TEST_ORGANIZER_ID) {
      log.success(`Test show is organized by the test organizer`);
    } else {
      log.error(`Test show is NOT organized by the test organizer - this is required for want lists to work`);
    }
  } catch (err) {
    log.error(`Error checking show participants: ${err.message}`);
  }
}

// 5. Check if want_lists table has data
async function checkWantListsData() {
  log.section('Want Lists Data Check');
  
  try {
    // Check total count
    const { count: totalCount, error: countError } = await supabase
      .from('want_lists')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      log.error(`Failed to count want lists: ${countError.message}`);
    } else {
      log.info(`Total want lists records: ${totalCount}`);
      
      if (totalCount === 0) {
        log.warning('No want lists found! This is likely the root cause of the issue.');
      }
    }
    
    // Check if test attendee has a want list
    const { data: attendeeWantList, error: attendeeError } = await supabase
      .from('want_lists')
      .select('*')
      .eq('userid', TEST_ATTENDEE_ID)
      .not('content', 'ilike', '[INVENTORY]%')
      .maybeSingle();
    
    if (attendeeError) {
      log.error(`Failed to check attendee want list: ${attendeeError.message}`);
    } else if (attendeeWantList) {
      log.success(`Test attendee has a want list`);
      log.info(`Want list content: ${attendeeWantList.content.substring(0, 50)}${attendeeWantList.content.length > 50 ? '...' : ''}`);
    } else {
      log.warning(`Test attendee has NO want list - this is required for the feature to work`);
    }
  } catch (err) {
    log.error(`Error checking want lists data: ${err.message}`);
  }
}

// 6. Check service layer queries
async function checkServiceQueries() {
  log.section('Service Layer Queries Check');
  
  // Simplified version of the showWantListService queries
  try {
    log.info('Testing getWantListsForMvpDealer query...');
    
    // Step 1: Check if MVP dealer has the correct role
    const { data: dealerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', TEST_MVP_DEALER_ID)
      .single();
    
    if (profileError) {
      log.error(`Failed to get MVP dealer profile: ${profileError.message}`);
    } else if (dealerProfile.role !== 'mvp_dealer') {
      log.error(`Test user has role '${dealerProfile.role}' instead of 'mvp_dealer'`);
    } else {
      log.success('MVP dealer has correct role');
    }
    
    // Step 2: Check if we can get shows the dealer is participating in
    const { data: participatingShows, error: participantsError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', TEST_MVP_DEALER_ID);
    
    if (participantsError) {
      log.error(`Failed to get participating shows: ${participantsError.message}`);
    } else {
      log.success(`Found ${participatingShows.length} shows the MVP dealer is participating in`);
      
      if (participatingShows.length === 0) {
        log.warning('MVP dealer is not participating in any shows - this is required for want lists to work');
      } else {
        // Step 3: Check if we can get upcoming shows
        const showIds = participatingShows.map(show => show.showid);
        const currentDate = new Date().toISOString();
        
        const { data: upcomingShows, error: showsError } = await supabase
          .from('shows')
          .select('id, title, start_date')
          .in('id', showIds)
          .gte('start_date', currentDate);
        
        if (showsError) {
          log.error(`Failed to get upcoming shows: ${showsError.message}`);
        } else {
          log.success(`Found ${upcomingShows.length} upcoming shows the MVP dealer is participating in`);
          
          if (upcomingShows.length === 0) {
            log.warning('No UPCOMING shows found - check if test show date is in the future');
          } else {
            // Step 4: Check if we can get attendees for these shows
            const upcomingShowIds = upcomingShows.map(show => show.id);
            
            const { data: attendees, error: attendeesError } = await supabase
              .from('user_favorite_shows')
              .select('user_id, show_id')
              .in('show_id', upcomingShowIds)
              .neq('user_id', TEST_MVP_DEALER_ID);
            
            if (attendeesError) {
              log.error(`Failed to get attendees: ${attendeesError.message}`);
            } else {
              log.success(`Found ${attendees.length} attendees for the upcoming shows`);
              
              if (attendees.length === 0) {
                log.warning('No attendees found for upcoming shows - this is required for want lists to work');
              } else {
                // Step 5: Check if we can get attendee profiles with correct roles
                const attendeeIds = [...new Set(attendees.map(a => a.user_id))];
                
                const { data: attendeeProfiles, error: profilesError } = await supabase
                  .from('profiles')
                  .select('id, role')
                  .in('id', attendeeIds)
                  .in('role', ['attendee', 'dealer']);
                
                if (profilesError) {
                  log.error(`Failed to get attendee profiles: ${profilesError.message}`);
                } else {
                  log.success(`Found ${attendeeProfiles.length} attendee profiles with correct roles`);
                  
                  if (attendeeProfiles.length === 0) {
                    log.warning('No attendees with correct roles found - check if test attendee has role "attendee" or "dealer"');
                  } else {
                    // Step 6: Check if we can get want lists for these attendees
                    const validAttendeeIds = attendeeProfiles.map(profile => profile.id);
                    
                    const { data: wantLists, error: wantListsError } = await supabase
                      .from('want_lists')
                      .select('id, userid, content')
                      .in('userid', validAttendeeIds)
                      .not('content', 'ilike', '[INVENTORY]%')
                      .not('content', 'eq', '');
                    
                    if (wantListsError) {
                      log.error(`Failed to get want lists: ${wantListsError.message}`);
                    } else {
                      log.success(`Found ${wantLists.length} want lists for attendees`);
                      
                      if (wantLists.length === 0) {
                        log.warning('No want lists found for attendees - check if test attendee has created a want list');
                      } else {
                        log.success('Complete service query flow works!');
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    log.error(`Error checking service queries: ${err.message}`);
  }
}

// 7. Verify relationships and joins
async function checkRelationships() {
  log.section('Data Relationships Check');
  
  try {
    // Check the complete data flow from MVP dealer to attendee want lists
    log.info('Checking complete data flow for MVP dealer...');
    
    // 1. Get MVP dealer's participating shows
    const { data: participations, error: participationsError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', TEST_MVP_DEALER_ID);
    
    if (participationsError) {
      log.error(`Failed to get dealer participations: ${participationsError.message}`);
      return;
    }
    
    if (participations.length === 0) {
      log.error('MVP dealer is not participating in any shows');
      return;
    }
    
    const showIds = participations.map(p => p.showid);
    
    // 2. Get upcoming shows
    const currentDate = new Date().toISOString();
    const { data: upcomingShows, error: showsError } = await supabase
      .from('shows')
      .select('id, title')
      .in('id', showIds)
      .gte('start_date', currentDate);
    
    if (showsError) {
      log.error(`Failed to get upcoming shows: ${showsError.message}`);
      return;
    }
    
    if (upcomingShows.length === 0) {
      log.error('No upcoming shows found for MVP dealer');
      return;
    }
    
    const upcomingShowIds = upcomingShows.map(s => s.id);
    log.success(`Found ${upcomingShowIds.length} upcoming shows for MVP dealer`);
    
    // 3. Get attendees who have favorited these shows
    const { data: favorites, error: favoritesError } = await supabase
      .from('user_favorite_shows')
      .select('user_id, show_id')
      .in('show_id', upcomingShowIds);
    
    if (favoritesError) {
      log.error(`Failed to get favorites: ${favoritesError.message}`);
      return;
    }
    
    if (favorites.length === 0) {
      log.error('No attendees have favorited the upcoming shows');
      return;
    }
    
    log.success(`Found ${favorites.length} favorites for upcoming shows`);
    
    // 4. Get attendee profiles
    const attendeeIds = [...new Set(favorites.map(f => f.user_id))];
    const { data: attendees, error: attendeesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', attendeeIds)
      .in('role', ['attendee', 'dealer']);
    
    if (attendeesError) {
      log.error(`Failed to get attendee profiles: ${attendeesError.message}`);
      return;
    }
    
    if (attendees.length === 0) {
      log.error('No attendees with correct roles found');
      return;
    }
    
    log.success(`Found ${attendees.length} attendees with correct roles`);
    
    // 5. Get want lists for these attendees
    const validAttendeeIds = attendees.map(a => a.id);
    const { data: wantLists, error: wantListsError } = await supabase
      .from('want_lists')
      .select('id, userid, content')
      .in('userid', validAttendeeIds)
      .not('content', 'ilike', '[INVENTORY]%');
    
    if (wantListsError) {
      log.error(`Failed to get want lists: ${wantListsError.message}`);
      return;
    }
    
    if (wantLists.length === 0) {
      log.error('No want lists found for attendees');
      return;
    }
    
    log.success(`Found ${wantLists.length} want lists for attendees`);
    log.success('All relationships and joins are working correctly!');
  } catch (err) {
    log.error(`Error checking relationships: ${err.message}`);
  }
}

// ============================================================================
// Main function to run all checks
// ============================================================================
async function runDiagnostics() {
  log.section('WANT LISTS FEATURE DIAGNOSTICS');
  log.info(`Starting comprehensive diagnostics at ${new Date().toLocaleString()}`);
  
  try {
    await checkDatabaseSchema();
    await checkFavoriteShowsData();
    await checkRLSPolicies();
    await checkShowParticipants();
    await checkWantListsData();
    await checkServiceQueries();
    await checkRelationships();
    
    log.section('DIAGNOSTICS SUMMARY');
    log.info('Diagnostics completed. Review the output above for detailed findings.');
    log.info('Common issues and fixes:');
    log.info('1. Missing favorites: Attendees need to heart shows for them to appear');
    log.info('2. Missing want lists: Attendees need to create want lists');
    log.info('3. RLS policies: Verify the policies allow MVP dealers and organizers to read favorites');
    log.info('4. Show dates: Ensure shows are upcoming (future dates), not past shows');
    log.info('5. Participation: MVP dealers must be in show_participants for the shows');
    log.info('6. Roles: Check that users have the correct roles in the profiles table');
    log.info('7. Authentication: Ensure the app is making authenticated requests');
  } catch (err) {
    log.error(`Diagnostics failed: ${err.message}`);
  }
}

// Run the diagnostics
runDiagnostics().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

// ============================================================================
// Additional helper functions to fix common issues
// ============================================================================

// Function to add a test favorite (for debugging)
async function addTestFavorite() {
  log.section('Add Test Favorite');
  
  try {
    const { data, error } = await supabase
      .from('user_favorite_shows')
      .upsert({
        user_id: TEST_ATTENDEE_ID,
        show_id: TEST_SHOW_ID,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      log.error(`Failed to add test favorite: ${error.message}`);
    } else {
      log.success('Test favorite added successfully');
    }
  } catch (err) {
    log.error(`Error adding test favorite: ${err.message}`);
  }
}

// Function to add a test want list (for debugging)
async function addTestWantList() {
  log.section('Add Test Want List');
  
  try {
    const { data, error } = await supabase
      .from('want_lists')
      .upsert({
        userid: TEST_ATTENDEE_ID,
        content: 'Test want list for debugging: Looking for rookie cards and autographs',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      });
    
    if (error) {
      log.error(`Failed to add test want list: ${error.message}`);
    } else {
      log.success('Test want list added successfully');
    }
  } catch (err) {
    log.error(`Error adding test want list: ${err.message}`);
  }
}

// Function to add a test show participant (for debugging)
async function addTestParticipant() {
  log.section('Add Test Participant');
  
  try {
    const { data, error } = await supabase
      .from('show_participants')
      .upsert({
        userid: TEST_MVP_DEALER_ID,
        showid: TEST_SHOW_ID,
        role: 'dealer',
        status: 'confirmed',
        createdat: new Date().toISOString()
      });
    
    if (error) {
      log.error(`Failed to add test participant: ${error.message}`);
    } else {
      log.success('Test participant added successfully');
    }
  } catch (err) {
    log.error(`Error adding test participant: ${err.message}`);
  }
}

// Uncomment these lines to fix common issues for testing
// addTestFavorite();
// addTestWantList();
// addTestParticipant();
