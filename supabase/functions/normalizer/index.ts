import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Create a Supabase client with the service role key
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Batch size for processing
const BATCH_SIZE = 50

// State name to code mapping
const STATE_MAPPING: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
};

// Helper function to normalize state names to 2-letter codes
function normalizeState(state: string | null): string | null {
  if (!state) return null;
  
  // Already a 2-letter code
  if (/^[A-Z]{2}$/.test(state)) {
    return state;
  }
  
  // Convert to lowercase for matching
  const stateLower = state.toLowerCase().trim();
  
  // Direct lookup
  if (STATE_MAPPING[stateLower]) {
    return STATE_MAPPING[stateLower];
  }
  
  // Check for state name in the string
  for (const [name, code] of Object.entries(STATE_MAPPING)) {
    if (stateLower.includes(name)) {
      return code;
    }
  }
  
  return state.length <= 2 ? state.toUpperCase() : null;
}

// Helper function to parse dates into ISO format
function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  // Try to handle various date formats
  try {
    // Remove common prefixes/suffixes
    const cleaned = dateStr
      .replace(/^(date|when|on|starts?|ends?)\s*:?\s*/i, '')
      .replace(/\s*(at|from|to)?\s*\d{1,2}[:\.]\d{2}\s*(am|pm|a\.m\.|p\.m\.)?$/i, '');
    
    // Handle special cases
    if (/^(today|tomorrow|now)$/i.test(cleaned)) {
      const date = new Date();
      if (/tomorrow/i.test(cleaned)) {
        date.setDate(date.getDate() + 1);
      }
      return date.toISOString().split('T')[0];
    }
    
    // Try parsing with Date
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Handle MM/DD/YYYY format explicitly
    const mdyMatch = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (mdyMatch) {
      const month = parseInt(mdyMatch[1]);
      const day = parseInt(mdyMatch[2]);
      let year = parseInt(mdyMatch[3]);
      
      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Handle month name formats
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];
    for (let i = 0; i < monthNames.length; i++) {
      const monthName = monthNames[i];
      if (cleaned.toLowerCase().includes(monthName)) {
        const monthRegex = new RegExp(`${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[,\\s]+|\\s*-\\s*)(\\d{4})`, 'i');
        const match = cleaned.match(monthRegex);
        if (match) {
          const day = parseInt(match[1]);
          const year = parseInt(match[2]);
          const date = new Date(year, i, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    }
    
    // If all else fails, return the original string
    return dateStr;
  } catch (e) {
    console.error(`Error parsing date "${dateStr}":`, e);
    return dateStr;
  }
}

// Helper function to extract and clean entry fees
function normalizeEntryFee(feeStr: string | null): number | null {
  if (!feeStr) return null;
  
  try {
    // Convert to string if it's already a number
    const fee = typeof feeStr === 'number' ? feeStr.toString() : feeStr;
    
    // Handle "free" case
    if (/^(free|no\s+charge|complimentary)$/i.test(fee.trim())) {
      return 0;
    }
    
    // Extract the first number found
    const match = fee.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    
    // Handle special cases like "$5" or "5 dollars"
    const currencyMatch = fee.match(/[\$\€\£](\d+(?:\.\d+)?)/);
    if (currencyMatch) {
      return parseFloat(currencyMatch[1]);
    }
    
    // Try to parse as a number directly
    const parsed = parseFloat(fee);
    if (!isNaN(parsed)) {
      return parsed;
    }
    
    return null;
  } catch (e) {
    console.error(`Error parsing fee "${feeStr}":`, e);
    return null;
  }
}

// Helper function to standardize address formats
function normalizeAddress(address: string | null, city: string | null, state: string | null): string | null {
  if (!address && !city && !state) return null;
  
  // If we only have city and state, combine them
  if (!address && city) {
    return [city, state].filter(Boolean).join(', ');
  }
  
  // If address already contains city and state, return it as is
  if (address && city && state && address.includes(city) && address.includes(state)) {
    return address;
  }
  
  // Combine address components
  const components = [address, city, state].filter(Boolean);
  return components.join(', ');
}

// Helper function to clean up show names and descriptions
function normalizeText(text: string | null): string | null {
  if (!text) return null;
  
  return text
    .replace(/\s+/g, ' ')                 // Replace multiple spaces with single space
    .replace(/^\s+|\s+$/g, '')            // Trim whitespace
    .replace(/&amp;/g, '&')               // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '');             // Remove HTML tags
}

// Main function to normalize a pending show
function normalizeShow(rawPayload: any): any {
  // Handle null case
  if (!rawPayload) return null;
  
  // Parse dates
  const startDate = normalizeDate(rawPayload.startDate);
  let endDate = normalizeDate(rawPayload.endDate);
  
  // If no end date provided, use start date (single-day event)
  if (!endDate && startDate) {
    endDate = startDate;
  }
  
  // Normalize state
  const state = normalizeState(rawPayload.state);
  
  // Clean entry fee
  const entryFee = normalizeEntryFee(rawPayload.entryFee);
  
  // Standardize address
  const address = normalizeAddress(rawPayload.address, rawPayload.city, state);
  
  // Clean text fields
  const name = normalizeText(rawPayload.name);
  const description = normalizeText(rawPayload.description);
  const venueName = normalizeText(rawPayload.venueName);
  const city = normalizeText(rawPayload.city);
  
  // Build normalized object
  return {
    name,
    startDate,
    endDate,
    venueName,
    address,
    city,
    state,
    entryFee,
    description,
    url: rawPayload.url,
    contactInfo: normalizeText(rawPayload.contactInfo),
    normalizedAt: new Date().toISOString()
  };
}

// Process a batch of pending shows
async function processPendingShows(supabase: any, limit: number = BATCH_SIZE): Promise<{ processed: number, errors: number }> {
  try {
    // Get pending shows that don't have normalized_json yet
    const { data: pendingShows, error } = await supabase
      .from('scraped_shows_pending')
      .select('id, raw_payload')
      .eq('status', 'PENDING')
      .is('normalized_json', null)
      .limit(limit);
    
    if (error) {
      console.error('Error fetching pending shows:', error.message);
      return { processed: 0, errors: 0 };
    }
    
    if (!pendingShows || pendingShows.length === 0) {
      console.log('No pending shows to normalize');
      return { processed: 0, errors: 0 };
    }
    
    console.log(`Found ${pendingShows.length} pending shows to normalize`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Process each show
    for (const show of pendingShows) {
      try {
        // Normalize the raw payload
        const normalizedData = normalizeShow(show.raw_payload);
        
        // Update the record
        const { error: updateError } = await supabase
          .from('scraped_shows_pending')
          .update({ normalized_json: normalizedData })
          .eq('id', show.id);
        
        if (updateError) {
          console.error(`Error updating show ${show.id}:`, updateError.message);
          errorCount++;
        } else {
          processedCount++;
        }
      } catch (e) {
        console.error(`Error normalizing show ${show.id}:`, e);
        errorCount++;
      }
    }
    
    return { processed: processedCount, errors: errorCount };
  } catch (e) {
    console.error('Error in processPendingShows:', e);
    return { processed: 0, errors: 1 };
  }
}

// Main request handler
serve(async (req: Request) => {
  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const startTime = Date.now();
    console.log('Normalizer starting...');
    
    // Parse request parameters
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : BATCH_SIZE;
    
    const supabaseAdmin = getSupabaseAdmin();
    const result = await processPendingShows(supabaseAdmin, limit);
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return new Response(JSON.stringify({
      message: `Normalizer completed in ${elapsedSeconds}s. Processed ${result.processed} shows with ${result.errors} errors.`,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (e) {
    const error = e as Error;
    console.error('Normalizer failed:', error.message, error.stack);
    
    return new Response(JSON.stringify({
      error: `Normalizer failed: ${error.message}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
