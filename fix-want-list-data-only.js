/**
 * fix-want-list-data-only.js
 * 
 * This script creates the necessary data to make want lists visible for MVP dealers.
 * It focuses only on creating the data without modifying the RPC function.
 * 
 * The script:
 * 1. Creates the MVP dealer profile if it doesn't exist
 * 2. Creates the attendee profile if it doesn't exist
 * 3. Registers both users for the show
 * 4. Creates sample want lists for the attendee
 * 5. Verifies all the data was created correctly
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Constants for the specific test case
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
const SHOW_ID = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
const ATTENDEE_ID = '090926af-e383-4b74-95fa-d1dd16661e7f';

// ---------------------------------------------------------------------------
// Supabase setup - use service role key for elevated privileges
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
 * Create or update the MVP dealer profile
 */
async function createMvpDealerProfile() {
  console.log('\n=== Creating MVP dealer profile ===');
  
  // First check if profile exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', MVP_DEALER_ID)
    .maybeSingle();
  
  if (checkError) {
    console.error(`Error checking MVP dealer profile: ${checkError.message}`);
    return false;
  }
  
  if (existingProfile) {
    console.log('MVP dealer profile exists, updating role...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'mvp_dealer',
        account_type: 'dealer',
        subscription_status: 'active',
        payment_status: 'paid',
        updated_at: new Date()
      })
      .eq('id', MVP_DEALER_ID);
    
    if (updateError) {
      console.error(`Error updating MVP dealer profile: ${updateError.message}`);
      return false;
    }
    
    console.log('MVP dealer profile updated successfully');
    return true;
  }
  
  console.log('Creating new MVP dealer profile...');
  
  const { error: insertError } = await supabase
    .from('profiles')
    .insert([{
      id: MVP_DEALER_ID,
      first_name: 'John',
      last_name: 'Dealer',
      email: 'mvp_dealer@example.com',
      role: 'mvp_dealer',
      home_zip_code: '90210',
      account_type: 'dealer',
      subscription_status: 'active',
      payment_status: 'paid',
      created_at: new Date(),
      updated_at: new Date()
    }]);
  
  if (insertError) {
    console.error(`Error creating MVP dealer profile: ${insertError.message}`);
    return false;
  }
  
  console.log('MVP dealer profile created successfully');
  return true;
}

/**
 * Create or update the attendee profile
 */
async function createAttendeeProfile() {
  console.log('\n=== Creating attendee profile ===');
  
  // First check if profile exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', ATTENDEE_ID)
    .maybeSingle();
  
  if (checkError) {
    console.error(`Error checking attendee profile: ${checkError.message}`);
    return false;
  }
  
  if (existingProfile) {
    console.log('Attendee profile exists, updating role...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'attendee',
        account_type: 'collector',
        subscription_status: 'none',
        payment_status: 'none',
        updated_at: new Date()
      })
      .eq('id', ATTENDEE_ID);
    
    if (updateError) {
      console.error(`Error updating attendee profile: ${updateError.message}`);
      return false;
    }
    
    console.log('Attendee profile updated successfully');
    return true;
  }
  
  console.log('Creating new attendee profile...');
  
  const { error: insertError } = await supabase
    .from('profiles')
    .insert([{
      id: ATTENDEE_ID,
      first_name: 'Alice',
      last_name: 'Attendee',
      email: 'attendee@example.com',
      role: 'attendee',
      home_zip_code: '90210',
      account_type: 'collector',
      subscription_status: 'none',
      payment_status: 'none',
      created_at: new Date(),
      updated_at: new Date()
    }]);
  
  if (insertError) {
    console.error(`Error creating attendee profile: ${insertError.message}`);
    return false;
  }
  
  console.log('Attendee profile created successfully');
  return true;
}

/**
 * Register users for the show
 */
async function registerUsersForShow() {
  console.log('\n=== Registering users for the show ===');
  
  // First check if the show exists
  const { data: show, error: showError } = await supabase
    .from('shows')
    .select('*')
    .eq('id', SHOW_ID)
    .maybeSingle();
  
  if (showError) {
    console.error(`Error checking show: ${showError.message}`);
    return false;
  }
  
  if (!show) {
    console.error(`Show with ID ${SHOW_ID} does not exist!`);
    return false;
  }
  
  console.log(`Found show: ${show.title}`);
  
  // Register MVP dealer
  const { data: mvpDealerParticipation, error: mvpCheckError } = await supabase
    .from('show_participants')
    .select('*')
    .eq('userid', MVP_DEALER_ID)
    .eq('showid', SHOW_ID)
    .maybeSingle();
  
  if (mvpCheckError) {
    console.error(`Error checking MVP dealer participation: ${mvpCheckError.message}`);
    return false;
  }
  
  if (mvpDealerParticipation) {
    console.log('MVP dealer already registered for the show, updating status...');
    
    const { error: mvpUpdateError } = await supabase
      .from('show_participants')
      .update({
        status: 'confirmed',
        role: 'mvp_dealer',
        updated_at: new Date()
      })
      .eq('id', mvpDealerParticipation.id);
    
    if (mvpUpdateError) {
      console.error(`Error updating MVP dealer participation: ${mvpUpdateError.message}`);
      return false;
    }
  } else {
    console.log('Registering MVP dealer for the show...');
    
    const { error: mvpInsertError } = await supabase
      .from('show_participants')
      .insert([{
        userid: MVP_DEALER_ID,
        showid: SHOW_ID,
        status: 'confirmed',
        role: 'mvp_dealer',
        created_at: new Date(),
        updated_at: new Date()
      }]);
    
    if (mvpInsertError) {
      console.error(`Error registering MVP dealer: ${mvpInsertError.message}`);
      return false;
    }
  }
  
  // Register attendee
  const { data: attendeeParticipation, error: attendeeCheckError } = await supabase
    .from('show_participants')
    .select('*')
    .eq('userid', ATTENDEE_ID)
    .eq('showid', SHOW_ID)
    .maybeSingle();
  
  if (attendeeCheckError) {
    console.error(`Error checking attendee participation: ${attendeeCheckError.message}`);
    return false;
  }
  
  if (attendeeParticipation) {
    console.log('Attendee already registered for the show, updating status...');
    
    const { error: attendeeUpdateError } = await supabase
      .from('show_participants')
      .update({
        status: 'confirmed',
        role: 'attendee',
        updated_at: new Date()
      })
      .eq('id', attendeeParticipation.id);
    
    if (attendeeUpdateError) {
      console.error(`Error updating attendee participation: ${attendeeUpdateError.message}`);
      return false;
    }
  } else {
    console.log('Registering attendee for the show...');
    
    const { error: attendeeInsertError } = await supabase
      .from('show_participants')
      .insert([{
        userid: ATTENDEE_ID,
        showid: SHOW_ID,
        status: 'confirmed',
        role: 'attendee',
        created_at: new Date(),
        updated_at: new Date()
      }]);
    
    if (attendeeInsertError) {
      console.error(`Error registering attendee: ${attendeeInsertError.message}`);
      return false;
    }
  }
  
  console.log('Users registered for the show successfully');
  return true;
}

/**
 * Create sample want lists for the attendee
 */
async function createWantLists() {
  console.log('\n=== Creating sample want lists for the attendee ===');
  
  // Check if attendee already has want lists
  const { data: existingWantLists, error: checkError } = await supabase
    .from('want_lists')
    .select('*')
    .eq('userid', ATTENDEE_ID);
  
  if (checkError) {
    console.error(`Error checking want lists: ${checkError.message}`);
    return false;
  }
  
  if (existingWantLists && existingWantLists.length > 0) {
    console.log(`Attendee already has ${existingWantLists.length} want lists, skipping creation...`);
    return true;
  }
  
  console.log('Creating sample want lists for attendee...');
  
  // Create first want list
  const { error: wl1Error } = await supabase
    .from('want_lists')
    .insert([{
      userid: ATTENDEE_ID,
      content: `Looking for:
- 2018 Bowman Chrome Shohei Ohtani RC
- 2018 Topps Update Juan Soto RC
- Any Mike Trout parallels
- 2023 Bowman 1st Chrome autos`,
      createdat: new Date(),
      updatedat: new Date()
    }]);
  
  if (wl1Error) {
    console.error(`Error creating first want list: ${wl1Error.message}`);
    return false;
  }
  
  // Create second want list
  const { error: wl2Error } = await supabase
    .from('want_lists')
    .insert([{
      userid: ATTENDEE_ID,
      content: `Vintage cards wanted:
- 1956 Topps Mickey Mantle
- Any 1950s Hank Aaron
- 1960s Roberto Clemente
- T206 commons in good condition`,
      createdat: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updatedat: new Date(Date.now() - 24 * 60 * 60 * 1000)  // 1 day ago
    }]);
  
  if (wl2Error) {
    console.error(`Error creating second want list: ${wl2Error.message}`);
    return false;
  }
  
  console.log('Sample want lists created successfully');
  return true;
}

/**
 * Verify all data was created correctly
 */
async function verifyData() {
  console.log('\n=== Verifying data ===');
  
  // Verify MVP dealer profile
  console.log('\nVerifying MVP dealer profile:');
  const { data: mvpProfile, error: mvpError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', MVP_DEALER_ID)
    .single();
  
  if (mvpError) {
    console.error(`Error verifying MVP dealer profile: ${mvpError.message}`);
  } else {
    console.log(mvpProfile);
  }
  
  // Verify attendee profile
  console.log('\nVerifying attendee profile:');
  const { data: attendeeProfile, error: attendeeError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, account_type, subscription_status')
    .eq('id', ATTENDEE_ID)
    .single();
  
  if (attendeeError) {
    console.error(`Error verifying attendee profile: ${attendeeError.message}`);
  } else {
    console.log(attendeeProfile);
  }
  
  // Verify show registrations
  console.log('\nVerifying show registrations:');
  const { data: registrations, error: regError } = await supabase
    .from('show_participants')
    .select('id, userid, showid, status, role')
    .eq('showid', SHOW_ID)
    .in('userid', [MVP_DEALER_ID, ATTENDEE_ID]);
  
  if (regError) {
    console.error(`Error verifying show registrations: ${regError.message}`);
  } else {
    console.log(registrations);
  }
  
  // Verify want lists
  console.log('\nVerifying want lists:');
  const { data: wantLists, error: wlError } = await supabase
    .from('want_lists')
    .select('id, userid, content, createdat, updatedat')
    .eq('userid', ATTENDEE_ID);
  
  if (wlError) {
    console.error(`Error verifying want lists: ${wlError.message}`);
  } else {
    wantLists.forEach(wl => {
      console.log(`ID: ${wl.id}`);
      console.log(`Content preview: ${wl.content.substring(0, 50)}${wl.content.length > 50 ? '...' : ''}`);
      console.log(`Created: ${wl.createdat}`);
      console.log(`Updated: ${wl.updatedat}`);
      console.log('---');
    });
  }
  
  return true;
}

/**
 * Main function to run all fixes
 */
async function main() {
  console.log('======================================================');
  console.log('CREATING WANT LIST DATA');
  console.log('======================================================');
  
  try {
    // Step 1: Create MVP dealer profile
    const mvpProfileCreated = await createMvpDealerProfile();
    if (!mvpProfileCreated) {
      console.error('Failed to create MVP dealer profile, aborting...');
      return;
    }
    
    // Step 2: Create attendee profile
    const attendeeProfileCreated = await createAttendeeProfile();
    if (!attendeeProfileCreated) {
      console.error('Failed to create attendee profile, aborting...');
      return;
    }
    
    // Step 3: Register users for the show
    const usersRegistered = await registerUsersForShow();
    if (!usersRegistered) {
      console.error('Failed to register users for the show, aborting...');
      return;
    }
    
    // Step 4: Create want lists
    const wantListsCreated = await createWantLists();
    if (!wantListsCreated) {
      console.error('Failed to create want lists, aborting...');
      return;
    }
    
    // Step 5: Verify all data
    await verifyData();
    
    console.log('\n======================================================');
    console.log('WANT LIST DATA CREATION COMPLETED SUCCESSFULLY');
    console.log('======================================================');
    console.log('\nNext steps:');
    console.log('1. Fix the get_visible_want_lists RPC function through the Supabase dashboard');
    console.log('2. Refresh the Collection screen in the app');
    console.log('3. MVP Dealer should now see the want lists section');
    console.log('4. The want lists of the attendee should be visible');
    
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
    console.log('\nFix script completed.');
  });
