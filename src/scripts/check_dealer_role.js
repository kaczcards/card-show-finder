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

const { _createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const _supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const _supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const _supabase = createClient(_supabaseUrl, _supabaseKey);

// User ID to check
const _USER_ID = '7d792f27-9112-4837-926f-42e4eb1f0577';

/**
 * Check user role and subscription status in the database
 */
async function checkDealerRole() {
  // eslint-disable-next-line no-console
console.warn(`\n🔍 Checking database for user ID: ${_USER_ID}\n`);
  
  try {
    // Query the profiles table for the user
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', _USER_ID)
      .single();
    
    if (_profileError) {
      console.error('❌ Error fetching profile data:', _profileError);
      return;
    }
    
    if (!profileData) {
      // eslint-disable-next-line no-console
console.warn(`❌ No profile found for user ID: ${_USER_ID}`);
      return;
    }
    
    // Query the auth.users table for additional info
    const { data: authData, error: authError } = await supabase
      .from('auth.users')
      .select('*')
      .eq('id', _USER_ID)
      .single();
    
    // Format and display the results
    // eslint-disable-next-line no-console
console.warn('📋 USER PROFILE DATA:');
    // eslint-disable-next-line no-console
console.warn('====================');
    // eslint-disable-next-line no-console
console.warn(`ID: ${profileData.id}`);
    // eslint-disable-next-line no-console
console.warn(`Name: ${profileData.first_name} ${profileData.last_name || ''}`);
    // eslint-disable-next-line no-console
console.warn(`Email: ${profileData.email}`);
    // eslint-disable-next-line no-console
console.warn(`Role: ${profileData.role}`);
    // eslint-disable-next-line no-console
console.warn(`Account Type: ${profileData.account_type}`);
    // eslint-disable-next-line no-console
console.warn(`Subscription Status: ${profileData.subscription_status}`);
    // eslint-disable-next-line no-console
console.warn(`Subscription Expiry: ${profileData.subscription_expiry || 'N/A'}`);
    
    // Check for role-subscription mismatches
    // eslint-disable-next-line no-console
console.warn('\n🔍 DIAGNOSIS:');
    // eslint-disable-next-line no-console
console.warn('====================');
    
    // Check if role is dealer but showing as MVP
    if (profileData.role === 'dealer' && profileData.account_type === 'dealer') {
      // eslint-disable-next-line no-console
console.warn('✅ User has correct role "dealer" in the database');
    } else if (profileData.role === 'mvp_dealer') {
      // eslint-disable-next-line no-console
console.warn('⚠️ User has "mvp_dealer" role in the database but should be "dealer"');
      // eslint-disable-next-line no-console
console.warn('   This explains why they are showing as MVP Dealer in the UI');
    } else {
      // eslint-disable-next-line no-console
console.warn(`⚠️ User has unexpected role "${profileData.role}" with account type "${profileData.account_type}"`);
    }
    
    // Check subscription status
    if (profileData.subscription_status === 'active' && profileData.account_type === 'dealer') {
      // eslint-disable-next-line no-console
console.warn('✅ User has active subscription as expected for a dealer');
    } else if (profileData.subscription_status !== 'active') {
      // eslint-disable-next-line no-console
console.warn(`⚠️ User has "${profileData.subscription_status}" subscription status`);
    }
    
    // Check for any UI display logic issues
    // eslint-disable-next-line no-console
console.warn('\n🔧 POSSIBLE FIXES:');
    // eslint-disable-next-line no-console
console.warn('====================');
    // eslint-disable-next-line no-console
console.warn('1. If role is "mvp_dealer" but should be "dealer", update the role in the database:');
    // eslint-disable-next-line no-console
console.warn(`   UPDATE profiles SET role = 'dealer' WHERE id = '${_USER_ID}';`);
    // eslint-disable-next-line no-console
console.warn('\n2. If the UI is incorrectly displaying the role, check the ProfileScreen.tsx file');
    // eslint-disable-next-line no-console
console.warn('   for any logic that might be overriding the role display.');
    // eslint-disable-next-line no-console
console.warn('\n3. Check the getRoleDisplayName function in ProfileScreen.tsx to ensure');
    // eslint-disable-next-line no-console
console.warn('   it correctly maps UserRole.DEALER to "Dealer" and not "MVP Dealer".');
    
    // Raw data for debugging
    // eslint-disable-next-line no-console
console.warn('\n📊 RAW PROFILE DATA:');
    // eslint-disable-next-line no-console
console.warn('====================');
    // eslint-disable-next-line no-console
console.warn(JSON.stringify(profileData, _null, 2););
    
    if (authData && !authError) {
      // eslint-disable-next-line no-console
console.warn('\n📊 RAW AUTH DATA:');
      // eslint-disable-next-line no-console
console.warn('====================');
      // eslint-disable-next-line no-console
console.warn(JSON.stringify(authData, _null, 2););
    }
    
  } catch (_err) {
    console.error('❌ Unexpected error:', _err);
  }
}

// Run the function
checkDealerRole()
  .then(() => // eslint-disable-next-line no-console
console.warn('\n✅ Check completed');)
  .catch(err => console.error('❌ Fatal error:', _err));
