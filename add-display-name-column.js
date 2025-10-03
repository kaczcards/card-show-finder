/**
 * Simple script to add the display_name column to profiles table
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addDisplayNameColumn() {
  try {
    console.log('🔧 Adding display_name column to profiles table...');
    
    // First, check if the column already exists
    const { data: existingColumns, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'profiles')
      .eq('column_name', 'display_name');
    
    if (checkError) {
      console.log('⚠️  Cannot check existing columns, proceeding with ALTER TABLE...');
    } else if (existingColumns && existingColumns.length > 0) {
      console.log('✅ display_name column already exists!');
      return;
    }
    
    // Since Supabase client doesn't support ALTER TABLE directly,
    // let's provide the SQL to run manually
    console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('-- Add display_name column to profiles table');
    console.log('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;');
    console.log('');
    console.log('-- Add comment explaining the field');
    console.log("COMMENT ON COLUMN public.profiles.display_name IS 'Custom display name for dealers to show on booth info and show details instead of first+last name. Allows business names, nicknames, etc.';");
    console.log('');
    console.log('After running this SQL, you can try updating your profile again.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Provide the manual SQL
    console.log('');
    console.log('📋 Please run the following SQL manually in Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;');
    console.log("COMMENT ON COLUMN public.profiles.display_name IS 'Custom display name for dealers to show on booth info and show details instead of first+last name. Allows business names, nicknames, etc.';");
  }
}

console.log('🚀 Checking display_name column...');
addDisplayNameColumn();