/**
 * apply-migration.js
 * 
 * This script applies the canonical database consolidation migration
 * directly to the Supabase database using connection details from .env.
 * 
 * Usage: node apply-migration.js
 */

// Load environment variables from .env file
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Migration file path
const MIGRATION_FILE_PATH = path.join(
  __dirname,
  'supabase',
  'migrations',
  '20250722000000_canonical_database_consolidation.sql'
);

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Missing Supabase credentials in .env file');
  console.error('   Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are defined');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Main function to apply the migration
 */
async function applyMigration() {
  console.log('🔄 Starting canonical database consolidation migration...');
  console.log(`📂 Reading migration file: ${MIGRATION_FILE_PATH}`);
  
  try {
    // Read the migration SQL file
    if (!fs.existsSync(MIGRATION_FILE_PATH)) {
      throw new Error(`Migration file not found at: ${MIGRATION_FILE_PATH}`);
    }
    
    const migrationSql = fs.readFileSync(MIGRATION_FILE_PATH, 'utf8');
    
    console.log(`📊 Migration file size: ${(migrationSql.length / 1024).toFixed(2)} KB`);
    console.log('🔌 Connecting to Supabase database...');
    
    // Execute the migration SQL
    console.log('⚙️ Executing migration...');
    
    // Use Supabase's stored procedure to execute SQL
    // This requires a stored procedure to be available in the database
    // that can execute arbitrary SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: migrationSql
    });
    
    if (error) {
      throw new Error(`Failed to execute migration: ${error.message}`);
    }
    
    console.log('✅ Migration successfully applied!');
    console.log('🎉 Database is now up to date with all consolidated functions and policies.');
    
    if (data) {
      console.log('📋 Migration result:', data);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Provide helpful troubleshooting tips
    console.error('\n📌 Troubleshooting tips:');
    console.error('  • Check that your Supabase credentials are correct in .env');
    console.error('  • Verify that you have the necessary permissions');
    console.error('  • Make sure the exec_sql stored procedure exists in your database');
    console.error('  • Try breaking the migration into smaller parts');
    console.error('\n📝 Alternative approach:');
    console.error('  You can also apply this migration directly using the Supabase dashboard:');
    console.error('  1. Go to https://app.supabase.com');
    console.error('  2. Select your project');
    console.error('  3. Go to SQL Editor');
    console.error('  4. Copy and paste the migration SQL');
    console.error('  5. Execute the SQL');
    
    return false;
  }
}

// Execute the migration
applyMigration()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
