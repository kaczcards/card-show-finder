#!/usr/bin/env node
/**
 * Card Show Finder - Test Single UUID
 * 
 * This script tests the admin functions with a specific UUID.
 * It checks if the record exists and runs each function against it.
 */

const fs = require('fs');
const path = require('path');
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

// Import admin functions
const {
  getFeedbackStats,
  getSourceStats,
  findDuplicatePendingShows,
  getPendingQualityView
} = require('./simple-admin-functions');

// Target UUID to test
const TARGET_UUID = '004025a2-8e98-4fe4-86b0-a6ee9d321842';

/**
 * Main function to test admin functions with a specific UUID
 */
async function testSingleUuid() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - TEST SINGLE UUID${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // 1. Check environment variables
    validateEnvironmentVariables();
    
    // 2. Create Supabase client
    const supabase = createSupabaseClient();
    console.log(`${colors.green}✓ Connected to Supabase${colors.reset}`);
    
    // 3. Check if the UUID exists
    console.log(`\n${colors.bright}Checking if UUID exists: ${TARGET_UUID}${colors.reset}`);
    const recordExists = await checkUuidExists(supabase, TARGET_UUID);
    
    if (recordExists) {
      console.log(`${colors.green}✓ Record found! Testing admin functions...${colors.reset}`);
      await testAdminFunctionsWithUuid(supabase, TARGET_UUID);
    } else {
      console.log(`${colors.yellow}⚠ Record not found with UUID: ${TARGET_UUID}${colors.reset}`);
      await checkTableStatus(supabase);
    }
    
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
 * Check if a UUID exists in the scraped_shows_pending table
 */
async function checkUuidExists(supabase, uuid) {
  try {
    const { data, error } = await supabase
      .from('scraped_shows_pending')
      .select('id, status, source_url, created_at, raw_payload')
      .eq('id', uuid)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return false;
      }
      throw error;
    }
    
    if (data) {
      console.log(`${colors.cyan}Record details:${colors.reset}`);
      console.log(`${colors.dim}ID:${colors.reset} ${data.id}`);
      console.log(`${colors.dim}Status:${colors.reset} ${data.status}`);
      console.log(`${colors.dim}Source:${colors.reset} ${data.source_url}`);
      console.log(`${colors.dim}Created:${colors.reset} ${data.created_at}`);
      console.log(`${colors.dim}Raw Payload:${colors.reset}`);
      console.log(JSON.stringify(data.raw_payload, null, 2));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`${colors.red}Error checking UUID: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Check the status of the scraped_shows_pending table
 */
async function checkTableStatus(supabase) {
  console.log(`\n${colors.bright}Checking the status of scraped_shows_pending table...${colors.reset}`);
  
  try {
    // Check if there are any records in the table
    const { data, error, count } = await supabase
      .from('scraped_shows_pending')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }
    
    if (count === 0) {
      console.log(`${colors.yellow}⚠ The scraped_shows_pending table is empty.${colors.reset}`);
      console.log(`${colors.yellow}No records are available for testing.${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ The scraped_shows_pending table contains ${count} records.${colors.reset}`);
      
      // Get a sample of records
      const { data: sampleData, error: sampleError } = await supabase
        .from('scraped_shows_pending')
        .select('id, status, source_url, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (sampleError) {
        throw sampleError;
      }
      
      console.log(`${colors.cyan}Sample records:${colors.reset}`);
      sampleData.forEach((record, i) => {
        console.log(`${colors.dim}${i + 1}.${colors.reset} ID: ${record.id}, Status: ${record.status}, Source: ${record.source_url}`);
      });
      
      console.log(`\n${colors.yellow}The specific UUID ${TARGET_UUID} was not found among these records.${colors.reset}`);
    }
    
    // Check RLS policies
    console.log(`\n${colors.bright}Checking Row Level Security (RLS) policies...${colors.reset}`);
    
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('get_table_rls_policies', { table_name: 'scraped_shows_pending' });
    
    if (rlsError) {
      console.log(`${colors.yellow}⚠ Could not check RLS policies: ${rlsError.message}${colors.reset}`);
      console.log(`${colors.yellow}This may indicate RLS is preventing access to the table.${colors.reset}`);
    } else if (rlsData && rlsData.length > 0) {
      console.log(`${colors.cyan}RLS policies found:${colors.reset}`);
      rlsData.forEach((policy, i) => {
        console.log(`${colors.dim}${i + 1}.${colors.reset} ${policy.policyname}: ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} for ${policy.cmd}`);
      });
      
      console.log(`\n${colors.yellow}RLS policies may be restricting access to the records.${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ No restrictive RLS policies found.${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Error checking table status: ${error.message}${colors.reset}`);
  }
}

/**
 * Test admin functions with a specific UUID
 */
async function testAdminFunctionsWithUuid(supabase, uuid) {
  console.log(`\n${colors.bright}Testing admin functions with UUID: ${uuid}${colors.reset}`);
  
  // 1. Test getPendingQualityView
  console.log(`\n${colors.bright}${colors.magenta}Testing getPendingQualityView for this UUID...${colors.reset}`);
  try {
    // First get the record directly to compare
    const { data: recordData, error: recordError } = await supabase
      .from('scraped_shows_pending')
      .select('*')
      .eq('id', uuid)
      .single();
    
    if (recordError) throw recordError;
    
    // Then use the function
    const results = await getPendingQualityView(supabase, { 
      limit: 100, 
      offset: 0, 
      status: recordData.status 
    });
    
    // Find our specific record in the results
    const targetRecord = results.find(record => record.id === uuid);
    
    if (targetRecord) {
      console.log(`${colors.green}✓ Record found in getPendingQualityView results${colors.reset}`);
      console.log(`${colors.cyan}Quality score:${colors.reset} ${targetRecord.quality_score}`);
      console.log(`${colors.cyan}Quality band:${colors.reset} ${targetRecord.quality_band}`);
      console.log(`${colors.cyan}Potential issues:${colors.reset} ${targetRecord.potential_issues.join(', ') || 'None'}`);
      
      // Show field mapping
      console.log(`\n${colors.cyan}Field mapping from raw_payload to processed fields:${colors.reset}`);
      console.log(`${colors.dim}name:${colors.reset} ${recordData.raw_payload?.name || 'N/A'} → ${targetRecord.name || 'N/A'}`);
      console.log(`${colors.dim}startDate:${colors.reset} ${recordData.raw_payload?.startDate || 'N/A'} → ${targetRecord.start_date || 'N/A'}`);
      console.log(`${colors.dim}city:${colors.reset} ${recordData.raw_payload?.city || 'N/A'} → ${targetRecord.city || 'N/A'}`);
      console.log(`${colors.dim}state:${colors.reset} ${recordData.raw_payload?.state || 'N/A'} → ${targetRecord.state || 'N/A'}`);
      console.log(`${colors.dim}venueName:${colors.reset} ${recordData.raw_payload?.venueName || 'N/A'} → ${targetRecord.venue_name || 'N/A'}`);
      console.log(`${colors.dim}address:${colors.reset} ${recordData.raw_payload?.address || 'N/A'} → ${targetRecord.address || 'N/A'}`);
    } else {
      console.log(`${colors.yellow}⚠ Record not found in getPendingQualityView results${colors.reset}`);
      console.log(`${colors.yellow}This may be due to status filtering. Current record status: ${recordData.status}${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ getPendingQualityView test failed: ${error.message}${colors.reset}`);
  }
  
  // 2. Test findDuplicatePendingShows
  console.log(`\n${colors.bright}${colors.magenta}Testing findDuplicatePendingShows for this UUID...${colors.reset}`);
  try {
    const results = await findDuplicatePendingShows(supabase, { 
      similarity_threshold: 0.5, 
      max_results: 100 
    });
    
    // Check if our UUID is in any of the duplicate pairs
    const duplicates = results.filter(dup => 
      dup.id1 === uuid || dup.id2 === uuid
    );
    
    if (duplicates.length > 0) {
      console.log(`${colors.green}✓ Found ${duplicates.length} potential duplicates for this record${colors.reset}`);
      
      duplicates.forEach((dup, i) => {
        console.log(`\n${colors.cyan}Duplicate ${i + 1}:${colors.reset}`);
        console.log(`${colors.dim}Similarity:${colors.reset} ${(dup.similarity * 100).toFixed(1)}%`);
        console.log(`${colors.dim}Show 1:${colors.reset} ${dup.name1} (${dup.start_date1}) in ${dup.city1}, ${dup.state1}`);
        console.log(`${colors.dim}Show 2:${colors.reset} ${dup.name2} (${dup.start_date2}) in ${dup.city2}, ${dup.state2}`);
      });
    } else {
      console.log(`${colors.yellow}⚠ No duplicates found for this record${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ findDuplicatePendingShows test failed: ${error.message}${colors.reset}`);
  }
  
  // 3. Test source statistics
  console.log(`\n${colors.bright}${colors.magenta}Testing getSourceStats for the source of this record...${colors.reset}`);
  try {
    // First get the record to find its source
    const { data: recordData, error: recordError } = await supabase
      .from('scraped_shows_pending')
      .select('source_url')
      .eq('id', uuid)
      .single();
    
    if (recordError) throw recordError;
    
    const sourceUrl = recordData.source_url;
    console.log(`${colors.cyan}Source URL:${colors.reset} ${sourceUrl}`);
    
    // Then use the function
    const results = await getSourceStats(supabase, { 
      days_ago: 90, 
      min_shows: 1 
    });
    
    // Find our specific source in the results
    const sourceStats = results.find(source => source.source_url === sourceUrl);
    
    if (sourceStats) {
      console.log(`${colors.green}✓ Source found in getSourceStats results${colors.reset}`);
      console.log(`${colors.cyan}Total shows:${colors.reset} ${sourceStats.total_shows}`);
      console.log(`${colors.cyan}Approval rate:${colors.reset} ${sourceStats.approval_rate}%`);
      console.log(`${colors.cyan}Rejection rate:${colors.reset} ${sourceStats.rejection_rate}%`);
      console.log(`${colors.cyan}Average quality:${colors.reset} ${sourceStats.avg_quality_score}`);
      console.log(`${colors.cyan}Priority score:${colors.reset} ${sourceStats.priority_score}`);
      
      if (Object.keys(sourceStats.common_issues).length > 0) {
        console.log(`${colors.cyan}Common issues:${colors.reset}`);
        Object.entries(sourceStats.common_issues).forEach(([issue, count]) => {
          console.log(`  ${colors.dim}${issue}:${colors.reset} ${count}`);
        });
      } else {
        console.log(`${colors.cyan}Common issues:${colors.reset} None`);
      }
    } else {
      console.log(`${colors.yellow}⚠ Source not found in getSourceStats results${colors.reset}`);
      console.log(`${colors.yellow}This may be due to minimum show count filtering or date range.${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ getSourceStats test failed: ${error.message}${colors.reset}`);
  }
  
  // 4. Test feedback statistics
  console.log(`\n${colors.bright}${colors.magenta}Testing getFeedbackStats related to this record...${colors.reset}`);
  try {
    // Check if this record has any feedback
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('admin_feedback')
      .select('*')
      .eq('pending_id', uuid);
    
    if (feedbackError) throw feedbackError;
    
    if (feedbackData && feedbackData.length > 0) {
      console.log(`${colors.green}✓ Found ${feedbackData.length} feedback entries for this record${colors.reset}`);
      
      feedbackData.forEach((feedback, i) => {
        console.log(`\n${colors.cyan}Feedback ${i + 1}:${colors.reset}`);
        console.log(`${colors.dim}Action:${colors.reset} ${feedback.action}`);
        console.log(`${colors.dim}Feedback:${colors.reset} ${feedback.feedback}`);
        console.log(`${colors.dim}Created:${colors.reset} ${feedback.created_at}`);
      });
      
      // Then use the function
      const results = await getFeedbackStats(supabase, { 
        days_ago: 90, 
        min_count: 1 
      });
      
      // Extract tags from the feedback
      const feedbackTags = [];
      feedbackData.forEach(feedback => {
        const feedbackText = feedback.feedback || '';
        const dashIndex = Math.max(feedbackText.indexOf('-'), feedbackText.indexOf('–'));
        const tagSection = dashIndex > 0 ? feedbackText.substring(0, dashIndex) : feedbackText;
        const tags = tagSection.split(/[,\s]+/).map(tag => tag.trim().toUpperCase()).filter(tag => tag);
        feedbackTags.push(...tags);
      });
      
      // Find our tags in the results
      const relevantStats = results.filter(stat => 
        feedbackTags.includes(stat.tag)
      );
      
      if (relevantStats.length > 0) {
        console.log(`\n${colors.green}✓ Found statistics for ${relevantStats.length} feedback tags related to this record${colors.reset}`);
        
        relevantStats.forEach((stat, i) => {
          console.log(`\n${colors.cyan}Tag ${i + 1}: ${stat.tag}${colors.reset}`);
          console.log(`${colors.dim}Count:${colors.reset} ${stat.count}`);
          console.log(`${colors.dim}Percentage:${colors.reset} ${stat.percentage}%`);
          console.log(`${colors.dim}Trend:${colors.reset} ${stat.trend !== null ? `${stat.trend > 0 ? '+' : ''}${stat.trend}%` : 'N/A'}`);
        });
      } else {
        console.log(`${colors.yellow}⚠ No statistics found for the feedback tags of this record${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}⚠ No feedback found for this record${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ getFeedbackStats test failed: ${error.message}${colors.reset}`);
  }
  
  console.log(`\n${colors.bright}${colors.green}All tests completed for UUID: ${uuid}${colors.reset}`);
}

// Run the test
testSingleUuid().catch(console.error);
