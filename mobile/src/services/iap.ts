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
	if (initialized) {
		console.log('[IAP] Already initialized');
		return;
	}
	if (IAP_DISABLED) {
		console.log('[IAP] IAP is disabled via env');
		return;
	}
	try {
		console.log('[IAP] Importing react-native-iap...');
		// Try importing the native module at runtime
		RNIap = await import('react-native-iap');
		console.log('[IAP] Calling initConnection...');
		await RNIap.initConnection();
		initialized = true;
		console.log('[IAP] ✅ Successfully initialized!');
	} catch (e: any) {
		console.error('[IAP] ❌ Failed to initialize:', e?.message || e);
		// In Expo Go or simulator without IAP, this may fail. That's okay.
		return;
	}

	// Load products/subscriptions if possible (handle RN-IAP API differences)
		try {
			console.log('[IAP] Loading products:', Object.values(SUBS_IDS));
			// Preferred: getSubscriptions (v14+)
			if (typeof RNIap.getSubscriptions === 'function') {
				console.log('[IAP] Using getSubscriptions API');
				const res = await RNIap.getSubscriptions(Object.values(SUBS_IDS));
				cachedSubs = Array.isArray(res) ? res : [];
				console.log('[IAP] ✅ Loaded', cachedSubs.length, 'products:', cachedSubs.map((p: any) => p.productId));
			} else if (typeof RNIap.getProducts === 'function') {
				console.log('[IAP] Using getProducts API');
				// Fallback: getProducts (older variants)
				const res = await RNIap.getProducts(Object.values(SUBS_IDS));
				cachedSubs = Array.isArray(res) ? res : [];
				console.log('[IAP] ✅ Loaded', cachedSubs.length, 'products');
			} else if (typeof RNIap.fetchProducts === 'function') {
				console.log('[IAP] Using fetchProducts API (legacy)');
				// Older API signature fallback
				try {
					const res = await RNIap.fetchProducts({ skus: Object.values(SUBS_IDS), type: 'subs' });
					cachedSubs = Array.isArray(res) ? (res as any[]) : [];
					console.log('[IAP] ✅ Loaded', cachedSubs.length, 'products');
				} catch {}
			}
		} catch (err: any) {
			console.error('[IAP] ❌ Failed to load products:', err?.message || err);
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
	console.log('[IAP] 🛒 Requesting purchase for plan:', plan, 'SKU:', sku);
	
	if (!initialized) {
		console.log('[IAP] Not initialized, calling initIAP...');
		await initIAP();
	}
	
	// If still not initialized, we are likely on Expo Go / unsupported env
	if (!initialized) {
		console.error('[IAP] ❌ Still not initialized after init attempt');
		throw new Error('In-app purchases are not available in this build. Install a Dev Client or TestFlight build.');
	}

	console.log('[IAP] Checking if products are loaded...');
	console.log('[IAP] Cached products:', cachedSubs.length, cachedSubs.map((p: any) => p.productId));

		try {
			// Subscriptions should use requestSubscription on iOS
			if (typeof RNIap.requestSubscription === 'function') {
				console.log('[IAP] Using requestSubscription with SKU:', sku);
				// iOS requires subscription requests with specific parameters
				await RNIap.requestSubscription({
					sku: sku,
					...(Platform.OS === 'ios' && {
						andDangerouslyFinishTransactionAutomaticallyIOS: false,
					}),
				});
				console.log('[IAP] ✅ requestSubscription called successfully');
			} else if (typeof RNIap.requestPurchase === 'function') {
				console.log('[IAP] Using requestPurchase (fallback)');
				// Fallback for older API shapes
				await RNIap.requestPurchase({ sku, andDangerouslyFinishTransactionAutomaticallyIOS: false });
				console.log('[IAP] ✅ requestPurchase called successfully');
			} else {
				console.error('[IAP] ❌ No purchase method available!');
				throw new Error('IAP API is not available in this environment');
			}
		// Success path is handled by purchaseUpdatedListener setting subscribed
		// Wait briefly for listener to run
		console.log('[IAP] Waiting for purchase to complete...');
		await new Promise((r) => setTimeout(r, 1200));
		const isSub = (await AsyncStorage.getItem('ss.isSubscribed')) === '1';
		console.log('[IAP] Purchase result - isSubscribed:', isSub);
		return !!isSub;
	} catch (e: any) {
		console.error('[IAP] ❌ Purchase failed:', e?.message, e?.code, e);
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
