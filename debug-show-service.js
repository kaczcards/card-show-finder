// debug-show-service.js
//
// This script helps diagnose and fix issues with dealer registration
// It connects directly to your Supabase database and checks for specific issues

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// --- Configuration ---
// Replace these with your actual Supabase URL and anon key
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.argv[2];
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.argv[3];
// The user ID to check
const USER_ID = process.argv[4] || '36140b1e-02ef-4a7d-8813-1c416a2dc288';

// Validate parameters
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Missing Supabase URL or anon key.');
  console.error('Usage: node debug-show-service.js [SUPABASE_URL] [SUPABASE_ANON_KEY] [USER_ID]');
  console.error('Or set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugUser() {
  console.log(`🔍 Debugging user: ${USER_ID}`);
  
  try {
    // 1. Check user profile information
    console.log('\n📋 Checking user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', USER_ID)
      .single();
    
    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }
    
    if (!profile) {
      throw new Error(`User profile not found for ID: ${USER_ID}`);
    }
    
    console.log('✅ Found user profile:');
    console.log('  Role:', profile.role);
    console.log('  Account Type:', profile.account_type);
    console.log('  Subscription Status:', profile.subscription_status);
    console.log('  Name:', profile.first_name, profile.last_name);
    
    // 2. Check if we can find the user with a role filter
    console.log('\n🔍 Testing role-based queries...');
    
    const { data: exactRoleData, error: exactRoleError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', USER_ID)
      .eq('role', 'MVP_DEALER')
      .single();
    
    if (exactRoleError) {
      console.log('❌ Failed exact role query:', exactRoleError.message);
    } else {
      console.log('✅ Exact role query succeeded:', exactRoleData);
    }
    
    // 3. Attempt to fix role if case sensitivity is the issue
    console.log('\n🔧 Ensuring correct role capitalization...');
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'MVP_DEALER' })
      .eq('id', USER_ID)
      .select()
      .single();
    
    if (updateError) {
      console.log('❌ Role update failed:', updateError.message);
    } else {
      console.log('✅ Role updated successfully:', updateData.role);
    }
    
    // 4. Simulate a show registration to see what fails
    console.log('\n🧪 Simulating show registration...');
    console.log('  First checking for existing registrations...');
    
    const { data: existingRegs, error: existingRegsError } = await supabase
      .from('show_participants')
      .select('showid')
      .eq('userid', USER_ID);
    
    if (existingRegsError) {
      console.log('❌ Failed to check existing registrations:', existingRegsError.message);
    } else {
      console.log(`✅ Found ${existingRegs.length} existing registrations`);
      if (existingRegs.length > 0) {
        console.log('  Show IDs:', existingRegs.map(reg => reg.showid).join(', '));
      }
    }
    
    // 5. Check available shows
    console.log('\n📅 Checking available shows...');
    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('id, title, start_date, end_date')
      .eq('status', 'ACTIVE')
      .gt('start_date', new Date().toISOString())
      .limit(5);
    
    if (showsError) {
      console.log('❌ Failed to fetch shows:', showsError.message);
    } else if (!shows || shows.length === 0) {
      console.log('❌ No upcoming shows found');
    } else {
      console.log(`✅ Found ${shows.length} upcoming shows`);
      shows.forEach((show, index) => {
        console.log(`  ${index + 1}. ${show.title} (ID: ${show.id})`);
        console.log(`     Dates: ${new Date(show.start_date).toLocaleDateString()} - ${new Date(show.end_date).toLocaleDateString()}`);
      });
      
      if (shows.length > 0) {
        const testShowId = shows[0].id;
        console.log(`\n🧪 Testing registration for show: ${shows[0].title} (${testShowId})`);
        
        // Check if already registered
        const { data: alreadyReg, error: alreadyRegError } = await supabase
          .from('show_participants')
          .select('id')
          .eq('userid', USER_ID)
          .eq('showid', testShowId)
          .maybeSingle();
        
        if (alreadyRegError) {
          console.log('❌ Failed to check if already registered:', alreadyRegError.message);
        } else if (alreadyReg) {
          console.log('⚠️ Already registered for this show. Skipping registration test.');
        } else {
          // Test registration
          console.log('  Attempting registration...');
          const { data: regData, error: regError } = await supabase
            .from('show_participants')
            .insert({
              userid: USER_ID,
              showid: testShowId,
              status: 'registered',
              card_types: ['Baseball', 'Basketball'],
              payment_methods: ['Cash', 'Credit'],
              open_to_trades: true,
              buying_cards: true,
              booth_location: 'Test Booth'
            })
            .select()
            .single();
          
          if (regError) {
            console.log('❌ Registration failed:', regError.message);
            if (regError.message.includes('foreign key constraint')) {
              console.log('  This appears to be a foreign key constraint issue.');
            }
          } else {
            console.log('✅ Registration successful!', regData);
            
            // Clean up the test registration
            console.log('  Cleaning up test registration...');
            const { error: cleanupError } = await supabase
              .from('show_participants')
              .delete()
              .eq('id', regData.id);
            
            if (cleanupError) {
              console.log('❌ Cleanup failed:', cleanupError.message);
            } else {
              console.log('✅ Cleanup successful');
            }
          }
        }
      }
    }
    
    // 6. Summary
    console.log('\n📊 SUMMARY:');
    console.log(`User: ${profile.first_name} ${profile.last_name} (${USER_ID})`);
    console.log(`Role: ${profile.role}`);
    console.log(`Account Type: ${profile.account_type}`);
    console.log(`Subscription Status: ${profile.subscription_status}`);
    console.log('\nRecommendations:');
    console.log('1. Try refreshing your session in the app');
    console.log('2. Log out and log back in to get a fresh token');
    console.log('3. If still having issues, ensure the show_participants table has all required columns');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

debugUser();
