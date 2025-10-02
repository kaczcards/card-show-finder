#!/bin/bash

# Card Show Finder - Android Development Helper Script
# This script sets up the Android environment and runs the app

echo "🚀 Starting Card Show Finder Android Development..."

# Set Android environment variables
export ANDROID_HOME=~/Library/Android/sdk
export ANDROID_SDK_ROOT=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools

# Check if emulator is running
if ! adb devices | grep -q "emulator.*device"; then
    echo "📱 Starting Android emulator (Pixel_4)..."
    nohup $ANDROID_HOME/emulator/emulator -avd Pixel_4 -no-snapshot-save > /tmp/emulator.log 2>&1 &
    
    echo "⏳ Waiting for emulator to boot up..."
    sleep 15
    
    # Wait for device to be ready
    while ! adb devices | grep -q "emulator.*device"; do
        echo "   Still waiting for emulator..."
        sleep 5
    done
    echo "✅ Emulator is ready!"
else
    echo "✅ Android emulator is already running"
fi

# Show connected devices
echo "📋 Connected Android devices:"
adb devices

# Build and run the app
echo "🏗️  Building and running Card Show Finder on Android..."
echo "   (This may take several minutes on first run)"
npx expo run:android

echo "🎉 Done! Your app should now be running on the Android emulator."
