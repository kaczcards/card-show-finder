/**
 * test-database-issues.js
 * 
 * This script tests the hasDatabaseIssues() function from CollectionScreen.tsx
 * to determine why the AttendeeWantLists component isn't showing.
 * 
 * It simulates the three data loading operations that might set error states:
 * 1. loadWantList
 * 2. loadUpcomingShows
 * 3. loadDealerInventory
 * 
 * Then it checks if any errors occurred that would trigger hasDatabaseIssues() to return true,
 * which would cause the setup message to show instead of the AttendeeWantLists component.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Constants - using exact MVP dealer ID from logs
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';

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

// Error state variables (simulating the React state variables)
let wantListError = null;
let showsError = null;
let inventoryError = null;

/**
 * Simulates the hasDatabaseIssues() function from CollectionScreen.tsx
 */
function hasDatabaseIssues() {
  // Check if any of the database-related functions encountered errors
  return !!(wantListError || showsError || inventoryError);
}

/**
 * Simulates the loadWantList function from CollectionScreen.tsx
 */
async function loadWantList() {
  console.log('\n=== Testing loadWantList ===');
  wantListError = null;
  
  try {
    console.log(`Loading want list for user ID: ${MVP_DEALER_ID}`);
    
    const { data, error } = await supabase
      .from('want_lists')
      .select('*')
      .eq('userid', MVP_DEALER_ID)
      .maybeSingle();
    
    if (error) {
      console.error('Error loading want list:', error.message);
      wantListError = error.message || 'Failed to load your want list';
      return null;
    }
    
    if (data) {
      console.log('Want list loaded successfully:');
      console.log({
        id: data.id,
        userId: data.userid,
        contentPreview: data.content ? 
          data.content.substring(0, 50) + (data.content.length > 50 ? '...' : '') : 
          'No content',
        createdAt: data.createdat,
        updatedAt: data.updatedat,
      });
      return data;
    } else {
      console.log('No want list found for this user');
      return null;
    }
  } catch (err) {
    console.error('Unhandled error in loadWantList:', err.message);
    wantListError = err.message || 'An unexpected error occurred';
    return null;
  } finally {
    console.log(`wantListError: ${wantListError || 'null'}`);
  }
}

/**
 * Simulates the loadUpcomingShows function from CollectionScreen.tsx
 */
async function loadUpcomingShows() {
  console.log('\n=== Testing loadUpcomingShows ===');
  showsError = null;
  
  try {
    console.log(`Loading upcoming shows for user ID: ${MVP_DEALER_ID}`);
    
    // Get current date
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now
    
    // Get show participations for the MVP dealer
    const { data: participations, error: partError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', MVP_DEALER_ID);
    
    if (partError) {
      console.error('Error getting show participations:', partError.message);
      showsError = partError.message || 'Failed to load your show participations';
      return [];
    }
    
    if (!participations || participations.length === 0) {
      console.log('No show participations found for this user');
      return [];
    }
    
    const showIds = participations.map(p => p.showid);
    
    // Get upcoming shows
    const { data: shows, error: showsQueryError } = await supabase
      .from('shows')
      .select('id, title, start_date, end_date, location')
      .in('id', showIds)
      .or(`end_date.gte.${startDate},and(end_date.is.null,start_date.gte.${startDate})`)
      .lte('start_date', endDate);
    
    if (showsQueryError) {
      console.error('Error getting upcoming shows:', showsQueryError.message);
      showsError = showsQueryError.message || 'Failed to load upcoming shows';
      return [];
    }
    
    if (shows && shows.length > 0) {
      console.log(`Found ${shows.length} upcoming shows:`);
      shows.forEach(show => {
        console.log(`- ${show.title} (${show.start_date})`);
      });
      return shows;
    } else {
      console.log('No upcoming shows found');
      return [];
    }
  } catch (err) {
    console.error('Unhandled error in loadUpcomingShows:', err.message);
    showsError = err.message || 'An unexpected error occurred';
    return [];
  } finally {
    console.log(`showsError: ${showsError || 'null'}`);
  }
}

/**
 * Simulates the loadDealerInventory function from CollectionScreen.tsx
 */
async function loadDealerInventory() {
  console.log('\n=== Testing loadDealerInventory ===');
  inventoryError = null;
  
  try {
    console.log(`Loading dealer inventory for user ID: ${MVP_DEALER_ID}`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('dealer_specialties')
      .eq('id', MVP_DEALER_ID)
      .single();
    
    if (error) {
      console.error('Error loading dealer inventory:', error.message);
      inventoryError = 'Failed to load your inventory. Please try again.';
      return '';
    }
    
    // Compute fetched string from dealer_specialties array
    const inventoryContent = (data?.dealer_specialties || []).join(', ');
    
    console.log('Dealer inventory loaded successfully:');
    console.log({
      specialties: data?.dealer_specialties || [],
      content: inventoryContent
    });
    
    return inventoryContent;
  } catch (err) {
    console.error('Unhandled error in loadDealerInventory:', err.message);
    inventoryError = 'An unexpected error occurred. Please try again.';
    return '';
  } finally {
    console.log(`inventoryError: ${inventoryError || 'null'}`);
  }
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log('======================================================');
  console.log('TESTING DATABASE ISSUES');
  console.log('======================================================');
  console.log(`MVP Dealer ID: ${MVP_DEALER_ID}`);
  console.log('======================================================');
  
  try {
    // Run all three data loading functions
    await loadWantList();
    await loadUpcomingShows();
    await loadDealerInventory();
    
    // Check if hasDatabaseIssues() would return true
    const hasIssues = hasDatabaseIssues();
    
    console.log('\n======================================================');
    console.log(`hasDatabaseIssues(): ${hasIssues}`);
    console.log('======================================================');
    
    console.log('\nError States:');
    console.log(`- wantListError: ${wantListError || 'null'}`);
    console.log(`- showsError: ${showsError || 'null'}`);
    console.log(`- inventoryError: ${inventoryError || 'null'}`);
    
    if (hasIssues) {
      console.log('\n⚠️ DATABASE ISSUES DETECTED');
      console.log('The setup message is showing instead of the AttendeeWantLists component');
      console.log('because one or more of the error states is not null.');
      
      if (wantListError) {
        console.log('\nFix for wantListError:');
        console.log('1. Check if the want_lists table exists and has the correct schema');
        console.log('2. Verify that the user has permission to access the want_lists table');
        console.log('3. Try creating a want list for the user if none exists');
      }
      
      if (showsError) {
        console.log('\nFix for showsError:');
        console.log('1. Check if the shows and show_participants tables exist and have the correct schema');
        console.log('2. Verify that the user has permission to access these tables');
        console.log('3. Register the user for upcoming shows if not already registered');
      }
      
      if (inventoryError) {
        console.log('\nFix for inventoryError:');
        console.log('1. Check if the profiles table exists and has the dealer_specialties column');
        console.log('2. Verify that the user has permission to access the profiles table');
        console.log('3. Set dealer_specialties for the user if not already set');
      }
    } else {
      console.log('\n✅ NO DATABASE ISSUES DETECTED');
      console.log('The AttendeeWantLists component should be showing.');
      console.log('If it\'s not visible, check for other issues:');
      console.log('1. The component might have a height of 0 or be hidden by CSS');
      console.log('2. There might be a z-index issue causing it to be behind other elements');
      console.log('3. The ScrollView might not be configured correctly');
      console.log('4. There might be a bug in the AttendeeWantLists component itself');
    }
    
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
    console.log('\nDatabase issues test completed.');
  });
