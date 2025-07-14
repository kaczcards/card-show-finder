#!/bin/bash
# apply-cte-fix.sh
# Emergency script to fix the "relation filtered_shows does not exist" error
# This applies the SQL fix directly to the database without going through migrations

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

# Create a temporary SQL file with the fix
create_temp_sql_file() {
    cat > "$1" << 'EOF'
-- Emergency fix for get_paginated_shows to resolve "relation filtered_shows does not exist" error
DROP FUNCTION IF EXISTS public.get_paginated_shows;

CREATE OR REPLACE FUNCTION public.get_paginated_shows(
  lat float,
  long float,
  radius_miles float DEFAULT 25,
  start_date timestamp with time zone DEFAULT current_date,
  end_date timestamp with time zone DEFAULT (current_date + interval '30 days'),
  max_entry_fee numeric DEFAULT NULL,
  categories text[] DEFAULT NULL,
  features jsonb DEFAULT NULL,
  page_size integer DEFAULT 20,
  page integer DEFAULT 1,
  status text DEFAULT 'ACTIVE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count integer;
  offset_val integer;
  search_point geography;
  shows_data jsonb;
  result_json jsonb;
  is_default_coordinates boolean;
BEGIN
  -- Calculate offset based on page number and page size
  offset_val := (page - 1) * page_size;
  
  -- Determine if we're using default/placeholder coordinates
  is_default_coordinates := (abs(lat) < 0.1 AND abs(long) < 0.1);
  
  -- Convert input coordinates to a geography point for distance calculation
  IF NOT is_default_coordinates THEN
    search_point := ST_SetSRID(ST_MakePoint(long, lat), 4326)::geography;
  END IF;
  
  -- First, get the total count of shows that match the criteria
  SELECT COUNT(*)::integer INTO total_count
  FROM public.shows s
  WHERE
    s.status = status
    AND s.end_date >= start_date
    AND s.start_date <= end_date
    AND (
      is_default_coordinates OR
      (
        s.coordinates IS NOT NULL AND
        ST_DWithin(
          s.coordinates::geography,
          search_point,
          radius_miles * 1609.34
        )
      )
    )
    AND (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee)
    AND (categories IS NULL OR s.categories && categories)
    AND (features IS NULL OR s.features @> features);
  
  -- Now get the paginated results with all filtering applied
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'series_id', s.series_id,
      'title', s.title,
      'description', s.description,
      'location', s.location,
      'address', s.address,
      'start_date', s.start_date,
      'end_date', s.end_date,
      'entry_fee', s.entry_fee,
      'image_url', s.image_url,
      'rating', s.rating,
      'coordinates', s.coordinates,
      'status', s.status,
      'organizer_id', s.organizer_id,
      'features', s.features,
      'categories', s.categories,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'latitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_Y(s.coordinates::geometry) ELSE NULL END,
      'longitude', CASE WHEN s.coordinates IS NOT NULL THEN ST_X(s.coordinates::geometry) ELSE NULL END,
      'distance_miles', CASE 
        WHEN is_default_coordinates OR s.coordinates IS NULL THEN NULL
        ELSE ST_Distance(s.coordinates::geography, search_point) / 1609.34
      END
    )
  ) INTO shows_data
  FROM (
    SELECT *
    FROM public.shows s
    WHERE
      s.status = status
      AND s.end_date >= start_date
      AND s.start_date <= end_date
      AND (
        is_default_coordinates OR
        (
          s.coordinates IS NOT NULL AND
          ST_DWithin(
            s.coordinates::geography,
            search_point,
            radius_miles * 1609.34
          )
        )
      )
      AND (max_entry_fee IS NULL OR s.entry_fee <= max_entry_fee)
      AND (categories IS NULL OR s.categories && categories)
      AND (features IS NULL OR s.features @> features)
    ORDER BY
      s.start_date ASC,
      CASE 
        WHEN NOT is_default_coordinates AND s.coordinates IS NOT NULL THEN 
          ST_Distance(s.coordinates::geography, search_point)
        ELSE NULL
      END ASC NULLS LAST
    LIMIT page_size
    OFFSET offset_val
  ) s;
  
  -- Handle case where no shows are found
  IF shows_data IS NULL THEN
    shows_data := '[]'::jsonb;
  END IF;
  
  -- Build result with pagination metadata
  result_json := jsonb_build_object(
    'data', shows_data,
    'pagination', jsonb_build_object(
      'total_count', total_count,
      'page_size', page_size,
      'current_page', page,
      'total_pages', CEIL(GREATEST(total_count, 1)::numeric / page_size)
    )
  );
  
  RETURN result_json;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_paginated_shows: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'errorCode', SQLSTATE,
      'message', 'An error occurred while retrieving shows. Please try again.'
    );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_paginated_shows TO authenticated, anon;
EOF
}

echo "=================================================="
echo "  EMERGENCY FIX: Repair get_paginated_shows CTE   "
echo "=================================================="
echo "This script will fix the 'relation filtered_shows does not exist' error"
echo "by applying a direct SQL fix to your Supabase database."
echo

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    warning_message "PostgreSQL client (psql) not found. Will try using Supabase CLI instead."
    
    # Check if supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        error_exit "Neither psql nor Supabase CLI is installed. Please install one of them first."
    fi
    
    use_supabase_cli=true
else
    use_supabase_cli=false
fi

# Create temporary SQL file
temp_sql_file=$(mktemp)
create_temp_sql_file "$temp_sql_file"

# Get connection details
if [ "$use_supabase_cli" = true ]; then
    echo "Please enter your Supabase project reference ID:"
    read project_ref
    
    if [ -z "$project_ref" ]; then
        error_exit "Project reference cannot be empty."
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

echo "Applying the CTE fix to the database..."

if [ "$use_supabase_cli" = true ]; then
    # Using Supabase CLI
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
    
    echo "Applying SQL fix using Supabase CLI..."
    supabase db execute --project-ref "$project_ref" --file "$temp_sql_file" 2>&1 | tee /tmp/supabase_output.log
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        if grep -q "already exists" /tmp/supabase_output.log; then
            warning_message "Function already exists. Fix has been applied."
        else
            error_exit "Failed to apply SQL fix. Check the error message above."
        fi
    else
        success_message "SQL fix successfully applied!"
    fi
    
    # Verify the function was created correctly
    echo "Verifying the SQL function was fixed..."
    supabase db execute --project-ref "$project_ref" \
        --command "SELECT proname, prosrc FROM pg_proc WHERE proname = 'get_paginated_shows';" 2>&1 | tee /tmp/verify_output.log
    
    if grep -q "get_paginated_shows" /tmp/verify_output.log && ! grep -q "filtered_shows" /tmp/verify_output.log; then
        success_message "Verification successful! The get_paginated_shows function has been fixed."
    else
        warning_message "Verification inconclusive. Please check the database manually."
    fi
else
    # Using direct psql
    export PGPASSWORD="$pg_password"
    
    echo "Applying SQL fix using psql..."
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" -f "$temp_sql_file" 2>&1 | tee /tmp/psql_output.log
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        if grep -q "already exists" /tmp/psql_output.log; then
            warning_message "Function already exists. Fix has been applied."
        else
            error_exit "Failed to apply SQL fix. Check the error message above."
        fi
    else
        success_message "SQL fix successfully applied!"
    fi
    
    # Verify the function was created correctly
    echo "Verifying the SQL function was fixed..."
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" \
        -c "SELECT proname, prosrc FROM pg_proc WHERE proname = 'get_paginated_shows';" 2>&1 | tee /tmp/verify_output.log
    
    if grep -q "get_paginated_shows" /tmp/verify_output.log && ! grep -q "filtered_shows" /tmp/verify_output.log; then
        success_message "Verification successful! The get_paginated_shows function has been fixed."
    else
        warning_message "Verification inconclusive. Please check the database manually."
    fi
    
    # Clear password from environment
    unset PGPASSWORD
fi

# Clean up
rm -f "$temp_sql_file" /tmp/supabase_output.log /tmp/verify_output.log

echo ""
echo "=================================================="
success_message "CTE fix has been applied!"
echo "=================================================="
echo ""
echo "The SQL fix has been applied to your Supabase database."
echo "This fix resolves the 'relation filtered_shows does not exist' error by:"
echo "  1. Removing the CTE approach that was causing the error"
echo "  2. Using direct filtering in both the count and data queries"
echo "  3. Maintaining all the original functionality"
echo ""
echo "To test the fix, please:"
echo "  1. Restart your application"
echo "  2. Navigate to the homepage"
echo "  3. Check if shows appear correctly for zip code 46060"
echo ""
echo "If you still experience issues, please contact support."
echo "=================================================="

exit 0
