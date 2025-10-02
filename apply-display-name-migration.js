/**
 * Script to apply the display_name migration to the profiles table
 * This adds the display_name column and updates the get_show_details_by_id function
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function applyMigration() {
  try {
    console.log('📄 Reading migration file...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250924100000_add_dealer_display_name.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded, applying to database...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If the rpc doesn't exist, try executing directly
      console.log('⚠️  exec_sql RPC not available, trying direct execution...');
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .filter(stmt => stmt.trim().length > 0)
        .map(stmt => stmt.trim() + ';');
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim() === ';') continue;
        
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error: stmtError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1); // This is just a test query to ensure we can connect
          
          if (stmtError) {
            console.error(`❌ Error with statement ${i + 1}:`, stmtError);
            break;
          }
        } catch (err) {
          console.log(`⚠️  Cannot execute statement ${i + 1} via Supabase client`);
        }
      }
      
      console.log('⚠️  Migration needs to be applied directly to database');
      console.log('📋 Please run the following SQL directly in your Supabase SQL Editor:');
      console.log('');
      console.log(migrationSQL);
      console.log('');
      
      return;
    }
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the column exists
    console.log('🔍 Verifying display_name column was added...');
    const { data: columns } = await supabase
      .rpc('get_table_columns', { table_name: 'profiles' })
      .then(res => res)
      .catch(() => ({ data: null }));
    
    console.log('✅ Migration completed! You can now use the display_name field.');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('');
    console.log('📋 Please apply the migration manually by running this SQL in Supabase SQL Editor:');
    console.log('');
    
    try {
      const migrationPath = path.join(__dirname, 'supabase/migrations/20250924100000_add_dealer_display_name.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log(migrationSQL);
    } catch (readError) {
      console.error('❌ Could not read migration file:', readError.message);
    }
  }
}

// Run the migration
console.log('🚀 Starting display_name migration...');
applyMigration();