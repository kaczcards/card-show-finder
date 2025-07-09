import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const AI_MODEL = 'gemini-1.5-flash'
const BATCH_SIZE = 7 // Process 7 random URLs each time the function runs

// The full list of websites for the scraper
const MASTER_URL_LIST = [
    'https://www.sacramentocardshow916.com/', 'https://katysportscardshow.com/', 'https://nonacollects.com/', 'https://www.collectiblesoncollege.com/showcalendar-834086-307805.html', 'https://frontrowcardshow.com/collections/san-diego', 'https://www.frankandsonshow.net/', 'https://www.trifectacollectibles.com/events/list/', 'https://cvcshow.com/events/', 'https://westcoastcardshow.com/events/', 'https://frontrowcardshow.com/collections/pasadena', 'https://www.nocofriendsofbaseball.com/event-details/1-table-2025-friends-of-baseball-card-memorabilia-show', 'https://www.norrispenrose.com/events-1/pikes-peak-sports-cards-super-show', 'https://nationalwesterncenter.com/event/denver-card-show-2/2025-05-17/', 'https://www.card.party/', 'https://floridastatefair.com/event/tampa-sports-collectors-expo-3/2025-06-07/', 'https://www.beckett.com/venue_manager', 'https://charliescollectibleshow.com/', 'https://www.culturecollisiontradeshow.com/', 'https://www.cardshq.com/pages/events', 'https://www.dallascardshow.com/chicago', 'https://www.premiercardshows.com/', 'https://www.nsccshow.com/', 'https://dpmsportcards.com/indiana-card-shows/', 'https://jjallstarsportscards.com/midwest-monster-show/', 'https://jjallstarsportscards.com/show-dates/', 'https://www.homeofpurdue.com/event/tippecanoe-sports-collectibles-show/20265/', 'https://www.racingmemorabiliashow.com/', 'https://flippincardshow.com/', 'https://www.northeastcardexpo.com/', 'https://www.cardshows.net/methuen-show-dates', 'https://www.cravetheauto.com/baseball-card-shows', 'https://www.shopemeraldsquare.com/events', 'https://www.legendsfanshop.com/card-shows/', 'https://collectorsarena.net/pages/events-calendar', 'https://www.thezonecards.com/cardshows', 'https://www.cardshowmn.com/', 'https://shakopeebowl.com/sports-card-show', 'https://www.kccardshows.com/', 'https://stlsportscollectors.com/', 'https://afterthegameinc.com/', 'https://relicsantiquemall.com/event-center-calendar-2/', 'https://cardscollectibles.com/', 'https://jerseyshoretoyshow.com/pages/woodbridge-card-show', 'https://www.ocnj.us/SportsMemorabiliaShow', 'https://bleeckertrading.com/pages/trade-night', 'https://www.nyshows.org/show-calendar-new', 'https://www.litcgshow.com/', 'https://www.fanaticsfest.com/', 'https://anyshowpromotions.com/', 'https://www.tidewatercardsandcollectibles.com/upcoming-shows', 'https://www.toledosportscardshow.com/', 'https://gametimesportscollect.com/event-schedule/', 'https://collectaconusa.com/cleveland/', 'https://www.dallascardshow.com/cincinnati', 'https://strongsvillesports.com/', 'https://phillyshow.com/', 'https://www.sbsportspromotions.com/pages/show-schedule', 'https://www.chestercountycardshow.com/', 'https://phillynon-sportscardshow.com/', 'https://discoveryparkofamerica.com/event/jackson-sports-cards-collectibles-show-at-discovery-park-2/', 'https://www.dallascardshow.com/', 'https://conroesportscardshow.com/', 'https://htowncardshow.com/', 'https://www.nrgpark.com/event/tristar-collectors-show-2/', 'https://collectaconusa.com/dallas/', 'http://757cardshows.com/', 'https://csashows.com/', 'https://www.sportscardinvestor.com/card-shows/', 'https://collectaconusa.com/richmond/', 'https://frontrowcardshow.com/collections/seattle', 'https://pnwshow.com/', 'https://twinoaksshows.com/home-page', 'https://www.wsscaseattle.com/', 'https://www.wisconsincardshow.com/', 'https://madisoncardshow.com/', 'http://wsca1975.com/', 'https://www.fatdaddyssports.com/', 'https://theoshkoshcardshow.com/'
];

// Helper to shuffle the array and pick a small batch
function getRandomBatch(arr: string[], size: number): string[] {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

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