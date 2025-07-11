-- Create RPC function for optimized message fetching
-- Migration: 20250711120000_create_message_rpc.sql

-- Function to efficiently fetch all messages for a conversation with sender profiles
DROP FUNCTION IF EXISTS get_conversation_messages(uuid);

/*
 * NOTE
 * ----
 * We deliberately use a parameter name (input_convo_id) that CANNOT conflict
 * with any column we expose via RETURNS TABLE.  No aliases inside the SELECT
 * reuse the parameter name either.
 */
CREATE OR REPLACE FUNCTION get_conversation_messages(input_convo_id UUID)
RETURNS TABLE (
  message_id          UUID,
  conversation_id     UUID,
  sender_id           UUID,
  message_text        TEXT,
  created_at          TIMESTAMPTZ,
  read_by_user_ids    UUID[],
  sender_profile      JSONB
)  LANGUAGE plpgsql
   SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id                          AS message_id,
    m.conversation_id             AS conversation_id,
    m.sender_id                   AS sender_id,
    m.message_text,
    m.created_at,
    m.read_by_user_ids,
    JSONB_BUILD_OBJECT(
      'id',         p.id,
      'username',   p.username,
      'full_name',  p.full_name,
      'avatar_url', p.avatar_url
    )                              AS sender_profile
  FROM messages  m
  LEFT JOIN profiles p
         ON p.id = m.sender_id
  WHERE m.conversation_id = input_convo_id
    AND m.is_deleted      = FALSE
  ORDER BY m.created_at ASC;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO authenticated;

-- Add comment to the function
COMMENT ON FUNCTION get_conversation_messages IS 'Efficiently fetches all messages for a conversation with sender profiles';
