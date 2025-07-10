-- Production Messaging System Migration
-- This migration script implements the full production messaging system with:
-- 1. Role-based permissions for messaging
-- 2. Broadcast quotas for organizers
-- 3. Moderation capabilities
-- 4. Enhanced RLS policies

-- Start transaction to ensure all changes are atomic
BEGIN;

-- =======================================================
-- 0. Base Messaging Tables (safety-net)
-- -------------------------------------------------------
-- If this project was created from an earlier snapshot that
-- did **not** include the core messaging schema, the following
-- statements will generate minimal versions of the required
-- tables so that the rest of this migration can run without
-- errors.  When the tables already exist these statements are
-- harmless no-ops.
-- =======================================================

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'show')),
  show_id UUID REFERENCES shows(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_message_text TEXT,
  last_message_timestamp TIMESTAMPTZ
);

-- conversation_participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id)     ON DELETE CASCADE,
  display_name    TEXT,
  photo_url       TEXT,
  unread_count    INTEGER DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES auth.users(id),
  message_text     TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  read_by_user_ids UUID[] DEFAULT '{}'::UUID[]
);

-- =======================================================
-- 1. Schema Enhancements
-- =======================================================

-- 1.1 Add moderation columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
ADD COLUMN IF NOT EXISTS is_one_way BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_context UUID REFERENCES shows(id);

-- 1.2 Create broadcast_quotas table to track message limits per organizer/show
CREATE TABLE IF NOT EXISTS broadcast_quotas (
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  pre_show_remaining SMALLINT DEFAULT 2,
  post_show_remaining SMALLINT DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (organizer_id, show_id)
);

-- 1.3 Create reported_messages table for moderation
CREATE TABLE IF NOT EXISTS reported_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  report_reason TEXT NOT NULL,
  report_status TEXT DEFAULT 'pending' CHECK (report_status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  admin_notes TEXT
);

-- 1.4 Add additional columns to conversation_participants for role-based controls
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS can_reply BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS role_when_added TEXT;

-- =======================================================
-- 2. Helper Functions
-- =======================================================

-- 2.1 Function to check if a user can send a direct message based on roles
CREATE OR REPLACE FUNCTION can_user_send_dm(
  p_sender_id UUID, 
  p_recipient_id UUID, 
  p_show_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_sender_role TEXT;
  v_recipient_role TEXT;
  v_share_show BOOLEAN := FALSE;
BEGIN
  -- Get sender and recipient roles
  SELECT role INTO v_sender_role FROM profiles WHERE id = p_sender_id;
  SELECT role INTO v_recipient_role FROM profiles WHERE id = p_recipient_id;
  
  -- Convert roles to lowercase for consistency
  v_sender_role := LOWER(v_sender_role);
  v_recipient_role := LOWER(v_recipient_role);
  
  -- Check if sender and recipient share a show (if show_id provided)
  IF p_show_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM show_participants sp1
      JOIN show_participants sp2 ON sp1.showid = sp2.showid
      WHERE sp1.userid = p_sender_id AND sp2.userid = p_recipient_id AND sp1.showid = p_show_id
    ) INTO v_share_show;
  END IF;
  
  -- Apply role-based permission matrix
  
  -- ATTENDEE can message MVP_DEALER
  IF v_sender_role = 'attendee' AND v_recipient_role = 'mvp_dealer' THEN
    RETURN TRUE;
  END IF;
  
  -- MVP_DEALER can message ATTENDEE or DEALER if they share a show
  IF v_sender_role = 'mvp_dealer' AND (v_recipient_role = 'attendee' OR v_recipient_role = 'dealer') THEN
    IF p_show_id IS NULL OR v_share_show THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- MVP_DEALER can message SHOW_ORGANIZER
  IF v_sender_role = 'mvp_dealer' AND v_recipient_role = 'show_organizer' THEN
    RETURN TRUE;
  END IF;
  
  -- SHOW_ORGANIZER can message anyone
  IF v_sender_role = 'show_organizer' THEN
    RETURN TRUE;
  END IF;
  
  -- Default: deny permission
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2.2 Function to check if a user can reply to a message
CREATE OR REPLACE FUNCTION can_user_reply(
  p_user_id UUID,
  p_conversation_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
  v_is_participant BOOLEAN;
  v_can_reply BOOLEAN;
  v_is_one_way BOOLEAN;
BEGIN
  -- Get user role
  SELECT LOWER(role) INTO v_user_role FROM profiles WHERE id = p_user_id;
  
  -- Check if user is a participant and can reply
  SELECT 
    EXISTS(SELECT 1 FROM conversation_participants WHERE user_id = p_user_id AND conversation_id = p_conversation_id),
    cp.can_reply
  INTO 
    v_is_participant, 
    v_can_reply
  FROM conversation_participants cp
  WHERE cp.user_id = p_user_id AND cp.conversation_id = p_conversation_id;
  
  -- Check if conversation is one-way
  SELECT EXISTS(
    SELECT 1 FROM conversations 
    WHERE id = p_conversation_id AND type = 'show'
  ) INTO v_is_one_way;
  
  -- DEALER cannot reply to any messages
  IF v_user_role = 'dealer' THEN
    RETURN FALSE;
  END IF;
  
  -- No one can reply to one-way broadcasts (unless they're the sender)
  IF v_is_one_way AND NOT EXISTS(
    SELECT 1 FROM messages 
    WHERE conversation_id = p_conversation_id 
    AND sender_id = p_user_id 
    LIMIT 1
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- User must be a participant and have reply permission
  RETURN v_is_participant AND v_can_reply;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2.3 Function to check broadcast quota and decrement if available
CREATE OR REPLACE FUNCTION check_and_use_broadcast_quota(
  p_organizer_id UUID,
  p_show_id UUID,
  p_is_pre_show BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE
  v_quota_record RECORD;
  v_show_record RECORD;
  v_is_pre_show BOOLEAN;
  v_quota_remaining INTEGER;
BEGIN
  -- Get show information to determine if it's pre or post show
  SELECT * INTO v_show_record FROM shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RETURN FALSE; -- Show not found
  END IF;
  
  -- Determine if we're pre-show or post-show based on current date vs. show date
  IF p_is_pre_show IS NULL THEN
    v_is_pre_show := CURRENT_TIMESTAMP < v_show_record.start_date;
  ELSE
    v_is_pre_show := p_is_pre_show;
  END IF;
  
  -- Get current quota record, creating if it doesn't exist
  INSERT INTO broadcast_quotas (organizer_id, show_id)
  VALUES (p_organizer_id, p_show_id)
  ON CONFLICT (organizer_id, show_id) DO NOTHING;
  
  SELECT * INTO v_quota_record 
  FROM broadcast_quotas
  WHERE organizer_id = p_organizer_id AND show_id = p_show_id;
  
  -- Check appropriate quota
  IF v_is_pre_show THEN
    v_quota_remaining := v_quota_record.pre_show_remaining;
  ELSE
    v_quota_remaining := v_quota_record.post_show_remaining;
  END IF;
  
  -- If no quota remaining, return false
  IF v_quota_remaining <= 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Decrement the appropriate quota
  IF v_is_pre_show THEN
    UPDATE broadcast_quotas
    SET pre_show_remaining = pre_show_remaining - 1,
        last_updated = now()
    WHERE organizer_id = p_organizer_id AND show_id = p_show_id;
  ELSE
    UPDATE broadcast_quotas
    SET post_show_remaining = post_show_remaining - 1,
        last_updated = now()
    WHERE organizer_id = p_organizer_id AND show_id = p_show_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.4 Function to create a broadcast message
CREATE OR REPLACE FUNCTION create_broadcast_message(
  p_sender_id UUID,
  p_show_id UUID,
  p_message_text TEXT,
  p_recipient_roles TEXT[],
  p_is_pre_show BOOLEAN DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_sender_role TEXT;
  v_can_broadcast BOOLEAN;
  v_quota_available BOOLEAN;
  v_recipient_ids UUID[];
BEGIN
  -- Validate sender role
  SELECT LOWER(role) INTO v_sender_role FROM profiles WHERE id = p_sender_id;
  
  -- Only SHOW_ORGANIZER and MVP_DEALER can broadcast
  IF v_sender_role NOT IN ('show_organizer', 'mvp_dealer') THEN
    RAISE EXCEPTION 'User does not have permission to broadcast messages';
  END IF;
  
  -- For show organizers, check and use quota
  IF v_sender_role = 'show_organizer' THEN
    SELECT check_and_use_broadcast_quota(p_sender_id, p_show_id, p_is_pre_show) INTO v_quota_available;
    
    IF NOT v_quota_available THEN
      RAISE EXCEPTION 'Broadcast quota exceeded for this show';
    END IF;
  END IF;
  
  -- For MVP dealers, ensure they're registered for this show
  IF v_sender_role = 'mvp_dealer' THEN
    IF NOT EXISTS(SELECT 1 FROM show_participants WHERE userid = p_sender_id AND showid = p_show_id) THEN
      RAISE EXCEPTION 'MVP Dealer must be registered for the show to broadcast';
    END IF;
    
    -- MVP dealers can only broadcast to attendees
    IF NOT (p_recipient_roles <@ ARRAY['attendee']::TEXT[]) THEN
      RAISE EXCEPTION 'MVP Dealers can only broadcast to attendees';
    END IF;
  END IF;
  
  -- Find recipients based on roles
  SELECT ARRAY_AGG(DISTINCT p.id) INTO v_recipient_ids
  FROM profiles p
  WHERE LOWER(p.role) = ANY(p_recipient_roles)
  AND p.id != p_sender_id
  AND (
    -- For show-specific broadcasts, include only users participating in the show
    p_show_id IS NULL OR EXISTS(
      SELECT 1 FROM show_participants sp
      WHERE sp.userid = p.id AND sp.showid = p_show_id
    )
  );
  
  -- Create conversation
  INSERT INTO conversations (type, show_id, last_message_text, last_message_timestamp)
  VALUES ('show', p_show_id, p_message_text, now())
  RETURNING id INTO v_conversation_id;
  
  -- Add sender as participant
  INSERT INTO conversation_participants (
    conversation_id, 
    user_id, 
    display_name,
    photo_url,
    role_when_added,
    can_reply
  )
  SELECT 
    v_conversation_id,
    p_sender_id,
    p.first_name || ' ' || COALESCE(p.last_name, ''),
    p.profile_image_url,
    p.role,
    TRUE
  FROM profiles p
  WHERE p.id = p_sender_id;
  
  -- Add recipients as participants
  INSERT INTO conversation_participants (
    conversation_id, 
    user_id, 
    display_name,
    photo_url,
    unread_count,
    role_when_added,
    can_reply
  )
  SELECT 
    v_conversation_id,
    p.id,
    p.first_name || ' ' || COALESCE(p.last_name, ''),
    p.profile_image_url,
    1,  -- Start with 1 unread message
    p.role,
    FALSE  -- Recipients can't reply to broadcasts
  FROM profiles p
  WHERE p.id = ANY(v_recipient_ids);
  
  -- Insert the broadcast message
  INSERT INTO messages (
    conversation_id,
    sender_id,
    message_text,
    read_by_user_ids,
    is_broadcast,
    show_context,
    is_one_way
  )
  VALUES (
    v_conversation_id,
    p_sender_id,
    p_message_text,
    ARRAY[p_sender_id]::UUID[],  -- Sender has read their own message
    TRUE,
    p_show_id,
    TRUE
  );
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.5 Function to moderate (soft delete) a message
CREATE OR REPLACE FUNCTION moderate_delete_message(
  p_message_id UUID,
  p_moderator_id UUID,
  p_reason TEXT DEFAULT 'Content violation'
) RETURNS BOOLEAN AS $$
DECLARE
  v_moderator_role TEXT;
  v_message_sender_id UUID;
  v_conversation_id UUID;
BEGIN
  -- Check if moderator has permission
  SELECT LOWER(role) INTO v_moderator_role FROM profiles WHERE id = p_moderator_id;
  
  IF v_moderator_role NOT IN ('show_organizer', 'admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Get message details
  SELECT sender_id, conversation_id INTO v_message_sender_id, v_conversation_id
  FROM messages
  WHERE id = p_message_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Show organizers can only moderate messages in their own shows
  IF v_moderator_role = 'show_organizer' AND NOT EXISTS(
    SELECT 1 
    FROM conversations c
    JOIN shows s ON c.show_id = s.id
    WHERE c.id = v_conversation_id AND s.organizer_id = p_moderator_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Perform soft delete
  UPDATE messages
  SET 
    is_deleted = TRUE,
    deleted_by = p_moderator_id,
    deleted_at = now(),
    deletion_reason = p_reason
  WHERE id = p_message_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.6 Function to report a message
CREATE OR REPLACE FUNCTION report_message(
  p_message_id UUID,
  p_reporter_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Ensure message exists
  IF NOT EXISTS(SELECT 1 FROM messages WHERE id = p_message_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure reporter is a participant in the conversation
  IF NOT EXISTS(
    SELECT 1 
    FROM messages m
    JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
    WHERE m.id = p_message_id AND cp.user_id = p_reporter_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Create report
  INSERT INTO reported_messages (
    message_id,
    reported_by,
    report_reason
  )
  VALUES (
    p_message_id,
    p_reporter_id,
    p_reason
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.7 Function to increment unread count
CREATE OR REPLACE FUNCTION increment_unread() 
RETURNS INTEGER AS $$
BEGIN
  RETURN LEAST(COALESCE(NEW.unread_count, 0) + 1, 999);  -- Cap at 999
END;
$$ LANGUAGE plpgsql;

-- 2.8 Function to decrement unread count
CREATE OR REPLACE FUNCTION decrement_unread() 
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(COALESCE(NEW.unread_count, 0) - 1, 0);  -- Minimum 0
END;
$$ LANGUAGE plpgsql;

-- =======================================================
-- 3. Triggers
-- =======================================================

-- 3.1 Trigger to update conversation metadata when a message is sent
CREATE OR REPLACE FUNCTION messages_update_conversation_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation's last message info
  UPDATE conversations
  SET 
    last_message_text = NEW.message_text,
    last_message_timestamp = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  -- Increment unread count for all participants except sender
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE 
    conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND unread_count < 999;  -- Cap at 999
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'messages_after_insert_trigger'
  ) THEN
    CREATE TRIGGER messages_after_insert_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION messages_update_conversation_trigger();
  END IF;
END
$$;

-- 3.2 Trigger to maintain role_when_added in conversation_participants
CREATE OR REPLACE FUNCTION set_role_when_added_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_when_added IS NULL THEN
    SELECT role INTO NEW.role_when_added 
    FROM profiles 
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_role_when_added_trigger'
  ) THEN
    CREATE TRIGGER set_role_when_added_trigger
    BEFORE INSERT ON conversation_participants
    FOR EACH ROW
    EXECUTE FUNCTION set_role_when_added_trigger();
  END IF;
END
$$;

-- =======================================================
-- 4. Views
-- =======================================================

-- 4.1 View for role capabilities matrix
CREATE OR REPLACE VIEW role_capabilities_v AS
SELECT
  role,
  role = 'attendee' AS can_dm_attendee,
  role IN ('attendee', 'mvp_dealer', 'show_organizer') AS can_dm_mvp_dealer,
  role IN ('mvp_dealer', 'show_organizer') AS can_dm_dealer,
  role IN ('mvp_dealer', 'show_organizer') AS can_dm_show_organizer,
  role IN ('attendee', 'mvp_dealer', 'show_organizer') AS can_reply_to_dm,
  role IN ('mvp_dealer', 'show_organizer') AS can_broadcast,
  role = 'show_organizer' AS has_broadcast_quota,
  role IN ('show_organizer', 'admin') AS can_moderate
FROM (
  SELECT unnest(ARRAY['attendee', 'dealer', 'mvp_dealer', 'show_organizer', 'admin']) AS role
) roles;

-- =======================================================
-- 5. RLS Policies
-- =======================================================

-- Enable RLS on new tables
ALTER TABLE broadcast_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_messages ENABLE ROW LEVEL SECURITY;

-- 5.1 Broadcast quotas policies
CREATE POLICY broadcast_quotas_select ON broadcast_quotas
  FOR SELECT USING (
    organizer_id = auth.uid() OR
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY broadcast_quotas_insert ON broadcast_quotas
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid() AND
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND LOWER(role) = 'show_organizer')
  );

CREATE POLICY broadcast_quotas_update ON broadcast_quotas
  FOR UPDATE USING (
    -- Only the function can update quotas
    FALSE
  );

-- 5.2 Reported messages policies
CREATE POLICY reported_messages_select ON reported_messages
  FOR SELECT USING (
    reported_by = auth.uid() OR
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND LOWER(role) IN ('show_organizer', 'admin'))
  );

CREATE POLICY reported_messages_insert ON reported_messages
  FOR INSERT WITH CHECK (
    reported_by = auth.uid()
  );

CREATE POLICY reported_messages_update ON reported_messages
  FOR UPDATE USING (
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND LOWER(role) IN ('show_organizer', 'admin'))
  );

-- 5.3 Messages policies - update to include soft delete check
DROP POLICY IF EXISTS messages_select_policy ON messages;
CREATE POLICY messages_select_policy ON messages
  FOR SELECT USING (
    -- User can see messages in conversations they're part of
    -- that haven't been deleted (or they're an admin or the deleter)
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    ) AND (
      NOT is_deleted OR 
      deleted_by = auth.uid() OR
      EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND LOWER(role) = 'admin')
    )
  );

DROP POLICY IF EXISTS messages_insert_policy ON messages;
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT WITH CHECK (
    -- Sender must be the authenticated user
    sender_id = auth.uid() AND
    
    -- User must be a participant in the conversation
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    ) AND
    
    -- User must have permission to reply based on role
    (
      NOT EXISTS (
        -- Check if there are any messages in this conversation
        SELECT 1 FROM messages m WHERE m.conversation_id = conversation_id
      ) OR
      can_user_reply(auth.uid(), conversation_id)
    )
  );

-- 5.4 Update conversation_participants policies for role-based access
DROP POLICY IF EXISTS conversation_participants_update_policy ON conversation_participants;
CREATE POLICY conversation_participants_update_policy ON conversation_participants
  FOR UPDATE USING (
    -- Users can only update their own participant records
    user_id = auth.uid()
  ) WITH CHECK (
    -- Users can only update their own participant records
    -- and cannot change certain fields
    user_id = auth.uid() AND
    NEW.can_reply = OLD.can_reply
  );

-- =======================================================
-- 6. Seed Initial Data
-- =======================================================

-- 6.1 Initialize broadcast quotas for existing show organizers
INSERT INTO broadcast_quotas (organizer_id, show_id)
SELECT DISTINCT s.organizer_id, s.id
FROM shows s
WHERE s.organizer_id IS NOT NULL
ON CONFLICT (organizer_id, show_id) DO NOTHING;

-- =======================================================
-- 7. Grants
-- =======================================================

-- Grant appropriate permissions to authenticated users
GRANT SELECT, INSERT ON broadcast_quotas TO authenticated;
GRANT SELECT, INSERT ON reported_messages TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_send_dm TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_reply TO authenticated;
GRANT EXECUTE ON FUNCTION create_broadcast_message TO authenticated;
GRANT EXECUTE ON FUNCTION moderate_delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION report_message TO authenticated;
GRANT EXECUTE ON FUNCTION increment_unread TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_unread TO authenticated;

COMMIT;
