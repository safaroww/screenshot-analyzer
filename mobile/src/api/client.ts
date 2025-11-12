import { Platform, NativeModules } from 'react-native';

let cachedBaseUrl: string | null = null;

function candidateBaseUrls(): string[] {
  const list: string[] = [];
  
  // Production API on Vercel (always try this first)
  list.push('https://screenshot-analyzer-lovat.vercel.app/api');
  
  // Environment variable override (for development)
  const env = (process as any)?.env?.EXPO_PUBLIC_API_BASE_URL as string | undefined;
  if (env && env.trim()) list.push(env.trim());

  // From packager URL if it's http(s) (development only)
  const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
  if (scriptURL && /^https?:\/\//i.test(scriptURL)) {
    const m = scriptURL.match(/^[a-zA-Z+]+:\/\/([^/:]+)/);
    const host = m?.[1];
    if (host) {
      const mappedHost = Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')
        ? '10.0.2.2'
        : host;
      list.push(`http://${mappedHost}:4000`);
    }
  }

  // Common local fallbacks (development only)
  if (Platform.OS === 'android') list.push('http://10.0.2.2:4000');
  list.push('http://localhost:4000');
  list.push('http://127.0.0.1:4000');

  // De-dup
  return Array.from(new Set(list));
}

async function tryHealth(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined as any;
    const timer = setTimeout(() => ctrl?.abort?.(), timeoutMs);
    const res = await fetch(`${url}/health`, { signal: ctrl?.signal });
    clearTimeout(timer);
    return !!res.ok;
  } catch {
    return false;
  }
}

async function resolveBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const candidates = candidateBaseUrls();
  for (const url of candidates) {
    // Try a couple of times with small backoff to tolerate slow networks/tunnels
    for (let attempt = 0; attempt < 3; attempt++) {
      const ok = await tryHealth(url, 4000 + attempt * 1000);
      if (ok) {
        cachedBaseUrl = url;
        return url;
      }
      // short backoff between attempts
      await new Promise(r => setTimeout(r, 200));
    }
  }
  // last resort: env or localhost without health
  cachedBaseUrl = candidates[0] || 'http://localhost:4000';
  return cachedBaseUrl;
}

export async function uploadImage(formData: FormData) {
  const base = await resolveBaseUrl();
  try {
    const res = await fetch(`${base}/analyze`, {
      method: 'POST',
      body: formData as any,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server error ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err: any) {
    // Surface a clearer error to the UI
    const reason = String(err?.message || err);
    throw new Error(`Could not reach server at ${base}: ${reason}. If this is a physical device or tunnel, set EXPO_PUBLIC_API_BASE_URL to your PC LAN IP (e.g. http://192.168.x.x:4000).`);
  }
}

export type AppleReceiptValidation = {
  ok: boolean;
  appleStatus: number;
  environment: string;
  isActive: boolean;
  status: 'active' | 'expired' | 'cancelled' | 'inactive';
  isTrial?: boolean;
  isInIntro?: boolean;
  expiresAt?: string | null;
  productId?: string | null;
  originalTransactionId?: string | null;
};

export async function validateAppleReceipt(receiptDataBase64: string): Promise<AppleReceiptValidation> {
  const base = await resolveBaseUrl();
  const res = await fetch(`${base}/validate-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptData: receiptDataBase64, excludeOldTransactions: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Receipt validation server error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json as AppleReceiptValidation;
}
