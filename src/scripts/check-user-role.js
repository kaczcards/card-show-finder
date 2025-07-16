// src/scripts/check-user-role.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// User ID to check
const USER_ID = '50dddcd7-77b5-46d1-9072-22b7b93d5835';

async function checkUserRole() {
  try {
    console.log(`Checking role for user ID: ${USER_ID}`);
    
    // Query the user from the database
    const { data, error } = await supabase
      .from('users')
      .select('id, email, firstName, lastName, role, accountType')
      .eq('id', USER_ID)
      .single();
    
    if (error) {
      console.error('Error fetching user data:', error);
      return;
    }
    
    if (!data) {
      console.log(`No user found with ID: ${USER_ID}`);
      return;
    }
    
    // Display user information
    console.log('\nUser Information:');
    console.log('----------------');
    console.log(`ID: ${data.id}`);
    console.log(`Name: ${data.firstName} ${data.lastName || ''}`);
    console.log(`Email: ${data.email}`);
    console.log(`Role: ${data.role}`);
    console.log(`Account Type: ${data.accountType}`);
    
    // Check if the role is what we expect
    if (data.role === 'dealer') {
      console.log('\n✅ User has the DEALER role (should see upgrade message)');
    } else if (data.role === 'mvp_dealer') {
      console.log('\n❌ User has the MVP_DEALER role (will NOT see upgrade message)');
      console.log('To fix: Update the user role to "dealer" in the database');
    } else {
      console.log(`\nUser has role: ${data.role}`);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the function
checkUserRole()
  .then(() => console.log('\nDone!'))
  .catch(err => console.error('Fatal error:', err));
