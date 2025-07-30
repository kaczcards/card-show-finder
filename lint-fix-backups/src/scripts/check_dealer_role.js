// src/scripts/check_dealer_role.js
/**
 * This script directly queries the Supabase database to check the role and subscription
 * status of a specific dealer account to diagnose why they might be showing as MVP dealer
 * when they shouldn't be.
 * 
 * Usage:
 * node src/scripts/check_dealer_role.js
 * 
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY environment variables to be set
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// User ID to check
const USER_ID = '7d792f27-9112-4837-926f-42e4eb1f0577';

/**
 * Check user role and subscription status in the database
 */
async function checkDealerRole() {
  console.log(`\n🔍 Checking database for user ID: ${USER_ID}\n`);
  
  try {
    // Query the profiles table for the user
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', USER_ID)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile data:', profileError);
      return;
    }
    
    if (!profileData) {
      console.log(`❌ No profile found for user ID: ${USER_ID}`);
      return;
    }
    
    // Query the auth.users table for additional info
    const { data: authData, error: authError } = await supabase
      .from('auth.users')
      .select('*')
      .eq('id', USER_ID)
      .single();
    
    // Format and display the results
    console.log('📋 USER PROFILE DATA:');
    console.log('====================');
    console.log(`ID: ${profileData.id}`);
    console.log(`Name: ${profileData.first_name} ${profileData.last_name || ''}`);
    console.log(`Email: ${profileData.email}`);
    console.log(`Role: ${profileData.role}`);
    console.log(`Account Type: ${profileData.account_type}`);
    console.log(`Subscription Status: ${profileData.subscription_status}`);
    console.log(`Subscription Expiry: ${profileData.subscription_expiry || 'N/A'}`);
    
    // Check for role-subscription mismatches
    console.log('\n🔍 DIAGNOSIS:');
    console.log('====================');
    
    // Check if role is dealer but showing as MVP
    if (profileData.role === 'dealer' && profileData.account_type === 'dealer') {
      console.log('✅ User has correct role "dealer" in the database');
    } else if (profileData.role === 'mvp_dealer') {
      console.log('⚠️ User has "mvp_dealer" role in the database but should be "dealer"');
      console.log('   This explains why they are showing as MVP Dealer in the UI');
    } else {
      console.log(`⚠️ User has unexpected role "${profileData.role}" with account type "${profileData.account_type}"`);
    }
    
    // Check subscription status
    if (profileData.subscription_status === 'active' && profileData.account_type === 'dealer') {
      console.log('✅ User has active subscription as expected for a dealer');
    } else if (profileData.subscription_status !== 'active') {
      console.log(`⚠️ User has "${profileData.subscription_status}" subscription status`);
    }
    
    // Check for any UI display logic issues
    console.log('\n🔧 POSSIBLE FIXES:');
    console.log('====================');
    console.log('1. If role is "mvp_dealer" but should be "dealer", update the role in the database:');
    console.log(`   UPDATE profiles SET role = 'dealer' WHERE id = '${USER_ID}';`);
    console.log('\n2. If the UI is incorrectly displaying the role, check the ProfileScreen.tsx file');
    console.log('   for any logic that might be overriding the role display.');
    console.log('\n3. Check the getRoleDisplayName function in ProfileScreen.tsx to ensure');
    console.log('   it correctly maps UserRole.DEALER to "Dealer" and not "MVP Dealer".');
    
    // Raw data for debugging
    console.log('\n📊 RAW PROFILE DATA:');
    console.log('====================');
    console.log(JSON.stringify(profileData, null, 2));
    
    if (authData && !authError) {
      console.log('\n📊 RAW AUTH DATA:');
      console.log('====================');
      console.log(JSON.stringify(authData, null, 2));
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the function
checkDealerRole()
  .then(() => console.log('\n✅ Check completed'))
  .catch(err => console.error('❌ Fatal error:', err));
