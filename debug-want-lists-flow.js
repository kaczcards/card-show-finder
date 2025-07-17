#!/usr/bin/env node
/**
 * debug-want-lists-flow.js
 * 
 * Comprehensive debug script to diagnose issues with the want lists feature.
 * This script traces the entire data flow from attendee favorites through
 * to MVP dealer want list viewing, checking each step for potential issues.
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');

// Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error(chalk.red('Error: Missing EXPO_PUBLIC_SUPABASE_URL environment variable'));
  process.exit(1);
}

// Create Supabase client with service role for admin operations if available
// Otherwise use anon key (which might be subject to RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

// User IDs for testing - update these with your actual user IDs
const TEST_DATA = {
  // Known MVP dealer from previous tests
  MVP_DEALER_USER_ID: '84ec4c75-1c32-46f6-b0bb-7930869a4c81', // Kevin (MVP dealer)
  // Known attendee from previous tests
  ATTENDEE_USER_ID: '090926af-e383-4b74-95fa-d1dd16661e7f', // Attend 01 (attendee)
  // Add more test users if needed
  SHOW_ORGANIZER_USER_ID: 'eb10066f-8064-439e-9ea5-6a50f29957e0', // Show Org 01
};

/**
 * Check if the attendee has favorited any shows
 */
async function checkAttendeeFavorites() {
  console.log(chalk.blue('\n=== 1. Checking Attendee Favorites ==='));
  console.log(chalk.cyan(`Attendee User ID: ${TEST_DATA.ATTENDEE_USER_ID}`));
  
  try {
    // Query user_favorite_shows table for the attendee
    const { data: favorites, error } = await supabase
      .from('user_favorite_shows')
      .select('show_id, created_at')
      .eq('user_id', TEST_DATA.ATTENDEE_USER_ID);
    
    if (error) {
      console.error(chalk.red('Error querying favorites:', error.message));
      console.log(chalk.yellow('This might be an RLS issue. The service key should bypass RLS.'));
      return { success: false, data: null };
    }
    
    if (!favorites || favorites.length === 0) {
      console.log(chalk.yellow('❌ No favorited shows found for this attendee.'));
      console.log(chalk.yellow('   The attendee needs to heart/favorite shows through the UI.'));
      return { success: false, data: null };
    }
    
    console.log(chalk.green(`✓ Found ${favorites.length} favorited shows for this attendee:`));
    favorites.forEach((fav, i) => {
      console.log(chalk.green(`  ${i+1}. Show ID: ${fav.show_id}`));
      console.log(chalk.green(`     Favorited at: ${fav.created_at}`));
    });
    
    // Get show details for these favorites
    const showIds = favorites.map(f => f.show_id);
    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('id, title, start_date, location')
      .in('id', showIds);
    
    if (showsError) {
      console.error(chalk.red('Error querying show details:', showsError.message));
      return { success: true, data: { favorites, showIds } };
    }
    
    if (shows && shows.length > 0) {
      console.log(chalk.green('\nShow details:'));
      shows.forEach((show, i) => {
        const isPastShow = new Date(show.start_date) < new Date();
        const dateColor = isPastShow ? chalk.red : chalk.green;
        console.log(chalk.green(`  ${i+1}. ${show.title}`));
        console.log(chalk.green(`     ID: ${show.id}`));
        console.log(`     Date: ${dateColor(show.start_date)} ${isPastShow ? '(PAST SHOW)' : ''}`);
        console.log(chalk.green(`     Location: ${show.location}`));
      });
      
      // Check if any shows are in the past
      const pastShows = shows.filter(show => new Date(show.start_date) < new Date());
      if (pastShows.length > 0) {
        console.log(chalk.yellow(`\n⚠️ Warning: ${pastShows.length} of ${shows.length} favorited shows are in the past.`));
        console.log(chalk.yellow('   The service function filters for upcoming shows only (start_date >= now()).'));
      }
    }
    
    return { success: true, data: { favorites, showIds, shows } };
  } catch (error) {
    console.error(chalk.red('Unexpected error checking favorites:', error.message));
    return { success: false, data: null };
  }
}

/**
 * Check if the attendee has created any want lists
 */
async function checkAttendeeWantLists() {
  console.log(chalk.blue('\n=== 2. Checking Attendee Want Lists ==='));
  console.log(chalk.cyan(`Attendee User ID: ${TEST_DATA.ATTENDEE_USER_ID}`));
  
  try {
    // Query want_lists table for the attendee
    const { data: wantLists, error } = await supabase
      .from('want_lists')
      .select('id, content, createdat, updatedat')
      .eq('userid', TEST_DATA.ATTENDEE_USER_ID);
    
    if (error) {
      console.error(chalk.red('Error querying want lists:', error.message));
      console.log(chalk.yellow('This might be an RLS issue. The service key should bypass RLS.'));
      return { success: false, data: null };
    }
    
    if (!wantLists || wantLists.length === 0) {
      console.log(chalk.yellow('❌ No want lists found for this attendee.'));
      console.log(chalk.yellow('   The attendee needs to create a want list through the Collection screen.'));
      return { success: false, data: null };
    }
    
    console.log(chalk.green(`✓ Found ${wantLists.length} want lists for this attendee:`));
    wantLists.forEach((list, i) => {
      const isInventory = list.content && list.content.startsWith('[INVENTORY]');
      const contentColor = isInventory ? chalk.yellow : chalk.green;
      console.log(chalk.green(`  ${i+1}. ID: ${list.id}`));
      console.log(`     Content: ${contentColor(list.content?.substring(0, 50) + '...')}`);
      if (isInventory) {
        console.log(chalk.yellow('     ⚠️ This is an inventory list (starts with [INVENTORY]), which is filtered out.'));
      }
      console.log(chalk.green(`     Created: ${list.createdat}`));
      console.log(chalk.green(`     Updated: ${list.updatedat}`));
    });
    
    // Check if any want lists are empty or inventory lists
    const validWantLists = wantLists.filter(list => 
      list.content && 
      list.content.trim() !== '' && 
      !list.content.startsWith('[INVENTORY]')
    );
    
    if (validWantLists.length === 0) {
      console.log(chalk.yellow('\n⚠️ Warning: No valid want lists found.'));
      console.log(chalk.yellow('   Want lists that are empty or start with [INVENTORY] are filtered out.'));
    } else {
      console.log(chalk.green(`\n✓ Found ${validWantLists.length} valid want lists.`));
    }
    
    return { success: true, data: { wantLists, validWantLists } };
  } catch (error) {
    console.error(chalk.red('Unexpected error checking want lists:', error.message));
    return { success: false, data: null };
  }
}

/**
 * Check which shows the MVP dealer is participating in
 */
async function checkMvpDealerShows() {
  console.log(chalk.blue('\n=== 3. Checking MVP Dealer Show Participation ==='));
  console.log(chalk.cyan(`MVP Dealer User ID: ${TEST_DATA.MVP_DEALER_USER_ID}`));
  
  try {
    // Verify the user is an MVP dealer
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', TEST_DATA.MVP_DEALER_USER_ID)
      .single();
    
    if (userError) {
      console.error(chalk.red('Error querying user profile:', userError.message));
      return { success: false, data: null };
    }
    
    if (!userData) {
      console.log(chalk.yellow('❌ User not found.'));
      return { success: false, data: null };
    }
    
    if (userData.role !== 'mvp_dealer') {
      console.log(chalk.yellow(`❌ User is not an MVP dealer. Role: ${userData.role}`));
      console.log(chalk.yellow('   The want lists feature is only available to MVP dealers and show organizers.'));
      return { success: false, data: null };
    }
    
    console.log(chalk.green(`✓ User is an MVP dealer: ${userData.first_name} ${userData.last_name || ''}`));
    
    // Query show_participants table for the MVP dealer
    const { data: participatingShows, error } = await supabase
      .from('show_participants')
      .select('showid, role, status, createdat')
      .eq('userid', TEST_DATA.MVP_DEALER_USER_ID);
    
    if (error) {
      console.error(chalk.red('Error querying participating shows:', error.message));
      return { success: false, data: null };
    }
    
    if (!participatingShows || participatingShows.length === 0) {
      console.log(chalk.yellow('❌ No participating shows found for this MVP dealer.'));
      console.log(chalk.yellow('   The MVP dealer needs to register for shows.'));
      return { success: false, data: null };
    }
    
    console.log(chalk.green(`✓ Found ${participatingShows.length} participating shows for this MVP dealer:`));
    participatingShows.forEach((show, i) => {
      console.log(chalk.green(`  ${i+1}. Show ID: ${show.showid}`));
      console.log(chalk.green(`     Role: ${show.role}`));
      console.log(chalk.green(`     Status: ${show.status}`));
      console.log(chalk.green(`     Registered at: ${show.createdat}`));
    });
    
    // Get show details for these participations
    const showIds = participatingShows.map(p => p.showid);
    const currentDate = new Date().toISOString();
    
    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('id, title, start_date, location')
      .in('id', showIds);
    
    if (showsError) {
      console.error(chalk.red('Error querying show details:', showsError.message));
      return { success: true, data: { participatingShows, showIds } };
    }
    
    if (shows && shows.length > 0) {
      console.log(chalk.green('\nShow details:'));
      shows.forEach((show, i) => {
        const isPastShow = new Date(show.start_date) < new Date();
        const dateColor = isPastShow ? chalk.red : chalk.green;
        console.log(chalk.green(`  ${i+1}. ${show.title}`));
        console.log(chalk.green(`     ID: ${show.id}`));
        console.log(`     Date: ${dateColor(show.start_date)} ${isPastShow ? '(PAST SHOW)' : ''}`);
        console.log(chalk.green(`     Location: ${show.location}`));
      });
      
      // Check for upcoming shows
      const upcomingShows = shows.filter(show => new Date(show.start_date) >= new Date());
      if (upcomingShows.length === 0) {
        console.log(chalk.yellow('\n⚠️ Warning: No upcoming shows found for this MVP dealer.'));
        console.log(chalk.yellow('   The service function filters for upcoming shows only (start_date >= now()).'));
      } else {
        console.log(chalk.green(`\n✓ Found ${upcomingShows.length} upcoming shows.`));
      }
    }
    
    return { 
      success: true, 
      data: { 
        participatingShows, 
        showIds, 
        shows,
        upcomingShows: shows?.filter(show => new Date(show.start_date) >= new Date()) || []
      } 
    };
  } catch (error) {
    console.error(chalk.red('Unexpected error checking MVP dealer shows:', error.message));
    return { success: false, data: null };
  }
}

/**
 * Check for overlap between attendee favorites and MVP dealer shows
 */
async function checkOverlap(favoritesResult, mvpDealerResult) {
  console.log(chalk.blue('\n=== 4. Checking Overlap Between Attendee Favorites and MVP Dealer Shows ==='));
  
  if (!favoritesResult.success || !favoritesResult.data) {
    console.log(chalk.yellow('❌ No attendee favorites data available.'));
    return { success: false };
  }
  
  if (!mvpDealerResult.success || !mvpDealerResult.data) {
    console.log(chalk.yellow('❌ No MVP dealer shows data available.'));
    return { success: false };
  }
  
  const attendeeShowIds = favoritesResult.data.showIds || [];
  const mvpDealerShowIds = mvpDealerResult.data.showIds || [];
  
  // Find overlap
  const overlapShowIds = attendeeShowIds.filter(id => mvpDealerShowIds.includes(id));
  
  if (overlapShowIds.length === 0) {
    console.log(chalk.yellow('❌ No overlap found between attendee favorites and MVP dealer shows.'));
    console.log(chalk.yellow('   The attendee needs to favorite shows that the MVP dealer is participating in.'));
    return { success: false };
  }
  
  console.log(chalk.green(`✓ Found ${overlapShowIds.length} overlapping shows:`));
  overlapShowIds.forEach((id, i) => {
    console.log(chalk.green(`  ${i+1}. Show ID: ${id}`));
  });
  
  // Check if any of the overlapping shows are upcoming
  if (mvpDealerResult.data.shows) {
    const upcomingOverlapShows = mvpDealerResult.data.shows
      .filter(show => overlapShowIds.includes(show.id) && new Date(show.start_date) >= new Date());
    
    if (upcomingOverlapShows.length === 0) {
      console.log(chalk.yellow('\n⚠️ Warning: No upcoming overlapping shows found.'));
      console.log(chalk.yellow('   The service function filters for upcoming shows only (start_date >= now()).'));
    } else {
      console.log(chalk.green(`\n✓ Found ${upcomingOverlapShows.length} upcoming overlapping shows:`));
      upcomingOverlapShows.forEach((show, i) => {
        console.log(chalk.green(`  ${i+1}. ${show.title} (${show.id})`));
        console.log(chalk.green(`     Date: ${show.start_date}`));
        console.log(chalk.green(`     Location: ${show.location}`));
      });
    }
    
    return { 
      success: true, 
      data: { 
        overlapShowIds, 
        upcomingOverlapShows 
      } 
    };
  }
  
  return { success: true, data: { overlapShowIds } };
}

/**
 * Simulate the exact query logic from the service function
 */
async function simulateServiceFunction(favoritesResult, wantListsResult, mvpDealerResult, overlapResult) {
  console.log(chalk.blue('\n=== 5. Simulating Service Function Logic ==='));
  
  if (!overlapResult || !overlapResult.success) {
    console.log(chalk.yellow('❌ Cannot simulate service function without overlap data.'));
    return { success: false };
  }
  
  if (!wantListsResult || !wantListsResult.success || !wantListsResult.data) {
    console.log(chalk.yellow('❌ Cannot simulate service function without want lists data.'));
    return { success: false };
  }
  
  try {
    // 1. Get upcoming shows the MVP dealer is participating in
    const upcomingShowIds = mvpDealerResult.data.upcomingShows?.map(show => show.id) || [];
    
    if (upcomingShowIds.length === 0) {
      console.log(chalk.yellow('❌ No upcoming shows found for the MVP dealer.'));
      console.log(chalk.yellow('   The service function filters for upcoming shows only.'));
      return { success: false };
    }
    
    console.log(chalk.green(`✓ Found ${upcomingShowIds.length} upcoming shows for the MVP dealer.`));
    
    // 2. Get attendees who favorited these shows
    const { data: attendees, error: attendeesError } = await supabase
      .from('user_favorite_shows')
      .select('user_id, show_id')
      .in('show_id', upcomingShowIds)
      .neq('user_id', TEST_DATA.MVP_DEALER_USER_ID);
    
    if (attendeesError) {
      console.error(chalk.red('Error querying attendees:', attendeesError.message));
      return { success: false };
    }
    
    if (!attendees || attendees.length === 0) {
      console.log(chalk.yellow('❌ No attendees found who favorited the MVP dealer\'s upcoming shows.'));
      return { success: false };
    }
    
    console.log(chalk.green(`✓ Found ${attendees.length} attendee favorites for the MVP dealer's upcoming shows.`));
    
    // 3. Get unique attendee IDs
    const attendeeIds = [...new Set(attendees.map(a => a.user_id))];
    console.log(chalk.green(`✓ Found ${attendeeIds.length} unique attendees.`));
    
    // 4. Filter attendees by role (exclude MVP dealers and show organizers)
    const { data: attendeeProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .in('id', attendeeIds)
      .in('role', ['attendee', 'dealer']);
    
    if (profilesError) {
      console.error(chalk.red('Error querying attendee profiles:', profilesError.message));
      return { success: false };
    }
    
    if (!attendeeProfiles || attendeeProfiles.length === 0) {
      console.log(chalk.yellow('❌ No attendees found with appropriate roles (attendee or dealer).'));
      console.log(chalk.yellow('   The service function filters out other MVP dealers and show organizers.'));
      return { success: false };
    }
    
    console.log(chalk.green(`✓ Found ${attendeeProfiles.length} attendees with appropriate roles.`));
    attendeeProfiles.forEach((profile, i) => {
      console.log(chalk.green(`  ${i+1}. ${profile.first_name} ${profile.last_name || ''} (${profile.role})`));
    });
    
    // 5. Get valid attendee IDs
    const validAttendeeIds = attendeeProfiles.map(profile => profile.id);
    
    // 6. Get want lists for these attendees
    const { data: wantLists, error: wantListsError } = await supabase
      .from('want_lists')
      .select('id, userid, content, createdat, updatedat')
      .in('userid', validAttendeeIds)
      .not('content', 'ilike', '[INVENTORY]%')
      .not('content', 'eq', '');
    
    if (wantListsError) {
      console.error(chalk.red('Error querying want lists:', wantListsError.message));
      return { success: false };
    }
    
    if (!wantLists || wantLists.length === 0) {
      console.log(chalk.yellow('❌ No valid want lists found for the attendees.'));
      return { success: false };
    }
    
    console.log(chalk.green(`✓ Found ${wantLists.length} valid want lists for the attendees.`));
    
    // 7. Create a mapping of user to shows they're attending
    const userShowMap = {};
    attendees.forEach(a => {
      if (validAttendeeIds.includes(a.user_id)) {
        if (!userShowMap[a.user_id]) {
          userShowMap[a.user_id] = [];
        }
        userShowMap[a.user_id].push(a.show_id);
      }
    });
    
    // 8. Create a map of user profiles
    const profileMap = {};
    attendeeProfiles.forEach(profile => {
      profileMap[profile.id] = {
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role
      };
    });
    
    // 9. Create a map of show details
    const showDetailsMap = {};
    mvpDealerResult.data.shows?.forEach(show => {
      showDetailsMap[show.id] = {
        title: show.title,
        startDate: show.start_date,
        location: show.location
      };
    });
    
    // 10. Transform the data to include show and user information
    const transformedData = wantLists.map(item => {
      // Find which shows this user is attending
      const userShows = userShowMap[item.userid] || [];
      // Use the first show for context
      const showId = userShows[0];
      const showDetails = showDetailsMap[showId] || { title: 'Unknown Show', startDate: '', location: '' };
      
      // Get user profile
      const profile = profileMap[item.userid] || { firstName: 'Unknown', lastName: '', role: 'attendee' };
      
      return {
        id: item.id,
        userId: item.userid,
        userName: `${profile.firstName} ${profile.lastName || ''}`.trim(),
        userRole: profile.role,
        content: item.content,
        createdAt: item.createdat,
        updatedAt: item.updatedat,
        showId: showId,
        showTitle: showDetails.title,
        showStartDate: showDetails.startDate,
        showLocation: showDetails.location
      };
    });
    
    console.log(chalk.green(`\n✓ Successfully transformed ${transformedData.length} want lists with user and show info.`));
    transformedData.forEach((item, i) => {
      console.log(chalk.green(`\nWant List ${i+1}:`));
      console.log(chalk.cyan(`User: ${item.userName} (${item.userRole})`));
      console.log(chalk.cyan(`Show: ${item.showTitle}`));
      console.log(chalk.cyan(`Date: ${item.showStartDate}`));
      console.log(chalk.cyan(`Location: ${item.showLocation}`));
      console.log(chalk.cyan(`Content: ${item.content.substring(0, 50)}...`));
    });
    
    return { success: true, data: { transformedData } };
  } catch (error) {
    console.error(chalk.red('Unexpected error simulating service function:', error.message));
    return { success: false };
  }
}

/**
 * Check for RLS issues by attempting operations with different auth contexts
 */
async function checkRlsIssues() {
  console.log(chalk.blue('\n=== 6. Checking for RLS Issues ==='));
  
  // Create a client with anon key to simulate app behavior
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
  
  try {
    console.log(chalk.cyan('Testing with anon key (subject to RLS):'));
    
    // Try to query user_favorite_shows
    const { data: favData, error: favError } = await anonClient
      .from('user_favorite_shows')
      .select('*')
      .limit(1);
    
    console.log(chalk.cyan('Can query user_favorite_shows?'), !favError ? chalk.green('✓ Yes') : chalk.red('❌ No'));
    if (favError) {
      console.log(chalk.red(`Error: ${favError.message}`));
    }
    
    // Try to query want_lists
    const { data: wantData, error: wantError } = await anonClient
      .from('want_lists')
      .select('*')
      .limit(1);
    
    console.log(chalk.cyan('Can query want_lists?'), !wantError ? chalk.green('✓ Yes') : chalk.red('❌ No'));
    if (wantError) {
      console.log(chalk.red(`Error: ${wantError.message}`));
    }
    
    // Try to query show_participants
    const { data: partData, error: partError } = await anonClient
      .from('show_participants')
      .select('*')
      .limit(1);
    
    console.log(chalk.cyan('Can query show_participants?'), !partError ? chalk.green('✓ Yes') : chalk.red('❌ No'));
    if (partError) {
      console.log(chalk.red(`Error: ${partError.message}`));
    }
    
    // Try to add a favorite show
    const { error: insertFavError } = await anonClient
      .from('user_favorite_shows')
      .insert({
        user_id: TEST_DATA.ATTENDEE_USER_ID,
        show_id: '00000000-0000-0000-0000-000000000000', // Fake ID
        created_at: new Date().toISOString()
      });
    
    console.log(chalk.cyan('Can insert into user_favorite_shows?'), !insertFavError ? chalk.green('✓ Yes') : chalk.red('❌ No'));
    if (insertFavError) {
      console.log(chalk.red(`Error: ${insertFavError.message}`));
    }
    
    // Try to add a want list
    const { error: insertWantError } = await anonClient
      .from('want_lists')
      .insert({
        userid: TEST_DATA.ATTENDEE_USER_ID,
        content: 'Test want list',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      });
    
    console.log(chalk.cyan('Can insert into want_lists?'), !insertWantError ? chalk.green('✓ Yes') : chalk.red('❌ No'));
    if (insertWantError) {
      console.log(chalk.red(`Error: ${insertWantError.message}`));
    }
    
    console.log(chalk.yellow('\nRLS Analysis:'));
    console.log(chalk.yellow('If any of the above operations failed with RLS errors, it suggests that'));
    console.log(chalk.yellow('the app may not have sufficient permissions to perform these operations.'));
    console.log(chalk.yellow('This could explain why the want lists feature is not working as expected.'));
    
    return { success: true };
  } catch (error) {
    console.error(chalk.red('Unexpected error checking RLS issues:', error.message));
    return { success: false };
  }
}

/**
 * Main function to run all checks
 */
async function main() {
  console.log(chalk.green('=== Want Lists Debug Flow ==='));
  console.log(chalk.cyan(`Testing against Supabase project: ${supabaseUrl}`));
  console.log(chalk.cyan(`Using ${supabaseServiceKey ? 'service role key' : 'anon key'}`));
  
  try {
    // 1. Check attendee favorites
    const favoritesResult = await checkAttendeeFavorites();
    
    // 2. Check attendee want lists
    const wantListsResult = await checkAttendeeWantLists();
    
    // 3. Check MVP dealer shows
    const mvpDealerResult = await checkMvpDealerShows();
    
    // 4. Check for overlap
    const overlapResult = await checkOverlap(favoritesResult, mvpDealerResult);
    
    // 5. Simulate service function
    const simulationResult = await simulateServiceFunction(
      favoritesResult, 
      wantListsResult, 
      mvpDealerResult, 
      overlapResult
    );
    
    // 6. Check for RLS issues
    const rlsResult = await checkRlsIssues();
    
    // Summarize findings
    console.log(chalk.blue('\n=== Summary of Findings ==='));
    
    if (
      !favoritesResult.success || 
      !wantListsResult.success || 
      !mvpDealerResult.success || 
      !overlapResult.success || 
      !simulationResult.success
    ) {
      console.log(chalk.red('❌ Issues found in the data flow:'));
      
      if (!favoritesResult.success) {
        console.log(chalk.red('  • Attendee has not favorited any shows.'));
      }
      
      if (!wantListsResult.success) {
        console.log(chalk.red('  • Attendee has not created any valid want lists.'));
      }
      
      if (!mvpDealerResult.success) {
        console.log(chalk.red('  • MVP dealer is not participating in any shows.'));
      }
      
      if (favoritesResult.success && mvpDealerResult.success && !overlapResult.success) {
        console.log(chalk.red('  • No overlap between attendee favorites and MVP dealer shows.'));
      }
      
      if (overlapResult.success && !simulationResult.success) {
        console.log(chalk.red('  • Service function simulation failed.'));
      }
      
      console.log(chalk.yellow('\nRecommended Actions:'));
      console.log(chalk.yellow('1. Ensure the attendee has favorited shows that the MVP dealer is participating in.'));
      console.log(chalk.yellow('2. Ensure the attendee has created valid want lists.'));
      console.log(chalk.yellow('3. Ensure the MVP dealer is participating in upcoming shows.'));
      console.log(chalk.yellow('4. Check for RLS issues that might prevent the app from accessing the data.'));
    } else {
      console.log(chalk.green('✓ All checks passed! The want lists feature should be working.'));
      console.log(chalk.green('  If you\'re still experiencing issues, please check the app\'s UI implementation.'));
    }
    
    console.log(chalk.blue('\n=== End of Debug ==='));
  } catch (error) {
    console.error(chalk.red('Unexpected error in main function:', error.message));
  }
}

// Run the debug flow
main().catch(console.error);
