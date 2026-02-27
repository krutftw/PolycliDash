import { describe, expect, it } from 'vitest';
import { buildResearchMessages } from '../researchPrompt.js';

describe('buildResearchMessages', () => {
  it('builds deterministic market research instructions around user context', () => {
    const context = {
      market: { id: 'mkt-1', question: 'Will BTC be above $80k?' },
      orderbook: { yes: { bestBid: 0.54 }, no: { bestAsk: 0.49 } },
      positions: [{ outcome: 'YES', size: 120 }]
    };

    const messages = buildResearchMessages({
      question: 'Should I buy yes here?',
      marketId: 'mkt-1',
      timeHorizon: 'intraday',
      riskTolerance: 'moderate',
      context
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toMatch(/structured reasoning/i);
    expect(messages[1].content).toMatch(/Should I buy yes here\?/);
    expect(messages[1].content).toMatch(/"marketId": "mkt-1"/);
    expect(messages[1].content).toMatch(/"bestBid": 0\.54/);
  });
});
