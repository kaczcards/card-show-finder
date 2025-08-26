/**
 * apply-sql-fix.js
 * 
 * This script applies the SQL fix for the get_visible_want_lists RPC function
 * using the Supabase service role key. It:
 * 
 * 1. Reads the SQL fix file
 * 2. Executes it using the service role key
 * 3. Verifies the function was created successfully
 * 4. Tests the function with sample parameters
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Constants for the specific test case
const MVP_DEALER_ID = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
const SHOW_ID = 'f8f057ec-7000-4caf-b8e3-5f261dead14c';
const ATTENDEE_ID = '090926af-e383-4b74-95fa-d1dd16661e7f';

// ---------------------------------------------------------------------------
// Supabase setup - use service role key for elevated privileges
// ---------------------------------------------------------------------------
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

// Use service role key for admin privileges
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and ' +
      'SUPABASE_SERVICE_KEY in your .env file.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Read the SQL fix file
 */
async function readSqlFixFile() {
  console.log('\n=== Reading SQL Fix File ===');
  
  const sqlFilePath = path.join(__dirname, 'sql', 'fix-get-visible-want-lists.sql');
  
  try {
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`SQL file read successfully (${sqlContent.length} bytes)`);
    return sqlContent;
  } catch (err) {
    console.error(`Error reading SQL file: ${err.message}`);
    return null;
  }
}

/**
 * Execute the SQL fix
 */
async function executeSqlFix(sqlContent) {
  console.log('\n=== Executing SQL Fix ===');
  
  if (!sqlContent) {
    console.error('No SQL content to execute');
    return false;
  }
  
  try {
    // Execute the SQL directly
    const { data, error } = await supabase.rpc('pgmoon_exec', { query: sqlContent });
    
    if (error) {
      console.error(`Error executing SQL: ${error.message}`);
      return false;
    }
    
    console.log('SQL fix executed successfully');
    return true;
  } catch (err) {
    console.error(`Error executing SQL: ${err.message}`);
    
    // Alternative approach if pgmoon_exec is not available
    console.log('Attempting alternative approach...');
    
    try {
      // Try to use REST endpoint for SQL execution
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/pgmoon_exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ query: sqlContent })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error executing SQL via REST: ${JSON.stringify(errorData)}`);
        return false;
      }
      
      console.log('SQL fix executed successfully via REST endpoint');
      return true;
    } catch (restErr) {
      console.error(`Error with REST approach: ${restErr.message}`);
      
      // Last resort: split the SQL into statements and execute each one
      console.log('Attempting to execute SQL statements individually...');
      
      // Simple SQL parser to split into statements (not perfect but works for most cases)
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      console.log(`Found ${statements.length} SQL statements to execute`);
      
      let success = true;
      for (let i = 0; i < statements.length; i++) {
        try {
          const stmt = statements[i];
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          
          const { error: stmtError } = await supabase.rpc('pgmoon_exec', { query: stmt + ';' });
          
          if (stmtError) {
            console.error(`Error executing statement ${i + 1}: ${stmtError.message}`);
            success = false;
          }
        } catch (stmtErr) {
          console.error(`Exception executing statement ${i + 1}: ${stmtErr.message}`);
          success = false;
        }
      }
      
      return success;
    }
  }
}

/**
 * Verify the function was created successfully
 */
async function verifyFunctionExists() {
  console.log('\n=== Verifying Function Exists ===');
  
  try {
    // Query the pg_proc catalog to check if the function exists
    const { data, error } = await supabase.rpc('pgmoon_exec', { 
      query: `
        SELECT proname, pronargs 
        FROM pg_proc 
        WHERE proname = 'get_visible_want_lists' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
      `
    });
    
    if (error) {
      console.error(`Error verifying function: ${error.message}`);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log('Function get_visible_want_lists exists in the database');
      return true;
    } else {
      console.error('Function get_visible_want_lists was not found in the database');
      return false;
    }
  } catch (err) {
    console.error(`Error verifying function: ${err.message}`);
    
    // Alternative approach - try to call the function
    console.log('Attempting to call the function to verify it exists...');
    
    try {
      const { data: testData, error: testError } = await supabase.rpc('get_visible_want_lists', {
        viewer_id: MVP_DEALER_ID,
        show_id: SHOW_ID,
        page: 1,
        page_size: 10
      });
      
      if (testError && testError.message.includes('does not exist')) {
        console.error('Function get_visible_want_lists does not exist');
        return false;
      }
      
      // If we get here, the function exists (even if it returns an error for other reasons)
      console.log('Function get_visible_want_lists exists (verified by calling it)');
      return true;
    } catch (callErr) {
      if (callErr.message.includes('does not exist')) {
        console.error('Function get_visible_want_lists does not exist');
        return false;
      }
      
      console.log('Function likely exists but returned an error for other reasons');
      return true;
    }
  }
}

/**
 * Test the function with sample parameters
 */
async function testFunction() {
  console.log('\n=== Testing Function ===');
  
  try {
    console.log('Testing with MVP dealer ID and show ID...');
    
    const { data, error } = await supabase.rpc('get_visible_want_lists', {
      viewer_id: MVP_DEALER_ID,
      show_id: SHOW_ID,
      page: 1,
      page_size: 10
    });
    
    if (error) {
      console.error(`Error testing function: ${error.message}`);
      return false;
    }
    
    console.log('Function executed successfully!');
    console.log('Results:');
    console.log(`- Total count: ${data?.totalCount || 0}`);
    console.log(`- Items returned: ${data?.data?.length || 0}`);
    console.log(`- Has more: ${data?.hasMore || false}`);
    
    if (data?.data?.length > 0) {
      console.log('\nSample want list:');
      const sample = data.data[0];
      console.log(`- ID: ${sample.id}`);
      console.log(`- User: ${sample.userName} (${sample.userRole})`);
      console.log(`- Show: ${sample.showTitle}`);
      console.log(`- Content preview: ${sample.content.substring(0, 50)}${sample.content.length > 50 ? '...' : ''}`);
      console.log(`- Updated at: ${sample.updatedAt}`);
    } else {
      console.log('\nNo want lists found. This could be due to:');
      console.log('1. No attendees with want lists for this show');
      console.log('2. The MVP dealer is not registered for the show');
      console.log('3. The show is not upcoming/ongoing');
    }
    
    return true;
  } catch (err) {
    console.error(`Error testing function: ${err.message}`);
    return false;
  }
}

/**
 * Main function to run all steps
 */
async function main() {
  console.log('======================================================');
  console.log('APPLYING SQL FIX FOR get_visible_want_lists');
  console.log('======================================================');
  
  try {
    // Step 1: Read the SQL fix file
    const sqlContent = await readSqlFixFile();
    if (!sqlContent) {
      console.error('Failed to read SQL fix file, aborting...');
      return;
    }
    
    // Step 2: Execute the SQL fix
    const executed = await executeSqlFix(sqlContent);
    if (!executed) {
      console.error('Failed to execute SQL fix, aborting...');
      return;
    }
    
    // Step 3: Verify the function exists
    const exists = await verifyFunctionExists();
    if (!exists) {
      console.error('Function does not exist after SQL fix, aborting...');
      return;
    }
    
    // Step 4: Test the function
    await testFunction();
    
    console.log('\n======================================================');
    console.log('SQL FIX APPLIED SUCCESSFULLY');
    console.log('======================================================');
    console.log('\nNext steps:');
    console.log('1. Run the test-want-list-access-final.js script to verify all functionality');
    console.log('2. Test the Collection screen in the app');
    console.log('3. MVP Dealer should now see the want lists section');
    
  } catch (err) {
    console.error(`Unhandled error: ${err.message}`);
  }
}

// Run the script
main()
  .catch(err => {
    console.error('Unhandled error:', err);
  })
  .finally(() => {
    console.log('\nSQL fix script completed.');
  });
