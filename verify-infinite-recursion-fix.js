/**
 * verify-infinite-recursion-fix.js
 * 
 * This script verifies whether the fix for the infinite recursion issue in 
 * the show_participants RLS policies has been applied to the database.
 * 
 * It checks:
 * 1. Whether the problematic policy "show_participants_select_mvp_dealer" still exists
 * 2. Whether the fixed policy "show_participants_select_mvp_dealer_fixed" exists
 * 3. Whether the helper function "participates_in_show_safe" exists
 * 4. Whether the basic self-select policy "show_participants_select_self" exists
 * 
 * Usage: node verify-infinite-recursion-fix.js
 */

require('dotenv').config();
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
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(`${COLORS.red}Error: Missing Supabase credentials in environment variables.${COLORS.reset}`);
  console.error(`${COLORS.yellow}Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env file.${COLORS.reset}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Main verification function
 */
async function verifyFix() {
  console.log(`${COLORS.cyan}=== Show Participants Infinite Recursion Fix Verification ===${COLORS.reset}`);
  console.log(`${COLORS.cyan}Connecting to Supabase at: ${supabaseUrl}${COLORS.reset}\n`);

  try {
    const results = {
      problematicPolicyExists: false,
      fixedPolicyExists: false,
      helperFunctionExists: false,
      selfSelectPolicyExists: false
    };

    // Check if the problematic policy still exists
    const { data: problematicPolicy, error: policyError } = await supabase.rpc(
      'check_policy_exists',
      { policy_name: 'show_participants_select_mvp_dealer', table_name: 'show_participants' }
    );
    
    if (policyError) {
      // If the RPC doesn't exist, fall back to a raw SQL query
      const { data: rawPolicyData, error: rawPolicyError } = await supabase.from('pg_policies')
        .select('polname')
        .eq('tablename', 'show_participants')
        .eq('polname', 'show_participants_select_mvp_dealer')
        .maybeSingle();
      
      if (!rawPolicyError) {
        results.problematicPolicyExists = !!rawPolicyData;
      } else {
        console.warn(`${COLORS.yellow}Warning: Could not check problematic policy existence: ${rawPolicyError.message}${COLORS.reset}`);
      }
    } else {
      results.problematicPolicyExists = problematicPolicy;
    }

    // Check if the fixed policy exists
    const { data: fixedPolicy, error: fixedPolicyError } = await supabase.rpc(
      'check_policy_exists',
      { policy_name: 'show_participants_select_mvp_dealer_fixed', table_name: 'show_participants' }
    );
    
    if (fixedPolicyError) {
      // If the RPC doesn't exist, fall back to a raw SQL query
      const { data: rawFixedData, error: rawFixedError } = await supabase.from('pg_policies')
        .select('polname')
        .eq('tablename', 'show_participants')
        .eq('polname', 'show_participants_select_mvp_dealer_fixed')
        .maybeSingle();
      
      if (!rawFixedError) {
        results.fixedPolicyExists = !!rawFixedData;
      } else {
        console.warn(`${COLORS.yellow}Warning: Could not check fixed policy existence: ${rawFixedError.message}${COLORS.reset}`);
      }
    } else {
      results.fixedPolicyExists = fixedPolicy;
    }

    // Check if the helper function exists
    const { data: helperFunction, error: functionError } = await supabase.rpc(
      'check_function_exists',
      { function_name: 'participates_in_show_safe' }
    );
    
    if (functionError) {
      // If the RPC doesn't exist, we can't easily check function existence without superuser privileges
      console.warn(`${COLORS.yellow}Warning: Could not check helper function existence: ${functionError.message}${COLORS.reset}`);
      console.warn(`${COLORS.yellow}You may need to manually verify the function 'participates_in_show_safe' exists.${COLORS.reset}`);
    } else {
      results.helperFunctionExists = helperFunction;
    }

    // Check if the self-select policy exists
    const { data: selfPolicy, error: selfPolicyError } = await supabase.rpc(
      'check_policy_exists',
      { policy_name: 'show_participants_select_self', table_name: 'show_participants' }
    );
    
    if (selfPolicyError) {
      // If the RPC doesn't exist, fall back to a raw SQL query
      const { data: rawSelfData, error: rawSelfError } = await supabase.from('pg_policies')
        .select('polname')
        .eq('tablename', 'show_participants')
        .eq('polname', 'show_participants_select_self')
        .maybeSingle();
      
      if (!rawSelfError) {
        results.selfSelectPolicyExists = !!rawSelfData;
      } else {
        console.warn(`${COLORS.yellow}Warning: Could not check self-select policy existence: ${rawSelfError.message}${COLORS.reset}`);
      }
    } else {
      results.selfSelectPolicyExists = selfPolicy;
    }

    // Print the verification results
    printResults(results);

  } catch (error) {
    console.error(`${COLORS.red}Error during verification: ${error.message}${COLORS.reset}`);
    process.exit(1);
  }
}

/**
 * Print formatted verification results
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
    console.log(`${COLORS.yellow}Please apply the migration: 20250722000000_fix_show_participants_infinite_recursion.sql${COLORS.reset}`);
  } else {
    console.log(`${COLORS.green}✅ OVERALL STATUS: The infinite recursion fix has been successfully applied!${COLORS.reset}`);
  }
}

// Execute the verification
verifyFix().catch(err => {
  console.error(`${COLORS.red}Unhandled error: ${err.message}${COLORS.reset}`);
  process.exit(1);
});
