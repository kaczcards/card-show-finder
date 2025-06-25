-- PART 1: Create the messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMP WITH TIME ZONE -- NULL if unread, timestamp when read
);

-- PART 2: Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

-- PART 3: Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- PART 4: Create simplified RLS policies
-- Users can only view messages they sent or received
CREATE POLICY messages_select_policy ON messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
  );

-- Users can only insert messages where they are the sender
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
  );

-- Only recipients can update messages (for marking as read)
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- PART 5: Create the get_user_conversations function
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
  WITH conversations AS (
    SELECT DISTINCT m.conversation_id
    FROM messages m
    WHERE m.sender_id = user_id OR m.recipient_id = user_id
  ),
  last_messages AS (
    SELECT 
      m.conversation_id,
      CASE 
        WHEN m.sender_id = user_id THEN m.recipient_id
        ELSE m.sender_id
      END as other_user_id,
      m.content as last_message,
      m.created_at as last_message_time,
      COUNT(*) FILTER (WHERE m.recipient_id = user_id AND m.read_at IS NULL) as unread_count
    FROM messages m
    JOIN (
      SELECT 
        conversation_id,
        MAX(created_at) as max_created_at
      FROM messages
      GROUP BY conversation_id
    ) latest ON m.conversation_id = latest.conversation_id AND m.created_at = latest.max_created_at
    WHERE m.conversation_id IN (SELECT conversation_id FROM conversations)
    GROUP BY m.conversation_id, other_user_id, m.content, m.created_at
  )
  SELECT * FROM last_messages
  ORDER BY last_message_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 6: Set proper permissions
-- Grant basic permissions
GRANT SELECT, INSERT ON messages TO authenticated;
-- Restrict updates to the read_at column only
REVOKE UPDATE ON messages FROM authenticated;
GRANT UPDATE (read_at) ON messages TO authenticated;
-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_user_conversations TO authenticated;

-- PART 7: Add table and column comments
COMMENT ON TABLE messages IS 'Stores messages between users';
COMMENT ON COLUMN messages.id IS 'Unique identifier for each message';
COMMENT ON COLUMN messages.conversation_id IS 'Groups messages into conversations between users';
COMMENT ON COLUMN messages.sender_id IS 'User ID of the message sender';
COMMENT ON COLUMN messages.recipient_id IS 'User ID of the message recipient';
COMMENT ON COLUMN messages.content IS 'Text content of the message';
COMMENT ON COLUMN messages.created_at IS 'Timestamp when the message was created';
COMMENT ON COLUMN messages.read_at IS 'Timestamp when the message was read (null if unread)';
