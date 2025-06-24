/**
 * find-user-id.js
 * --------------
 * A simple script to find a user's ID by their email address.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and key from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.log('Please ensure your .env file contains:');
  console.log('  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

// Initialize Supabase client with admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Find a user by email address
 * @param {string} email - Email address to search for
 */
async function findUserByEmail(email) {
  if (!email) {
    console.error('Error: Email address is required');
    console.log('Usage: node find-user-id.js <email>');
    process.exit(1);
  }
  
  console.log(`\n🔍 Searching for user with email: ${email}`);
  
  try {
    // Try to find in profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', email);
    
    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }
    
    if (!profiles || profiles.length === 0) {
      console.log('\n❌ No user found with that email address.');
      return;
    }
    
    // Display all matching profiles
    console.log(`\n✅ Found ${profiles.length} matching profile(s):`);
    
    profiles.forEach((profile, index) => {
      console.log(`\n--- User ${index + 1} ---`);
      console.log(`User ID: ${profile.id}`);
      console.log(`Name: ${profile.first_name} ${profile.last_name || ''}`);
      console.log(`Email: ${profile.email}`);
      console.log(`Role: ${profile.role || 'Not set'}`);
      
      // Print command to fix this user's role
      console.log('\n📋 To fix this user\'s role, run:');
      console.log(`node direct-fix.js ${profile.id} dealer`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

// Run the search
findUserByEmail(email);
