/**
 * CORS headers for Edge Functions
 * 
 * This module exports the standard CORS headers needed for cross-origin requests
 * to our Supabase Edge Functions. These headers allow requests from any origin
 * and support common HTTP methods and headers needed for the Card Show Finder app.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
};
