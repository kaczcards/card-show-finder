/**
 * direct-fix.js
 * -------------
 * Emergency fix script for Card Show Finder account issues.
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
 * Map role to account type
 * @param {string} role - User role
 * @returns {string} - Corresponding account type
 */
function mapRoleToAccountType(role) {
  switch (role.toLowerCase()) {
    case 'attendee':
      return 'collector';
    case 'dealer':
    case 'mvp_dealer':
      return 'dealer';
    case 'show_organizer':
      return 'organizer';
    default:
      return 'collector';
  }
}

/**
 * Fix user account
 * @param {string} userId - User ID to fix
 * @param {string} role - Role to set (default: 'dealer')
 */
async function fixUserAccount(userId, role = 'dealer') {
  if (!userId) {
    console.error('Error: User ID is required');
    console.log('Usage: node direct-fix.js <user_id> [role]');
    process.exit(1);
  }
  
  console.log(`\n🔧 Fixing account for user: ${userId}`);
  console.log(`Setting role to: ${role}`);
  
  try {
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
    
    // Map role to account type
    const accountType = mapRoleToAccountType(role);
    
    // Prepare update data
    const updateData = {
      role: role,
      subscription_status: 'active',
      subscription_type: 'monthly',
      subscription_expiry: expiryDate.toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // First try to add account_type column if it doesn't exist
    try {
      await supabase.rpc('add_column_if_not_exists', {
        table_name: 'profiles',
        column_name: 'account_type',
        column_type: 'text',
        column_default: "'collector'"
      });
      console.log('Checked for account_type column');
    } catch (e) {
      console.log('Could not check/add column - will try direct update anyway');
    }
    
    // Always include account_type in update data
    updateData.account_type = accountType;
    
    console.log('\nUpdating user with:');
    console.log(`- Role: ${updateData.role}`);
    console.log(`- Account Type: ${updateData.account_type}`);
    console.log(`- Subscription Status: ${updateData.subscription_status}`);
    console.log(`- Subscription Expiry: ${new Date(updateData.subscription_expiry).toLocaleString()}`);
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();
    
    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    
    console.log('\n✅ User account updated successfully!');
    console.log('\n📱 Next steps:');
    console.log('1. Restart your app: npx expo start --clear');
    console.log('2. Log out and log back in');
    console.log('3. Your account should now show the correct role and features');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
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
