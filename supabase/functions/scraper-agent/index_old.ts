import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const AI_MODEL = 'gemini-1.5-flash'
const BATCH_SIZE = 7 // Process 7 URLs with highest priority each run

// Helper to parse messy date strings
function parseDate(dateString: string | null): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

serve(async (_req) => { // Notice we use _req to show we don't use the request body
  try {
    // This function creates its own list of URLs to process
    const urlsToProcess = getRandomBatch(MASTER_URL_LIST, BATCH_SIZE);
    console.log(`Scraper starting. Processing ${urlsToProcess.length} random URLs.`);

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let totalShowsLoaded = 0;

    for (const url of urlsToProcess) {
      try {
        const pageResponse = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!pageResponse.ok) continue;
        const html = await pageResponse.text();

        const geminiApiKey = Deno.env.get('GOOGLE_AI_KEY');
        const aiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`;

        const prompt = `
          Analyze the HTML. Extract card show events into a valid JSON array.
          Each object must have keys: "name", "startDate", "endDate", "venueName", "city", "state", "url".
          - "url" should be the event URL if found, otherwise use the source URL: ${url}.
          - Do not worry about date format, return the date string as you find it.
          - If information is missing, use null.
          - ONLY output the raw JSON array. Do not add markdown or explanations.
          HTML:
          ${html}
        `;

        const aiResponse = await fetch(aiApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!aiResponse.ok) continue;

        const aiResult = await aiResponse.json();
        if (aiResult.candidates && aiResult.candidates[0].content) {
          let jsonText = aiResult.candidates[0].content.parts[0].text.trim();
          if (jsonText && jsonText.startsWith('[') && jsonText.endsWith(']')) {
            const shows = JSON.parse(jsonText);
            const cleanShows = shows.map((show: any) => ({
                name: show.name,
                start_date: parseDate(show.startDate),
                end_date: parseDate(show.endDate),
                venue_name: show.venueName,
                city: show.city,
                state: show.state ? String(show.state).substring(0, 2).toUpperCase() : null,
                url: show.url
            })).filter((show: any) => show.name && show.start_date);

            if (cleanShows.length > 0) {
              const { error } = await supabaseAdmin.from('shows').upsert(cleanShows, { onConflict: 'name,start_date,city' });
              if (error) {
                console.error(`[${url}] - DB Error: ${error.message}`);
              } else {
                console.log(`[${url}] - Loaded ${cleanShows.length} shows.`);
                totalShowsLoaded += cleanShows.length;
              }
            }
          }
        }
      } catch (e) {
        console.error(`[${url}] - CRITICAL ERROR: ${e.message}`);
        continue;
      }
    }

    return new Response(JSON.stringify({ message: `Run complete. Loaded a total of ${totalShowsLoaded} shows.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const error = e as Error;
    return new Response(JSON.stringify({ error: `Scraper failed: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});