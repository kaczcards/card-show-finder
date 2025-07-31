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
const _supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const _supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!_supabaseUrl || !_supabaseKey) {
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
   
console.warn(`\n🔍 Checking database for user ID: ${_USER_ID}\n`);
  
  try {
    // Query the profiles table for the user
    const { data: profileData, error: profileError } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', _USER_ID)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile data:', profileError);
      return;
    }
    
    if (!profileData) {
       
console.warn(`❌ No profile found for user ID: ${_USER_ID}`);
      return;
    }
    
    // Query the auth.users table for additional info
    const { data: authData, error: authError } = await _supabase
      .from('auth.users')
      .select('*')
      .eq('id', _USER_ID)
      .single();
    
    // Format and display the results
     
console.warn('📋 USER PROFILE DATA:');
     
console.warn('====================');
     
console.warn(`ID: ${profileData.id}`);
     
console.warn(`Name: ${profileData.first_name} ${profileData.last_name || ''}`);
     
console.warn(`Email: ${profileData.email}`);
     
console.warn(`Role: ${profileData.role}`);
     
console.warn(`Account Type: ${profileData.account_type}`);
     
console.warn(`Subscription Status: ${profileData.subscription_status}`);
     
console.warn(`Subscription Expiry: ${profileData.subscription_expiry || 'N/A'}`);
    
    // Check for role-subscription mismatches
     
console.warn('\n🔍 DIAGNOSIS:');
     
console.warn('====================');
    
    // Check if role is dealer but showing as MVP
    if (profileData.role === 'dealer' && profileData.account_type === 'dealer') {
       
console.warn('✅ User has correct role "dealer" in the database');
    } else if (profileData.role === 'mvp_dealer') {
       
console.warn('⚠️ User has "mvp_dealer" role in the database but should be "dealer"');
       
console.warn('   This explains why they are showing as MVP Dealer in the UI');
    } else {
       
console.warn(`⚠️ User has unexpected role "${profileData.role}" with account type "${profileData.account_type}"`);
    }
    
    // Check subscription status
    if (profileData.subscription_status === 'active' && profileData.account_type === 'dealer') {
       
console.warn('✅ User has active subscription as expected for a dealer');
    } else if (profileData.subscription_status !== 'active') {
       
console.warn(`⚠️ User has "${profileData.subscription_status}" subscription status`);
    }
    
    // Check for any UI display logic issues
     
console.warn('\n🔧 POSSIBLE FIXES:');
     
console.warn('====================');
     
console.warn('1. If role is "mvp_dealer" but should be "dealer", update the role in the database:');
     
console.warn(`   UPDATE profiles SET role = 'dealer' WHERE id = '${_USER_ID}';`);
     
console.warn('\n2. If the UI is incorrectly displaying the role, check the ProfileScreen.tsx file');
     
console.warn('   for any logic that might be overriding the role display.');
     
console.warn('\n3. Check the getRoleDisplayName function in ProfileScreen.tsx to ensure');
     
console.warn('   it correctly maps UserRole.DEALER to "Dealer" and not "MVP Dealer".');
    
    // Raw data for debugging
     
console.warn('\n📊 RAW PROFILE DATA:');
     
console.warn('====================');
     
console.warn(JSON.stringify(profileData, null, 2));
    
    if (authData && !authError) {
       
console.warn('\n📊 RAW AUTH DATA:');
       
console.warn('====================');
       
console.warn(JSON.stringify(authData, null, 2));
    }
    
  } catch (_err) {
    console.error('❌ Unexpected error:', _err);
  }
}

// Run the function
checkDealerRole()
   
  .then(() => console.warn('\n✅ Check completed'))
  .catch(err => console.error('❌ Fatal error:', err));
