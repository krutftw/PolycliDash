import { describe, expect, it } from 'vitest';
import { buildLiveOverview } from '../liveOverview.js';

function okProbe(parsed) {
  return {
    attempted: true,
    success: true,
    execution: {
      parsed,
      stdout: JSON.stringify(parsed),
      stderr: ''
    }
  };
}

function failProbe(message) {
  return {
    attempted: true,
    success: false,
    execution: {
      parsed: null,
      stdout: '',
      stderr: message
    },
    error: message
  };
}

describe('buildLiveOverview', () => {
  it('builds a healthy overview payload when critical probes pass', () => {
    const data = buildLiveOverview({
      marketId: 'm1',
      listMarketsProbe: okProbe([{ id: 'm1' }, { id: 'm2' }]),
      openPositionsProbe: okProbe([{ marketId: 'm1', size: 10 }]),
      openOrdersProbe: okProbe([]),
      marketDetailProbe: okProbe({ id: 'm1', question: 'Will X happen?' }),
      orderbookProbe: okProbe({ yes: { bid: 0.51 } })
    });

    expect(data.health.ok).toBe(true);
    expect(data.marketList.count).toBe(2);
    expect(data.positions.count).toBe(1);
    expect(data.market.id).toBe('m1');
    expect(data.orderbook.yes.bid).toBe(0.51);
  });

  it('surfaces probe failures and marks health as degraded', () => {
    const data = buildLiveOverview({
      marketId: '',
      listMarketsProbe: failProbe('list failed'),
      openPositionsProbe: okProbe([]),
      openOrdersProbe: failProbe('orders failed'),
      marketDetailProbe: null,
      orderbookProbe: null
    });

    expect(data.health.ok).toBe(false);
    expect(data.health.errors.join(' ')).toMatch(/list failed/i);
    expect(data.health.errors.join(' ')).toMatch(/orders failed/i);
    expect(data.market).toBeNull();
    expect(data.orderbook).toBeNull();
  });
});
