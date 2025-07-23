#!/bin/bash
# fix-build-reliability.sh
# Comprehensive script to fix Hermes engine conflicts and standardize build configuration
# July 2025

# Exit on error
set -e

# Print commands before executing
set -x

echo "===== Card Show Finder: Build Reliability Fix ====="
echo "This script will standardize Hermes configuration across platforms"
echo "and clean all caches to ensure consistent builds."

# Check for required tools
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed. Install with 'brew install jq'"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node is required"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "Error: npx is required"; exit 1; }

# Create backup directory
BACKUP_DIR="./build-config-backups-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup current configuration files
echo "Backing up configuration files..."
cp android/gradle.properties "$BACKUP_DIR/gradle.properties.bak" || echo "Warning: Could not backup gradle.properties"
cp ios/Podfile.properties.json "$BACKUP_DIR/Podfile.properties.json.bak" || echo "Warning: Could not backup Podfile.properties.json"
cp metro.config.js "$BACKUP_DIR/metro.config.js.bak" || echo "Warning: Could not backup metro.config.js"

# Step 1: Update Android configuration
echo "Updating Android configuration to use Hermes..."
if grep -q "hermesEnabled=" android/gradle.properties; then
  # Replace existing hermesEnabled line
  sed -i.bak 's/hermesEnabled=false/hermesEnabled=true/g' android/gradle.properties
  # Also ensure newArchEnabled is set to false for consistency
  sed -i.bak 's/newArchEnabled=true/newArchEnabled=false/g' android/gradle.properties
else
  # Add hermesEnabled if it doesn't exist
  echo "hermesEnabled=true" >> android/gradle.properties
fi
echo "Android configuration updated."

# Step 2: Update iOS configuration
echo "Updating iOS configuration to use Hermes..."
if [ -f ios/Podfile.properties.json ]; then
  # Use jq to update or add the expo.jsEngine property
  jq '.["expo.jsEngine"]="hermes" | .["newArchEnabled"]="false"' ios/Podfile.properties.json > ios/Podfile.properties.json.tmp
  mv ios/Podfile.properties.json.tmp ios/Podfile.properties.json
  echo "iOS configuration updated."
else
  echo "Error: ios/Podfile.properties.json not found. Run 'npx expo prebuild' first."
  exit 1
fi

# Step 3: Update Metro configuration
echo "Updating Metro configuration..."
# Create a backup of the original file
cp metro.config.js "$BACKUP_DIR/metro.config.js.original"

# Use sed to remove the hermesEnabled line if it exists
sed -i.bak '/hermesEnabled: true/d' metro.config.js
echo "Metro configuration updated."

# Step 4: Clear all caches
echo "Clearing caches and build artifacts..."

# Clear Watchman cache
echo "Clearing Watchman cache..."
watchman watch-del-all || echo "Warning: watchman not installed or failed"

# Clear Metro cache
echo "Clearing Metro cache..."
rm -rf $TMPDIR/metro-* || echo "Warning: Could not clear Metro cache"

# Clear React Native cache
echo "Clearing React Native cache..."
rm -rf $TMPDIR/react-* || echo "Warning: Could not clear React Native cache"

# Clear Expo cache
echo "Clearing Expo cache..."
rm -rf .expo || echo "Warning: Could not clear Expo cache"

# Clear derived data (Xcode)
echo "Clearing Xcode derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* || echo "Warning: Could not clear Xcode derived data"

# Clear build artifacts
echo "Clearing build artifacts..."
rm -rf ios/build android/app/build android/.gradle || echo "Warning: Could not clear all build artifacts"

# Clear Pods
echo "Clearing iOS Pods..."
rm -rf ios/Pods ios/Podfile.lock || echo "Warning: Could not clear iOS Pods"

# Step 5: Regenerate native projects
echo "Regenerating native projects..."
npx expo prebuild --clean || { echo "Error: Failed to regenerate native projects"; exit 1; }

# Step 6: Reinstall node modules (optional but recommended)
echo "Would you like to reinstall node modules? (y/n)"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Reinstalling node modules..."
  rm -rf node_modules
  npm install
fi

# Step 7: Rebuild iOS
echo "Rebuilding iOS..."
cd ios
pod install --repo-update || { echo "Error: pod install failed"; exit 1; }
cd ..

# Step 8: Rebuild Android
echo "Rebuilding Android..."
cd android
./gradlew clean || { echo "Error: gradlew clean failed"; exit 1; }
cd ..

# Step 9: Verify configuration
echo "Verifying configuration..."
echo "Checking Android Hermes configuration..."
grep "hermesEnabled=true" android/gradle.properties || { echo "Error: Android Hermes configuration not applied correctly"; exit 1; }

echo "Checking iOS Hermes configuration..."
jq -e '.["expo.jsEngine"] == "hermes"' ios/Podfile.properties.json > /dev/null || { echo "Error: iOS Hermes configuration not applied correctly"; exit 1; }

echo "===== Build Reliability Fix Complete ====="
echo "To test the changes, run:"
echo "  npx expo run:ios"
echo "  npx expo run:android"
echo ""
echo "If you encounter any issues, you can restore the backups from: $BACKUP_DIR"
echo ""
echo "Remember to commit these changes to your repository."
