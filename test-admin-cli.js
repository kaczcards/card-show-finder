#!/usr/bin/env node
/**
 * Card Show Finder - Admin CLI Test Script
 * 
 * This script tests the admin CLI functions without requiring interactive input.
 * It runs the core functions and displays the results in an easy-to-read format.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Constants
const FEEDBACK_TAGS = [
  'DATE_FORMAT',
  'VENUE_MISSING',
  'ADDRESS_POOR',
  'DUPLICATE',
  'MULTI_EVENT_COLLAPSE',
  'EXTRA_HTML',
  'SPAM',
  'STATE_FULL',
  'CITY_MISSING'
];

/**
 * Supabase configuration
 * -------------------------------------------------
 * • In Expo/React Native projects the public URL / anon key are
 *   exposed with the EXPO_PUBLIC_* prefix.
 * • In many server scripts we still reference SUPABASE_URL /
 *   SUPABASE_ANON_KEY.  Resolve whichever is present so the CLI
 *   works in both environments.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Create Supabase client
function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Supabase URL or key not found in environment variables.');
    console.log('Please ensure your .env file contains:');
    console.log('  EXPO_PUBLIC_SUPABASE_URL=your_supabase_url');
    console.log('  SUPABASE_SERVICE_KEY=your_service_key');
    process.exit(1);
  }
  
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// Truncate string
function truncate(str, length = 30) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

/**
 * Implementation of get_feedback_stats function
 * 
 * Returns statistics about feedback tags with counts and trends
 */
async function getFeedbackStats(supabase, { days_ago = 30, min_count = 1 }) {
  console.log(`Executing getFeedbackStats(${days_ago}, ${min_count})`);
  
  try {
    // Get total feedback counts for percentage calculation
    const { data: totalData, error: totalError } = await supabase
      .from('admin_feedback')
      .select('pending_id', { count: 'exact', head: true })
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString())
      .not('feedback', 'is', null);
    
    if (totalError) throw new Error(totalError.message);
    const total_feedback = totalData?.count || 0;
    
    // Get previous period total for trend calculation
    const { data: prevTotalData, error: prevTotalError } = await supabase
      .from('admin_feedback')
      .select('pending_id', { count: 'exact', head: true })
      .eq('action', 'reject')
      .gte('created_at', new Date(Date.now() - 2 * days_ago * 24 * 60 * 60 * 1000).toISOString())
      .lt('created_at', new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString())
      .not('feedback', 'is', null);
    
    if (prevTotalError) throw new Error(prevTotalError.message);
    const total_previous = prevTotalData?.count || 0;
    
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
    const validTags = FEEDBACK_TAGS;
    
    // Extract tags from current period
    const currentTags = [];
    const sourceDistributions = {};
    
    feedbackData?.forEach(feedback => {
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
    
    prevFeedbackData?.forEach(feedback => {
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
    console.error(`Error in getFeedbackStats: ${error.message}`);
    throw error;
  }
}

/**
 * Implementation of get_source_stats function
 * 
 * Returns performance metrics for scraping sources
 */
async function getSourceStats(supabase, { days_ago = 30, min_shows = 5 }) {
  console.log(`Executing getSourceStats(${days_ago}, ${min_shows})`);
  
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
    
    pendingData?.forEach(show => {
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
    const validTags = FEEDBACK_TAGS;
    
    // Create a map of pending_id to source_url
    const pendingToSource = {};
    pendingData?.forEach(show => {
      pendingToSource[show.id] = show.source_url;
    });
    
    // Count feedback tags by source
    feedbackData?.forEach(feedback => {
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
    sourcesData?.forEach(source => {
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
    console.error(`Error in getSourceStats: ${error.message}`);
    throw error;
  }
}

/**
 * Implementation of find_duplicate_pending_shows function
 * 
 * Finds potential duplicate shows using fuzzy matching
 */
async function findDuplicatePendingShows(supabase, { similarity_threshold = 0.6, max_results = 100 }) {
  console.log(`Executing findDuplicatePendingShows(${similarity_threshold}, ${max_results})`);
  
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
    for (let i = 0; i < pendingData?.length; i++) {
      const showA = pendingData[i];
      
      for (let j = i + 1; j < pendingData?.length; j++) {
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
    console.error(`Error in findDuplicatePendingShows: ${error.message}`);
    throw error;
  }
}

/**
 * Implementation of pending_quality_view
 * 
 * View that calculates quality scores for pending shows
 */
async function getPendingQualityView(supabase, { limit = 100, offset = 0, status = 'PENDING' }) {
  console.log(`Executing getPendingQualityView(limit=${limit}, offset=${offset}, status=${status})`);
  
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
    const results = pendingData?.map(show => {
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
    
    return results || [];
  } catch (error) {
    console.error(`Error in getPendingQualityView: ${error.message}`);
    throw error;
  }
}

/**
 * Display results in a formatted way
 */
function displayResults(title, results) {
  console.log('\n==================================================');
  console.log(`  ${title}`);
  console.log('==================================================');
  
  if (!results || results.length === 0) {
    console.log('No results found.');
    return;
  }
  
  console.log(`Found ${results.length} results.`);
  
  // Display results based on type
  if (title.includes('Feedback Stats')) {
    console.log('\nFeedback Tags:');
    console.log('----------------------------------------------------');
    console.log('Tag                 | Count | Percentage | Trend');
    console.log('----------------------------------------------------');
    
    results.forEach(item => {
      const trendStr = item.trend !== null ? `${item.trend > 0 ? '+' : ''}${item.trend}%` : 'N/A';
      console.log(`${item.tag.padEnd(20)} | ${String(item.count).padEnd(5)} | ${item.percentage}%`.padEnd(36) + ` | ${trendStr}`);
    });
  } 
  else if (title.includes('Source Stats')) {
    console.log('\nSource Performance:');
    console.log('----------------------------------------------------');
    console.log('Source               | Total | Approved | Rejected | Quality');
    console.log('----------------------------------------------------');
    
    results.forEach(item => {
      let source;
      try {
        source = new URL(item.source_url).hostname.replace('www.', '');
      } catch (e) {
        source = item.source_url;
      }
      console.log(`${truncate(source, 20).padEnd(20)} | ${String(item.total_shows).padEnd(5)} | ${String(item.approved_count).padEnd(8)} | ${String(item.rejected_count).padEnd(8)} | ${item.avg_quality_score}`);
    });
  } 
  else if (title.includes('Duplicates')) {
    console.log('\nPotential Duplicates:');
    console.log('----------------------------------------------------');
    console.log('Show 1                | Show 2                | Similarity');
    console.log('----------------------------------------------------');
    
    results.forEach(item => {
      console.log(`${truncate(item.name1 || 'Unnamed', 20).padEnd(20)} | ${truncate(item.name2 || 'Unnamed', 20).padEnd(20)} | ${Math.round(item.similarity * 100)}%`);
    });
  } 
  else if (title.includes('Pending Shows')) {
    console.log('\nPending Shows:');
    console.log('----------------------------------------------------');
    console.log('Name                 | Date       | Location           | Score | Quality');
    console.log('----------------------------------------------------');
    
    results.forEach(item => {
      console.log(`${truncate(item.name || 'Unnamed', 20).padEnd(20)} | ${truncate(item.start_date || 'N/A', 10).padEnd(10)} | ${truncate([item.city, item.state].filter(Boolean).join(', '), 18).padEnd(18)} | ${String(item.quality_score).padEnd(5)} | ${item.quality_band}`);
    });
  }
  
  console.log('\n');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('======================================================');
  console.log('  CARD SHOW FINDER - ADMIN CLI TEST SCRIPT');
  console.log('======================================================\n');
  
  try {
    const supabase = createSupabaseClient();
    console.log('Connected to Supabase successfully.\n');
    
    // Test getFeedbackStats
    try {
      const feedbackStats = await getFeedbackStats(supabase, { days_ago: 30, min_count: 1 });
      displayResults('Feedback Stats (Last 30 days)', feedbackStats);
    } catch (error) {
      console.error(`Error testing getFeedbackStats: ${error.message}`);
    }
    
    // Test getSourceStats
    try {
      const sourceStats = await getSourceStats(supabase, { days_ago: 30, min_shows: 1 });
      displayResults('Source Stats (Last 30 days)', sourceStats);
    } catch (error) {
      console.error(`Error testing getSourceStats: ${error.message}`);
    }
    
    // Test findDuplicatePendingShows
    try {
      const duplicates = await findDuplicatePendingShows(supabase, { similarity_threshold: 0.6, max_results: 10 });
      displayResults('Potential Duplicates (Similarity >= 60%)', duplicates);
    } catch (error) {
      console.error(`Error testing findDuplicatePendingShows: ${error.message}`);
    }
    
    // Test getPendingQualityView
    try {
      const pendingShows = await getPendingQualityView(supabase, { limit: 10, status: 'PENDING' });
      displayResults('Pending Shows (Top 10)', pendingShows);
    } catch (error) {
      console.error(`Error testing getPendingQualityView: ${error.message}`);
    }
    
    console.log('All tests completed.');
    
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run all tests
runTests();
