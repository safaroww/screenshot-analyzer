// Serverless endpoint to validate Apple iOS subscription receipts with production→sandbox fallback
// Requires env: APPLE_SHARED_SECRET (App Store Connect > Subscriptions shared secret)

export const config = {
  api: {
    bodyParser: true,
  },
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const PROD_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

async function callAppleVerify(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json;
}

function normalizeResponse(appleJson) {
  // appleJson: { status, environment, latest_receipt_info, receipt, pending_renewal_info, ... }
  const now = Date.now();
  let latest = null;
  // Prefer latest_receipt_info for auto-renewable subscriptions
  const arr = Array.isArray(appleJson?.latest_receipt_info) ? appleJson.latest_receipt_info : [];
  if (arr.length > 0) {
    // Take the most recent by expires_date_ms if present; else by purchase_date_ms
    latest = arr.reduce((a, b) => {
      const aExp = parseInt(a?.expires_date_ms || '0', 10);
      const bExp = parseInt(b?.expires_date_ms || '0', 10);
      if (aExp !== bExp) return aExp > bExp ? a : b;
      const aBuy = parseInt(a?.purchase_date_ms || '0', 10);
      const bBuy = parseInt(b?.purchase_date_ms || '0', 10);
      return aBuy > bBuy ? a : b;
    });
  } else if (appleJson?.receipt?.in_app && Array.isArray(appleJson.receipt.in_app) && appleJson.receipt.in_app.length > 0) {
    // Non-subscription or legacy path
    latest = appleJson.receipt.in_app[appleJson.receipt.in_app.length - 1];
  }

  const expMs = latest?.expires_date_ms ? parseInt(latest.expires_date_ms, 10) : null;
  const isTrial = String(latest?.is_trial_period || '').toLowerCase() === 'true';
  const isInIntro = String(latest?.is_in_intro_offer_period || '').toLowerCase() === 'true';
  const cancellationDate = latest?.cancellation_date_ms ? parseInt(latest.cancellation_date_ms, 10) : null;
  const productId = latest?.product_id || null;
  const originalTxId = latest?.original_transaction_id || null;
  const environment = appleJson?.environment || 'Production';

  let status = 'inactive';
  let isActive = false;
  if (cancellationDate) {
    status = 'cancelled';
  } else if (expMs && expMs > now) {
    status = 'active';
    isActive = true;
  } else if (expMs && expMs <= now) {
    status = 'expired';
  }

  return {
    ok: appleJson?.status === 0,
    appleStatus: appleJson?.status,
    environment,
    isActive,
    status,
    isTrial,
    isInIntro,
    expiresAt: expMs ? new Date(expMs).toISOString() : null,
    productId,
    originalTransactionId: originalTxId,
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!sharedSecret) {
      return res.status(500).json({ error: 'APPLE_SHARED_SECRET is not set on server' });
    }
    const { receiptData, excludeOldTransactions = true } = req.body || {};
    if (!receiptData || typeof receiptData !== 'string') {
      return res.status(400).json({ error: 'Missing receiptData (base64 string)' });
    }

    const payload = {
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': !!excludeOldTransactions,
    };

    // 1) Try production first
    let appleJson = await callAppleVerify(PROD_URL, payload);
    if (appleJson?.status === 21007) {
      // 2) Sandbox fallback
      appleJson = await callAppleVerify(SANDBOX_URL, payload);
    }

    const normalized = normalizeResponse(appleJson || {});
    const http = normalized.ok ? 200 : 200; // Return 200 with diagnostic payload; client decides
    return res.status(http).json({
      ok: normalized.ok,
      appleStatus: normalized.appleStatus,
      environment: normalized.environment,
      isActive: normalized.isActive,
      status: normalized.status,
      isTrial: normalized.isTrial,
      isInIntro: normalized.isInIntro,
      expiresAt: normalized.expiresAt,
      productId: normalized.productId,
      originalTransactionId: normalized.originalTransactionId,
    });
  } catch (err) {
    console.error('validate-receipt error:', err);
    return res.status(500).json({ error: 'Validation failed', details: String(err?.message || err) });
  }
}
