#!/usr/bin/env bash
# ================================================================
# DATABASE SECURITY TEST RUNNER
# ================================================================
# This script runs the pgTAP security tests for Card Show Finder
# with proper setup, error handling, and reporting.
#
# Usage:
#   ./run_security_tests.sh [options]
#
# Options:
#   -h, --help              Show this help message
#   -c, --ci                Run in CI mode (minimal output, exit code)
#   -v, --verbose           Show verbose output
#   -d, --database NAME     Database name (default: card_show_finder)
#   -u, --user NAME         Database user (default: postgres)
#   -p, --password PASS     Database password
#   -H, --host HOST         Database host (default: localhost)
#   -P, --port PORT         Database port (default: 5432)
#   -f, --file FILE         Test file to run (default: security_tests.sql)
#   --no-color              Disable colored output
#   --junit                 Output JUnit XML format (for CI systems)
# ================================================================

# Set default values
DB_NAME="card_show_finder"
DB_USER="postgres"
DB_PASSWORD=""
DB_HOST="localhost"
DB_PORT="5432"
TEST_FILE="$(dirname "$0")/security_tests.sql"
CI_MODE=false
VERBOSE=false
USE_COLOR=true
JUNIT_OUTPUT=false

# Function to show usage
show_usage() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -h, --help              Show this help message"
  echo "  -c, --ci                Run in CI mode (minimal output, exit code)"
  echo "  -v, --verbose           Show verbose output"
  echo "  -d, --database NAME     Database name (default: card_show_finder)"
  echo "  -u, --user NAME         Database user (default: postgres)"
  echo "  -p, --password PASS     Database password"
  echo "  -H, --host HOST         Database host (default: localhost)"
  echo "  -P, --port PORT         Database port (default: 5432)"
  echo "  -f, --file FILE         Test file to run (default: security_tests.sql)"
  echo "  --no-color              Disable colored output"
  echo "  --junit                 Output JUnit XML format (for CI systems)"
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
  
  if [ "$CI_MODE" = false ] || [ "$level" = "ERROR" ]; then
    echo -e "${color_code}[$level] $message\033[0m"
  fi
  
  if [ "$VERBOSE" = true ]; then
    echo -e "${color_code}[$level] $message\033[0m" >> "security_test_$(date +%Y%m%d_%H%M%S).log"
  fi
}

# Function to check dependencies
check_dependencies() {
  local missing_deps=false
  
  if ! command -v psql &> /dev/null; then
    log "ERROR" "PostgreSQL client (psql) is not installed"
    missing_deps=true
  fi
  
  if ! command -v pg_prove &> /dev/null; then
    log "ERROR" "pg_prove is not installed. Install with: cpan TAP::Parser::SourceHandler::pgTAP"
    missing_deps=true
  fi
  
  if [ "$missing_deps" = true ]; then
    log "ERROR" "Missing dependencies. Please install them and try again."
    exit 1
  fi
}

# Function to test database connection
test_connection() {
  local connection_string="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
  
  log "INFO" "Testing connection to database..."
  if ! psql "$connection_string" -c "SELECT 1" &> /dev/null; then
    log "ERROR" "Failed to connect to database. Check your credentials and try again."
    exit 1
  fi
  
  log "INFO" "Connection successful."
}

# Function to check if pgTAP is installed in the database
check_pgtap() {
  local connection_string="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
  
  log "INFO" "Checking if pgTAP is installed in the database..."
  if ! psql "$connection_string" -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap'" | grep -q "(1 row)"; then
    log "WARN" "pgTAP extension is not installed in the database."
    log "INFO" "Attempting to install pgTAP extension..."
    
    if ! psql "$connection_string" -c "CREATE EXTENSION IF NOT EXISTS pgtap;" &> /dev/null; then
      log "ERROR" "Failed to install pgTAP extension. Please install it manually."
      log "INFO" "You can install it by running: CREATE EXTENSION pgtap;"
      exit 1
    fi
    
    log "INFO" "pgTAP extension installed successfully."
  else
    log "INFO" "pgTAP extension is already installed."
  fi
}

# Function to run the tests
run_tests() {
  local connection_string="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
  local pg_prove_opts=""
  
  if [ "$VERBOSE" = true ]; then
    pg_prove_opts="$pg_prove_opts -v"
  fi
  
  if [ "$JUNIT_OUTPUT" = true ]; then
    pg_prove_opts="$pg_prove_opts --formatter=TAP::Formatter::JUnit"
    mkdir -p test-results
  fi
  
  log "INFO" "Running security tests..."
  
  if [ "$JUNIT_OUTPUT" = true ]; then
    pg_prove $pg_prove_opts -d "$connection_string" "$TEST_FILE" > test-results/security-tests.xml
  else
    pg_prove $pg_prove_opts -d "$connection_string" "$TEST_FILE"
  fi
  
  local test_result=$?
  
  if [ $test_result -eq 0 ]; then
    log "INFO" "Security tests passed successfully!"
  else
    log "ERROR" "Security tests failed with exit code $test_result"
  fi
  
  return $test_result
}

# Function to run tests with psql directly (fallback if pg_prove is not available)
run_tests_with_psql() {
  local connection_string="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
  
  log "INFO" "Running security tests with psql (fallback mode)..."
  
  psql "$connection_string" -f "$TEST_FILE"
  
  local test_result=$?
  
  if [ $test_result -eq 0 ]; then
    log "INFO" "Security tests completed. Check output for results."
  else
    log "ERROR" "Security tests failed with exit code $test_result"
  fi
  
  return $test_result
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_usage
      exit 0
      ;;
    -c|--ci)
      CI_MODE=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
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
    -f|--file)
      TEST_FILE="$2"
      shift 2
      ;;
    --no-color)
      USE_COLOR=false
      shift
      ;;
    --junit)
      JUNIT_OUTPUT=true
      shift
      ;;
    *)
      log "ERROR" "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

# Main execution
log "INFO" "Starting database security test runner"

# Check dependencies
check_dependencies

# Test database connection
test_connection

# Check if pgTAP is installed
check_pgtap

# Run the tests
if command -v pg_prove &> /dev/null; then
  run_tests
  exit_code=$?
else
  log "WARN" "pg_prove not found, falling back to psql"
  run_tests_with_psql
  exit_code=$?
fi

# Exit with the test result code
exit $exit_code
