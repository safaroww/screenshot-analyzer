# In‑App Purchases: Realistic testing without spending money

This app uses `react-native-iap` for subscriptions (monthly and yearly). You can test end‑to‑end, on real devices, with no charges by using the platforms' sandbox/testing flows.

Products used by the app:
- Monthly: `com.asif.screenshotanalyzer.promonthly` (override via `EXPO_PUBLIC_IAP_MONTHLY_ID`)
- Yearly: `com.asif.screenshotanalyzer.proyearly` (override via `EXPO_PUBLIC_IAP_YEARLY_ID`)

The UI also falls back to a local 3‑day trial when IAP isn’t available (e.g., running in Expo Go).

## iOS (App Store Sandbox)

You’ll need a build that includes the IAP native code (Expo Go does not). Use a Dev Client or TestFlight.

1) Configure products in App Store Connect
- In‑App Purchases → Auto‑renewable subscriptions
- Create two products with IDs. Example IDs:
  - `com.asif.screenshotanalyzer.promonthly`
  - `com.asif.screenshotanalyzer.proyearly`
  Use any IDs you like, but they must match what the app requests.
- Add them to a Subscription Group and submit for review (you can still test sandbox before review completes)

2) Create a Sandbox Tester
- App Store Connect → Users and Access → Sandbox Testers → Add
- Use a real email you can access; Apple ID must not exist already

3) Make sure bundle identifiers are stable
- In `app.json`, set:
  - `ios.bundleIdentifier` (e.g., `com.asif.screenshotanalyzer`)
  Product IDs in the stores are tied to these identifiers.

4) Build an app that contains IAP
- Add plugin (already in `app.json`):
  ```json
  { "expo": { "plugins": ["react-native-iap"] } }
  ```
- Build a Dev Client and install on device:
  ```bash
  cd mobile
  npx expo run:ios # or: eas build -p ios --profile development
  ```
  Open the project in Xcode if needed and run on a physical device.

5) Test a purchase
- On the test device: Sign OUT of your personal App Store account in iOS Settings
- Launch the app → open Paywall → choose plan
- When asked to sign in, use the Sandbox tester Apple ID
- Apple’s sandbox does not charge money; subscription periods are accelerated (e.g., 1 week ≈ 3 minutes)

6) Restore purchases
- In the app Settings → "Restore Purchases"

Optional: StoreKit Testing in Xcode
- You can also use a StoreKit Configuration file in Xcode to simulate purchases in the Simulator—no Apple ID required.

## Dev/Expo Go fallback

If you run in Expo Go or a simulator without IAP, the paywall will start a local 3‑day trial instead of a real purchase. This is for quick UI/testing only; build a Dev Client/TestFlight for real IAP flows.

To silence NitroModules errors in Expo Go, disable IAP at runtime:

```bash
export EXPO_PUBLIC_IAP_DISABLED=1
npx expo start --ios
```

When you’re ready to test real IAP, unset the variable and run a Dev Client/TestFlight/Play build.

## Point the app to your exact SKUs (optional)

Instead of editing code, set environment variables before starting your build/bundle:

```bash
export EXPO_PUBLIC_IAP_MONTHLY_ID="com.asif.screenshotanalyzer.promonthly"
export EXPO_PUBLIC_IAP_YEARLY_ID="com.asif.screenshotanalyzer.proyearly"
npx expo start --ios
```

For EAS builds, add these to your project’s EAS environment secrets/variables.

## Server validation (optional, later)

For production, add backend receipt validation to prevent fraud:
- iOS: Validate the App Store JWS/receipt with Apple

For sandbox testing, local validation is sufficient and no money is charged.
