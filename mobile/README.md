App open paywall behavior

- On app launch, the app initializes IAP and silently attempts to restore purchases.
- If the user is not subscribed after restore, the Paywall is shown immediately.
- Existing subscribers should not see the Paywall on launch.

Testing tips

- Fresh install on a non-subscribed account should show the Paywall on first open.
- With an active subscription (TestFlight/sandbox), launch should skip the Paywall after the silent restore.
- You can manually trigger Restore from Settings → Restore Purchases to verify state.

Environment notes

- If EXPO_PUBLIC_IAP_DISABLED=true, IAP init is skipped. The Paywall will still be shown for unsubscribed users, but purchases won’t work in that build.
 
