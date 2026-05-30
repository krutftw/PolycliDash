// ─── DOM refs ────────────────────────────────────────────────────────────────
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
const runCommandButton = document.querySelector('#run-command');
const cliOutput = document.querySelector('#cli-output');
const cliOutputRaw = document.querySelector('#cli-output-raw');
const lastCommand = document.querySelector('#last-command');
const refreshPresetsButton = document.querySelector('#refresh-presets');
const quickTradeForm = document.querySelector('#quick-trade-form');
const quickTradeSubmitButton = document.querySelector('#quick-trade-submit');
const quickTradeToken = document.querySelector('#quick-trade-token');
const quickTradeSide = document.querySelector('#quick-trade-side');
const quickTradePrice = document.querySelector('#quick-trade-price');
const quickTradeSize = document.querySelector('#quick-trade-size');
const quickTradeOutput = document.querySelector('#quick-trade-output');

const quickCancelIdInput = document.querySelector('#quick-cancel-id');
const quickCancelButton = document.querySelector('#quick-cancel-btn');

const researchForm = document.querySelector('#research-form');
const runResearchButton = document.querySelector('#run-research');
const researchOutput = document.querySelector('#research-output');
const researchContext = document.querySelector('#research-context');
const aiProvider = document.querySelector('#ai-provider');
const aiBaseUrl = document.querySelector('#ai-base-url');
const aiModel = document.querySelector('#ai-model');
const aiApiKey = document.querySelector('#ai-api-key');
const testAiConfigButton = document.querySelector('#test-ai-config');
const aiTestResult = document.querySelector('#ai-test-result');

const gammaSearchInput = document.querySelector('#gamma-search-input');
const gammaSearchButton = document.querySelector('#gamma-search-btn');
const gammaResults = document.querySelector('#gamma-results');

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  presets: [],
  selectedPreset: null,
  liveTimer: null,
  liveRefreshIntervalMs: 9000,
  isRefreshingLive: false,
  isRunningSetup: false,
  isRunningAction: false,
  isSubmittingTrade: false,
  isRunningResearch: false,
  isTestingAi: false,
  isSearchingGamma: false,
  isCancellingOrder: false
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEYS = {
  marketId: 'polyclidash.marketId',
  tokenId: 'polyclidash.tokenId',
  aiProvider: 'polyclidash.aiProvider',
  aiBaseUrl: 'polyclidash.aiBaseUrl',
  aiModel: 'polyclidash.aiModel',
  researchHistory: 'polyclidash.researchHistory',
  firstVisitDone: 'polyclidash.firstVisitDone'
};

function storageSave(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage full or blocked */
  }
}

function storageLoad(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function storageLoadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function storageSaveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

const PARAM_META = {
  marketId: { label: 'Market ID', placeholder: 'Paste market ID or slug' },
  tokenId: { label: 'Token ID', placeholder: 'Numeric token ID' },
  walletAddress: { label: 'Wallet Address', placeholder: '0x...' },
  orderId: { label: 'Order ID', placeholder: 'Order ID from open orders' },
  price: { label: 'Price', placeholder: '0.50' },
  size: { label: 'Size', placeholder: '10' }
};

// ─── Toast notifications ─────────────────────────────────────────────────────
let toastTimer = null;

function showToast(message, type = 'info') {
  let toast = document.querySelector('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast-${type} toast-visible`;
  toastTimer = setTimeout(() => {
    toast.className = `toast toast-${type}`;
  }, 3200);
}

// ─── Markdown renderer (no CDN dependency) ───────────────────────────────────
function renderMarkdown(text) {
  if (!text) {
    return '';
  }
  let html = escapeHtml(text);

  // ## Headings
  html = html.replace(/^## (.+)$/gm, '<h3 class="md-h2">$1</h3>');
  // ### Headings
  html = html.replace(/^### (.+)$/gm, '<h4 class="md-h3">$1</h4>');

  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *italic* or _italic_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Unordered list items (- item)
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^- /, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Numbered list items
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // Blank-line paragraph breaks (not inside list/heading)
  html = html
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) {
        return '';
      }
      if (/^<(h[34]|ul|ol|li)/.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

// ─── Clipboard ───────────────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'ok');
  } catch {
    showToast('Copy failed — select and copy manually', 'bad');
  }
}

function makeCopyButton(value, title = 'Copy') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.title = title;
  btn.textContent = '⎘';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(value);
  });
  return btn;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function shortText(value, limit = 96) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1)}…`;
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

function humanizeErrorText(raw) {
  let text = String(raw || '').trim();
  if (!text) {
    return 'Unknown error';
  }

  for (let depth = 0; depth < 3; depth += 1) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') {
        text = parsed.trim();
        continue;
      }
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.error === 'string') {
          text = parsed.error.trim();
          continue;
        }
        if (typeof parsed.message === 'string') {
          text = parsed.message.trim();
          continue;
        }
        text = toPretty(parsed);
      }
    } catch {
      break;
    }
  }

  text = text.replaceAll('\\n', '\n').replaceAll('\\"', '"').trim();

  const embeddedJson = text.match(/\{[\s\S]*\}$/);
  if (embeddedJson) {
    try {
      const parsedEmbedded = JSON.parse(embeddedJson[0]);
      if (typeof parsedEmbedded?.error === 'string') {
        text = parsedEmbedded.error.trim();
      }
    } catch {
      // keep original
    }
  }

  if (/fee rate not found for market/i.test(text)) {
    return 'Token is not tradable right now. Check token ID and market status.';
  }

  if (/unauthorized/i.test(text)) {
    return 'GLM-5 cloud needs Ollama sign-in. Run: ollama signin';
  }

  return compactText(text) || 'Unknown error';
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
    return 'No data yet.';
  }

  const lines = items.slice(0, 12).map((item, index) => {
    if (!item || typeof item !== 'object') {
      return `${index + 1}. ${String(item)}`;
    }

    const parts = fieldMap
      .map(({ label, keys, format }) => {
        const value = pickValue(item, keys);
        if (value === null) {
          return null;
        }
        const formattedValue = typeof format === 'function' ? format(value, item) : value;
        return `${label}: ${String(formattedValue)}`;
      })
      .filter(Boolean);

    if (parts.length === 0) {
      return `${index + 1}. ${toPretty(item)}`;
    }
    return `${index + 1}. ${parts.join(' | ')}`;
  });

  if (items.length > 12) {
    lines.push(`… and ${items.length - 12} more`);
  }

  return lines.join('\n');
}

function summarizeActionResult(presetId, payload) {
  if (!payload) {
    return 'Action completed, but there is no response data.';
  }

  if (presetId === 'walletAddress') {
    const address = pickValue(payload, ['address', 'wallet']);
    return address ? `Wallet connected: ${address}` : 'Wallet check completed.';
  }

  if (presetId === 'listMarkets') {
    const items = asArray(payload);
    if (items.length === 0) {
      return 'No markets returned.';
    }
    const preview = items
      .slice(0, 5)
      .map(
        (item, idx) =>
          `${idx + 1}. ${shortText(pickValue(item, ['question', 'title', 'name']) || 'Market', 92)}`
      )
      .join('\n');
    return `Loaded ${items.length} markets.\n\nTop results:\n${preview}`;
  }

  if (presetId === 'marketDetail') {
    return summarizeItems(payload, [
      { label: 'ID', keys: ['id', 'condition_id', 'slug'] },
      { label: 'Question', keys: ['question', 'title', 'name'] },
      { label: 'Active', keys: ['active', 'closed'] },
      { label: 'Volume', keys: ['volume', 'volume_num'] }
    ]);
  }

  if (presetId === 'openPositions') {
    const items = asArray(payload);
    return items.length === 0
      ? 'No open positions.'
      : `Found ${items.length} open positions.\n\n${summarizeItems(payload, [
          { label: 'Market', keys: ['market', 'conditionId', 'condition_id', 'market_id'] },
          { label: 'Outcome', keys: ['outcome', 'side'] },
          { label: 'Size', keys: ['size', 'shares', 'quantity'] }
        ])}`;
  }

  if (presetId === 'openOrders') {
    const items = asArray(payload);
    return items.length === 0
      ? 'No open orders.'
      : `Found ${items.length} open orders.\n\n${summarizeItems(payload, [
          { label: 'Order', keys: ['id', 'order_id'] },
          { label: 'Side', keys: ['side'] },
          { label: 'Price', keys: ['price'] },
          { label: 'Size', keys: ['size', 'quantity'] },
          { label: 'Status', keys: ['status'] }
        ])}`;
  }

  if (presetId === 'orderBook') {
    return `Orderbook loaded.\n${compactText(toPretty(payload))}`;
  }

  if (presetId === 'placeBuyOrder' || presetId === 'placeSellOrder') {
    const sideText = presetId === 'placeBuyOrder' ? 'Buy' : 'Sell';
    const orderId = pickValue(payload, ['id', 'orderID', 'order_id']);
    const status = pickValue(payload, ['status', 'state']);
    return `${sideText} order submitted.\n${orderId ? `Order ID: ${orderId}\n` : ''}${
      status ? `Status: ${status}` : 'Check Open Orders to confirm.'
    }`;
  }

  if (presetId === 'cancelOrder') {
    const status = pickValue(payload, ['status', 'state', 'result']);
    return `Cancel request submitted.${status ? `\nStatus: ${status}` : ''}`;
  }

  return `Action completed.\n${compactText(toPretty(payload))}`;
}

function formatActionFailure(result) {
  const primaryError =
    (result?.parsed &&
      (typeof result.parsed.error === 'string'
        ? result.parsed.error
        : typeof result.parsed.message === 'string'
          ? result.parsed.message
          : null)) ||
    result.stderr ||
    result.stdout ||
    'Unknown error';

  const cleanError = humanizeErrorText(primaryError);
  return `Action failed.\n${cleanError}`;
}

function setButtonBusy(button, busy, idleLabel, busyLabel) {
  if (!button) {
    return;
  }
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

function validateQuickTradeInput(params) {
  if (!/^\d+$/.test(params.tokenId)) {
    return 'Token ID must be numeric.';
  }
  const price = Number(params.price);
  if (!Number.isFinite(price) || price <= 0 || price >= 1) {
    return 'Price must be a number between 0 and 1 (e.g. 0.62).';
  }
  const size = Number(params.size);
  if (!Number.isFinite(size) || size <= 0) {
    return 'Size must be a positive number.';
  }
  return null;
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

// ─── Confirmation dialog ─────────────────────────────────────────────────────
function confirm(message) {
  return window.confirm(message);
}

// ─── Fill helpers (one-click "use this market") ──────────────────────────────
function fillMarketId(id) {
  liveMarketIdInput.value = id;
  document.querySelector('#research-market-id').value = id;
  setupMarketIdInput.value = id;
  storageSave(STORAGE_KEYS.marketId, id);
  showToast(`Market ID filled: ${shortText(id, 40)}`, 'ok');
  refreshLiveOverview().catch(() => {});
}

function fillTokenId(id, price) {
  liveTokenIdInput.value = id;
  document.querySelector('#research-token-id').value = id;
  setupTokenIdInput.value = id;
  quickTradeToken.value = id;
  if (price != null) {
    const priceNum = Number(price);
    if (Number.isFinite(priceNum) && priceNum > 0 && priceNum < 1) {
      quickTradePrice.value = priceNum.toFixed(3);
    }
  }
  storageSave(STORAGE_KEYS.tokenId, id);
  const priceHint = price != null ? ` (price: ${Number(price).toFixed(3)})` : '';
  showToast(`Token ID filled: ${id}${priceHint}`, 'ok');
  refreshLiveOverview().catch(() => {});
}

// ─── Persist AI config changes to localStorage ────────────────────────────────
aiProvider.addEventListener('change', () => {
  storageSave(STORAGE_KEYS.aiProvider, aiProvider.value);
});
aiBaseUrl.addEventListener('change', () => {
  storageSave(STORAGE_KEYS.aiBaseUrl, aiBaseUrl.value.trim());
});
aiModel.addEventListener('change', () => {
  storageSave(STORAGE_KEYS.aiModel, aiModel.value.trim());
});

// ─── Load persisted IDs and AI config from localStorage ──────────────────────
function loadFromStorage() {
  const marketId = storageLoad(STORAGE_KEYS.marketId);
  const tokenId = storageLoad(STORAGE_KEYS.tokenId);
  if (marketId) {
    liveMarketIdInput.value = marketId;
    document.querySelector('#research-market-id').value = marketId;
    setupMarketIdInput.value = marketId;
  }
  if (tokenId) {
    liveTokenIdInput.value = tokenId;
    document.querySelector('#research-token-id').value = tokenId;
    setupTokenIdInput.value = tokenId;
    quickTradeToken.value = tokenId;
  }
  const savedProvider = storageLoad(STORAGE_KEYS.aiProvider);
  const savedBaseUrl = storageLoad(STORAGE_KEYS.aiBaseUrl);
  const savedModel = storageLoad(STORAGE_KEYS.aiModel);
  if (savedProvider) {
    aiProvider.value = savedProvider;
  }
  if (savedBaseUrl) {
    aiBaseUrl.value = savedBaseUrl;
  }
  if (savedModel) {
    aiModel.value = savedModel;
  }
}

// ─── Research history ─────────────────────────────────────────────────────────
const RESEARCH_HISTORY_MAX = 5;

function loadResearchHistory() {
  return storageLoadJson(STORAGE_KEYS.researchHistory);
}

function addToResearchHistory(entry) {
  const history = loadResearchHistory();
  history.unshift(entry);
  storageSaveJson(STORAGE_KEYS.researchHistory, history.slice(0, RESEARCH_HISTORY_MAX));
  renderResearchHistory();
}

function renderResearchHistory() {
  const historyEl = document.querySelector('#research-history-list');
  if (!historyEl) {
    return;
  }
  const history = loadResearchHistory();
  if (history.length === 0) {
    historyEl.innerHTML = '<p class="panel-note">No research history yet.</p>';
    return;
  }
  historyEl.innerHTML = '';
  history.forEach((entry, index) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
    item.innerHTML = `
      <div class="history-item-head">
        <span class="history-market">${escapeHtml(shortText(entry.marketId || '', 36))}</span>
        <span class="history-meta">${escapeHtml(entry.model || '')}${ts ? ` · ${escapeHtml(ts)}` : ''}</span>
      </div>
      <p class="history-question">${escapeHtml(shortText(entry.question || '', 100))}</p>
      <button type="button" class="ghost-btn history-restore-btn" data-index="${index}">↩ Restore</button>
    `;
    item.querySelector('.history-restore-btn').addEventListener('click', () => {
      document.querySelector('#research-market-id').value = entry.marketId || '';
      document.querySelector('#research-question').value = entry.question || '';
      researchOutput.innerHTML = renderMarkdown(entry.analysis || '');
      researchOutput.className = 'analysis md-output';
      showToast('Research result restored', 'ok');
    });
    historyEl.appendChild(item);
  });
}

// ─── Status ──────────────────────────────────────────────────────────────────
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

    if (status.config?.liveRefreshIntervalMs > 0) {
      state.liveRefreshIntervalMs = status.config.liveRefreshIntervalMs;
    }
  } catch (error) {
    setStatus(statusCli, false, 'Offline');
    setStatus(statusAi, false, 'Offline');
    statusCliDetail.textContent = error.message;
    statusAiDetail.textContent = error.message;
  }
}

// ─── Setup wizard ─────────────────────────────────────────────────────────────
function renderSetup(data) {
  const summary = data.summary;
  const toneClass = summary.overallReady ? 'ok' : 'bad';
  const marketProbeText =
    summary.marketProbeReady === null ? 'Skipped' : summary.marketProbeReady ? 'Pass' : 'Fail';

  setupSummary.className = `wizard-summary ${toneClass}`;
  setupSummary.innerHTML = `
    <h3>Summary</h3>
    <p><strong>Trading Ready:</strong> ${summary.tradeReady ? '✓ Yes' : '✗ Not yet'}</p>
    <p><strong>AI Ready:</strong> ${summary.aiReady ? '✓ Yes' : '✗ Not yet'}</p>
    <p><strong>Market Probe:</strong> ${marketProbeText}</p>
    <p><strong>Overall:</strong> ${summary.overallReady ? '✓ Good to go' : '✗ Needs fixes'}</p>
    ${
      summary.nextActions.length > 0
        ? `<p><strong>Next steps:</strong><br />${summary.nextActions.map((item) => `• ${escapeHtml(item)}`).join('<br />')}</p>`
        : '<p><strong>Next steps:</strong> None — everything looks good.</p>'
    }
  `;

  setupChecks.innerHTML = '';
  data.checks.forEach((check) => {
    const item = document.createElement('article');
    item.className = `wizard-check ${check.status}`;
    const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '–';
    item.innerHTML = `
      <header>
        <h4>${escapeHtml(check.title)}</h4>
        <span class="check-state ${check.status === 'pass' ? 'ok' : check.status === 'fail' ? 'bad' : ''}">${icon} ${escapeHtml(check.status.toUpperCase())}</span>
      </header>
      <p>${escapeHtml(compactText(check.detail || '-'))}</p>
      ${check.fix ? `<small>Fix: ${escapeHtml(check.fix)}</small>` : ''}
    `;
    setupChecks.append(item);
  });
}

async function runSetupWizard() {
  if (state.isRunningSetup) {
    return;
  }
  state.isRunningSetup = true;
  setButtonBusy(runSetupButton, true, 'Check My Setup', 'Checking…');
  setupSummary.className = 'wizard-summary';
  setupSummary.textContent = 'Running checks…';
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
  } finally {
    state.isRunningSetup = false;
    setButtonBusy(runSetupButton, false, 'Check My Setup', 'Checking…');
  }
}

// ─── Live feed ────────────────────────────────────────────────────────────────
function renderLiveOverview(data) {
  setStatus(liveHealth, data.health.ok, data.health.ok ? 'Healthy' : 'Degraded');
  liveMarketCount.textContent = String(data.marketList.count);
  livePositionCount.textContent = String(data.positions.count);
  liveOrderCount.textContent = String(data.orders.count);
  liveUpdated.textContent = formatTime(data.generatedAt);

  liveMarketsOutput.textContent = summarizeItems(data.marketList.data, [
    { label: 'ID', keys: ['id', 'condition_id', 'slug'] },
    {
      label: 'Q',
      keys: ['question', 'title', 'name'],
      format: (value) => shortText(value, 84)
    },
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
    const marketId = data.market.id || data.market.slug || data.market.condition_id || 'unknown';
    const question = shortText(data.market.question || data.market.title || 'Unknown market', 120);
    orderbookLines.push(`Market: ${marketId}`);
    orderbookLines.push(`Question: ${question}`);
  }
  if (data.orderbook) {
    orderbookLines.push(`Orderbook: ${compactText(toPretty(data.orderbook))}`);
  } else {
    orderbookLines.push('Orderbook: Add a token ID above to load orderbook depth.');
  }
  if (Array.isArray(data.health.errors) && data.health.errors.length > 0) {
    orderbookLines.push('Issues:');
    data.health.errors.forEach((err) => {
      orderbookLines.push(`• ${compactText(err)}`);
    });
  }

  liveOrderbookOutput.textContent = orderbookLines.join('\n');
}

async function refreshLiveOverview(options = {}) {
  const manual = Boolean(options.manual);
  if (state.isRefreshingLive) {
    return;
  }
  state.isRefreshingLive = true;
  if (manual) {
    setButtonBusy(runLiveButton, true, 'Refresh Now', 'Refreshing…');
  }

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
  } finally {
    state.isRefreshingLive = false;
    if (manual) {
      setButtonBusy(runLiveButton, false, 'Refresh Now', 'Refreshing…');
    }
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
  }, state.liveRefreshIntervalMs);
}

// ─── Gamma market search ──────────────────────────────────────────────────────
function formatVolume(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return '—';
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
}

function renderGammaResults(result) {
  gammaResults.innerHTML = '';

  if (!result.ok) {
    gammaResults.innerHTML = `<p class="gamma-empty bad">Search failed: ${escapeHtml(result.error || 'Unknown error')}</p>`;
    return;
  }

  if (result.markets.length === 0) {
    gammaResults.innerHTML = '<p class="gamma-empty">No markets found. Try a different search term or browse trending markets.</p>';
    return;
  }

  const countEl = document.createElement('p');
  countEl.className = 'gamma-count';
  countEl.textContent = `${result.count} market${result.count === 1 ? '' : 's'} found`;
  gammaResults.appendChild(countEl);

  result.markets.forEach((market) => {
    const card = document.createElement('article');
    card.className = 'gamma-card';

    const question = escapeHtml(market.question || market.slug || 'Untitled market');
    const vol24 = formatVolume(market.volume24hr || market.volume);
    const statusLabel = market.closed ? 'Closed' : market.active === false ? 'Inactive' : 'Active';
    const statusClass = market.closed ? 'bad' : market.active === false ? '' : 'ok';

    // Token probability pills
    let tokenHtml = '';
    if (market.tokens && market.tokens.length > 0) {
      const pills = market.tokens
        .filter((t) => t.price != null)
        .map((t) => {
          const pct = (Number(t.price) * 100).toFixed(0);
          const cls = t.outcome?.toLowerCase() === 'yes' ? 'pill-yes' : 'pill-no';
          return `<span class="outcome-pill ${cls}">${escapeHtml(t.outcome || '?')} ${pct}%</span>`;
        })
        .join('');
      if (pills) {
        tokenHtml = `<div class="outcome-pills">${pills}</div>`;
      }
    }

    card.innerHTML = `
      <div class="gamma-card-head">
        <p class="gamma-question">${question}</p>
        <span class="gamma-status ${statusClass}">${statusLabel}</span>
      </div>
      ${tokenHtml}
      <div class="gamma-meta">
        <span>Vol 24h: <strong>${vol24}</strong></span>
        ${market.id ? `<span class="gamma-id" title="${escapeHtml(market.id)}">ID: ${escapeHtml(shortText(market.id, 24))}</span>` : ''}
      </div>
      <div class="gamma-actions"></div>
    `;

    const actionsDiv = card.querySelector('.gamma-actions');

    if (market.id) {
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'ghost-btn gamma-use-btn';
      useBtn.textContent = '→ Use Market ID';
      useBtn.addEventListener('click', () => fillMarketId(market.id));
      actionsDiv.appendChild(useBtn);

      const copyIdBtn = makeCopyButton(market.id, 'Copy market ID');
      actionsDiv.appendChild(copyIdBtn);
    }

    if (market.tokens && market.tokens.length > 0) {
      market.tokens.forEach((token) => {
        if (!token.tokenId) {
          return;
        }
        const useTokenBtn = document.createElement('button');
        useTokenBtn.type = 'button';
        useTokenBtn.className = 'ghost-btn gamma-use-btn';
        useTokenBtn.textContent = `→ Use ${escapeHtml(token.outcome || 'Token')} ID`;
        useTokenBtn.addEventListener('click', () => fillTokenId(token.tokenId, token.price));
        actionsDiv.appendChild(useTokenBtn);
      });
    }

    gammaResults.appendChild(card);
  });
}

async function runGammaSearch() {
  if (state.isSearchingGamma) {
    return;
  }
  const q = gammaSearchInput.value.trim();
  state.isSearchingGamma = true;
  setButtonBusy(gammaSearchButton, true, 'Search', 'Searching…');
  gammaResults.innerHTML = '<p class="gamma-empty">Searching Polymarket…</p>';

  try {
    const result = await getJson(
      `/api/gamma/markets?q=${encodeURIComponent(q)}&limit=15&active=true&closed=false&order=volume24hr`
    );
    renderGammaResults(result);
  } catch (error) {
    gammaResults.innerHTML = `<p class="gamma-empty bad">Search error: ${escapeHtml(error.message)}</p>`;
  } finally {
    state.isSearchingGamma = false;
    setButtonBusy(gammaSearchButton, false, 'Search', 'Searching…');
  }
}

// ─── Presets / action panel ───────────────────────────────────────────────────
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
    const meta = PARAM_META[paramName] || {};
    const wrapper = document.createElement('div');
    wrapper.className = 'field-with-copy';

    const label = document.createElement('label');
    label.className = 'field';

    const title = document.createElement('span');
    title.textContent = meta.label || paramName;

    const input = document.createElement('input');
    input.type = 'text';
    input.name = paramName;
    input.placeholder = meta.placeholder || `Enter ${paramName}`;
    input.required = true;
    input.autocomplete = 'off';

    label.append(title, input);
    wrapper.append(label);
    paramFields.append(wrapper);
  });
}

function populatePresetSelect() {
  presetSelect.innerHTML = '';
  state.presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.label} · ${preset.category}`;
    option.title = preset.description || '';
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

// ─── AI test ─────────────────────────────────────────────────────────────────
async function testAiConfig() {
  if (state.isTestingAi) {
    return;
  }
  state.isTestingAi = true;
  setButtonBusy(testAiConfigButton, true, 'Test AI Connection', 'Testing…');
  aiTestResult.textContent = 'Testing AI connection…';
  try {
    const result = await getJson('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiConfig: getAiConfigFromForm() })
    });
    const ok = result.reachable && result.hasConfiguredModel;
    aiTestResult.textContent = ok
      ? `✓ Connected: ${result.provider} / ${result.model}`
      : `⚠ Connected but model not ready: ${result.model}`;
    aiTestResult.className = `panel-note ${ok ? 'ok' : 'bad'}`;
  } catch (error) {
    aiTestResult.textContent = `✗ AI test failed: ${error.message}`;
    aiTestResult.className = 'panel-note bad';
  } finally {
    state.isTestingAi = false;
    setButtonBusy(testAiConfigButton, false, 'Test AI Connection', 'Testing…');
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────
presetSelect.addEventListener('change', () => {
  state.selectedPreset = state.presets.find((item) => item.id === presetSelect.value) ?? null;
  buildParamInputs(state.selectedPreset);
});

commandForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedPreset || state.isRunningAction) {
    return;
  }

  const formData = new FormData(commandForm);
  const params = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value).trim();
  }

  // Confirm before destructive execution actions
  const executionPresets = ['placeBuyOrder', 'placeSellOrder', 'cancelOrder'];
  if (executionPresets.includes(state.selectedPreset.id)) {
    const side = state.selectedPreset.id.includes('Buy') ? 'BUY' : state.selectedPreset.id.includes('Sell') ? 'SELL' : 'CANCEL';
    const confirmMsg = state.selectedPreset.id === 'cancelOrder'
      ? `Cancel order ${params.orderId || '(unknown)'}?`
      : `Submit ${side} order?\n\nToken: ${params.tokenId}\nPrice: ${params.price}\nSize: ${params.size}`;
    if (!confirm(confirmMsg)) {
      return;
    }
  }

  state.isRunningAction = true;
  setButtonBusy(runCommandButton, true, 'Run Action', 'Running…');

  cliOutput.textContent = 'Running action…';
  cliOutputRaw.textContent = '';
  try {
    const result = await getJson('/api/cli/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: state.selectedPreset.id, params })
    });

    lastCommand.textContent = result.command.join(' ');

    if (!result.success) {
      cliOutput.textContent = formatActionFailure(result);
      cliOutputRaw.textContent = `stderr:\n${result.stderr || '(empty)'}\n\nstdout:\n${
        result.stdout || '(empty)'
      }`;
      return;
    }

    cliOutput.textContent = summarizeActionResult(
      state.selectedPreset.id,
      result.parsed ?? result.stdout
    );
    cliOutputRaw.textContent = result.parsed
      ? toPretty(result.parsed)
      : result.stdout || '(no output)';
    refreshLiveOverview().catch(() => {});
    showToast('Action completed successfully', 'ok');
  } catch (error) {
    cliOutput.textContent = `Error: ${error.message}`;
    cliOutputRaw.textContent = '';
    showToast(`Action failed: ${error.message}`, 'bad');
  } finally {
    state.isRunningAction = false;
    setButtonBusy(runCommandButton, false, 'Run Action', 'Running…');
  }
});

quickTradeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.isSubmittingTrade) {
    return;
  }
  const side = quickTradeSide.value;
  const presetId = side === 'sell' ? 'placeSellOrder' : 'placeBuyOrder';
  const params = {
    tokenId: quickTradeToken.value.trim(),
    price: quickTradePrice.value.trim(),
    size: quickTradeSize.value.trim()
  };

  const validationError = validateQuickTradeInput(params);
  if (validationError) {
    quickTradeOutput.textContent = validationError;
    return;
  }

  const sideLabel = side.toUpperCase();
  const confirmMsg = `Submit ${sideLabel} order?\n\nToken: ${params.tokenId}\nPrice: ${params.price}\nSize: ${params.size}\n\nThis will place a real order.`;
  if (!confirm(confirmMsg)) {
    return;
  }

  state.isSubmittingTrade = true;
  setButtonBusy(quickTradeSubmitButton, true, 'Submit Trade', 'Submitting…');
  quickTradeOutput.textContent = 'Submitting trade…';
  try {
    const result = await getJson('/api/cli/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, params })
    });

    if (!result.success) {
      quickTradeOutput.textContent = formatActionFailure(result);
      showToast('Trade failed', 'bad');
      return;
    }

    quickTradeOutput.textContent = summarizeActionResult(presetId, result.parsed ?? result.stdout);
    refreshLiveOverview().catch(() => {});
    showToast(`${sideLabel} order submitted`, 'ok');
  } catch (error) {
    quickTradeOutput.textContent = `Trade failed: ${error.message}`;
    showToast(`Trade failed: ${error.message}`, 'bad');
  } finally {
    state.isSubmittingTrade = false;
    setButtonBusy(quickTradeSubmitButton, false, 'Submit Trade', 'Submitting…');
  }
});

researchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.isRunningResearch) {
    return;
  }

  const marketId = document.querySelector('#research-market-id').value.trim();
  const tokenId = document.querySelector('#research-token-id').value.trim();
  const question = document.querySelector('#research-question').value.trim();
  const timeHorizon = document.querySelector('#research-horizon').value;
  const riskTolerance = document.querySelector('#research-risk').value;

  state.isRunningResearch = true;
  setButtonBusy(runResearchButton, true, 'Get Research', 'Researching…');
  researchOutput.innerHTML = '<p class="md-loading">Building research view…</p>';
  researchOutput.className = 'analysis md-output';
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

    researchOutput.innerHTML = renderMarkdown(result.analysis);
    researchOutput.className = 'analysis md-output';
    researchContext.textContent = toPretty(result.context);
    addToResearchHistory({
      marketId,
      question,
      analysis: result.analysis,
      model: result.model,
      timestamp: new Date().toISOString()
    });
    showToast('Research complete', 'ok');
  } catch (error) {
    researchOutput.textContent = `Research failed: ${error.message}`;
    researchOutput.className = 'analysis';
    showToast(`Research failed: ${error.message}`, 'bad');
  } finally {
    state.isRunningResearch = false;
    setButtonBusy(runResearchButton, false, 'Get Research', 'Researching…');
  }
});

refreshPresetsButton.addEventListener('click', async () => {
  cliOutput.textContent = 'Refreshing actions…';
  try {
    await loadPresets();
    cliOutput.textContent = 'Action list refreshed.';
    showToast('Preset list refreshed', 'ok');
  } catch (error) {
    cliOutput.textContent = `Could not refresh list: ${error.message}`;
  }
});

runSetupButton.addEventListener('click', () => {
  runSetupWizard().catch(() => {});
});

runLiveButton.addEventListener('click', () => {
  refreshLiveOverview({ manual: true }).catch(() => {});
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

gammaSearchButton.addEventListener('click', () => {
  runGammaSearch().catch(() => {});
});

gammaSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runGammaSearch().catch(() => {});
  }
});

// ─── Quick Cancel (from live orders panel) ────────────────────────────────────
async function handleQuickCancel() {
  const orderId = quickCancelIdInput.value.trim();
  if (!orderId) {
    showToast('Enter an Order ID to cancel', 'warn');
    return;
  }
  if (!confirm(`Cancel order ${orderId}?\n\nThis will submit a cancel request.`)) {
    return;
  }
  state.isCancellingOrder = true;
  setButtonBusy(quickCancelButton, true, 'Cancel', 'Cancelling…');
  try {
    const result = await getJson('/api/cli/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: 'cancelOrder', params: { orderId } })
    });
    if (!result.success) {
      showToast(`Cancel failed: ${humanizeErrorText(result.stderr || result.stdout)}`, 'bad');
      return;
    }
    quickCancelIdInput.value = '';
    showToast(`Cancel request sent for order ${shortText(orderId, 24)}`, 'ok');
    refreshLiveOverview().catch(() => {});
  } catch (error) {
    showToast(`Cancel failed: ${error.message}`, 'bad');
  } finally {
    state.isCancellingOrder = false;
    setButtonBusy(quickCancelButton, false, 'Cancel', 'Cancelling…');
  }
}

if (quickCancelButton) {
  quickCancelButton.addEventListener('click', () => {
    handleQuickCancel().catch(() => {});
  });
}

if (quickCancelIdInput) {
  quickCancelIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickCancel().catch(() => {});
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  loadFromStorage();
  await Promise.all([loadStatus(), loadPresets()]);
  renderResearchHistory();
  // Load trending markets on startup so the search panel has content immediately
  runGammaSearch().catch(() => {});

  const isFirstVisit = !storageLoad(STORAGE_KEYS.firstVisitDone);
  if (isFirstVisit) {
    // Show a welcome hint in the setup panel and run the wizard automatically
    storageSave(STORAGE_KEYS.firstVisitDone, '1');
    const firstVisitBanner = document.querySelector('#first-visit-banner');
    if (firstVisitBanner) {
      firstVisitBanner.hidden = false;
    }
    await runSetupWizard();
    document.querySelector('#setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  await refreshLiveOverview();
  startLiveLoop();
}

bootstrap().catch((error) => {
  cliOutput.textContent = `Startup error: ${error.message}`;
  cliOutputRaw.textContent = '';
});

// ─── First-visit banner dismiss ───────────────────────────────────────────────
const firstVisitBanner = document.querySelector('#first-visit-banner');
const bannerDismissBtn = firstVisitBanner?.querySelector('.banner-dismiss');
if (bannerDismissBtn) {
  bannerDismissBtn.addEventListener('click', () => {
    firstVisitBanner.hidden = true;
  });
}
