const statusCli = document.querySelector('#cli-status');
const statusCliDetail = document.querySelector('#cli-detail');
const statusAi = document.querySelector('#ai-status');
const statusAiDetail = document.querySelector('#ai-detail');

const runSetupButton = document.querySelector('#run-setup');
const setupMarketIdInput = document.querySelector('#setup-market-id');
const setupTokenIdInput = document.querySelector('#setup-token-id');
const setupSummary = document.querySelector('#setup-summary');
const setupChecks = document.querySelector('#setup-checks');

const runLiveButton = document.querySelector('#run-live');
const liveAutoToggle = document.querySelector('#live-auto');
const liveMarketIdInput = document.querySelector('#live-market-id');
const liveTokenIdInput = document.querySelector('#live-token-id');
const liveHealth = document.querySelector('#live-health');
const liveMarketCount = document.querySelector('#live-market-count');
const livePositionCount = document.querySelector('#live-position-count');
const liveOrderCount = document.querySelector('#live-order-count');
const liveUpdated = document.querySelector('#live-updated');
const liveMarketsOutput = document.querySelector('#live-markets-output');
const livePositionsOutput = document.querySelector('#live-positions-output');
const liveOrdersOutput = document.querySelector('#live-orders-output');
const liveOrderbookOutput = document.querySelector('#live-orderbook-output');

const presetSelect = document.querySelector('#preset-select');
const paramFields = document.querySelector('#param-fields');
const commandForm = document.querySelector('#command-form');
const cliOutput = document.querySelector('#cli-output');
const lastCommand = document.querySelector('#last-command');
const refreshPresetsButton = document.querySelector('#refresh-presets');

const researchForm = document.querySelector('#research-form');
const researchOutput = document.querySelector('#research-output');
const researchContext = document.querySelector('#research-context');
const aiProvider = document.querySelector('#ai-provider');
const aiBaseUrl = document.querySelector('#ai-base-url');
const aiModel = document.querySelector('#ai-model');
const aiApiKey = document.querySelector('#ai-api-key');
const testAiConfigButton = document.querySelector('#test-ai-config');
const aiTestResult = document.querySelector('#ai-test-result');

const state = {
  presets: [],
  selectedPreset: null,
  liveTimer: null
};

function setStatus(target, isHealthy, text) {
  target.textContent = text;
  target.classList.remove('ok', 'bad');
  target.classList.add(isHealthy ? 'ok' : 'bad');
}

function toPretty(value) {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function compactText(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith('Usage:') &&
        !line.startsWith('For more information')
    )
    .slice(0, 2)
    .join(' | ');
}

function asArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) {
      return payload.data;
    }
    if (Array.isArray(payload.items)) {
      return payload.items;
    }
    return [payload];
  }
  return [];
}

function pickValue(item, keys) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  return null;
}

function summarizeItems(payload, fieldMap) {
  const items = asArray(payload);
  if (items.length === 0) {
    return 'No data.';
  }

  const lines = items.slice(0, 12).map((item, index) => {
    if (!item || typeof item !== 'object') {
      return `${index + 1}. ${String(item)}`;
    }

    const parts = fieldMap
      .map(({ label, keys }) => {
        const value = pickValue(item, keys);
        if (value === null) {
          return null;
        }
        return `${label}: ${String(value)}`;
      })
      .filter(Boolean);

    if (parts.length === 0) {
      return `${index + 1}. ${toPretty(item)}`;
    }
    return `${index + 1}. ${parts.join(' | ')}`;
  });

  if (items.length > 12) {
    lines.push(`... and ${items.length - 12} more`);
  }

  return lines.join('\n');
}

function escapeHtml(raw) {
  return String(raw)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTime(isoTime) {
  try {
    return new Date(isoTime).toLocaleTimeString();
  } catch {
    return isoTime;
  }
}

function getAiConfigFromForm() {
  const config = {
    provider: aiProvider.value,
    baseUrl: aiBaseUrl.value.trim(),
    model: aiModel.value.trim(),
    apiKey: aiApiKey.value.trim()
  };

  if (!config.baseUrl && config.provider === 'ollama') {
    config.baseUrl = 'http://localhost:11434';
  }
  if (!config.model && config.provider === 'ollama') {
    config.model = 'glm-5';
  }

  return config;
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || response.statusText);
  }
  return payload;
}

async function loadStatus() {
  try {
    const status = await getJson('/api/status');
    setStatus(statusCli, status.cli.available, status.cli.available ? 'Online' : 'Offline');
    statusCliDetail.textContent = status.cli.detail || status.cli.binary;

    const aiHealthy = status.ai.reachable && status.ai.hasConfiguredModel;
    setStatus(statusAi, aiHealthy, aiHealthy ? 'Ready' : 'Needs Fix');
    statusAiDetail.textContent =
      status.ai.detail || `${status.ai.provider} · ${status.ai.baseUrl} · ${status.ai.model}`;
    if (!aiBaseUrl.value) {
      aiBaseUrl.value = status.ai.baseUrl || '';
    }
    if (!aiModel.value) {
      aiModel.value = status.ai.model || '';
    }
  } catch (error) {
    setStatus(statusCli, false, 'Offline');
    setStatus(statusAi, false, 'Offline');
    statusCliDetail.textContent = error.message;
    statusAiDetail.textContent = error.message;
  }
}

function renderSetup(data) {
  const summary = data.summary;
  const toneClass = summary.overallReady ? 'ok' : 'bad';
  const marketProbeText =
    summary.marketProbeReady === null ? 'Skipped' : summary.marketProbeReady ? 'Pass' : 'Fail';

  setupSummary.className = `wizard-summary ${toneClass}`;
  setupSummary.innerHTML = `
    <h3>Summary</h3>
    <p><strong>Trading Ready:</strong> ${summary.tradeReady ? 'Yes' : 'Not yet'}</p>
    <p><strong>AI Ready:</strong> ${summary.aiReady ? 'Yes' : 'Not yet'}</p>
    <p><strong>Market Probe:</strong> ${marketProbeText}</p>
    <p><strong>Overall:</strong> ${summary.overallReady ? 'Good to go' : 'Needs fixes'}</p>
    ${
      summary.nextActions.length > 0
        ? `<p><strong>How to fix:</strong><br />${summary.nextActions.map((item) => escapeHtml(item)).join('<br />')}</p>`
        : '<p><strong>How to fix:</strong> No action needed.</p>'
    }
  `;

  setupChecks.innerHTML = '';
  data.checks.forEach((check) => {
    const item = document.createElement('article');
    item.className = `wizard-check status-${check.status}`;
    item.innerHTML = `
      <header>
        <h4>${escapeHtml(check.title)}</h4>
        <span class="check-state">${escapeHtml(check.status.toUpperCase())}</span>
      </header>
      <p>${escapeHtml(compactText(check.detail || '-'))}</p>
      ${check.fix ? `<small>Fix: ${escapeHtml(check.fix)}</small>` : ''}
    `;
    setupChecks.append(item);
  });
}

async function runSetupWizard() {
  setupSummary.className = 'wizard-summary';
  setupSummary.textContent = 'Checking your setup...';
  setupChecks.innerHTML = '';

  try {
    const marketId = setupMarketIdInput.value.trim();
    const tokenId = setupTokenIdInput.value.trim();
    const payload = {};
    if (marketId) {
      payload.marketId = marketId;
    }
    if (tokenId) {
      payload.tokenId = tokenId;
    }
    const result = await getJson('/api/setup/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    renderSetup(result);
  } catch (error) {
    setupSummary.className = 'wizard-summary bad';
    setupSummary.textContent = `Setup check failed: ${error.message}`;
  }
}

function renderLiveOverview(data) {
  setStatus(liveHealth, data.health.ok, data.health.ok ? 'Healthy' : 'Degraded');
  liveMarketCount.textContent = String(data.marketList.count);
  livePositionCount.textContent = String(data.positions.count);
  liveOrderCount.textContent = String(data.orders.count);
  liveUpdated.textContent = formatTime(data.generatedAt);

  liveMarketsOutput.textContent = summarizeItems(data.marketList.data, [
    { label: 'ID', keys: ['id', 'condition_id', 'slug'] },
    { label: 'Q', keys: ['question', 'title', 'name'] },
    { label: 'Active', keys: ['active', 'closed'] },
    { label: 'Volume', keys: ['volume', 'volume_num'] }
  ]);

  livePositionsOutput.textContent = summarizeItems(data.positions.data, [
    { label: 'Market', keys: ['market', 'conditionId', 'condition_id', 'market_id'] },
    { label: 'Outcome', keys: ['outcome', 'side'] },
    { label: 'Size', keys: ['size', 'shares', 'quantity'] },
    { label: 'Value', keys: ['value', 'notional', 'pnl'] }
  ]);

  liveOrdersOutput.textContent = summarizeItems(data.orders.data, [
    { label: 'Order', keys: ['id', 'order_id'] },
    { label: 'Side', keys: ['side'] },
    { label: 'Price', keys: ['price'] },
    { label: 'Size', keys: ['size', 'quantity'] },
    { label: 'Status', keys: ['status'] }
  ]);

  const orderbookLines = [];
  if (data.market) {
    orderbookLines.push(
      `Market: ${compactText(
        toPretty({
          id: data.market.id || data.market.slug || data.market.condition_id,
          question: data.market.question || data.market.title
        })
      )}`
    );
  }
  if (data.orderbook) {
    orderbookLines.push(`Orderbook: ${compactText(toPretty(data.orderbook))}`);
  } else {
    orderbookLines.push('Orderbook: Add a token id to load orderbook depth.');
  }
  if (Array.isArray(data.health.errors) && data.health.errors.length > 0) {
    orderbookLines.push('Issues:');
    data.health.errors.forEach((err) => {
      orderbookLines.push(`- ${compactText(err)}`);
    });
  }

  liveOrderbookOutput.textContent = orderbookLines.join('\n');
}

async function refreshLiveOverview() {
  try {
    const marketId = liveMarketIdInput.value.trim();
    const tokenId = liveTokenIdInput.value.trim();
    const parts = [];
    if (marketId) {
      parts.push(`marketId=${encodeURIComponent(marketId)}`);
    }
    if (tokenId) {
      parts.push(`tokenId=${encodeURIComponent(tokenId)}`);
    }
    const query = parts.length > 0 ? `?${parts.join('&')}` : '';
    const result = await getJson(`/api/live/overview${query}`);
    renderLiveOverview(result);
  } catch (error) {
    setStatus(liveHealth, false, 'Error');
    liveOrderbookOutput.textContent = `Live refresh failed: ${error.message}`;
  }
}

function startLiveLoop() {
  if (state.liveTimer) {
    clearInterval(state.liveTimer);
    state.liveTimer = null;
  }

  if (!liveAutoToggle.checked) {
    return;
  }

  state.liveTimer = setInterval(() => {
    refreshLiveOverview().catch(() => {});
  }, 9000);
}

function buildParamInputs(preset) {
  paramFields.innerHTML = '';
  const params = preset?.requiredParams || [];
  if (params.length === 0) {
    const info = document.createElement('p');
    info.className = 'panel-note';
    info.textContent = 'No extra details needed for this action.';
    paramFields.append(info);
    return;
  }

  params.forEach((paramName) => {
    const label = document.createElement('label');
    label.className = 'field';

    const title = document.createElement('span');
    title.textContent = paramName;

    const input = document.createElement('input');
    input.type = 'text';
    input.name = paramName;
    input.placeholder = `Enter ${paramName}`;
    input.required = true;

    label.append(title, input);
    paramFields.append(label);
  });
}

function populatePresetSelect() {
  presetSelect.innerHTML = '';
  state.presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.label} · ${preset.category}`;
    presetSelect.append(option);
  });

  state.selectedPreset = state.presets[0] ?? null;
  if (state.selectedPreset) {
    presetSelect.value = state.selectedPreset.id;
  }
  buildParamInputs(state.selectedPreset);
}

async function loadPresets() {
  const { presets } = await getJson('/api/cli/presets');
  state.presets = presets;
  populatePresetSelect();
}

async function testAiConfig() {
  aiTestResult.textContent = 'Testing AI connection...';
  try {
    const result = await getJson('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiConfig: getAiConfigFromForm()
      })
    });
    const ok = result.reachable && result.hasConfiguredModel;
    aiTestResult.textContent = ok
      ? `Connected: ${result.provider} / ${result.model}`
      : `Connected but model not ready: ${result.model}`;
    aiTestResult.className = `panel-note ${ok ? 'ok' : 'bad'}`;
  } catch (error) {
    aiTestResult.textContent = `AI test failed: ${error.message}`;
    aiTestResult.className = 'panel-note bad';
  }
}

presetSelect.addEventListener('change', () => {
  state.selectedPreset = state.presets.find((item) => item.id === presetSelect.value) ?? null;
  buildParamInputs(state.selectedPreset);
});

commandForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedPreset) {
    return;
  }

  const formData = new FormData(commandForm);
  const params = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value).trim();
  }

  cliOutput.textContent = 'Running action...';
  try {
    const result = await getJson('/api/cli/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: state.selectedPreset.id,
        params
      })
    });

    lastCommand.textContent = result.command.join(' ');

    if (!result.success) {
      cliOutput.textContent = [
        'Action failed.',
        '',
        `Error:\n${result.stderr || '(empty)'}`,
        '',
        `Output:\n${result.stdout || '(empty)'}`
      ].join('\n');
      return;
    }

    cliOutput.textContent = result.parsed ? toPretty(result.parsed) : result.stdout || '(no output)';
    refreshLiveOverview().catch(() => {});
  } catch (error) {
    cliOutput.textContent = `Error: ${error.message}`;
  }
});

researchForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const marketId = document.querySelector('#research-market-id').value.trim();
  const tokenId = document.querySelector('#research-token-id').value.trim();
  const question = document.querySelector('#research-question').value.trim();
  const timeHorizon = document.querySelector('#research-horizon').value;
  const riskTolerance = document.querySelector('#research-risk').value;

  researchOutput.textContent = 'Building research view...';
  researchContext.textContent = '';

  try {
    const result = await getJson('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId,
        tokenId,
        question,
        timeHorizon,
        riskTolerance,
        aiConfig: getAiConfigFromForm()
      })
    });

    researchOutput.textContent = result.analysis;
    researchContext.textContent = toPretty(result.context);
  } catch (error) {
    researchOutput.textContent = `Research failed: ${error.message}`;
  }
});

refreshPresetsButton.addEventListener('click', async () => {
  cliOutput.textContent = 'Refreshing actions...';
  try {
    await loadPresets();
    cliOutput.textContent = 'Action list refreshed.';
  } catch (error) {
    cliOutput.textContent = `Could not refresh list: ${error.message}`;
  }
});

runSetupButton.addEventListener('click', () => {
  runSetupWizard().catch(() => {});
});

runLiveButton.addEventListener('click', () => {
  refreshLiveOverview().catch(() => {});
});

liveAutoToggle.addEventListener('change', () => {
  startLiveLoop();
});

liveMarketIdInput.addEventListener('change', () => {
  refreshLiveOverview().catch(() => {});
});

liveTokenIdInput.addEventListener('change', () => {
  refreshLiveOverview().catch(() => {});
});

testAiConfigButton.addEventListener('click', () => {
  testAiConfig().catch(() => {});
});

async function bootstrap() {
  await Promise.all([loadStatus(), loadPresets()]);
  await runSetupWizard();
  await refreshLiveOverview();
  startLiveLoop();
}

bootstrap().catch((error) => {
  cliOutput.textContent = `Startup error: ${error.message}`;
});
