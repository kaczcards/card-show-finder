#!/usr/bin/env node
/**
 * Card Show Finder - Admin Feedback Functions Test
 * 
 * This script tests the SQL helper functions for the admin evaluation system.
 * It connects to the database and runs sample queries to verify functionality.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Main function to test admin feedback functions
 */
async function testAdminFeedbackFunctions() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - ADMIN FEEDBACK FUNCTIONS TEST${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // 1. Check environment variables
    validateEnvironmentVariables();
    
    // 2. Create Supabase client
    const supabase = createSupabaseClient();
    console.log(`${colors.green}✓ Connected to Supabase${colors.reset}\n`);
    
    // 3. Run tests for each function
    await testGetFeedbackStats(supabase);
    await testGetSourceStats(supabase);
    await testFindDuplicatePendingShows(supabase);
    await testCalculateSourceRejectionRate(supabase);
    await testPendingQualityView(supabase);
    
    console.log(`\n${colors.bright}${colors.green}All tests completed!${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}ERROR: ${error.message}${colors.reset}`);
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironmentVariables() {
  const requiredVars = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please create a .env file with the following variables:\n` +
      `EXPO_PUBLIC_SUPABASE_URL=your_supabase_url\n` +
      `SUPABASE_SERVICE_KEY=your_service_key`
    );
  }
  
  console.log(`${colors.green}✓ Environment variables validated${colors.reset}`);
}

/**
 * Create Supabase client with production credentials
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Test get_feedback_stats function
 */
async function testGetFeedbackStats(supabase) {
  console.log(`${colors.bright}${colors.magenta}Testing get_feedback_stats(7, 1)...${colors.reset}`);
  
  try {
    const { data, error } = await supabase.rpc('get_feedback_stats', { 
      days_ago: 7,
      min_count: 1
    });
    
    if (error) throw new Error(error.message);
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (data && data.length > 0) {
      console.table(data.map(row => ({
        tag: row.tag,
        count: row.count,
        percentage: `${row.percentage}%`,
        trend: row.trend ? `${row.trend > 0 ? '+' : ''}${row.trend}%` : 'N/A'
      })));
    } else {
      console.log(`${colors.yellow}No feedback data found in the last 7 days${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
  }
}

/**
 * Test get_source_stats function
 */
async function testGetSourceStats(supabase) {
  console.log(`\n${colors.bright}${colors.magenta}Testing get_source_stats(30, 5)...${colors.reset}`);
  
  try {
    const { data, error } = await supabase.rpc('get_source_stats', { 
      days_ago: 30,
      min_shows: 5
    });
    
    if (error) throw new Error(error.message);
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (data && data.length > 0) {
      console.table(data.map(row => ({
        source_url: row.source_url,
        total_shows: row.total_shows,
        approval_rate: `${row.approval_rate}%`,
        rejection_rate: `${row.rejection_rate}%`,
        avg_quality_score: row.avg_quality_score,
        priority_score: row.priority_score
      })));
    } else {
      console.log(`${colors.yellow}No source data found meeting the criteria${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
  }
}

/**
 * Test find_duplicate_pending_shows function
 */
async function testFindDuplicatePendingShows(supabase) {
  console.log(`\n${colors.bright}${colors.magenta}Testing find_duplicate_pending_shows(0.6, 10)...${colors.reset}`);
  
  try {
    const { data, error } = await supabase.rpc('find_duplicate_pending_shows', { 
      similarity_threshold: 0.6,
      max_results: 10
    });
    
    if (error) throw new Error(error.message);
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (data && data.length > 0) {
      console.table(data.map(row => ({
        name1: truncate(row.name1, 20),
        name2: truncate(row.name2, 20),
        start_date1: row.start_date1,
        start_date2: row.start_date2,
        city1: row.city1,
        city2: row.city2,
        similarity: `${(row.similarity * 100).toFixed(1)}%`
      })));
    } else {
      console.log(`${colors.yellow}No duplicate shows found${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
  }
}

/**
 * Test calculate_source_rejection_rate function
 */
async function testCalculateSourceRejectionRate(supabase) {
  console.log(`\n${colors.bright}${colors.magenta}Testing calculate_source_rejection_rate(30, 5)...${colors.reset}`);
  
  try {
    const { data, error } = await supabase.rpc('calculate_source_rejection_rate', { 
      days_ago: 30,
      min_shows: 5
    });
    
    if (error) throw new Error(error.message);
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (data && data.length > 0) {
      console.table(data.map(row => ({
        source_url: row.source_url,
        total_shows: row.total_shows,
        rejection_rate: `${row.rejection_rate}%`,
        current_priority: row.current_priority,
        suggested_priority: row.suggested_priority
      })));
    } else {
      console.log(`${colors.yellow}No source data found meeting the criteria${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
  }
}

/**
 * Test pending_quality_view
 */
async function testPendingQualityView(supabase) {
  console.log(`\n${colors.bright}${colors.magenta}Testing pending_quality_view (top 5 rows)...${colors.reset}`);
  
  try {
    const { data, error } = await supabase
      .from('pending_quality_view')
      .select('*')
      .limit(5);
    
    if (error) throw new Error(error.message);
    
    console.log(`${colors.green}✓ View query executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (data && data.length > 0) {
      console.table(data.map(row => ({
        name: truncate(row.name, 25),
        start_date: row.start_date,
        city: row.city,
        state: row.state,
        quality_score: row.quality_score,
        quality_band: row.quality_band
      })));
    } else {
      console.log(`${colors.yellow}No pending shows found${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
  }
}

/**
 * Truncate a string to a maximum length and add ellipsis if needed
 */
function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

// Run the tests
testAdminFeedbackFunctions();
