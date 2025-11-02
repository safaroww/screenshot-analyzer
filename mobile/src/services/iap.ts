import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSubscribed } from '../store/subscription';

// Product identifiers created in App Store Connect / Google Play Console
// Keep these stable across platforms.
const PUB_ENV = ((process as any)?.env || {}) as Record<string, string | undefined>;
export const SUBS_IDS = {
	monthly: (PUB_ENV.EXPO_PUBLIC_IAP_MONTHLY_ID || 'com.asif.screenshotanalyzer.promonthly') as string,
	yearly: (PUB_ENV.EXPO_PUBLIC_IAP_YEARLY_ID || 'com.asif.screenshotanalyzer.proyearly') as string,
} as const;

export type Plan = keyof typeof SUBS_IDS; // 'monthly' | 'yearly'

// Dynamically loaded IAP module to avoid crashing in Expo Go (unsupported NitroModules)
let RNIap: any = null;
const IAP_DISABLED = String((process as any)?.env?.EXPO_PUBLIC_IAP_DISABLED || '').toLowerCase() === 'true' ||
	(process as any)?.env?.EXPO_PUBLIC_IAP_DISABLED === '1';
let purchaseUpdateSub: any | null = null;
let purchaseErrorSub: any | null = null;
let initialized = false;

// Optional cache of products
let cachedProducts: any[] = [];
let cachedSubs: any[] = [];

export async function initIAP() {
	if (initialized) return;
	if (IAP_DISABLED) return; // Explicitly disabled for Expo Go/dev
	try {
		// Try importing the native module at runtime
		RNIap = await import('react-native-iap');
		await RNIap.initConnection();
		initialized = true;
	} catch (e) {
		// In Expo Go or simulator without IAP, this may fail. That's okay.
		return;
	}

	// Load products/subscriptions if possible (handle RN-IAP API differences)
		try {
			// Preferred: getSubscriptions (v14+)
			if (typeof RNIap.getSubscriptions === 'function') {
				const res = await RNIap.getSubscriptions(Object.values(SUBS_IDS));
				cachedSubs = Array.isArray(res) ? res : [];
			} else if (typeof RNIap.getProducts === 'function') {
				// Fallback: getProducts (older variants)
				const res = await RNIap.getProducts(Object.values(SUBS_IDS));
				cachedSubs = Array.isArray(res) ? res : [];
			} else if (typeof RNIap.fetchProducts === 'function') {
				// Older API signature fallback
				try {
					const res = await RNIap.fetchProducts({ skus: Object.values(SUBS_IDS), type: 'subs' });
					cachedSubs = Array.isArray(res) ? (res as any[]) : [];
				} catch {}
			}
		} catch (err) {
			// Ignore product load failures in unsupported environments
		}

	// Listen for purchases
			purchaseUpdateSub = RNIap.purchaseUpdatedListener(async (purchase: any) => {
		try {
			// Mark subscribed locally on any successful transaction for our SKUs
			const pid = purchase.productId;
			if (pid && (Object.values(SUBS_IDS) as string[]).includes(pid)) {
				await setSubscribed(true);
			}

			// Finish the transaction so the store doesn't keep it pending
							try {
								await RNIap.finishTransaction({ purchase, isConsumable: false });
							} catch {}
		} catch {}
	});

		purchaseErrorSub = RNIap.purchaseErrorListener((err: any) => {
		// Swallow errors here; callers will see thrown errors from requestSubscription
		console.warn('IAP error:', err?.code, err?.message);
	});
}

export async function endIAP() {
	try { purchaseUpdateSub?.remove(); } catch {}
	try { purchaseErrorSub?.remove(); } catch {}
	purchaseUpdateSub = null;
	purchaseErrorSub = null;
	initialized = false;
	try { await RNIap?.endConnection?.(); } catch {}
}

export function getSubscriptionsCached() {
	return cachedSubs;
}

export async function requestPlan(plan: Plan): Promise<boolean> {
	const sku = SUBS_IDS[plan];
	if (!initialized) await initIAP();
	// If still not initialized, we are likely on Expo Go / unsupported env
	if (!initialized) throw new Error('In-app purchases are not available in this build. Install a Dev Client or TestFlight build.');

		try {
			// Subscriptions should use requestSubscription on iOS
			if (typeof RNIap.requestSubscription === 'function') {
				// iOS requires subscription requests with specific parameters
				await RNIap.requestSubscription({
					sku: sku,
					...(Platform.OS === 'ios' && {
						andDangerouslyFinishTransactionAutomaticallyIOS: false,
					}),
				});
			} else if (typeof RNIap.requestPurchase === 'function') {
				// Fallback for older API shapes
				await RNIap.requestPurchase({ sku, andDangerouslyFinishTransactionAutomaticallyIOS: false });
			} else {
				throw new Error('IAP API is not available in this environment');
			}
		// Success path is handled by purchaseUpdatedListener setting subscribed
		// Wait briefly for listener to run
		await new Promise((r) => setTimeout(r, 1200));
		const isSub = (await AsyncStorage.getItem('ss.isSubscribed')) === '1';
		return !!isSub;
	} catch (e: any) {
		// Forward error to caller
		throw new Error(e?.message || 'Purchase failed');
	}
}

export async function restorePurchases(): Promise<boolean> {
	if (!initialized) await initIAP();
	if (!initialized) throw new Error('In-app purchases are not available in this build.');
	try {
		// Prefer the platform helper when available
		const activeSubs = await RNIap.hasActiveSubscriptions(Object.values(SUBS_IDS));
		const active = !!activeSubs;
		if (active) await setSubscribed(true);
		return !!active;
	} catch (e: any) {
		throw new Error(e?.message || 'Restore failed');
	}
}

// For convenience in UI
export function isIapReady() {
	return initialized;
}
