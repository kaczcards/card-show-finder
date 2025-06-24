/**
 * fix-subscription-columns.js
 * --------------------------
 * Adds missing columns and fixes user account data
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and key from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

// Initialize Supabase client with admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Add columns to profiles table if they don't exist
 * @returns {Promise<void>}
 */
async function addMissingColumns() {
  console.log('Adding missing columns to the profiles table...');
  
  try {
    // Direct SQL to add all needed columns in one shot
    const { error } = await supabase.rpc('execute_sql', {
      sql: `
        DO $$
        BEGIN
          -- Add account_type column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'profiles' AND column_name = 'account_type') THEN
            ALTER TABLE profiles ADD COLUMN account_type TEXT DEFAULT 'collector';
          END IF;

          -- Add subscription_status column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
            ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'none';
          END IF;

          -- Add subscription_type column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'profiles' AND column_name = 'subscription_type') THEN
            ALTER TABLE profiles ADD COLUMN subscription_type TEXT DEFAULT 'none';
          END IF;

          -- Add subscription_expiry column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'profiles' AND column_name = 'subscription_expiry') THEN
            ALTER TABLE profiles ADD COLUMN subscription_expiry TIMESTAMP WITH TIME ZONE;
          END IF;

          -- Add subscription_id column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'profiles' AND column_name = 'subscription_id') THEN
            ALTER TABLE profiles ADD COLUMN subscription_id TEXT;
          END IF;
        END $$;
      `
    });

    if (error) {
      throw error;
    }

    console.log('✅ Successfully checked/added necessary columns');
  } catch (error) {
    console.log('❌ Error adding columns:', error.message);
    console.log('Will try to update the user anyway...');
  }
}

/**
 * Fix user account
 * @param {string} userId - User ID to fix
 * @param {string} role - Role to set
 */
async function fixUserAccount(userId, role) {
  if (!userId) {
    console.error('Error: User ID is required');
    process.exit(1);
  }
  
  console.log(`\n🔧 Fixing account for user: ${userId}`);
  console.log(`Setting role to: ${role}`);
  
  try {
    // First add any missing columns
    await addMissingColumns();
    
    // Get current user data
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      throw new Error(`Failed to fetch user: ${fetchError.message}`);
    }
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    console.log('\nCurrent user data:');
    console.log(`- Name: ${user.first_name} ${user.last_name || ''}`);
    console.log(`- Email: ${user.email || 'Not available'}`);
    console.log(`- Role: ${user.role || 'Not set'}`);
    
    // Calculate expiry date (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    // Determine account type from role
    let accountType = 'collector';
    if (role === 'dealer' || role === 'mvp_dealer') {
      accountType = 'dealer';
    } else if (role === 'show_organizer') {
      accountType = 'organizer';
    }
    
    // Now build the update data, only including fields that should exist
    const updateData = {
      role: role,
      updated_at: new Date().toISOString()
    };
    
    try {
      // Add subscription-specific fields, but catch errors if columns don't exist
      updateData.account_type = accountType;
      updateData.subscription_status = 'active';
      updateData.subscription_type = 'monthly';
      updateData.subscription_expiry = expiryDate.toISOString();
      
      console.log('\nAttempting to update user profile with:');
      console.log(updateData);
      
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      console.log('\n✅ User updated successfully!');
    } catch (updateError) {
      console.error('\n❌ Update error:', updateError.message);
      console.log('\nTrying a more basic update...');
      
      // Try a more basic update with just the role
      const { error } = await supabase
        .from('profiles')
        .update({ role: role })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      console.log('\n✅ User role updated successfully (other fields may not be updated)');
    }
    
    console.log('\n📱 Next steps:');
    console.log('1. Restart your app: npx expo start --clear');
    console.log('2. Log out and log back in');
    console.log('3. If you still see "Unknown" for role, it means the frontend is expecting fields');
    console.log('   that don\'t exist in the database. You may need code changes.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Get user ID and role from command line arguments
const userId = process.argv[2];
const role = process.argv[3] || 'dealer';

// Valid roles
const validRoles = ['attendee', 'dealer', 'mvp_dealer', 'show_organizer'];
if (!validRoles.includes(role)) {
  console.error(`Error: Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`);
  process.exit(1);
}

// Run the fix
fixUserAccount(userId, role);
