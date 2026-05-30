const SAFE_MODEL_RE = /^[a-zA-Z0-9._:/-]{2,120}$/;

function normalizeProvider(rawProvider) {
  const value = String(rawProvider || '').trim().toLowerCase();
  if (value === 'openai-compatible' || value === 'openai' || value === 'openrouter') {
    return 'openai-compatible';
  }
  return 'ollama';
}

function normalizeBaseUrl(url, fallback) {
  // Use string ops rather than a regex to avoid any ReDoS risk with trailing slashes
  let value = String(url || fallback || '').trim();
  while (value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  const lower = value.toLowerCase();
  if (value && !lower.startsWith('http://') && !lower.startsWith('https://')) {
    throw new Error('AI base URL must start with http:// or https://.');
  }
  return value;
}

function normalizeModel(model, fallback) {
  const value = String(model || fallback || '').trim();
  if (!SAFE_MODEL_RE.test(value)) {
    throw new Error(
      'Invalid model name. Use letters/numbers and . _ : / - only (2-120 chars).'
    );
  }
  return value;
}

export function resolveAiConfig(input, defaults) {
  const provider = normalizeProvider(input?.provider || defaults.provider);
  const baseUrl = normalizeBaseUrl(input?.baseUrl, defaults.baseUrl);
  const model = normalizeModel(input?.model, defaults.model);
  const apiKey = String(input?.apiKey || '').trim();

  if (!baseUrl) {
    throw new Error('AI base URL is required.');
  }

  if (provider === 'openai-compatible' && !apiKey) {
    throw new Error('API key is required for openai-compatible providers.');
  }

  return {
    provider,
    baseUrl,
    model,
    apiKey
  };
}

