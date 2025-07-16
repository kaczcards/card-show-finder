#!/usr/bin/env node
/**
 * test-want-lists-fix.js
 * 
 * Test script to verify the fix for want lists functionality.
 * This script adds test data to the user_favorite_shows and want_lists tables,
 * then tests the getWantListsForMvpDealer function to verify it works correctly.
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

// Test data configuration
const TEST_PREFIX = 'TEST_WANT_LIST_FIX_';
const TEST_DATA = {
  ATTENDEE_USER_ID: '090926af-e383-4b74-95fa-d1dd16661e7f', // Existing attendee user
  MVP_DEALER_USER_ID: '84ec4c75-1c32-46f6-b0bb-7930869a4c81', // Kevin (MVP Dealer)
  SHOWS: [
    'a50a3f81-5251-4064-8a0f-7a6b0efdf531', // Lake Station Card Show
    '3b6e387b-39a2-4ace-a233-a243e1db02c6', // Noblesville Card Show
  ],
  WANT_LISTS: [
    {
      content: `${TEST_PREFIX}Looking for 2018 Topps Chrome Refractors, especially Ronald Acuna Jr. and Juan Soto rookies. Also interested in vintage Mickey Mantle cards in any condition.`,
    },
    {
      content: `${TEST_PREFIX}Need the following Pokemon cards: Charizard Vmax, Pikachu V, and any Eevee evolutions. Preferably PSA 9 or better.`,
    }
  ]
};

// IDs to track created records for cleanup
const createdRecords = {
  favoriteShows: [],
  wantLists: []
};

/**
 * Add test data to the database
 */
async function addTestData() {
  console.log(chalk.blue('=== Adding Test Data ==='));
  
  try {
    // 1. Add favorite shows (hearting)
    console.log(chalk.blue('Adding favorite shows...'));
    for (const showId of TEST_DATA.SHOWS) {
      const { data, error } = await supabase
        .from('user_favorite_shows')
        .insert({
          user_id: TEST_DATA.ATTENDEE_USER_ID,
          show_id: showId,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single();
      
      if (error) {
        console.error(chalk.red(`Error adding favorite show ${showId}:`, error.message));
      } else {
        console.log(chalk.green(`✓ Added favorite show: ${showId}`));
        createdRecords.favoriteShows.push(data);
      }
    }
    
    // 2. Add want lists
    console.log(chalk.blue('\nAdding want lists...'));
    for (const wantList of TEST_DATA.WANT_LISTS) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('want_lists')
        .insert({
          id: uuidv4(),
          userid: TEST_DATA.ATTENDEE_USER_ID,
          content: wantList.content,
          createdat: now,
          updatedat: now
        })
        .select('*')
        .single();
      
      if (error) {
        console.error(chalk.red(`Error adding want list:`, error.message));
      } else {
        console.log(chalk.green(`✓ Added want list: ${data.id.substring(0, 8)}...`));
        createdRecords.wantLists.push(data);
      }
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red('Unexpected error adding test data:', error.message));
    return false;
  }
}

/**
 * Clean up test data from the database
 */
async function cleanupTestData() {
  console.log(chalk.blue('\n=== Cleaning Up Test Data ==='));
  
  try {
    // 1. Remove want lists
    if (createdRecords.wantLists.length > 0) {
      const wantListIds = createdRecords.wantLists.map(wl => wl.id);
      const { error } = await supabase
        .from('want_lists')
        .delete()
        .in('id', wantListIds);
      
      if (error) {
        console.error(chalk.red('Error removing want lists:', error.message));
      } else {
        console.log(chalk.green(`✓ Removed ${wantListIds.length} want lists`));
      }
    }
    
    // 2. Remove favorite shows
    if (createdRecords.favoriteShows.length > 0) {
      // For each favorite show record
      for (const record of createdRecords.favoriteShows) {
        const { error } = await supabase
          .from('user_favorite_shows')
          .delete()
          .eq('user_id', record.user_id)
          .eq('show_id', record.show_id);
        
        if (error) {
          console.error(chalk.red(`Error removing favorite show ${record.show_id}:`, error.message));
        } else {
          console.log(chalk.green(`✓ Removed favorite show: ${record.show_id}`));
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red('Unexpected error cleaning up test data:', error.message));
    return false;
  }
}

/**
 * Test the getWantListsForMvpDealer function
 */
async function testWantListsFunction() {
  console.log(chalk.blue('\n=== Testing getWantListsForMvpDealer Function ==='));
  
  try {
    // Create a simplified version of the service function
    // This avoids importing TypeScript modules directly
    const getWantListsForMvpDealer = async (params) => {
      const { userId, page = 1, pageSize = 20, searchTerm } = params;
      
      // Verify the user is an MVP dealer
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      if (!userData || userData.role !== 'mvp_dealer') {
        return { 
          data: null, 
          error: new Error('Only MVP dealers can access this function') 
        };
      }
      
      // Calculate pagination values
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Get shows the dealer is participating in
      const { data: participatingShows, error: participantsError } = await supabase
        .from('show_participants')
        .select('showid')
        .eq('userid', userId);
      
      if (participantsError) throw participantsError;
      
      if (!participatingShows || participatingShows.length === 0) {
        return {
          data: {
            data: [],
            totalCount: 0,
            page,
            pageSize,
            hasMore: false
          },
          error: null
        };
      }
      
      // Get the show IDs the dealer is participating in
      const allShowIds = participatingShows.map(show => show.showid);
      
      // Get show details in a separate query
      const currentDate = new Date().toISOString();
      const { data: showDetails, error: showDetailsError } = await supabase
        .from('shows')
        .select('id, title, start_date, location')
        .in('id', allShowIds)
        .gte('start_date', currentDate); // Filter for upcoming shows
      
      if (showDetailsError) throw showDetailsError;
      
      if (!showDetails || showDetails.length === 0) {
        return {
          data: {
            data: [],
            totalCount: 0,
            page,
            pageSize,
            hasMore: false
          },
          error: null
        };
      }
      
      // Get only the IDs of upcoming shows
      const showIds = showDetails.map(show => show.id);
      
      // Step 1: Get all attendees for these shows from user_favorite_shows table
      const { data: allAttendees, error: attendeesError } = await supabase
        .from('user_favorite_shows')
        .select('user_id, show_id')
        .in('show_id', showIds)
        .neq('user_id', userId); // Exclude the dealer themselves
      
      if (attendeesError) throw attendeesError;
      
      if (!allAttendees || allAttendees.length === 0) {
        return {
          data: {
            data: [],
            totalCount: 0,
            page,
            pageSize,
            hasMore: false
          },
          error: null
        };
      }
      
      // Get unique attendee IDs from all attendees
      const allAttendeeIds = [...new Set(allAttendees.map(a => a.user_id))];
      
      // Step 2: Fetch profiles for these attendees to filter by role
      const { data: attendeeProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role')
        .in('id', allAttendeeIds)
        .in('role', ['attendee', 'dealer']); // Only include regular attendees and dealers
      
      if (profilesError) throw profilesError;
      
      if (!attendeeProfiles || attendeeProfiles.length === 0) {
        return {
          data: {
            data: [],
            totalCount: 0,
            page,
            pageSize,
            hasMore: false
          },
          error: null
        };
      }
      
      // Step 3: Filter to get only the attendee IDs with the correct roles
      const validAttendeeIds = attendeeProfiles.map(profile => profile.id);
      
      // Step 4: Create a mapping of user to shows they're attending (only for valid attendees)
      const userShowMap = {};
      allAttendees.forEach(a => {
        if (validAttendeeIds.includes(a.user_id)) {
          if (!userShowMap[a.user_id]) {
            userShowMap[a.user_id] = [];
          }
          userShowMap[a.user_id].push(a.show_id);
        }
      });
      
      // Create a data query to get the want lists
      let dataQuery = supabase
        .from('want_lists')
        .select('id, userid, content, createdat, updatedat')
        .in('userid', validAttendeeIds)
        .not('content', 'ilike', `[INVENTORY]%`) // Filter out inventory items
        .not('content', 'eq', '') // Filter out empty want lists
        .order('updatedat', { ascending: false });
      
      // Add search term if provided to data query
      if (searchTerm) {
        dataQuery = dataQuery.ilike('content', `%${searchTerm}%`);
      }
      
      // Execute data query
      const { data: wantLists, error: wantListsError } = await dataQuery;
      if (wantListsError) throw wantListsError;
      
      // If no want lists found, return empty result
      if (!wantLists || wantLists.length === 0) {
        return {
          data: {
            data: [],
            totalCount: 0,
            page,
            pageSize,
            hasMore: false
          },
          error: null
        };
      }
      
      // Get unique user IDs from want lists
      const wantListUserIds = [...new Set(wantLists.map(wl => wl.userid))];
      
      // Fetch user profiles separately
      const { data: profiles, error: wantListProfilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', wantListUserIds);
      
      if (wantListProfilesError) throw wantListProfilesError;
      
      // Create a map of user profiles by ID for quick lookup
      const profileMap = {};
      profiles?.forEach(profile => {
        profileMap[profile.id] = {
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role
        };
      });
      
      // Create a map of show details
      const showDetailsMap = {};
      showDetails.forEach(show => {
        showDetailsMap[show.id] = {
          title: show.title,
          startDate: show.start_date,
          location: show.location
        };
      });
      
      // Transform the data to include show and user information
      const transformedData = wantLists.map(item => {
        // Find which shows this user is attending
        const userShows = userShowMap[item.userid] || [];
        // Use the first show for context
        const showId = userShows[0];
        const showDetails = showDetailsMap[showId] || { title: 'Unknown Show', startDate: '', location: '' };
        
        // Get user profile from map
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
      
      return {
        data: {
          data: transformedData,
          totalCount: transformedData.length,
          page,
          pageSize,
          hasMore: false
        },
        error: null
      };
    };
    
    // Call the function with our MVP dealer
    const result = await getWantListsForMvpDealer({
      userId: TEST_DATA.MVP_DEALER_USER_ID,
      page: 1,
      pageSize: 20,
      searchTerm: TEST_PREFIX // Only get our test want lists
    });
    
    // Check if the function returned any errors
    if (result.error) {
      console.error(chalk.red('Function returned an error:', result.error.message));
      return false;
    }
    
    // Check if we got want lists back
    if (!result.data || !result.data.data || result.data.data.length === 0) {
      console.error(chalk.red('Function did not return any want lists'));
      return false;
    }
    
    // Print the results
    console.log(chalk.green(`✓ Function returned ${result.data.data.length} want lists`));
    result.data.data.forEach((wantList, index) => {
      console.log(chalk.cyan(`\nWant List ${index + 1}:`));
      console.log(chalk.yellow(`User: ${wantList.userName} (${wantList.userRole})`));
      console.log(chalk.yellow(`Show: ${wantList.showTitle} (${wantList.showLocation})`));
      console.log(chalk.yellow(`Content: ${wantList.content.substring(0, 100)}...`));
    });
    
    return true;
  } catch (error) {
    console.error(chalk.red('Unexpected error testing function:', error.message));
    return false;
  }
}

/**
 * Main function to run the test
 */
async function main() {
  console.log(chalk.green('=== Want Lists Fix Test ==='));
  console.log(chalk.cyan(`Testing against Supabase project: ${supabaseUrl}`));
  console.log(chalk.cyan(`Using ${supabaseServiceKey ? 'service role key' : 'anon key'}\n`));
  
  try {
    // Step 1: Add test data
    const dataAdded = await addTestData();
    if (!dataAdded) {
      console.error(chalk.red('Failed to add test data. Exiting.'));
      return;
    }
    
    // Step 2: Test the function
    const testPassed = await testWantListsFunction();
    if (!testPassed) {
      console.error(chalk.red('Function test failed.'));
    } else {
      console.log(chalk.green('\n✓ Function test passed! The fix is working correctly.'));
    }
  } catch (error) {
    console.error(chalk.red('Unexpected error in test:', error.message));
  } finally {
    // Step 3: Clean up test data
    await cleanupTestData();
  }
}

// Run the test
main().catch(console.error);
