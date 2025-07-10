// supabase/functions/_shared/cors.ts

/**
 * CORS headers for Supabase Edge Functions
 * These headers allow cross-origin requests from the frontend application
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allow requests from any origin
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
};

/**
 * Helper function to handle CORS preflight requests
 * @returns Response object with 204 status and CORS headers
 */
export const handleCorsPreflightRequest = () => {
  return new Response(null, {
    status: 204, // No content
    headers: corsHeaders,
  });
};
