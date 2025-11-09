# New Mac Setup Guide

Complete setup instructions for running Screenshot Analyzer on a new MacBook.

---

## Step 1: Clone Repository

```bash
git clone https://github.com/safaroww/screenshot-analyzer.git
cd screenshot-analyzer/analyzer
```

---

## Step 2: Create .env File

```bash
cd mobile
nano .env
```

Paste this content:

```properties
# Production API endpoint on Vercel
EXPO_PUBLIC_API_BASE_URL=https://screenshot-analyzer-lovat.vercel.app/api

# In-App Purchase Product IDs
EXPO_PUBLIC_IAP_MONTHLY_ID=com.asif.screenshotanalyzer.promonthly
EXPO_PUBLIC_IAP_YEARLY_ID=com.asif.screenshotanalyzer.proyearly
```

Save with: `Ctrl+O`, `Enter`, then `Ctrl+X`

---

## Step 3: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install iOS dependencies
cd ios
pod install
cd ..
```

---

## Step 4: Open in Xcode

```bash
open ios/ScreenshotAnalyzer.xcworkspace
```

**⚠️ Important:** Open `.xcworkspace`, NOT `.xcodeproj`

---

## Step 5: Configure Xcode

### 1. Sign in to Apple Developer:
- Xcode → Settings → Accounts
- Click `+` → Add Apple ID
- Sign in with your developer account

### 2. Select Development Team:
- Select `ScreenshotAnalyzer` target in project navigator
- Go to "Signing & Capabilities" tab
- Team: Select your Apple Developer team from dropdown

---

## Step 6: Run the App

### Option A - Run on Simulator:
```bash
# From mobile folder
npm run ios
```

### Option B - Run on Physical Device:
1. Connect your iPhone via USB
2. Select your device in Xcode toolbar (top bar)
3. Click ▶️ Run button
4. Trust the developer certificate on your iPhone if prompted

---

## Step 7: Test In-App Purchases (Local Testing)

1. In Xcode: `Product` → `Scheme` → `Edit Scheme`
2. Left sidebar: Select `Run`
3. Options tab → StoreKit Configuration
4. Select `Products.storekit`
5. Click Close
6. Run the app - IAP will work with test subscriptions!

**Test Subscriptions Available:**
- Monthly: $8.99/month (7-day free trial)
- Yearly: $59.99/year (7-day free trial)

---

## Troubleshooting

### Command not found: npm
```bash
# Install Node.js first
brew install node
```

### Command not found: pod
```bash
# Install CocoaPods
sudo gem install cocoapods
```

### Build fails with pod errors
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### "Failed to register bundle identifier"
- This is normal - bundle ID is already registered
- Just select your team in Signing & Capabilities

### StoreKit Configuration not working
- Make sure you selected `.xcworkspace` not `.xcodeproj`
- Verify `Products.storekit` file exists in `ios/` folder
- Clean build folder: Xcode → Product → Clean Build Folder

---

## What's Already Configured

✅ Bundle ID: `com.asif.screenshotanalyzer`  
✅ App Icon & Splash Screen  
✅ In-App Purchase capability enabled  
✅ StoreKit Configuration with both subscription products  
✅ Privacy policy & Support pages (live on GitHub Pages)  
✅ App submitted for App Store review  

---

## Next Steps After Setup

1. Build and run the app to verify everything works
2. Test IAP purchases using StoreKit Configuration
3. Once app is approved by Apple, switch to real App Store testing
4. Monitor App Store Connect for review status

---

**Need Help?**  
All Xcode project settings, entitlements, and configurations are preserved from your original Mac. The app should work identically!
