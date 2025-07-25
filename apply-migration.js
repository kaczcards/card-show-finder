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

/**
 * Verifies the database migration by checking for the existence of new functions
 */
async function verifyMigration() {
  try {
    console.log('Verifying migration...');
    
    // 1. Check for the existence of the is_admin() function
    const { data: isAdmin, error: isAdminError } = await supabase.rpc('is_admin');
    if (isAdminError) {
      console.error('Error checking is_admin():', isAdminError);
    } else {
      console.log('is_admin() returned:', isAdmin);
    }

    // 2. Check for the existence of the is_show_organizer() function
    const { data: isShowOrganizer, error: isShowOrganizerError } = await supabase.rpc('is_show_organizer');
    if (isShowOrganizerError) {
      console.error('Error checking is_show_organizer():', isShowOrganizerError);
    } else {
      console.log('is_show_organizer() returned:', isShowOrganizer);
    }

  } catch (error) {
    console.error('An unexpected error occurred during verification:', error);
  }
}

// Execute the migration and verification
console.log('Starting database migration process...');
(async () => {
  await applyMigration();
  await verifyMigration();
})();
