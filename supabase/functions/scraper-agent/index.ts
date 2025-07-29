import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
// Date-filter utility (ensure we only keep shows that are today or future)
import {
  isShowDateValid,
  logDateFilterResult
} from '../_shared/date-filter.ts'

const AI_MODEL = 'gemini-1.5-flash'
const BATCH_SIZE = 7 // Process 7 URLs with highest priority each run
const TIMEOUT_MS = 25000 // 25 second timeout for fetch operations

// --- NEW CONSTANTS for chunk-based AI extraction ---------------------------
const AI_TIMEOUT_MS = 30000   // 30s per AI request (Gemini)
const MAX_HTML_SIZE  = 100_000 // 100 KB per chunk sent to AI
const MAX_CHUNKS     = 3       // fail-safe: never send more than 3 chunks

// Create a Supabase client with the service role key for admin access
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Function to get the highest priority URLs to process
async function getUrlsToProcess(supabase: any, batchSize: number): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('scraping_sources')
      .select('url')
      .eq('enabled', true)
      .order('priority_score', { ascending: false })
      .order('last_success_at', { ascending: true, nullsFirst: true })
      .limit(batchSize);
    
    if (error) {
      console.error('Error fetching URLs:', error.message);
      return [];
    }
    
    return data.map((row: any) => row.url);
  } catch (e) {
    console.error('Exception fetching URLs:', e.message);
    return [];
  }
}

// Function to update scraping source stats after processing
async function updateScrapingSourceStats(
  supabase: any, 
  url: string, 
  success: boolean, 
  showCount: number = 0
): Promise<void> {
  try {
    const updates: any = {
      updated_at: new Date().toISOString()
    };
    
    if (success) {
      updates.last_success_at = new Date().toISOString();
      updates.error_streak = 0;

      /* ------------------------------------------------------------------
         NOTE: supabase.rpc(...) returns a promise -> { data, error }.
         We must await it BEFORE we construct the updates object,
         otherwise Postgres receives JSON like { priority_score: [object Promise] }
         which triggers “invalid input syntax for type integer”.
      ------------------------------------------------------------------ */
      if (showCount > 0) {
        const { data: incScore, error: incErr } = await supabase.rpc(
          'increment_priority',
          { url_param: url, increment_amount: Math.min(showCount, 5) }
        );
        if (incErr) {
          console.error(`[${url}] – RPC increment_priority failed: ${incErr.message}`);
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
        console.error(`[${url}] – RPC increment_error_streak failed: ${streakErr.message}`);
      } else if (typeof newStreak === 'number') {
        updates.error_streak = newStreak;
      }

      // Decrease priority for errors
      const { data: decScore, error: decErr } = await supabase.rpc(
        'decrement_priority',
        { url_param: url, decrement_amount: 1 }
      );
      if (decErr) {
        console.error(`[${url}] – RPC decrement_priority failed: ${decErr.message}`);
      } else if (typeof decScore === 'number') {
        updates.priority_score = decScore;
      }
    }
    
    const { error } = await supabase
      .from('scraping_sources')
      .update(updates)
      .eq('url', url);
    
    if (error) {
      console.error(`Error updating scraping source stats for ${url}:`, error.message);
    }
  } catch (e) {
    console.error(`Exception updating scraping source stats for ${url}:`, e.message);
  }
}

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

// ---------------------------------------------------------------------------
// Specialised prompt for Sports Collectors Digest (state-organised listings)
// ---------------------------------------------------------------------------
function buildSCDPrompt(html: string, stateNote = ''): string {
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
async function processUrl(supabase: any, url: string): Promise<{ success: boolean; showCount: number }> {
  console.log(`[${url}] - Processing...`);
  
  try {
    // Fetch the page HTML
    const pageResponse = await fetch(url, { 
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!pageResponse.ok) {
      console.error(`[${url}] - HTTP Error: ${pageResponse.status} ${pageResponse.statusText}`);
      return { success: false, showCount: 0 };
    }
    
    const html = await pageResponse.text();
    if (!html || html.length < 100) {
      console.error(`[${url}] - Empty or too small HTML response`);
      return { success: false, showCount: 0 };
    }
    console.log(`[${url}] - HTML fetched (${html.length} bytes). Chunking & extracting with AI...`);

    // ---------------- AI chunk logic ------------------
    const geminiApiKey = Deno.env.get('GOOGLE_AI_KEY');
    if (!geminiApiKey) {
      console.error(`[${url}] - Missing Google AI API key`);
      return { success: false, showCount: 0 };
    }

    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;

    // naive chunking: start / middle / end
    const htmlChunks: {chunk: string; note: string}[] = [];
    htmlChunks.push({ chunk: html.substring(0, MAX_HTML_SIZE),
                      note: 'Document start' });
    if (html.length > MAX_HTML_SIZE * 2) {
      const midStart = Math.floor(html.length / 2) - Math.floor(MAX_HTML_SIZE / 2);
      htmlChunks.push({ chunk: html.substring(midStart, midStart + MAX_HTML_SIZE),
                        note: 'Document middle' });
    }
    if (html.length > MAX_HTML_SIZE * 3) {
      htmlChunks.push({ chunk: html.substring(html.length - MAX_HTML_SIZE),
                        note: 'Document end' });
    }

    // limit
    const chunksToProcess = htmlChunks.slice(0, MAX_CHUNKS);

    const allShows: any[] = [];
    const isSCD = url.includes('sportscollectorsdigest');

    for (let i = 0; i < chunksToProcess.length; i++) {
      const { chunk, note } = chunksToProcess[i];
      const prompt = isSCD ? buildSCDPrompt(chunk, note) : buildAIPrompt(chunk, url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      let aiRespOk = false;
      let rawText = '';
      try {
        const aiResp = await fetch(aiApiUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, topP: 0.8, topK: 40 }
          })
        });
        clearTimeout(timeoutId);
        if (!aiResp.ok) {
          console.warn(`[${url}] - AI error on chunk ${i+1}: ${aiResp.status}`);
          continue;
        }
        const aiJson = await aiResp.json();
        rawText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        aiRespOk = rawText.length > 0;
      } catch (err) {
        console.warn(`[${url}] - AI timeout on chunk ${i+1}`);
      }
      if (!aiRespOk) continue;

      // strip markdown fences
      if (rawText.startsWith('```')) rawText = rawText.replace(/```[a-z]*\n?|```/g, '');

      // braces fix
      if (!rawText.startsWith('[')) {
        const fb = rawText.indexOf('[');
        const lb = rawText.lastIndexOf(']');
        if (fb !== -1 && lb !== -1) rawText = rawText.slice(fb, lb + 1);
      }
      let showsChunk: any[] = [];
      try {
        showsChunk = JSON.parse(rawText);
        if (Array.isArray(showsChunk)) {
          allShows.push(...showsChunk);
          console.log(`[${url}] - chunk ${i+1} ⇒ ${showsChunk.length} shows`);
        }
      } catch (_) { /* ignore parse issues */ }
    }

    if (allShows.length === 0) {
      console.log(`[${url}] - No shows parsed from any chunk`);
      return { success: true, showCount: 0 };
    }
    
    console.log(`[${url}] - Extracted total ${allShows.length} shows. Inserting...`);
    
    // Insert each show into the pending table
    let insertedCount = 0;
    let filteredCount = 0; // shows ignored due to past/invalid dates

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
      
      // ------------------------------------------------------------------
      // Skip shows where the date is in the past or un-parseable
      // ------------------------------------------------------------------
      const dateValidation = isShowDateValid(
        rawPayload.startDate as string | null,
        rawPayload.endDate as string | null
      );

      if (!dateValidation.valid) {
        // Log why we're ignoring this show for easier debugging
        logDateFilterResult(
          dateValidation,
          rawPayload.startDate || 'no date',
          url
        );
        filteredCount++;
        continue;
      }

      try {
        const { error } = await supabase
          .from('scraped_shows_pending')
          .insert({
            source_url: url,
            raw_payload: rawPayload,
            status: 'PENDING'
          });
        
        if (error) {
          console.error(`[${url}] - Error inserting show: ${error.message}`);
        } else {
          insertedCount++;
        }
      } catch (e) {
        console.error(`[${url}] - Exception inserting show: ${e.message}`);
      }
    }

    console.log(
      `[${url}] - Successfully inserted ${insertedCount} of ${allShows.length} shows (filtered ${filteredCount} past/invalid)`
    );
    return { success: true, showCount: insertedCount };
    
  } catch (e) {
    console.error(`[${url}] - Processing failed: ${e.message}`);
    return { success: false, showCount: 0 };
  }
}

// Main handler function
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    console.log('Card show scraper-agent starting...');
    const startTime = Date.now();
    
    const supabaseAdmin = getSupabaseAdmin();
    const urlsToProcess = await getUrlsToProcess(supabaseAdmin, BATCH_SIZE);
    
    if (urlsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No URLs to process. Check scraping_sources table.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    console.log(`Processing ${urlsToProcess.length} URLs: ${urlsToProcess.join(', ')}`);
    
    const results = [];
    let totalShowsFound = 0;
    let successfulScrapes = 0;
    
    // Process URLs sequentially to avoid rate limits and resource contention
    for (const url of urlsToProcess) {
      const result = await processUrl(supabaseAdmin, url);
      results.push({ url, ...result });
      
      if (result.success) {
        successfulScrapes++;
        totalShowsFound += result.showCount;
      }
      
      // Update stats after each URL
      await updateScrapingSourceStats(
        supabaseAdmin, 
        url, 
        result.success, 
        result.showCount
      );
      
      // Small delay between requests to be nice to servers
      if (urlsToProcess.indexOf(url) < urlsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return new Response(JSON.stringify({ 
      message: `Scraper completed in ${elapsedSeconds}s. Processed ${urlsToProcess.length} URLs with ${successfulScrapes} successful scrapes. Found ${totalShowsFound} shows.`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const error = e as Error;
    console.error('Scraper failed:', error.message, error.stack);
    
    return new Response(JSON.stringify({ 
      error: `Scraper failed: ${error.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
