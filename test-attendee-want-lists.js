#!/usr/bin/env node
/**
 * test-attendee-want-lists.js
 * 
 * Test script to validate the attendee want lists functionality
 * This script tests the database schema, service functions, and permissions
 * for MVP Dealers and Show Organizers to view attendee want lists.
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');

// Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error(chalk.red('Error: Missing EXPO_PUBLIC_SUPABASE_URL environment variable'));
  process.exit(1);
}

if (!supabaseServiceKey && !supabaseAnonKey) {
  console.error(chalk.red('Error: Missing SUPABASE_SERVICE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable'));
  console.error(chalk.yellow('Note: SUPABASE_SERVICE_KEY is preferred for admin operations'));
  process.exit(1);
}

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

// Test configuration
const TEST_PREFIX = 'TEST_WANT_LIST_';
const TEST_USERS = {
  ATTENDEE: {
    email: `${TEST_PREFIX}attendee@example.com`,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Attendee',
    role: 'attendee',
  },
  DEALER: {
    email: `${TEST_PREFIX}dealer@example.com`,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Dealer',
    role: 'dealer',
  },
  MVP_DEALER: {
    email: `${TEST_PREFIX}mvp_dealer@example.com`,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'MVP Dealer',
    role: 'mvp_dealer',
  },
  SHOW_ORGANIZER: {
    email: `${TEST_PREFIX}organizer@example.com`,
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Organizer',
    role: 'show_organizer',
  },
};

// Test state
const testState = {
  users: {},
  shows: [],
  wantLists: [],
  testResults: {
    schema: {
      success: 0,
      failure: 0,
      details: [],
    },
    services: {
      success: 0,
      failure: 0,
      details: [],
    },
    permissions: {
      success: 0,
      failure: 0,
      details: [],
    },
    pagination: {
      success: 0,
      failure: 0,
      details: [],
    },
  },
};

// Helper function to log test results
function logTestResult(category, testName, success, details = '') {
  if (success) {
    testState.testResults[category].success++;
    console.log(chalk.green(`✓ ${testName}`));
  } else {
    testState.testResults[category].failure++;
    console.log(chalk.red(`✗ ${testName}`));
  }
  
  if (details) {
    console.log(chalk.gray(`  ${details}`));
  }
  
  testState.testResults[category].details.push({
    name: testName,
    success,
    details,
  });
}

// Helper function to create a test user
async function createTestUser(userConfig) {
  try {
    // Create the user with auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userConfig.email,
      password: userConfig.password,
      email_confirm: true,
    });
    
    if (authError) throw authError;
    
    const userId = authData.user.id;
    
    // Create the user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userConfig.email,
        firstName: userConfig.firstName,
        lastName: userConfig.lastName,
        role: userConfig.role,
        homeZipCode: '12345',
        isEmailVerified: true,
        accountType: userConfig.role === 'show_organizer' ? 'organizer' : 
                    (userConfig.role === 'mvp_dealer' || userConfig.role === 'dealer') ? 'dealer' : 'collector',
        subscriptionStatus: userConfig.role === 'mvp_dealer' ? 'active' : 'none',
      });
    
    if (profileError) throw profileError;
    
    return { id: userId, ...userConfig };
  } catch (error) {
    console.error(`Error creating test user ${userConfig.email}:`, error);
    throw error;
  }
}

// Helper function to create a test show
async function createTestShow(organizerId, title, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('shows')
      .insert({
        title,
        location: 'Test Location',
        address: '123 Test St, Test City, TS 12345',
        start_date: startDate,
        end_date: endDate,
        entry_fee: 5.00,
        organizer_id: organizerId,
        status: 'ACTIVE',
        coordinates: `POINT(-122.4194 37.7749)`, // San Francisco coordinates
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Error creating test show ${title}:`, error);
    throw error;
  }
}

// Helper function to create a test want list
async function createTestWantList(userId, content) {
  try {
    const { data, error } = await supabase
      .from('want_lists')
      .insert({
        userid: userId,
        content,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Error creating test want list for user ${userId}:`, error);
    throw error;
  }
}

// Helper function to register a user for a show
async function registerUserForShow(userId, showId, role = 'attendee') {
  try {
    const { data, error } = await supabase
      .from('show_participants')
      .insert({
        userid: userId,
        showid: showId,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Error registering user ${userId} for show ${showId}:`, error);
    throw error;
  }
}

// Helper function to share a want list with a show
async function shareWantList(userId, showId, wantListId) {
  try {
    const { data, error } = await supabase
      .from('shared_want_lists')
      .insert({
        userid: userId,
        showid: showId,
        wantlistid: wantListId,
        sharedat: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Error sharing want list ${wantListId} with show ${showId}:`, error);
    throw error;
  }
}

// Helper function to clean up test data
async function cleanupTestData() {
  try {
    console.log(chalk.yellow('\nCleaning up test data...'));
    
    // Delete shared want lists
    await supabase
      .from('shared_want_lists')
      .delete()
      .in('userid', Object.values(testState.users).map(user => user.id));
    
    // Delete show participants
    await supabase
      .from('show_participants')
      .delete()
      .in('userid', Object.values(testState.users).map(user => user.id));
    
    // Delete want lists
    await supabase
      .from('want_lists')
      .delete()
      .in('userid', Object.values(testState.users).map(user => user.id));
    
    // Delete shows
    await supabase
      .from('shows')
      .delete()
      .in('id', testState.shows.map(show => show.id));
    
    // Delete users
    for (const user of Object.values(testState.users)) {
      await supabase.auth.admin.deleteUser(user.id);
    }
    
    console.log(chalk.green('✓ Test data cleaned up successfully'));
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Test database schema
async function testDatabaseSchema() {
  console.log(chalk.blue('\n=== Testing Database Schema ==='));
  
  try {
    // Test show_participants table
    const { data: showParticipantsInfo, error: showParticipantsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'show_participants');
    
    if (showParticipantsError) throw showParticipantsError;
    
    const hasShowParticipantsTable = showParticipantsInfo && showParticipantsInfo.length > 0;
    logTestResult('schema', 'show_participants table exists', hasShowParticipantsTable);
    
    if (hasShowParticipantsTable) {
      const requiredColumns = ['id', 'userid', 'showid', 'role', 'created_at', 'updated_at'];
      const missingColumns = requiredColumns.filter(col => 
        !showParticipantsInfo.some(c => c.column_name === col)
      );
      
      logTestResult(
        'schema',
        'show_participants has required columns',
        missingColumns.length === 0,
        missingColumns.length > 0 ? `Missing columns: ${missingColumns.join(', ')}` : ''
      );
    }
    
    // Test want_lists table
    const { data: wantListsInfo, error: wantListsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'want_lists');
    
    if (wantListsError) throw wantListsError;
    
    const hasWantListsTable = wantListsInfo && wantListsInfo.length > 0;
    logTestResult('schema', 'want_lists table exists', hasWantListsTable);
    
    if (hasWantListsTable) {
      const requiredColumns = ['id', 'userid', 'content', 'createdat', 'updatedat'];
      const missingColumns = requiredColumns.filter(col => 
        !wantListsInfo.some(c => c.column_name === col)
      );
      
      logTestResult(
        'schema',
        'want_lists has required columns',
        missingColumns.length === 0,
        missingColumns.length > 0 ? `Missing columns: ${missingColumns.join(', ')}` : ''
      );
    }
    
    // Test shared_want_lists table
    const { data: sharedWantListsInfo, error: sharedWantListsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'shared_want_lists');
    
    if (sharedWantListsError) throw sharedWantListsError;
    
    const hasSharedWantListsTable = sharedWantListsInfo && sharedWantListsInfo.length > 0;
    logTestResult('schema', 'shared_want_lists table exists', hasSharedWantListsTable);
    
    if (hasSharedWantListsTable) {
      const requiredColumns = ['id', 'userid', 'showid', 'wantlistid', 'sharedat'];
      const missingColumns = requiredColumns.filter(col => 
        !sharedWantListsInfo.some(c => c.column_name === col)
      );
      
      logTestResult(
        'schema',
        'shared_want_lists has required columns',
        missingColumns.length === 0,
        missingColumns.length > 0 ? `Missing columns: ${missingColumns.join(', ')}` : ''
      );
    }
    
    // Test RLS policies
    const { data: rlsPolicies, error: rlsPoliciesError } = await supabase
      .from('pg_policies')
      .select('tablename, policyname')
      .in('tablename', ['show_participants', 'want_lists', 'shared_want_lists']);
    
    if (rlsPoliciesError) throw rlsPoliciesError;
    
    const hasRlsPolicies = rlsPolicies && rlsPolicies.length > 0;
    logTestResult('schema', 'RLS policies exist', hasRlsPolicies);
    
    if (hasRlsPolicies) {
      // Check for MVP dealer policies
      const hasMvpDealerPolicies = rlsPolicies.some(p => 
        p.policyname.includes('mvp_dealer')
      );
      
      logTestResult(
        'schema',
        'MVP Dealer RLS policies exist',
        hasMvpDealerPolicies
      );
      
      // Check for show organizer policies
      const hasOrganizerPolicies = rlsPolicies.some(p => 
        p.policyname.includes('organizer')
      );
      
      logTestResult(
        'schema',
        'Show Organizer RLS policies exist',
        hasOrganizerPolicies
      );
    }
  } catch (error) {
    console.error('Error testing database schema:', error);
    logTestResult('schema', 'Database schema tests', false, error.message);
  }
}

// Test service functions
async function testServiceFunctions() {
  console.log(chalk.blue('\n=== Testing Service Functions ==='));
  
  try {
    // Test creating a want list
    const testWantList = await createTestWantList(
      testState.users.ATTENDEE.id,
      'Test want list content for attendee'
    );
    
    logTestResult(
      'services',
      'Create want list',
      !!testWantList,
      testWantList ? `Want list ID: ${testWantList.id}` : ''
    );
    
    testState.wantLists.push(testWantList);
    
    // Test registering for a show
    const testParticipation = await registerUserForShow(
      testState.users.ATTENDEE.id,
      testState.shows[0].id
    );
    
    logTestResult(
      'services',
      'Register user for show',
      !!testParticipation,
      testParticipation ? `Participation ID: ${testParticipation.id}` : ''
    );
    
    // Test sharing a want list
    const testSharing = await shareWantList(
      testState.users.ATTENDEE.id,
      testState.shows[0].id,
      testWantList.id
    );
    
    logTestResult(
      'services',
      'Share want list with show',
      !!testSharing,
      testSharing ? `Sharing ID: ${testSharing.id}` : ''
    );
    
    // Register MVP dealer for the show
    await registerUserForShow(
      testState.users.MVP_DEALER.id,
      testState.shows[0].id,
      'dealer'
    );
    
    // Create a client for the MVP dealer
    const mvpDealerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Sign in as MVP dealer
    const { error: mvpSignInError } = await mvpDealerClient.auth.signInWithPassword({
      email: testState.users.MVP_DEALER.email,
      password: TEST_USERS.MVP_DEALER.password,
    });
    
    if (mvpSignInError) throw mvpSignInError;
    
    // Test MVP dealer can see want lists
    const { data: mvpWantLists, error: mvpWantListsError } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id);
    
    logTestResult(
      'services',
      'MVP dealer can see attendee want lists',
      mvpWantLists && mvpWantLists.length > 0,
      mvpWantListsError ? mvpWantListsError.message : ''
    );
    
    // Create a client for the show organizer
    const organizerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Sign in as show organizer
    const { error: organizerSignInError } = await organizerClient.auth.signInWithPassword({
      email: testState.users.SHOW_ORGANIZER.email,
      password: TEST_USERS.SHOW_ORGANIZER.password,
    });
    
    if (organizerSignInError) throw organizerSignInError;
    
    // Test show organizer can see want lists
    const { data: organizerWantLists, error: organizerWantListsError } = await organizerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id);
    
    logTestResult(
      'services',
      'Show organizer can see attendee want lists',
      organizerWantLists && organizerWantLists.length > 0,
      organizerWantListsError ? organizerWantListsError.message : ''
    );
    
    // Test regular dealer cannot see want lists
    const dealerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Sign in as regular dealer
    const { error: dealerSignInError } = await dealerClient.auth.signInWithPassword({
      email: testState.users.DEALER.email,
      password: TEST_USERS.DEALER.password,
    });
    
    if (dealerSignInError) throw dealerSignInError;
    
    // Test dealer cannot see want lists
    const { data: dealerWantLists, error: dealerWantListsError } = await dealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id);
    
    logTestResult(
      'services',
      'Regular dealer cannot see attendee want lists',
      !dealerWantLists || dealerWantLists.length === 0,
      dealerWantListsError ? dealerWantListsError.message : ''
    );
  } catch (error) {
    console.error('Error testing service functions:', error);
    logTestResult('services', 'Service function tests', false, error.message);
  }
}

// Test pagination and filtering
async function testPaginationAndFiltering() {
  console.log(chalk.blue('\n=== Testing Pagination and Filtering ==='));
  
  try {
    // Create multiple want lists for pagination testing
    const wantLists = [];
    for (let i = 1; i <= 15; i++) {
      const content = `Test want list ${i} - ${i % 3 === 0 ? 'Pokémon cards' : i % 3 === 1 ? 'Baseball cards' : 'Basketball cards'}`;
      const wantList = await createTestWantList(testState.users.ATTENDEE.id, content);
      wantLists.push(wantList);
      
      // Share with the show
      await shareWantList(testState.users.ATTENDEE.id, testState.shows[0].id, wantList.id);
    }
    
    // Create a client for the MVP dealer
    const mvpDealerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Sign in as MVP dealer
    const { error: mvpSignInError } = await mvpDealerClient.auth.signInWithPassword({
      email: testState.users.MVP_DEALER.email,
      password: TEST_USERS.MVP_DEALER.password,
    });
    
    if (mvpSignInError) throw mvpSignInError;
    
    // Test pagination - page 1, limit 5
    const { data: page1, error: page1Error } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id)
      .order('updatedat', { ascending: false })
      .range(0, 4); // First 5 items (0-4)
    
    logTestResult(
      'pagination',
      'Pagination - page 1 (5 items)',
      page1 && page1.length === 5,
      page1Error ? page1Error.message : `Got ${page1?.length} items`
    );
    
    // Test pagination - page 2, limit 5
    const { data: page2, error: page2Error } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id)
      .order('updatedat', { ascending: false })
      .range(5, 9); // Next 5 items (5-9)
    
    logTestResult(
      'pagination',
      'Pagination - page 2 (5 items)',
      page2 && page2.length === 5,
      page2Error ? page2Error.message : `Got ${page2?.length} items`
    );
    
    // Test filtering by content
    const { data: filteredPokemon, error: filterError } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id)
      .ilike('content', '%Pokémon%');
    
    const expectedPokemonCount = Math.ceil(15 / 3); // Every 3rd item is Pokemon
    
    logTestResult(
      'pagination',
      'Filtering by content (Pokémon)',
      filteredPokemon && filteredPokemon.length === expectedPokemonCount,
      filterError ? filterError.message : `Got ${filteredPokemon?.length} items, expected ${expectedPokemonCount}`
    );
    
    // Test filtering by content - baseball
    const { data: filteredBaseball, error: baseballFilterError } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id)
      .ilike('content', '%Baseball%');
    
    const expectedBaseballCount = Math.ceil(15 / 3); // Every 3rd item is Baseball
    
    logTestResult(
      'pagination',
      'Filtering by content (Baseball)',
      filteredBaseball && filteredBaseball.length === expectedBaseballCount,
      baseballFilterError ? baseballFilterError.message : `Got ${filteredBaseball?.length} items, expected ${expectedBaseballCount}`
    );
  } catch (error) {
    console.error('Error testing pagination and filtering:', error);
    logTestResult('pagination', 'Pagination and filtering tests', false, error.message);
  }
}

// Test permissions
async function testPermissions() {
  console.log(chalk.blue('\n=== Testing Permissions ==='));
  
  try {
    // Create a second show for testing
    const show2 = await createTestShow(
      testState.users.SHOW_ORGANIZER.id,
      `${TEST_PREFIX}Show 2`,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
    );
    
    testState.shows.push(show2);
    
    // Create a want list for the second attendee
    const attendee2WantList = await createTestWantList(
      testState.users.DEALER.id, // Using regular dealer as a second attendee
      'Test want list for second attendee'
    );
    
    testState.wantLists.push(attendee2WantList);
    
    // Register second attendee for second show only
    await registerUserForShow(
      testState.users.DEALER.id,
      show2.id,
      'attendee' // Participating as an attendee
    );
    
    // Share want list with second show
    await shareWantList(
      testState.users.DEALER.id,
      show2.id,
      attendee2WantList.id
    );
    
    // Create a client for the MVP dealer
    const mvpDealerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Sign in as MVP dealer
    const { error: mvpSignInError } = await mvpDealerClient.auth.signInWithPassword({
      email: testState.users.MVP_DEALER.email,
      password: TEST_USERS.MVP_DEALER.password,
    });
    
    if (mvpSignInError) throw mvpSignInError;
    
    // MVP dealer should only see want lists for shows they're participating in
    const { data: mvpWantLists1, error: mvpWantListsError1 } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id);
    
    logTestResult(
      'permissions',
      'MVP dealer can see want lists for shows they participate in',
      mvpWantLists1 && mvpWantLists1.length > 0,
      mvpWantListsError1 ? mvpWantListsError1.message : ''
    );
    
    // MVP dealer should not see want lists for shows they're not participating in
    const { data: mvpWantLists2, error: mvpWantListsError2 } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.DEALER.id);
    
    logTestResult(
      'permissions',
      'MVP dealer cannot see want lists for shows they do not participate in',
      !mvpWantLists2 || mvpWantLists2.length === 0,
      mvpWantListsError2 ? mvpWantListsError2.message : ''
    );
    
    // Create a client for the show organizer
    const organizerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Sign in as show organizer
    const { error: organizerSignInError } = await organizerClient.auth.signInWithPassword({
      email: testState.users.SHOW_ORGANIZER.email,
      password: TEST_USERS.SHOW_ORGANIZER.password,
    });
    
    if (organizerSignInError) throw organizerSignInError;
    
    // Show organizer should see want lists for both shows they organize
    const { data: organizerWantLists1, error: organizerWantListsError1 } = await organizerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.ATTENDEE.id);
    
    logTestResult(
      'permissions',
      'Show organizer can see want lists for attendees of their shows (Show 1)',
      organizerWantLists1 && organizerWantLists1.length > 0,
      organizerWantListsError1 ? organizerWantListsError1.message : ''
    );
    
    const { data: organizerWantLists2, error: organizerWantListsError2 } = await organizerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.DEALER.id);
    
    logTestResult(
      'permissions',
      'Show organizer can see want lists for attendees of their shows (Show 2)',
      organizerWantLists2 && organizerWantLists2.length > 0,
      organizerWantListsError2 ? organizerWantListsError2.message : ''
    );
    
    // Register MVP dealer for second show
    await registerUserForShow(
      testState.users.MVP_DEALER.id,
      show2.id,
      'dealer'
    );
    
    // Now MVP dealer should see want lists for both shows
    const { data: mvpWantLists3, error: mvpWantListsError3 } = await mvpDealerClient
      .from('want_lists')
      .select('id, content')
      .eq('userid', testState.users.DEALER.id);
    
    logTestResult(
      'permissions',
      'MVP dealer can see want lists for Show 2 after registering',
      mvpWantLists3 && mvpWantLists3.length > 0,
      mvpWantListsError3 ? mvpWantListsError3.message : ''
    );
  } catch (error) {
    console.error('Error testing permissions:', error);
    logTestResult('permissions', 'Permissions tests', false, error.message);
  }
}

// Main function to run all tests
async function main() {
  console.log(chalk.bold('\n=== Attendee Want Lists Test Suite ==='));
  console.log(chalk.gray(`Testing against Supabase project: ${supabaseUrl}`));
  console.log(chalk.gray(`Using ${supabaseServiceKey ? 'service role' : 'anon'} key`));
  
  try {
    console.log(chalk.blue('\n=== Setting up test data ==='));
    
    // Create test users
    for (const [role, config] of Object.entries(TEST_USERS)) {
      console.log(chalk.gray(`Creating ${role} user...`));
      testState.users[role] = await createTestUser(config);
    }
    
    // Create test show
    const show = await createTestShow(
      testState.users.SHOW_ORGANIZER.id,
      `${TEST_PREFIX}Show 1`,
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
    );
    
    testState.shows.push(show);
    
    console.log(chalk.green('✓ Test data created successfully'));
    
    // Run tests
    await testDatabaseSchema();
    await testServiceFunctions();
    await testPaginationAndFiltering();
    await testPermissions();
    
    // Print summary
    console.log(chalk.bold('\n=== Test Summary ==='));
    
    for (const [category, results] of Object.entries(testState.testResults)) {
      const total = results.success + results.failure;
      const successRate = total > 0 ? Math.round((results.success / total) * 100) : 0;
      
      console.log(chalk.bold(`\n${category.toUpperCase()} Tests:`));
      console.log(`${chalk.green(`✓ ${results.success} passed`)}, ${chalk.red(`✗ ${results.failure} failed`)}, ${total} total (${successRate}% success)`);
      
      if (results.failure > 0) {
        console.log(chalk.yellow('\nFailed tests:'));
        results.details
          .filter(detail => !detail.success)
          .forEach(detail => {
            console.log(chalk.red(`✗ ${detail.name}`));
            if (detail.details) {
              console.log(chalk.gray(`  ${detail.details}`));
            }
          });
      }
    }
    
    // Overall summary
    const totalSuccess = Object.values(testState.testResults).reduce((sum, result) => sum + result.success, 0);
    const totalFailure = Object.values(testState.testResults).reduce((sum, result) => sum + result.failure, 0);
    const totalTests = totalSuccess + totalFailure;
    const overallSuccessRate = totalTests > 0 ? Math.round((totalSuccess / totalTests) * 100) : 0;
    
    console.log(chalk.bold('\n=== Overall Results ==='));
    console.log(`${chalk.green(`✓ ${totalSuccess} passed`)}, ${chalk.red(`✗ ${totalFailure} failed`)}, ${totalTests} total (${overallSuccessRate}% success)`);
    
    if (totalFailure > 0) {
      console.log(chalk.yellow('\nSome tests failed. Please check the output above for details.'));
    } else {
      console.log(chalk.green('\nAll tests passed! The attendee want lists functionality is working correctly.'));
    }
  } catch (error) {
    console.error(chalk.red('\nTest suite failed with an unexpected error:'), error);
  } finally {
    // Clean up test data
    await cleanupTestData();
  }
}

// Run the tests
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
