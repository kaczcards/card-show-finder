// fix-user-roles.js
//
// This script applies the necessary database changes to automatically synchronize
// a user's role with their subscription status. It should be run once to fix
// the issue where upgrading a subscription does not update the user's role.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// --- Configuration ---

// The SQL file containing the function and trigger to sync roles.
const MIGRATION_SQL_FILE = 'db_migrations/sync_role_with_subscription.sql';

// Database connection details - either from environment or command line
const getDbConfig = () => {
  // Check for command line arguments first
  if (process.argv.length >= 3) {
    return {
      connectionString: process.argv[2],
    };
  }
  
  // Then check environment variables
  if (process.env.EXPO_PUBLIC_SUPABASE_DB_URL) {
    return {
      connectionString: process.env.EXPO_PUBLIC_SUPABASE_DB_URL,
    };
  }
  
  // Then check for .env file with other common variable names
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
    };
  }
  
  if (process.env.SUPABASE_DB_URL) {
    return {
      connectionString: process.env.SUPABASE_DB_URL,
    };
  }
  
  return null;
};

const dbConfig = getDbConfig();

// --- Validation ---

if (!dbConfig) {
  console.error('🔴 ERROR: Database connection string not found.');
  console.error('Please provide a database connection string in one of these ways:');
  console.error('  1. As a command line argument: node fix-user-roles.js "postgres://user:pass@host:port/db"');
  console.error('  2. As an environment variable: EXPO_PUBLIC_SUPABASE_DB_URL, DATABASE_URL, or SUPABASE_DB_URL');
  console.error('  3. In a .env file with one of the above variable names');
  process.exit(1);
}

const migrationFilePath = path.join(__dirname, MIGRATION_SQL_FILE);
if (!fs.existsSync(migrationFilePath)) {
  console.error(`🔴 ERROR: Migration file not found at: ${migrationFilePath}`);
  console.error('Please ensure the file "sync_role_with_subscription.sql" exists in the "db_migrations" directory.');
  process.exit(1);
}

// --- Main Execution ---

/**
 * Connects to the database and runs the role synchronization fix.
 */
const fixUserRoles = async () => {
  const client = new Client(dbConfig);
  console.log('🚀 Starting user role synchronization fix...');

  try {
    // 1. Connect to the database
    await client.connect();
    console.log('✅ Connected to the database successfully.');

    // 2. Start a transaction
    await client.query('BEGIN');
    console.log('🔄 Started transaction.');

    // 3. Apply the SQL migration file
    console.log(`📄 Applying migration from "${MIGRATION_SQL_FILE}"...`);
    const sql = fs.readFileSync(migrationFilePath, 'utf8');
    await client.query(sql);
    console.log('✅ SQL migration applied successfully (function and trigger created).');

    // 4. Run the manual sync function to update existing users
    console.log('⚙️ Running manual sync to update all existing user roles...');
    await client.query('SELECT public.manually_sync_all_user_roles();');
    console.log('✅ Manual role sync completed for all users.');

    // 5. Commit the transaction
    await client.query('COMMIT');
    console.log('🎉 COMMIT successful. Role synchronization fix has been applied.');
    console.log('Roles will now update automatically when subscription status changes.');

  } catch (error) {
    console.error('🔴 ERROR: An error occurred during the fix.');
    console.error(error);

    // If an error occurs, roll back the transaction
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.error('🔄 Transaction has been rolled back.');
      } catch (rollbackError) {
        console.error('🚨 CRITICAL ERROR: Failed to roll back transaction.', rollbackError);
      }
    }
    process.exit(1); // Exit with an error code

  } finally {
    // 6. Ensure the database connection is always closed
    if (client) {
      await client.end();
      console.log('🔌 Database connection closed.');
    }
  }
};

// --- Run the script ---
fixUserRoles();
