 * 
 * 1. Finds all shows that ended in the past 24 hours
 * 2. Identifies the organizers of those shows via their series
 * 3. Resets their broadcast quotas to the default values:
 *    - pre_show_broadcasts_remaining = 2
 *    - post_show_broadcasts_remaining = 1
 * 
 * This ensures organizers can send messages for their next shows.
 */
Deno.serve(async () => {
  try {
    console.log("Starting broadcast quota reset job...");
    const startTime = Date.now();

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

      return new Response(
        JSON.stringify({ 
          message: "No shows ended in the past 24 hours, no quotas reset",
          timestamp: new Date().toISOString()
        }),
        { status: 200 }
      );
    }

    // Get unique series IDs from the shows
    const seriesIds = [...new Set(
      recentlyEndedShows
        .filter(show => show.series_id) // Filter out shows without a series
        .map(show => show.series_id)
    )];

    console.log(`Found ${seriesIds.length} unique series for recently ended shows`);

    if (seriesIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No series found for recently ended shows, no quotas reset",
          timestamp: new Date().toISOString()
        }),
        { status: 200 }
      );
    }
    }

    console.log(`Found ${seriesWithOrganizers?.length || 0} series with organizers`);

    if (!seriesWithOrganizers || seriesWithOrganizers.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No organizers found for recently ended shows, no quotas reset",
          timestamp: new Date().toISOString()
        }),
        { status: 200 }
      );
    }

    // Get unique organizer IDs
    const organizerIds = [...new Set(
      seriesWithOrganizers.map(series => series.organizer_id)
    )];

    console.log(`Resetting quotas for ${organizerIds.length} unique organizers`);

    // Reset quotas for these organizers
    const { data: updatedProfiles, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        pre_show_broadcasts_remaining: 2,
        post_show_broadcasts_remaining: 1
      })
      .in("id", organizerIds)
      .select("id, first_name, last_name, pre_show_broadcasts_remaining, post_show_broadcasts_remaining");

    if (updateError) {
      throw new Error(`Error resetting organizer quotas: ${updateError.message}`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`Successfully reset quotas for ${updatedProfiles?.length || 0} organizers in ${executionTime}ms`);

    // Return success response
    return new Response(
      JSON.stringify({
        message: "Broadcast quotas reset successfully",
        organizersUpdated: updatedProfiles?.length || 0,
        showsProcessed: recentlyEndedShows.length,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString()
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in reset-broadcast-quotas function: ${error.message}`);
    
    // Return error response
    return new Response(
      JSON.stringify({
        error: "Failed to reset broadcast quotas",
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500 }
    );
  }
});
