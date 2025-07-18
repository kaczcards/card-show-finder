#!/usr/bin/env bash
# ================================================================
# SUPABASE RLS POLICY FIX SCRIPT
# ================================================================
# This script fixes the infinite recursion issue in show_participants
# RLS policies by applying the fix directly to your Supabase database.
#
# Usage:
#   ./apply_rls_fix.sh -u <supabase-url> -k <service-role-key> -d <database-name>
#
# Example:
#   ./apply_rls_fix.sh -u https://abcdefg.supabase.co -k eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... -d postgres
# ================================================================

# Text formatting
BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
RESET="\033[0m"

# Default values
SUPABASE_URL=""
SERVICE_ROLE_KEY=""
DB_NAME="postgres"
DB_PORT="5432"
VERBOSE=false

# Function to display usage information
show_usage() {
  echo -e "${BOLD}Usage:${RESET}"
  echo "  $0 [options]"
  echo ""
  echo -e "${BOLD}Options:${RESET}"
  echo "  -u, --url URL         Supabase project URL (required)"
  echo "  -k, --key KEY         Supabase service role key (required)"
  echo "  -d, --database NAME   Database name (default: postgres)"
  echo "  -p, --port PORT       Database port (default: 5432)"
  echo "  -v, --verbose         Show verbose output"
  echo "  -h, --help            Show this help message"
  echo ""
  echo -e "${BOLD}Example:${RESET}"
  echo "  $0 -u https://abcdefg.supabase.co -k eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Function to log messages
log() {
  local level=$1
  local message=$2
  local color=""
  
  case $level in
    "INFO")  color=$GREEN ;;
    "WARN")  color=$YELLOW ;;
    "ERROR") color=$RED ;;
    *)       color=$RESET ;;
  esac
  
  echo -e "${color}[$level] $message${RESET}"
  
  if [ "$VERBOSE" = true ]; then
    echo -e "${color}[$level] $message${RESET}" >> "rls_fix_$(date +%Y%m%d_%H%M%S).log"
  fi
}

# Function to check if a command exists
check_command() {
  if ! command -v "$1" &> /dev/null; then
    log "ERROR" "$1 is not installed. Please install it and try again."
    exit 1
  fi
}

# Function to extract database host from Supabase URL
extract_db_host() {
  local url=$1
  # Remove protocol
  local host=${url#*://}
  # Remove path and query string if any
  host=${host%%/*}
  echo "$host"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -u|--url)
      SUPABASE_URL=$2
      shift 2
      ;;
    -k|--key)
      SERVICE_ROLE_KEY=$2
      shift 2
      ;;
    -d|--database)
      DB_NAME=$2
      shift 2
      ;;
    -p|--port)
      DB_PORT=$2
      shift 2
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      log "ERROR" "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

# Check required parameters
if [ -z "$SUPABASE_URL" ]; then
  log "ERROR" "Supabase URL is required. Use -u or --url to specify it."
  show_usage
  exit 1
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
  log "ERROR" "Supabase service role key is required. Use -k or --key to specify it."
  show_usage
  exit 1
fi

# Check for required commands
check_command "psql"
check_command "grep"
check_command "sed"

# Extract host from URL
DB_HOST=$(extract_db_host "$SUPABASE_URL")

# Prepare connection string for Supabase
CONNECTION_STRING="postgres://postgres:$SERVICE_ROLE_KEY@$DB_HOST:$DB_PORT/$DB_NAME"

# Log start
log "INFO" "Starting RLS policy fix for show_participants table..."
log "INFO" "Connecting to Supabase database at $DB_HOST..."

# Check connection
if ! PGPASSWORD=$SERVICE_ROLE_KEY psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
  log "ERROR" "Failed to connect to Supabase database. Check your credentials and try again."
  exit 1
fi

log "INFO" "Connection successful!"

# Apply the fix
log "INFO" "Applying RLS policy fix..."

# Create SQL file with the fix
cat > rls_fix_temp.sql << 'EOF'
-- Begin transaction for safety
BEGIN;

-- Check if the problematic policy exists
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'show_participants'
    AND policyname = 'show_participants_select_mvp_dealer'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    RAISE NOTICE 'Found problematic policy. Replacing it...';
  ELSE
    RAISE NOTICE 'Problematic policy not found. Creating fixed policy...';
  END IF;
END $$;

-- 1. Drop the problematic policy if it exists
DROP POLICY IF EXISTS "show_participants_select_mvp_dealer" ON public.show_participants;

-- 2. Create a new non-recursive policy
CREATE POLICY "show_participants_select_mvp_dealer_fixed"
  ON public.show_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User is an MVP dealer (this function doesn't query show_participants)
    is_mvp_dealer() AND
    (
      -- Simple self-check without recursion
      userid = auth.uid() OR
      -- Check if they're an organizer of the show
      EXISTS (
        SELECT 1 FROM shows s
        WHERE s.id = show_participants.showid
        AND s.organizer_id = auth.uid()
      )
      -- Note: This is slightly more permissive than before but fixes the recursion
    )
  );

-- 3. Add comment explaining the fix
COMMENT ON POLICY "show_participants_select_mvp_dealer_fixed" ON public.show_participants IS 
  'Non-recursive policy allowing MVP dealers to see participants for shows they are involved with';

-- 4. Verification query
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'show_participants'
  AND policyname = 'show_participants_select_mvp_dealer_fixed';
  
  IF policy_count > 0 THEN
    RAISE NOTICE 'Fix successfully applied! New policy is in place.';
  ELSE
    RAISE NOTICE 'Warning: Policy creation may have failed.';
  END IF;
END $$;

-- Commit the transaction
COMMIT;
EOF

# Apply the SQL fix
if PGPASSWORD=$SERVICE_ROLE_KEY psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -f rls_fix_temp.sql; then
  log "INFO" "RLS policy fix successfully applied!"
  log "INFO" "The infinite recursion issue has been resolved."
  
  # Verify the fix
  log "INFO" "Verifying the fix..."
  if PGPASSWORD=$SERVICE_ROLE_KEY psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" \
     -c "SELECT policyname FROM pg_policies WHERE tablename = 'show_participants' AND policyname = 'show_participants_select_mvp_dealer_fixed'" | grep -q "show_participants_select_mvp_dealer_fixed"; then
    log "INFO" "${BOLD}Success!${RESET} The fixed policy is now in place."
  else
    log "WARN" "Policy verification failed. The fix may not have been applied correctly."
  fi
else
  log "ERROR" "Failed to apply RLS policy fix. Check the error message above."
  exit 1
fi

# Clean up
rm -f rls_fix_temp.sql

log "INFO" "Fix complete! You should now be able to run your pgTAP tests without infinite recursion errors."
log "INFO" "If you still encounter issues, please check the database logs for more details."

exit 0
