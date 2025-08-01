#!/usr/bin/env node
/**
 * scraper/test-ai-extraction.js
 * 
 * Test script for validating AI extraction with smaller chunks and shorter timeouts.
 * This script helps diagnose issues with the enhanced scraper by:
 * - Using smaller chunk sizes (10KB instead of 100KB)
 * - Using shorter timeouts (15s instead of 45s)
 * - Testing with sample HTML content
 * - Using the same AI prompt logic from the enhanced scraper
 * 
 * Usage:
 *   node scraper/test-ai-extraction.js
 */

// Load environment variables from .env
require('dotenv').config();

const fetch = require('node-fetch');

// Configuration - REDUCED VALUES FOR TESTING
const AI_TIMEOUT_MS = 15000;  // 15s timeout (reduced from 45s)
const MAX_HTML_SIZE = 10000;  // 10 KB per chunk (reduced from 100KB)

// Sample HTML content resembling Sports Collectors Digest calendar format
const SAMPLE_HTML = `
<html>
<body>
<h2>TEXAS</h2>
<p>January 15, 2025 - Dallas Card and Comic Show<br>
Location: Dallas Convention Center, 650 S Griffin St, Dallas, TX 75202<br>
Hours: 9am-5pm<br>
Admission: $5<br>
Contact: John Smith, 214-555-0123, jsmith@example.com</p>

<p>February 2-3, 2025 - Houston Sports Card Expo<br>
Location: George R Brown Convention Center, Houston, TX<br>
Contact: 713-555-0199</p>

<h2>CALIFORNIA</h2>
<p>January 20, 2025 - Los Angeles Card Show<br>
Location: LA Convention Center, Los Angeles, CA 90015<br>
Hours: 10am-4pm<br>
Contact: info@lashow.com</p>
</body>
</html>
`;

// Specialized prompt for Sports Collectors Digest (same as enhanced-scraper.js)
function buildEnhancedSCDPrompt(html) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `
You are a specialized card show event extractor with expertise in data normalization. The HTML is from Sports Collectors Digest's show calendar.

TODAY = ${today}

The calendar is organized by STATE headings in UPPERCASE (e.g., ALABAMA, ARIZONA).
Extract EVERY show listing beneath those headings.

Each event object MUST have these keys (use null if information is missing):
{
  "name": "Full event name/title",
  "startDate": "Start date in any format you find",
  "endDate": "End date if multi-day event, otherwise same as start date",
  "venueName": "Name of venue/location ONLY (not the full address)",
  "address": "Street address ONLY",
  "city": "City name ONLY",
  "state": "State abbreviation (2 letters) ONLY",
  "zipCode": "ZIP/Postal code if available",
  "entryFee": "Entry fee information",
  "description": "Event description if available",
  "url": "Direct link to event details if available, otherwise use source URL",
  "contactName": "Promoter/contact name if available",
  "contactPhone": "Contact phone number if available",
  "contactEmail": "Contact email if available",
  "showHours": "Hours of operation (e.g., '9am-3pm')"
}

CRITICAL EXTRACTION RULES:
1. DO NOT extract anything from comments, reviews, or testimonials
2. DO NOT extract events that happened BEFORE TODAY
3. Focus on sections labeled "upcoming", "future", "scheduled", "calendar"
4. Skip sections labeled "past events", "archive", "previous shows", "results"
5. CLEAN THE DATA as you extract:
   - For dates: Remove state codes that appear in dates (e.g., "Aug 2 AL" → "Aug 2")
   - For venues: Separate venue name from address
   - For contact: Separate name, phone, email
6. Use the state heading when populating "state"
7. If a date is a range like "Jan 5-6 2025" set startDate / endDate accordingly
8. One list/bullet/paragraph = one event
9. ONLY output the valid JSON array of events. No explanations or markdown

HTML CONTENT:
${html}
`;
}

// Logging function
function log(message, data = null) {
  console.log('\n' + '='.repeat(80));
  console.log(message);
  console.log('='.repeat(80));
  if (data) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

// Error logging function
function logError(message, error) {
  console.error('\n' + '!'.repeat(80));
  console.error(`ERROR: ${message}`);
  console.error(error?.message || error);
  console.error('!'.repeat(80));
}

// Process HTML with AI
async function processWithAI(html) {
  try {
    // Check for Google AI API key
    const geminiApiKey = process.env.GOOGLE_AI_KEY;
    if (!geminiApiKey) {
      logError('Missing Google AI API key', 'Set GOOGLE_AI_KEY in your .env file');
      return null;
    }

    const AI_MODEL = 'gemini-1.5-flash';
    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;

    // Chunk the HTML (for testing we'll just use one chunk)
    const htmlChunks = [];
    htmlChunks.push({ 
      chunk: html.substring(0, MAX_HTML_SIZE),
      note: 'Test sample' 
    });

    log(`Processing ${htmlChunks.length} chunks of HTML...`);
    const allShows = [];

    for (let i = 0; i < htmlChunks.length; i++) {
      const { chunk } = htmlChunks[i];
      const prompt = buildEnhancedSCDPrompt(chunk);
      
      log(`Chunk ${i+1} size: ${chunk.length} bytes`);
      log(`Prompt size: ${prompt.length} characters`);

      const aiController = new AbortController();
      const aiTimeoutId = setTimeout(() => {
        log(`Timeout reached (${AI_TIMEOUT_MS}ms) - aborting request`);
        aiController.abort();
      }, AI_TIMEOUT_MS);
      
      let aiRespOk = false;
      let rawText = '';
      
      const startTime = Date.now();
      log(`Sending request to AI at ${new Date().toISOString()}`);
      
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
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        clearTimeout(aiTimeoutId);
        
        log(`Response received in ${duration}ms with status: ${aiResp.status} ${aiResp.statusText}`);
        
        if (!aiResp.ok) {
          logError(`AI error on chunk ${i+1}: ${aiResp.status}`, await aiResp.text());
          continue;
        }
        
        const aiJson = await aiResp.json();
        rawText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        aiRespOk = rawText.length > 0;
        
        log(`Raw response length: ${rawText.length} characters`);
      } catch (err) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        logError(`AI timeout or error on chunk ${i+1} after ${duration}ms: ${err.message}`, err);
        continue;
      }
      
      if (!aiRespOk) {
        logError(`Empty or invalid response from AI`, null);
        continue;
      }

      // Strip markdown fences
      if (rawText.startsWith('```')) {
        log('Removing markdown code fences');
        rawText = rawText.replace(/```[a-z]*\n?|```/g, '');
      }

      // Braces fix
      if (!rawText.startsWith('[')) {
        log('Fixing JSON array format');
        const fb = rawText.indexOf('[');
        const lb = rawText.lastIndexOf(']');
        if (fb !== -1 && lb !== -1) {
          rawText = rawText.slice(fb, lb + 1);
        }
      }
      
      log('Parsing JSON response');
      let showsChunk = [];
      try {
        showsChunk = JSON.parse(rawText);
        if (Array.isArray(showsChunk)) {
          allShows.push(...showsChunk);
          log(`Successfully parsed ${showsChunk.length} shows from chunk ${i+1}`);
        } else {
          logError(`Expected array but got ${typeof showsChunk}`, showsChunk);
        }
      } catch (error) {
        logError(`Failed to parse AI response for chunk ${i+1}`, error);
        log('Raw response:', rawText);
      }
    }

    return allShows;
  } catch (e) {
    logError(`Processing failed: ${e.message}`, e);
    return null;
  }
}

// Main function
async function main() {
  const startTime = Date.now();
  
  log('AI EXTRACTION TEST SCRIPT', null);
  log(`Testing with ${SAMPLE_HTML.length} bytes of sample HTML`);
  
  const shows = await processWithAI(SAMPLE_HTML);
  
  if (shows && shows.length > 0) {
    log(`Successfully extracted ${shows.length} shows:`, shows);
  } else {
    logError('No shows extracted or processing failed', null);
  }
  
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`Test completed in ${elapsedSeconds}s`);
}

// Run the main function
main().catch(error => {
  logError('Unhandled error in main process', error);
  process.exit(1);
});
