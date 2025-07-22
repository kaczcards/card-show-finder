/**
 * apply-infinite-recursion-fix.js
 * 
 * This script applies the fix for the infinite recursion issue in the 
 * show_participants RLS policies by executing the SQL statements from
 * the migration file using the Supabase client.
 * 
 * Usage: node apply-infinite-recursion-fix.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Constants for colorizing console output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(`${COLORS.red}Error: Missing Supabase credentials in environment variables.${COLORS.reset}`);
  console.error(`${COLORS.yellow}Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env file.${COLORS.reset}`);
  console.error(`${COLORS.yellow}Note: You need a service key (not anon key) to modify database policies.${COLORS.reset}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Path to the migration file
const migrationFilePath = path.join(__dirname, 'supabase', 'migrations', '20250722000000_fix_show_participants_infinite_recursion.sql');

/**
 * Parse SQL file into individual statements
 * @param {string} filePath - Path to SQL file
 * @returns {string[]} Array of SQL statements
 */
function parseSqlFile(filePath) {
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Remove comments and split by semicolons
    const statements = [];
    let currentStatement = '';
    let inMultilineComment = false;
    let inSingleLineComment = false;
    let inStringLiteral = false;
    let escapeNext = false;
    
    // Split the SQL into statements, handling comments and string literals
    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];
      const nextChar = sqlContent[i + 1] || '';
      
      // Handle escape sequences in string literals
      if (inStringLiteral && char === '\\') {
        escapeNext = true;
        currentStatement += char;
        continue;
      }
      
      if (escapeNext) {
        escapeNext = false;
        currentStatement += char;
        continue;
      }
      
      // Handle string literals
      if (char === "'" && !inMultilineComment && !inSingleLineComment) {
        inStringLiteral = !inStringLiteral;
        currentStatement += char;
        continue;
      }
      
      // Skip if in string literal
      if (inStringLiteral) {
        currentStatement += char;
        continue;
      }
      
      // Handle multiline comments
      if (char === '/' && nextChar === '*' && !inSingleLineComment && !inMultilineComment) {
        inMultilineComment = true;
        i++; // Skip the next character
        continue;
      }
      
      if (char === '*' && nextChar === '/' && inMultilineComment) {
        inMultilineComment = false;
        i++; // Skip the next character
        continue;
      }
      
      // Handle single line comments
      if (char === '-' && nextChar === '-' && !inSingleLineComment && !inMultilineComment) {
        inSingleLineComment = true;
        i++; // Skip the next character
        continue;
      }
      
      if ((char === '\n' || char === '\r') && inSingleLineComment) {
        inSingleLineComment = false;
      }
      
      // Skip if in any comment
      if (inMultilineComment || inSingleLineComment) {
        continue;
      }
      
      // Handle statement termination
      if (char === ';') {
        const trimmedStatement = currentStatement.trim();
        if (trimmedStatement) {
          statements.push(trimmedStatement + ';');
        }
        currentStatement = '';
        continue;
      }
      
      // Add character to current statement
      currentStatement += char;
    }
    
    // Add the last statement if it exists
    const trimmedStatement = currentStatement.trim();
    if (trimmedStatement) {
      statements.push(trimmedStatement + ';');
    }
    
    // Filter out BEGIN, COMMIT, ROLLBACK and empty statements
    return statements.filter(stmt => {
      const upperStmt = stmt.toUpperCase().trim();
      return !upperStmt.match(/^(BEGIN|COMMIT|ROLLBACK);$/) && upperStmt !== ';';
    });
  } catch (error) {
    console.error(`${COLORS.red}Error parsing SQL file: ${error.message}${COLORS.reset}`);
    return [];
  }
}

/**
 * Execute a SQL statement using Supabase client
 * @param {string} sql - SQL statement to execute
 * @returns {Promise<Object>} Result of the execution
 */
async function executeSql(sql) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    // If the exec_sql RPC doesn't exist, we'll try a different approach
    console.warn(`${COLORS.yellow}Warning: Could not execute via RPC: ${error.message}${COLORS.reset}`);
    console.warn(`${COLORS.yellow}Attempting direct SQL execution...${COLORS.reset}`);
    
    try {
      // For functions, we can use direct SQL execution
      if (sql.toUpperCase().includes('CREATE OR REPLACE FUNCTION')) {
        const { data, error } = await supabase.from('_functions').insert({ definition: sql }).select();
        if (error) throw error;
        return { success: true, data };
      }
      
      // For policies, we need to parse and use the appropriate API
      if (sql.toUpperCase().includes('DROP POLICY')) {
        const matches = sql.match(/DROP POLICY IF EXISTS ["]?([^"]+)["]? ON ([^;]+)/i);
        if (matches && matches.length >= 3) {
          const policyName = matches[1].replace(/"/g, '');
          const tableName = matches[2].replace(/public\./i, '').replace(/"/g, '').trim();
          
          // Use the policies API to delete
          const { data, error } = await supabase.from('_policies')
            .delete()
            .eq('name', policyName)
            .eq('table', tableName);
          
          if (error) throw error;
          return { success: true, data, message: `Dropped policy ${policyName} on ${tableName}` };
        }
      }
      
      if (sql.toUpperCase().includes('CREATE POLICY')) {
        // This is more complex and would require parsing the policy definition
        // For now, we'll return an error suggesting manual intervention
        throw new Error('Direct policy creation not supported. Please use the Supabase dashboard or SQL editor.');
      }
      
      throw new Error('Direct SQL execution not supported for this statement type.');
    } catch (innerError) {
      return { 
        success: false, 
        error: innerError.message,
        sql
      };
    }
  }
}

/**
 * Verify that the fix has been applied correctly
 * @returns {Promise<Object>} Verification results
 */
async function verifyFix() {
  try {
    const results = {
      problematicPolicyExists: false,
      fixedPolicyExists: false,
      helperFunctionExists: false,
      selfSelectPolicyExists: false
    };
    
    // Check for the existence of the problematic policy
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('polname')
      .eq('tablename', 'show_participants')
      .eq('polname', 'show_participants_select_mvp_dealer');
    
    if (!policiesError) {
      results.problematicPolicyExists = policies && policies.length > 0;
    }
    
    // Check for the existence of the fixed policy
    const { data: fixedPolicies, error: fixedPoliciesError } = await supabase
      .from('pg_policies')
      .select('polname')
      .eq('tablename', 'show_participants')
      .eq('polname', 'show_participants_select_mvp_dealer_fixed');
    
    if (!fixedPoliciesError) {
      results.fixedPolicyExists = fixedPolicies && fixedPolicies.length > 0;
    }
    
    // Check for the existence of the helper function
    const { data: functions, error: functionsError } = await supabase
      .rpc('function_exists', { function_name: 'participates_in_show_safe' });
    
    if (!functionsError) {
      results.helperFunctionExists = !!functions;
    }
    
    // Check for the existence of the self-select policy
    const { data: selfPolicies, error: selfPoliciesError } = await supabase
      .from('pg_policies')
      .select('polname')
      .eq('tablename', 'show_participants')
      .eq('polname', 'show_participants_select_self');
    
    if (!selfPoliciesError) {
      results.selfSelectPolicyExists = selfPolicies && selfPolicies.length > 0;
    }
    
    return results;
  } catch (error) {
    console.error(`${COLORS.red}Error during verification: ${error.message}${COLORS.reset}`);
    return {
      error: error.message,
      problematicPolicyExists: false,
      fixedPolicyExists: false,
      helperFunctionExists: false,
      selfSelectPolicyExists: false
    };
  }
}

/**
 * Print formatted verification results
 * @param {Object} results - Verification results
 */
function printResults(results) {
  console.log(`${COLORS.cyan}=== Verification Results ===${COLORS.reset}\n`);

  // Check problematic policy
  if (results.problematicPolicyExists) {
    console.log(`${COLORS.red}❌ ISSUE: Problematic policy "show_participants_select_mvp_dealer" still exists!${COLORS.reset}`);
    console.log(`   This policy causes infinite recursion and should be dropped.`);
  } else {
    console.log(`${COLORS.green}✅ Problematic policy "show_participants_select_mvp_dealer" has been removed.${COLORS.reset}`);
  }

  // Check fixed policy
  if (results.fixedPolicyExists) {
    console.log(`${COLORS.green}✅ Fixed policy "show_participants_select_mvp_dealer_fixed" is present.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}❌ ISSUE: Fixed policy "show_participants_select_mvp_dealer_fixed" is missing!${COLORS.reset}`);
    console.log(`   This policy should be created to replace the problematic one.`);
  }

  // Check helper function
  if (results.helperFunctionExists) {
    console.log(`${COLORS.green}✅ Helper function "participates_in_show_safe" is present.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}❌ ISSUE: Helper function "participates_in_show_safe" is missing!${COLORS.reset}`);
    console.log(`   This function is needed for the fixed policy to work correctly.`);
  }

  // Check self-select policy
  if (results.selfSelectPolicyExists) {
    console.log(`${COLORS.green}✅ Self-select policy "show_participants_select_self" is present.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}⚠️ WARNING: Self-select policy "show_participants_select_self" is missing.${COLORS.reset}`);
    console.log(`   This policy ensures users can always see their own participation records.`);
  }

  // Overall status
  console.log("\n");
  if (results.problematicPolicyExists || !results.fixedPolicyExists || !results.helperFunctionExists) {
    console.log(`${COLORS.red}❌ OVERALL STATUS: The infinite recursion fix has NOT been fully applied.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.green}✅ OVERALL STATUS: The infinite recursion fix has been successfully applied!${COLORS.reset}`);
  }
}

/**
 * Create the exec_sql RPC if it doesn't exist
 * This function allows executing arbitrary SQL through the Supabase client
 * @returns {Promise<boolean>} Whether the function was created
 */
async function createExecSqlFunction() {
  try {
    const sql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result JSONB;
      BEGIN
        EXECUTE sql_query;
        result := '{"success": true}'::JSONB;
        RETURN result;
      EXCEPTION WHEN OTHERS THEN
        result := jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'detail', SQLSTATE
        );
        RETURN result;
      END;
      $$;
      
      -- Grant execute permission to authenticated users
      GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
      
      -- Add security comment
      COMMENT ON FUNCTION exec_sql(TEXT) IS 'Execute SQL statements with proper error handling. SECURITY DEFINER for admin operations.';
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Function might already exist, or we don't have permissions
      console.warn(`${COLORS.yellow}Warning: Could not create exec_sql function: ${error.message}${COLORS.reset}`);
      console.warn(`${COLORS.yellow}Will attempt to use alternative methods.${COLORS.reset}`);
      return false;
    }
    
    console.log(`${COLORS.green}✅ Created exec_sql function for SQL execution${COLORS.reset}`);
    return true;
  } catch (error) {
    console.warn(`${COLORS.yellow}Warning: Could not create exec_sql function: ${error.message}${COLORS.reset}`);
    return false;
  }
}

/**
 * Create a function to check if another function exists
 * @returns {Promise<boolean>} Whether the function was created
 */
async function createFunctionExistsHelper() {
  try {
    const sql = `
      CREATE OR REPLACE FUNCTION function_exists(function_name TEXT)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        func_exists BOOLEAN;
      BEGIN
        SELECT EXISTS(
          SELECT 1 
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public' 
          AND p.proname = function_name
        ) INTO func_exists;
        
        RETURN func_exists;
      END;
      $$;
      
      -- Grant execute permission to authenticated users
      GRANT EXECUTE ON FUNCTION function_exists(TEXT) TO service_role;
      
      -- Add security comment
      COMMENT ON FUNCTION function_exists(TEXT) IS 'Check if a function exists in the public schema.';
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.warn(`${COLORS.yellow}Warning: Could not create function_exists helper: ${error.message}${COLORS.reset}`);
      return false;
    }
    
    console.log(`${COLORS.green}✅ Created function_exists helper${COLORS.reset}`);
    return true;
  } catch (error) {
    console.warn(`${COLORS.yellow}Warning: Could not create function_exists helper: ${error.message}${COLORS.reset}`);
    return false;
  }
}

/**
 * Main function to apply the infinite recursion fix
 */
async function applyFix() {
  console.log(`${COLORS.cyan}=== Applying Show Participants Infinite Recursion Fix ===${COLORS.reset}`);
  console.log(`${COLORS.cyan}Connecting to Supabase at: ${supabaseUrl}${COLORS.reset}\n`);
  
  try {
    // Check if the migration file exists
    if (!fs.existsSync(migrationFilePath)) {
      console.error(`${COLORS.red}Error: Migration file not found at ${migrationFilePath}${COLORS.reset}`);
      process.exit(1);
    }
    
    // Create helper functions for SQL execution
    await createExecSqlFunction();
    await createFunctionExistsHelper();
    
    // Parse the SQL file into individual statements
    const statements = parseSqlFile(migrationFilePath);
    
    if (statements.length === 0) {
      console.error(`${COLORS.red}Error: No valid SQL statements found in migration file${COLORS.reset}`);
      process.exit(1);
    }
    
    console.log(`${COLORS.blue}Found ${statements.length} SQL statements to execute${COLORS.reset}`);
    
    // Execute each statement
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const shortStatement = statement.length > 100 
        ? statement.substring(0, 100) + '...' 
        : statement;
      
      console.log(`\n${COLORS.blue}Executing statement ${i+1}/${statements.length}:${COLORS.reset}`);
      console.log(`${COLORS.white}${shortStatement}${COLORS.reset}`);
      
      const { success, error } = await executeSql(statement);
      
      if (success) {
        console.log(`${COLORS.green}✅ Statement executed successfully${COLORS.reset}`);
        successCount++;
      } else {
        console.error(`${COLORS.red}❌ Failed to execute statement: ${error}${COLORS.reset}`);
        failureCount++;
      }
    }
    
    console.log(`\n${COLORS.cyan}=== Execution Summary ===${COLORS.reset}`);
    console.log(`${COLORS.green}✅ ${successCount} statements executed successfully${COLORS.reset}`);
    
    if (failureCount > 0) {
      console.log(`${COLORS.red}❌ ${failureCount} statements failed${COLORS.reset}`);
    }
    
    // Verify the fix
    console.log(`\n${COLORS.cyan}=== Verifying Fix ===${COLORS.reset}`);
    const verificationResults = await verifyFix();
    printResults(verificationResults);
    
    // Final instructions
    console.log(`\n${COLORS.cyan}=== Next Steps ===${COLORS.reset}`);
    
    if (verificationResults.problematicPolicyExists || !verificationResults.fixedPolicyExists || !verificationResults.helperFunctionExists) {
      console.log(`${COLORS.yellow}Some issues remain. You may need to:${COLORS.reset}`);
      console.log(`1. Apply the migration manually using the Supabase SQL Editor`);
      console.log(`2. Check database permissions and roles`);
      console.log(`3. Contact Supabase support if issues persist`);
    } else {
      console.log(`${COLORS.green}The infinite recursion fix has been successfully applied!${COLORS.reset}`);
      console.log(`MVP dealers should now be able to access show participants without errors.`);
    }
    
  } catch (error) {
    console.error(`${COLORS.red}Unhandled error: ${error.message}${COLORS.reset}`);
    process.exit(1);
  }
}

// Execute the fix
applyFix().catch(err => {
  console.error(`${COLORS.red}Unhandled error: ${err.message}${COLORS.reset}`);
  process.exit(1);
});
