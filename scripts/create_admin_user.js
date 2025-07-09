#!/usr/bin/env node
/**
 * Admin User Creation Script
 * 
 * This script assigns the admin role to a specified user ID in the Supabase database.
 * It's intended to be used to create the first admin user who can then manage other admins.
 * 
 * Usage: node create_admin_user.js <user_id>
 * 
 * Example: node create_admin_user.js 550e8400-e29b-41d4-a716-446655440000
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase credentials not found in environment variables.');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file.');
  process.exit(1);
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Error: User ID is required.');
  console.error('Usage: node create_admin_user.js <user_id>');
  process.exit(1);
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(userId)) {
  console.error('Error: Invalid user ID format. Please provide a valid UUID.');
  console.error('Example: 550e8400-e29b-41d4-a716-446655440000');
  process.exit(1);
}

// Initialize Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Directly inserts the admin role into the user_roles table
 * This is used for the first admin user when no other admins exist yet
 */
async function createFirstAdmin(userId) {
  try {
    console.log(`Attempting to create admin role for user: ${userId}`);

    // First check if the user exists in auth.users
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error checking if user exists:', userError.message);
      return false;
    }

    if (!userData) {
      console.error(`User with ID ${userId} not found in the database.`);
      return false;
    }

    console.log(`Found user: ${userData.first_name} ${userData.last_name} (${userData.email})`);

    // Check if user already has admin role
    const { data: existingRole, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (existingRole) {
      console.log(`User ${userId} already has admin role.`);
      return true;
    }

    if (roleError && roleError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected if the user doesn't have the role yet
      console.error('Error checking existing role:', roleError.message);
    }

    // Insert admin role for the user
    const { data, error } = await supabase
      .from('user_roles')
      .insert([
        { user_id: userId, role: 'admin' }
      ]);

    if (error) {
      console.error('Error assigning admin role:', error.message);
      return false;
    }

    console.log(`Successfully assigned admin role to user: ${userId}`);
    return true;
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return false;
  }
}

// Execute the function
createFirstAdmin(userId)
  .then(success => {
    if (success) {
      console.log('✅ Admin user created successfully!');
      console.log('This user can now access the admin features and assign admin roles to other users.');
    } else {
      console.error('❌ Failed to create admin user.');
      console.error('Please check the error messages above and try again.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
