-- Create RPC functions for optimized message fetching
-- Migration: 20250711095000_create_messaging_rpc.sql

-- Function to efficiently fetch all conversations for a user
CREATE OR REPLACE FUNCTION get_user_conversations(user_id UUID)
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
      cp.user_id = get_user_conversations.user_id
  ),
  conversation_participants_agg AS (
    -- Get all other participants (excluding the requesting user)
    SELECT 
      cp.conversation_id,
      COUNT(cp.user_id) + 1 AS participant_count, -- +1 to include the requesting user
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'user_id', cp.user_id,
          'display_name', COALESCE(cp.display_name, p.full_name, p.username),
          'photo_url', COALESCE(cp.photo_url, p.avatar_url)
        )
      ) FILTER (WHERE cp.user_id != get_user_conversations.user_id) AS participants_data
    FROM 
      conversation_participants cp
    LEFT JOIN
      profiles p ON cp.user_id = p.id
    GROUP BY 
      cp.conversation_id
  )
  
  SELECT 
    uc.id,
    uc.type,
    uc.show_id,
    COALESCE(cpa.participant_count, 1) AS participant_count,
    uc.last_message_text,
    uc.last_message_timestamp,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(cpa.participants_data, '[]'::JSONB) AS participants
  FROM 
    user_conversations uc
  LEFT JOIN
    conversation_participants_agg cpa ON uc.id = cpa.conversation_id
  ORDER BY 
    uc.last_message_timestamp DESC NULLS LAST;
END;
$$;

-- Function to efficiently fetch all messages for a conversation with sender profiles
CREATE OR REPLACE FUNCTION get_conversation_messages(conversation_id UUID)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  message_text TEXT,
  created_at TIMESTAMPTZ,
  read_by_user_ids UUID[],
  sender_profile JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.conversation_id,
    m.sender_id,
    m.message_text,
    m.created_at,
    m.read_by_user_ids,
    JSONB_BUILD_OBJECT(
      'id', p.id,
      'username', p.username,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url
    ) AS sender_profile
  FROM 
    messages m
  LEFT JOIN
    profiles p ON m.sender_id = p.id
  WHERE 
    m.conversation_id = get_conversation_messages.conversation_id
    AND m.is_deleted = FALSE
  ORDER BY 
    m.created_at ASC;
END;
$$;

-- Grant access to the functions
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO authenticated;

-- Add comment to the functions
COMMENT ON FUNCTION get_user_conversations IS 'Efficiently fetches all conversations for a user with participants and unread counts';
COMMENT ON FUNCTION get_conversation_messages IS 'Efficiently fetches all messages for a conversation with sender profiles';
