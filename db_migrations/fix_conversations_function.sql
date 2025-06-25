-- Fix the get_user_conversations function
CREATE OR REPLACE FUNCTION get_user_conversations(user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_messages AS (
    SELECT DISTINCT ON (m.conversation_id) 
      m.conversation_id AS conv_id,
      m.content,
      m.created_at,
      m.sender_id,
      m.recipient_id
    FROM messages m
    WHERE m.sender_id = user_id OR m.recipient_id = user_id
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.conversation_id AS conv_id,
      COUNT(*) as unread
    FROM messages m
    WHERE 
      m.recipient_id = user_id AND 
      m.read_at IS NULL
    GROUP BY m.conversation_id
  )
  SELECT 
    lm.conv_id,
    CASE 
      WHEN lm.sender_id = user_id THEN lm.recipient_id
      ELSE lm.sender_id
    END as other_user_id,
    lm.content as last_message,
    lm.created_at as last_message_time,
    COALESCE(uc.unread, 0) as unread_count
  FROM 
    latest_messages lm
  LEFT JOIN 
    unread_counts uc ON lm.conv_id = uc.conv_id
  ORDER BY 
    lm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
