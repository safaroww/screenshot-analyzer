#!/bin/bash

# Script to add the JS bundle to your Xcode project
# This helps automate the process of adding main.jsbundle to your app

set -e

echo "🔧 Adding main.jsbundle to Xcode project..."
echo ""

# Change to the mobile directory
cd "$(dirname "$0")"

# Check if bundle exists
if [ ! -f "ios/main.jsbundle" ]; then
    echo "❌ Error: main.jsbundle not found!"
    echo "Run this first:"
    echo "  npm run bundle:ios"
    exit 1
fi

echo "✅ Found main.jsbundle ($(du -h ios/main.jsbundle | cut -f1))"
echo ""
echo "📋 Next steps to add to Xcode:"
echo ""
echo "1. Open your project in Xcode:"
echo "   open ios/ScreenshotSummarize.xcworkspace"
echo ""
echo "2. In Xcode Project Navigator (left sidebar):"
echo "   - Right-click on 'ScreenshotSummarize' folder"
echo "   - Choose 'Add Files to ScreenshotSummarize...'"
echo "   - Select 'ios/main.jsbundle'"
echo "   - ✅ CHECK 'Copy items if needed'"
echo "   - Click 'Add'"
echo ""
echo "3. Verify it's in Copy Bundle Resources:"
echo "   - Click on project name (top of navigator)"
echo "   - Select 'ScreenshotSummarize' target"
echo "   - Go to 'Build Phases' tab"
echo "   - Expand 'Copy Bundle Resources'"
echo "   - You should see 'main.jsbundle' listed"
echo ""
echo "4. Clean and rebuild:"
echo "   - Cmd+Shift+K (Clean Build Folder)"
echo "   - Cmd+B (Build)"
echo "   - Run on your iPhone"
echo ""
echo "🚀 Opening Xcode now..."
open ios/ScreenshotSummarize.xcworkspace
