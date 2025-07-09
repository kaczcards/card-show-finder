import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Types for request and response
interface BroadcastRequest {
  showId?: string;
  seriesId?: string;
  message: string;
  recipients: ('attendees' | 'dealers')[];
  broadcastType: 'pre_show' | 'post_show';
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
  broadcast_message_count?: number; // legacy – ignored
  last_broadcast_reset_date?: string | null; // legacy – ignored
  pre_show_broadcasts_remaining: number;
  post_show_broadcasts_remaining: number;
}

interface Show {
  id: string;
  organizer_id: string;
  series_id: string | null;
}

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
    const { showId, seriesId: rawSeriesId, message, recipients, broadcastType } = requestData;

    // Validate broadcastType
    if (broadcastType !== 'pre_show' && broadcastType !== 'post_show') {
      return new Response(
        JSON.stringify({ success: false, error: 'broadcastType must be "pre_show" or "post_show"' }),
        { status: 400, headers },
      );
    }

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
      .select('id, role, pre_show_broadcasts_remaining, post_show_broadcasts_remaining')
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

    // Derive seriesId if possible & verify ownership
    let seriesId = rawSeriesId ?? null;

    if (showId) {
      const { data: showData, error: showError } = await supabaseAdmin
        .from('shows')
        .select('id, organizer_id, series_id')
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

      // populate seriesId from show if not explicitly supplied
      if (!seriesId && show.series_id) {
        seriesId = show.series_id;
      }
    }

    // Check quota for this broadcast type
    const quotaRemaining =
      broadcastType === 'pre_show'
        ? profile.pre_show_broadcasts_remaining
        : profile.post_show_broadcasts_remaining;

    if (quotaRemaining <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `You have no remaining ${broadcastType.replace('_', '-')} broadcasts`,
        }),
        { status: 429, headers },
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
          series_id: seriesId,
          broadcast_type: broadcastType,
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

    // Decrement the appropriate quota field
    const quotaField =
      broadcastType === 'pre_show'
        ? 'pre_show_broadcasts_remaining'
        : 'post_show_broadcasts_remaining';

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ [quotaField]: quotaRemaining - 1 })
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
