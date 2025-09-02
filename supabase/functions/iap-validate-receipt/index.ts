// supabase/functions/iap-validate-receipt/index.ts
/**
 * Apple IAP Receipt Validation - Supabase Edge Function
 * 
 * This function validates Apple In-App Purchase receipts against
 * Apple's verification servers. It tries the production environment first,
 * and if that returns a 21007 status (indicating a sandbox receipt),
 * it falls back to the sandbox environment.
 * 
 * The function accepts a receipt data string and returns validation results.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Environment variables
const APPLE_IAP_SHARED_SECRET = Deno.env.get("APPLE_IAP_SHARED_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Apple receipt validation endpoints
const PRODUCTION_VALIDATION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_VALIDATION_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// CORS headers for preflight requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Validate a receipt with Apple's servers
 * @param url The validation endpoint URL (production or sandbox)
 * @param receiptData The base64-encoded receipt data
 * @returns The validation response from Apple
 */
async function validateReceipt(url: string, receiptData: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: APPLE_IAP_SHARED_SECRET,
      "exclude-old-transactions": true,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return await response.json();
}

// Main webhook handler
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if shared secret is configured
    if (!APPLE_IAP_SHARED_SECRET) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing Apple IAP shared secret configuration" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    const { receiptData } = body;
    if (!receiptData) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing receiptData" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // First try production environment
    let validationResult;
    try {
      validationResult = await validateReceipt(PRODUCTION_VALIDATION_URL, receiptData);
      
      // If status is 21007, it's a sandbox receipt, so try sandbox environment
      if (validationResult.status === 21007) {
        console.log("Sandbox receipt detected, trying sandbox environment");
        validationResult = await validateReceipt(SANDBOX_VALIDATION_URL, receiptData);
      }
    } catch (error) {
      console.error("Error validating receipt:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Receipt validation failed", 
          message: error.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check validation result
    if (validationResult.status === 0) {
      // Success - receipt is valid
      return new Response(
        JSON.stringify({
          success: true,
          environment: validationResult.environment || (validationResult.status === 21007 ? "Sandbox" : "Production"),
          latest_receipt_info: validationResult.latest_receipt_info,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Failed validation
      return new Response(
        JSON.stringify({
          success: false,
          status: validationResult.status,
          message: getStatusDescription(validationResult.status),
        }),
        {
          status: 200, // Still return 200 to the client, but with success: false
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error processing request:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error",
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get a human-readable description for Apple's status codes
 * @param status The status code from Apple's verification response
 * @returns A human-readable description of the status
 */
function getStatusDescription(status: number): string {
  switch (status) {
    case 21000:
      return "The App Store could not read the JSON object you provided.";
    case 21002:
      return "The data in the receipt-data property was malformed or missing.";
    case 21003:
      return "The receipt could not be authenticated.";
    case 21004:
      return "The shared secret you provided does not match the shared secret on file for your account.";
    case 21005:
      return "The receipt server is currently not available.";
    case 21006:
      return "This receipt is valid but the subscription has expired.";
    case 21007:
      return "This receipt is from the test environment, but it was sent to the production environment for verification.";
    case 21008:
      return "This receipt is from the production environment, but it was sent to the test environment for verification.";
    case 21010:
      return "This receipt could not be authorized.";
    default:
      return `Unknown status code: ${status}`;
  }
}
