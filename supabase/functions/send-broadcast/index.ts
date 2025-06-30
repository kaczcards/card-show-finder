import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Types for request and response
interface BroadcastRequest {
  showId?: string;
  message: string;
  recipients: ('attendees' | 'dealers')[];
}

interface BroadcastResponse {
  success: boolean;
  error?: string;
  data?: {
    broadcastId: string;
    sentAt: string;
    recipientCount?: number;
  };
}

interface Profile {
  id: string;
  role: string;
  broadcast_message_count: number;
  last_broadcast_reset_date: string | null;
}

interface Show {
  id: string;
  organizer_id: string;
}

// Constants
const MONTHLY_BROADCAST_LIMIT = 2; // Default limit for show organizers

serve(async (req: Request) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Supabase client with auth from request for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers }
      );
    }

    // Create a client with the user's JWT for authentication checks
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    // Parse request body
    const requestData: BroadcastRequest = await req.json();
    const { showId, message, recipients } = requestData;

    // Validate request data
    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message content cannot be empty' }),
        { status: 400, headers }
      );
    }

    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message content cannot exceed 1000 characters' }),
        { status: 400, headers }
      );
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'At least one recipient type must be specified' }),
        { status: 400, headers }
      );
    }

    // Verify user is a SHOW_ORGANIZER
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, broadcast_message_count, last_broadcast_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to retrieve user profile' }),
        { status: 500, headers }
      );
    }

    const profile = profileData as Profile;
    if (profile.role !== 'SHOW_ORGANIZER') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only show organizers can send broadcast messages' }),
        { status: 403, headers }
      );
    }

    // If showId is provided, verify the organizer owns this show
    if (showId) {
      const { data: showData, error: showError } = await supabaseAdmin
        .from('shows')
        .select('id, organizer_id')
        .eq('id', showId)
        .single();

      if (showError || !showData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Show not found' }),
          { status: 404, headers }
        );
      }

      const show = showData as Show;
      if (show.organizer_id !== user.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You can only send broadcasts for shows you organize' }),
          { status: 403, headers }
        );
      }
    }

    // Check and reset monthly broadcast quota if needed
    let broadcastCount = profile.broadcast_message_count || 0;
    const lastResetDate = profile.last_broadcast_reset_date ? new Date(profile.last_broadcast_reset_date) : null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Reset count if we're in a new month since the last reset
    if (!lastResetDate || lastResetDate < monthStart) {
      broadcastCount = 0;
      await supabaseAdmin
        .from('profiles')
        .update({
          last_broadcast_reset_date: now.toISOString(),
          broadcast_message_count: 0,
        })
        .eq('id', user.id);
    }

    // Check if the organizer has reached their monthly limit
    if (broadcastCount >= MONTHLY_BROADCAST_LIMIT) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `You have reached your monthly broadcast limit of ${MONTHLY_BROADCAST_LIMIT} messages`,
        }),
        { status: 429, headers }
      );
    }

    // Insert the broadcast log
    const { data: broadcastData, error: broadcastError } = await supabaseAdmin
      .from('broadcast_logs')
      .insert([
        {
          organizer_id: user.id,
          show_id: showId || null,
          message_content: message,
          recipients: recipients,
          sent_at: now.toISOString(),
        },
      ])
      .select('id, sent_at')
      .single();

    if (broadcastError || !broadcastData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to log broadcast message' }),
        { status: 500, headers }
      );
    }

    // Increment the broadcast count
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        broadcast_message_count: broadcastCount + 1,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating broadcast count:', updateError);
      // Continue despite error, as the message was sent
    }

    // TODO: Implement actual message delivery logic
    // This could involve push notifications, emails, etc.
    // For now, we just log the broadcast

    // Calculate approximate recipient count (for informational purposes)
    let recipientCount = 0;
    if (showId) {
      // Count attendees and/or dealers for this specific show
      const tables = [];
      if (recipients.includes('attendees')) {
        tables.push('show_participants');
      }
      if (recipients.includes('dealers')) {
        tables.push('dealer_show_participation');
      }

      for (const table of tables) {
        const { count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('showid', showId);
        
        recipientCount += count || 0;
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          broadcastId: broadcastData.id,
          sentAt: broadcastData.sent_at,
          recipientCount: recipientCount > 0 ? recipientCount : undefined,
        },
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Unexpected error in send-broadcast function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred while processing your request',
      }),
      { status: 500, headers }
    );
  }
});
