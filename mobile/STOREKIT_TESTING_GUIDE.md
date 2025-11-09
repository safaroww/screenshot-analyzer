# 🚀 Test IAP Locally with StoreKit Configuration (No App Store Connect Needed!)

## Problem
Your first subscription requires submitting the app for App Review before it works in Sandbox. But you want to test NOW!

## Solution: StoreKit Configuration File

I've created `Products.storekit` which allows you to test IAP **completely offline** in Xcode.

---

## 📋 Setup Steps (2 Minutes)

### 1. Add StoreKit File to Xcode

1. Open `ScreenshotAnalyzer.xcworkspace` in Xcode (already open)
2. In the Project Navigator (left sidebar), **right-click** on the **ScreenshotAnalyzer** folder
3. Select **"Add Files to ScreenshotAnalyzer..."**
4. Navigate to: `/Users/lala/Desktop/dev_safaroww/analyzer/mobile/ios/`
5. Select **`Products.storekit`**
6. Make sure **"Copy items if needed"** is checked
7. Click **"Add"**

### 2. Configure Xcode Scheme

1. In Xcode, click on the **scheme dropdown** (next to the play button, says "ScreenshotAnalyzer")
2. Select **"Edit Scheme..."**
3. In the left sidebar, select **"Run"**
4. Go to the **"Options"** tab
5. Under **"StoreKit Configuration"**, select **`Products.storekit`**
6. Click **"Close"**

### 3. Build and Run

1. Press **Cmd+Shift+K** (Clean)
2. Press **Cmd+R** (Run)
3. The app will now use the local StoreKit file instead of App Store Connect!

---

## ✅ What This Does

- ✅ Loads your 2 subscriptions locally
- ✅ Shows real product info (Pro Monthly $8.99, Pro Yearly $59.99)
- ✅ Includes 7-day free trial
- ✅ Purchases work instantly
- ✅ NO App Store Connect needed
- ✅ NO sandbox account needed
- ✅ Works on Simulator AND Device

---

## 🧪 Test the Purchase

1. Launch the app (from Xcode)
2. Tap **"Upgrade to Pro"**
3. Select a plan
4. Tap **"Start Free Trial"**
5. A **local StoreKit dialog** will appear (looks different from real App Store)
6. Click **"Subscribe"**
7. Purchase completes immediately! ✅

---

## 🔍 Verify It's Working

**In Xcode Console**, you'll see:
```
[IAP] ✅ Successfully initialized!
[IAP] ✅ Loaded 2 products: ["com.asif.screenshotanalyzer.promonthly", "com.asif.screenshotanalyzer.proyearly"]
[IAP] 🛒 Requesting purchase...
[IAP] ✅ Purchase completed
```

**In the app:**
- Settings → Debug Purchases should show 2 products
- After purchase, you should see "Pro" badge

---

## 🎯 Manage Test Purchases in Xcode

While the app is running:

1. In Xcode, go to **Debug** → **StoreKit** → **Manage Transactions...**
2. You'll see a window showing all test purchases
3. You can:
   - View active subscriptions
   - Refund purchases
   - Expire subscriptions
   - Test renewals

This is MUCH easier than sandbox testing!

---

## 🔄 When to Switch Back to Real App Store

Once you're ready to test with real App Store Connect:

1. **Edit Scheme** again
2. Set **StoreKit Configuration** to **"None"**
3. Rebuild the app
4. Now it will use App Store Connect sandbox again

---

## 📝 Notes

- **StoreKit file is for TESTING ONLY** - it won't affect your production app
- Purchases made with StoreKit are **fake** and stored locally
- When you archive for TestFlight/App Store, StoreKit is ignored automatically
- This is Apple's official way to test IAP during development

---

## ⚡ Quick Commands

After adding the file and configuring the scheme:

```bash
# Clean and rebuild
cd /Users/lala/Desktop/dev_safaroww/analyzer/mobile
# In Xcode: Cmd+Shift+K then Cmd+R
```

---

## 🎉 Result

You can now test IAP **without waiting for App Review** or dealing with sandbox accounts!

Once your app is submitted/approved, you can switch back to testing with real App Store Connect if needed.
