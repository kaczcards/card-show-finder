import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const AI_MODEL = 'gemini-1.5-flash'
const BATCH_SIZE = 7 // Process 7 URLs with highest priority each run
const TIMEOUT_MS = 25000 // 25 second timeout for fetch operations

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
      // Increase priority score for successful scrapes with shows
      if (showCount > 0) {
        updates.priority_score = supabase.rpc('increment_priority', { 
          url_param: url, 
          increment_amount: Math.min(showCount, 5) // Max +5 per run
        });
      }
    } else {
      updates.last_error_at = new Date().toISOString();
      updates.error_streak = supabase.rpc('increment_error_streak', { url_param: url });
      // Decrease priority for errors
      updates.priority_score = supabase.rpc('decrement_priority', { 
        url_param: url, 
        decrement_amount: 1
      });
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
    
    console.log(`[${url}] - HTML fetched successfully (${html.length} bytes). Extracting with AI...`);
    
    // Extract data using AI
    const geminiApiKey = Deno.env.get('GOOGLE_AI_KEY');
    if (!geminiApiKey) {
      console.error(`[${url}] - Missing Google AI API key`);
      return { success: false, showCount: 0 };
    }
    
    const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;
    const prompt = buildAIPrompt(html, url);
    
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
      console.error(`[${url}] - AI API Error: ${aiResponse.status} ${aiResponse.statusText}`);
      return { success: false, showCount: 0 };
    }
    
    const aiResult = await aiResponse.json();
    if (!aiResult.candidates || !aiResult.candidates[0]?.content?.parts?.[0]?.text) {
      console.error(`[${url}] - AI returned no usable content`);
      return { success: false, showCount: 0 };
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
      console.error(`[${url}] - AI didn't return a valid JSON array: ${jsonText.substring(0, 100)}...`);
      
      // Try to find JSON array in the response
      const jsonMatch = jsonText.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      } else {
        return { success: false, showCount: 0 };
      }
    }
    
    // Parse the JSON
    let shows;
    try {
      shows = JSON.parse(jsonText);
    } catch (e) {
      console.error(`[${url}] - Failed to parse JSON: ${e.message}`);
      return { success: false, showCount: 0 };
    }
    
    if (!Array.isArray(shows) || shows.length === 0) {
      console.log(`[${url}] - No shows found in the response`);
      // This is still a successful scrape, just no shows found
      return { success: true, showCount: 0 };
    }
    
    console.log(`[${url}] - Extracted ${shows.length} shows. Inserting to pending table...`);
    
    // Insert each show into the pending table
    let insertedCount = 0;
    for (const show of shows) {
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
    
    console.log(`[${url}] - Successfully inserted ${insertedCount} of ${shows.length} shows`);
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
