import { describe, expect, it } from 'vitest';
import { ensureGlm5Model } from '../ollamaClient.js';

describe('ensureGlm5Model', () => {
  it('accepts glm-5 variants', () => {
    expect(ensureGlm5Model('glm-5')).toBe('glm-5');
    expect(ensureGlm5Model('glm-5:latest')).toBe('glm-5:latest');
  });

  it('rejects non glm-5 models', () => {
    expect(() => ensureGlm5Model('llama3.1')).toThrow(/glm-5/i);
  });
});
