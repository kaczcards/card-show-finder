#!/bin/bash
# setup-e2e-structure.sh
# 
# This script sets up the necessary directory structure for the E2E testing system
# with Detox and Jest, organized into batches for better progress tracking.
#
# Usage:
#   ./setup-e2e-structure.sh
#
# The script will create all required directories and ensure proper permissions.

set -e  # Exit immediately if a command exits with a non-zero status

# Define colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}     Setting up E2E Testing Directory Structure          ${NC}"
echo -e "${BLUE}=========================================================${NC}"

# Root directory of the project (parent of this script)
ROOT_DIR="$(pwd)"
E2E_DIR="${ROOT_DIR}/e2e"

# Function to create directory if it doesn't exist
create_dir() {
  if [ ! -d "$1" ]; then
    echo -e "${GREEN}Creating directory:${NC} $1"
    mkdir -p "$1"
  else
    echo -e "${YELLOW}Directory already exists:${NC} $1"
  fi
}

# Create main e2e directory structure
echo -e "\n${BLUE}Creating main E2E directory structure...${NC}"
create_dir "${E2E_DIR}"
create_dir "${E2E_DIR}/tests"
create_dir "${E2E_DIR}/helpers"
create_dir "${E2E_DIR}/config"
create_dir "${E2E_DIR}/scripts"
create_dir "${E2E_DIR}/artifacts"
create_dir "${E2E_DIR}/reports"
create_dir "${E2E_DIR}/data"

# Create test category subdirectories
echo -e "\n${BLUE}Creating test category subdirectories...${NC}"
create_dir "${E2E_DIR}/tests/auth"
create_dir "${E2E_DIR}/tests/home"
create_dir "${E2E_DIR}/tests/map"
create_dir "${E2E_DIR}/tests/shows"
create_dir "${E2E_DIR}/tests/profile"
create_dir "${E2E_DIR}/tests/dealer"

# Make scripts executable
echo -e "\n${BLUE}Setting up script permissions...${NC}"
chmod_script() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}Making executable:${NC} $1"
    chmod +x "$1"
  else
    echo -e "${YELLOW}Script not found:${NC} $1"
  fi
}

chmod_script "${E2E_DIR}/scripts/run-batch.js"
chmod_script "${E2E_DIR}/scripts/run-all-batches.js"

# Move existing test file if it exists
if [ -f "${E2E_DIR}/tests/authentication.test.js" ]; then
  echo -e "\n${BLUE}Moving existing authentication test to new structure...${NC}"
  cp "${E2E_DIR}/tests/authentication.test.js" "${E2E_DIR}/tests/auth/"
  echo -e "${YELLOW}Note: The original file was kept. You can delete it manually if needed.${NC}"
fi

# Create placeholder files to ensure Git tracks empty directories
touch "${E2E_DIR}/helpers/.gitkeep"
touch "${E2E_DIR}/config/.gitkeep"
touch "${E2E_DIR}/artifacts/.gitkeep"
touch "${E2E_DIR}/reports/.gitkeep"
touch "${E2E_DIR}/data/.gitkeep"

# Create README if it doesn't exist
if [ ! -f "${E2E_DIR}/README.md" ]; then
  echo -e "\n${BLUE}Creating E2E README file...${NC}"
  echo "# E2E Testing

This directory contains end-to-end tests using Detox and Jest.

See the main README-E2E-TESTING.md file in the project root for complete documentation." > "${E2E_DIR}/README.md"
fi

# Final success message
echo -e "\n${GREEN}=========================================================${NC}"
echo -e "${GREEN}     E2E Testing Directory Structure Setup Complete      ${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo -e "\nNext steps:"
echo -e "1. Run ${YELLOW}npm run test:e2e:build${NC} to build the app for testing"
echo -e "2. Run ${YELLOW}npm run test:e2e:auth${NC} to run the first batch of tests"
echo -e "3. See ${YELLOW}README-E2E-TESTING.md${NC} for complete documentation"
echo -e "\n${BLUE}Happy testing!${NC} 🚀\n"
