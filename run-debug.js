/**
 * run-debug.js
 * 
 * Simplified diagnostic tool for troubleshooting the want lists feature
 * in the Card Show Finder app. This script uses real IDs from your database
 * to check all components of the data flow.
 * 
 * Usage:
 * node run-debug.js
 */

// Load environment variables from .env file
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');

// ============================================================================
// CONFIG - Using actual IDs from your database
// ============================================================================
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Test users with actual IDs from your database
const TEST_ATTENDEE_ID = '49ced7c8-b18a-4a56-8893-908b9c12d422'; // Elvis
const TEST_DEALER_ID = '50dddcd7-77b5-46d1-9072-22b7b93d5835';   // Dealer Acct
const TEST_MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81'; // Kevin
const TEST_ORGANIZER_ID = 'eb10066f-8064-439e-9ea5-6a50f29957e0'; // Show Org 01

// Test shows with actual IDs from your database
const TEST_SHOW_ID = '54af141a-9a08-4101-89ec-b4430e36f1ea'; // Magic: The Gathering Regional Championship
const TEST_SHOW_ID_2 = 'ceebfb54-60f6-416b-8089-76f2715a7477'; // Regional Pokemon Tournament

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

// 3. Check if show_participants table has the right data
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

// 4. Check if want_lists table has data
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

// 5. Check if MVP dealer can see attendee want lists
async function checkMvpDealerAccess() {
  log.section('MVP Dealer Access Check');
  
  try {
    // Get want lists for MVP dealer
    const { data, error } = await supabase.rpc('get_accessible_want_lists', {
      viewer_id: TEST_MVP_DEALER_ID
    });
    
    if (error) {
      log.error(`Failed to check MVP dealer access: ${error.message}`);
    } else if (data && data.length > 0) {
      log.success(`MVP dealer can see ${data.length} want lists`);
      
      // Show the first 3 want lists
      data.slice(0, 3).forEach((wantList, index) => {
        log.info(`Want list ${index + 1}: ${wantList.attendee_name} - ${wantList.content.substring(0, 30)}...`);
      });
    } else {
      log.warning(`MVP dealer cannot see any want lists`);
    }
  } catch (err) {
    log.error(`Error checking MVP dealer access: ${err.message}`);
  }
}

// 6. Check RLS policies
async function checkRLSPolicies() {
  log.section('RLS Policies Check');
  
  try {
    // Check if the diagnose_want_list_issues function exists
    const { data: diagnosis, error: diagnosisError } = await supabase.rpc('diagnose_want_list_issues', {
      viewer_id: TEST_MVP_DEALER_ID,
      test_attendee_id: TEST_ATTENDEE_ID,
      test_show_id: TEST_SHOW_ID
    });
    
    if (diagnosisError) {
      if (diagnosisError.message.includes('does not exist')) {
        log.warning(`The diagnose_want_list_issues function doesn't exist yet - you need to run the production-fix-want-lists.sql script first`);
      } else {
        log.error(`Failed to run diagnosis: ${diagnosisError.message}`);
      }
    } else if (diagnosis && diagnosis.length > 0) {
      log.info(`Diagnosis results:`);
      
      let allPassed = true;
      diagnosis.forEach(check => {
        if (check.status === 'PASS') {
          log.success(`${check.check_name}: ${check.details}`);
        } else {
          log.error(`${check.check_name}: ${check.details}`);
          allPassed = false;
        }
      });
      
      if (allPassed) {
        log.success(`All RLS policy checks passed!`);
      } else {
        log.warning(`Some RLS policy checks failed - see details above`);
      }
    } else {
      log.warning(`No diagnosis results returned`);
    }
  } catch (err) {
    log.error(`Error checking RLS policies: ${err.message}`);
  }
}

// ============================================================================
// Helper functions to fix common issues
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
        content: 'Test want list: Looking for rookie cards, autographs, and vintage baseball cards',
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

// ============================================================================
// Main function to run all checks
// ============================================================================
async function runDiagnostics() {
  log.section('WANT LISTS FEATURE DIAGNOSTICS');
  log.info(`Starting diagnostics at ${new Date().toLocaleString()}`);
  log.info(`Using Supabase URL: ${SUPABASE_URL}`);
  
  try {
    await checkDatabaseSchema();
    await checkFavoriteShowsData();
    await checkShowParticipants();
    await checkWantListsData();
    await checkMvpDealerAccess();
    await checkRLSPolicies();
    
    log.section('DIAGNOSTICS SUMMARY');
    log.info('Diagnostics completed. Review the output above for detailed findings.');
    log.info('\nTo fix common issues, uncomment these lines at the bottom of this file:');
    log.info('// await addTestFavorite();     // Makes attendee favorite a show');
    log.info('// await addTestWantList();     // Creates a want list for attendee');
    log.info('// await addTestParticipant();  // Makes MVP dealer participate in show');
    
    log.section('NEXT STEPS');
    log.info('1. Run the production-fix-want-lists.sql script in Supabase SQL Editor');
    log.info('2. Make sure attendees have favorited shows and created want lists');
    log.info('3. Ensure MVP dealers are participating in shows (in show_participants table)');
    log.info('4. Verify show dates are in the future (not past shows)');
    log.info('5. Check that the mobile app is making authenticated requests');
  } catch (err) {
    log.error(`Diagnostics failed: ${err.message}`);
  }
}

// Run the diagnostics
runDiagnostics().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

// Uncomment these lines to fix common issues:
// await addTestFavorite();     // Makes attendee favorite a show
// await addTestWantList();     // Creates a want list for attendee
// await addTestParticipant();  // Makes MVP dealer participate in show
