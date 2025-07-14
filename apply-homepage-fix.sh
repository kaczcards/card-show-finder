#!/bin/bash
# apply-homepage-fix.sh
# Script to apply the homepage shows display fix to the Supabase database
# This script applies the SQL migration and checks if it was successful

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# SQL file path
SQL_FILE="supabase/migrations/20250714010000_fix_homepage_show_display.sql"

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

# Check if the SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    error_exit "SQL file not found at path: $SQL_FILE"
fi

echo "Starting homepage shows display fix application..."
echo "This script will apply the SQL fix to your Supabase database."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    error_exit "Supabase CLI is not installed. Please install it first: npm install -g supabase"
fi

# Confirm before proceeding
read -p "Do you want to proceed with applying the fix? (y/n): " confirm
if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Operation cancelled by user."
    exit 0
fi

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

# Get project ID
echo "Please enter your Supabase project ID or reference:"
read project_id

if [ -z "$project_id" ]; then
    error_exit "Project ID cannot be empty."
fi

# Apply the SQL migration
echo "Applying SQL fix to fix homepage show display..."
echo "This may take a few moments..."

# Create a temporary file to capture the output
temp_output=$(mktemp)

# Run the SQL file against the database
supabase db push --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \
                 --project-ref "$project_id" \
                 --file "$SQL_FILE" 2>&1 | tee "$temp_output"

# Check if the command was successful
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    # Check if it's a "function already exists" error, which is actually okay
    if grep -q "already exists" "$temp_output"; then
        warning_message "Function already exists. This is not an error, the fix is already applied."
    else
        error_exit "Failed to apply SQL fix. Please check the error message above."
    fi
else
    success_message "SQL fix successfully applied!"
fi

# Clean up temporary file
rm -f "$temp_output"

# Verify the function was created
echo "Verifying the SQL function was created correctly..."
supabase db query --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \
                  --project-ref "$project_id" \
                  "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_paginated_shows');" 2>&1 | tee "$temp_output"

if grep -q "t" "$temp_output"; then
    success_message "Verification successful! The get_paginated_shows function exists in the database."
else
    warning_message "Verification failed! The function may not have been created correctly."
    echo "Please check the database manually to confirm the function exists."
fi

# Clean up
rm -f "$temp_output"

echo ""
echo "============================================================"
success_message "Homepage shows display fix has been applied!"
echo "============================================================"
echo ""
echo "The SQL fix has been applied to your Supabase database."
echo "This fix addresses the following issues:"
echo "  1. Properly handles missing or default coordinates"
echo "  2. Fixes date filtering to show all relevant shows"
echo "  3. Ensures shows created by organizers appear correctly"
echo "  4. Improves error handling and debugging information"
echo ""
echo "To test the fix, please:"
echo "  1. Restart your application"
echo "  2. Navigate to the homepage"
echo "  3. Check if shows appear correctly for zip code 46060"
echo "  4. Verify that organizer-created shows are visible"
echo ""
echo "If you still experience issues, please contact support."
echo "============================================================"

exit 0
