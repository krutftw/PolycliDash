function extractPayload(probe) {
  if (!probe?.success || !probe.execution) {
    return null;
  }

  if (probe.execution.parsed !== null && probe.execution.parsed !== undefined) {
    return probe.execution.parsed;
  }

  const text = String(probe.execution.stdout || '').trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function countItems(payload) {
  if (Array.isArray(payload)) {
    return payload.length;
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.items)) {
    return payload.items.length;
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data.length;
  }
  return payload ? 1 : 0;
}

function probeError(label, probe) {
  if (!probe) {
    return null;
  }
  if (probe.success) {
    return null;
  }
  const detail =
    probe.error ||
    probe.execution?.stderr ||
    probe.execution?.stdout ||
    `Probe failed for ${label}.`;
  return `${label}: ${String(detail).trim()}`;
}

export function buildLiveOverview({
  marketId,
  tokenId,
  listMarketsProbe,
  openPositionsProbe,
  openOrdersProbe,
  marketDetailProbe,
  orderbookProbe
}) {
  const marketListPayload = extractPayload(listMarketsProbe);
  const positionsPayload = extractPayload(openPositionsProbe);
  const ordersPayload = extractPayload(openOrdersProbe);
  const marketPayload = extractPayload(marketDetailProbe);
  const orderbookPayload = extractPayload(orderbookProbe);

  const errors = [
    probeError('List markets', listMarketsProbe),
    probeError('Open positions', openPositionsProbe),
    probeError('Open orders', openOrdersProbe),
    probeError('Market detail', marketDetailProbe),
    probeError('Orderbook', orderbookProbe)
  ].filter(Boolean);

  const ok =
    Boolean(listMarketsProbe?.success) &&
    Boolean(openPositionsProbe?.success || openOrdersProbe?.success) &&
    errors.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    marketId: marketId || null,
    tokenId: tokenId || null,
    health: {
      ok,
      errors
    },
    marketList: {
      count: countItems(marketListPayload),
      data: marketListPayload
    },
    positions: {
      count: countItems(positionsPayload),
      data: positionsPayload
    },
    orders: {
      count: countItems(ordersPayload),
      data: ordersPayload
    },
    market: marketPayload || null,
    orderbook: orderbookPayload || null
  };
}
