#!/bin/bash
# run-favorites-migration.sh
# This script runs the favorites migration SQL file to add the favorite_shows_count column
# and set up triggers to maintain it automatically.

# Set text colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================================"
echo -e "${GREEN}Card Show Finder - Favorites Migration Script${NC}"
echo "========================================================"
echo "This script will run the migration to add favorite_shows_count"
echo "to the profiles table and set up automatic triggers."
echo ""

# Check if the migration file exists
MIGRATION_FILE="./supabase/migrations/20250710_update_favorites_count_trigger.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Error: Migration file not found at $MIGRATION_FILE${NC}"
  echo "Please make sure you're running this script from the project root directory."
  exit 1
fi

echo -e "${YELLOW}Migration file found at: $MIGRATION_FILE${NC}"
echo ""

# Check for required environment variables or use defaults
if [ -z "$SUPABASE_DB_URL" ]; then
  echo -e "${YELLOW}SUPABASE_DB_URL environment variable not set.${NC}"
  echo "Using default local development database URL."
  SUPABASE_DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo -e "${YELLOW}SUPABASE_DB_PASSWORD environment variable not set.${NC}"
  echo "Using default local development password."
  SUPABASE_DB_PASSWORD="postgres"
fi

echo "Database connection information:"
echo "--------------------------------"
echo "Database URL: $SUPABASE_DB_URL"
echo ""

# Confirm before proceeding
read -p "Do you want to proceed with the migration? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Migration cancelled.${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}Running migration...${NC}"

# Run the migration using psql
PGPASSWORD=$SUPABASE_DB_PASSWORD psql "$SUPABASE_DB_URL" -f "$MIGRATION_FILE" 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}Migration completed successfully!${NC}"
  echo ""
  echo "The following changes have been applied:"
  echo "1. Added 'favorite_shows_count' column to the profiles table"
  echo "2. Created database triggers to automatically update the count"
  echo "3. Recalculated counts for all existing users"
  echo ""
  echo "You can now restart your app to use the new functionality."
else
  echo ""
  echo -e "${RED}Migration failed.${NC}"
  echo "Please check the error messages above and try again."
  echo ""
  echo "Common issues:"
  echo "- Database connection failed (check URL and password)"
  echo "- Insufficient permissions"
  echo "- Column already exists (migration already applied)"
  echo ""
  echo "For local development, make sure Supabase is running:"
  echo "npx supabase start"
  exit 1
fi

echo "========================================================"
