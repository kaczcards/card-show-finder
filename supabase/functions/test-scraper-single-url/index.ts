import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Configuration
const AI_MODEL = 'gemini-1.5-flash'
const DEFAULT_URL = 'https://www.sportscollectorsdigest.com/events/card-shows/'
const FETCH_TIMEOUT_MS = 15000 // 15 second timeout for fetch operations
const AI_TIMEOUT_MS = 30000 // Increased from 20000 to 30000 for processing larger chunks
const MAX_HTML_SIZE = 100000 // Reduced from 200000 to 100000 to keep prompts manageable
const MAX_CHUNKS = 3 // Maximum number of chunks to process for very large pages

// Create a Supabase client with the service role key for admin access
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Enhanced AI prompt for better extraction
function buildAIPrompt(html: string, sourceUrl: string): string {
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

// Special prompt for Sports Collectors Digest which has state-organized listings
function buildSCDPrompt(html: string, stateContext: string = ''): string {
  const contextNote = stateContext ? 
    `NOTE: This HTML chunk contains listings for these states: ${stateContext}. Focus on extracting shows from these states.` : 
    '';
    
  return `
You are a specialized card show event extractor. Your task is to analyze the HTML content from Sports Collectors Digest and extract all trading card show events into a valid JSON array.

IMPORTANT CONTEXT: The page organizes shows by STATE in uppercase headings (like "ALABAMA", "ARIZONA", etc.). Under each state heading are multiple show listings, each representing a separate card show event. ${contextNote}

Each event object MUST have these keys (use null if information is missing):
{
  "name": "Trading Card Show", // Use this as default if no specific show name
  "startDate": "Start date in any format you find",
  "endDate": "End date if multi-day event, otherwise same as start date",
  "venueName": "Name of venue/location",
  "address": "Full address if available",
  "city": "City name",
  "state": "State abbreviation (2 letters)", // Use the state from the section heading
  "entryFee": "Entry fee as number or text",
  "description": "Event description if available",
  "url": "Direct link to event details if available",
  "contactInfo": "Promoter/contact information if available"
}

EXTRACTION PATTERN:
1. Look for state names in ALL CAPS (e.g., "ALABAMA", "ARIZONA").
2. For each state section, extract every show listing underneath it until the next state heading.
3. Each bullet point, paragraph, or listing under a state typically represents one show.
4. Show listings often follow patterns like: "January 5-6, 2025 - Venue Name (City, State)"
5. Extract as many details as possible from each listing.

IMPORTANT RULES:
1. Create a separate event object for EACH show, even if they're in the same state section.
2. Use the state heading to correctly assign the state value for all shows in that section.
3. For each show listing, extract the date, venue, city, and any other details provided.
4. If dates appear as ranges like "January 5-6, 2025", create a single event with proper start/end dates.
5. If you see contact information like phone numbers or emails, include them in contactInfo.
6. If a listing mentions admission fees, include them in entryFee.
7. ONLY output the valid JSON array of events. No explanations or markdown.

HTML CONTENT:
${html}
`;
}

// Process a single URL with detailed diagnostics
async function processUrlWithDiagnostics(supabase: any, url: string): Promise<any> {
  const diagnostics: any = {
    url: url,
    steps: [],
    success: false,
    html: {
      fetched: false,
      size: 0,
      sample: ''
    },
    ai: {
      called: false,
      rawResponse: null,
      extractedJson: null,
      parsedShows: null
    },
    database: {
      insertAttempted: false,
      insertSuccess: false,
      insertedCount: 0,
      errors: []
    }
  };
  
  // Step 1: Fetch HTML
  try {
    diagnostics.steps.push({ step: 'Fetching HTML', startTime: new Date().toISOString() });
    console.log(`[${url}] - Fetching HTML...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    
    const pageResponse = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!pageResponse.ok) {
      const error = `HTTP Error: ${pageResponse.status} ${pageResponse.statusText}`;
      diagnostics.steps.push({ step: 'HTML Fetch Error', error });
      console.error(`[${url}] - ${error}`);
      return diagnostics;
    }
    
    const html = await pageResponse.text();
    diagnostics.html.fetched = true;
    diagnostics.html.size = html.length;
    diagnostics.html.sample = html.substring(0, 500) + '...';
    
    diagnostics.steps.push({ 
      step: 'HTML Fetched', 
      endTime: new Date().toISOString(),
      size: html.length
    });
    
    console.log(`[${url}] - HTML fetched successfully (${html.length} bytes)`);
    
    // Step 2: Extract data using AI
    diagnostics.steps.push({ step: 'Preparing AI Request', startTime: new Date().toISOString() });
    
    const geminiApiKey = Deno.env.get('GOOGLE_AI_KEY');
    if (!geminiApiKey) {
      const error = 'Missing Google AI API key';
      diagnostics.steps.push({ step: 'AI Preparation Error', error });
      console.error(`[${url}] - ${error}`);
      return diagnostics;
    }
    
    // Check if this is Sports Collectors Digest
    const isSportsCollectorsDigest = url.includes('sportscollectorsdigest');
    
    // Analyze the HTML to find potential show listings sections
    let htmlChunks = [];
    const stateChunks = new Map(); // Map to store state sections by state name
    
    if (isSportsCollectorsDigest) {
      console.log(`[${url}] - Detected Sports Collectors Digest, using specialized processing`);
      
      // Look for state headings which indicate show listings
      const stateHeadingPattern = /([A-Z]{4,})\s*<\/(?:h\d|strong|b|p)>/g;
      let stateHeadingMatches = [...html.matchAll(stateHeadingPattern)];
      
      if (stateHeadingMatches.length > 0) {
        console.log(`[${url}] - Found ${stateHeadingMatches.length} potential state headings`);
        
        // Process each state section as a separate chunk
        for (let i = 0; i < stateHeadingMatches.length; i++) {
          const stateName = stateHeadingMatches[i][1];
          const startPos = stateHeadingMatches[i].index || 0;
          const endPos = (i < stateHeadingMatches.length - 1) 
            ? (stateHeadingMatches[i+1].index || html.length) 
            : html.length;
          
          const sectionSize = endPos - startPos;
          
          // Look for a section with multiple lines (likely show listings)
          const sectionText = html.substring(startPos, endPos);
          const lineCount = (sectionText.match(/<br\s*\/?>/g) || []).length;
          
          console.log(`[${url}] - State section "${stateName}" has ${lineCount} lines, size ${sectionSize}`);
          
          if (lineCount > 3) { // This state section likely has show listings
            // Include some context before the heading
            const contextStart = Math.max(0, startPos - 200);
            const contextSize = Math.min(MAX_HTML_SIZE, sectionSize + 200);
            const stateChunk = html.substring(contextStart, contextStart + contextSize);
            
            stateChunks.set(stateName, stateChunk);
            console.log(`[${url}] - Added state chunk for "${stateName}" (${stateChunk.length} bytes)`);
          }
        }
        
        // Group state chunks into manageable sizes for AI processing
        if (stateChunks.size > 0) {
          let currentChunk = '';
          let currentStates = [];
          
          for (const [state, chunk] of stateChunks.entries()) {
            if (currentChunk.length + chunk.length > MAX_HTML_SIZE) {
              // Current chunk would be too large, save it and start a new one
              if (currentChunk.length > 0) {
                htmlChunks.push({
                  html: currentChunk,
                  states: currentStates.join(', ')
                });
                console.log(`[${url}] - Created chunk with states: ${currentStates.join(', ')} (${currentChunk.length} bytes)`);
                currentChunk = '';
                currentStates = [];
              }
            }
            
            // Add this state to the current chunk
            if (currentChunk.length === 0) {
              currentChunk = chunk;
            } else {
              currentChunk += '\n\n' + chunk;
            }
            currentStates.push(state);
            
            // If we've reached the maximum chunk size, save it
            if (currentChunk.length >= MAX_HTML_SIZE * 0.8) {
              htmlChunks.push({
                html: currentChunk,
                states: currentStates.join(', ')
              });
              console.log(`[${url}] - Created chunk with states: ${currentStates.join(', ')} (${currentChunk.length} bytes)`);
              currentChunk = '';
              currentStates = [];
            }
          }
          
          // Add any remaining content as the final chunk
          if (currentChunk.length > 0) {
            htmlChunks.push({
              html: currentChunk,
              states: currentStates.join(', ')
            });
            console.log(`[${url}] - Created final chunk with states: ${currentStates.join(', ')} (${currentChunk.length} bytes)`);
          }
        }
      }
      
      // If no state chunks were found, try to find sections with dates
      if (htmlChunks.length === 0) {
        console.log(`[${url}] - No state chunks found, looking for date patterns`);
        
        const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-|–|\s+to\s+)\d{1,2},?\s+\d{4}/g;
        let dateMatches = [...html.matchAll(datePattern)];
        
        if (dateMatches.length > 5) {
          console.log(`[${url}] - Found ${dateMatches.length} date patterns, creating chunks`);
          
          // Create chunks based on date concentrations
          let chunkStart = 0;
          let chunkSize = 0;
          let dateCount = 0;
          
          for (let i = 0; i < dateMatches.length; i++) {
            const matchPos = dateMatches[i].index || 0;
            
            // If we're starting a new chunk or this match is far from the current chunk
            if (chunkSize === 0 || matchPos > chunkStart + chunkSize + 5000) {
              // Save the previous chunk if it has dates
              if (dateCount > 3 && chunkSize > 0) {
                const chunk = html.substring(chunkStart, chunkStart + chunkSize);
                htmlChunks.push({ html: chunk, states: `Date section ${htmlChunks.length + 1}` });
                console.log(`[${url}] - Created date-based chunk ${htmlChunks.length} with ${dateCount} dates (${chunk.length} bytes)`);
              }
              
              // Start a new chunk
              chunkStart = Math.max(0, matchPos - 1000);
              chunkSize = Math.min(MAX_HTML_SIZE, 2000);
              dateCount = 1;
            } else {
              // Extend the current chunk to include this match
              const newEnd = matchPos + 1000;
              chunkSize = Math.min(MAX_HTML_SIZE, newEnd - chunkStart);
              dateCount++;
            }
          }
          
          // Add the final chunk if it has dates
          if (dateCount > 3 && chunkSize > 0) {
            const chunk = html.substring(chunkStart, chunkStart + chunkSize);
            htmlChunks.push({ html: chunk, states: `Date section ${htmlChunks.length + 1}` });
            console.log(`[${url}] - Created final date-based chunk with ${dateCount} dates (${chunk.length} bytes)`);
          }
        }
      }
    }
    
    // If no specialized chunks were created, use standard chunking approach
    if (htmlChunks.length === 0) {
      console.log(`[${url}] - Using standard chunking approach`);
      
      // Always include the first chunk (beginning of document)
      const firstChunk = html.substring(0, MAX_HTML_SIZE);
      htmlChunks.push({ html: firstChunk, states: 'Document start' });
      
      // For large documents, also include a middle chunk
      if (html.length > MAX_HTML_SIZE * 2) {
        const middleStart = Math.floor(html.length / 2) - Math.floor(MAX_HTML_SIZE / 2);
        const middleChunk = html.substring(middleStart, middleStart + MAX_HTML_SIZE);
        htmlChunks.push({ html: middleChunk, states: 'Document middle' });
      }
      
      // For very large documents, also include an end chunk
      if (html.length > MAX_HTML_SIZE * 3) {
        const endStart = Math.max(0, html.length - MAX_HTML_SIZE);
        const endChunk = html.substring(endStart);
        htmlChunks.push({ html: endChunk, states: 'Document end' });
      }
    }
    
    // Limit the number of chunks to process
    if (htmlChunks.length > MAX_CHUNKS) {
      console.log(`[${url}] - Limiting from ${htmlChunks.length} to ${MAX_CHUNKS} chunks to avoid timeout`);
      htmlChunks = htmlChunks.slice(0, MAX_CHUNKS);
    }
    
    diagnostics.steps.push({ 
      step: 'HTML Chunking Complete', 
      endTime: new Date().toISOString(),
      chunkCount: htmlChunks.length,
      totalChunkSize: htmlChunks.reduce((sum, chunk) => sum + chunk.html.length, 0)
    });
    
    // Process each chunk with AI and collect all shows
    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;
    let allShows = [];
    let successfulChunks = 0;
    
    for (let i = 0; i < htmlChunks.length; i++) {
      const chunk = htmlChunks[i];
      console.log(`[${url}] - Processing chunk ${i+1}/${htmlChunks.length} (${chunk.html.length} bytes) - ${chunk.states}`);
      
      diagnostics.steps.push({ 
        step: `Processing Chunk ${i+1}`, 
        startTime: new Date().toISOString(),
        chunkSize: chunk.html.length,
        chunkContext: chunk.states
      });
      
      // Choose appropriate prompt based on URL
      const prompt = isSportsCollectorsDigest 
        ? buildSCDPrompt(chunk.html, chunk.states)
        : buildAIPrompt(chunk.html, url);
      
      try {
        console.log(`[${url}] - Calling Gemini AI API for chunk ${i+1} with ${prompt.length} chars prompt...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
        
        const aiResponse = await fetch(aiApiUrl, {
          method: 'POST',
          signal: controller.signal,
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
        
        clearTimeout(timeoutId);
        
        if (!aiResponse.ok) {
          console.error(`[${url}] - AI API Error for chunk ${i+1}: ${aiResponse.status} ${aiResponse.statusText}`);
          diagnostics.steps.push({ 
            step: `Chunk ${i+1} AI Error`, 
            endTime: new Date().toISOString(),
            error: `AI API Error: ${aiResponse.status} ${aiResponse.statusText}`
          });
          continue; // Skip to next chunk
        }
        
        const aiResult = await aiResponse.json();
        
        if (!aiResult.candidates || !aiResult.candidates[0]?.content?.parts?.[0]?.text) {
          console.error(`[${url}] - AI returned no usable content for chunk ${i+1}`);
          diagnostics.steps.push({ 
            step: `Chunk ${i+1} Content Error`, 
            endTime: new Date().toISOString(),
            error: 'AI returned no usable content'
          });
          continue; // Skip to next chunk
        }
        
        // Extract and clean up the JSON
        let jsonText = aiResult.candidates[0].content.parts[0].text.trim();
        
        // Handle common JSON extraction issues
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n|\n```/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n|\n```/g, '');
        }
        
        // Ensure it's a valid JSON array
        if (!jsonText.startsWith('[') || !jsonText.endsWith(']')) {
          // Try to fix common issues
          const firstBracket = jsonText.indexOf('[');
          const lastBracket = jsonText.lastIndexOf(']');
          if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            jsonText = jsonText.slice(firstBracket, lastBracket + 1);
          } else {
            const jsonMatch = jsonText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
            if (jsonMatch) {
              jsonText = jsonMatch[0];
            }
          }
        }
        
        // Parse the JSON
        try {
          const shows = JSON.parse(jsonText);
          
          if (Array.isArray(shows)) {
            console.log(`[${url}] - Chunk ${i+1} extracted ${shows.length} shows`);
            
            // Add these shows to our collection
            allShows = allShows.concat(shows);
            successfulChunks++;
            
            diagnostics.steps.push({ 
              step: `Chunk ${i+1} Processed`, 
              endTime: new Date().toISOString(),
              showsExtracted: shows.length,
              success: true
            });
          } else {
            console.error(`[${url}] - Chunk ${i+1} result is not an array`);
            diagnostics.steps.push({ 
              step: `Chunk ${i+1} Error`, 
              endTime: new Date().toISOString(),
              error: 'Parsed result is not an array'
            });
          }
        } catch (e) {
          console.error(`[${url}] - Failed to parse JSON from chunk ${i+1}: ${e.message}`);
          diagnostics.steps.push({ 
            step: `Chunk ${i+1} Parse Error`, 
            endTime: new Date().toISOString(),
            error: `Failed to parse JSON: ${e.message}`
          });
        }
        
      } catch (e) {
        console.error(`[${url}] - AI processing failed for chunk ${i+1}: ${e.message}`);
        diagnostics.steps.push({ 
          step: `Chunk ${i+1} Processing Error`, 
          endTime: new Date().toISOString(),
          error: `AI processing failed: ${e.message}`
        });
      }
    }
    
    // Update diagnostics with combined results
    diagnostics.ai.called = true;
    diagnostics.ai.parsedShows = allShows;
    
    diagnostics.steps.push({ 
      step: 'All Chunks Processed', 
      endTime: new Date().toISOString(),
      totalChunks: htmlChunks.length,
      successfulChunks,
      totalShowsExtracted: allShows.length
    });
    
    if (allShows.length === 0) {
      console.log(`[${url}] - No shows found in any chunks`);
      diagnostics.steps.push({ 
        step: 'No Shows Found', 
        endTime: new Date().toISOString() 
      });
      diagnostics.success = successfulChunks > 0; // Success if at least one chunk processed without error
      return diagnostics;
    }
    
    console.log(`[${url}] - Successfully extracted ${allShows.length} shows from ${successfulChunks} chunks`);
    
    // Step 6: Insert shows into the pending table
    diagnostics.steps.push({ step: 'Inserting Shows', startTime: new Date().toISOString() });
    diagnostics.database.insertAttempted = true;
    
    let insertedCount = 0;
    const insertErrors = [];
    
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
        console.log(`[${url}] - Skipping show with missing name or date`);
        continue;
      }
      
      try {
        const { data, error } = await supabase
          .from('scraped_shows_pending')
          .insert({
            source_url: url,
            raw_payload: rawPayload,
            status: 'PENDING'
          })
          .select();
        
        if (error) {
          console.error(`[${url}] - Error inserting show: ${error.message}`);
          insertErrors.push(error.message);
        } else {
          insertedCount++;
        }
      } catch (e) {
        const error = `Exception inserting show: ${e.message}`;
        console.error(`[${url}] - ${error}`);
        insertErrors.push(error);
      }
    }
    
    diagnostics.database.insertSuccess = insertedCount > 0;
    diagnostics.database.insertedCount = insertedCount;
    diagnostics.database.errors = insertErrors;
    
    diagnostics.steps.push({ 
      step: 'Shows Inserted', 
      endTime: new Date().toISOString(),
      insertedCount,
      errorCount: insertErrors.length
    });
    
    console.log(`[${url}] - Successfully inserted ${insertedCount} of ${allShows.length} shows`);
    diagnostics.success = true;
    return diagnostics;
    
  } catch (e) {
    const error = `Processing failed: ${e.message}`;
    diagnostics.steps.push({ step: 'Processing Error', error });
    console.error(`[${url}] - ${error}`);
    return diagnostics;
  }
}

// Main handler function
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    console.log('Test scraper for single URL starting...');
    const startTime = Date.now();
    
    // Parse request for URL parameter
    let url = DEFAULT_URL;
    try {
      const requestData = await req.json();
      if (requestData && requestData.url) {
        url = requestData.url;
      }
    } catch (e) {
      // If no JSON body or parsing fails, use default URL
      console.log(`No URL provided, using default: ${url}`);
    }
    
    console.log(`Testing scraper for URL: ${url}`);
    
    const supabaseAdmin = getSupabaseAdmin();
    const diagnostics = await processUrlWithDiagnostics(supabaseAdmin, url);
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Prepare summary
    const summary = {
      url: url,
      elapsedSeconds,
      success: diagnostics.success,
      htmlFetched: diagnostics.html.fetched,
      htmlSize: diagnostics.html.size,
      aiCalled: diagnostics.ai.called,
      showsExtracted: diagnostics.ai.parsedShows ? diagnostics.ai.parsedShows.length : 0,
      showsInserted: diagnostics.database.insertedCount,
      steps: diagnostics.steps.map(step => ({
        name: step.step,
        ...(step.startTime && { startTime: step.startTime }),
        ...(step.endTime && { endTime: step.endTime }),
        ...(step.error && { error: step.error })
      }))
    };
    
    return new Response(JSON.stringify({ 
      message: `Test completed in ${elapsedSeconds}s.`,
      summary,
      diagnostics
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const error = e as Error;
    console.error('Test scraper failed:', error.message, error.stack);
    
    return new Response(JSON.stringify({ 
      error: `Test scraper failed: ${error.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
