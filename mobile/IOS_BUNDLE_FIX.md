# iOS Bundle Fix - "No URL Provided" Error

## Problem
Your app crashes on iPhone with the error:
```
unsanitizedscripturlstring = (null)
```

This happens because the JavaScript bundle (`main.jsbundle`) is not included in your release build.

## Solution

### Option 1: Build Bundle Manually (Quick Fix)

1. **Navigate to your mobile directory:**
   ```bash
   cd /Users/lala/Desktop/dev_safaroww/analyzer/mobile
   ```

2. **Generate the JavaScript bundle:**
   ```bash
   npx expo export:embed --platform ios --entry-file App.tsx --bundle-output ios/main.jsbundle --assets-dest ios
   ```

3. **Add the bundle to Xcode:**
   - Open `ios/ScreenshotSummarize.xcworkspace` in Xcode
   - In the Project Navigator (left sidebar), right-click on the `ScreenshotSummarize` folder
   - Select "Add Files to ScreenshotSummarize..."
   - Navigate to and select `ios/main.jsbundle`
   - **IMPORTANT:** Make sure "Copy items if needed" is checked
   - Click "Add"

4. **Rebuild your app:**
   - In Xcode: Product → Clean Build Folder (Cmd+Shift+K)
   - Product → Build (Cmd+B)
   - Run on your iPhone

---

### Option 2: Automatic Bundle on Build (Recommended)

Add a build phase script so the bundle is automatically generated every time you build:

1. **Open your Xcode project:**
   ```bash
   open ios/ScreenshotSummarize.xcworkspace
   ```

2. **Add Bundle React Native Code Phase:**
   - Click on your project name in the Project Navigator
   - Select the "ScreenshotSummarize" target
   - Go to "Build Phases" tab
   - Click the "+" button at the top left
   - Select "New Run Script Phase"
   - Drag this new phase to be BEFORE "Compile Sources"
   - Name it: "Bundle React Native code and images"

3. **Add this script:**
   ```bash
   set -e

   export NODE_BINARY=node
   EXPO_PROJECT_ROOT="$SRCROOT/.."

   # For Release builds, bundle the JS
   if [ "${CONFIGURATION}" = "Release" ]; then
     cd "$EXPO_PROJECT_ROOT"
     npx expo export:embed --platform ios --entry-file App.tsx --bundle-output ios/main.jsbundle --assets-dest ios
   fi
   ```

4. **Add Input/Output Files (for faster builds):**
   - Still in the Run Script phase settings
   - Under "Input Files", add:
     ```
     $(SRCROOT)/../App.tsx
     $(SRCROOT)/../package.json
     ```
   - Under "Output Files", add:
     ```
     $(SRCROOT)/main.jsbundle
     ```

5. **Build and Test:**
   - Clean: Product → Clean Build Folder (Cmd+Shift+K)
   - Build: Product → Build (Cmd+B)
   - Run on your iPhone

---

### Option 3: Using Expo Application Services (EAS) Build

If you're using EAS Build, the bundle is automatically included:

1. **Install EAS CLI (if not already):**
   ```bash
   npm install -g eas-cli
   ```

2. **Configure and build:**
   ```bash
   cd /Users/lala/Desktop/dev_safaroww/analyzer/mobile
   eas build --platform ios --profile production
   ```

3. **Install the resulting .ipa on your device via TestFlight or direct installation**

---

## Verify the Fix

After implementing one of the solutions:

1. **Check the console logs:**
   - Open Xcode
   - Window → Devices and Simulators
   - Select your iPhone
   - Click "Open Console"
   - Run your app and look for:
     - `[RELEASE] Using embedded bundle: ...` (SUCCESS)
     - `[ERROR] CRITICAL: main.jsbundle not found` (FAILED - bundle not included)

2. **Verify bundle exists in build:**
   ```bash
   # After building, check if bundle is in the .app package:
   find ~/Library/Developer/Xcode/DerivedData -name "ScreenshotSummarize.app" -exec sh -c 'ls -lh "$1/main.jsbundle" 2>/dev/null || echo "Bundle not found in: $1"' _ {} \;
   ```

---

## Troubleshooting

### "Command not found: expo"
```bash
cd /Users/lala/Desktop/dev_safaroww/analyzer/mobile
npm install
```

### "Entry file not found"
Make sure your entry file is correct. Check your app.json or try:
```bash
npx expo export:embed --platform ios --entry-file node_modules/expo/AppEntry.js --bundle-output ios/main.jsbundle --assets-dest ios
```

### Bundle is created but still getting error
1. Make sure the bundle is **copied** into Xcode (not just referenced)
2. Check the bundle is in "Copy Bundle Resources" build phase:
   - Xcode → Target → Build Phases → Copy Bundle Resources
   - You should see `main.jsbundle` listed
   - If not, drag it there from the Project Navigator

### Assets not loading
If the JS bundle works but images/fonts don't load:
```bash
# Make sure assets are exported
npx expo export:embed --platform ios --entry-file App.tsx --bundle-output ios/main.jsbundle --assets-dest ios
```
Then add the asset folders to Xcode as references (not copied).

---

## Quick Debug Checklist

- [ ] `main.jsbundle` exists in `ios/` directory
- [ ] `main.jsbundle` is visible in Xcode Project Navigator
- [ ] `main.jsbundle` is listed in Build Phases → Copy Bundle Resources
- [ ] Build configuration is set to "Release" when building for device
- [ ] Clean build folder before rebuilding
- [ ] Check console logs for bundle path errors
- [ ] App built with valid provisioning profile and signing

---

## Prevention

To avoid this in the future:

1. Always use **Option 2** (automatic build script)
2. Or use **EAS Build** for production builds
3. Test release builds on device before distributing
4. Never rely on Metro bundler for release builds

---

## Additional Notes

- In **Debug** builds, the app connects to Metro bundler (localhost:8081)
- In **Release** builds, the app MUST use the embedded `main.jsbundle`
- Expo handles this automatically in development, but manual builds need explicit bundling

For more info: https://docs.expo.dev/workflow/customizing/
