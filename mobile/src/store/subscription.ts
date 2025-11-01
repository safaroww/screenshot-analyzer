import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SUB = 'ss.isSubscribed';
// Back-compat: previously KEY_COUNT stored a cumulative number. We now use daily counters.
const KEY_COUNT_OLD = 'ss.freeAnalysesUsed';
const KEY_DAILY_DATE = 'ss.dailyDate'; // YYYY-MM-DD
const KEY_DAILY_COUNT = 'ss.dailyCount';
const KEY_USER = 'ss.userId';
const KEY_TRIAL_END = 'ss.trialEndsAt'; // ISO string

export type SubscriptionState = {
  isSubscribed: boolean; // true if paid OR active trial
  freeAnalysesUsed: number;
  userId?: string | null;
  trialEndsAt?: string | null;
};

export async function getSubscriptionState(): Promise<SubscriptionState> {
  const [sub, dailyDate, dailyCntStr, uid, oldCnt, trialEnd] = await Promise.all([
    AsyncStorage.getItem(KEY_SUB),
    AsyncStorage.getItem(KEY_DAILY_DATE),
    AsyncStorage.getItem(KEY_DAILY_COUNT),
    AsyncStorage.getItem(KEY_USER),
    AsyncStorage.getItem(KEY_COUNT_OLD),
    AsyncStorage.getItem(KEY_TRIAL_END),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  let dailyCount = Math.max(0, parseInt(dailyCntStr || '0', 10) || 0);
  // If date changed or unset, reset to 0 for today
  if (dailyDate !== today) {
    await AsyncStorage.multiSet([[KEY_DAILY_DATE, today], [KEY_DAILY_COUNT, '0']]);
    dailyCount = 0;
  }
  // Back-compat migration: if no daily date stored but old total count exists, ignore old count
  if (!dailyDate && oldCnt) {
    await AsyncStorage.removeItem(KEY_COUNT_OLD);
  }
  // Determine active trial
  let activeTrial = false;
  let trialEndsAt: string | null = trialEnd || null;
  if (trialEnd) {
    const now = Date.now();
    const endMs = Date.parse(trialEnd);
    if (!isNaN(endMs)) {
      if (endMs > now) {
        activeTrial = true;
      } else {
        // Trial expired; clear it
        await AsyncStorage.removeItem(KEY_TRIAL_END);
        trialEndsAt = null;
      }
    }
  }

  return {
    isSubscribed: sub === '1' || activeTrial,
    freeAnalysesUsed: dailyCount,
    userId: uid,
    trialEndsAt,
  };
}

export async function setSubscribed(on: boolean) {
  await AsyncStorage.setItem(KEY_SUB, on ? '1' : '0');
}

// Start a local trial without backend (e.g., 3 days)
export async function startLocalTrial(days: number = 3) {
  const ends = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await AsyncStorage.setItem(KEY_TRIAL_END, ends);
}

export async function incrementFreeCount() {
  // Ensure daily counter is for today
  const today = new Date().toISOString().slice(0, 10);
  const [dt, cntStr] = await Promise.all([
    AsyncStorage.getItem(KEY_DAILY_DATE),
    AsyncStorage.getItem(KEY_DAILY_COUNT),
  ]);
  let count = Math.max(0, parseInt(cntStr || '0', 10) || 0);
  if (dt !== today) {
    await AsyncStorage.setItem(KEY_DAILY_DATE, today);
    count = 0;
  }
  const next = count + 1;
  await AsyncStorage.setItem(KEY_DAILY_COUNT, String(next));
  return next;
}

export async function resetFreeCount() {
  const today = new Date().toISOString().slice(0, 10);
  await AsyncStorage.multiSet([[KEY_DAILY_DATE, today], [KEY_DAILY_COUNT, '0']]);
}

export async function setUserId(userId: string) {
  await AsyncStorage.setItem(KEY_USER, userId);
}

export async function setTrialIfFirstOpen() {
  // Initialize counters on first open if not set
  const dt = await AsyncStorage.getItem(KEY_DAILY_DATE);
  if (dt === null) {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.multiSet([[KEY_DAILY_DATE, today], [KEY_DAILY_COUNT, '0']]);
  }
}

export async function clearAllData() {
  // Clear all subscription data (for testing/reset)
  await AsyncStorage.multiRemove([
    KEY_SUB,
    KEY_COUNT_OLD,
    KEY_DAILY_DATE,
    KEY_DAILY_COUNT,
    KEY_USER,
    KEY_TRIAL_END
  ]);
}
