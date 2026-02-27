const REQUEST_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

export function ensureGlm5Model(model) {
  const trimmed = String(model ?? '').trim();
  if (!trimmed.toLowerCase().startsWith('glm-5')) {
    throw new Error(
      `GLM-5 is mandatory for this dashboard. Received "${trimmed || 'empty'}".`
    );
  }
  return trimmed;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        `Ollama request failed (${response.status}): ${
          data.error || text || response.statusText
        }`
      );
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function pingOllama(baseUrl, model) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const ensuredModel = ensureGlm5Model(model);

  try {
    const data = await fetchJson(`${normalizedBaseUrl}/api/tags`);
    const models = Array.isArray(data.models)
      ? data.models.map((item) => item.name).filter(Boolean)
      : [];

    const hasConfiguredModel = models.some((name) => name === ensuredModel);
    const hasAnyGlm5 = models.some((name) => name.toLowerCase().startsWith('glm-5'));

    return {
      reachable: true,
      models,
      hasConfiguredModel,
      hasAnyGlm5
    };
  } catch (error) {
    return {
      reachable: false,
      models: [],
      hasConfiguredModel: false,
      hasAnyGlm5: false,
      error: error.message
    };
  }
}

export async function chatWithGlm5({
  baseUrl,
  model,
  messages,
  temperature = 0.2
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const ensuredModel = ensureGlm5Model(model);
  const payload = {
    model: ensuredModel,
    stream: false,
    messages,
    options: {
      temperature
    }
  };

  const data = await fetchJson(`${normalizedBaseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = data?.message?.content?.trim();
  if (!responseText) {
    throw new Error('Ollama returned an empty response.');
  }

  return {
    model: ensuredModel,
    raw: data,
    content: responseText
  };
}

