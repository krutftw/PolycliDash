# PolyCLIDash

A browser-based dashboard that wraps the **Polymarket CLI** with live data feeds, one-click trading, Gamma API market search, and AI-powered (GLM-5 / any OpenAI-compatible model) trade research.

Community: **[discord.gg/RSDX3PbCyD](https://discord.gg/RSDX3PbCyD)**

---

## Features

| Feature | Description |
|---|---|
| 🔍 **Market Search** | Live search via the Polymarket Gamma API — no market ID needed upfront |
| 📡 **Live Feed** | Auto-refreshes markets, positions, open orders, and orderbook on a timer |
| ⚡ **Quick Trade** | Buy / sell form with confirmation dialog before any order is placed |
| 🛠 **Action Buttons** | Click-friendly wrapper for all your CLI presets |
| 🤖 **AI Research** | Structured trade analysis from GLM-5 (or any OpenAI-compatible model) in markdown |
| 🔒 **Security** | Helmet CSP, rate limiting (120/min general, 20/min heavy endpoints) |
| 🖥 **UX** | Toast notifications, copy-to-clipboard, one-click "Use this market" fill, markdown rendering |

---

## Quick Start

### 1 — Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Polymarket CLI](https://github.com/Polymarket/cli) installed and authenticated
- [Ollama](https://ollama.com/) with `glm-5` pulled **or** an OpenAI-compatible API key

### 2 — Install

```bash
git clone https://github.com/krutftw/PolycliDash
cd PolycliDash
npm install
```

### 3 — Configure

```bash
cp .env.example .env
# edit .env with your values
```

### 4 — Run

```bash
npm start
```

Open **http://localhost:3000** in your browser.

---

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `CLI_PATH` | `polymarket` | Path to the Polymarket CLI binary |
| `CLI_TIMEOUT_MS` | `30000` | Max time (ms) to wait for a CLI command |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `LIVE_REFRESH_INTERVAL_MS` | `9000` | How often the live feed auto-refreshes (ms) |

---

## Market Search

The **Market Search** panel uses the Polymarket Gamma API (`gamma-api.polymarket.com/markets`).

- Leave the search box **blank** to load trending markets
- Type any keyword (e.g. "Bitcoin", "election", "Fed rate") and press **Search**
- Each result card shows live YES/NO outcome prices
- Click **→ Use Market ID** to fill the Market ID into every panel at once
- Click **→ Use Token ID** on a specific outcome to fill the Token ID

---

## AI Research

1. Use Market Search or manually enter a Market ID
2. Type your question (e.g. "Which side is stronger right now?")
3. Choose time horizon and risk style
4. Click **Get Research**

The AI receives: live market data, orderbook depth, your positions, current market-implied probabilities, and a structured analyst system prompt. Output is rendered in markdown.

### Custom AI model

Expand **Custom AI Model** to:
- Switch from Ollama to any **OpenAI-compatible API**
- Override the model name and base URL
- Enter an API key if required

---

## Development

```bash
npm test        # run all 15 unit tests (Vitest)
npm run lint    # ESLint (if configured)
```

Tests are in `src/server/__tests__/`.

---

## Architecture

```
src/
  server/
    app.js              — Express app factory (routes, middleware)
    index.js            — HTTP server + graceful shutdown
    config.js           — Env-based config
    cliRunner.js        — Spawns CLI subprocesses
    liveOverview.js     — Aggregates live CLI data
    gammaClient.js      — Polymarket Gamma API client
    ollamaClient.js     — Ollama AI client (GLM-5 enforced)
    openAiCompatibleClient.js — OpenAI-compatible AI client
    researchPrompt.js   — Builds structured AI research messages
    setupWizard.js      — Checks CLI/API/auth/presets
    aiConfig.js         — Validates AI provider config
    presets.js          — Loads CLI action presets
  server/__tests__/     — Vitest unit tests

public/
  index.html            — Dashboard HTML
  app.js                — Frontend logic (vanilla JS ES modules)
  styles.css            — All styles (dark matrix theme)

config/
  cli-presets.json      — Preset CLI actions shown in Action Buttons
```

---

## Security

- **Helmet** — sets secure HTTP headers including a strict Content Security Policy
- **Rate limiting** — 120 req/min on all `/api` routes; 20 req/min on `/api/research` and `/api/setup/wizard`
- **Graceful shutdown** — SIGTERM/SIGINT handled cleanly with an 8-second force-exit timeout
- No secrets stored client-side; AI API keys stay in memory only for the request lifetime

---

## License

MIT
