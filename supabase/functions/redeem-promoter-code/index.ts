// supabase/functions/redeem-promoter-code/index.ts
/**
 * Promoter Code Redemption - Supabase Edge Function
 * 
 * This function handles the redemption of promoter codes for:
 * - dealer_30: 30-day free trial for MVP Dealers
 * - organizer_90: 90-day free trial for Show Organizers
 * 
 * It validates codes, enforces redemption limits, updates user profiles,
 * and creates referral records for tracking organizer earnings.
 * 
 * Request body:
 * {
 *   code: string,       // The promoter code to redeem
 *   userId?: string     // Optional: Admin-provided user ID (bypasses auth)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   expiry?: string,    // ISO date when the trial expires
 *   type?: string,      // Code type that was redeemed
 *   error?: string      // Error message if success=false
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Create a Supabase client with the service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Try to import shared CORS headers if available, otherwise define inline
let corsHeaders;
try {
  const { corsHeaders: importedHeaders } = await import("../_shared/cors.ts");
  corsHeaders = importedHeaders;
} catch (e) {
  // Define permissive CORS headers inline if shared module not available
  corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

interface RequestBody {
  code: string;
  userId?: string; // Optional: if not provided, use auth.uid()
}

interface PromoterCode {
  id: string;
  code: string;
  type: 'dealer_30' | 'organizer_90';
  referrer_user_id: string;
  show_series_id?: string;
  max_redemptions?: number;
  per_user_limit: number;
  expires_at?: string;
}

serve(async (req: Request) => {
  try {
    // CORS preflight handling
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    // Verify request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json() as RequestBody;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    const { code, userId: providedUserId } = body;
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: "Code is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user ID from auth or provided value
    let userId: string;
    if (providedUserId) {
      // Admin-provided user ID (for testing or admin operations)
      userId = providedUserId;
    } else {
      // Get user ID from auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Extract JWT token
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      userId = user.id;
    }

    // 1. Validate code exists and is active
    const { data: codeData, error: codeError } = await supabase
      .from("promoter_codes")
      .select("*")
      .eq("code", code)
      .single();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const promoterCode = codeData as PromoterCode;

    // Check if code is expired
    if (promoterCode.expires_at && new Date(promoterCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Code has expired" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if max redemptions reached
    if (promoterCode.max_redemptions) {
      const { count, error: countError } = await supabase
        .from("promoter_code_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("code_id", promoterCode.id);

      if (countError) {
        console.error("Error checking redemption count:", countError);
        return new Response(
          JSON.stringify({ success: false, error: "Error validating code" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (count && count >= promoterCode.max_redemptions) {
        return new Response(
          JSON.stringify({ success: false, error: "Code redemption limit reached" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Check per-user limit (usually 1)
    const { count: userRedemptionCount, error: userCountError } = await supabase
      .from("promoter_code_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("code_id", promoterCode.id)
      .eq("user_id", userId);

    if (userCountError) {
      console.error("Error checking user redemption count:", userCountError);
      return new Response(
        JSON.stringify({ success: false, error: "Error validating code" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (userRedemptionCount && userRedemptionCount >= promoterCode.per_user_limit) {
      return new Response(
        JSON.stringify({ success: false, error: "You have already used this code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Get user profile to check current status
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ success: false, error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Begin transaction
    // TODO: Implement proper transaction handling
    // For now we'll use sequential operations

    // 3. Insert redemption record
    const { error: redemptionError } = await supabase
      .from("promoter_code_redemptions")
      .insert({
        code_id: promoterCode.id,
        user_id: userId,
        redeemed_at: new Date().toISOString()
      });

    if (redemptionError) {
      // Check if it's a unique constraint violation (already redeemed)
      if (redemptionError.code === "23505") { // PostgreSQL unique violation code
        return new Response(
          JSON.stringify({ success: false, error: "You have already redeemed this code" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.error("Error inserting redemption:", redemptionError);
      return new Response(
        JSON.stringify({ success: false, error: "Error recording redemption" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Update user profile based on code type
    const now = new Date();
    let expiryDate: Date;
    let accountType: "dealer" | "organizer";
    let role: "dealer" | "show_organizer";

    if (promoterCode.type === "dealer_30") {
      expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      accountType = "dealer";
      role = "dealer";
    } else if (promoterCode.type === "organizer_90") {
      expiryDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
      accountType = "organizer";
      role = "show_organizer";
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid code type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        account_type: accountType,
        role: role,
        subscription_status: "active",
        payment_status: "trial",
        subscription_expiry: expiryDate.toISOString(),
        updated_at: now.toISOString()
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Error applying code benefits" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Create referral record if this is a dealer code
    if (promoterCode.type === "dealer_30") {
      // First check if a referral already exists (first-code-wins)
      const { data: existingReferral, error: referralCheckError } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_user_id", userId)
        .single();

      if (referralCheckError && referralCheckError.code !== "PGRST116") { // Not found is ok
        console.error("Error checking existing referral:", referralCheckError);
        // Non-critical error, continue
      }

      // Only create referral if one doesn't exist (first-code-wins)
      if (!existingReferral) {
        const { error: referralError } = await supabase
          .from("referrals")
          .insert({
            referrer_user_id: promoterCode.referrer_user_id,
            referred_user_id: userId,
            code_id: promoterCode.id,
            started_at: now.toISOString(),
            status: "active"
          });

        if (referralError) {
          console.error("Error creating referral:", referralError);
          // Non-critical error, continue
        }
      }
    }

    // 6. Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Code redeemed successfully",
        expiry: expiryDate.toISOString(),
        type: promoterCode.type
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
