#!/bin/bash

# move-resized-images.sh
# Script to replace large images in assets/stock/ with resized versions from assets/stock-resized/
# Created for Card Show Finder app

# Set the base directory to the current script location
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STOCK_DIR="$BASE_DIR/assets/stock"
RESIZED_DIR="$BASE_DIR/assets/stock-resized"
BACKUP_DIR="$BASE_DIR/assets/stock-backup-$(date +%Y%m%d%H%M%S)"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if directories exist
if [ ! -d "$STOCK_DIR" ]; then
  print_message "$RED" "Error: Stock directory not found at $STOCK_DIR"
  exit 1
fi

if [ ! -d "$RESIZED_DIR" ]; then
  print_message "$RED" "Error: Resized directory not found at $RESIZED_DIR"
  exit 1
fi

# Create backup directory
print_message "$YELLOW" "Creating backup of original images in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Copy original files to backup
cp "$STOCK_DIR"/*.jpg "$BACKUP_DIR/" 2>/dev/null
if [ $? -ne 0 ]; then
  print_message "$RED" "Warning: Could not create complete backup. Proceeding anyway..."
else
  print_message "$GREEN" "Backup created successfully."
fi

# Count files
original_count=$(ls -1 "$STOCK_DIR"/*.jpg 2>/dev/null | wc -l)
resized_count=$(ls -1 "$RESIZED_DIR"/*.jpg 2>/dev/null | wc -l)
print_message "$YELLOW" "Found $original_count original images and $resized_count resized images."

# Replace original files with resized versions
print_message "$YELLOW" "Replacing original files with resized versions..."
replaced_count=0

for resized_file in "$RESIZED_DIR"/*.jpg; do
  filename=$(basename "$resized_file")
  if [ -f "$STOCK_DIR/$filename" ]; then
    original_size=$(du -h "$STOCK_DIR/$filename" | cut -f1)
    resized_size=$(du -h "$resized_file" | cut -f1)
    
    cp "$resized_file" "$STOCK_DIR/$filename"
    if [ $? -eq 0 ]; then
      replaced_count=$((replaced_count + 1))
      print_message "$GREEN" "✓ Replaced $filename ($original_size → $resized_size)"
    else
      print_message "$RED" "✗ Failed to replace $filename"
    fi
  else
    print_message "$YELLOW" "! Original file $filename not found, skipping"
  fi
done

# Summary
print_message "$GREEN" "\n===== Summary ====="
print_message "$GREEN" "Total files processed: $replaced_count of $resized_count"
print_message "$GREEN" "Original files backed up to: $BACKUP_DIR"
print_message "$GREEN" "To restore originals: cp $BACKUP_DIR/*.jpg $STOCK_DIR/"
print_message "$YELLOW" "\nNext steps:"
print_message "$YELLOW" "1. Run 'npx expo start --clear' to clear the cache"
print_message "$YELLOW" "2. Verify the app loads correctly with the resized images"

exit 0
