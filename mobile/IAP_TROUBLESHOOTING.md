# IAP Troubleshooting Guide

## Error: "App Store has not returned this subscription yet"

This error means the App Store cannot find your subscription products. Here are the most common causes and fixes:

### ✅ Checklist (Complete in Order)

#### 1. Verify Product IDs Match Exactly

**In App Store Connect:**
1. Go to **App Store Connect** → **My Apps** → **Your App**
2. Click **Monetization** → **Subscriptions** (or **In-App Purchases**)
3. Open each subscription and copy the **exact Product ID**
   - Example: `com.asif.screenshotanalyzer.promonthly`
   - Example: `com.asif.screenshotanalyzer.proyearly`

**In Your Code:**
1. Open `analyzer/mobile/.env`
2. Make sure these IDs **EXACTLY match** what you copied:
   ```env
   EXPO_PUBLIC_IAP_MONTHLY_ID=com.asif.screenshotanalyzer.promonthly
   EXPO_PUBLIC_IAP_YEARLY_ID=com.asif.screenshotanalyzer.proyearly
   ```
3. **No typos, no extra spaces, case-sensitive!**

---

#### 2. Attach Subscriptions to Your App Version

**This is the most common fix for "not returned" error:**

1. In **App Store Connect**, go to your app
2. Click on the **version you're testing** (left sidebar, e.g., "1.0.0" under "iOS App")
3. Scroll down to **"In-App Purchases and Subscriptions"** section
4. Click the **(+) button** 
5. **Check the box next to your subscriptions** (monthly and yearly)
6. Click **Done**
7. **Click "Save"** in the top right
8. ⚠️ **Important**: You may need to submit this version for review (even as a TestFlight build) for subscriptions to activate in sandbox

---

#### 3. Verify Subscription Status

Each subscription must be **"Ready to Submit"** or approved:

1. In **App Store Connect** → **Subscriptions**
2. Open each product
3. Check the status badge:
   - ✅ **"Ready to Submit"** or **"Approved"** = Good
   - ❌ **"Developer Action Needed"** = You need to fill in missing info (description, screenshot, etc.)
   - ❌ **"Missing Metadata"** = Add all required fields

4. Make sure you've completed:
   - Subscription display name
   - Description
   - Review screenshot (any screenshot showing the paywall)
   - Pricing for all territories

---

#### 4. Verify Bundle Identifier Matches

Your subscriptions are tied to your **bundle identifier**.

**Check in Xcode:**
1. Open `analyzer/mobile/ios/ScreenshotAnalyzer.xcworkspace` in Xcode
2. Select the **ScreenshotAnalyzer** project (top of file tree)
3. Select the **ScreenshotAnalyzer** target
4. Go to **"Signing & Capabilities"** tab
5. Verify **Bundle Identifier** = `com.asif.screenshotanalyzer`

**Check in app.config.js:**
```javascript
ios: {
  bundleIdentifier: "com.asif.screenshotanalyzer",  // Must match Xcode
}
```

**If they don't match**, your products won't be found!

---

#### 5. Verify Agreements & Banking

Apple won't serve subscriptions until contracts are signed:

1. Go to **App Store Connect** → **Agreements, Tax, and Banking**
2. Make sure **"Paid Applications"** agreement is:
   - Status: **Active** ✅
   - If **"Action Needed"**, click it and complete the forms

3. Add banking/tax info if missing

---

#### 6. Test with Sandbox Account

Real App Store accounts **cannot** purchase sandbox products.

**Create a Sandbox Tester:**
1. **App Store Connect** → **Users and Access** → **Sandbox Testers**
2. Click **(+)** to add a new tester
3. Use a **new email** (can be fake, but must be unique)
4. Remember the password

**On Your Test Device:**
1. Go to **Settings** → **App Store**
2. Scroll down to **SANDBOX ACCOUNT**
3. Sign in with your sandbox tester account
4. **OR** sign out of your real Apple ID and wait for the app to prompt you

**⚠️ Never sign into iCloud with a sandbox account!**

---

#### 7. Rebuild Your App

After changing product IDs or .env:

```bash
cd analyzer/mobile

# Clean everything
rm -rf ios/Pods ios/Podfile.lock
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData

# Reinstall pods
cd ios && pod install && cd ..

# Rebuild
npx expo run:ios
```

Or rebuild in Xcode (Cmd+Shift+K to clean, then Cmd+B to build).

---

#### 8. Add Debug Logging

Run this in your app to see what products are loaded:

1. Tap anywhere in the app to trigger debug info (if you added it)
2. Or add this button temporarily to `App.tsx`:

```tsx
import { collectIapDebugInfo } from './src/services/iap';

// In your render:
<Button 
  title="Debug IAP" 
  onPress={async () => {
    const info = await collectIapDebugInfo();
    console.log('IAP Debug:', JSON.stringify(info, null, 2));
    alert(JSON.stringify(info, null, 2));
  }}
/>
```

**Expected output when working:**
```json
{
  "initialized": true,
  "iapDisabled": false,
  "cachedProducts": [
    {
      "productId": "com.asif.screenshotanalyzer.promonthly",
      "title": "Pro Monthly",
      "price": "$8.99"
    },
    {
      "productId": "com.asif.screenshotanalyzer.proyearly",
      "title": "Pro Yearly",
      "price": "$59.99"
    }
  ],
  "subscriptionCount": 2,
  "hints": []
}
```

**If subscriptionCount = 0**, products aren't attached or IDs don't match!

---

## Quick Fix Summary

**Most common fix (90% of cases):**

1. **App Store Connect** → Your App → Version 1.0.0
2. Scroll to **"In-App Purchases and Subscriptions"**
3. Click **(+)** 
4. **Select your subscriptions**
5. **Save**
6. Rebuild the app
7. Test with a **sandbox account**

---

## Still Not Working?

### Check Product IDs in Logs

When you try to purchase, check Xcode console for:
```
[IAP] Requesting purchase for plan: monthly SKU: com.asif.screenshotanalyzer.promonthly
[IAP] ✅ Loaded 2 products: ["com.asif.screenshotanalyzer.promonthly", "com.asif.screenshotanalyzer.proyearly"]
```

If you see:
```
[IAP] ✅ Loaded 0 products
```

Then the products aren't attached or the IDs don't match!

### Alternative Product ID Format

Some developers use different formats. Try these if standard doesn't work:

**Option 1 (Current):**
```
com.asif.screenshotanalyzer.promonthly
com.asif.screenshotanalyzer.proyearly
```

**Option 2 (Without bundle prefix):**
```
promonthly
proyearly
```

**Option 3 (With different naming):**
```
com.asif.screenshotanalyzer.monthly_subscription
com.asif.screenshotanalyzer.yearly_subscription
```

The **EXACT** string must match what you created in App Store Connect!

---

## Testing Checklist

- [ ] Product IDs in `.env` match App Store Connect exactly
- [ ] Subscriptions are attached to app version in App Store Connect
- [ ] Subscription status is "Ready to Submit" or "Approved"
- [ ] Bundle identifier matches everywhere (Xcode, app.config.js, App Store Connect)
- [ ] Paid Applications agreement is Active
- [ ] Testing with a Sandbox account (not real Apple ID)
- [ ] Rebuilt the app after changing .env
- [ ] Can see products in console logs when app starts

---

## Need More Help?

1. Run the debug script and share the output
2. Check Xcode console for `[IAP]` logs
3. Screenshot the "In-App Purchases and Subscriptions" section in App Store Connect
4. Verify you're testing with a sandbox account
