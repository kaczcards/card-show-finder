import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// This flexible function can handle date formats like "July 4th, 2025", "2025-07-04", etc.
function parseDate(dateString: string | null): string | null {
  if (!dateString) return null;
  try {
    // Attempt to create a date object from the string
    const date = new Date(dateString);
    // Check if the created date is valid
    if (isNaN(date.getTime())) return null;
    // Format the valid date to YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch all records from the holding table
    const { data: rawData, error: fetchError } = await supabaseAdmin
      .from('raw_ai_responses')
      .select('*');

    if (fetchError) throw new Error(`Failed to fetch raw data: ${fetchError.message}`);
    if (!rawData || rawData.length === 0) {
      return new Response(JSON.stringify({ message: "No new raw data to process." }), { headers: corsHeaders });
    }

    console.log(`Found ${rawData.length} raw records to process.`);
    let showsToInsert = [];

    // 2. Loop through each raw record and process it
    for (const record of rawData) {
      try {
        let jsonText = record.ai_response_text.trim();
        const startIndex = jsonText.indexOf('[');
        const endIndex = jsonText.lastIndexOf(']');

        if (startIndex !== -1 && endIndex !== -1) {
          jsonText = jsonText.substring(startIndex, endIndex + 1);
          const shows = JSON.parse(jsonText);

          for (const show of shows) {
            const cleanShow = {
              name: show.name,
              start_date: parseDate(show.startDate),
              end_date: parseDate(show.endDate),
              venue_name: show.venueName,
              city: show.city,
              state: show.state ? String(show.state).substring(0, 2).toUpperCase() : null,
              url: show.url,
            };

            // Only add shows that have a name and a valid start date
            if (cleanShow.name && cleanShow.start_date) {
              showsToInsert.push(cleanShow);
            }
          }
        }
      } catch (e) {
        console.error(`Skipping record ID ${record.id} due to parsing error: ${e.message}`);
        continue;
      }
    }

    // 3. Insert the clean data into the final 'shows' table
    if (showsToInsert.length > 0) {
      console.log(`Attempting to load ${showsToInsert.length} clean shows...`);
      const { error: insertError } = await supabaseAdmin
        .from('shows')
        .upsert(showsToInsert, { onConflict: 'name,start_date,city' });

      if (insertError) {
        throw new Error(`Failed to insert clean data: ${insertError.message}`);
      }
    }

    // 4. Clear the holding table after successful processing
    await supabaseAdmin.from('raw_ai_responses').delete().neq('id', 0);

    return new Response(JSON.stringify({ message: `Successfully processed and loaded ${showsToInsert.length} shows.` }), { headers: corsHeaders });

  } catch (e) {
    const error = e as Error;
    return new Response(JSON.stringify({ error: `Processor failed: ${error.message}` }), { headers: { ...corsHeaders, status: 500 }});
  }
});