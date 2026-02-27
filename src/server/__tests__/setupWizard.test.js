import { describe, expect, it } from 'vitest';
import { evaluateSetupWizard } from '../setupWizard.js';

describe('evaluateSetupWizard', () => {
  it('marks system fully ready when trading and glm-5 checks pass', () => {
    const result = evaluateSetupWizard({
      cliAvailable: true,
      canListMarkets: true,
      canAccessAccount: true,
      hasExecutionPresets: true,
      aiReachable: true,
      hasAnyGlm5: true,
      hasConfiguredModel: true,
      marketIdProvided: true,
      canFetchMarketDetail: true,
      canFetchOrderbook: true,
      details: {}
    });

    expect(result.summary.tradeReady).toBe(true);
    expect(result.summary.aiReady).toBe(true);
    expect(result.summary.marketProbeReady).toBe(true);
    expect(result.summary.overallReady).toBe(true);
    expect(result.summary.nextActions).toHaveLength(0);
  });

  it('returns actionable steps when account auth or glm-5 wiring is missing', () => {
    const result = evaluateSetupWizard({
      cliAvailable: true,
      canListMarkets: true,
      canAccessAccount: false,
      hasExecutionPresets: false,
      aiReachable: true,
      hasAnyGlm5: false,
      hasConfiguredModel: false,
      marketIdProvided: false,
      canFetchMarketDetail: false,
      canFetchOrderbook: false,
      details: {}
    });

    expect(result.summary.tradeReady).toBe(false);
    expect(result.summary.aiReady).toBe(false);
    expect(result.summary.overallReady).toBe(false);
    expect(result.checks.some((check) => check.status === 'skip')).toBe(true);
    expect(result.summary.nextActions.join(' ')).toMatch(/glm-5/i);
    expect(result.summary.nextActions.join(' ')).toMatch(/execution preset/i);
  });
});
