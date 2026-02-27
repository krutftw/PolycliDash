import { describe, expect, it } from 'vitest';
import { resolveAiConfig } from '../aiConfig.js';

describe('resolveAiConfig', () => {
  it('returns strict default ollama glm-5 config when override is empty', () => {
    const config = resolveAiConfig(
      undefined,
      {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'glm-5'
      }
    );

    expect(config.provider).toBe('ollama');
    expect(config.model).toBe('glm-5');
  });

  it('accepts openai-compatible config with model and api key', () => {
    const config = resolveAiConfig(
      {
        provider: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api',
        model: 'deepseek/deepseek-chat-v3-0324',
        apiKey: 'sk-abc'
      },
      {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'glm-5'
      }
    );

    expect(config.provider).toBe('openai-compatible');
    expect(config.baseUrl).toBe('https://openrouter.ai/api');
    expect(config.model).toBe('deepseek/deepseek-chat-v3-0324');
    expect(config.apiKey).toBe('sk-abc');
  });
});
