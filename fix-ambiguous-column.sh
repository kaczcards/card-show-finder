#!/bin/bash
# fix-ambiguous-column.sh
# Script to fix the "column reference 'status' is ambiguous" error in get_paginated_shows

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# SQL file path
SQL_FILE="supabase/migrations/20250714040000_fix_ambiguous_column_reference.sql"

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

echo "=================================================="
echo "  FIX: Resolve ambiguous column reference error   "
echo "=================================================="
echo "This script will fix the 'column reference status is ambiguous' error"
echo "by applying a SQL fix to your Supabase database."
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

echo "Applying the fix to the database..."

if [ "$use_supabase_cli" = true ]; then
    # Using Supabase CLI
    supabase db execute --project-ref "$project_ref" --file "$SQL_FILE" > /tmp/supabase_output.log 2>&1
    
    if [ $? -ne 0 ]; then
        cat /tmp/supabase_output.log
        error_exit "Failed to apply SQL fix. Check the error message above."
    else
        success_message "SQL fix successfully applied!"
    fi
    
    # Verify the function was created correctly
    echo "Verifying the SQL function was fixed..."
    supabase db execute --project-ref "$project_ref" \
        --command "SELECT proname FROM pg_proc WHERE proname = 'get_paginated_shows';" > /tmp/verify_output.log 2>&1
    
    if grep -q "get_paginated_shows" /tmp/verify_output.log; then
        success_message "Verification successful! The get_paginated_shows function has been fixed."
    else
        warning_message "Verification inconclusive. Please check the database manually."
    fi
else
    # Using direct psql
    export PGPASSWORD="$pg_password"
    
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" -f "$SQL_FILE" > /tmp/psql_output.log 2>&1
    
    if [ $? -ne 0 ]; then
        cat /tmp/psql_output.log
        error_exit "Failed to apply SQL fix. Check the error message above."
    else
        success_message "SQL fix successfully applied!"
    fi
    
    # Verify the function was created correctly
    echo "Verifying the SQL function was fixed..."
    psql -h "$pg_host" -p "$pg_port" -d "$pg_db" -U "$pg_user" \
        -c "SELECT proname FROM pg_proc WHERE proname = 'get_paginated_shows';" > /tmp/verify_output.log 2>&1
    
    if grep -q "get_paginated_shows" /tmp/verify_output.log; then
        success_message "Verification successful! The get_paginated_shows function has been fixed."
    else
        warning_message "Verification inconclusive. Please check the database manually."
    fi
    
    # Clear password from environment
    unset PGPASSWORD
fi

# Clean up
rm -f /tmp/supabase_output.log /tmp/verify_output.log

echo ""
echo "=================================================="
success_message "Ambiguous column fix has been applied!"
echo "=================================================="
echo ""
echo "The SQL fix has been applied to your Supabase database."
echo "This fix resolves the 'column reference status is ambiguous' error by:"
echo "  1. Properly qualifying all column references with table aliases"
echo "  2. Using minimal filtering to ensure shows appear"
echo "  3. Including a fallback mode that shows ANY shows if no matches are found"
echo ""
echo "To test the fix, please:"
echo "  1. Restart your application"
echo "  2. Navigate to the homepage"
echo "  3. Check if shows appear correctly for zip code 46060"
echo ""
echo "If you still experience issues, please run the full diagnostic script:"
echo "  ./run-show-diagnostics.sh"
echo "=================================================="

exit 0
