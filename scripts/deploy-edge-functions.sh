#!/bin/bash
#
# deploy-edge-functions.sh
#
# This script deploys Supabase Edge Functions for the Card Show Finder app.
# Currently deploys:
#   - send-broadcast: Secure function for sending broadcast messages with rate limiting
#
# Usage:
#   1. Make the script executable: chmod +x scripts/deploy-edge-functions.sh
#   2. Run the script: ./scripts/deploy-edge-functions.sh
#
# Requirements:
#   - Supabase CLI installed (https://supabase.com/docs/guides/cli)
#   - Logged in to Supabase CLI (supabase login)
#   - SUPABASE_PROJECT_ID environment variable set (or configured in .env)
#

set -e # Exit immediately if a command exits with a non-zero status

# Load environment variables if .env file exists
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
fi

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI is not installed."
  echo "Please install it following the instructions at:"
  echo "https://supabase.com/docs/guides/cli"
  exit 1
fi

# Check if user is logged in to Supabase
if ! supabase projects list &> /dev/null; then
  echo "Error: You are not logged in to Supabase CLI."
  echo "Please run 'supabase login' first."
  exit 1
fi

# Check for project ID
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "Error: SUPABASE_PROJECT_ID environment variable is not set."
  echo "Please set it in your .env file or export it before running this script."
  exit 1
fi

# Set functions directory
FUNCTIONS_DIR="./supabase/functions"

# Check if functions directory exists
if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "Creating functions directory at $FUNCTIONS_DIR..."
  mkdir -p "$FUNCTIONS_DIR"
fi

# Check if send-broadcast function exists
if [ ! -d "$FUNCTIONS_DIR/send-broadcast" ]; then
  echo "Error: send-broadcast function directory not found at $FUNCTIONS_DIR/send-broadcast"
  echo "Please make sure the function code is in place before deploying."
  exit 1
fi

# ------------------------------------------------------------------
# Deploy `send-broadcast` function
# ------------------------------------------------------------------
echo "Deploying send-broadcast function..."
supabase functions deploy send-broadcast --project-ref "$SUPABASE_PROJECT_ID"

# Check deployment status
if [ $? -eq 0 ]; then
  echo "✅ send-broadcast function deployed successfully!"
  echo ""
  echo "You can now call this function from your app using:"
  echo "  const { data, error } = await supabase.functions.invoke('send-broadcast', {"
  echo "    body: {"
  echo "      showId: 'optional-show-id',"
  echo "      message: 'Your broadcast message',"
  echo "      recipients: ['attendees', 'dealers']"
  echo "    }"
  echo "  });"
else
  echo "❌ Failed to deploy send-broadcast function."
  exit 1
fi

# ------------------------------------------------------------------
# Deploy `reset-broadcast-quotas` function
# ------------------------------------------------------------------

# Check if reset-broadcast-quotas function directory exists
if [ ! -d "$FUNCTIONS_DIR/reset-broadcast-quotas" ]; then
  echo "Error: reset-broadcast-quotas function directory not found at $FUNCTIONS_DIR/reset-broadcast-quotas"
  echo "Please make sure the function code is in place before deploying."
  exit 1
fi

echo "Deploying reset-broadcast-quotas function..."
supabase functions deploy reset-broadcast-quotas --project-ref "$SUPABASE_PROJECT_ID"

# Check deployment status
if [ $? -eq 0 ]; then
  echo "✅ reset-broadcast-quotas function deployed successfully!"
else
  echo "❌ Failed to deploy reset-broadcast-quotas function."
  exit 1
fi

# ------------------------------------------------------------------
# Schedule monthly cron job for broadcast quota reset
# ------------------------------------------------------------------
echo "Creating / updating monthly schedule for reset-broadcast-quotas..."

# Attempt to upsert the schedule (create if not exists, update otherwise)
supabase functions schedule create monthly_broadcast_reset \
  --function reset-broadcast-quotas \
  --schedule "0 0 1 * *" \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --description "Reset broadcast quotas on the 1st of each month" \
  --replace

if [ $? -eq 0 ]; then
  echo "✅ Monthly broadcast-quota reset schedule configured."
else
  echo "⚠️  Warning: Unable to configure schedule automatically."
  echo "   You may need to create or update it manually via the Supabase dashboard."
fi

echo ""
echo "To test the function, you can use the Supabase CLI:"
echo "  supabase functions serve --project-ref $SUPABASE_PROJECT_ID"
echo ""
echo "Then in another terminal:"
echo "  curl -X POST http://localhost:54321/functions/v1/send-broadcast \\"
echo "    -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"message\":\"Test broadcast\",\"recipients\":[\"attendees\"]}'"
echo ""
echo "Remember that this function requires:"
echo "  1. A valid JWT token from a user with SHOW_ORGANIZER role"
echo "  2. The user must not have exceeded their monthly broadcast limit (2)"
echo "  3. If a showId is provided, the user must be the organizer of that show"
