#!/usr/bin/env node
/**
 * Card Show Finder - Simple Admin Functions Installer
 * 
 * This script implements the essential admin feedback functions directly in JavaScript
 * instead of trying to create SQL functions in the database. This approach works around
 * limitations in the Supabase client's ability to execute DDL statements.
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

/**
 * Main function to implement and test admin feedback functions
 */
async function implementAdminFunctions() {
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  CARD SHOW FINDER - SIMPLE ADMIN FUNCTIONS INSTALLER${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}======================================================${colors.reset}\n`);
  
  try {
    // 1. Check environment variables
    validateEnvironmentVariables();
    
    // 2. Create Supabase client
    const supabase = createSupabaseClient();
    console.log(`${colors.green}✓ Connected to Supabase${colors.reset}`);
    
    // 3. Test each function implementation
    console.log(`\n${colors.bright}Testing admin functions...${colors.reset}`);
    
    await testGetFeedbackStats(supabase);
    await testGetSourceStats(supabase);
    await testFindDuplicatePendingShows(supabase);
    await testPendingQualityView(supabase);
    
    console.log(`\n${colors.bright}${colors.green}All tests completed!${colors.reset}`);
    console.log(`${colors.green}The admin evaluation system is now ready to use.${colors.reset}`);
    console.log(`${colors.dim}Run the CLI tool with: node admin_review_cli.js${colors.reset}\n`);
    
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
 * Implementation of get_feedback_stats function
 * 
 * Returns statistics about feedback tags with counts and trends
 */
async function getFeedbackStats(supabase, { days_ago = 30, min_count = 1 }) {
  console.log(`${colors.dim}Executing getFeedbackStats(${days_ago}, ${min_count})${colors.reset}`);
  
  try {
    // Get total feedback counts for percentage calculation
    const { data: totalData, error: totalError } = await supabase
      .from('admin_feedback')
      .select('pending_id', { count: 'exact', head: true })
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString())
      .not('feedback', 'is', null);
    
    if (totalError) throw new Error(totalError.message);
    const total_feedback = totalData.count || 0;
    
    // Get previous period total for trend calculation
    const { data: prevTotalData, error: prevTotalError } = await supabase
      .from('admin_feedback')
      .select('pending_id', { count: 'exact', head: true })
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - 2 * days_ago * 24 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString())
      .not('feedback', 'is', null);
    
    if (prevTotalError) throw new Error(prevTotalError.message);
    const total_previous = prevTotalData.count || 0;
    
    // Get all feedback entries for the current period
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('admin_feedback')
      .select('id, pending_id, feedback, created_at, admin_id, scraped_shows_pending(source_url)')
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString())
      .not('feedback', 'is', null);
    
    if (feedbackError) throw new Error(feedbackError.message);
    
    // Get all feedback entries for the previous period
    const { data: prevFeedbackData, error: prevFeedbackError } = await supabase
      .from('admin_feedback')
      .select('feedback')
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - 2 * days_ago * 24 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString())
      .not('feedback', 'is', null);
    
    if (prevFeedbackError) throw new Error(prevFeedbackError.message);
    
    // Process feedback to extract tags
    const validTags = [
      'DATE_FORMAT', 'VENUE_MISSING', 'ADDRESS_POOR', 'DUPLICATE',
      'MULTI_EVENT_COLLAPSE', 'EXTRA_HTML', 'SPAM', 'STATE_FULL',
      'CITY_MISSING'
    ];
    
    // Extract tags from current period
    const currentTags = [];
    const sourceDistributions = {};
    
    feedbackData.forEach(feedback => {
      const feedbackText = feedback.feedback || '';
      const dashIndex = Math.max(feedbackText.indexOf('-'), feedbackText.indexOf('–'));
      const tagSection = dashIndex > 0 ? feedbackText.substring(0, dashIndex) : feedbackText;
      const tags = tagSection.split(/[,\s]+/).map(tag => tag.trim().toUpperCase()).filter(tag => tag);
      
      tags.forEach(tag => {
        if (validTags.includes(tag)) {
          currentTags.push(tag);
          
          // Track source distribution
          const sourceUrl = feedback.scraped_shows_pending?.source_url;
          if (sourceUrl) {
            if (!sourceDistributions[tag]) {
              sourceDistributions[tag] = {};
            }
            sourceDistributions[tag][sourceUrl] = (sourceDistributions[tag][sourceUrl] || 0) + 1;
          }
        }
      });
    });
    
    // Extract tags from previous period
    const previousTags = [];
    
    prevFeedbackData.forEach(feedback => {
      const feedbackText = feedback.feedback || '';
      const dashIndex = Math.max(feedbackText.indexOf('-'), feedbackText.indexOf('–'));
      const tagSection = dashIndex > 0 ? feedbackText.substring(0, dashIndex) : feedbackText;
      const tags = tagSection.split(/[,\s]+/).map(tag => tag.trim().toUpperCase()).filter(tag => tag);
      
      tags.forEach(tag => {
        if (validTags.includes(tag)) {
          previousTags.push(tag);
        }
      });
    });
    
    // Count occurrences of each tag
    const tagCounts = {};
    currentTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    
    // Count occurrences in previous period
    const prevTagCounts = {};
    previousTags.forEach(tag => {
      prevTagCounts[tag] = (prevTagCounts[tag] || 0) + 1;
    });
    
    // Format results
    const results = Object.entries(tagCounts)
      .filter(([_, count]) => count >= min_count)
      .map(([tag, count]) => {
        const percentage = total_feedback > 0 ? (count * 100 / total_feedback).toFixed(1) : 0;
        const previousCount = prevTagCounts[tag] || 0;
        
        let trend = null;
        if (previousCount > 0 && total_previous > 0) {
          const currentRate = count / total_feedback;
          const previousRate = previousCount / total_previous;
          trend = ((currentRate - previousRate) * 100).toFixed(1);
        }
        
        return {
          tag,
          count,
          percentage: parseFloat(percentage),
          previous_count: previousCount,
          trend: trend !== null ? parseFloat(trend) : null,
          source_distribution: sourceDistributions[tag] || {}
        };
      })
      .sort((a, b) => b.count - a.count);
    
    return results;
  } catch (error) {
    console.error(`${colors.red}Error in getFeedbackStats: ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Implementation of get_source_stats function
 * 
 * Returns performance metrics for scraping sources
 */
async function getSourceStats(supabase, { days_ago = 30, min_shows = 5 }) {
  console.log(`${colors.dim}Executing getSourceStats(${days_ago}, ${min_shows})${colors.reset}`);
  
  try {
    // Get all pending shows for the period
    const { data: pendingData, error: pendingError } = await supabase
      .from('scraped_shows_pending')
      .select('id, source_url, status, created_at, raw_payload')
      .gte('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString());
    
    if (pendingError) throw new Error(pendingError.message);
    
    // Get all feedback for rejected shows
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('admin_feedback')
      .select('id, pending_id, feedback, action')
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString());
    
    if (feedbackError) throw new Error(feedbackError.message);
    
    // Get source configuration
    const { data: sourcesData, error: sourcesError } = await supabase
      .from('scraping_sources')
      .select('url, priority_score, enabled, last_success_at, last_error_at, error_streak');
    
    if (sourcesError) throw new Error(sourcesError.message);
    
    // Group shows by source
    const sourceGroups = {};
    
    pendingData.forEach(show => {
      if (!sourceGroups[show.source_url]) {
        sourceGroups[show.source_url] = {
          source_url: show.source_url,
          total_shows: 0,
          approved_count: 0,
          rejected_count: 0,
          pending_count: 0,
          quality_scores: [],
          feedback_tags: {}
        };
      }
      
      const group = sourceGroups[show.source_url];
      group.total_shows++;
      
      if (show.status === 'APPROVED') {
        group.approved_count++;
      } else if (show.status === 'REJECTED') {
        group.rejected_count++;
      } else if (show.status === 'PENDING') {
        group.pending_count++;
      }
      
      // Calculate quality score
      const payload = show.raw_payload || {};
      const qualityScore = 
        (payload.name ? 20 : 0) +
        (payload.startDate ? 20 : 0) +
        (payload.city ? 15 : 0) +
        (payload.state ? 15 : 0) +
        (payload.venueName ? 15 : 0) +
        (payload.address ? 15 : 0);
      
      group.quality_scores.push(qualityScore);
    });
    
    // Process feedback tags
    const validTags = [
      'DATE_FORMAT', 'VENUE_MISSING', 'ADDRESS_POOR', 'DUPLICATE',
      'MULTI_EVENT_COLLAPSE', 'EXTRA_HTML', 'SPAM', 'STATE_FULL',
      'CITY_MISSING'
    ];
    
    // Create a map of pending_id to source_url
    const pendingToSource = {};
    pendingData.forEach(show => {
      pendingToSource[show.id] = show.source_url;
    });
    
    // Count feedback tags by source
    feedbackData.forEach(feedback => {
      const sourceUrl = pendingToSource[feedback.pending_id];
      if (!sourceUrl || !sourceGroups[sourceUrl]) return;
      
      const feedbackText = feedback.feedback || '';
      const dashIndex = Math.max(feedbackText.indexOf('-'), feedbackText.indexOf('–'));
      const tagSection = dashIndex > 0 ? feedbackText.substring(0, dashIndex) : feedbackText;
      const tags = tagSection.split(/[,\s]+/).map(tag => tag.trim().toUpperCase()).filter(tag => tag);
      
      tags.forEach(tag => {
        if (validTags.includes(tag)) {
          if (!sourceGroups[sourceUrl].feedback_tags[tag]) {
            sourceGroups[sourceUrl].feedback_tags[tag] = 0;
          }
          sourceGroups[sourceUrl].feedback_tags[tag]++;
        }
      });
    });
    
    // Create a map of source configuration
    const sourceConfig = {};
    sourcesData.forEach(source => {
      sourceConfig[source.url] = source;
    });
    
    // Format results
    const results = Object.values(sourceGroups)
      .filter(group => group.total_shows >= min_shows)
      .map(group => {
        const totalProcessed = group.approved_count + group.rejected_count;
        const approvalRate = totalProcessed > 0 ? (group.approved_count * 100 / totalProcessed).toFixed(1) : 0;
        const rejectionRate = totalProcessed > 0 ? (group.rejected_count * 100 / totalProcessed).toFixed(1) : 0;
        const avgQualityScore = group.quality_scores.length > 0 
          ? (group.quality_scores.reduce((sum, score) => sum + score, 0) / group.quality_scores.length).toFixed(1)
          : 0;
        
        const source = sourceConfig[group.source_url] || {};
        
        return {
          source_url: group.source_url,
          total_shows: group.total_shows,
          approved_count: group.approved_count,
          rejected_count: group.rejected_count,
          pending_count: group.pending_count,
          approval_rate: parseFloat(approvalRate),
          rejection_rate: parseFloat(rejectionRate),
          avg_quality_score: parseFloat(avgQualityScore),
          common_issues: group.feedback_tags,
          priority_score: source.priority_score || 50,
          enabled: source.enabled || false,
          last_success_at: source.last_success_at,
          last_error_at: source.last_error_at,
          error_streak: source.error_streak || 0
        };
      })
      .sort((a, b) => b.total_shows - a.total_shows);
    
    return results;
  } catch (error) {
    console.error(`${colors.red}Error in getSourceStats: ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Implementation of find_duplicate_pending_shows function
 * 
 * Finds potential duplicate shows using fuzzy matching
 */
async function findDuplicatePendingShows(supabase, { similarity_threshold = 0.6, max_results = 100 }) {
  console.log(`${colors.dim}Executing findDuplicatePendingShows(${similarity_threshold}, ${max_results})${colors.reset}`);
  
  try {
    // Get all pending shows
    const { data: pendingData, error: pendingError } = await supabase
      .from('scraped_shows_pending')
      .select('id, source_url, status, created_at, raw_payload')
      .eq('status', 'PENDING');
    
    if (pendingError) throw new Error(pendingError.message);
    
    // Find potential duplicates
    const duplicates = [];
    
    // Simple similarity function for JavaScript
    const calculateSimilarity = (str1, str2) => {
      if (!str1 || !str2) return 0;
      str1 = str1.toLowerCase();
      str2 = str2.toLowerCase();
      
      // Exact match
      if (str1 === str2) return 1.0;
      
      // Simple Jaccard similarity for a basic fuzzy match
      const set1 = new Set(str1.split(/\s+/));
      const set2 = new Set(str2.split(/\s+/));
      
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      return intersection.size / union.size;
    };
    
    // Compare each pair of pending shows
    for (let i = 0; i < pendingData.length; i++) {
      const showA = pendingData[i];
      
      for (let j = i + 1; j < pendingData.length; j++) {
        const showB = pendingData[j];
        
        // Skip if not both pending
        if (showA.status !== 'PENDING' || showB.status !== 'PENDING') continue;
        
        const payloadA = showA.raw_payload || {};
        const payloadB = showB.raw_payload || {};
        
        // Check for potential duplicates
        let isDuplicate = false;
        let similarity = 0;
        
        // Exact match on name and date
        if (
          payloadA.name && payloadB.name && 
          payloadA.name.toLowerCase() === payloadB.name.toLowerCase() &&
          payloadA.startDate === payloadB.startDate
        ) {
          isDuplicate = true;
          similarity = 1.0;
        }
        
        // High name similarity and same date
        else if (
          payloadA.name && payloadB.name &&
          calculateSimilarity(payloadA.name, payloadB.name) > similarity_threshold &&
          payloadA.startDate === payloadB.startDate
        ) {
          isDuplicate = true;
          similarity = calculateSimilarity(payloadA.name, payloadB.name);
        }
        
        // Same name and close dates (if dates are in a parseable format)
        else if (
          payloadA.name && payloadB.name &&
          payloadA.name.toLowerCase() === payloadB.name.toLowerCase() &&
          payloadA.startDate && payloadB.startDate &&
          /^\d{4}-\d{2}-\d{2}/.test(payloadA.startDate) &&
          /^\d{4}-\d{2}-\d{2}/.test(payloadB.startDate)
        ) {
          const dateA = new Date(payloadA.startDate);
          const dateB = new Date(payloadB.startDate);
          const diffDays = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 1) {
            isDuplicate = true;
            similarity = 0.9;
          }
        }
        
        // High name similarity and same location
        else if (
          payloadA.name && payloadB.name &&
          calculateSimilarity(payloadA.name, payloadB.name) > similarity_threshold &&
          payloadA.city && payloadB.city &&
          payloadA.city.toLowerCase() === payloadB.city.toLowerCase() &&
          (!payloadA.state || !payloadB.state || 
           payloadA.state.toLowerCase() === payloadB.state.toLowerCase())
        ) {
          isDuplicate = true;
          similarity = calculateSimilarity(payloadA.name, payloadB.name);
        }
        
        if (isDuplicate) {
          duplicates.push({
            id1: showA.id,
            id2: showB.id,
            name1: payloadA.name,
            name2: payloadB.name,
            start_date1: payloadA.startDate,
            start_date2: payloadB.startDate,
            city1: payloadA.city,
            city2: payloadB.city,
            state1: payloadA.state,
            state2: payloadB.state,
            source_url1: showA.source_url,
            source_url2: showB.source_url,
            created_at1: showA.created_at,
            created_at2: showB.created_at,
            similarity
          });
        }
      }
    }
    
    // Sort by similarity and limit results
    return duplicates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, max_results);
    
  } catch (error) {
    console.error(`${colors.red}Error in findDuplicatePendingShows: ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Implementation of pending_quality_view
 * 
 * View that calculates quality scores for pending shows
 */
async function getPendingQualityView(supabase, { limit = 100, offset = 0, status = 'PENDING' }) {
  console.log(`${colors.dim}Executing getPendingQualityView(limit=${limit}, offset=${offset}, status=${status})${colors.reset}`);
  
  try {
    // Get pending shows
    const { data: pendingData, error: pendingError } = await supabase
      .from('scraped_shows_pending')
      .select('id, source_url, raw_payload, status, created_at, reviewed_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (pendingError) throw new Error(pendingError.message);
    
    // Calculate quality scores and format results
    const results = pendingData.map(show => {
      const payload = show.raw_payload || {};
      
      // Calculate quality score
      const qualityScore = 
        (payload.name ? 20 : 0) +
        (payload.startDate ? 20 : 0) +
        (payload.city ? 15 : 0) +
        (payload.state ? 15 : 0) +
        (payload.venueName ? 15 : 0) +
        (payload.address ? 15 : 0);
      
      // Determine quality band
      let qualityBand = 'Low';
      if (qualityScore >= 80) {
        qualityBand = 'High';
      } else if (qualityScore >= 50) {
        qualityBand = 'Medium';
      }
      
      // Identify potential issues
      const potentialIssues = [];
      
      if (!payload.name) potentialIssues.push('Missing name');
      if (!payload.startDate) potentialIssues.push('Missing date');
      if (payload.startDate && !payload.startDate.includes('202')) potentialIssues.push('Date missing year');
      if (payload.startDate && (payload.startDate.endsWith(' AL') || payload.startDate.endsWith(' TX'))) {
        potentialIssues.push('Date format issue');
      }
      if (!payload.city) potentialIssues.push('Missing city');
      if (!payload.state) potentialIssues.push('Missing state');
      if (payload.state && payload.state.length > 2) potentialIssues.push('State not abbreviated');
      if (!payload.venueName) potentialIssues.push('Missing venue');
      if (!payload.address) potentialIssues.push('Missing address');
      if (payload.description && (payload.description.includes('<') || payload.description.includes('&nbsp;'))) {
        potentialIssues.push('HTML artifacts');
      }
      
      return {
        id: show.id,
        source_url: show.source_url,
        name: payload.name,
        start_date: payload.startDate,
        city: payload.city,
        state: payload.state,
        venue_name: payload.venueName,
        address: payload.address,
        status: show.status,
        created_at: show.created_at,
        reviewed_at: show.reviewed_at,
        quality_score: qualityScore,
        quality_band: qualityBand,
        potential_issues: potentialIssues
      };
    });
    
    return results;
  } catch (error) {
    console.error(`${colors.red}Error in getPendingQualityView: ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Test get_feedback_stats function
 */
async function testGetFeedbackStats(supabase) {
  console.log(`\n${colors.bright}${colors.magenta}Testing getFeedbackStats(7, 1)...${colors.reset}`);
  
  try {
    const results = await getFeedbackStats(supabase, { days_ago: 7, min_count: 1 });
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (results && results.length > 0) {
      console.table(results.map(row => ({
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
  console.log(`\n${colors.bright}${colors.magenta}Testing getSourceStats(30, 5)...${colors.reset}`);
  
  try {
    const results = await getSourceStats(supabase, { days_ago: 30, min_shows: 5 });
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (results && results.length > 0) {
      console.table(results.map(row => ({
        source_url: truncate(row.source_url, 30),
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
  console.log(`\n${colors.bright}${colors.magenta}Testing findDuplicatePendingShows(0.6, 10)...${colors.reset}`);
  
  try {
    const results = await findDuplicatePendingShows(supabase, { similarity_threshold: 0.6, max_results: 10 });
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (results && results.length > 0) {
      console.table(results.map(row => ({
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
 * Test pending_quality_view
 */
async function testPendingQualityView(supabase) {
  console.log(`\n${colors.bright}${colors.magenta}Testing getPendingQualityView (top 5 rows)...${colors.reset}`);
  
  try {
    const results = await getPendingQualityView(supabase, { limit: 5 });
    
    console.log(`${colors.green}✓ Function executed successfully${colors.reset}`);
    console.log(`${colors.cyan}Results:${colors.reset}`);
    
    if (results && results.length > 0) {
      console.table(results.map(row => ({
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

// Run the implementation and tests
implementAdminFunctions();
