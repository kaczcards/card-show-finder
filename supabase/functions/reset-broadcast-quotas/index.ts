import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Interfaces for type safety
interface Profile {
  id: string;
  role: string;
  /* new quota columns */
  pre_show_broadcasts_remaining: number;
  post_show_broadcasts_remaining: number;
}

interface ResetLogEntry {
  id?: string;
  executed_at: string;
  profiles_updated: number;
  status: 'success' | 'partial_success' | 'failure';
  error_message?: string;
}

/**
 * This function resets the broadcast_message_count to 0 for all SHOW_ORGANIZER profiles
 * and sets their new per-show quotas:
 *   • pre_show_broadcasts_remaining → 2
 *   • post_show_broadcasts_remaining → 1
 *
 * Optional query param:
 *   ?show_id=<uuid>  (or showId) → Only reset the organizer of that show.
 *
 * It can be invoked by a scheduled Edge Function (e.g. nightly) or
 * manually after a specific show concludes.
 * 
 * To schedule this function:
 * 1. Deploy it with: supabase functions deploy reset-broadcast-quotas
 * 2. Create a schedule with: supabase functions schedule create monthly_broadcast_reset --function reset-broadcast-quotas --schedule "0 0 1 * *" --description "Reset broadcast quotas on the 1st of each month"
 */
serve(async (req: Request) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  // Verify this is an authorized request
  // For cron jobs, Supabase will send an Authorization header with the service role key
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers }
    );
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extract optional show_id / showId query parameter
    const reqUrl = new URL(req.url);
    const showIdParam = reqUrl.searchParams.get("show_id") ?? reqUrl.searchParams.get("showId");

    // Create a log entry for this reset operation
    const now = new Date();
    const logEntry: ResetLogEntry = {
      executed_at: now.toISOString(),
      profiles_updated: 0,
      status: "success",
    };
    
    let profiles: Profile[] = [];
    let fetchError: any = null;

    if (showIdParam) {
      /** Reset for a specific show's organizer **/
      const { data: showData, error: showError } = await supabase
        .from("shows")
        .select("organizer_id")
        .eq("id", showIdParam)
        .single();

      if (showError || !showData?.organizer_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Show not found or has no organizer",
          }),
          { status: 404, headers },
        );
      }

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, pre_show_broadcasts_remaining, post_show_broadcasts_remaining")
        .eq("id", showData.organizer_id)
        .single();

      if (profileErr || !profileData) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Organizer profile not found",
          }),
          { status: 404, headers },
        );
      }

      profiles = [profileData as Profile];
    } else {
      /** Reset for all organizers **/
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, pre_show_broadcasts_remaining, post_show_broadcasts_remaining")
        .eq("role", "SHOW_ORGANIZER");

      profiles = (data ?? []) as Profile[];
      fetchError = error;
    }
    
    if (fetchError) {
      logEntry.status = "failure";
      logEntry.error_message = `Failed to fetch profiles: ${fetchError.message}`;
      
      // Log the failed operation
      await logResetOperation(supabase, logEntry);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to fetch profiles",
          details: fetchError.message
        }),
        { status: 500, headers }
      );
    }
    
    if (!profiles || profiles.length === 0) {
      // No profiles to update, still consider this a success
      await logResetOperation(supabase, logEntry);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No SHOW_ORGANIZER profiles found to reset" 
        }),
        { status: 200, headers }
      );
    }
    
    // Reset broadcast_message_count and update last_broadcast_reset_date for all organizers
    const updatePromises = profiles.map(async (profile: Profile) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          pre_show_broadcasts_remaining: 2,
          post_show_broadcasts_remaining: 1,
        })
        .eq("id", profile.id);
      
      return { profileId: profile.id, success: !updateError, error: updateError };
    });
    
    // Wait for all updates to complete
    const updateResults = await Promise.all(updatePromises);
    
    // Count successful updates
    const successfulUpdates = updateResults.filter(r => r.success).length;
    logEntry.profiles_updated = successfulUpdates;
    
    // Check if any updates failed
    const failedUpdates = updateResults.filter(r => !r.success);
    if (failedUpdates.length > 0) {
      logEntry.status = "partial_success";
      logEntry.error_message = `Failed to update ${failedUpdates.length} of ${profiles.length} profiles`;
    }
    
    // Log the reset operation
    await logResetOperation(supabase, logEntry);
    
    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Reset broadcast quotas for ${successfulUpdates} of ${profiles.length} organizers`,
        timestamp: now.toISOString(),
        failedUpdates: failedUpdates.length > 0 ? failedUpdates.map(f => f.profileId) : undefined,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Unexpected error in reset-broadcast-quotas function:", error);
    
    // Try to log the error, but don't throw if this fails
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await logResetOperation(supabase, {
          executed_at: new Date().toISOString(),
          profiles_updated: 0,
          status: "failure",
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "An unexpected error occurred while resetting broadcast quotas",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers }
    );
  }
});

/**
 * Helper function to log the reset operation to a broadcast_reset_logs table
 */
async function logResetOperation(supabase: any, logEntry: ResetLogEntry): Promise<void> {
  try {
    // Check if the broadcast_reset_logs table exists, create it if not
    const { error: checkError } = await supabase
      .from("broadcast_reset_logs")
      .select("id", { count: "exact", head: true })
      .limit(1);
    
    if (checkError && checkError.code === "42P01") { // Table doesn't exist
      // Create the table
      await supabase.rpc("create_broadcast_reset_logs_table");
    }
    
    // Insert the log entry
    await supabase
      .from("broadcast_reset_logs")
      .insert([{
        executed_at: logEntry.executed_at,
        profiles_updated: logEntry.profiles_updated,
        status: logEntry.status,
        error_message: logEntry.error_message,
      }]);
  } catch (error) {
    // Just log the error but don't throw, as this is a non-critical operation
    console.error("Failed to log reset operation:", error);
  }
}
