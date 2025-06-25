-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMP WITH TIME ZONE -- NULL if unread, timestamp when read
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only view messages they sent or received
CREATE POLICY messages_select_policy ON messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can only insert messages where they are the sender
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only recipients can update messages (for marking as read)
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE
  USING (auth.uid() = recipient_id);

-- Set permissions
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT UPDATE (read_at) ON messages TO authenticated;

-- Create the get_user_conversations function
CREATE OR REPLACE FUNCTION get_user_conversations(user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT
) AS $$
DECLARE
BEGIN
  RETURN QUERY
  WITH latest_messages AS (
    SELECT DISTINCT ON (m.conversation_id) 
      m.conversation_id,
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
      m.conversation_id,
      COUNT(*) as unread
    FROM messages m
    WHERE 
      m.recipient_id = user_id AND 
      m.read_at IS NULL
    GROUP BY m.conversation_id
  )
  SELECT 
    lm.conversation_id,
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
    unread_counts uc ON lm.conversation_id = uc.conversation_id
  ORDER BY 
    lm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_user_conversations TO authenticated;
