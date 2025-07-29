#!/usr/bin/env node
/**
 * debug_scraper_detailed.js
 * 
 * Comprehensive diagnostic script for the card show scraper system.
 * This script tests each component of the scraper pipeline to identify
 * why shows aren't appearing in the pending table.
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY || '';
const AI_MODEL = 'gemini-1.5-flash';

// Test URLs - add known URLs here
const TEST_URLS = [
  'https://www.sportscollectorsdigest.com/events/card-shows/',
  // Add more test URLs as needed
];

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Utility functions
const log = (message, data = null) => {
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80));
  if (data) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  console.error(error?.message || error);
  console.error('!'.repeat(80));
};

// Main diagnostic functions
async function checkScrapingSources() {
  log('CHECKING SCRAPING SOURCES TABLE CONFIGURATION');
  
  try {
    const { data, error } = await supabase
      .from('scraping_sources')
      .select('*')
      .order('priority_score', { ascending: false });
      
    if (error) throw error;
    
    if (!data || data.length === 0) {
      log('WARNING: No scraping sources found in the database!');
      return [];
    }
    
    log(`Found ${data.length} scraping sources:`);
    data.forEach((source, i) => {
      console.log(`\n[${i+1}] ${source.url}`);
      console.log(`    Priority: ${source.priority_score}`);
      console.log(`    Enabled: ${source.enabled}`);
      console.log(`    Last Success: ${source.last_success_at || 'Never'}`);
      console.log(`    Last Error: ${source.last_error_at || 'Never'}`);
      console.log(`    Error Streak: ${source.error_streak}`);
    });
    
    return data.map(source => source.url);
  } catch (err) {
    logError('Failed to check scraping sources', err);
    return [];
  }
}

async function checkPendingShowsTable() {
  log('CHECKING PENDING SHOWS TABLE STATUS');
  
  try {
    // Check if table exists
    const { data: tableExists, error: tableError } = await supabase
      .rpc('check_table_exists', { table_name: 'scraped_shows_pending' });
      
    if (tableError) throw tableError;
    
    if (!tableExists) {
      log('ERROR: scraped_shows_pending table does not exist! Migrations may not be applied.');
      return;
    }
    
    // Count total shows
    const { data: countData, error: countError } = await supabase
      .from('scraped_shows_pending')
      .select('*', { count: 'exact', head: true });
      
    if (countError) throw countError;
    
    log(`Total shows in pending table: ${countData.count || 0}`);
    
    // Get most recent shows
    const { data: recentShows, error: recentError } = await supabase
      .from('scraped_shows_pending')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (recentError) throw recentError;
    
    if (recentShows && recentShows.length > 0) {
      log(`Most recent ${recentShows.length} shows:`);
      recentShows.forEach((show, i) => {
        console.log(`\n[${i+1}] ID: ${show.id}`);
        console.log(`    Source: ${show.source_url}`);
        console.log(`    Status: ${show.status}`);
        console.log(`    Created: ${show.created_at}`);
        console.log(`    Show Name: ${show.raw_payload?.name || 'N/A'}`);
      });
    } else {
      log('No shows found in the pending table.');
    }
    
    // Count by source URL
    const { data: sourceStats, error: statsError } = await supabase
      .rpc('count_shows_by_source');
      
    if (statsError) {
      log('Could not get source statistics:', statsError.message);
    } else if (sourceStats && sourceStats.length > 0) {
      log('Shows by source URL:');
      sourceStats.forEach(stat => {
        console.log(`${stat.source_url}: ${stat.total_count} shows (${stat.pending_count} pending)`);
      });
    }
  } catch (err) {
    logError('Failed to check pending shows table', err);
  }
}

async function testScraperFunction() {
  log('TESTING SCRAPER-AGENT EDGE FUNCTION');
  
  try {
    // Execute curl command to invoke the function
    const curlCommand = `curl -i -X POST "${SUPABASE_URL}/functions/v1/scraper-agent" \\
      -H "Authorization: Bearer ${SUPABASE_KEY}" \\
      -H "Content-Type: application/json"`;
    
    log('Executing curl command:');
    console.log(curlCommand);
    
    // Execute with timeout to avoid hanging
    console.log('\nResponse:');
    const response = execSync(curlCommand, { 
      timeout: 120000,  // 2 minute timeout
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log(response);
    
    // Parse and analyze the response
    try {
      const jsonStart = response.indexOf('{');
      if (jsonStart >= 0) {
        const jsonResponse = JSON.parse(response.substring(jsonStart));
        
        if (jsonResponse.results) {
          log('Scraper Results Summary:');
          let totalShowsFound = 0;
          let successfulScrapes = 0;
          
          jsonResponse.results.forEach(result => {
            console.log(`URL: ${result.url}`);
            console.log(`  Success: ${result.success}`);
            console.log(`  Shows Found: ${result.showCount}`);
            
            if (result.success) {
              successfulScrapes++;
              totalShowsFound += result.showCount;
            }
          });
          
          log(`Total: ${successfulScrapes}/${jsonResponse.results.length} successful scrapes, ${totalShowsFound} shows found`);
        }
      }
    } catch (parseErr) {
      log('Could not parse JSON response:', parseErr.message);
    }
  } catch (err) {
    logError('Failed to test scraper function', err);
    console.log('Error output:', err.stdout?.toString() || 'No output');
  }
}

async function testSingleUrl(url) {
  log(`TESTING SINGLE URL: ${url}`);
  
  try {
    // 1. Fetch the HTML content
    log('Fetching HTML content...');
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!pageResponse.ok) {
      throw new Error(`HTTP Error: ${pageResponse.status} ${pageResponse.statusText}`);
    }
    
    const html = await pageResponse.text();
    log(`HTML fetched successfully (${html.length} bytes)`);
    
    // Save HTML content for inspection
    const htmlFilePath = path.join(__dirname, 'debug_html_content.txt');
    fs.writeFileSync(htmlFilePath, html);
    log(`HTML content saved to ${htmlFilePath}`);
    
    // 2. Run AI extraction directly
    if (!GOOGLE_AI_KEY) {
      log('WARNING: Missing Google AI API key. Cannot test AI extraction.');
      return;
    }
    
    log('Running AI extraction...');
    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${GOOGLE_AI_KEY}`;
    
    // Build AI prompt
    const prompt = `
You are a specialized card show event extractor. Your task is to analyze the HTML content from ${url} and extract all trading card show events into a valid JSON array.

Each event object MUST have these keys (use null if information is missing):
{
  "name": "Full event name/title",
  "startDate": "Start date in any format you find (will be normalized later)",
  "endDate": "End date if multi-day event, otherwise same as start date",
  "venueName": "Name of venue/location",
  "address": "Full address if available",
  "city": "City name",
  "state": "State abbreviation (2 letters) or full name",
  "entryFee": "Entry fee as number or text",
  "description": "Event description if available",
  "url": "Direct link to event details if available, otherwise use source URL",
  "contactInfo": "Promoter/contact information if available"
}

IMPORTANT RULES:
1. Only extract ACTUAL CARD SHOW EVENTS. Ignore unrelated content.
2. For tables or lists of events, extract EACH event separately.
3. If dates appear as ranges like "January 5-6, 2025", create a single event with proper start/end dates.
4. If multiple shows occur at same venue on different dates, create separate entries for each date.
5. Normalize state names to standard 2-letter codes when possible.
6. Extract as much detail as possible, but it's better to return partial information than nothing.
7. ONLY output the valid JSON array of events. No explanations or markdown.

HTML CONTENT:
${html.substring(0, 100000)}  // Truncate if too large
`;

    const aiResponse = await fetch(aiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40
        }
      }),
    });
    
    if (!aiResponse.ok) {
      throw new Error(`AI API Error: ${aiResponse.status} ${aiResponse.statusText}`);
    }
    
    const aiResult = await aiResponse.json();
    
    // Save the full AI response for inspection
    const aiResponsePath = path.join(__dirname, 'debug_ai_response.json');
    fs.writeFileSync(aiResponsePath, JSON.stringify(aiResult, null, 2));
    log(`Full AI response saved to ${aiResponsePath}`);
    
    if (!aiResult.candidates || !aiResult.candidates[0]?.content?.parts?.[0]?.text) {
      log('AI returned no usable content');
      return;
    }
    
    // Extract and clean up the JSON
    let jsonText = aiResult.candidates[0].content.parts[0].text.trim();
    
    // Handle common JSON extraction issues
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n|\n```/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n|\n```/g, '');
    }
    
    // Save the extracted JSON text for inspection
    const jsonTextPath = path.join(__dirname, 'debug_extracted_json.txt');
    fs.writeFileSync(jsonTextPath, jsonText);
    log(`Extracted JSON text saved to ${jsonTextPath}`);
    
    // Ensure it's a valid JSON array
    if (!jsonText.startsWith('[') || !jsonText.endsWith(']')) {
      log('WARNING: AI didn\'t return a valid JSON array');
      
      // Try to fix common issues
      const firstBracket = jsonText.indexOf('[');
      const lastBracket = jsonText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        jsonText = jsonText.slice(firstBracket, lastBracket + 1);
        log('Applied JSON bracket trimming fix');
      } else {
        const jsonMatch = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
          log('Applied regex extraction fix');
        }
      }
    }
    
    // Parse the JSON
    let shows;
    try {
      shows = JSON.parse(jsonText);
    } catch (e) {
      logError('Failed to parse JSON', e);
      log('JSON parsing error. First 500 characters of text:');
      console.log(jsonText.substring(0, 500) + '...');
      return;
    }
    
    if (!Array.isArray(shows)) {
      log('Parsed result is not an array');
      return;
    }
    
    if (shows.length === 0) {
      log('No shows found in the AI response');
      return;
    }
    
    log(`Successfully extracted ${shows.length} shows from AI response`);
    
    // Display sample of extracted shows
    const sampleSize = Math.min(shows.length, 3);
    log(`Sample of ${sampleSize} extracted shows:`);
    for (let i = 0; i < sampleSize; i++) {
      console.log(`\n[${i+1}/${shows.length}]:`);
      console.log(JSON.stringify(shows[i], null, 2));
    }
    
    // 3. Manually insert a sample show to test database insertion
    log('Testing manual insertion to pending table...');
    if (shows.length > 0) {
      const sampleShow = shows[0];
      const rawPayload = {
        name: sampleShow.name || null,
        startDate: sampleShow.startDate || null,
        endDate: sampleShow.endDate || sampleShow.startDate || null,
        venueName: sampleShow.venueName || null,
        address: sampleShow.address || null,
        city: sampleShow.city || null,
        state: sampleShow.state || null,
        entryFee: sampleShow.entryFee || null,
        description: sampleShow.description || null,
        url: sampleShow.url || url,
        contactInfo: sampleShow.contactInfo || null,
        extractedAt: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('scraped_shows_pending')
        .insert({
          source_url: url,
          raw_payload: rawPayload,
          status: 'PENDING'
        })
        .select();
        
      if (error) {
        logError('Manual insertion failed', error);
      } else {
        log('Manual insertion successful!', data);
      }
    }
  } catch (err) {
    logError(`Failed to test URL: ${url}`, err);
  }
}

async function checkTableStructure() {
  log('CHECKING DATABASE TABLE STRUCTURE');
  
  try {
    // Check scraped_shows_pending table structure
    const { data: pendingColumns, error: pendingError } = await supabase
      .rpc('get_table_columns', { table_name: 'scraped_shows_pending' });
      
    if (pendingError) {
      log('Error checking scraped_shows_pending structure:', pendingError.message);
    } else {
      log('scraped_shows_pending columns:');
      console.log(pendingColumns);
    }
    
    // Check scraping_sources table structure
    const { data: sourcesColumns, error: sourcesError } = await supabase
      .rpc('get_table_columns', { table_name: 'scraping_sources' });
      
    if (sourcesError) {
      log('Error checking scraping_sources structure:', sourcesError.message);
    } else {
      log('scraping_sources columns:');
      console.log(sourcesColumns);
    }
  } catch (err) {
    logError('Failed to check table structure', err);
  }
}

// Main execution function
async function runDiagnostics() {
  log('STARTING COMPREHENSIVE SCRAPER DIAGNOSTICS', new Date().toISOString());
  
  // Check environment variables
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    logError('Missing Supabase credentials', 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    return;
  }
  
  if (!GOOGLE_AI_KEY) {
    log('WARNING: GOOGLE_AI_KEY is not set. AI extraction tests will be skipped.');
  }
  
  // Run diagnostics in sequence
  try {
    // 1. Check database tables
    await checkTableStructure();
    
    // 2. Check scraping sources configuration
    const sourceUrls = await checkScrapingSources();
    
    // 3. Check pending shows table status
    await checkPendingShowsTable();
    
    // 4. Test the scraper function
    await testScraperFunction();
    
    // 5. Test individual URLs
    const urlsToTest = TEST_URLS.length > 0 ? TEST_URLS : (sourceUrls.slice(0, 1));
    
    if (urlsToTest.length === 0) {
      log('No URLs available for testing');
    } else {
      for (const url of urlsToTest) {
        await testSingleUrl(url);
      }
    }
    
    // 6. Final check of pending shows table
    log('FINAL CHECK OF PENDING SHOWS TABLE');
    await checkPendingShowsTable();
    
  } catch (err) {
    logError('Diagnostics failed', err);
  }
  
  log('DIAGNOSTICS COMPLETE', new Date().toISOString());
}

// Execute the diagnostics
runDiagnostics().catch(err => {
  logError('Fatal error in diagnostics', err);
});
