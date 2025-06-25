-- STEP 1: Create new tables for enhanced messaging system
BEGIN;

-- Create conversation types enum
CREATE TYPE conversation_type AS ENUM ('direct', 'group', 'show');

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type NOT NULL DEFAULT 'direct',
  show_id UUID NULL REFERENCES shows(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  last_message_text TEXT,
  last_message_timestamp TIMESTAMP WITH TIME ZONE
);

-- Create conversation participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  photo_url TEXT,
  unread_count INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (conversation_id, user_id)
);

-- STEP 2: Migrate data from existing messages table to new structure
-- This keeps all existing messages while setting up the new structure

-- 2.1: Create conversations from existing messages
INSERT INTO conversations (id, type, created_at, last_message_text, last_message_timestamp)
SELECT 
  DISTINCT conversation_id,
  'direct'::conversation_type,
  MIN(created_at) as created_at,
  (
    SELECT content 
    FROM messages m2 
    WHERE m2.conversation_id = m1.conversation_id 
    ORDER BY created_at DESC 
    LIMIT 1
  ) as last_message_text,
  (
    SELECT created_at 
    FROM messages m3 
    WHERE m3.conversation_id = m1.conversation_id 
    ORDER BY created_at DESC 
    LIMIT 1
  ) as last_message_timestamp
FROM 
  messages m1
GROUP BY 
  conversation_id;

-- 2.2: Create conversation participants from existing messages
WITH distinct_participants AS (
  SELECT DISTINCT 
    conversation_id,
    user_id
  FROM (
    -- Get all senders
    SELECT 
      conversation_id,
      sender_id as user_id
    FROM 
      messages
    -- Union with all recipients
    UNION
    SELECT 
      conversation_id,
      recipient_id as user_id
    FROM 
      messages
  ) AS all_participants
)
INSERT INTO conversation_participants (conversation_id, user_id, unread_count)
SELECT 
  dp.conversation_id,
  dp.user_id,
  COALESCE((
    SELECT COUNT(*)
    FROM messages m
    WHERE 
      m.conversation_id = dp.conversation_id AND
      m.recipient_id = dp.user_id AND
      m.read_at IS NULL
  ), 0) as unread_count
FROM 
  distinct_participants dp;

-- 2.3: Update participant display names and photos from profiles if available
UPDATE conversation_participants cp
SET
  display_name = p.full_name,
  photo_url = p.avatar_url
FROM
  profiles p
WHERE
  cp.user_id = p.id AND
  p.full_name IS NOT NULL;

-- STEP 3: Create new messages table with read_by_user_ids
CREATE TABLE new_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  read_by_user_ids UUID[] DEFAULT '{}'::UUID[]
);

-- 3.1: Migrate data from old messages table to new structure
INSERT INTO new_messages (id, conversation_id, sender_id, message_text, created_at, read_by_user_ids)
SELECT
  m.id,
  m.conversation_id,
  m.sender_id,
  m.content,
  m.created_at,
  CASE 
    WHEN m.read_at IS NULL THEN '{}'::UUID[]
    ELSE ARRAY[m.recipient_id]::UUID[]
  END as read_by_user_ids
FROM
  messages m;

-- STEP 4: Set up indexes and permissions for new tables
CREATE INDEX idx_conversations_show_id ON conversations(show_id) WHERE show_id IS NOT NULL;
CREATE INDEX idx_conversations_last_timestamp ON conversations(last_message_timestamp);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation_id ON new_messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON new_messages(sender_id);
CREATE INDEX idx_messages_created_at ON new_messages(created_at);

-- STEP 5: Set up RLS policies for the new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE new_messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY conversations_select_policy ON conversations
  FOR SELECT
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY conversations_insert_policy ON conversations
  FOR INSERT
  WITH CHECK (true);  -- Allow creating conversations, participant check is handled separately

-- Conversation participants policies
CREATE POLICY conversation_participants_select_policy ON conversation_participants
  FOR SELECT
  USING (user_id = auth.uid() OR 
         conversation_id IN (
           SELECT conversation_id 
           FROM conversation_participants 
           WHERE user_id = auth.uid()
         ));

CREATE POLICY conversation_participants_insert_policy ON conversation_participants
  FOR INSERT
  WITH CHECK (true);  -- Allow adding participants, business rules handled in app logic

CREATE POLICY conversation_participants_update_policy ON conversation_participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages policies
CREATE POLICY messages_select_policy ON new_messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY messages_insert_policy ON new_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY messages_update_policy ON new_messages
  FOR UPDATE
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- STEP 6: Create function to get user conversations
CREATE OR REPLACE FUNCTION get_user_conversations(user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  conversation_type conversation_type,
  show_id UUID,
  participant_count INTEGER,
  last_message_text TEXT,
  last_message_timestamp TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER,
  participants JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.type,
    c.show_id,
    (SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = c.id) AS participant_count,
    c.last_message_text,
    c.last_message_timestamp,
    COALESCE(cp_user.unread_count, 0) AS unread_count,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', cp.user_id,
        'display_name', cp.display_name,
        'photo_url', cp.photo_url
      ))
      FROM conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id != user_id
      LIMIT 10 -- Limit to avoid performance issues with very large groups
    ) AS participants
  FROM 
    conversations c
  JOIN 
    conversation_participants cp_user ON c.id = cp_user.conversation_id AND cp_user.user_id = user_id
  ORDER BY 
    c.last_message_timestamp DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 7: Create function to mark messages as read
CREATE OR REPLACE FUNCTION mark_message_as_read(p_message_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_conversation_id UUID;
  v_messages_read INTEGER := 0;
BEGIN
  -- Get the conversation ID for the message
  SELECT conversation_id INTO v_conversation_id 
  FROM new_messages
  WHERE id = p_message_id;
  
  -- Mark the specific message as read if not already
  UPDATE new_messages
  SET read_by_user_ids = array_append(read_by_user_ids, p_user_id)
  WHERE 
    id = p_message_id AND
    NOT (p_user_id = ANY(read_by_user_ids));
    
  GET DIAGNOSTICS v_messages_read = ROW_COUNT;
  
  -- Update the unread count for this user in this conversation
  IF v_messages_read > 0 AND v_conversation_id IS NOT NULL THEN
    UPDATE conversation_participants
    SET unread_count = GREATEST(0, unread_count - v_messages_read)
    WHERE 
      conversation_id = v_conversation_id AND
      user_id = p_user_id;
  END IF;
  
  RETURN v_messages_read > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 8: Create function to mark all conversation messages as read
CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_conversation_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_messages_read INTEGER := 0;
  v_unread_count INTEGER := 0;
BEGIN
  -- Count how many unread messages we have
  SELECT COUNT(*) INTO v_unread_count
  FROM new_messages
  WHERE 
    conversation_id = p_conversation_id AND
    NOT (p_user_id = ANY(read_by_user_ids));
  
  -- Mark all messages in the conversation as read for this user
  UPDATE new_messages
  SET read_by_user_ids = array_append(read_by_user_ids, p_user_id)
  WHERE 
    conversation_id = p_conversation_id AND
    NOT (p_user_id = ANY(read_by_user_ids));
  
  GET DIAGNOSTICS v_messages_read = ROW_COUNT;
  
  -- Update the unread count for this user in this conversation
  IF v_messages_read > 0 THEN
    UPDATE conversation_participants
    SET unread_count = 0
    WHERE 
      conversation_id = p_conversation_id AND
      user_id = p_user_id;
  END IF;
  
  RETURN v_messages_read;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 9: Create function to create a new conversation
CREATE OR REPLACE FUNCTION create_conversation(
  p_type conversation_type,
  p_show_id UUID,
  p_user_ids UUID[],
  p_message_text TEXT
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
BEGIN
  -- Create the conversation
  INSERT INTO conversations (type, show_id, last_message_text, last_message_timestamp)
  VALUES (p_type, p_show_id, p_message_text, now())
  RETURNING id INTO v_conversation_id;
  
  -- Add all participants
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_user_id);
  END LOOP;
  
  -- Insert the first message
  INSERT INTO new_messages (conversation_id, sender_id, message_text)
  VALUES (v_conversation_id, auth.uid(), p_message_text);
  
  -- Update unread counts for all participants except sender
  UPDATE conversation_participants
  SET unread_count = 1
  WHERE 
    conversation_id = v_conversation_id AND
    user_id != auth.uid();
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 10: Rename tables to complete the migration
ALTER TABLE messages RENAME TO messages_old;
ALTER TABLE new_messages RENAME TO messages;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_conversation_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION create_conversation TO authenticated;

COMMIT;
