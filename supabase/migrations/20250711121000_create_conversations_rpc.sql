-- Create RPC function for optimized conversation fetching
-- Migration: 20250711121000_create_conversations_rpc.sql

-- Function to efficiently fetch all conversations for a user
DROP FUNCTION IF EXISTS get_user_conversations(uuid);

CREATE OR REPLACE FUNCTION get_user_conversations(input_user_id UUID)
RETURNS TABLE (
  id UUID,
  type TEXT,
  show_id UUID,
  participant_count INTEGER,
  last_message_text TEXT,
  last_message_timestamp TIMESTAMPTZ,
  unread_count INTEGER,
  participants JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    -- Get all conversations the user is part of
    SELECT 
      c.id,
      c.type,
      c.show_id,
      c.last_message_text,
      c.last_message_timestamp,
      cp.unread_count
    FROM 
      conversations c
    JOIN 
      conversation_participants cp ON c.id = cp.conversation_id
    WHERE 
      cp.user_id = input_user_id
  ),
  participants_data AS (
    -- Get all other participants (excluding the requesting user)
    SELECT 
      conv_part.conversation_id,
      COUNT(conv_part.user_id) + 1 AS participant_count, -- +1 to include the requesting user
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'user_id', conv_part.user_id,
          'display_name', COALESCE(conv_part.display_name, prof.full_name, prof.username),
          'photo_url', COALESCE(conv_part.photo_url, prof.avatar_url)
        )
      ) FILTER (WHERE conv_part.user_id != input_user_id) AS participants_json
    FROM 
      conversation_participants conv_part
    LEFT JOIN
      profiles prof ON conv_part.user_id = prof.id
    GROUP BY 
      conv_part.conversation_id
  )
  
  SELECT 
    uc.id,
    uc.type,
    uc.show_id,
    COALESCE(pd.participant_count, 1) AS participant_count,
    uc.last_message_text,
    uc.last_message_timestamp,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(pd.participants_json, '[]'::JSONB) AS participants
  FROM 
    user_conversations uc
  LEFT JOIN
    participants_data pd ON uc.id = pd.conversation_id
  ORDER BY 
    uc.last_message_timestamp DESC NULLS LAST;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO authenticated;

-- Add comment to the function
COMMENT ON FUNCTION get_user_conversations IS 'Efficiently fetches all conversations for a user with participants and unread counts';
