// supabase/functions/debug-signed-url/index.ts
/**
 * Debug Signed URL Generator - Supabase Edge Function
 * 
 * This function helps developers test the signed URL functionality by:
 * 1. Accepting a path parameter for a file in the card_images bucket
 * 2. Generating a signed URL for that file
 * 3. Returning the URL for testing and verification
 * 
 * Usage:
 * GET /debug-signed-url?path=userId/filename.jpg
 * 
 * Optional parameters:
 * - expiresIn: URL expiration time in seconds (default: 3600)
 * - download: Set to 'true' to add download flag
 * - width: Image width for transformation
 * - height: Image height for transformation
 * - quality: Image quality (1-100)
 * - format: Image format (webp, avif, jpg, png)
 * 
 * Example:
 * /debug-signed-url?path=123e4567/card1.jpg&expiresIn=7200&width=800&quality=80
 * 
 * Note: This function should be disabled in production environments
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";
import { applySecurity, createSecureResponse, createSecureErrorResponse } from "../_shared/security.ts";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const IS_PRODUCTION = Deno.env.get("ENVIRONMENT") === "production";

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Default bucket name
const DEFAULT_BUCKET = "card_images";

/**
 * Main handler function
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Apply security middleware with API configuration
    const securityResponse = await applySecurity(req, "api");
    if (securityResponse) return securityResponse;
    
    // In production, this function should be disabled unless the user is an admin
    if (IS_PRODUCTION) {
      // Get authenticated user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createSecureErrorResponse("Unauthorized", 401);
      }
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return createSecureErrorResponse("Unauthorized", 401);
      }
      
      // Check if user is an admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      if (!profile || profile.role !== "admin") {
        return createSecureErrorResponse("Forbidden: Admin access required in production", 403);
      }
    }
    
    // Parse URL and get parameters
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    
    // Validate path parameter
    if (!path) {
      return createSecureErrorResponse("Missing path parameter", 400);
    }
    
    // Get optional parameters
    const expiresIn = parseInt(url.searchParams.get("expiresIn") || "3600", 10);
    const download = url.searchParams.get("download") === "true";
    
    // Get transform options if provided
    const transform: Record<string, any> = {};
    
    if (url.searchParams.has("width")) {
      transform.width = parseInt(url.searchParams.get("width") || "0", 10);
    }
    
    if (url.searchParams.has("height")) {
      transform.height = parseInt(url.searchParams.get("height") || "0", 10);
    }
    
    if (url.searchParams.has("quality")) {
      transform.quality = parseInt(url.searchParams.get("quality") || "0", 10);
    }
    
    if (url.searchParams.has("format")) {
      const format = url.searchParams.get("format");
      if (["origin", "webp", "avif", "jpg", "jpeg", "png"].includes(format || "")) {
        transform.format = format;
      }
    }
    
    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .createSignedUrl(path, expiresIn, {
        download: download,
        transform: Object.keys(transform).length > 0 ? transform : undefined
      });
    
    if (error) {
      throw error;
    }
    
    if (!data?.signedUrl) {
      throw new Error("Failed to generate signed URL");
    }
    
    // Return the signed URL
    return createSecureResponse({
      signedUrl: data.signedUrl,
      path: path,
      expiresIn: expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      download: download,
      transform: Object.keys(transform).length > 0 ? transform : undefined
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return createSecureErrorResponse(
      `Error generating signed URL: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
});
