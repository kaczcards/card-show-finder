import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * send_broadcast_message - Edge Function
 * 
 * Allows a show organizer to send a broadcast message to all attendees of a show.
 * The function verifies:
 * 1. The user is authenticated and has the 'show_organizer' role
 * 2. The user is the organizer of the specified show series
 * 3. The user has remaining broadcast quota (pre_show or post_show)
 * 
 * Request body should contain:
 * - seriesId: UUID of the show series
 * - showId: UUID of the specific show instance (optional, if targeting a specific date)
 * - messageType: 'pre_show' or 'post_show'
 * - subject: Message subject/title
 * - content: Message content
 * - includeAttendees: boolean (include people who marked attendance)
 * - includeFavorites: boolean (include people who favorited the show)
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { 
      seriesId, 
      showId, 
      messageType, 
      subject, 
      content,
      includeAttendees = true,
      includeFavorites = false
    } = await req.json();
    
    // Validate required parameters
    if (!seriesId || !messageType || !subject || !content) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameters", 
          required: ["seriesId", "messageType", "subject", "content"] 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate message type
    if (messageType !== 'pre_show' && messageType !== 'post_show') {
      return new Response(
        JSON.stringify({ 
          error: "Invalid messageType. Must be 'pre_show' or 'post_show'" 
        }),
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

    // Verify user is a Show Organizer and has quota remaining
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, pre_show_broadcasts_remaining, post_show_broadcasts_remaining")
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
        JSON.stringify({ error: "Forbidden: Only show organizers can send broadcast messages" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check quota for the specific message type
    const quotaField = messageType === 'pre_show' 
      ? 'pre_show_broadcasts_remaining' 
      : 'post_show_broadcasts_remaining';
    
    const quotaRemaining = profile[quotaField];
    
    if (!quotaRemaining || quotaRemaining <= 0) {
      return new Response(
        JSON.stringify({ 
          error: `No ${messageType} broadcast quota remaining`,
          quotaType: messageType,
          remaining: 0
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify the user is the organizer of the specified show series
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

    if (series.organizer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You are not the organizer of this show series" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Begin database transaction
    const { error: txnError } = await supabaseClient.rpc('begin_transaction');
    if (txnError) {
      return new Response(
        JSON.stringify({ error: "Failed to start transaction", details: txnError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    try {
      // Get recipient users
      let recipientQuery = supabaseClient
        .from("profiles")
        .select("id, email, first_name, last_name")
        .neq("id", user.id); // Don't send to self
      
      // If targeting a specific show instance
      if (showId) {
        // Get attendees for the specific show
        if (includeAttendees) {
          const { data: attendees, error: attendeesError } = await supabaseClient
            .from("show_participants")
            .select("userid")
            .eq("showid", showId);
          
          if (attendeesError) {
            throw new Error(`Failed to fetch attendees: ${attendeesError.message}`);
          }
          
          if (attendees && attendees.length > 0) {
            recipientQuery = recipientQuery.in("id", attendees.map(a => a.userid));
          } else {
            // No attendees found, use empty result set
            recipientQuery = recipientQuery.eq("id", "no-matches");
          }
        }
        
        // Get users who favorited the show
        if (includeFavorites) {
          const { data: favorites, error: favoritesError } = await supabaseClient
            .from("user_favorites")
            .select("user_id")
            .eq("show_id", showId);
          
          if (favoritesError) {
            throw new Error(`Failed to fetch favorites: ${favoritesError.message}`);
          }
          
          if (favorites && favorites.length > 0) {
            // Combine with attendees using OR condition
            recipientQuery = recipientQuery.or(`id.in.(${favorites.map(f => f.user_id).join(',')})`);
          }
        }
      } else {
        // Get all attendees for any show in the series
        if (includeAttendees) {
          const { data: seriesShows, error: showsError } = await supabaseClient
            .from("shows")
            .select("id")
            .eq("series_id", seriesId);
          
          if (showsError) {
            throw new Error(`Failed to fetch shows in series: ${showsError.message}`);
          }
          
          if (seriesShows && seriesShows.length > 0) {
            const showIds = seriesShows.map(s => s.id);
            
            const { data: attendees, error: attendeesError } = await supabaseClient
              .from("show_participants")
              .select("userid")
              .in("showid", showIds);
            
            if (attendeesError) {
              throw new Error(`Failed to fetch series attendees: ${attendeesError.message}`);
            }
            
            if (attendees && attendees.length > 0) {
              recipientQuery = recipientQuery.in("id", attendees.map(a => a.userid));
            } else {
              // No attendees found, use empty result set
              recipientQuery = recipientQuery.eq("id", "no-matches");
            }
          }
        }
        
        // Get users who favorited any show in the series
        if (includeFavorites) {
          const { data: seriesShows, error: showsError } = await supabaseClient
            .from("shows")
            .select("id")
            .eq("series_id", seriesId);
          
          if (showsError) {
            throw new Error(`Failed to fetch shows in series: ${showsError.message}`);
          }
          
          if (seriesShows && seriesShows.length > 0) {
            const showIds = seriesShows.map(s => s.id);
            
            const { data: favorites, error: favoritesError } = await supabaseClient
              .from("user_favorites")
              .select("user_id")
              .in("show_id", showIds);
            
            if (favoritesError) {
              throw new Error(`Failed to fetch series favorites: ${favoritesError.message}`);
            }
            
            if (favorites && favorites.length > 0) {
              // Combine with attendees using OR condition
              recipientQuery = recipientQuery.or(`id.in.(${favorites.map(f => f.user_id).join(',')})`);
            }
          }
        }
      }

      // Execute the query to get recipients
      const { data: recipients, error: recipientsError } = await recipientQuery;
      
      if (recipientsError) {
        throw new Error(`Failed to fetch recipients: ${recipientsError.message}`);
      }
      
      if (!recipients || recipients.length === 0) {
        throw new Error("No recipients found matching the criteria");
      }

      // Create messages for all recipients
      const messages = recipients.map(recipient => ({
        sender_id: user.id,
        receiver_id: recipient.id,
        content: content,
        subject: subject,
        show_id: showId || null,
        series_id: seriesId,
        message_type: 'broadcast',
        broadcast_type: messageType,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      // Insert messages in batches to avoid hitting limits
      const batchSize = 100;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const { error: insertError } = await supabaseClient
          .from("messages")
          .insert(batch);
        
        if (insertError) {
          throw new Error(`Failed to insert messages batch ${i/batchSize + 1}: ${insertError.message}`);
        }
      }

      // Decrement the quota
      const { error: quotaError } = await supabaseClient
        .from("profiles")
        .update({ [quotaField]: quotaRemaining - 1 })
        .eq("id", user.id);
      
      if (quotaError) {
        throw new Error(`Failed to update quota: ${quotaError.message}`);
      }

      // Commit the transaction
      const { error: commitError } = await supabaseClient.rpc('commit_transaction');
      if (commitError) {
        throw new Error(`Failed to commit transaction: ${commitError.message}`);
      }

      // Return success response
      return new Response(
        JSON.stringify({
          message: "Broadcast message sent successfully",
          recipientCount: recipients.length,
          quotaRemaining: quotaRemaining - 1,
          quotaType: messageType
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } catch (txError) {
      // Rollback on error
      await supabaseClient.rpc('rollback_transaction');
      
      return new Response(
        JSON.stringify({ error: txError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
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
