/**
 * polymarket-clob.js
 *
 * Browser-compatible module for direct Polymarket API access.
 * Used when the local Node.js server is not running (e.g. GitHub Pages).
 *
 * Auth model:
 *   L1 – EIP-712 signature → derive API key/secret/passphrase from wallet
 *   L2 – HMAC-SHA256(secret, timestamp+METHOD+path+body) per request
 *
 * Signing uses ethers.js 6 loaded lazily from esm.sh CDN.
 */

export const CLOB_BASE = 'https://clob.polymarket.com';
export const GAMMA_BASE = 'https://gamma-api.polymarket.com';
export const DATA_API_BASE = 'https://data-api.polymarket.com';
export const CHAIN_ID = 137;

// CTF Exchange contract addresses (Polygon mainnet)
export const EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
export const NEG_RISK_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

// Amount rounding config per tick size (from clob-client)
const ROUNDING_CONFIG = {
  '0.1':   { price: 1, size: 2, amount: 3 },
  '0.01':  { price: 2, size: 2, amount: 4 },
  '0.001': { price: 3, size: 2, amount: 5 },
};
const DEFAULT_ROUNDING = { price: 2, size: 2, amount: 4 };

// ── Lazy ethers.js loader ──────────────────────────────────────────
let _ethers = null;
export async function getEthers() {
  if (!_ethers) {
    _ethers = await import('https://esm.sh/ethers@6');
  }
  return _ethers;
}

// ── HMAC-SHA256 (Web Crypto API) ──────────────────────────────────
async function hmacSign(secret, message) {
  // Polymarket secrets may be standard or url-safe base64; normalise first
  const b64 = secret.replace(/-/g, '+').replace(/_/g, '/');
  const secretBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const msgBytes = new TextEncoder().encode(message);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  const raw = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // Return URL-safe base64 without padding
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── L1 auth headers (EIP-712, used to derive API creds) ───────────
export async function buildL1Headers(wallet, nonce = 0) {
  const ts = Math.floor(Date.now() / 1000);
  const address = await wallet.getAddress();

  const domain = { name: 'ClobAuthDomain', version: '1', chainId: CHAIN_ID };
  const types = {
    ClobAuth: [
      { name: 'address', type: 'address' },
      { name: 'timestamp', type: 'string' },
      { name: 'nonce', type: 'uint256' },
      { name: 'message', type: 'string' },
    ],
  };
  const value = {
    address,
    timestamp: ts.toString(),
    nonce,
    message: 'This message attests that I control the given wallet',
  };

  const sig = await wallet.signTypedData(domain, types, value);
  return {
    POLY_ADDRESS: address,
    POLY_SIGNATURE: sig,
    POLY_TIMESTAMP: String(ts),
    POLY_NONCE: String(nonce),
  };
}

// ── L2 auth headers (HMAC per request) ────────────────────────────
export async function buildL2Headers(wallet, creds, method, path, body = '') {
  const ts = Math.floor(Date.now() / 1000);
  const address = await wallet.getAddress();
  const message = `${ts}${method}${path}${body}`;
  const sig = await hmacSign(creds.secret, message);
  return {
    POLY_ADDRESS: address,
    POLY_API_KEY: creds.apiKey,
    POLY_PASSPHRASE: creds.passphrase,
    POLY_SIGNATURE: sig,
    POLY_TIMESTAMP: String(ts),
  };
}

// ── Derive API credentials (deterministic per wallet) ─────────────
export async function deriveApiCreds(wallet) {
  const l1 = await buildL1Headers(wallet);
  const res = await fetch(`${CLOB_BASE}/auth/derive-api-key`, {
    headers: { ...l1, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }
  // Returns { apiKey, secret, passphrase }
  return res.json();
}

// ── CLOB API fetch helpers ─────────────────────────────────────────
export async function clobGet(path) {
  const res = await fetch(`${CLOB_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CLOB ${path} (${res.status}): ${text}`);
  }
  return res.json();
}

export async function clobGetAuth(wallet, creds, path) {
  const headers = await buildL2Headers(wallet, creds, 'GET', path);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CLOB ${path} (${res.status}): ${text}`);
  }
  return res.json();
}

export async function clobPost(wallet, creds, path, body) {
  const bodyStr = JSON.stringify(body);
  const headers = await buildL2Headers(wallet, creds, 'POST', path, bodyStr);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: bodyStr,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CLOB POST ${path} (${res.status}): ${text}`);
  }
  return res.json();
}

export async function clobDelete(wallet, creds, path, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = await buildL2Headers(wallet, creds, 'DELETE', path, bodyStr);
  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: bodyStr || undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CLOB DELETE ${path} (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Order building and EIP-712 signing ────────────────────────────
function roundHalfUp(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export async function buildAndSignOrder(wallet, { tokenId, price, size, side }) {
  const { parseUnits } = await getEthers();

  const [tickData, negRiskData] = await Promise.all([
    clobGet(`/tick-size?token_id=${tokenId}`),
    clobGet(`/neg-risk?token_id=${tokenId}`).catch(() => ({ neg_risk: false })),
  ]);

  const tickSize = String(tickData?.minimum_tick_size ?? '0.01');
  const negRisk = Boolean(negRiskData?.neg_risk);
  const rounding = ROUNDING_CONFIG[tickSize] ?? DEFAULT_ROUNDING;
  const exchangeAddress = negRisk ? NEG_RISK_EXCHANGE : EXCHANGE_ADDRESS;

  const priceR = roundHalfUp(Number(price), rounding.price);
  const sizeR = roundHalfUp(Number(size), rounding.size);

  let makerAmount, takerAmount;
  if (side === 0) {
    // BUY: maker pays USDC, taker delivers shares
    const rawAmt = roundHalfUp(priceR * sizeR, rounding.amount);
    makerAmount = parseUnits(rawAmt.toFixed(rounding.amount), 6);
    takerAmount = parseUnits(sizeR.toFixed(rounding.size), 6);
  } else {
    // SELL: maker delivers shares, taker pays USDC
    const rawAmt = roundHalfUp(priceR * sizeR, rounding.amount);
    makerAmount = parseUnits(sizeR.toFixed(rounding.size), 6);
    takerAmount = parseUnits(rawAmt.toFixed(rounding.amount), 6);
  }

  const address = await wallet.getAddress();
  const salt = BigInt(Math.floor(Math.random() * 1e15));

  const order = {
    salt,
    maker: address,
    signer: address,
    taker: '0x0000000000000000000000000000000000000000',
    tokenId: BigInt(tokenId),
    makerAmount,
    takerAmount,
    expiration: 0n,
    nonce: 0n,
    feeRateBps: 0n,
    side,
    signatureType: 0, // EOA
  };

  const domain = {
    name: 'Polymarket CTF Exchange',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: exchangeAddress,
  };

  const types = {
    Order: [
      { name: 'salt', type: 'uint256' },
      { name: 'maker', type: 'address' },
      { name: 'signer', type: 'address' },
      { name: 'taker', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'makerAmount', type: 'uint256' },
      { name: 'takerAmount', type: 'uint256' },
      { name: 'expiration', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'feeRateBps', type: 'uint256' },
      { name: 'side', type: 'uint8' },
      { name: 'signatureType', type: 'uint8' },
    ],
  };

  const signature = await wallet.signTypedData(domain, types, order);

  return {
    salt: salt.toString(),
    maker: order.maker,
    signer: order.signer,
    taker: order.taker,
    tokenId: order.tokenId.toString(),
    makerAmount: order.makerAmount.toString(),
    takerAmount: order.takerAmount.toString(),
    expiration: '0',
    nonce: '0',
    feeRateBps: '0',
    side,
    signatureType: 0,
    signature,
  };
}

// ── Place an order ─────────────────────────────────────────────────
export async function placeOrder(wallet, creds, orderParams) {
  const order = await buildAndSignOrder(wallet, orderParams);
  return clobPost(wallet, creds, '/order', {
    order,
    owner: await wallet.getAddress(),
    orderType: 'GTC',
  });
}

// ── Gamma market search (browser-direct) ──────────────────────────
export async function searchGammaMarkets({ q, limit = 15, active = true, closed = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q) {
    params.set('q', q);
  }
  params.set('active', String(active));
  params.set('closed', String(closed));
  params.set('order', 'volume24hr');

  const res = await fetch(`${GAMMA_BASE}/markets?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gamma search (${res.status}): ${text}`);
  }
  const markets = await res.json();
  const list = Array.isArray(markets) ? markets : [];
  return { ok: true, count: list.length, markets: list };
}

// ── Live overview (CLOB direct) ────────────────────────────────────
export async function fetchLiveOverview({ marketId, tokenId, wallet, creds } = {}) {
  const errors = [];
  const address = wallet ? await wallet.getAddress() : null;

  const [marketsR, marketDetailR, orderbookR] = await Promise.allSettled([
    clobGet('/markets?limit=10'),
    marketId ? clobGet(`/markets/${marketId}`) : Promise.resolve(null),
    tokenId ? clobGet(`/book?token_id=${tokenId}`) : Promise.resolve(null),
  ]);

  let marketList = { count: 0, data: [] };
  if (marketsR.status === 'fulfilled') {
    const raw = marketsR.value;
    const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
    marketList = { count: items.length, data: items };
  } else {
    errors.push(marketsR.reason.message);
  }

  let positions = { count: 0, data: [] };
  let orders = { count: 0, data: [] };

  if (address) {
    const [posR, ordersR] = await Promise.allSettled([
      fetch(`${DATA_API_BASE}/positions?user_address=${address}&sizeThreshold=.01`).then((r) =>
        r.json()
      ),
      creds
        ? clobGetAuth(
            wallet,
            creds,
            `/data/orders?maker_address=${address}&status=live`
          )
        : Promise.resolve([]),
    ]);

    if (posR.status === 'fulfilled') {
      const posData = Array.isArray(posR.value) ? posR.value : [];
      positions = { count: posData.length, data: posData };
    } else {
      errors.push(posR.reason.message);
    }

    if (ordersR.status === 'fulfilled') {
      const raw = ordersR.value;
      const ordersData = Array.isArray(raw) ? raw : (raw?.data ?? []);
      orders = { count: ordersData.length, data: ordersData };
    } else {
      errors.push(ordersR.reason.message);
    }
  }

  return {
    health: { ok: errors.length === 0, errors },
    marketList,
    positions,
    orders,
    market: marketDetailR.status === 'fulfilled' ? marketDetailR.value : null,
    orderbook: orderbookR.status === 'fulfilled' ? orderbookR.value : null,
    generatedAt: new Date().toISOString(),
  };
}

// ── Research prompt (mirror of src/server/researchPrompt.js) ──────
function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function extractProbability(marketData) {
  if (!marketData || typeof marketData !== 'object') {
    return null;
  }
  if (Array.isArray(marketData.tokens)) {
    const pairs = marketData.tokens
      .filter((t) => t.outcome && t.price != null)
      .map((t) => `${t.outcome}: ${(Number(t.price) * 100).toFixed(1)}%`);
    if (pairs.length > 0) {
      return pairs.join(' | ');
    }
  }
  for (const key of ['yes_price', 'noPrice', 'yesPrice', 'price']) {
    const val = marketData[key];
    if (val != null && Number.isFinite(Number(val))) {
      const pct = (Number(val) * 100).toFixed(1);
      return key.toLowerCase().includes('no') ? `NO: ${pct}%` : `YES: ${pct}%`;
    }
  }
  return null;
}

export function buildResearchMessages({
  question,
  marketId,
  timeHorizon,
  riskTolerance,
  context,
}) {
  const probabilityHint = extractProbability(
    typeof context?.market === 'object' ? context.market : null
  );

  const systemPrompt = [
    'You are a disciplined Polymarket research analyst writing for an active trader.',
    'Your output must be clear, direct, and actionable — not generic platitudes.',
    '',
    'Hard rules:',
    '- Base every claim strictly on the data supplied in the market packet.',
    '- If data is missing, thin, or contradictory, say so explicitly — do not fill gaps with assumptions.',
    '- Never guarantee outcomes on binary markets. Always express views as probabilities.',
    '- Quote specific numbers (prices, volumes, sizes) from the context when available.',
    probabilityHint
      ? `- Current market-implied probability hint: ${probabilityHint} — reason about whether this seems mispriced.`
      : '- Extract and reason about market-implied probabilities from the token prices in the context.',
    '',
    'Output exactly these five markdown sections (use ## headings):',
    '## Thesis',
    'One paragraph: your directional view and the single strongest reason for it.',
    '',
    '## Evidence Snapshot',
    'Bullet list: specific data points (volume, spread, liquidity, position size, price) that support or oppose the thesis.',
    '',
    '## Trade Plan',
    `Entry condition | Target exit | Invalidation level | Sizing idea for ${riskTolerance} risk tolerance | Time horizon: ${timeHorizon}`,
    '',
    '## What Could Prove This Wrong',
    'Two to four specific scenarios that would flip the trade.',
    '',
    '## Confidence',
    'A number 0–100 followed by one sentence explaining the biggest uncertainty.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Analyze this market packet:\n${safeJson({ marketId, timeHorizon, riskTolerance, question, context })}`,
    },
  ];
}

// ── AI call (browser-direct) ──────────────────────────────────────
export async function callAiDirect(aiConfig, messages) {
  const { provider, baseUrl, model, apiKey } = aiConfig;
  const base = (baseUrl || '').replace(/\/+$/, '');

  if (provider === 'ollama') {
    const m = (model || '').trim();
    if (!m.toLowerCase().startsWith('glm-5')) {
      throw new Error(`GLM-5 is mandatory for this dashboard. Received "${m || 'empty'}".`);
    }
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m, stream: false, messages, options: { temperature: 0.2 } }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error (${res.status}): ${text}`);
    }
    const data = await res.json();
    const content = data?.message?.content?.trim();
    if (!content) {
      throw new Error('Ollama returned an empty response.');
    }
    return { model: m, content };
  }

  // OpenAI-compatible
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) {
    const text = await res.text();
    let errMsg = text;
    try {
      const p = JSON.parse(text);
      errMsg = p.error?.message ?? p.error ?? text;
    } catch {
      // use raw text
    }
    throw new Error(`AI error (${res.status}): ${errMsg}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('AI returned an empty response.');
  }
  return { model, content };
}

// ── AI connection test (browser-direct) ──────────────────────────
export async function testAiDirect(aiConfig) {
  const { provider, baseUrl, model, apiKey } = aiConfig;
  const base = (baseUrl || '').replace(/\/+$/, '');
  try {
    if (provider === 'ollama') {
      const res = await fetch(`${base}/api/tags`);
      if (!res.ok) {
        return { reachable: false, error: `Status ${res.status}` };
      }
      const data = await res.json();
      const models = (data.models ?? []).map((m) => m.name).filter(Boolean);
      return {
        reachable: true,
        provider,
        model,
        models,
        hasConfiguredModel: models.includes(model),
        hasAnyGlm5: models.some((m) => m.toLowerCase().startsWith('glm-5')),
      };
    }
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: 'Bearer ' + apiKey },
    });
    if (!res.ok) {
      return { reachable: false, error: `Status ${res.status}` };
    }
    const data = await res.json();
    const models = (data.data ?? []).map((m) => m.id).filter(Boolean);
    return {
      reachable: true,
      provider,
      model,
      models,
      hasConfiguredModel: models.includes(model),
    };
  } catch (e) {
    return { reachable: false, error: e.message };
  }
}
