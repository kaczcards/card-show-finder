// supabase/functions/send-broadcast/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { corsHeaders } from "../_shared/cors.ts";

// Types for request body
interface BroadcastRequest {
  sender_id: string;
  show_id: string;
  recipient_roles: string[];
  message: string;
  is_pre_show?: boolean; // Optional override for testing
}

// Types for response
interface BroadcastResponse {
  conversation_id?: string;
  success: boolean;
  message: string;
  quota_remaining?: {
    pre_show: number;
    post_show: number;
  };
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
    
    // Parse request body
    const { sender_id, show_id, recipient_roles, message, is_pre_show } = await req.json() as BroadcastRequest;
    
    // Validate required fields
    if (!sender_id || !message || !recipient_roles || recipient_roles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields: sender_id, message, and recipient_roles are required"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Sanitize message (basic HTML stripping and length check)
    const sanitizedMessage = message
      .replace(/<[^>]*>?/gm, '') // Strip HTML tags
      .trim()
      .substring(0, 1000); // Limit to 1000 chars
    
    if (sanitizedMessage.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Message content cannot be empty"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Normalize recipient roles to lowercase
    const normalizedRoles = recipient_roles.map(role => role.toLowerCase());
    
    // Get sender profile to check role
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', sender_id)
      .single();
    
    if (profileError || !senderProfile) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Sender profile not found"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    
    const senderRole = senderProfile.role.toLowerCase();
    
    // Check if sender has permission to broadcast
    const isShowOrganizer = senderRole === 'show_organizer';
    const isMvpDealer = senderRole === 'mvp_dealer';
    
    if (!isShowOrganizer && !isMvpDealer) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Only Show Organizers and MVP Dealers can send broadcast messages"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }
    
    // For MVP dealers, verify they're registered for the show
    if (isMvpDealer) {
      const { data: dealerRegistration, error: dealerError } = await supabase
        .from('show_participants')
        .select('id')
        .eq('userid', sender_id)
        .eq('showid', show_id)
        .single();
      
      if (dealerError || !dealerRegistration) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "MVP Dealer must be registered for the show to broadcast messages"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      
      // MVP dealers can only target attendees
      if (!normalizedRoles.every(role => role === 'attendee')) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "MVP Dealers can only broadcast to attendees"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    }
    
    // For show organizers, check and enforce broadcast quotas
    let quotaRemaining = null;
    
    if (isShowOrganizer && show_id) {
      // Get show information to determine if pre or post show
      const { data: showData, error: showError } = await supabase
        .from('shows')
        .select('id, start_date, end_date')
        .eq('id', show_id)
        .single();
      
      if (showError || !showData) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Show not found"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      
      // Determine if pre-show or post-show
      let isPreShow = is_pre_show;
      if (isPreShow === undefined) {
        const now = new Date();
        const startDate = new Date(showData.start_date);
        isPreShow = now < startDate;
      }
      
      // Get current quota
      let { data: quotaData, error: quotaError } = await supabase
        .from('broadcast_quotas')
        .select('pre_show_remaining, post_show_remaining')
        .eq('organizer_id', sender_id)
        .eq('show_id', show_id)
        .single();
      
      // If no quota record exists, create one with default values
      if (quotaError || !quotaData) {
        const { data: newQuota, error: createError } = await supabase
          .from('broadcast_quotas')
          .insert({
            organizer_id: sender_id,
            show_id: show_id,
            pre_show_remaining: 2,
            post_show_remaining: 1
          })
          .select()
          .single();
        
        if (createError || !newQuota) {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Failed to initialize broadcast quota"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
        
        quotaData = newQuota;
      }
      
      // Check if quota is available
      const remainingQuota = isPreShow 
        ? quotaData.pre_show_remaining 
        : quotaData.post_show_remaining;
      
      if (remainingQuota <= 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `You have used all your ${isPreShow ? 'pre-show' : 'post-show'} broadcast messages for this show`,
            quota_remaining: {
              pre_show: quotaData.pre_show_remaining,
              post_show: quotaData.post_show_remaining
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      
      // Decrement quota
      if (isPreShow) {
        await supabase
          .from('broadcast_quotas')
          .update({ pre_show_remaining: quotaData.pre_show_remaining - 1, last_updated: new Date().toISOString() })
          .eq('organizer_id', sender_id)
          .eq('show_id', show_id);
        
        quotaData.pre_show_remaining -= 1;
      } else {
        await supabase
          .from('broadcast_quotas')
          .update({ post_show_remaining: quotaData.post_show_remaining - 1, last_updated: new Date().toISOString() })
          .eq('organizer_id', sender_id)
          .eq('show_id', show_id);
        
        quotaData.post_show_remaining -= 1;
      }
      
      quotaRemaining = {
        pre_show: quotaData.pre_show_remaining,
        post_show: quotaData.post_show_remaining
      };
    }
    
    // Call the create_broadcast_message function to handle the broadcast
    const { data: result, error: broadcastError } = await supabase
      .rpc('create_broadcast_message', {
        p_sender_id: sender_id,
        p_show_id: show_id,
        p_message_text: sanitizedMessage,
        p_recipient_roles: normalizedRoles,
        p_is_pre_show: is_pre_show
      });
    
    if (broadcastError || !result) {
      console.error("Broadcast error:", broadcastError);
      return new Response(
        JSON.stringify({
          success: false,
          message: broadcastError?.message || "Failed to send broadcast message",
          quota_remaining: quotaRemaining
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Return success with conversation ID
    return new Response(
      JSON.stringify({
        success: true,
        message: "Broadcast message sent successfully",
        conversation_id: result,
        quota_remaining: quotaRemaining
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: `Unexpected error: ${error.message}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
