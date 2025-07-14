#!/bin/bash
# run-show-diagnostics.sh
# Script to run diagnostic queries and fix the issue with shows not appearing on the homepage

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# SQL file path
SQL_FILE="supabase/migrations/20250714030000_diagnostic_and_fix_get_shows.sql"

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

# Check if the SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    error_exit "SQL file not found at path: $SQL_FILE"
fi

# Print banner
echo -e "${BOLD}=================================================${NC}"
echo -e "${BOLD}   CARD SHOW FINDER - HOMEPAGE DIAGNOSTICS TOOL   ${NC}"
echo -e "${BOLD}=================================================${NC}"
echo -e "This script will diagnose why shows aren't appearing on the homepage"
echo -e "and apply fixes to resolve the issue.\n"

# Check which database tools are available
if command -v psql &> /dev/null; then
    has_psql=true
else
    has_psql=false
fi

if command -v supabase &> /dev/null; then
    has_supabase=true
else
    has_supabase=true
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

# Get connection details
if [ "$use_supabase_cli" = true ]; then
    section_header "SUPABASE CONNECTION"
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
    section_header "DATABASE CONNECTION"
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

# Create a temporary file for the diagnostic output
temp_output=$(mktemp)

section_header "RUNNING DIAGNOSTICS"
echo "Running diagnostic queries to identify the issue..."

if [ "$use_supabase_cli" = true ]; then
    # Using Supabase CLI
    supabase db execute --project-ref "$project_ref" --file "$SQL_FILE" > "$temp_output" 2>&1
    
    if [ $? -ne 0 ]; then
        cat "$temp_output"
        error_exit "Failed to run diagnostic queries. Check the error message above."
    fi
else
    # Using direct psql
    export PGPASSWORD="$pg_password"
    
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" -f "$SQL_FILE" > "$temp_output" 2>&1
    
    if [ $? -ne 0 ]; then
        cat "$temp_output"
        error_exit "Failed to run diagnostic queries. Check the error message above."
    fi
    
    # Clear password from environment
    unset PGPASSWORD
fi

# Parse and display the diagnostic results
section_header "DIAGNOSTIC RESULTS"

# Extract and display the diagnostic counts
echo -e "${BOLD}Show Counts:${NC}"
grep -E "Total shows in database|Active shows|Shows in next 30 days|Shows with valid coordinates|Shows near ZIP 46060|Shows matching all homepage filters|Shows created by organizer" "$temp_output" | while read -r line; do
    check_type=$(echo "$line" | awk -F'|' '{print $1}' | sed 's/^ *//' | sed 's/ *$//')
    count=$(echo "$line" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')
    
    # Color-code the output based on count
    if [ "$count" -eq 0 ]; then
        echo -e "  • ${check_type}: ${RED}${count}${NC}"
    else
        echo -e "  • ${check_type}: ${GREEN}${count}${NC}"
    fi
done

# Check if there are any shows created by the organizer
organizer_shows=$(grep -E "Shows created by organizer" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')

if [ "$organizer_shows" -gt 0 ]; then
    echo -e "\n${BOLD}Organizer's Shows Details:${NC}"
    # Extract and display the organizer's shows
    grep -A 20 "SELECT 'Shows created by organizer'" "$temp_output" | grep -v "SELECT" | grep -v "^$" | grep -v "^-" | grep -v "check_type" | grep -E "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" | while read -r line; do
        echo "  • $line"
    done
fi

# Check if coordinates were fixed
if grep -q "Updated coordinates for shows with NULL coordinates" "$temp_output"; then
    success_message "\nCoordinates were updated for shows with NULL coordinates!"
fi

section_header "ANALYSIS & RECOMMENDATIONS"

# Check for common issues based on the diagnostic results
total_shows=$(grep -E "Total shows in database" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')
active_shows=$(grep -E "Active shows" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')
date_range_shows=$(grep -E "Shows in next 30 days" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')
valid_coord_shows=$(grep -E "Shows with valid coordinates" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')
near_zip_shows=$(grep -E "Shows near ZIP 46060" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')
all_filters_shows=$(grep -E "Shows matching all homepage filters" "$temp_output" | awk -F'|' '{print $2}' | sed 's/^ *//' | sed 's/ *$//')

# Analyze the results
if [ "$total_shows" -eq 0 ]; then
    echo "No shows found in the database. Please add some shows first."
elif [ "$active_shows" -eq 0 ]; then
    echo "There are shows in the database, but none are marked as 'ACTIVE'."
    echo "Recommendation: Check the status of your shows and update them to 'ACTIVE'."
elif [ "$date_range_shows" -eq 0 ]; then
    echo "There are active shows, but none are scheduled in the next 30 days."
    echo "Recommendation: Check the start_date and end_date of your shows."
elif [ "$valid_coord_shows" -eq 0 ]; then
    echo "There are active shows in the next 30 days, but none have valid coordinates."
    echo "Recommendation: The script has attempted to fix NULL coordinates, please restart your app."
elif [ "$near_zip_shows" -eq 0 ]; then
    echo "There are shows with valid coordinates, but none are within 25 miles of ZIP 46060."
    echo "Recommendation: Increase the search radius in the app or add shows closer to ZIP 46060."
elif [ "$all_filters_shows" -eq 0 ]; then
    echo "Shows exist but don't match all homepage filters."
    echo "Recommendation: The script has applied a fix that uses more lenient filtering."
else
    echo "Shows should be appearing on the homepage. If they're still not visible:"
    echo "1. Restart your application"
    echo "2. Clear any cached data in the app"
    echo "3. Check the app's network requests for errors"
fi

# Always mention that a fix has been applied
success_message "\nA simplified version of get_paginated_shows has been applied!"
echo "This version:"
echo "1. Uses minimal filtering to ensure shows appear"
echo "2. Includes a fallback mode that shows ANY shows if no matches are found"
echo "3. Fixes shows with missing coordinates"
echo "4. Includes detailed debugging information"

section_header "NEXT STEPS"
echo "1. Restart your application"
echo "2. Navigate to the homepage"
echo "3. Check if shows appear for ZIP code 46060"
echo "4. If shows still don't appear, check the app logs for the 'debug' information"
echo "   from the get_paginated_shows function and share it with the development team"

# Clean up
rm -f "$temp_output"

echo -e "\n${BOLD}=================================================${NC}"
success_message "Diagnostics and fixes complete!"
echo -e "${BOLD}=================================================${NC}"

exit 0
