import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  probeOpenAiCompatible,
  chatWithOpenAiCompatible
} from '../openAiCompatibleClient.js';

describe('probeOpenAiCompatible', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns reachable=true with model list on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [
              { id: 'gpt-4o' },
              { id: 'gpt-4o-mini' }
            ]
          })
      })
    );

    const result = await probeOpenAiCompatible({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-test',
      model: 'gpt-4o'
    });

    expect(result.reachable).toBe(true);
    expect(result.models).toContain('gpt-4o');
    expect(result.hasConfiguredModel).toBe(true);
  });

  it('returns hasConfiguredModel=false when model not in list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: [{ id: 'gpt-3.5-turbo' }] })
      })
    );

    const result = await probeOpenAiCompatible({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-test',
      model: 'gpt-4o'
    });

    expect(result.reachable).toBe(true);
    expect(result.hasConfiguredModel).toBe(false);
  });

  it('returns reachable=false when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Connection refused'))
    );

    const result = await probeOpenAiCompatible({
      baseUrl: 'http://localhost:9999',
      apiKey: '',
      model: 'some-model'
    });

    expect(result.reachable).toBe(false);
    expect(result.models).toHaveLength(0);
    expect(result.hasConfiguredModel).toBe(false);
    expect(result.error).toMatch(/connection refused/i);
  });

  it('returns reachable=false on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'invalid api key' })
      })
    );

    const result = await probeOpenAiCompatible({
      baseUrl: 'https://api.openai.com',
      apiKey: 'bad-key',
      model: 'gpt-4o'
    });

    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/401/);
  });
});

describe('chatWithOpenAiCompatible', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns model and trimmed content on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            model: 'gpt-4o',
            choices: [
              { message: { content: '  Analysis result.  ' } }
            ]
          })
      })
    );

    const result = await chatWithOpenAiCompatible({
      baseUrl: 'https://api.openai.com',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'What is the outlook?' }]
    });

    expect(result.model).toBe('gpt-4o');
    expect(result.content).toBe('Analysis result.');
  });

  it('throws when provider returns empty content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: '' } }]
          })
      })
    );

    await expect(
      chatWithOpenAiCompatible({
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        messages: []
      })
    ).rejects.toThrow(/empty response/i);
  });

  it('throws with provider error message on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () =>
          JSON.stringify({ error: { message: 'Rate limit exceeded' } })
      })
    );

    await expect(
      chatWithOpenAiCompatible({
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        messages: []
      })
    ).rejects.toThrow(/rate limit exceeded/i);
  });
});
