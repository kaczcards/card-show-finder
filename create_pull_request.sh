#!/bin/bash
set -e

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Card Show Finder - Pull Request Creation ===${NC}"
echo -e "${BLUE}This script will create a PR for the recurring shows feature${NC}"
echo

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}GitHub CLI not found!${NC}"
    echo -e "Please install it first:"
    echo -e "  - macOS: brew install gh"
    echo -e "  - Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo -e "  - Windows: winget install --id GitHub.cli"
    exit 1
fi

# Check if we're in the card-show-finder directory
if [[ ! -d .git ]]; then
    echo -e "${YELLOW}This script must be run from the root of the card-show-finder repository.${NC}"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "implement-show-claiming-functionality" ]]; then
    echo -e "${YELLOW}Warning: You are not on the 'implement-show-claiming-functionality' branch.${NC}"
    echo -e "Current branch: ${CURRENT_BRANCH}"
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if PR description file exists
if [[ ! -f pr_description_recurring_shows.md ]]; then
    echo -e "${RED}PR description file 'pr_description_recurring_shows.md' not found!${NC}"
    exit 1
fi

# Check GitHub authentication status
echo -e "${BLUE}Checking GitHub authentication...${NC}"
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}You are not authenticated with GitHub CLI.${NC}"
    echo -e "Please authenticate now:"
    gh auth login
    
    # Check if authentication was successful
    if ! gh auth status &> /dev/null; then
        echo -e "${RED}Authentication failed. Please try again later.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Authentication successful!${NC}"

# Create the pull request
echo -e "${BLUE}Creating pull request...${NC}"
echo -e "From: ${CURRENT_BRANCH}"
echo -e "To: main"
echo

# Create the PR using the description file
gh pr create \
  --base main \
  --title "Recurring Shows & Organizer Dashboard" \
  --body-file pr_description_recurring_shows.md \
  --draft

# Check if PR creation was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Pull request created successfully!${NC}"
    echo -e "${YELLOW}Note: The PR was created as a draft. Review it and mark it as ready when appropriate.${NC}"
else
    echo -e "${RED}Failed to create pull request. Please check the error message above.${NC}"
    exit 1
fi

echo
echo -e "${BLUE}=== Next Steps ===${NC}"
echo -e "1. Review the PR in GitHub"
echo -e "2. Make any necessary changes"
echo -e "3. Run the migration steps from migration_instructions.md"
echo -e "4. Mark the PR as ready for review when you're satisfied"
echo
echo -e "${GREEN}Done!${NC}"
