# iOS Subscription App - Complete Setup Guide for AI Agents

## Project Context
You are helping build an iOS app with:
- React Native / Expo framework
- OpenAI API integration for AI features
- Auto-renewable subscriptions (Monthly + Yearly plans)
- Free trial period (7 days)
- Vercel serverless backend
- TypeScript/JavaScript

---

## 1. APP STORE CONNECT SETUP

### A. Create App
1. App Store Connect → My Apps → + icon → New App
2. Fill in:
   - Platform: iOS
   - Name: [App Name]
   - Primary Language: English
   - Bundle ID: Create new (format: com.yourcompany.appname)
   - SKU: unique identifier (e.g., com.yourcompany.appname.001)
   - User Access: Full Access

### B. App Information
1. Privacy Policy URL: `https://yourusername.github.io/yourapp/privacy-policy.html`
2. Category: Choose appropriate (e.g., Productivity, Utilities)
3. Content Rights: Check if using third-party content
4. Age Rating: Complete questionnaire

### C. Pricing and Availability
- Price: Free (app is free, subscriptions are in-app)
- Availability: All countries or select specific ones

---

## 2. IN-APP PURCHASE SETUP (SUBSCRIPTIONS)

### A. Create Subscription Group
1. Features → In-App Purchases → Manage → Subscriptions
2. Create Subscription Group
   - Reference Name: "Premium Subscription" (internal only)
   - App Name: Display name shown to users

### B. Create Monthly Subscription
1. Inside Subscription Group → + icon
2. Fill in:
   - **Reference Name**: "Pro Monthly" (internal)
   - **Product ID**: `com.yourcompany.appname.promonthly` (MUST match code)
   - **Subscription Duration**: 1 Month
3. Subscription Prices:
   - Add pricing for all territories
   - USA: Set your price (e.g., $8.99)
4. **Add Introductory Offer**:
   - Type: Free Trial
   - Duration: 7 days (or your preferred length)
   - Territories: All countries
5. Localizations:
   - Subscription Display Name: "Pro Monthly"
   - Description: Brief description of benefits
6. Review Information:
   - Screenshot: Upload screenshot showing subscription benefits
7. Save → Submit for Review

### C. Create Yearly Subscription
1. Repeat steps for Monthly
2. Product ID: `com.yourcompany.appname.proyearly`
3. Duration: 1 Year
4. Price: Set annual price (e.g., $59.99)
5. Add same 7-day free trial
6. Save → Submit for Review

### D. Important Settings
**Billing Grace Period:**
- Edit Subscription Group
- Grace Period Duration: 3 days (recommended)
- Eligible Subscribers: All Renewals
- Server Environments: Only Sandbox Environment (for testing)

**Streamlined Purchasing:**
- Turn ON (allows purchases outside your app)

---

## 3. MOBILE APP CODE STRUCTURE

### A. Required Dependencies (package.json)

Dependencies needed:
- expo: latest
- react-native: latest
- react-native-iap: ^12.x.x
- expo-camera: latest
- expo-image-picker: latest
- expo-image-manipulator: latest
- @react-native-async-storage/async-storage: latest
- react-native-safe-area-context: latest

### B. Environment Variables (.env)

App Store Connect Product IDs:
EXPO_PUBLIC_IAP_MONTHLY_ID=com.yourcompany.appname.promonthly
EXPO_PUBLIC_IAP_YEARLY_ID=com.yourcompany.appname.proyearly

Backend API:
EXPO_PUBLIC_API_BASE_URL=https://yourapp.vercel.app/api

Optional - Disable IAP for testing:
EXPO_PUBLIC_IAP_DISABLED=false

### C. IAP Service Structure (src/services/iap.ts)

Key Functions Needed:
- initIAP() - Initialize connection to App Store
- requestPlan(plan: monthly or yearly) - Purchase subscription
- checkActiveSubscriptionQuiet() - Check subscription status without prompting login
- setSubscribed(boolean) - Store subscription state locally

Critical Implementation Details:

Product IDs from env:
const SUBS_IDS = {
  monthly: process.env.EXPO_PUBLIC_IAP_MONTHLY_ID,
  yearly: process.env.EXPO_PUBLIC_IAP_YEARLY_ID,
}

Initialize on app start:
await initIAP()

Listen for purchase updates:
purchaseUpdateSub = RNIap.purchaseUpdatedListener(async (purchase) => {
  await setSubscribed(true)
  await RNIap.finishTransaction({ purchase, isConsumable: false })
})

Handle purchases:
await RNIap.requestSubscription({
  sku: SUBS_IDS.monthly,
  andDangerouslyFinishTransactionAutomaticallyIOS: false,
})

### D. Subscription State Management (src/store/subscription.ts)

Store in AsyncStorage:
const KEYS = {
  IS_SUBSCRIBED: 'ss.isSubscribed',
  FREE_ANALYSES_USED: 'ss.freeAnalysesUsed',
  LAST_RESET_DATE: 'ss.lastResetDate',
}

Daily free limit logic:
export async function incrementFreeCount() {
  const state = await getSubscriptionState()
  const today = new Date().toDateString()
  const lastReset = await AsyncStorage.getItem(KEYS.LAST_RESET_DATE)
  
  // Reset counter if new day
  if (lastReset !== today) {
    await AsyncStorage.setItem(KEYS.FREE_ANALYSES_USED, '0')
    await AsyncStorage.setItem(KEYS.LAST_RESET_DATE, today)
  }
  
  // Increment
  const count = state.freeAnalysesUsed + 1
  await AsyncStorage.setItem(KEYS.FREE_ANALYSES_USED, String(count))
}

### E. Paywall Component (src/components/Paywall.tsx)

Key Features:
- Two plan cards (Monthly/Yearly)
- "1 week free" badge on both plans
- Radio button selection
- Loading states during purchase
- Terms/Privacy/EULA links at bottom
- "Not now" close button (enabled after 5 seconds)
- Restore Purchases button (optional, can just show info message)

Important UI Text:
Monthly: "$X.XX / month"
         "Then $X.XX/month after free trial"

Yearly:  "$X.XX / year"  
         "$X.XX/month, then $X.XX/year after free trial"

Button: "Start Free Trial"
Terms: "Renews automatically after trial. Cancel anytime."

---

## 4. BACKEND SERVER SETUP (VERCEL)

### A. File Structure

server/
├── package.json
├── vercel.json
└── api/
    ├── analyze.js          (Main AI endpoint)
    ├── health.js           (Health check)
    └── validate-receipt.js (iOS receipt validation)

### B. Environment Variables (Vercel Dashboard)

OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4o

### C. API Endpoint (api/analyze.js)

import OpenAI from 'openai'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  // Parse multipart form data
  const { files } = await parseMultipart(req)
  const imageBuffer = await fs.readFile(files.image.filepath)
  
  // Convert to base64
  const b64 = imageBuffer.toString('base64')
  
  // Call OpenAI
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this image...' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 }}
      ]
    }],
    response_format: { type: 'json_object' }
  })
  
  // Return results
  res.json(JSON.parse(completion.choices[0].message.content))
}

### D. Model Selection & Pricing
**Recommended: gpt-4o**
- Cost: ~$0.009 per image analysis
- Much better quality than gpt-4o-mini
- Still affordable for subscription apps

**Alternative: gpt-4o-mini**
- Cost: ~$0.0005 per image analysis
- Lower quality but very cheap
- Good for MVP/testing

---

## 5. PRIVACY POLICY & LEGAL PAGES

### A. Required Pages (GitHub Pages)
Create repository: https://github.com/yourusername/yourapp

Structure:
yourapp/
├── privacy-policy.html
├── terms-of-use.html
└── support.html

### B. Privacy Policy Template

HTML file content:
<!DOCTYPE html>
<html>
<head>
    <title>Privacy Policy - Your App Name</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        h2 { font-size: 18px; margin-top: 20px; }
        p { line-height: 1.6; }
    </style>
</head>
<body>
    <h1>Privacy Policy</h1>
    <p><strong>Last updated:</strong> [Current Date]</p>
    
    <h2>1. Data We Collect</h2>
    <p>We collect:</p>
    <ul>
        <li>Images/screenshots you upload for analysis</li>
        <li>Basic app diagnostics (crashes, performance)</li>
        <li>Purchase status and receipts for subscriptions</li>
        <li>Anonymous identifier or Apple user ID if you sign in</li>
    </ul>
    
    <h2>2. How We Use Data</h2>
    <p>Your data is used to:</p>
    <ul>
        <li>Analyze your images and return results</li>
        <li>Operate subscriptions and billing</li>
        <li>Prevent abuse</li>
        <li>Improve app quality</li>
    </ul>
    
    <h2>3. Data Sharing</h2>
    <p>We do not sell personal data. We use processors strictly to provide the service:</p>
    <ul>
        <li>OpenAI for AI/vision processing</li>
        <li>Vercel for hosting</li>
        <li>Apple for payments</li>
    </ul>
    <p>All data is transferred using TLS encryption.</p>
    
    <h2>4. Data Retention</h2>
    <p>Images and results are retained temporarily to deliver the service, then deleted. Purchase records are retained as required by law.</p>
    
    <h2>5. Your Rights</h2>
    <p>You can:</p>
    <ul>
        <li>Delete app data on your device anytime</li>
        <li>Request server-side deletion by contacting support</li>
        <li>Cancel subscriptions in iOS Settings → Apple ID → Subscriptions</li>
    </ul>
    
    <h2>6. Children's Privacy</h2>
    <p>This service is not intended for children under 13 (or local minimum age).</p>
    
    <h2>7. Regional Rights (GDPR/CCPA)</h2>
    <p>Depending on your location, you may have rights to access, delete, or correct your data. Contact us to exercise these rights.</p>
    
    <h2>8. Purchases & Refunds</h2>
    <p>Purchases are processed by Apple. Refunds are handled at reportaproblem.apple.com.</p>
    
    <h2>Contact</h2>
    <p>Email: <a href="mailto:youremail@gmail.com">youremail@gmail.com</a></p>
    
    <p><strong>Terms of Use:</strong> <a href="terms-of-use.html">View Terms</a></p>
    <p><strong>Apple EULA:</strong> <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Standard EULA</a></p>
</body>
</html>

### C. Enable GitHub Pages
1. Repository Settings → Pages
2. Source: Deploy from branch → main
3. Folder: / (root)
4. Save
5. URL will be: `https://yourusername.github.io/yourapp/`

---

## 6. iOS PROJECT CONFIGURATION

### A. Info.plist Required Keys

NSCameraUsageDescription:
"Allow camera access to take photos for analysis."

NSPhotoLibraryUsageDescription:
"Allow access to your photos to select images for analysis."

CFBundleDisplayName:
"Your App Name"

CFBundleIdentifier:
$(PRODUCT_BUNDLE_IDENTIFIER)

### B. Xcode Build Settings
1. **Signing & Capabilities:**
   - Team: Your Apple Developer account
   - Bundle Identifier: com.yourcompany.appname (MUST match App Store Connect)
   - Signing Certificate: Automatic
   - Add Capability: "In-App Purchase"

2. **Build Configuration:**
   - Scheme: Release (for production builds)
   - Archive: Product → Archive
   - Distribute App → App Store Connect

### C. PrivacyInfo.xcprivacy
Required for App Store submission - create XML file with:
- NSPrivacyTracking: false
- NSPrivacyTrackingDomains: empty array
- NSPrivacyCollectedDataTypes: empty array
- NSPrivacyAccessedAPITypes: empty array

---

## 7. COMMON BUGS & FIXES

### Bug 1: Purchase Freezes After Completion
**Symptom:** App shows success but UI doesn't update, requires restart

**Cause:** State not properly updated after purchase

Fix:
In purchase handler:
const ok = await requestPlan('monthly')
if (ok) {
  // IMPORTANT: Update state BEFORE closing modal
  const s = await getSubscriptionState()
  setIsSubscribed(!!s.isSubscribed)
  setFreeUsesLeft(Math.max(0, 1 - s.freeAnalysesUsed))
  
  // Close modal
  setPaywallVisible(false)
  
  // Delay alert to ensure smooth transition
  setTimeout(() => {
    Alert.alert('Success!', 'You now have unlimited access.')
  }, 300)
}

### Bug 2: "[Environment: Sandbox]" Shows in Production
**Symptom:** Users see sandbox testing dialog in production

**Cause:** StoreKit Configuration file linked to Xcode scheme

Fix:
- This ONLY appears in Xcode testing and TestFlight
- Will NOT appear in production App Store downloads
- To verify: Check Xcode project doesn't reference .storekit file
  Command: grep -i "storekit" yourapp.xcodeproj/project.pbxproj
  Should return: "not found" or only framework references

### Bug 3: "Products not found" Error
**Symptom:** Purchase fails with "product not available"

**Cause:** Product IDs don't match or subscriptions not approved

**Fix:**
1. Verify Product IDs in code match App Store Connect exactly
2. Check subscription status is "Ready to Submit" in App Store Connect
3. Ensure subscriptions are attached to app version
4. Wait 2-4 hours after creating products for App Store sync

### Bug 4: Analysis Timeout
**Symptom:** "Analysis timed out" error

**Cause:** Network timeout too short or slow server

Fix:
Increase timeout from 25s to 60s:
const data = await withTimeout(uploadImage(form), 60000)

### Bug 5: Camera Permission Errors
**Symptom:** `FigCaptureSourceRemote` errors in console

**Cause:** Normal iOS camera initialization warnings

**Fix:** These are harmless warnings, can be ignored. Ensure Info.plist has camera permission description.

---

## 8. APP STORE SUBMISSION CHECKLIST

### Pre-Submission Code Cleanup
- [ ] Remove all debug features
- [ ] Remove "Debug Purchases" menu
- [ ] Remove "Restore Purchases" from settings (or make it informational only)
- [ ] Remove console.logs with sensitive data
- [ ] Update contact email in privacy policy
- [ ] Test all purchase flows in TestFlight

### App Store Connect
- [ ] Subscriptions status: "Ready to Submit"
- [ ] Free trial configured (7 days) for both Monthly and Yearly
- [ ] Screenshots uploaded (all required sizes)
- [ ] App Preview video (optional but recommended)
- [ ] Privacy Policy URL active and accessible
- [ ] Support URL (can be same as privacy policy)
- [ ] App Description written
- [ ] Keywords added (max 100 characters)
- [ ] Age rating completed
- [ ] Contact information up to date

### Build Upload
- [ ] Version number incremented (e.g., 1.0.0 → 1.0.1)
- [ ] Build number incremented (e.g., 1 → 2)
- [ ] Archive created in Release mode
- [ ] Uploaded to App Store Connect
- [ ] Build appears in "Activity" tab
- [ ] Build selected in app version

### App Review Information
- [ ] Demo account credentials (if app requires sign-in)
- [ ] Notes for reviewer (explain any complex features)
- [ ] Contact phone number
- [ ] Test subscription instructions

---

## 9. TESTING GUIDE

### A. Local Testing (Xcode Simulator)
1. Use StoreKit Configuration file (Products.storekit)
2. Create test products matching production IDs
3. Test purchase flows
4. NOTE: Will show "[Environment: Sandbox]" - this is normal

### B. TestFlight Testing
1. Upload build to App Store Connect
2. Add internal testers
3. Create Sandbox Test Users:
   - App Store Connect → Users and Access → Sandbox Testers
   - Create fake email (test@example.com)
4. On test device:
   - Sign out of real Apple ID
   - Install from TestFlight
   - Purchase will prompt for sandbox account
   - No real money charged

### C. Production Testing
- Only way to test real App Store environment
- Can create promo codes after app is live
- Or use your own real Apple ID (will be charged)

---

## 10. SUBSCRIPTION MANAGEMENT

### User Cancellation
Users can cancel via:
- iOS Settings → Apple ID → Subscriptions → Your App → Cancel
- App Store → Account → Subscriptions

**What happens:**
- Access continues until end of current billing period
- Then subscription status becomes inactive
- Your app should check status and update UI

### Refunds
- Apple handles all refunds
- Users request at: reportaproblem.apple.com
- You get notified via App Store Server Notifications
- Implement webhook to handle refund events (optional)

### Grace Period
- If payment fails, user keeps access for 3 days (if configured)
- Apple attempts to collect payment
- If successful, no interruption
- If fails, subscription cancelled

---

## 11. REVENUE & ANALYTICS

### App Store Connect
- Sales and Trends: Daily revenue, subscriptions, trials
- Subscription Reports: Active subscribers, churn, retention
- Financial Reports: Monthly payout statements

### In-App Analytics (Recommended)
Consider adding:
- Mixpanel / Amplitude for user behavior
- RevenueCat for subscription analytics (abstraction layer)
- Sentry for crash reporting

---

## 12. POST-LAUNCH CHECKLIST

### Week 1
- [ ] Monitor crash reports in App Store Connect
- [ ] Check subscription conversion rate
- [ ] Respond to user reviews
- [ ] Monitor server costs (OpenAI usage)
- [ ] Test all features on production

### Month 1
- [ ] Analyze user retention
- [ ] Check subscription renewal rate
- [ ] Calculate costs vs revenue
- [ ] Plan updates based on feedback
- [ ] A/B test pricing if needed

---

## 13. SCALING CONSIDERATIONS

### When to Optimize Costs
If monthly costs exceed 30% of revenue:
1. Reduce OpenAI model quality (gpt-4o → gpt-4o-mini)
2. Add rate limiting per user
3. Implement request queuing
4. Cache common requests
5. Add usage caps per subscription tier

### When to Add Features
Common premium features:
- Unlimited history/storage
- Export options (PDF, CSV)
- Priority processing
- Advanced AI models
- Batch processing
- API access

---

## 14. LEGAL COMPLIANCE

### Required by Apple
- Privacy Policy (must be accessible)
- Terms of Use (recommended)
- EULA (can use Apple's standard)
- Contact method for support

### GDPR Compliance (if targeting EU)
- Clear consent for data processing
- Right to access data
- Right to deletion
- Data portability
- Privacy by design

### CCPA Compliance (California)
- Disclosure of data collected
- Right to opt-out of data sale
- Right to deletion
- Non-discrimination for exercising rights

---

## 15. AI AGENT USAGE TEMPLATE

When building a similar app, provide this context to AI:

I'm building an iOS subscription app with:
- Framework: React Native + Expo
- Feature: [Describe AI feature, e.g., "OCR and image analysis"]
- Subscriptions: Monthly ($X) and Yearly ($Y) with 7-day free trial
- Backend: Vercel serverless + OpenAI API
- Bundle ID: com.[company].[appname]

Requirements:
1. Setup subscription products with IDs:
   - Monthly: com.[company].[appname].promonthly
   - Yearly: com.[company].[appname].proyearly

2. Implement IAP using react-native-iap with:
   - Purchase flow
   - Subscription status checking
   - Local state management (AsyncStorage)

3. Create Paywall component with:
   - Two plan selection
   - "Start Free Trial" button
   - Terms/Privacy links

4. Backend API endpoint for [feature] using OpenAI gpt-4o

5. Privacy policy and legal pages

Please follow the patterns from the reference guide and avoid common bugs:
- Update state before closing purchase modals
- Use 60s timeout for API calls
- Remove all debug features for production
- Match product IDs exactly

Generate the complete implementation following best practices.

---

## REFERENCE REPOSITORY STRUCTURE

yourapp/
├── mobile/ (React Native app)
│   ├── App.tsx (Main app component)
│   ├── app.json (Expo config)
│   ├── package.json
│   ├── .env (Environment variables)
│   ├── ios/
│   │   ├── Info.plist
│   │   ├── PrivacyInfo.xcprivacy
│   │   └── YourApp.xcodeproj/
│   └── src/
│       ├── api/
│       │   └── client.ts (API client)
│       ├── components/
│       │   ├── Paywall.tsx (Subscription paywall)
│       │   └── ResultView.tsx (Feature UI)
│       ├── services/
│       │   └── iap.ts (In-app purchase logic)
│       └── store/
│           └── subscription.ts (Subscription state)
├── server/ (Vercel backend)
│   ├── package.json
│   ├── vercel.json
│   └── api/
│       ├── analyze.js (Main endpoint)
│       ├── health.js
│       └── validate-receipt.js
├── privacy-policy.html (Hosted on GitHub Pages)
├── terms-of-use.html
└── support.html

---

## QUICK REFERENCE: Product IDs

Format: com.[company].[appname].[plan]

Examples:
- com.asif.screenshotanalyzer.promonthly
- com.asif.screenshotanalyzer.proyearly
- com.acme.textextractor.promonthly
- com.acme.textextractor.proyearly

Rules:
1. Must be unique across App Store
2. Cannot be changed after creation
3. Must match exactly in code and App Store Connect
4. Use lowercase, no spaces
5. Can include numbers, dots, hyphens

---

## SUPPORT RESOURCES

- Apple Developer Documentation: https://developer.apple.com/documentation/
- App Store Connect Help: https://help.apple.com/app-store-connect/
- React Native IAP: https://github.com/dooboolab-community/react-native-iap
- Expo Documentation: https://docs.expo.dev/
- OpenAI API Reference: https://platform.openai.com/docs/
- Vercel Documentation: https://vercel.com/docs

---

**This guide covers 95% of common scenarios for iOS subscription apps. For edge cases, consult Apple's official documentation or community forums.**
