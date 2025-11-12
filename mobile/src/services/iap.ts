import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { setSubscribed } from '../store/subscription';
import { validateAppleReceipt } from '../api/client';

// Product identifiers created in App Store Connect / Google Play Console
// Keep these stable across platforms.
const extra = Constants.expoConfig?.extra || {};
export const SUBS_IDS = {
	monthly: (extra.EXPO_PUBLIC_IAP_MONTHLY_ID || 'com.asif.screenshotanalyzer.promonthly') as string,
	yearly: (extra.EXPO_PUBLIC_IAP_YEARLY_ID || 'com.asif.screenshotanalyzer.proyearly') as string,
} as const;

export type Plan = keyof typeof SUBS_IDS; // 'monthly' | 'yearly'

// Dynamically loaded IAP module to avoid crashing in Expo Go (unsupported NitroModules)
let RNIap: any = null;
const IAP_DISABLED = String(extra.EXPO_PUBLIC_IAP_DISABLED || '').toLowerCase() === 'true' ||
	extra.EXPO_PUBLIC_IAP_DISABLED === '1';
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
		
		// Check for pending transactions on iOS
		if (Platform.OS === 'ios' && typeof RNIap.getPendingPurchases === 'function') {
			try {
				const pendingPurchases = await RNIap.getPendingPurchases();
				console.log('[IAP] Found', pendingPurchases?.length || 0, 'pending purchases');
				
				// Finish any pending transactions
				if (pendingPurchases && pendingPurchases.length > 0) {
					for (const purchase of pendingPurchases) {
						const pid = purchase.productId;
						if (pid && (Object.values(SUBS_IDS) as string[]).includes(pid)) {
							console.log('[IAP] Finishing pending purchase:', pid);
							await setSubscribed(true);
							try {
								await RNIap.finishTransaction({ purchase, isConsumable: false });
							} catch {}
						}
					}
				}
			} catch (err: any) {
				console.warn('[IAP] Could not check pending purchases:', err?.message);
			}
		}
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
			console.log('[IAP] Purchase update received:', purchase.productId, purchase.transactionReceipt ? 'has receipt' : 'no receipt');
			
			// Mark subscribed locally on any successful transaction for our SKUs
			const pid = purchase.productId;
			if (pid && (Object.values(SUBS_IDS) as string[]).includes(pid)) {
				console.log('[IAP] ✅ Valid purchase for product:', pid);
				// Tentatively mark subscribed, then verify on server (iOS)
				await setSubscribed(true);
				if (Platform.OS === 'ios' && purchase.transactionReceipt) {
					try {
						const v = await validateAppleReceipt(purchase.transactionReceipt);
						console.log('[IAP] Server validation:', v);
						if (!v.isActive) {
							console.warn('[IAP] Receipt not active after validation. Status:', v.status, 'env:', v.environment, 'appleStatus:', v.appleStatus);
							await setSubscribed(false);
						}
					} catch (verr: any) {
						console.warn('[IAP] Server validation failed:', verr?.message || verr);
					}
				}
			}

			// Finish the transaction so the store doesn't keep it pending
			try {
				if (Platform.OS === 'ios') {
					await RNIap.finishTransaction({ purchase, isConsumable: false });
				} else {
					await RNIap.acknowledgePurchaseAndroid({ purchase });
				}
				console.log('[IAP] ✅ Transaction finished successfully');
			} catch (finishErr: any) {
				console.warn('[IAP] ⚠️ Could not finish transaction:', finishErr?.message);
			}
		} catch (err: any) {
			console.error('[IAP] ❌ Error in purchase listener:', err?.message);
		}
	});

	purchaseErrorSub = RNIap.purchaseErrorListener((err: any) => {
		console.warn('[IAP] Purchase error:', err?.code, err?.message);
		// User cancelled is not an error
		if (err?.code === 'E_USER_CANCELLED') {
			console.log('[IAP] User cancelled purchase');
		}
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

export type IapDebugInfo = {
	initialized: boolean;
	iapDisabled: boolean;
	envMonthlyId?: string;
	envYearlyId?: string;
	cachedProducts: Array<{ productId: string; title?: string; price?: string }>;
	platform: string;
	subscriptionCount: number;
	hints: string[];
	timestamp: string;
};

export async function collectIapDebugInfo(): Promise<IapDebugInfo> {
	const hints: string[] = [];
	const info: IapDebugInfo = {
		initialized,
		iapDisabled: IAP_DISABLED,
		envMonthlyId: extra.EXPO_PUBLIC_IAP_MONTHLY_ID,
		envYearlyId: extra.EXPO_PUBLIC_IAP_YEARLY_ID,
		cachedProducts: [],
		platform: Platform.OS,
		subscriptionCount: 0,
		hints,
		timestamp: new Date().toISOString(),
	};

	if (IAP_DISABLED) {
		hints.push('IAP disabled via EXPO_PUBLIC_IAP_DISABLED env flag.');
		return info;
	}

	try {
		await initIAP();
	} catch (err: any) {
		hints.push(`initIAP threw: ${err?.message || err}`);
	}

	if (!RNIap) {
		hints.push('react-native-iap module is not available (likely running in Expo Go).');
		return info;
	}

	try {
		if (typeof RNIap.getSubscriptions === 'function') {
			const refreshed = await RNIap.getSubscriptions(Object.values(SUBS_IDS));
			cachedSubs = Array.isArray(refreshed) ? refreshed : [];
		} else if (typeof RNIap.getProducts === 'function') {
			const refreshed = await RNIap.getProducts(Object.values(SUBS_IDS));
			cachedSubs = Array.isArray(refreshed) ? refreshed : [];
		}
	} catch (err: any) {
		hints.push(`Product refresh failed: ${err?.message || err}`);
	}

	info.initialized = initialized;
	info.cachedProducts = (cachedSubs || []).map((p: any) => ({
		productId: p?.productId || p?.productIdentifier || 'unknown',
		title: p?.title,
		price: p?.localizedPrice,
	}));
	info.subscriptionCount = info.cachedProducts.length;

	if (!info.cachedProducts.length) {
		hints.push(
			'No products were returned by App Store. Make sure: (1) the subscriptions are attached to this app version in App Store Connect → In-App Purchases and Subscriptions, (2) their status is Ready to Submit or higher, and (3) Paid Apps agreement is active.'
		);
	}

	return info;
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

	// Refresh if the requested SKU has not been seen yet
	if (!(cachedSubs || []).some((p: any) => (p?.productId || p?.productIdentifier) === sku)) {
		try {
			if (typeof RNIap?.getSubscriptions === 'function') {
				const refreshed = await RNIap.getSubscriptions(Object.values(SUBS_IDS));
				cachedSubs = Array.isArray(refreshed) ? refreshed : [];
			} else if (typeof RNIap?.getProducts === 'function') {
				const refreshed = await RNIap.getProducts(Object.values(SUBS_IDS));
				cachedSubs = Array.isArray(refreshed) ? refreshed : [];
			}
		} catch (err: any) {
			console.warn('[IAP] Unable to refresh products for purchase:', err?.message || err);
		}
		const newList: string[] = (cachedSubs || []).map((p: any) => p.productId || p.productIdentifier).filter(Boolean);
		console.log('[IAP] Products after refresh attempt:', newList);
		if (!newList.includes(sku)) {
			throw new Error(
				'Product not found on App Store. Confirm the subscriptions are attached to this app version in App Store Connect, their status is Ready to Submit+, and agreements/tax/banking are active.'
			);
		}
	}

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
		await new Promise((r) => setTimeout(r, 1500));
		const isSub = (await AsyncStorage.getItem('ss.isSubscribed')) === '1';
		console.log('[IAP] Purchase result - isSubscribed:', isSub);
		return !!isSub;
	} catch (e: any) {
		console.error('[IAP] ❌ Purchase failed:', e?.message, e?.code, e);
		
		// Handle specific error codes
		if (e?.code === 'E_USER_CANCELLED') {
			throw new Error('Purchase was cancelled');
		} else if (e?.code === 'E_NETWORK_ERROR') {
			throw new Error('Network error. Please check your connection and try again.');
		} else if (e?.code === 'E_SERVICE_ERROR') {
			throw new Error('App Store service error. Please try again later.');
		} else if (e?.code === 'E_RECEIPT_FAILED') {
			throw new Error('Receipt validation failed. Please contact support.');
		} else if (e?.code === 'E_ALREADY_OWNED') {
			// User already owns this, just restore it
			console.log('[IAP] Already owned, setting as subscribed');
			await setSubscribed(true);
			return true;
		}
		
		// Forward error to caller with better message
		throw new Error(e?.message || 'Purchase failed. Please try again.');
	}
}

export async function restorePurchases(): Promise<boolean> {
	if (!initialized) await initIAP();
	if (!initialized) throw new Error('In-app purchases are not available in this build.');
	try {
		// iOS: try to validate receipt on server for reliable state
		if (Platform.OS === 'ios' && typeof RNIap.getReceiptIOS === 'function') {
			try {
				const receipt = await RNIap.getReceiptIOS();
				if (receipt) {
					const v = await validateAppleReceipt(receipt);
					await setSubscribed(!!v.isActive);
					return !!v.isActive;
				}
			} catch (e: any) {
				console.warn('[IAP] getReceiptIOS/validation failed, falling back:', e?.message || e);
			}
		}

		// Fallback: platform helper
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
