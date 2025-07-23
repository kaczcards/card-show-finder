#!/bin/bash
#
# setup-local-db-tests.sh
# 
# This script helps developers set up and run database security tests locally.
# It handles PostgreSQL setup, database creation, pgTAP installation, schema application,
# and test execution.
#

set -e

# Text formatting
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RESET="\033[0m"

# Default configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="card_show_finder_test"
DOCKER_CONTAINER_NAME="card-show-finder-pg"
USE_DOCKER=false
CLEANUP_AFTER=false

# Print formatted message
print_message() {
  local type=$1
  local message=$2
  
  case $type in
    "info")
      echo -e "${BLUE}${message}${RESET}"
      ;;
    "success")
      echo -e "${GREEN}✓ ${message}${RESET}"
      ;;
    "warning")
      echo -e "${YELLOW}⚠ ${message}${RESET}"
      ;;
    "error")
      echo -e "${RED}✗ ${message}${RESET}"
      ;;
    *)
      echo -e "${message}"
      ;;
  esac
}

# Print section header
print_header() {
  echo -e "\n${BOLD}${BLUE}=== $1 ===${RESET}"
}

# Print help message
show_help() {
  echo -e "${BOLD}Card Show Finder Database Test Setup${RESET}"
  echo ""
  echo "This script sets up a PostgreSQL database for running security tests locally."
  echo ""
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help                Show this help message"
  echo "  -d, --docker              Use Docker for PostgreSQL (default: use local PostgreSQL)"
  echo "  --host HOSTNAME           Database host (default: localhost)"
  echo "  --port PORT               Database port (default: 5432)"
  echo "  --user USERNAME           Database user (default: postgres)"
  echo "  --password PASSWORD       Database password (default: postgres)"
  echo "  --db-name DATABASE        Database name (default: card_show_finder_test)"
  echo "  --cleanup                 Drop the database after tests"
  echo ""
  echo "Environment variables:"
  echo "  PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE can be used instead of the options above"
  echo ""
}

# Parse command line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
      -h|--help)
        show_help
        exit 0
        ;;
      -d|--docker)
        USE_DOCKER=true
        shift
        ;;
      --host)
        DB_HOST="$2"
        shift 2
        ;;
      --port)
        DB_PORT="$2"
        shift 2
        ;;
      --user)
        DB_USER="$2"
        shift 2
        ;;
      --password)
        DB_PASSWORD="$2"
        shift 2
        ;;
      --db-name)
        DB_NAME="$2"
        shift 2
        ;;
      --cleanup)
        CLEANUP_AFTER=true
        shift
        ;;
      *)
        print_message "error" "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done
}

# Check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check if PostgreSQL is running locally
check_postgres_running() {
  print_header "Checking PostgreSQL Status"
  
  if $USE_DOCKER; then
    if command_exists docker; then
      if docker ps | grep -q $DOCKER_CONTAINER_NAME; then
        print_message "success" "PostgreSQL is running in Docker container: $DOCKER_CONTAINER_NAME"
        return 0
      else
        print_message "warning" "PostgreSQL Docker container is not running"
        return 1
      fi
    else
      print_message "error" "Docker is not installed but --docker option was specified"
      exit 1
    fi
  else
    # Try using pg_isready if available
    if command_exists pg_isready; then
      if pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
        print_message "success" "PostgreSQL is running on $DB_HOST:$DB_PORT"
        return 0
      else
        print_message "warning" "PostgreSQL is not running or not accessible"
        return 1
      fi
    else
      # Fall back to psql
      if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "SELECT 1" postgres > /dev/null 2>&1; then
        print_message "success" "PostgreSQL is running on $DB_HOST:$DB_PORT"
        return 0
      else
        print_message "warning" "PostgreSQL is not running or not accessible"
        return 1
      fi
    fi
  fi
}

# Start PostgreSQL if not running
start_postgres() {
  print_header "Starting PostgreSQL"
  
  if $USE_DOCKER; then
    # Check if container exists but is not running
    if docker ps -a | grep -q $DOCKER_CONTAINER_NAME; then
      print_message "info" "Starting existing Docker container: $DOCKER_CONTAINER_NAME"
      docker start $DOCKER_CONTAINER_NAME
    else
      print_message "info" "Creating and starting new PostgreSQL Docker container"
      docker run --name $DOCKER_CONTAINER_NAME -e POSTGRES_PASSWORD=$DB_PASSWORD -e POSTGRES_USER=$DB_USER -p $DB_PORT:5432 -d postgres:14
      
      # Wait for PostgreSQL to start
      print_message "info" "Waiting for PostgreSQL to start..."
      sleep 5
    fi
    
    # Update connection parameters for Docker
    DB_HOST="localhost"
  else
    # Try to start PostgreSQL using brew services
    if command_exists brew && brew list postgresql@14 &>/dev/null; then
      print_message "info" "Starting PostgreSQL using Homebrew"
      brew services start postgresql@14
      sleep 3
    elif command_exists brew && brew list postgresql &>/dev/null; then
      print_message "info" "Starting PostgreSQL using Homebrew"
      brew services start postgresql
      sleep 3
    else
      print_message "error" "PostgreSQL is not running and could not be started automatically"
      print_message "info" "Please start PostgreSQL manually and run this script again"
      exit 1
    fi
  fi
  
  # Verify PostgreSQL is now running
  if ! check_postgres_running; then
    print_message "error" "Failed to start PostgreSQL"
    exit 1
  fi
}

# Create test database if it doesn't exist
create_database() {
  print_header "Setting Up Test Database"
  
  # Check if database exists
  if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    print_message "info" "Database '$DB_NAME' already exists"
    
    # Ask if user wants to drop and recreate
    read -p "$(echo -e $YELLOW"Do you want to drop and recreate the database? (y/N) "$RESET)" choice
    case "$choice" in
      y|Y)
        print_message "info" "Dropping database '$DB_NAME'"
        PGPASSWORD=$DB_PASSWORD dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        print_message "info" "Creating fresh database '$DB_NAME'"
        PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        ;;
      *)
        print_message "info" "Using existing database '$DB_NAME'"
        ;;
    esac
  else
    print_message "info" "Creating database '$DB_NAME'"
    PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
  fi
}

# Install pgTAP extension
install_pgtap() {
  print_header "Installing pgTAP Extension"
  
  # Check if pgTAP is already installed
  if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap'" | grep -q 1; then
    print_message "success" "pgTAP extension is already installed"
  else
    print_message "info" "Installing pgTAP extension"
    
    if $USE_DOCKER; then
      print_message "warning" "Installing pgTAP in Docker requires additional steps"
      print_message "info" "Attempting to install pgTAP in Docker container..."
      
      # Execute commands in Docker container to install pgTAP
      docker exec -it $DOCKER_CONTAINER_NAME bash -c "
        apt-get update && \
        apt-get install -y postgresql-server-dev-14 make gcc git && \
        git clone https://github.com/theory/pgtap.git && \
        cd pgtap && \
        make && \
        make install
      "
    else
      # For local PostgreSQL, check if we can install pgTAP using package manager
      if command_exists brew && brew list pgtap &>/dev/null; then
        print_message "info" "pgTAP is installed via Homebrew"
      else
        print_message "warning" "pgTAP is not installed via package manager"
        print_message "info" "Attempting to install pgTAP from source..."
        
        # Create a temporary directory
        tmp_dir=$(mktemp -d)
        cd $tmp_dir
        
        # Clone and install pgTAP
        git clone https://github.com/theory/pgtap.git
        cd pgtap
        make
        sudo make install
        
        # Clean up
        cd -
        rm -rf $tmp_dir
      fi
    fi
    
    # Create the extension in the database
    print_message "info" "Creating pgTAP extension in database"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS pgtap;"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    
    # Verify installation
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap'" | grep -q 1; then
      print_message "success" "pgTAP extension installed successfully"
    else
      print_message "error" "Failed to install pgTAP extension"
      exit 1
    fi
  fi
}

# Apply database schema
apply_schema() {
  print_header "Applying Database Schema"
  
  # Check if migration file exists
  migration_file="supabase/migrations/20250722000000_canonical_database_consolidation.sql"
  if [ ! -f "$migration_file" ]; then
    print_message "error" "Migration file not found: $migration_file"
    exit 1
  fi
  
  print_message "info" "Applying migration: $migration_file"
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"
  
  print_message "success" "Database schema applied successfully"
}

# Run the security tests
run_tests() {
  print_header "Running Security Tests"
  
  # Set environment variables for the test runner
  export PGHOST=$DB_HOST
  export PGPORT=$DB_PORT
  export PGUSER=$DB_USER
  export PGPASSWORD=$DB_PASSWORD
  export PGDATABASE=$DB_NAME
  
  # Run the tests
  print_message "info" "Executing database security tests..."
  npm run test:db:security
  
  # Check the exit code
  if [ $? -eq 0 ]; then
    print_message "success" "Security tests passed!"
  else
    print_message "error" "Security tests failed"
    return 1
  fi
}

# Clean up after testing
cleanup() {
  if [ "$CLEANUP_AFTER" = true ]; then
    print_header "Cleaning Up"
    
    print_message "info" "Dropping test database: $DB_NAME"
    PGPASSWORD=$DB_PASSWORD dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER --if-exists $DB_NAME
    
    if $USE_DOCKER; then
      read -p "$(echo -e $YELLOW"Do you want to stop the Docker container? (y/N) "$RESET)" choice
      case "$choice" in
        y|Y)
          print_message "info" "Stopping Docker container: $DOCKER_CONTAINER_NAME"
          docker stop $DOCKER_CONTAINER_NAME
          ;;
      esac
    fi
    
    print_message "success" "Cleanup completed"
  else
    print_message "info" "Skipping cleanup. Database '$DB_NAME' has been preserved."
  fi
}

# Main function
main() {
  # Display banner
  echo -e "${BOLD}${BLUE}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║                                                           ║"
  echo "║            Card Show Finder Database Test Setup           ║"
  echo "║                                                           ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
  
  # Parse command line arguments
  parse_args "$@"
  
  # Check if PostgreSQL is running
  if ! check_postgres_running; then
    start_postgres
  fi
  
  # Create test database
  create_database
  
  # Install pgTAP extension
  install_pgtap
  
  # Apply database schema
  apply_schema
  
  # Run the security tests
  if ! run_tests; then
    cleanup
    exit 1
  fi
  
  # Clean up after testing
  cleanup
  
  print_message "success" "Database security test setup and execution completed successfully!"
}

# Run the main function
main "$@"
