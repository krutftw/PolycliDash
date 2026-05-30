function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function extractProbability(marketData) {
  if (!marketData || typeof marketData !== 'object') {
    return null;
  }

  // Try to find outcome prices from tokens array (CLOB format)
  if (Array.isArray(marketData.tokens)) {
    const pairs = marketData.tokens
      .filter((t) => t.outcome && t.price != null)
      .map((t) => `${t.outcome}: ${(Number(t.price) * 100).toFixed(1)}%`);
    if (pairs.length > 0) {
      return pairs.join(' | ');
    }
  }

  // Flat price fields
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
  context
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
    'A number 0–100 followed by one sentence explaining the biggest uncertainty.'
  ]
    .filter((line) => line !== null)
    .join('\n');

  const userPayload = {
    marketId,
    timeHorizon,
    riskTolerance,
    question,
    context
  };

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Analyze this market packet:\n${safeJson(userPayload)}`
    }
  ];
}

