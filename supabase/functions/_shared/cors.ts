/**
 * CORS Headers for Supabase Edge Functions
 * 
 * This module exports a standard set of CORS headers that can be used
 * across all Edge Functions to enable cross-origin requests.
 * 
 * Usage:
 * ```
 * import { corsHeaders } from "../_shared/cors.ts";
 * 
 * // For OPTIONS preflight requests
 * if (req.method === "OPTIONS") {
 *   return new Response("ok", { headers: corsHeaders });
 * }
 * 
 * // For regular responses
 * return new Response(JSON.stringify(data), {
 *   headers: { ...corsHeaders, "Content-Type": "application/json" },
 * });
 * ```
 */

/**
 * Standard CORS headers to allow cross-origin requests
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, Content-Type, X-Requested-With, stripe-signature",
  "Access-Control-Max-Age": "86400", // 24 hours cache for preflight requests
};

/**
 * Helper function to add CORS headers to a Response object
 * @param response The Response object to add headers to
 * @returns The Response object with CORS headers added
 */
export function addCorsHeaders(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
