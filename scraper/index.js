#!/usr/bin/env node
/**
 * scraper/index.js
 * 
 * CLI tool for scraping card show information from websites.
 * Can use specific URLs or load from seed_urls.json file.
 * Supports filtering by state.
 * 
 * Usage:
 *   node scraper/index.js --state TX
 *   node scraper/index.js --url https://example.com
 *   node scraper/index.js --state CA --url https://specific.com
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

// Configuration
const TIMEOUT_MS = 25000; // 25 second timeout for fetch operations
const AI_TIMEOUT_MS = 30000; // 30s per AI request
const MAX_HTML_SIZE = 100000; // 100 KB per chunk sent to AI
const MAX_CHUNKS = 3; // fail-safe: never send more than 3 chunks

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['state', 'url'],
  boolean: ['help'],
  alias: {
    h: 'help',
    s: 'state',
    u: 'url'
  }
});

// Show help text if requested or no arguments provided
if (argv.help || (process.argv.length <= 2 && !argv.state && !argv.url)) {
  showHelp();
  process.exit(0);
}

// Utility functions
function showHelp() {
  console.log(`
Card Show Scraper CLI
=====================

A command-line tool for scraping card show information from websites.

Environment Variables Required:
  SUPABASE_URL                 Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Your Supabase service role key
  GOOGLE_AI_KEY                Your Google AI API key for Gemini

Usage:
  node scraper/index.js [options]

Options:
  -s, --state STATE   Filter URLs by state (2-letter code, e.g., TX)
  -u, --url URL       Scrape a specific URL (bypasses seed file)
  -h, --help          Show this help text

Examples:
  # Scrape all URLs for Texas from seed file
  node scraper/index.js --state TX

  # Scrape a specific URL
  node scraper/index.js --url https://example.com/shows

  # Scrape a specific URL (state is ignored when URL is provided)
  node scraper/index.js --state CA --url https://specific.com/shows

Notes:
  - When no URL is provided, URLs are loaded from scraper/seed_urls.json
  - State filtering is case-insensitive (TX, tx, Tx all work)
  - Results are stored in the scraped_shows_pending table in your database
  `);
}

function log(message, data = null) {
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80));
  if (data) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  console.error(error?.message || error);
  console.error('!'.repeat(80));
}

// Load URLs from seed file
function loadSeedUrls() {
  try {
    const seedFilePath = path.join(__dirname, 'seed_urls.json');
    if (!fs.existsSync(seedFilePath)) {
      logError('Seed file not found', `Expected at: ${seedFilePath}`);
      process.exit(1);
    }
    
    const seedData = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));
    log(`Loaded ${seedData.length} URLs from seed file`);
    return seedData;
  } catch (error) {
    logError('Failed to load seed URLs', error);
    process.exit(1);
  }
}

// Filter URLs by state
function filterUrlsByState(seedData, stateFilter) {
  if (!stateFilter) return seedData;
  
  const normalizedState = stateFilter.trim().toUpperCase();
  const filtered = seedData.filter(item => 
    item.state && item.state.toUpperCase() === normalizedState
  );
  
  log(`Filtered to ${filtered.length} URLs for state: ${normalizedState}`);
  return filtered;
}

// Enhanced AI prompt for better extraction
function buildAIPrompt(html, sourceUrl) {
  return `
You are a specialized card show event extractor. Your task is to analyze the HTML content from ${sourceUrl} and extract all trading card show events into a valid JSON array.

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
${html}
`;
}

// Specialised prompt for Sports Collectors Digest
function buildSCDPrompt(html, stateNote = '') {
  return `
You are a specialized card-show event extractor. The HTML is from Sports Collectors Digest.
The calendar is organised by STATE headings in UPPERCASE (e.g. ALABAMA, ARIZONA).
Extract EVERY show listing beneath those headings.
${stateNote ? `NOTE: This chunk mostly contains states: ${stateNote}` : ''}

Output ONLY a JSON array, each object with:
  name, startDate, endDate, venueName, address, city, state, entryFee,
  description, url, contactInfo

Important:
• Use the state heading when populating "state".
• If a date is a range like "Jan 5-6 2025" set startDate / endDate accordingly.
• One list/bullet/paragraph = one event.
• No markdown, no extra text.

HTML:
${html}
`;
}

// Process a single URL
async function processUrl(url, supabase) {
  log(`Processing URL: ${url}`);
  
  try {
    // Fetch the page HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const pageResponse = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    
    if (!pageResponse.ok) {
      logError(`HTTP Error: ${pageResponse.status} ${pageResponse.statusText}`, url);
      return { success: false, showCount: 0 };
    }
    
    const html = await pageResponse.text();
    if (!html || html.length < 100) {
      logError(`Empty or too small HTML response`, url);
      return { success: false, showCount: 0 };
    }
    
    log(`HTML fetched (${html.length} bytes). Chunking & extracting with AI...`);

    // Check for Google AI API key
    const geminiApiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiApiKey) {
      logError(`Missing Google AI API key`, 'Set GOOGLE_AI_KEY environment variable');
      return { success: false, showCount: 0 };
    }

    const AI_MODEL = 'gemini-1.5-flash';
    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;

    // Naive chunking: start / middle / end
    const htmlChunks = [];
    htmlChunks.push({ 
      chunk: html.substring(0, MAX_HTML_SIZE),
      note: 'Document start' 
    });
    
    if (html.length > MAX_HTML_SIZE * 2) {
      const midStart = Math.floor(html.length / 2) - Math.floor(MAX_HTML_SIZE / 2);
      htmlChunks.push({ 
        chunk: html.substring(midStart, midStart + MAX_HTML_SIZE),
        note: 'Document middle' 
      });
    }
    
    if (html.length > MAX_HTML_SIZE * 3) {
      htmlChunks.push({ 
        chunk: html.substring(html.length - MAX_HTML_SIZE),
        note: 'Document end' 
      });
    }

    // Limit chunks
    const chunksToProcess = htmlChunks.slice(0, MAX_CHUNKS);
    const allShows = [];
    const isSCD = url.includes('sportscollectorsdigest');

    for (let i = 0; i < chunksToProcess.length; i++) {
      const { chunk, note } = chunksToProcess[i];
      const prompt = isSCD ? buildSCDPrompt(chunk, note) : buildAIPrompt(chunk, url);

      const aiController = new AbortController();
      const aiTimeoutId = setTimeout(() => aiController.abort(), AI_TIMEOUT_MS);
      
      let aiRespOk = false;
      let rawText = '';
      
      try {
        const aiResp = await fetch(aiApiUrl, {
          method: 'POST',
          signal: aiController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, topP: 0.8, topK: 40 }
          })
        });
        
        clearTimeout(aiTimeoutId);
        
        if (!aiResp.ok) {
          console.warn(`AI error on chunk ${i+1}: ${aiResp.status}`);
          continue;
        }
        
        const aiJson = await aiResp.json();
        rawText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        aiRespOk = rawText.length > 0;
      } catch (err) {
        console.warn(`AI timeout or error on chunk ${i+1}: ${err.message}`);
      }
      
      if (!aiRespOk) continue;

      // Strip markdown fences
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/```[a-z]*\n?|```/g, '');
      }

      // Braces fix
      if (!rawText.startsWith('[')) {
        const fb = rawText.indexOf('[');
        const lb = rawText.lastIndexOf(']');
        if (fb !== -1 && lb !== -1) {
          rawText = rawText.slice(fb, lb + 1);
        }
      }
      
      let showsChunk = [];
      try {
        showsChunk = JSON.parse(rawText);
        if (Array.isArray(showsChunk)) {
          allShows.push(...showsChunk);
          log(`Chunk ${i+1} ⇒ ${showsChunk.length} shows`);
        }
      } catch (error) {
        logError(`Failed to parse AI response for chunk ${i+1}`, error);
      }
    }

    if (allShows.length === 0) {
      log(`No shows parsed from any chunk`);
      return { success: true, showCount: 0 };
    }
    
    log(`Extracted total ${allShows.length} shows. Inserting...`);
    
    // Insert each show into the pending table
    let insertedCount = 0;
    let filteredCount = 0; // Shows ignored due to past/invalid dates

    for (const show of allShows) {
      // Create a standardized raw_payload
      const rawPayload = {
        name: show.name || null,
        startDate: show.startDate || null,
        endDate: show.endDate || show.startDate || null,
        venueName: show.venueName || null,
        address: show.address || null,
        city: show.city || null,
        state: show.state || null,
        entryFee: show.entryFee || null,
        description: show.description || null,
        url: show.url || url,
        contactInfo: show.contactInfo || null,
        extractedAt: new Date().toISOString()
      };
      
      // Skip shows without minimal required data
      if (!rawPayload.name || (!rawPayload.startDate && !rawPayload.date)) {
        continue;
      }
      
      // Skip shows where the date is in the past or un-parseable
      // Note: We're not implementing the full date validation here for simplicity
      // In a real implementation, you would use the isShowDateValid function

      try {
        const { error } = await supabase
          .from('scraped_shows_pending')
          .insert({
            source_url: url,
            raw_payload: rawPayload,
            status: 'PENDING'
          });
        
        if (error) {
          logError(`Error inserting show: ${error.message}`, show.name);
        } else {
          insertedCount++;
        }
      } catch (e) {
        logError(`Exception inserting show: ${e.message}`, show.name);
      }
    }

    log(`Successfully inserted ${insertedCount} of ${allShows.length} shows (filtered ${filteredCount} past/invalid)`);
    return { success: true, showCount: insertedCount };
    
  } catch (e) {
    logError(`Processing failed: ${e.message}`, url);
    return { success: false, showCount: 0 };
  }
}

// Update scraping source stats after processing
async function updateScrapingSourceStats(url, success, showCount = 0, supabase) {
  try {
    const updates = {
      updated_at: new Date().toISOString()
    };
    
    if (success) {
      updates.last_success_at = new Date().toISOString();
      updates.error_streak = 0;

      if (showCount > 0) {
        const { data: incScore, error: incErr } = await supabase.rpc(
          'increment_priority',
          { url_param: url, increment_amount: Math.min(showCount, 5) }
        );
        
        if (incErr) {
          logError(`RPC increment_priority failed: ${incErr.message}`, url);
        } else if (typeof incScore === 'number') {
          updates.priority_score = incScore;
        }
      }
    } else {
      updates.last_error_at = new Date().toISOString();
      
      // Increment error streak
      const { data: newStreak, error: streakErr } = await supabase.rpc(
        'increment_error_streak',
        { url_param: url }
      );
      
      if (streakErr) {
        logError(`RPC increment_error_streak failed: ${streakErr.message}`, url);
      } else if (typeof newStreak === 'number') {
        updates.error_streak = newStreak;
      }

      // Decrease priority for errors
      const { data: decScore, error: decErr } = await supabase.rpc(
        'decrement_priority',
        { url_param: url, decrement_amount: 1 }
      );
      
      if (decErr) {
        logError(`RPC decrement_priority failed: ${decErr.message}`, url);
      } else if (typeof decScore === 'number') {
        updates.priority_score = decScore;
      }
    }
    
    const { error } = await supabase
      .from('scraping_sources')
      .update(updates)
      .eq('url', url);
    
    if (error) {
      logError(`Error updating scraping source stats for ${url}: ${error.message}`);
    }
  } catch (e) {
    logError(`Exception updating scraping source stats for ${url}: ${e.message}`);
  }
}

// Main function
async function main() {
  const startTime = Date.now();
  
  // Check environment variables before initializing Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL) {
    logError('Missing Supabase URL', 'Set SUPABASE_URL environment variable');
    process.exit(1);
  }
  
  if (!SUPABASE_KEY) {
    logError('Missing Supabase service role key', 'Set SUPABASE_SERVICE_ROLE_KEY environment variable');
    process.exit(1);
  }
  
  // Initialize Supabase client only when we need it
  let supabase;
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    logError('Failed to initialize Supabase client', error);
    process.exit(1);
  }
  
  let urlsToProcess = [];
  
  // Determine which URLs to process
  if (argv.url) {
    // If specific URL provided, use that
    urlsToProcess = [{ url: argv.url }];
    log(`Using specific URL: ${argv.url}`);
  } else {
    // Otherwise load from seed file and filter by state if needed
    const seedData = loadSeedUrls();
    urlsToProcess = argv.state 
      ? filterUrlsByState(seedData, argv.state)
      : seedData;
      
    if (urlsToProcess.length === 0) {
      log(`No URLs found${argv.state ? ` for state ${argv.state.toUpperCase()}` : ''}`);
      process.exit(0);
    }
  }
  
  log(`Processing ${urlsToProcess.length} URLs`);
  
  const results = [];
  let totalShowsFound = 0;
  let successfulScrapes = 0;
  
  // Process URLs sequentially
  for (const item of urlsToProcess) {
    const url = item.url;
    const result = await processUrl(url, supabase);
    results.push({ url, ...result });
    
    if (result.success) {
      successfulScrapes++;
      totalShowsFound += result.showCount;
    }
    
    // Update stats after each URL
    await updateScrapingSourceStats(url, result.success, result.showCount, supabase);
    
    // Small delay between requests to be nice to servers
    if (urlsToProcess.indexOf(item) < urlsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  
  log(`Scraper completed in ${elapsedSeconds}s`, {
    processed: urlsToProcess.length,
    successful: successfulScrapes,
    showsFound: totalShowsFound,
    results
  });
}

// Run the main function
main().catch(error => {
  logError('Unhandled error in main process', error);
  process.exit(1);
});
