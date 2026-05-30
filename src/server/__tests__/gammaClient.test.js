import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { searchGammaMarkets } from '../gammaClient.js';

describe('searchGammaMarkets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok result with normalized market list on success', async () => {
    const rawMarkets = [
      {
        id: 'mkt-1',
        conditionId: 'cond-1',
        slug: 'will-x-happen',
        question: 'Will X happen?',
        active: true,
        closed: false,
        volume: '12345.67',
        volume24hr: '890.00',
        tokens: [
          { token_id: '111', outcome: 'Yes', price: 0.62 },
          { token_id: '222', outcome: 'No', price: 0.38 }
        ]
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(rawMarkets)
      })
    );

    const result = await searchGammaMarkets({ q: 'Will X', limit: 5 });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.markets[0].id).toBe('mkt-1');
    expect(result.markets[0].question).toBe('Will X happen?');
    expect(result.markets[0].tokens[0].outcome).toBe('Yes');
    expect(result.markets[0].tokens[0].price).toBe(0.62);
  });

  it('returns ok=false with error message when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    );

    const result = await searchGammaMarkets({ q: 'test' });

    expect(result.ok).toBe(false);
    expect(result.count).toBe(0);
    expect(result.markets).toHaveLength(0);
    expect(result.error).toMatch(/network error/i);
  });

  it('returns ok=false when the API responds with a non-200 status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => JSON.stringify({ error: 'rate limited' })
      })
    );

    const result = await searchGammaMarkets({});

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/429/);
  });

  it('clamps limit between 1 and 100', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          text: async () => '[]'
        });
      })
    );

    await searchGammaMarkets({ limit: 999 });
    expect(capturedUrl).toContain('limit=100');

    await searchGammaMarkets({ limit: -5 });
    expect(capturedUrl).toContain('limit=1');
  });
});
