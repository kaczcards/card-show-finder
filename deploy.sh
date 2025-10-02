#!/bin/bash

# Deployment script for Card Show Finder authentication fixes
# This script commits and pushes all changes to GitHub

set -e  # Exit on error

echo "🚀 Card Show Finder - Deployment Script"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the card-show-finder directory"
    exit 1
fi

# Show current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Show what will be committed
echo "📋 Files to be committed:"
git status --short
echo ""

# Stage all changes
echo "📦 Staging all changes..."
git add -A

# Show a summary
echo ""
echo "📊 Summary of changes:"
git diff --cached --stat
echo ""

# Commit with a descriptive message
echo "💾 Creating commit..."
git commit -m "fix: resolve registration and authentication issues

- Fix infinite recursion in RLS policies by updating is_admin()
- Remove duplicate profile creation from signup flow
- Add email verification enforcement with EmailVerificationGuard
- Update password reset redirect URL to web page
- Improve error handling for missing profiles
- Update schema dump to reflect latest database state
- Add website password reset page

Fixes:
- Registration flow now creates profiles automatically via trigger
- Email verification enforced before app access
- Password reset emails now work with web redirect
- Login no longer fails with infinite recursion error

All changes tested locally and working correctly"

echo "✅ Commit created successfully!"
echo ""

# Push to remote
echo "🚢 Pushing to GitHub..."
git push origin $CURRENT_BRANCH

echo ""
echo "✅ Successfully deployed to GitHub!"
echo ""
echo "Next steps:"
echo "1. Build the app with: eas build --platform all --profile production"
echo "2. Or publish OTA update: npx expo publish --release-channel production"
echo ""
echo "🎉 Deployment complete!"
