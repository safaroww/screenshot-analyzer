#!/bin/bash

# Quick script to rebuild bundle for production and guide through Xcode setup

set -e

echo "🚀 Building Production Bundle for Vercel Backend"
echo "================================================"
echo ""

cd "$(dirname "$0")"

echo "✅ Using Vercel API: https://screenshot-analyzer-lovat.vercel.app/api"
echo ""

# Test if Vercel API is accessible
echo "📡 Testing Vercel API connection..."
if curl -s --max-time 5 https://screenshot-analyzer-lovat.vercel.app/api/health | grep -q "ok"; then
    echo "✅ Vercel API is online and responding!"
else
    echo "⚠️  Warning: Could not reach Vercel API. Check your deployment."
fi
echo ""

# Rebuild bundle
echo "📦 Building iOS bundle with production API..."
EXPO_PUBLIC_API_BASE_URL=https://screenshot-analyzer-lovat.vercel.app/api \
  npx expo export:embed \
    --platform ios \
    --entry-file index.js \
    --bundle-output ios/main.jsbundle \
    --assets-dest ios

echo ""
echo "✅ Bundle created: ios/main.jsbundle"
ls -lh ios/main.jsbundle
echo ""

# Verify URL is in bundle
echo "🔍 Verifying Vercel URL is in bundle..."
if grep -q "screenshot-analyzer-lovat.vercel.app" ios/main.jsbundle 2>/dev/null; then
    echo "✅ Confirmed: Bundle contains Vercel API URL"
else
    echo "⚠️  Warning: Could not verify URL in bundle"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS IN XCODE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Make sure main.jsbundle is in your Xcode project"
echo "   - Press Cmd+1 to open Project Navigator"
echo "   - Check if 'main.jsbundle' appears in ScreenshotSummarize folder"
echo "   - If not, right-click folder → Add Files → select ios/main.jsbundle"
echo ""
echo "2. ⚠️  IMPORTANT: Change to RELEASE mode"
echo "   - Click scheme dropdown at top (ScreenshotSummarize > Device)"
echo "   - Select 'Edit Scheme...'"
echo "   - In left sidebar, click 'Run'"
echo "   - Change 'Build Configuration' from Debug to 'Release'"
echo "   - Click 'Close'"
echo ""
echo "3. Clean and build:"
echo "   - Cmd+Shift+K (Clean Build Folder)"
echo "   - Cmd+B (Build)"
echo "   - Cmd+R (Run on device)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opening Xcode now..."
open ios/ScreenshotSummarize.xcworkspace

echo ""
echo "💡 TIP: The Metro/DevTools error only happens in Debug mode."
echo "    Once you switch to Release, it will use the embedded bundle"
echo "    and connect to your Vercel backend!"
echo ""
