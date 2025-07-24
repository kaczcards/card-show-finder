const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment variables or use placeholders
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Applies the canonical database consolidation migration to the Supabase database
 * This migration consolidates all previous migrations and fixes various issues
 */
async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250722000000_canonical_database_consolidation.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found at: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Migration file loaded (${migrationSql.length} bytes)`);
    
    console.log('Applying migration to database...');
    const { data, error } = await supabase.rpc('execute_sql', { sql: migrationSql });

    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    } else {
      console.log('Migration applied successfully!');
      console.log('Result:', data);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}

// Execute the migration
console.log('Starting database migration process...');
applyMigration();
