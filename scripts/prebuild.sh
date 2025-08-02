#!/bin/bash
# scripts/prebuild.sh
# Helper script to run expo prebuild with proper environment variables
# Usage: ./scripts/prebuild.sh [ios|android|both] [--clean]

# Set strict error handling
set -e

# Default values
PLATFORM=""
CLEAN_FLAG=""
ENV_FILE=".env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to display usage information
show_usage() {
  echo "Usage: $0 [ios|android|both] [--clean]"
  echo ""
  echo "Arguments:"
  echo "  ios       Build only for iOS platform"
  echo "  android   Build only for Android platform"
  echo "  both      Build for both iOS and Android platforms"
  echo ""
  echo "Options:"
  echo "  --clean   Clear the native project files before building"
  echo ""
  echo "Examples:"
  echo "  $0 ios            # Build for iOS"
  echo "  $0 android        # Build for Android"
  echo "  $0 ios --clean    # Clean and build for iOS"
  echo "  $0 both --clean   # Clean and build for both platforms"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    ios|android|both)
      PLATFORM="$1"
      shift
      ;;
    --clean)
      CLEAN_FLAG="--clean"
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'"
      show_usage
      exit 1
      ;;
  esac
done

# Check if platform is specified
if [ -z "$PLATFORM" ]; then
  echo "Error: Platform not specified"
  show_usage
  exit 1
fi

# Change to project root directory
cd "$PROJECT_ROOT"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found in project root"
  echo "Please create a .env file with required environment variables:"
  echo "  - EXPO_PUBLIC_SUPABASE_URL"
  echo "  - EXPO_PUBLIC_SUPABASE_ANON_KEY"
  echo "  - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (optional)"
  echo "  - EXPO_PUBLIC_SENTRY_DSN (optional)"
  exit 1
fi

# Load environment variables from .env file
echo "Loading environment variables from $ENV_FILE..."
# Automatically export all variables while sourcing, then disable
set -a
source "$ENV_FILE"
set +a

# Verify critical environment variables are loaded
if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "Error: Required environment variables not found in .env file"
  echo "Please ensure your .env file contains:"
  echo "  - EXPO_PUBLIC_SUPABASE_URL"
  echo "  - EXPO_PUBLIC_SUPABASE_ANON_KEY"
  exit 1
fi

# Run prebuild based on platform
case "$PLATFORM" in
  ios)
    echo "Running prebuild for iOS platform${CLEAN_FLAG:+ with clean flag}..."
    npx expo prebuild --platform ios $CLEAN_FLAG
    ;;
  android)
    echo "Running prebuild for Android platform${CLEAN_FLAG:+ with clean flag}..."
    npx expo prebuild --platform android $CLEAN_FLAG
    ;;
  both)
    echo "Running prebuild for iOS platform${CLEAN_FLAG:+ with clean flag}..."
    npx expo prebuild --platform ios $CLEAN_FLAG
    
    echo "Running prebuild for Android platform${CLEAN_FLAG:+ with clean flag}..."
    npx expo prebuild --platform android $CLEAN_FLAG
    ;;
esac

echo "Prebuild completed successfully!"
echo "You can now run:"
echo "  - 'npx expo run:ios' to run on iOS simulator"
echo "  - 'npx expo run:android' to run on Android emulator"
