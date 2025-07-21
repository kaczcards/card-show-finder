#!/usr/bin/env bash
# =================================================================
# Stripe Webhook Deployment Script for Supabase Edge Functions
# =================================================================
# 
# This script automates the deployment of Stripe webhook-related
# Edge Functions to Supabase. It includes:
#
# - Environment selection (dev, staging, prod)
# - Prerequisite checking
# - Deployment of stripe-webhook and create-payment-intent functions
# - Setting required environment variables
# - Verification of successful deployment
#
# Usage:
#   ./deploy-stripe-webhooks.sh [environment]
#
# Examples:
#   ./deploy-stripe-webhooks.sh dev
#   ./deploy-stripe-webhooks.sh staging
#   ./deploy-stripe-webhooks.sh prod
#
# Author: Card Show Finder Team
# Date: July 19, 2025
# =================================================================

# Text formatting
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RESET="\033[0m"

# Default values
DEFAULT_ENV="dev"
FUNCTIONS=("stripe-webhook" "create-payment-intent")
SHARED_DIR="_shared"

# Environment-specific project references
PROJECT_REF_DEV="your-dev-project-ref"
PROJECT_REF_STAGING="your-staging-project-ref"
PROJECT_REF_PROD="your-prod-project-ref"

# Required environment variables for the functions
REQUIRED_ENV_VARS=(
  "STRIPE_SECRET_KEY"
  "STRIPE_PUBLISHABLE_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
)

# Display banner
function show_banner() {
  echo -e "${BOLD}${BLUE}"
  echo "====================================================="
  echo "  Stripe Webhook Deployment - Card Show Finder"
  echo "====================================================="
  echo -e "${RESET}"
}

# Display usage information
function show_usage() {
  echo -e "Usage: ${BOLD}$0 [environment]${RESET}"
  echo ""
  echo "Environments:"
  echo "  dev       Deploy to development environment (default)"
  echo "  staging   Deploy to staging environment"
  echo "  prod      Deploy to production environment"
  echo ""
  echo "Examples:"
  echo "  $0 dev"
  echo "  $0 staging"
  echo "  $0 prod"
  echo ""
}

# Check if a command exists
function command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
function check_prerequisites() {
  echo -e "${BOLD}Checking prerequisites...${RESET}"
  
  # Check if Supabase CLI is installed
  if ! command_exists supabase; then
    echo -e "${RED}❌ Supabase CLI not found!${RESET}"
    echo "Please install the Supabase CLI:"
    echo "  npm install -g supabase"
    exit 1
  fi
  
  # Check Supabase CLI version
  local version=$(supabase --version)
  echo -e "✅ Supabase CLI installed: ${GREEN}$version${RESET}"
  
  # Check if we're in the repository root
  if [ ! -d "supabase" ] || [ ! -d "src" ]; then
    echo -e "${RED}❌ Please run this script from the repository root directory!${RESET}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Prerequisites check passed${RESET}\n"
}

# Load environment variables from .env file
function load_env_vars() {
  local env_file="supabase/.env"
  
  echo -e "${BOLD}Loading environment variables...${RESET}"
  
  if [ -f "$env_file" ]; then
    echo -e "📄 Loading from ${GREEN}$env_file${RESET}"
    export $(grep -v '^#' "$env_file" | xargs)
  else
    echo -e "${YELLOW}⚠️ No .env file found at $env_file${RESET}"
    echo -e "${YELLOW}⚠️ Make sure environment variables are set in the Supabase dashboard${RESET}"
  fi
  
  # Check for required environment variables
  local missing_vars=()
  for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
      missing_vars+=("$var")
    fi
  done
  
  if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️ Some required environment variables are not set:${RESET}"
    for var in "${missing_vars[@]}"; do
      echo -e "   - ${YELLOW}$var${RESET}"
    done
    echo -e "${YELLOW}⚠️ These will need to be set in the Supabase dashboard${RESET}"
  else
    echo -e "${GREEN}✅ All required environment variables are set${RESET}"
  fi
  
  echo ""
}

# Get project reference for the selected environment
function get_project_ref() {
  local env=$1
  
  case "$env" in
    dev)
      echo "$PROJECT_REF_DEV"
      ;;
    staging)
      echo "$PROJECT_REF_STAGING"
      ;;
    prod)
      echo "$PROJECT_REF_PROD"
      ;;
    *)
      echo ""
      ;;
  esac
}

# Deploy a single function
function deploy_function() {
  local function_name=$1
  local project_ref=$2
  local env=$3
  
  echo -e "${BOLD}Deploying ${BLUE}$function_name${RESET}${BOLD} to ${YELLOW}$env${RESET}${BOLD}...${RESET}"
  
  # Check if the function directory exists
  if [ ! -d "supabase/functions/$function_name" ]; then
    echo -e "${RED}❌ Function directory not found: supabase/functions/$function_name${RESET}"
    return 1
  fi
  
  # Deploy the function
  echo -e "🚀 Running deployment command..."
  if supabase functions deploy "$function_name" --project-ref "$project_ref" --no-verify-jwt; then
    echo -e "${GREEN}✅ Successfully deployed $function_name${RESET}"
    return 0
  else
    echo -e "${RED}❌ Failed to deploy $function_name${RESET}"
    return 1
  fi
}

# Deploy shared files (if needed)
function deploy_shared_files() {
  local project_ref=$1
  local env=$2
  
  echo -e "${BOLD}Checking for shared files...${RESET}"
  
  # Check if the shared directory exists
  if [ ! -d "supabase/functions/$SHARED_DIR" ]; then
    echo -e "${YELLOW}⚠️ No shared directory found at supabase/functions/$SHARED_DIR${RESET}"
    return 0
  fi
  
  echo -e "📦 Shared directory found, deploying..."
  
  # Since Supabase doesn't directly support deploying shared files,
  # we copy them to each function directory before deployment
  for func in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$func" ]; then
      echo -e "📋 Copying shared files to $func..."
      mkdir -p "supabase/functions/$func/$SHARED_DIR"
      cp -r "supabase/functions/$SHARED_DIR/"* "supabase/functions/$func/$SHARED_DIR/"
    fi
  done
  
  echo -e "${GREEN}✅ Shared files prepared for deployment${RESET}\n"
}

# Verify the deployment
function verify_deployment() {
  local project_ref=$1
  local env=$2
  
  echo -e "${BOLD}Verifying deployment...${RESET}"
  
  # List deployed functions
  echo -e "📋 Listing deployed functions..."
  supabase functions list --project-ref "$project_ref"
  
  # Check if our functions are in the list
  local success=true
  for func in "${FUNCTIONS[@]}"; do
    if ! supabase functions list --project-ref "$project_ref" | grep -q "$func"; then
      echo -e "${RED}❌ Function $func not found in deployed functions${RESET}"
      success=false
    fi
  done
  
  if $success; then
    echo -e "${GREEN}✅ All functions successfully deployed${RESET}"
  else
    echo -e "${RED}❌ Some functions failed to deploy${RESET}"
    return 1
  fi
  
  echo ""
}

# Display next steps
function show_next_steps() {
  local env=$1
  local project_ref=$2
  
  echo -e "${BOLD}${BLUE}Next Steps:${RESET}"
  echo -e "1. ${BOLD}Configure Stripe Webhook Endpoint${RESET}"
  echo "   - Go to Stripe Dashboard → Developers → Webhooks → Add Endpoint"
  echo "   - Set the endpoint URL to:"
  echo -e "     ${BOLD}https://$project_ref.functions.supabase.co/stripe-webhook${RESET}"
  echo "   - Select events to listen for (payment_intent.succeeded, etc.)"
  echo ""
  echo -e "2. ${BOLD}Set Webhook Secret${RESET}"
  echo "   - After creating the endpoint, copy the Signing Secret"
  echo "   - Set it in Supabase Dashboard → Settings → Functions → Environment Variables"
  echo "   - Key: STRIPE_WEBHOOK_SECRET"
  echo ""
  echo -e "3. ${BOLD}Test the Webhook${RESET}"
  echo "   - Use the test script: node scripts/test-stripe-webhook.js payment_intent.succeeded"
  echo ""
  echo -e "4. ${BOLD}Verify in Database${RESET}"
  echo "   - Check for entries in the webhook_logs table"
  echo ""
  echo -e "For detailed instructions, see: ${BOLD}docs/STRIPE_WEBHOOK_SETUP.md${RESET}"
  echo ""
}

# Main function
function main() {
  # Show banner
  show_banner
  
  # Parse arguments
  local env=${1:-$DEFAULT_ENV}
  
  # Validate environment
  case "$env" in
    dev|staging|prod)
      ;;
    help|-h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Invalid environment: $env${RESET}"
      show_usage
      exit 1
      ;;
  esac
  
  # Get project reference
  local project_ref=$(get_project_ref "$env")
  if [ -z "$project_ref" ]; then
    echo -e "${RED}❌ Project reference not configured for environment: $env${RESET}"
    echo "Please edit this script and set PROJECT_REF_$env"
    exit 1
  fi
  
  echo -e "${BOLD}Deploying to ${YELLOW}$env${RESET}${BOLD} environment (project: ${BLUE}$project_ref${RESET}${BOLD})${RESET}\n"
  
  # Check prerequisites
  check_prerequisites
  
  # Load environment variables
  load_env_vars
  
  # Deploy shared files if needed
  deploy_shared_files "$project_ref" "$env"
  
  # Deploy each function
  local failures=0
  for func in "${FUNCTIONS[@]}"; do
    if ! deploy_function "$func" "$project_ref" "$env"; then
      failures=$((failures+1))
    fi
    echo ""
  done
  
  # Verify deployment
  verify_deployment "$project_ref" "$env"
  
  # Show summary
  if [ $failures -eq 0 ]; then
    echo -e "${GREEN}${BOLD}🎉 All functions deployed successfully!${RESET}"
    show_next_steps "$env" "$project_ref"
  else
    echo -e "${RED}${BOLD}❌ Deployment completed with $failures failures${RESET}"
    exit 1
  fi
}

# Run the main function
main "$@"
