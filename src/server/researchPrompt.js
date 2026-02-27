function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

export function buildResearchMessages({
  question,
  marketId,
  timeHorizon,
  riskTolerance,
  context
}) {
  const systemPrompt = [
    'You are a professional Polymarket research analyst.',
    'Your job is structured reasoning, not hype or certainty.',
    'Use only the supplied market context and user question.',
    'When evidence is thin or conflicting, explicitly say so.',
    'Do not claim guaranteed outcomes.',
    'Output markdown with these exact sections:',
    '1) Thesis',
    '2) Evidence Snapshot',
    '3) Trade Plan (entry, invalidation, sizing idea)',
    '4) What Could Prove This Wrong',
    '5) Confidence (0-100 + one sentence why)'
  ].join('\n');

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

