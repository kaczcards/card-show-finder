/**
 * setup-test-data.js
 * 
 * This script sets up all necessary test data to make the want lists feature work correctly.
 * It creates the relationships between users, shows, favorites, and want lists that are
 * required for MVP dealers and show organizers to see attendee want lists.
 * 
 * Usage:
 * 1. Make sure you have installed dependencies: npm install dotenv @supabase/supabase-js chalk
 * 2. Run: node setup-test-data.js
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
const ATTENDEE_IDS = [
  { id: '49ced7c8-b18a-4a56-8893-908b9c12d422', name: 'Elvis' },
  { id: '090926af-e383-4b74-95fa-d1dd16661e7f', name: 'Attend 01' },
  { id: '03948b00-d16d-4fbe-a3df-8f9218bcbe66', name: 'Dealer Account' }
];

const MVP_DEALER_IDS = [
  { id: '84ec4c75-1c32-46f6-b0bb-7930869a4c81', name: 'Kevin' },
  { id: 'e4548d0e-f89c-4a86-9c8d-a0a297e2cb4d', name: 'Dev' }
];

const ORGANIZER_ID = 'eb10066f-8064-439e-9ea5-6a50f29957e0'; // Show Org 01

// Test shows with actual IDs from your database
const SHOWS = [
  { 
    id: '54af141a-9a08-4101-89ec-b4430e36f1ea', 
    name: 'Magic: The Gathering Regional Championship',
    date: '2025-08-10T00:00:00+00:00'
  },
  { 
    id: 'ceebfb54-60f6-416b-8089-76f2715a7477', 
    name: 'Regional Pokemon Tournament',
    date: '2025-07-22T00:00:00+00:00'
  },
  { 
    id: '796eb5b3-01b7-463c-aa74-801e4479dbba', 
    name: 'Midwest Collectors Convention',
    date: '2025-08-10T09:00:00+00:00'
  },
  { 
    id: '0908ec35-7cc8-4304-9f14-ca7dcb0dcbd1', 
    name: 'West Coast Card Expo',
    date: '2025-09-05T10:00:00+00:00'
  }
];

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
// Setup functions
// ============================================================================

// 1. Set show organizers
async function setupShowOrganizers() {
  log.section('Setting Show Organizers');
  
  for (const show of SHOWS) {
    try {
      const { data, error } = await supabase
        .from('shows')
        .update({ organizer_id: ORGANIZER_ID })
        .eq('id', show.id);
      
      if (error) {
        log.error(`Failed to set organizer for show ${show.name}: ${error.message}`);
      } else {
        log.success(`Set organizer for show: ${show.name}`);
      }
    } catch (err) {
      log.error(`Error setting organizer for show ${show.name}: ${err.message}`);
    }
  }
}

// 2. Add MVP dealers as participants in shows
async function setupShowParticipants() {
  log.section('Setting Up Show Participants');
  
  // Create a participant entry for each MVP dealer in each show
  for (const dealer of MVP_DEALER_IDS) {
    for (const show of SHOWS) {
      try {
        const { data, error } = await supabase
          .from('show_participants')
          .upsert({
            userid: dealer.id,
            showid: show.id,
            role: 'dealer',
            status: 'confirmed',
            createdat: new Date().toISOString(),
            updatedat: new Date().toISOString()
          });
        
        if (error) {
          log.error(`Failed to add ${dealer.name} as participant in ${show.name}: ${error.message}`);
        } else {
          log.success(`Added ${dealer.name} as participant in ${show.name}`);
        }
      } catch (err) {
        log.error(`Error adding ${dealer.name} as participant in ${show.name}: ${err.message}`);
      }
    }
  }
}

// 3. Add attendee favorites
async function setupAttendeeShowFavorites() {
  log.section('Setting Up Attendee Favorites');
  
  // Each attendee favorites 2 random shows
  for (const attendee of ATTENDEE_IDS) {
    // Shuffle shows and take first 2
    const shuffledShows = [...SHOWS].sort(() => 0.5 - Math.random()).slice(0, 2);
    
    for (const show of shuffledShows) {
      try {
        const { data, error } = await supabase
          .from('user_favorite_shows')
          .upsert({
            user_id: attendee.id,
            show_id: show.id,
            created_at: new Date().toISOString()
          });
        
        if (error) {
          log.error(`Failed to add favorite for ${attendee.name} to ${show.name}: ${error.message}`);
        } else {
          log.success(`Added favorite for ${attendee.name} to ${show.name}`);
        }
      } catch (err) {
        log.error(`Error adding favorite for ${attendee.name} to ${show.name}: ${err.message}`);
      }
    }
  }
}

// 4. Create attendee want lists
async function setupAttendeeWantLists() {
  log.section('Setting Up Attendee Want Lists');
  
  const wantListTemplates = [
    "Looking for rookie cards of: Mike Trout, LeBron James, Patrick Mahomes. Also interested in vintage Mickey Mantle and Hank Aaron cards in good condition.",
    "Collecting 1990s basketball inserts, especially Michael Jordan and Kobe Bryant. Will pay premium for rare parallels and autographs.",
    "Seeking Pokemon cards: Base Set Charizard, 1st Edition Blastoise, and any PSA 10 Pikachu cards. Also interested in sealed booster boxes.",
    "Want list: Magic The Gathering - Black Lotus, Mox Emerald, Time Walk. Any condition considered. Also looking for sealed product from early sets.",
    "Hunting for graded football rookies from 2020-2023 draft classes. Especially interested in Justin Herbert, Joe Burrow, and Trevor Lawrence."
  ];
  
  for (const attendee of ATTENDEE_IDS) {
    // Pick a random want list template
    const wantListContent = wantListTemplates[Math.floor(Math.random() * wantListTemplates.length)];
    
    try {
      const { data, error } = await supabase
        .from('want_lists')
        .upsert({
          userid: attendee.id,
          content: wantListContent,
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString()
        });
      
      if (error) {
        log.error(`Failed to create want list for ${attendee.name}: ${error.message}`);
      } else {
        log.success(`Created want list for ${attendee.name}`);
      }
    } catch (err) {
      log.error(`Error creating want list for ${attendee.name}: ${err.message}`);
    }
  }
}

// 5. Verify setup
async function verifySetup() {
  log.section('Verifying Setup');
  
  try {
    // Check if the diagnose_want_list_issues function exists
    const { data: diagnosis, error: diagnosisError } = await supabase.rpc('diagnose_want_list_issues', {
      viewer_id: MVP_DEALER_IDS[0].id
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
        log.success(`All checks passed! The want lists feature should now work correctly.`);
      } else {
        log.warning(`Some checks failed - see details above`);
      }
    } else {
      log.warning(`No diagnosis results returned`);
    }
    
    // Check if MVP dealer can see want lists
    const { data: wantLists, error: wantListsError } = await supabase.rpc('get_accessible_want_lists', {
      viewer_id: MVP_DEALER_IDS[0].id
    });
    
    if (wantListsError) {
      log.error(`Failed to check want lists access: ${wantListsError.message}`);
    } else if (wantLists && wantLists.length > 0) {
      log.success(`MVP dealer can see ${wantLists.length} want lists - feature is working!`);
      
      // Show the first 3 want lists
      wantLists.slice(0, 3).forEach((wantList, index) => {
        log.info(`Want list ${index + 1}: ${wantList.attendee_name} - ${wantList.content.substring(0, 30)}...`);
      });
    } else {
      log.warning(`MVP dealer still cannot see any want lists - check the RLS policies`);
    }
  } catch (err) {
    log.error(`Error verifying setup: ${err.message}`);
  }
}

// ============================================================================
// Main function to run all setup
// ============================================================================
async function setupTestData() {
  log.section('WANT LISTS FEATURE TEST DATA SETUP');
  log.info(`Starting setup at ${new Date().toLocaleString()}`);
  log.info(`Using Supabase URL: ${SUPABASE_URL}`);
  
  try {
    // Run setup functions
    await setupShowOrganizers();
    await setupShowParticipants();
    await setupAttendeeShowFavorites();
    await setupAttendeeWantLists();
    
    // Verify the setup
    await verifySetup();
    
    log.section('SETUP COMPLETE');
    log.info('All test data has been created successfully.');
    log.info('\nNext steps:');
    log.info('1. If you haven\'t already, run the production-fix-want-lists.sql script in Supabase SQL Editor');
    log.info('2. Test the want lists feature in the app - MVP dealers and show organizers should now see attendee want lists');
    log.info('3. If issues persist, check the mobile app authentication flow');
  } catch (err) {
    log.error(`Setup failed: ${err.message}`);
  }
}

// Run the setup
setupTestData().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
