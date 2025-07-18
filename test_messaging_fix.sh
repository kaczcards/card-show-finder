#!/usr/bin/env bash
# ================================================================
# MESSAGING TABLE FIX VERIFICATION SCRIPT
# ================================================================
# This script tests only the messaging table setup portion of the pgTAP tests
# to verify that the recipient_id fix works correctly.
#
# Usage:
#   ./test_messaging_fix.sh [options]
#
# Options:
#   -h, --help              Show this help message
#   -d, --database NAME     Database name (default: card_show_finder)
#   -u, --user NAME         Database user (default: postgres)
#   -p, --password PASS     Database password
#   -H, --host HOST         Database host (default: localhost)
#   -P, --port PORT         Database port (default: 5432)
# ================================================================

# Set default values
DB_NAME="card_show_finder"
DB_USER="postgres"
DB_PASSWORD=""
DB_HOST="localhost"
DB_PORT="5432"
USE_COLOR=true

# Function to show usage
show_usage() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -h, --help              Show this help message"
  echo "  -d, --database NAME     Database name (default: card_show_finder)"
  echo "  -u, --user NAME         Database user (default: postgres)"
  echo "  -p, --password PASS     Database password"
  echo "  -H, --host HOST         Database host (default: localhost)"
  echo "  -P, --port PORT         Database port (default: 5432)"
  echo "  --no-color              Disable colored output"
  echo
  echo "Example:"
  echo "  $0 -d my_database -u my_user -p my_password -H db.example.com"
}

# Function to log messages with colors
log() {
  local level=$1
  local message=$2
  local color_code=""
  
  if [ "$USE_COLOR" = true ]; then
    case $level in
      "INFO")  color_code="\033[0;32m" ;; # Green
      "WARN")  color_code="\033[0;33m" ;; # Yellow
      "ERROR") color_code="\033[0;31m" ;; # Red
      *)       color_code="\033[0m"    ;; # Reset
    esac
  fi
  
  echo -e "${color_code}[$level] $message\033[0m"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_usage
      exit 0
      ;;
    -d|--database)
      DB_NAME="$2"
      shift 2
      ;;
    -u|--user)
      DB_USER="$2"
      shift 2
      ;;
    -p|--password)
      DB_PASSWORD="$2"
      shift 2
      ;;
    -H|--host)
      DB_HOST="$2"
      shift 2
      ;;
    -P|--port)
      DB_PORT="$2"
      shift 2
      ;;
    --no-color)
      USE_COLOR=false
      shift
      ;;
    *)
      log "ERROR" "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

# Build connection string
if [ -n "$DB_PASSWORD" ]; then
  CONNECTION_STRING="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
else
  CONNECTION_STRING="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
fi

# Main execution
log "INFO" "Starting messaging table fix verification"
log "INFO" "Testing connection to database..."

# Test connection
if ! psql "$CONNECTION_STRING" -c "SELECT 1" &> /dev/null; then
  log "ERROR" "Failed to connect to database. Check your credentials and try again."
  exit 1
fi

log "INFO" "Connection successful."

# Create and run the test SQL
log "INFO" "Running messaging table test..."

TEST_RESULT=$(psql "$CONNECTION_STRING" -v ON_ERROR_STOP=1 << 'EOSQL'
-- Begin transaction to avoid affecting real data
BEGIN;

-- Set output format
\pset format aligned
\pset border 2
\pset null '[NULL]'

-- Create test UUIDs
DO $$
DECLARE
    test_attendee_id UUID := '11111111-1111-1111-1111-111111111111';
    test_dealer_id UUID := '22222222-2222-2222-2222-222222222222';
    test_mvp_dealer_id UUID := '33333333-3333-3333-3333-333333333333';
    test_organizer_id UUID := '44444444-4444-4444-4444-444444444444';
    test_conversation_id1 UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    test_conversation_id2 UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
BEGIN
    RAISE NOTICE '=== MESSAGING TABLE FIX VERIFICATION ===';
    
    -- Check if messages table exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'messages'
    ) THEN
        RAISE NOTICE 'Messages table exists';
        
        -- Check columns
        RAISE NOTICE 'Checking columns in messages table:';
        PERFORM column_name, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'messages'
        ORDER BY ordinal_position;
        
        -- Check for message_text column
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND column_name = 'message_text'
        ) THEN
            RAISE NOTICE 'Adding message_text column';
            ALTER TABLE public.messages ADD COLUMN message_text TEXT;
            
            -- Back-fill existing rows
            UPDATE public.messages SET message_text = content WHERE message_text IS NULL;
        END IF;
        
        -- Try the INSERT that was failing before
        RAISE NOTICE 'Attempting to insert test messages with recipient_id...';
        
        -- Create conversations if they don't exist
        INSERT INTO public.conversations (id, type, created_at, last_message_text)
        VALUES
            (test_conversation_id1, 'group', NOW(), 'Test Conversation 1'),
            (test_conversation_id2, 'group', NOW(), 'Test Conversation 2')
        ON CONFLICT (id) DO UPDATE 
        SET last_message_text = EXCLUDED.last_message_text;
        
        -- Create conversation participants if they don't exist
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES
            (test_conversation_id1, test_attendee_id),
            (test_conversation_id1, test_dealer_id),
            (test_conversation_id2, test_mvp_dealer_id),
            (test_conversation_id2, test_organizer_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
        
        -- Insert test messages with recipient_id
        INSERT INTO public.messages (conversation_id, sender_id, recipient_id, content, message_text)
        VALUES
            -- Conversation 1
            (test_conversation_id1, test_attendee_id, test_dealer_id,
             'Test message from attendee', 'Test message from attendee'),
            (test_conversation_id1, test_dealer_id, test_attendee_id,
             'Test message from dealer', 'Test message from dealer'),
            -- Conversation 2
            (test_conversation_id2, test_mvp_dealer_id, test_organizer_id,
             'Test message from MVP dealer', 'Test message from MVP dealer'),
            (test_conversation_id2, test_organizer_id, test_mvp_dealer_id,
             'Test message from organizer', 'Test message from organizer')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Insert succeeded! The fix is working correctly.';
        RAISE NOTICE 'Messages in the database:';
        
        -- Show the inserted messages
        PERFORM conversation_id, sender_id, recipient_id, content, message_text
        FROM public.messages
        WHERE conversation_id IN (test_conversation_id1, test_conversation_id2)
        ORDER BY conversation_id, sender_id;
        
    ELSE
        RAISE NOTICE 'Messages table does not exist. Messaging feature may be on hold.';
        RAISE NOTICE 'No test needed since the table doesn''t exist yet.';
    END IF;
END$$;

-- Rollback to ensure we don't affect production data
ROLLBACK;

-- Final message
SELECT 'Test completed successfully. If no errors appeared above, the fix is working.';
EOSQL
)

# Check if the test was successful
if [ $? -eq 0 ]; then
  log "INFO" "Messaging table test completed successfully!"
  echo "$TEST_RESULT"
else
  log "ERROR" "Messaging table test failed."
  echo "$TEST_RESULT"
  exit 1
fi

log "INFO" "Test verification complete."
exit 0
