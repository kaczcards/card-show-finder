-- Add role check function to determine if a user can receive messages
CREATE OR REPLACE FUNCTION can_receive_messages(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only MVP_DEALER and SHOW_ORGANIZER can receive messages
  RETURN user_role IN ('MVP_DEALER', 'SHOW_ORGANIZER');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use this in a trigger if desired
CREATE OR REPLACE FUNCTION check_message_permissions()
RETURNS TRIGGER AS $$
DECLARE
  recipient_role TEXT;
BEGIN
  -- Skip check for self-messages
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;
  
  -- Get recipient role
  SELECT role INTO recipient_role FROM profiles WHERE id = NEW.recipient_id;
  
  -- Check if recipient can receive messages
  IF NOT can_receive_messages(recipient_role) THEN
    RAISE EXCEPTION 'Recipient with role % cannot receive messages', recipient_role;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
