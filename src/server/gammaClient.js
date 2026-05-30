const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com';
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        `Gamma API request failed (${response.status}): ${
          data.error || data.message || response.statusText
        }`
      );
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMarket(item) {
  return {
    id: item.id ?? null,
    conditionId: item.conditionId ?? item.condition_id ?? null,
    slug: item.slug ?? null,
    question: item.question ?? item.title ?? null,
    description: item.description ?? null,
    active: item.active ?? null,
    closed: item.closed ?? null,
    volume: item.volume ?? null,
    volume24hr: item.volume24hr ?? item.volumeNum ?? null,
    liquidity: item.liquidity ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    tokens: Array.isArray(item.tokens)
      ? item.tokens.map((t) => ({
          tokenId: t.token_id ?? t.tokenId ?? null,
          outcome: t.outcome ?? null,
          price: t.price ?? null
        }))
      : []
  };
}

export async function searchGammaMarkets({
  q = '',
  limit = 20,
  active = true,
  closed = false,
  order = 'volume24hr',
  ascending = false
} = {}) {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(1, Number(limit) || 20), 100)),
    active: String(active),
    closed: String(closed),
    order,
    ascending: String(ascending)
  });

  if (q && String(q).trim().length > 0) {
    params.set('q', String(q).trim());
  }

  try {
    const data = await fetchJson(`${GAMMA_BASE_URL}/markets?${params}`);
    const items = Array.isArray(data) ? data : [];
    return {
      ok: true,
      count: items.length,
      markets: items.map(normalizeMarket)
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      markets: [],
      error: error.message
    };
  }
}
