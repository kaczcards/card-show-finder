import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * claim_show_series - Edge Function
 * 
 * Allows a user with the 'show_organizer' role to claim an unclaimed show series.
 * The function verifies:
 * 1. The user is authenticated
 * 2. The user has the 'show_organizer' role
 * 3. The show series exists and is currently unclaimed
 * 
 * Request body should contain:
 * - seriesId: UUID of the show series to claim
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { seriesId } = await req.json();
    
    if (!seriesId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: seriesId" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client with auth context from request
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Authentication required" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify user is a Show Organizer
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (profile.role !== "show_organizer") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only show organizers can claim shows" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if the series exists and is unclaimed
    const { data: series, error: seriesError } = await supabaseClient
      .from("show_series")
      .select("id, name, organizer_id")
      .eq("id", seriesId)
      .single();

    if (seriesError || !series) {
      return new Response(
        JSON.stringify({ error: "Show series not found" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (series.organizer_id) {
      return new Response(
        JSON.stringify({ 
          error: "This show series has already been claimed",
          currentOrganizerId: series.organizer_id,
          isOwnedByCurrentUser: series.organizer_id === user.id
        }),
        { 
          status: 409, // Conflict
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Claim the show series
    const { data: updatedSeries, error: updateError } = await supabaseClient
      .from("show_series")
      .update({ organizer_id: user.id })
      .eq("id", seriesId)
      .select("id, name, organizer_id")
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to claim show series", details: updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        message: "Show series claimed successfully",
        series: updatedSeries
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    // Handle unexpected errors
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
