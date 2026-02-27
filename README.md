# PloyCLIDash

A customer-friendly dashboard that wraps your Polymarket CLI into click-driven workflows and adds AI market research.

## What this app does

- Safe preset-based CLI execution from the browser (no raw shell injection).
- Guided setup wizard to verify customer onboarding readiness for trading + AI.
- Status checks for CLI availability and Ollama/`glm-5` readiness.
- One-click command center for discovery, portfolio, and order execution presets.
- Live matrix feed that auto-refreshes real CLI data (markets, positions, orders, orderbook).
- Structured market research endpoint that combines CLI context with `glm-5`.
- Optional custom AI provider mode (OpenAI-compatible endpoint + API key + model).

## Community

- Discord: https://discord.gg/RSDX3PbCyD
- Support/Donate:
  - GitHub: https://github.com/krutftw
  - Polygon wallet (USDC.e on Polygon POS): `0x8485E245e6103C337F56A64957911c8653A7cEE2`
  - Explorer: https://polygonscan.com/address/0x8485E245e6103C337F56A64957911c8653A7cEE2

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:4321`.

## Required setup

1. Install and configure the Polymarket CLI so `CLI_BINARY` is executable.
2. Run Ollama (local or cloud) and make sure `glm-5` is available.
3. Keep `OLLAMA_MODEL` set to `glm-5` (or a `glm-5:*` tag). Non-GLM-5 models are rejected.
4. If needed, users can choose an OpenAI-compatible provider in the dashboard and provide endpoint/key/model for research requests.

## Preset mapping

CLI actions are defined in:

`config/cli-presets.json`

If your Polymarket CLI subcommand names differ, update that file only. The dashboard reads these presets at startup.

Current preset defaults are mapped against `polymarket 0.1.4` command help (`markets get`, `clob orders`, `clob create-order`, `data positions`, etc.).

Each preset supports:

- `id`
- `label`
- `description`
- `category`
- `argsTemplate` with placeholders like `{{marketId}}`
- `requiredParams`

## Test

```bash
npm test
```

## API summary

- `GET /api/status` - CLI + AI health.
- `GET /api/cli/presets` - available action presets.
- `POST /api/cli/run` - execute one preset.
- `POST /api/research` - market analysis using default `glm-5` or optional custom provider config.
- `POST /api/setup/wizard` - onboarding readiness checks (trade + glm-5).
- `GET /api/live/overview` - live CLI market/account snapshot.
- `POST /api/ai/test` - validates custom AI provider credentials/model.
