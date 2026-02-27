import { describe, expect, it } from 'vitest';
import { buildCommandArgs, assertRequiredParams } from '../cliRunner.js';

describe('cliRunner', () => {
  it('interpolates preset placeholders without shell expansion', () => {
    const preset = {
      argsTemplate: ['market', 'show', '--market-id', '{{marketId}}', '--side', '{{side}}']
    };

    const args = buildCommandArgs(preset, {
      marketId: '0xabc123',
      side: 'yes && rm -rf /'
    });

    expect(args).toEqual([
      'market',
      'show',
      '--market-id',
      '0xabc123',
      '--side',
      'yes && rm -rf /'
    ]);
  });

  it('throws when required params are missing', () => {
    const preset = {
      requiredParams: ['marketId', 'outcome']
    };

    expect(() => assertRequiredParams(preset, { marketId: '123' })).toThrow(
      /outcome/
    );
  });
});
