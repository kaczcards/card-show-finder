#!/bin/bash
# cleanup_emergency_fixes.sh
# This script safely removes all emergency fix files now that we have the canonical consolidation.
# Created: July 22, 2025

# Set colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}        EMERGENCY FIX CLEANUP SCRIPT                     ${NC}"
echo -e "${BLUE}=========================================================${NC}"
echo -e "This script will clean up all emergency fix files now that"
echo -e "we have the canonical database consolidation in place."
echo -e "${YELLOW}Created: July 22, 2025${NC}\n"

# Define the repository root and migrations directory
REPO_ROOT="$(git rev-parse --show-toplevel)"
MIGRATIONS_DIR="${REPO_ROOT}/supabase/migrations"
BACKUP_DIR="${REPO_ROOT}/supabase/emergency_fixes_backup_$(date +%Y%m%d%H%M%S)"

# Check if we're in a git repository
if [ ! -d "${REPO_ROOT}/.git" ]; then
  echo -e "${RED}Error: Not in a git repository.${NC}"
  exit 1
fi

# Check if migrations directory exists
if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo -e "${RED}Error: Migrations directory not found at ${MIGRATIONS_DIR}${NC}"
  exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"
echo -e "${GREEN}Created backup directory: ${BACKUP_DIR}${NC}"

# Find all emergency fix files
echo -e "\n${BLUE}Searching for emergency fix files...${NC}"

# Define patterns to match
PATTERNS=(
  "fix-*.sql"
  "*emergency*fix*.sql"
  "*URGENT*FIX*.sql"
  "*EMERGENCY*.sql"
  "*hotfix*.sql"
  "*patch*.sql"
  "*CONSOLIDATED_RLS*.sql"
  "*recursive*fix*.sql"
  "*infinite*loop*.sql"
)

# Find files matching patterns
FILES_TO_REMOVE=()

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r file; do
    # Skip our canonical consolidation file
    if [[ "${file}" == *"canonical_database_consolidation"* ]]; then
      continue
    fi
    
    # Skip if file doesn't exist (in case of glob not matching)
    if [ ! -f "${file}" ]; then
      continue
    fi
    
    FILES_TO_REMOVE+=("${file}")
  done < <(find "${MIGRATIONS_DIR}" -name "${pattern}" -type f 2>/dev/null)
done

# Check for duplicate functionality by keywords
DUPLICATE_KEYWORDS=(
  "get_paginated_shows"
  "get_show_details_by_id"
  "create_show_with_coordinates"
  "get_conversations"
  "get_conversation_messages"
  "send_message"
  "participates_in_show"
  "show_participants"
  "RLS"
  "row_level_security"
)

for keyword in "${DUPLICATE_KEYWORDS[@]}"; do
  while IFS= read -r file; do
    # Skip our canonical consolidation file
    if [[ "${file}" == *"canonical_database_consolidation"* ]]; then
      continue
    fi
    
    # Skip if already in the list
    if [[ " ${FILES_TO_REMOVE[*]} " =~ " ${file} " ]]; then
      continue
    fi
    
    # Skip if file doesn't exist
    if [ ! -f "${file}" ]; then
      continue
    fi
    
    # Check if file contains the keyword
    if grep -q "${keyword}" "${file}"; then
      FILES_TO_REMOVE+=("${file}")
    fi
  done < <(find "${MIGRATIONS_DIR}" -name "*.sql" -type f 2>/dev/null)
done

# Remove duplicates from the list
FILES_TO_REMOVE=($(printf "%s\n" "${FILES_TO_REMOVE[@]}" | sort -u))

# Display files to be removed
if [ ${#FILES_TO_REMOVE[@]} -eq 0 ]; then
  echo -e "${GREEN}No emergency fix files found.${NC}"
  exit 0
fi

echo -e "\n${YELLOW}The following emergency fix files will be removed:${NC}"
for file in "${FILES_TO_REMOVE[@]}"; do
  echo -e "  - $(basename "${file}")"
done

echo -e "\n${BLUE}Total files to remove: ${#FILES_TO_REMOVE[@]}${NC}"

# Confirm with user
echo -e "\n${YELLOW}WARNING: This operation will remove the above files from the repository.${NC}"
echo -e "${YELLOW}A backup will be created at: ${BACKUP_DIR}${NC}"
echo -e "${YELLOW}Are you sure you want to proceed? (y/N)${NC}"
read -r CONFIRM

if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo -e "${RED}Operation cancelled.${NC}"
  exit 1
fi

# Backup and remove files
echo -e "\n${BLUE}Backing up and removing files...${NC}"
REMOVED_COUNT=0
BACKUP_COUNT=0

for file in "${FILES_TO_REMOVE[@]}"; do
  # Create backup
  BACKUP_FILE="${BACKUP_DIR}/$(basename "${file}")"
  cp "${file}" "${BACKUP_FILE}" && BACKUP_COUNT=$((BACKUP_COUNT + 1))
  
  # Remove file from git
  git rm "${file}" &>/dev/null && REMOVED_COUNT=$((REMOVED_COUNT + 1))
  
  echo -e "  ${GREEN}✓${NC} Backed up and removed: $(basename "${file}")"
done

# Create a summary file in the backup directory
SUMMARY_FILE="${BACKUP_DIR}/cleanup_summary.txt"
echo "Emergency Fix Cleanup Summary" > "${SUMMARY_FILE}"
echo "Date: $(date)" >> "${SUMMARY_FILE}"
echo "Total files removed: ${REMOVED_COUNT}" >> "${SUMMARY_FILE}"
echo "Total files backed up: ${BACKUP_COUNT}" >> "${SUMMARY_FILE}"
echo "" >> "${SUMMARY_FILE}"
echo "Files removed:" >> "${SUMMARY_FILE}"
for file in "${FILES_TO_REMOVE[@]}"; do
  echo "  - $(basename "${file}")" >> "${SUMMARY_FILE}"
done

# Final summary
echo -e "\n${BLUE}=========================================================${NC}"
echo -e "${GREEN}Cleanup completed successfully!${NC}"
echo -e "  ${BLUE}Total files removed:${NC} ${REMOVED_COUNT}"
echo -e "  ${BLUE}Total files backed up:${NC} ${BACKUP_COUNT}"
echo -e "  ${BLUE}Backup location:${NC} ${BACKUP_DIR}"
echo -e "  ${BLUE}Summary file:${NC} ${SUMMARY_FILE}"
echo -e "${BLUE}=========================================================${NC}"

# Suggest next steps
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Review the backup directory to ensure no important files were removed."
echo -e "2. Commit the changes with a message like:"
echo -e "   ${GREEN}git commit -m \"Cleanup: Removed emergency fix files after canonical consolidation\"${NC}"
echo -e "3. Push the changes to the repository."
echo -e "4. Verify that the application works correctly with the consolidated functions."

exit 0
