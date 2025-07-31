#!/usr/bin/env node
/**
 * Card Show Finder - Simple Admin CLI
 * 
 * A simplified command-line interface for reviewing and providing feedback on scraped shows.
 * This tool directly uses the JavaScript implementations of the admin functions
 * without relying on Edge Functions.
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Table } = require('console-table-printer');
const dateFormat = require('dateformat');
const { createObjectCsvWriter } = require('csv-writer');
const open = require('open');
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
    console.error(chalk.red('Error: Supabase URL or key not found in environment variables.'));
    console.warn('Please ensure your .env file contains:');
    console.warn('  EXPO_PUBLIC_SUPABASE_URL=your_supabase_url');
    console.warn('  SUPABASE_SERVICE_KEY=your_service_key');
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
    return dateFormat(date, 'mmm d, yyyy');
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
  console.warn(chalk.dim(`Executing getFeedbackStats(${days_ago}, ${min_count})`));
  
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
    console.error(chalk.red(`Error in getFeedbackStats: ${error.message}`));
    throw error;
  }
}

/**
 * Implementation of get_source_stats function
 * 
 * Returns performance metrics for scraping sources
 */
async function getSourceStats(supabase, { days_ago = 30, min_shows = 5 }) {
  console.warn(chalk.dim(`Executing getSourceStats(${days_ago}, ${min_shows})`));
  
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
    console.error(chalk.red(`Error in getSourceStats: ${error.message}`));
    throw error;
  }
}

/**
 * Implementation of find_duplicate_pending_shows function
 * 
 * Finds potential duplicate shows using fuzzy matching
 */
async function findDuplicatePendingShows(supabase, { similarity_threshold = 0.6, max_results = 100 }) {
  console.warn(chalk.dim(`Executing findDuplicatePendingShows(${similarity_threshold}, ${max_results})`));
  
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
    console.error(chalk.red(`Error in findDuplicatePendingShows: ${error.message}`));
    throw error;
  }
}

/**
 * Implementation of pending_quality_view
 * 
 * View that calculates quality scores for pending shows
 */
async function getPendingQualityView(supabase, { limit = 100, offset = 0, status = 'PENDING' }) {
  console.warn(chalk.dim(`Executing getPendingQualityView(limit=${limit}, offset=${offset}, status=${status})`));
  
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
    console.error(chalk.red(`Error in getPendingQualityView: ${error.message}`));
    throw error;
  }
}

/**
 * Approve a pending show
 */
async function approveShow(supabase, id, feedback = '') {
  try {
    // Update the show status
    const { error: updateError } = await supabase
      .from('scraped_shows_pending')
      .update({
        status: 'APPROVED',
        admin_notes: feedback || 'Approved via CLI',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) throw new Error(updateError.message);
    
    // Get admin ID (use a placeholder if not available)
    const { data: userData } = await supabase.auth.getUser();
    const adminId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
    
    // Add feedback record
    const { error: feedbackError } = await supabase
      .from('admin_feedback')
      .insert({
        pending_id: id,
        admin_id: adminId,
        action: 'approve',
        feedback: feedback || 'Approved via CLI'
      });
    
    if (feedbackError) throw new Error(feedbackError.message);
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Error approving show: ${error.message}`));
    throw error;
  }
}

/**
 * Reject a pending show
 */
async function rejectShow(supabase, id, feedback) {
  if (!feedback) {
    throw new Error('Feedback is required for rejections');
  }
  
  try {
    // Update the show status
    const { error: updateError } = await supabase
      .from('scraped_shows_pending')
      .update({
        status: 'REJECTED',
        admin_notes: feedback,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) throw new Error(updateError.message);
    
    // Get admin ID (use a placeholder if not available)
    const { data: userData } = await supabase.auth.getUser();
    const adminId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
    
    // Add feedback record
    const { error: feedbackError } = await supabase
      .from('admin_feedback')
      .insert({
        pending_id: id,
        admin_id: adminId,
        action: 'reject',
        feedback: feedback
      });
    
    if (feedbackError) throw new Error(feedbackError.message);
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Error rejecting show: ${error.message}`));
    throw error;
  }
}

/**
 * Display a pending show's details
 */
function displayShow(show) {
  console.warn('\n' + chalk.bold.underline(`Show Details: ${show.name || 'Unnamed Show'}`));
  
  // Basic info
  console.warn(chalk.bold('Basic Info:'));
  console.warn(`  ${chalk.dim('ID:')} ${show.id}`);
  console.warn(`  ${chalk.dim('Source:')} ${show.source_url}`);
  console.warn(`  ${chalk.dim('Created:')} ${formatDate(show.created_at)}`);
  console.warn(`  ${chalk.dim('Quality Score:')} ${show.quality_score}/100 (${show.quality_band})`);
  
  // Show data
  console.warn(chalk.bold('\nShow Data:'));
  console.warn(`  ${chalk.dim('Name:')} ${show.name || 'N/A'}`);
  console.warn(`  ${chalk.dim('Date:')} ${show.start_date || 'N/A'}`);
  console.warn(`  ${chalk.dim('Venue:')} ${show.venue_name || 'N/A'}`);
  console.warn(`  ${chalk.dim('Address:')} ${show.address || 'N/A'}`);
  console.warn(`  ${chalk.dim('Location:')} ${[show.city, show.state].filter(Boolean).join(', ') || 'N/A'}`);
  
  // Potential issues
  if (show.potential_issues && show.potential_issues.length > 0) {
    console.warn(chalk.bold('\nPotential Issues:'));
    show.potential_issues.forEach(issue => {
      console.warn(`  - ${issue}`);
    });
  }
  
  console.warn(); // Empty line at the end
}

/**
 * View pending shows with quality scores
 */
async function viewPendingShows() {
  const supabase = createSupabaseClient();
  
  try {
    // Ask for filter options
    const { limit, status } = await inquirer.prompt([
      {
        type: 'list',
        name: 'status',
        message: 'Show status:',
        choices: [
          { name: 'Pending', value: 'PENDING' },
          { name: 'Approved', value: 'APPROVED' },
          { name: 'Rejected', value: 'REJECTED' }
        ],
        default: 'PENDING'
      },
      {
        type: 'number',
        name: 'limit',
        message: 'Number of shows to display:',
        default: 10,
        validate: value => value > 0 ? true : 'Please enter a positive number'
      }
    ]);
    
    console.warn(chalk.cyan(`\nLoading ${status.toLowerCase()} shows...`));
    
    // Get shows with quality scores
    const shows = await getPendingQualityView(supabase, { limit, status });
    
    if (!shows || shows.length === 0) {
      console.warn(chalk.yellow(`No ${status.toLowerCase()} shows found.`));
      return;
    }
    
    console.warn(chalk.green(`Found ${shows.length} ${status.toLowerCase()} shows.`));
    
    // Display shows in a table
    const table = new Table({
      columns: [
        { name: 'index', title: '#', alignment: 'right' },
        { name: 'name', title: 'Name', alignment: 'left' },
        { name: 'date', title: 'Date', alignment: 'left' },
        { name: 'location', title: 'Location', alignment: 'left' },
        { name: 'score', title: 'Score', alignment: 'right' },
        { name: 'source', title: 'Source', alignment: 'left' }
      ]
    });
    
    shows.forEach((show, index) => {
      const scoreColor = show.quality_score >= 80 ? 'green' : (show.quality_score >= 50 ? 'yellow' : 'red');
      
      table.addRow({
        index: index + 1,
        name: truncate(show.name || 'Unnamed', 25),
        date: truncate(show.start_date || 'N/A', 12),
        location: truncate([show.city, show.state].filter(Boolean).join(', '), 20),
        score: { text: show.quality_score, color: scoreColor },
        source: truncate(new URL(show.source_url).hostname.replace('www.', ''), 20)
      });
    });
    
    table.printTable();
    
    // Show actions menu
    if (status === 'PENDING') {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'View show details', value: 'view' },
            { name: 'Approve a show', value: 'approve' },
            { name: 'Reject a show', value: 'reject' },
            { name: 'Batch approve high quality shows', value: 'batch_approve' },
            { name: 'Back to main menu', value: 'back' }
          ]
        }
      ]);
      
      if (action === 'back') {
        return;
      }
      
      if (action === 'view') {
        const { showIndex } = await inquirer.prompt([
          {
            type: 'number',
            name: 'showIndex',
            message: 'Enter the row number to view (1-' + shows.length + '):',
            validate: input => {
              const num = parseInt(input);
              return num >= 1 && num <= shows.length ? true : 'Please enter a valid row number';
            },
            filter: input => parseInt(input)
          }
        ]);
        
        const selectedShow = shows[showIndex - 1];
        displayShow(selectedShow);
        
        // Show actions for this show
        const { showAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'showAction',
            message: 'What would you like to do with this show?',
            choices: [
              { name: 'Approve', value: 'approve' },
              { name: 'Reject', value: 'reject' },
              { name: 'Back', value: 'back' }
            ]
          }
        ]);
        
        if (showAction === 'approve') {
          const { feedback } = await inquirer.prompt([
            {
              type: 'input',
              name: 'feedback',
              message: 'Add any feedback (optional):',
            }
          ]);
          
          console.warn(chalk.cyan('Approving show...'));
          await approveShow(supabase, selectedShow.id, feedback);
          console.warn(chalk.green('Show approved successfully!'));
        } else if (showAction === 'reject') {
          // Select feedback tags
          const { selectedTags } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedTags',
              message: 'Select feedback tags:',
              choices: FEEDBACK_TAGS.map(tag => ({ name: tag, value: tag }))
            }
          ]);
          
          // Additional feedback
          const { additionalFeedback } = await inquirer.prompt([
            {
              type: 'input',
              name: 'additionalFeedback',
              message: 'Add additional feedback (optional):',
            }
          ]);
          
          // Combine tags and feedback
          const feedback = selectedTags.length > 0 
            ? `${selectedTags.join(', ')}${additionalFeedback ? ' - ' + additionalFeedback : ''}`
            : additionalFeedback;
          
          if (!feedback) {
            console.warn(chalk.yellow('Rejection requires feedback. Operation cancelled.'));
            return;
          }
          
          console.warn(chalk.cyan('Rejecting show...'));
          await rejectShow(supabase, selectedShow.id, feedback);
          console.error(chalk.green('Show rejected successfully!'));
        }
      } else if (action === 'approve') {
        const { showIndex } = await inquirer.prompt([
          {
            type: 'number',
            name: 'showIndex',
            message: 'Enter the row number to approve (1-' + shows.length + '):',
            validate: input => {
              const num = parseInt(input);
              return num >= 1 && num <= shows.length ? true : 'Please enter a valid row number';
            },
            filter: input => parseInt(input)
          }
        ]);
        
        const selectedShow = shows[showIndex - 1];
        
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'Add any feedback (optional):',
          }
        ]);
        
        console.warn(chalk.cyan('Approving show...'));
        await approveShow(supabase, selectedShow.id, feedback);
        console.warn(chalk.green('Show approved successfully!'));
      } else if (action === 'reject') {
        const { showIndex } = await inquirer.prompt([
          {
            type: 'number',
            name: 'showIndex',
            message: 'Enter the row number to reject (1-' + shows.length + '):',
            validate: input => {
              const num = parseInt(input);
              return num >= 1 && num <= shows.length ? true : 'Please enter a valid row number';
            },
            filter: input => parseInt(input)
          }
        ]);
        
        const selectedShow = shows[showIndex - 1];
        
        // Select feedback tags
        const { selectedTags } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedTags',
            message: 'Select feedback tags:',
            choices: FEEDBACK_TAGS.map(tag => ({ name: tag, value: tag }))
          }
        ]);
        
        // Additional feedback
        const { additionalFeedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'additionalFeedback',
            message: 'Add additional feedback (optional):',
          }
        ]);
        
        // Combine tags and feedback
        const feedback = selectedTags.length > 0 
          ? `${selectedTags.join(', ')}${additionalFeedback ? ' - ' + additionalFeedback : ''}`
          : additionalFeedback;
        
        if (!feedback) {
          console.warn(chalk.yellow('Rejection requires feedback. Operation cancelled.'));
          return;
        }
        
        console.warn(chalk.cyan('Rejecting show...'));
        await rejectShow(supabase, selectedShow.id, feedback);
        console.error(chalk.green('Show rejected successfully!'));
      } else if (action === 'batch_approve') {
        // Filter high quality shows
        const highQualityShows = shows.filter(show => show.quality_score >= 80);
        
        if (highQualityShows.length === 0) {
          console.warn(chalk.yellow('No high quality shows found for batch approval.'));
          return;
        }
        
        console.warn(chalk.cyan(`Found ${highQualityShows.length} high quality shows that can be batch approved.`));
        
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to approve all ${highQualityShows.length} high quality shows?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          console.warn(chalk.yellow('Batch approval cancelled.'));
          return;
        }
        
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'Add any feedback for all approved shows (optional):',
            default: 'Batch approved - High quality'
          }
        ]);
        
        console.warn(chalk.cyan('Batch approving shows...'));
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const show of highQualityShows) {
          try {
            await approveShow(supabase, show.id, feedback);
            successCount++;
            process.stdout.write('.');
          } catch (error) {
            errorCount++;
            process.stdout.write('x');
          }
        }
        
        console.warn('\n');
        console.warn(chalk.green(`Successfully approved ${successCount} shows.`));
        
        if (errorCount > 0) {
          console.error(chalk.yellow(`Failed to approve ${errorCount} shows.`));
        }
      }
    } else {
      // For APPROVED or REJECTED shows, just view details
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'View show details', value: 'view' },
            { name: 'Back to main menu', value: 'back' }
          ]
        }
      ]);
      
      if (action === 'back') {
        return;
      }
      
      if (action === 'view') {
        const { showIndex } = await inquirer.prompt([
          {
            type: 'number',
            name: 'showIndex',
            message: 'Enter the row number to view (1-' + shows.length + '):',
            validate: input => {
              const num = parseInt(input);
              return num >= 1 && num <= shows.length ? true : 'Please enter a valid row number';
            },
            filter: input => parseInt(input)
          }
        ]);
        
        const selectedShow = shows[showIndex - 1];
        displayShow(selectedShow);
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * View feedback statistics
 */
async function viewFeedbackStats() {
  const supabase = createSupabaseClient();
  
  try {
    // Ask for time period
    const { days } = await inquirer.prompt([
      {
        type: 'number',
        name: 'days',
        message: 'Number of days to analyze:',
        default: 30,
        validate: value => value > 0 ? true : 'Please enter a positive number'
      }
    ]);
    
    console.warn(chalk.cyan(`\nAnalyzing feedback for the last ${days} days...`));
    
    const stats = await getFeedbackStats(supabase, { days_ago: days, min_count: 1 });
    
    if (!stats || stats.length === 0) {
      console.warn(chalk.yellow('No feedback data found for this period.'));
      return;
    }
    
    console.warn(chalk.green(`Found feedback data with ${stats.length} tags.`));
    
    // Display feedback stats
    const table = new Table({
      title: `Feedback Statistics (Last ${days} days)`,
      columns: [
        { name: 'tag', title: 'Tag', alignment: 'left' },
        { name: 'count', title: 'Count', alignment: 'right' },
        { name: 'percentage', title: 'Percentage', alignment: 'right' },
        { name: 'trend', title: 'Trend', alignment: 'right' },
        { name: 'topSources', title: 'Top Sources', alignment: 'left' }
      ]
    });
    
    stats.forEach(item => {
      // Get top 3 sources for this tag
      const sources = Object.entries(item.source_distribution || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([url, count]) => {
          try {
            return `${new URL(url).hostname.replace('www.', '')} (${count})`;
          } catch (e) {
            return `${url} (${count})`;
          }
        })
        .join(', ');
      
      // Determine trend color
      let trendText = 'N/A';
      let trendColor = null;
      
      if (item.trend !== null) {
        const trendValue = item.trend;
        trendText = `${trendValue > 0 ? '+' : ''}${trendValue}%`;
        trendColor = trendValue > 5 ? 'red' : (trendValue < -5 ? 'green' : null);
      }
      
      table.addRow({
        tag: item.tag,
        count: item.count,
        percentage: `${item.percentage}%`,
        trend: trendColor ? { text: trendText, color: trendColor } : trendText,
        topSources: truncate(sources, 40)
      });
    });
    
    table.printTable();
    
    // Recommendations
    console.warn(chalk.bold.underline('\nRecommendations:'));
    
    if (stats.length > 0) {
      const topIssue = stats[0];
      console.warn(`1. Focus on fixing "${topIssue.tag}" issues (${topIssue.percentage}% of feedback).`);
      
      // Check for specific issues
      const dateFormatIssue = stats.find(f => f.tag === 'DATE_FORMAT');
      if (dateFormatIssue && dateFormatIssue.percentage > 20) {
        console.warn(`2. Improve date parsing in the scraper (${dateFormatIssue.percentage}% of shows have date format issues).`);
      }
      
      const multiEventIssue = stats.find(f => f.tag === 'MULTI_EVENT_COLLAPSE');
      if (multiEventIssue && multiEventIssue.percentage > 10) {
        console.warn(`3. Reduce chunk size for HTML processing (${multiEventIssue.percentage}% of shows have multiple events collapsed).`);
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * View source performance statistics
 */
async function viewSourceStats() {
  const supabase = createSupabaseClient();
  
  try {
    // Ask for time period and minimum shows
    const { days, minShows } = await inquirer.prompt([
      {
        type: 'number',
        name: 'days',
        message: 'Number of days to analyze:',
        default: 30,
        validate: value => value > 0 ? true : 'Please enter a positive number'
      },
      {
        type: 'number',
        name: 'minShows',
        message: 'Minimum number of shows per source:',
        default: 5,
        validate: value => value > 0 ? true : 'Please enter a positive number'
      }
    ]);
    
    console.warn(chalk.cyan(`\nAnalyzing source performance for the last ${days} days...`));
    
    const stats = await getSourceStats(supabase, { days_ago: days, min_shows: minShows });
    
    if (!stats || stats.length === 0) {
      console.warn(chalk.yellow('No source data found for this period.'));
      return;
    }
    
    console.warn(chalk.green(`Found performance data for ${stats.length} sources.`));
    
    // Display source stats
    const table = new Table({
      title: `Source Statistics (Last ${days} days)`,
      columns: [
        { name: 'source', title: 'Source', alignment: 'left' },
        { name: 'total', title: 'Total', alignment: 'right' },
        { name: 'approved', title: 'Approved', alignment: 'right' },
        { name: 'rejected', title: 'Rejected', alignment: 'right' },
        { name: 'pending', title: 'Pending', alignment: 'right' },
        { name: 'approvalRate', title: 'Approval %', alignment: 'right' },
        { name: 'quality', title: 'Quality', alignment: 'right' },
        { name: 'priority', title: 'Priority', alignment: 'right' }
      ]
    });
    
    stats.forEach(item => {
      const approvalColor = item.approval_rate >= 80 ? 'green' : (item.approval_rate >= 50 ? 'yellow' : 'red');
      const qualityColor = item.avg_quality_score >= 80 ? 'green' : (item.avg_quality_score >= 50 ? 'yellow' : 'red');
      
      try {
        const hostname = new URL(item.source_url).hostname.replace('www.', '');
        
        table.addRow({
          source: truncate(hostname, 20),
          total: item.total_shows,
          approved: item.approved_count,
          rejected: item.rejected_count,
          pending: item.pending_count,
          approvalRate: { text: `${item.approval_rate}%`, color: approvalColor },
          quality: { text: item.avg_quality_score, color: qualityColor },
          priority: item.priority_score
        });
      } catch (e) {
        // Handle invalid URLs
        table.addRow({
          source: truncate(item.source_url, 20),
          total: item.total_shows,
          approved: item.approved_count,
          rejected: item.rejected_count,
          pending: item.pending_count,
          approvalRate: { text: `${item.approval_rate}%`, color: approvalColor },
          quality: { text: item.avg_quality_score, color: qualityColor },
          priority: item.priority_score
        });
      }
    });
    
    table.printTable();
    
    // Show detailed view for a source
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View source details', value: 'view' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);
    
    if (action === 'back') {
      return;
    }
    
    if (action === 'view') {
      const choices = stats.map((item, index) => {
        let name;
        try {
          name = new URL(item.source_url).hostname.replace('www.', '');
        } catch (e) {
          name = item.source_url;
        }
        return {
          name: `${name} (${item.total_shows} shows, ${item.approval_rate}% approval)`,
          value: index
        };
      });
      
      const { sourceIndex } = await inquirer.prompt([
        {
          type: 'list',
          name: 'sourceIndex',
          message: 'Select a source to view details:',
          choices
        }
      ]);
      
      const selectedSource = stats[sourceIndex];
      
      console.warn('\n' + chalk.bold.underline(`Source Details: ${new URL(selectedSource.source_url).hostname.replace('www.', '')}`));
      console.warn(chalk.bold('Performance:'));
      console.warn(`  ${chalk.dim('URL:')} ${selectedSource.source_url}`);
      console.warn(`  ${chalk.dim('Total Shows:')} ${selectedSource.total_shows}`);
      console.warn(`  ${chalk.dim('Approved:')} ${selectedSource.approved_count} (${selectedSource.approval_rate}%)`);
      console.error(`  ${chalk.dim('Rejected:')} ${selectedSource.rejected_count} (${selectedSource.rejection_rate}%)`);
      console.warn(`  ${chalk.dim('Pending:')} ${selectedSource.pending_count}`);
      console.warn(`  ${chalk.dim('Quality Score:')} ${selectedSource.avg_quality_score}/100`);
      console.warn(`  ${chalk.dim('Priority Score:')} ${selectedSource.priority_score}/100`);
      
      // Configuration
      console.warn(chalk.bold('\nConfiguration:'));
      console.warn(`  ${chalk.dim('Enabled:')} ${selectedSource.enabled ? 'Yes' : 'No'}`);
      console.warn(`  ${chalk.dim('Last Success:')} ${formatDate(selectedSource.last_success_at)}`);
      console.error(`  ${chalk.dim('Last Error:')} ${formatDate(selectedSource.last_error_at)}`);
      console.error(`  ${chalk.dim('Error Streak:')} ${selectedSource.error_streak}`);
      
      // Common issues
      if (Object.keys(selectedSource.common_issues || {}).length > 0) {
        console.warn(chalk.bold('\nCommon Issues:'));
        Object.entries(selectedSource.common_issues)
          .sort((a, b) => b[1] - a[1])
          .forEach(([tag, count]) => {
            console.warn(`  ${chalk.dim(tag + ':')} ${count} occurrences`);
          });
      }
      
      // Recommendations
      console.warn(chalk.bold('\nRecommendations:'));
      
      if (selectedSource.rejection_rate >= 80) {
        console.warn(chalk.red(`  • Consider disabling this source (${selectedSource.rejection_rate}% rejection rate)`));
      } else if (selectedSource.rejection_rate >= 50) {
        console.warn(chalk.yellow(`  • Review scraper configuration (${selectedSource.rejection_rate}% rejection rate)`));
      } else if (selectedSource.approval_rate >= 80) {
        console.warn(chalk.green(`  • Increase priority score (${selectedSource.approval_rate}% approval rate)`));
      }
      
      if (selectedSource.avg_quality_score < 50) {
        console.warn(chalk.yellow(`  • Improve data extraction (low quality score: ${selectedSource.avg_quality_score})`));
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Find potential duplicates
 */
async function findDuplicates() {
  const supabase = createSupabaseClient();
  
  try {
    // Ask for similarity threshold
    const { threshold, maxResults } = await inquirer.prompt([
      {
        type: 'number',
        name: 'threshold',
        message: 'Similarity threshold (0.0-1.0):',
        default: 0.6,
        validate: value => (value >= 0 && value <= 1) ? true : 'Please enter a value between 0 and 1'
      },
      {
        type: 'number',
        name: 'maxResults',
        message: 'Maximum number of duplicates to find:',
        default: 10,
        validate: value => value > 0 ? true : 'Please enter a positive number'
      }
    ]);
    
    console.warn(chalk.cyan(`\nFinding potential duplicates with similarity >= ${threshold}...`));
    
    const duplicates = await findDuplicatePendingShows(supabase, { 
      similarity_threshold: threshold, 
      max_results: maxResults 
    });
    
    if (!duplicates || duplicates.length === 0) {
      console.warn(chalk.yellow('No potential duplicates found.'));
      return;
    }
    
    console.warn(chalk.green(`Found ${duplicates.length} potential duplicate pairs.`));
    
    // Display duplicates in a table
    const table = new Table({
      title: 'Potential Duplicates',
      columns: [
        { name: 'index', title: '#', alignment: 'right' },
        { name: 'name1', title: 'Name 1', alignment: 'left' },
        { name: 'name2', title: 'Name 2', alignment: 'left' },
        { name: 'date1', title: 'Date 1', alignment: 'left' },
        { name: 'date2', title: 'Date 2', alignment: 'left' },
        { name: 'location', title: 'Location', alignment: 'left' },
        { name: 'similarity', title: 'Similarity', alignment: 'right' }
      ]
    });
    
    duplicates.forEach((dup, index) => {
      const similarityColor = dup.similarity >= 0.9 ? 'red' : (dup.similarity >= 0.7 ? 'yellow' : null);
      
      table.addRow({
        index: index + 1,
        name1: truncate(dup.name1 || 'Unnamed', 20),
        name2: truncate(dup.name2 || 'Unnamed', 20),
        date1: truncate(dup.start_date1 || 'N/A', 10),
        date2: truncate(dup.start_date2 || 'N/A', 10),
        location: truncate([dup.city1, dup.state1].filter(Boolean).join(', '), 15),
        similarity: { 
          text: `${Math.round(dup.similarity * 100)}%`, 
          color: similarityColor 
        }
      });
    });
    
    table.printTable();
    
    // View and resolve duplicates
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View and resolve duplicates', value: 'resolve' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);
    
    if (action === 'back') {
      return;
    }
    
    if (action === 'resolve') {
      // Process each duplicate pair
      for (let i = 0; i < duplicates.length; i++) {
        const dup = duplicates[i];
        
        console.warn(chalk.bold(`\nDuplicate Pair #${i + 1} (${Math.round(dup.similarity * 100)}% similar):`));
        
        console.warn(chalk.dim('Show 1:'));
        console.warn(`  ID: ${dup.id1}`);
        console.warn(`  Name: ${dup.name1}`);
        console.warn(`  Date: ${dup.start_date1}`);
        console.warn(`  Location: ${[dup.city1, dup.state1].filter(Boolean).join(', ')}`);
        console.warn(`  Source: ${dup.source_url1}`);
        
        console.warn(chalk.dim('\nShow 2:'));
        console.warn(`  ID: ${dup.id2}`);
        console.warn(`  Name: ${dup.name2}`);
        console.warn(`  Date: ${dup.start_date2}`);
        console.warn(`  Location: ${[dup.city2, dup.state2].filter(Boolean).join(', ')}`);
        console.warn(`  Source: ${dup.source_url2}`);
        
        const { resolveAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'resolveAction',
            message: 'How would you like to resolve this duplicate?',
            choices: [
              { name: 'Keep both (not duplicates)', value: 'keep' },
              { name: 'Keep Show 1, reject Show 2', value: 'keep1' },
              { name: 'Keep Show 2, reject Show 1', value: 'keep2' },
              { name: 'Reject both', value: 'reject' },
              { name: 'Skip', value: 'skip' }
            ]
          }
        ]);
        
        if (resolveAction === 'skip') {
          continue;
        }
        
        if (resolveAction === 'keep') {
          console.warn(chalk.green('Keeping both shows.'));
          continue;
        }
        
        // Get feedback for rejections
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'Enter feedback for rejection:',
            default: 'DUPLICATE - Duplicate show',
            validate: value => value ? true : 'Feedback is required for rejections'
          }
        ]);
        
        try {
          if (resolveAction === 'keep1') {
            console.warn(chalk.cyan('Approving Show 1 and rejecting Show 2...'));
            await approveShow(supabase, dup.id1, 'Kept over duplicate');
            await rejectShow(supabase, dup.id2, feedback);
            console.warn(chalk.green('Shows processed successfully!'));
          } else if (resolveAction === 'keep2') {
            console.warn(chalk.cyan('Approving Show 2 and rejecting Show 1...'));
            await approveShow(supabase, dup.id2, 'Kept over duplicate');
            await rejectShow(supabase, dup.id1, feedback);
            console.warn(chalk.green('Shows processed successfully!'));
          } else if (resolveAction === 'reject') {
            console.warn(chalk.cyan('Rejecting both shows...'));
            await rejectShow(supabase, dup.id1, feedback);
            await rejectShow(supabase, dup.id2, feedback);
            console.error(chalk.green('Shows rejected successfully!'));
          }
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
        }
      }
      
      console.warn(chalk.green('\nFinished processing duplicates.'));
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Export data to CSV or JSON
 */
async function exportData() {
  const supabase = createSupabaseClient();
  
  try {
    // Ask what to export
    const { exportType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'exportType',
        message: 'What would you like to export?',
        choices: [
          { name: 'Pending shows', value: 'pending' },
          { name: 'Feedback statistics', value: 'feedback' },
          { name: 'Source statistics', value: 'sources' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);
    
    if (exportType === 'back') {
      return;
    }
    
    // Ask for export format
    const { format } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Export format:',
        choices: [
          { name: 'CSV', value: 'csv' },
          { name: 'JSON', value: 'json' }
        ]
      }
    ]);
    
    // Ask for time period if needed
    let days = 30;
    if (exportType === 'feedback' || exportType === 'sources') {
      const response = await inquirer.prompt([
        {
          type: 'number',
          name: 'days',
          message: 'Number of days to include:',
          default: 30,
          validate: value => value > 0 ? true : 'Please enter a positive number'
        }
      ]);
      days = response.days;
    }
    
    // Ask for filename
    const defaultFilename = `${exportType}_export_${dateFormat(new Date(), 'yyyymmdd')}`;
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: 'Enter filename (without extension):',
        default: defaultFilename
      }
    ]);
    
    console.warn(chalk.cyan(`\nExporting ${exportType} data...`));
    
    let data;
    let headers;
    
    // Get the data based on export type
    if (exportType === 'pending') {
      data = await getPendingQualityView(supabase, { limit: 1000 });
      
      if (format === 'csv') {
        headers = [
          { id: 'id', title: 'ID' },
          { id: 'source_url', title: 'Source URL' },
          { id: 'name', title: 'Name' },
          { id: 'start_date', title: 'Start Date' },
          { id: 'city', title: 'City' },
          { id: 'state', title: 'State' },
          { id: 'venue_name', title: 'Venue Name' },
          { id: 'address', title: 'Address' },
          { id: 'status', title: 'Status' },
          { id: 'created_at', title: 'Created At' },
          { id: 'quality_score', title: 'Quality Score' },
          { id: 'quality_band', title: 'Quality Band' }
        ];
      }
    } else if (exportType === 'feedback') {
      data = await getFeedbackStats(supabase, { days_ago: days, min_count: 1 });
      
      if (format === 'csv') {
        // Flatten source_distribution for CSV
        data = data.map(item => ({
          tag: item.tag,
          count: item.count,
          percentage: item.percentage,
          previous_count: item.previous_count,
          trend: item.trend,
          // Extract top sources
          top_source_1: Object.keys(item.source_distribution)[0] || '',
          top_source_1_count: Object.values(item.source_distribution)[0] || 0,
          top_source_2: Object.keys(item.source_distribution)[1] || '',
          top_source_2_count: Object.values(item.source_distribution)[1] || 0,
          top_source_3: Object.keys(item.source_distribution)[2] || '',
          top_source_3_count: Object.values(item.source_distribution)[2] || 0
        }));
        
        headers = [
          { id: 'tag', title: 'Tag' },
          { id: 'count', title: 'Count' },
          { id: 'percentage', title: 'Percentage' },
          { id: 'previous_count', title: 'Previous Count' },
          { id: 'trend', title: 'Trend' },
          { id: 'top_source_1', title: 'Top Source 1' },
          { id: 'top_source_1_count', title: 'Count 1' },
          { id: 'top_source_2', title: 'Top Source 2' },
          { id: 'top_source_2_count', title: 'Count 2' },
          { id: 'top_source_3', title: 'Top Source 3' },
          { id: 'top_source_3_count', title: 'Count 3' }
        ];
      }
    } else if (exportType === 'sources') {
      data = await getSourceStats(supabase, { days_ago: days, min_shows: 1 });
      
      if (format === 'csv') {
        // Flatten common_issues for CSV
        data = data.map(source => ({
          source_url: source.source_url,
          total_shows: source.total_shows,
          approved_count: source.approved_count,
          rejected_count: source.rejected_count,
          pending_count: source.pending_count,
          approval_rate: source.approval_rate,
          rejection_rate: source.rejection_rate,
          avg_quality_score: source.avg_quality_score,
          priority_score: source.priority_score,
          enabled: source.enabled ? 'Yes' : 'No',
          // Extract top issues
          top_issue_1: Object.keys(source.common_issues)[0] || '',
          top_issue_1_count: Object.values(source.common_issues)[0] || 0,
          top_issue_2: Object.keys(source.common_issues)[1] || '',
          top_issue_2_count: Object.values(source.common_issues)[1] || 0
        }));
        
        headers = [
          { id: 'source_url', title: 'Source URL' },
          { id: 'total_shows', title: 'Total Shows' },
          { id: 'approved_count', title: 'Approved' },
          { id: 'rejected_count', title: 'Rejected' },
          { id: 'pending_count', title: 'Pending' },
          { id: 'approval_rate', title: 'Approval Rate' },
          { id: 'rejection_rate', title: 'Rejection Rate' },
          { id: 'avg_quality_score', title: 'Avg Quality Score' },
          { id: 'priority_score', title: 'Priority Score' },
          { id: 'enabled', title: 'Enabled' },
          { id: 'top_issue_1', title: 'Top Issue 1' },
          { id: 'top_issue_1_count', title: 'Count 1' },
          { id: 'top_issue_2', title: 'Top Issue 2' },
          { id: 'top_issue_2_count', title: 'Count 2' }
        ];
      }
    }
    
    if (!data || data.length === 0) {
      console.warn(chalk.yellow('No data found to export.'));
      return;
    }
    
    const outputPath = path.join(process.cwd(), `${filename}.${format}`);
    
    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      const csvWriter = createObjectCsvWriter({
        path: outputPath,
        header: headers
      });
      
      await csvWriter.writeRecords(data);
    }
    
    console.warn(chalk.green(`Data exported to: ${outputPath}`));
    
    // Ask if user wants to open the file
    const { openFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openFile',
        message: 'Open the exported file?',
        default: false
      }
    ]);
    
    if (openFile) {
      await open(outputPath);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Main menu
 */
async function mainMenu() {
  console.warn(chalk.bold.green('\nCard Show Finder - Admin CLI'));
  console.warn(chalk.dim('A simplified tool for managing the admin evaluation system'));
  
  const { option } = await inquirer.prompt([
    {
      type: 'list',
      name: 'option',
      message: 'What would you like to do?',
      choices: [
        { name: 'View pending shows with quality scores', value: 'pending' },
        { name: 'View feedback statistics', value: 'feedback' },
        { name: 'View source performance statistics', value: 'sources' },
        { name: 'Find potential duplicates', value: 'duplicates' },
        { name: 'Export data', value: 'export' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
  
  if (option === 'exit') {
    console.warn(chalk.green('Goodbye!'));
    process.exit(0);
  }
  
  if (option === 'pending') {
    await viewPendingShows();
  } else if (option === 'feedback') {
    await viewFeedbackStats();
  } else if (option === 'sources') {
    await viewSourceStats();
  } else if (option === 'duplicates') {
    await findDuplicates();
  } else if (option === 'export') {
    await exportData();
  }
  
  // Return to main menu
  await mainMenu();
}

// Start the CLI
console.warn(chalk.bold.blue('======================================================'));
console.warn(chalk.bold.blue('  CARD SHOW FINDER - ADMIN CLI'));
console.warn(chalk.bold.blue('======================================================'));

// Verify environment variables
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(chalk.red('Error: Supabase URL or key not found in environment variables.'));
  console.warn('Please ensure your .env file contains:');
  console.warn('  EXPO_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.warn('  SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

// Start the main menu
mainMenu().catch(error => {
  console.error(chalk.red(`Fatal error: ${error.message}`));
  process.exit(1);
});
