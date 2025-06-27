-- messaging_enhancements.sql
-- Enhances the messaging system with one-way announcements, moderation, and location filtering

BEGIN;

-- Step 1: Add new columns to existing tables
-- Add one_way flag to conversations table
ALTER TABLE conversations 
ADD COLUMN one_way BOOLEAN DEFAULT FALSE,
ADD COLUMN location_filter JSONB;

-- Add can_reply flag to conversation_participants table
ALTER TABLE conversation_participants
ADD COLUMN can_reply BOOLEAN DEFAULT TRUE;

-- Add moderation columns to messages table
ALTER TABLE messages
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reported_by UUID[] DEFAULT '{}';

-- Step 2: Create indexes for new columns
CREATE INDEX idx_conversations_one_way ON conversations(one_way) WHERE one_way = TRUE;
CREATE INDEX idx_conversation_participants_can_reply ON conversation_participants(can_reply) WHERE can_reply = FALSE;
CREATE INDEX idx_messages_is_deleted ON messages(is_deleted) WHERE is_deleted = TRUE;
CREATE INDEX idx_messages_reported ON messages USING GIN(reported_by);

-- Step 3: Create functions for message moderation

-- Function to delete a message (soft delete)
CREATE OR REPLACE FUNCTION moderate_delete_message(
  p_message_id UUID,
  p_moderator_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_conversation_id UUID;
  v_moderator_role TEXT;
  v_is_organizer BOOLEAN;
  v_show_id UUID;
BEGIN
  -- Get the conversation ID and check if user has permission
  SELECT 
    m.conversation_id, c.show_id INTO v_conversation_id, v_show_id
  FROM 
    messages m
    JOIN conversations c ON m.conversation_id = c.id
  WHERE 
    m.id = p_message_id;
    
  IF v_conversation_id IS NULL THEN
    RETURN FALSE; -- Message not found
  END IF;
  
  -- Check if moderator is a show organizer (for show conversations)
  SELECT 
    role = 'SHOW_ORGANIZER' INTO v_is_organizer
  FROM 
    profiles
  WHERE 
    id = p_moderator_id;
    
  -- Allow deletion if:
  -- 1. User is a show organizer and this is a show conversation
  -- 2. User is an admin (future expansion)
  IF (v_is_organizer AND v_show_id IS NOT NULL) OR 
     (v_is_organizer AND EXISTS (
       SELECT 1 FROM conversation_participants
       WHERE conversation_id = v_conversation_id AND user_id = p_moderator_id
     )) THEN
    
    -- Perform the soft delete
    UPDATE messages
    SET 
      is_deleted = TRUE,
      deleted_by = p_moderator_id,
      deleted_at = NOW()
    WHERE 
      id = p_message_id;
      
    RETURN TRUE;
  END IF;
  
  RETURN FALSE; -- No permission
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to report a message
CREATE OR REPLACE FUNCTION report_message(
  p_message_id UUID,
  p_reporter_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_already_reported BOOLEAN;
BEGIN
  -- Check if user already reported this message
  SELECT 
    p_reporter_id = ANY(reported_by) INTO v_already_reported
  FROM 
    messages
  WHERE 
    id = p_message_id;
    
  IF v_already_reported THEN
    RETURN FALSE; -- Already reported by this user
  END IF;
  
  -- Add user to reported_by array
  UPDATE messages
  SET reported_by = array_append(reported_by, p_reporter_id)
  WHERE id = p_message_id;
  
  -- Here you could also insert into a separate reports table with the reason
  -- if you want to track report reasons
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to create one-way announcement conversations
CREATE OR REPLACE FUNCTION create_announcement(
  p_creator_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_recipient_roles TEXT[],
  p_show_id UUID DEFAULT NULL,
  p_location_filter JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_creator_role TEXT;
  v_recipient_id UUID;
  v_recipients UUID[];
BEGIN
  -- Check if creator has permission to create announcements
  SELECT role INTO v_creator_role FROM profiles WHERE id = p_creator_id;
  
  IF v_creator_role != 'SHOW_ORGANIZER' AND v_creator_role != 'MVP_DEALER' THEN
    RAISE EXCEPTION 'Only show organizers and MVP dealers can create announcements';
  END IF;
  
  -- Create the conversation as one-way
  INSERT INTO conversations (
    type, 
    show_id, 
    one_way, 
    last_message_text, 
    last_message_timestamp,
    location_filter
  )
  VALUES (
    CASE WHEN p_show_id IS NULL THEN 'group' ELSE 'show' END,
    p_show_id,
    TRUE,
    p_message,
    NOW(),
    p_location_filter
  )
  RETURNING id INTO v_conversation_id;
  
  -- Find all recipients based on roles
  SELECT ARRAY_AGG(id) INTO v_recipients
  FROM profiles
  WHERE role = ANY(p_recipient_roles);
  
  -- Add creator as participant who can reply
  INSERT INTO conversation_participants (
    conversation_id,
    user_id,
    display_name,
    photo_url,
    can_reply
  )
  SELECT
    v_conversation_id,
    p_creator_id,
    full_name,
    avatar_url,
    TRUE
  FROM
    profiles
  WHERE
    id = p_creator_id;
    
  -- Add all recipients as participants who cannot reply
  FOREACH v_recipient_id IN ARRAY v_recipients
  LOOP
    -- Skip if recipient is the creator
    IF v_recipient_id != p_creator_id THEN
      INSERT INTO conversation_participants (
        conversation_id,
        user_id,
        display_name,
        photo_url,
        can_reply,
        unread_count
      )
      SELECT
        v_conversation_id,
        v_recipient_id,
        full_name,
        avatar_url,
        FALSE,
        1  -- Mark as unread for recipient
      FROM
        profiles
      WHERE
        id = v_recipient_id;
    END IF;
  END LOOP;
  
  -- Insert the announcement message
  INSERT INTO messages (
    conversation_id,
    sender_id,
    message_text,
    read_by_user_ids
  )
  VALUES (
    v_conversation_id,
    p_creator_id,
    p_message,
    ARRAY[p_creator_id]::UUID[]
  );
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create function to filter recipients by location
CREATE OR REPLACE FUNCTION find_recipients_by_location(
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_radius_miles INT DEFAULT 50,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  role TEXT,
  distance_miles FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.full_name,
    p.role,
    -- Calculate distance in miles
    ST_DistanceSphere(
      ST_MakePoint(p_longitude, p_latitude),
      ST_MakePoint(CAST(p.location->>'longitude' AS FLOAT), CAST(p.location->>'latitude' AS FLOAT))
    ) / 1609.344 AS distance_miles
  FROM
    profiles p
  WHERE
    p.location IS NOT NULL
    AND (p_roles IS NULL OR p.role = ANY(p_roles))
    -- Filter by distance
    AND ST_DistanceSphere(
      ST_MakePoint(p_longitude, p_latitude),
      ST_MakePoint(CAST(p.location->>'longitude' AS FLOAT), CAST(p.location->>'latitude' AS FLOAT))
    ) / 1609.344 <= p_radius_miles
  ORDER BY
    distance_miles ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update RLS policies to account for new columns

-- Update message policies to handle deleted messages
DROP POLICY IF EXISTS messages_select_policy ON messages;
CREATE POLICY messages_select_policy ON messages
  FOR SELECT
  USING (
    -- User can see message if they are in the conversation
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
    -- And message is not deleted OR user is the one who deleted it
    AND (NOT is_deleted OR deleted_by = auth.uid())
  );

-- Update conversation_participants policies for can_reply
DROP POLICY IF EXISTS conversation_participants_insert_policy ON conversation_participants;
CREATE POLICY conversation_participants_insert_policy ON conversation_participants
  FOR INSERT
  WITH CHECK (
    -- Only allow insert if user is creator or admin
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (
        -- One-way conversations can only be created by show organizers or MVP dealers
        (c.one_way = TRUE AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND (role = 'SHOW_ORGANIZER' OR role = 'MVP_DEALER')
        ))
        OR
        -- Regular conversations can be created by anyone
        (c.one_way = FALSE)
      )
    )
  );

-- Create policy for messages to enforce can_reply restriction
DROP POLICY IF EXISTS messages_insert_policy ON messages;
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
      -- User must have permission to reply
      AND (can_reply = TRUE)
    )
  );

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION moderate_delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION report_message TO authenticated;
GRANT EXECUTE ON FUNCTION create_announcement TO authenticated;
GRANT EXECUTE ON FUNCTION find_recipients_by_location TO authenticated;

COMMIT;
