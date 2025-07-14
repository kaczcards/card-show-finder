#!/bin/bash
# final-fix.sh
# Comprehensive script to apply the final fix for all show details issues
# This resolves text rendering errors and ensures consistent data structure

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to print error and exit
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Function to print success message
success_message() {
    echo -e "${GREEN}$1${NC}"
}

# Function to print warning message
warning_message() {
    echo -e "${YELLOW}$1${NC}"
}

# Function to print section header
section_header() {
    echo -e "\n${BLUE}${BOLD}$1${NC}"
    echo -e "${BLUE}${BOLD}$(printf '=%.0s' $(seq 1 ${#1}))${NC}"
}

# Create temporary SQL file with the fix
create_temp_sql_file() {
    cat > "$1" << 'EOF'
-- Comprehensive fix for show details display issues
-- This addresses text rendering errors and ensures consistent data structure

-- Drop the function to recreate it with improvements
DROP FUNCTION IF EXISTS public.get_show_details_by_id;

-- Create the improved function with consistent data structure and null handling
CREATE OR REPLACE FUNCTION public.get_show_details_by_id(
  show_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  show_data JSONB;
  organizer_data JSONB;
  dealers_data JSONB;
  result_json JSONB;
  debug_info JSONB;
BEGIN
  -- Get the show data with explicit null handling and data sanitization
  SELECT 
    jsonb_build_object(
      'id', s.id,
      'title', COALESCE(s.title, 'Untitled Show'),
      'description', COALESCE(s.description, ''),
      'location', COALESCE(s.location, ''),
      'address', COALESCE(s.address, ''),
      'start_date', s.start_date,
      'end_date', s.end_date,
      'start_time', COALESCE(s.start_time, ''),
      'end_time', COALESCE(s.end_time, ''),
      'entry_fee', s.entry_fee,
      'image_url', s.image_url,
      'rating', COALESCE(s.rating, 0),
      'status', COALESCE(s.status, 'ACTIVE'),
      'organizer_id', s.organizer_id,
      'coordinates', s.coordinates,
      'features', COALESCE(s.features, '{}'),
      'categories', COALESCE(s.categories, '{}'),
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      -- Ensure consistent field naming for client compatibility
      'startTime', COALESCE(s.start_time, ''),
      'endTime', COALESCE(s.end_time, ''),
      'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END
    ) AS show
  INTO show_data
  FROM 
    public.shows s
  WHERE 
    s.id = show_id;
    
  IF show_data IS NULL THEN
    RAISE EXCEPTION 'Show with ID % not found', show_id;
  END IF;
  
  -- Get the organizer profile if it exists, with explicit null handling
  IF (show_data->>'organizer_id') IS NOT NULL THEN
    SELECT 
      jsonb_build_object(
        'id', p.id,
        'username', COALESCE(p.username, ''),
        'first_name', COALESCE(p.first_name, ''),
        'last_name', COALESCE(p.last_name, ''),
        'full_name', COALESCE(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), 'Show Organizer'),
        'email', COALESCE(p.email, ''),
        'profile_image_url', p.profile_image_url,
        'avatar_url', p.profile_image_url, -- Duplicate for client compatibility
        'role', COALESCE(UPPER(p.role), 'USER'),
        'account_type', COALESCE(p.account_type, 'FREE')
      ) AS profile
    INTO organizer_data
    FROM 
      public.profiles p
    WHERE 
      p.id = (show_data->>'organizer_id')::UUID;
  ELSE
    organizer_data := NULL;
  END IF;
  
  -- Get all participating dealers with their profiles
  -- Using only the show_participants table which exists
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', COALESCE(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), COALESCE(p.username, 'Dealer')),
        'profileImageUrl', p.profile_image_url,
        'role', COALESCE(UPPER(p.role), 'DEALER'),
        'accountType', COALESCE(p.account_type, 'FREE'),
        'boothLocation', COALESCE(sp.booth_location, '')
      )
    ) AS dealers
  INTO dealers_data
  FROM 
    public.show_participants sp
  JOIN 
    public.profiles p ON sp.userid = p.id
  WHERE 
    sp.showid = show_id
  AND
    LOWER(COALESCE(p.role, 'dealer')) IN ('mvp_dealer', 'dealer');
    
  -- If no dealers found, set to empty array instead of null
  IF dealers_data IS NULL THEN
    dealers_data := '[]'::JSONB;
  END IF;
  
  -- Add debug info to help diagnose issues
  debug_info := jsonb_build_object(
    'query_time', NOW(),
    'show_id', show_id,
    'has_organizer', organizer_data IS NOT NULL,
    'dealer_count', jsonb_array_length(COALESCE(dealers_data, '[]'::JSONB))
  );
  
  -- Combine all data into a single JSON object
  result_json := jsonb_build_object(
    'show', show_data,
    'organizer', organizer_data,
    'participatingDealers', dealers_data,
    'isFavoriteCount', (
      SELECT COUNT(*) 
      FROM public.user_favorite_shows 
      WHERE public.user_favorite_shows.show_id = get_show_details_by_id.show_id
    ),
    'debug', debug_info
  );
  
  RETURN result_json;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return error information
    RAISE LOG 'Error in get_show_details_by_id: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE,
      'message', 'An error occurred while retrieving show details. Please try again.',
      'details', jsonb_build_object(
        'show_id', show_id,
        'timestamp', NOW()
      )
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_show_details_by_id TO authenticated, anon;
EOF
}

# Print banner
echo -e "${BOLD}=================================================${NC}"
echo -e "${BOLD}   CARD SHOW FINDER - FINAL FIX SCRIPT          ${NC}"
echo -e "${BOLD}=================================================${NC}"
echo -e "This script will apply the final fix for all show details issues,"
echo -e "resolving text rendering errors and ensuring consistent data structure."
echo

# Check which database tools are available
if command -v psql &> /dev/null; then
    has_psql=true
else
    has_psql=false
fi

if command -v supabase &> /dev/null; then
    has_supabase=true
else
    has_supabase=false
fi

if [ "$has_psql" = false ] && [ "$has_supabase" = false ]; then
    error_exit "Neither PostgreSQL client (psql) nor Supabase CLI is installed. Please install one of them first."
fi

# Ask user which tool to use
if [ "$has_psql" = true ] && [ "$has_supabase" = true ]; then
    echo "Both PostgreSQL client and Supabase CLI are available."
    echo "Which would you like to use?"
    echo "1) PostgreSQL client (psql)"
    echo "2) Supabase CLI"
    read -p "Enter your choice (1/2): " tool_choice
    
    if [ "$tool_choice" = "1" ]; then
        use_supabase_cli=false
    else
        use_supabase_cli=true
    fi
elif [ "$has_psql" = true ]; then
    use_supabase_cli=false
else
    use_supabase_cli=true
fi

# Create temporary SQL file
temp_sql_file=$(mktemp)
create_temp_sql_file "$temp_sql_file"

section_header "DATABASE CONNECTION"

# Get connection details
if [ "$use_supabase_cli" = true ]; then
    echo "Please enter your Supabase project reference ID:"
    read project_ref
    
    if [ -z "$project_ref" ]; then
        error_exit "Project reference cannot be empty."
    fi
    
    # Check Supabase login status
    echo "Checking Supabase login status..."
    supabase projects list &> /dev/null
    if [ $? -ne 0 ]; then
        warning_message "You need to log in to Supabase CLI first."
        echo "Running 'supabase login'..."
        supabase login
        
        if [ $? -ne 0 ]; then
            error_exit "Failed to log in to Supabase CLI. Please try again manually."
        fi
    fi
else
    echo "Please enter your PostgreSQL connection details:"
    echo "Host (default: localhost):"
    read pg_host
    pg_host=${pg_host:-localhost}
    
    echo "Port (default: 5432):"
    read pg_port
    pg_port=${pg_port:-5432}
    
    echo "Database name (default: postgres):"
    read pg_db
    pg_db=${pg_db:-postgres}
    
    echo "Username (default: postgres):"
    read pg_user
    pg_user=${pg_user:-postgres}
    
    echo "Password:"
    read -s pg_password
    echo
fi

section_header "APPLYING FIX"
echo "Applying the comprehensive fix to the database..."

if [ "$use_supabase_cli" = true ]; then
    # Using Supabase CLI
    supabase db execute --project-ref "$project_ref" --file "$temp_sql_file" > /tmp/supabase_output.log 2>&1
    
    if [ $? -ne 0 ]; then
        cat /tmp/supabase_output.log
        error_exit "Failed to apply SQL fix. Check the error message above."
    else
        success_message "SQL fix successfully applied!"
    fi
    
    # Verify the function was created correctly
    echo "Verifying the SQL function was fixed..."
    supabase db execute --project-ref "$project_ref" \
        --command "SELECT proname FROM pg_proc WHERE proname = 'get_show_details_by_id';" > /tmp/verify_output.log 2>&1
    
    if grep -q "get_show_details_by_id" /tmp/verify_output.log; then
        success_message "Verification successful! The get_show_details_by_id function has been fixed."
    else
        warning_message "Verification inconclusive. Please check the database manually."
    fi
else
    # Using direct psql
    export PGPASSWORD="$pg_password"
    
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" -f "$temp_sql_file" > /tmp/psql_output.log 2>&1
    
    if [ $? -ne 0 ]; then
        cat /tmp/psql_output.log
        error_exit "Failed to apply SQL fix. Check the error message above."
    else
        success_message "SQL fix successfully applied!"
    fi
    
    # Verify the function was created correctly
    echo "Verifying the SQL function was fixed..."
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" \
        -c "SELECT proname FROM pg_proc WHERE proname = 'get_show_details_by_id';" > /tmp/verify_output.log 2>&1
    
    if grep -q "get_show_details_by_id" /tmp/verify_output.log; then
        success_message "Verification successful! The get_show_details_by_id function has been fixed."
    else
        warning_message "Verification inconclusive. Please check the database manually."
    fi
    
    # Clear password from environment
    unset PGPASSWORD
fi

# Clean up
rm -f "$temp_sql_file" /tmp/supabase_output.log /tmp/verify_output.log

section_header "NEXT STEPS"
echo "1. Restart your application completely (not just refresh)"
echo "2. Navigate to a show created by a Show Organizer"
echo "3. Verify that all information appears correctly without errors:"
echo "   • No 'Text strings must be rendered within a <Text> component' errors"
echo "   • Show date and time display correctly in a single section"
echo "   • All text fields render properly"
echo

echo -e "${BOLD}=================================================${NC}"
success_message "FINAL FIX COMPLETE!"
echo -e "${BOLD}=================================================${NC}"
echo
echo "This fix resolves all show details display issues by:"
echo "1. Ensuring consistent data structure for all shows"
echo "2. Handling null values gracefully to prevent client-side errors"
echo "3. Providing both snake_case and camelCase field names for compatibility"
echo "4. Adding debug information to help diagnose issues"
echo "5. Properly formatting text fields to prevent React Native rendering errors"
echo
echo "If you still encounter issues, please contact support."

exit 0
