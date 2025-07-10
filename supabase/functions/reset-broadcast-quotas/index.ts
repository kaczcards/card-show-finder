// supabase/functions/reset-broadcast-quotas/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { corsHeaders } from "../_shared/cors.ts";

interface QuotaResetSummary {
  success: boolean;
  message: string;
  stats?: {
    total_shows_processed: number;
    pre_show_quotas_reset: number;
    post_show_quotas_reset: number;
    errors: number;
  };
  errors?: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Initialize statistics
    const stats = {
      total_shows_processed: 0,
      pre_show_quotas_reset: 0,
      post_show_quotas_reset: 0,
      errors: 0
    };
    
    const errors: string[] = [];
    
    // Get all active broadcast quotas with show information
    const { data: quotasWithShows, error: quotasError } = await supabase
      .from('broadcast_quotas')
      .select(`
        organizer_id,
        show_id,
        pre_show_remaining,
        post_show_remaining,
        shows:show_id (
          id,
          title,
          start_date,
          end_date,
          status
        )
      `);
    
    if (quotasError) {
      throw new Error(`Failed to fetch broadcast quotas: ${quotasError.message}`);
    }
    
    if (!quotasWithShows || quotasWithShows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No broadcast quotas found to reset",
          stats: {
            total_shows_processed: 0,
            pre_show_quotas_reset: 0,
            post_show_quotas_reset: 0,
            errors: 0
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Current date for comparison
    const now = new Date();
    
    // Process each quota record
    for (const quota of quotasWithShows) {
      try {
        stats.total_shows_processed++;
        
        if (!quota.shows) {
          errors.push(`Show not found for quota: ${quota.show_id}`);
          stats.errors++;
          continue;
        }
        
        const show = quota.shows;
        const startDate = new Date(show.start_date);
        const endDate = new Date(show.end_date);
        const isUpcoming = startDate > now;
        const isPast = endDate < now;
        
        // Reset pre-show quota for upcoming shows
        if (isUpcoming && quota.pre_show_remaining < 2) {
          const { error: updateError } = await supabase
            .from('broadcast_quotas')
            .update({ 
              pre_show_remaining: 2,
              last_updated: new Date().toISOString()
            })
            .eq('organizer_id', quota.organizer_id)
            .eq('show_id', quota.show_id);
          
          if (updateError) {
            errors.push(`Failed to reset pre-show quota for show ${show.title}: ${updateError.message}`);
            stats.errors++;
          } else {
            stats.pre_show_quotas_reset++;
          }
        }
        
        // Reset post-show quota for past shows
        if (isPast && quota.post_show_remaining < 1) {
          const { error: updateError } = await supabase
            .from('broadcast_quotas')
            .update({ 
              post_show_remaining: 1,
              last_updated: new Date().toISOString()
            })
            .eq('organizer_id', quota.organizer_id)
            .eq('show_id', quota.show_id);
          
          if (updateError) {
            errors.push(`Failed to reset post-show quota for show ${show.title}: ${updateError.message}`);
            stats.errors++;
          } else {
            stats.post_show_quotas_reset++;
          }
        }
      } catch (quotaError) {
        errors.push(`Error processing quota for show ${quota.show_id}: ${quotaError.message}`);
        stats.errors++;
      }
    }
    
    // Prepare response summary
    const summary: QuotaResetSummary = {
      success: true,
      message: `Broadcast quotas reset process completed. Processed ${stats.total_shows_processed} shows, reset ${stats.pre_show_quotas_reset} pre-show and ${stats.post_show_quotas_reset} post-show quotas.`,
      stats,
      errors: errors.length > 0 ? errors : undefined
    };
    
    // Log summary for monitoring
    console.log("Broadcast quotas reset summary:", JSON.stringify(summary));
    
    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Unexpected error during broadcast quota reset:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to reset broadcast quotas: ${error.message}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
