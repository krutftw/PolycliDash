const REQUEST_TIMEOUT_MS = 30_000;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        `Provider request failed (${response.status}): ${
          payload.error?.message || payload.error || text || response.statusText
        }`
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function authHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
}

export async function probeOpenAiCompatible({ baseUrl, apiKey, model }) {
  try {
    const payload = await fetchJson(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: authHeaders(apiKey)
    });

    const models = Array.isArray(payload.data)
      ? payload.data.map((item) => item.id).filter(Boolean)
      : [];

    return {
      reachable: true,
      models,
      hasConfiguredModel: models.includes(model)
    };
  } catch (error) {
    return {
      reachable: false,
      models: [],
      hasConfiguredModel: false,
      error: error.message
    };
  }
}

export async function chatWithOpenAiCompatible({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.2
}) {
  const payload = await fetchJson(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  });

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Provider returned an empty response.');
  }

  return {
    model,
    raw: payload,
    content
  };
}

