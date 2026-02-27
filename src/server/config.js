import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defaultPresets } from './presets.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function parseNumber(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPresetsPath() {
  if (process.env.CLI_PRESETS_PATH) {
    return path.resolve(projectRoot, process.env.CLI_PRESETS_PATH);
  }
  return path.join(projectRoot, 'config', 'cli-presets.json');
}

export const appConfig = {
  projectRoot,
  port: parseNumber(process.env.PORT, 4321),
  cliBinary: process.env.CLI_BINARY || 'polymarket',
  ollamaBaseUrl:
    (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, ''),
  ollamaModel: process.env.OLLAMA_MODEL || 'glm-5',
  commandTimeoutMs: parseNumber(process.env.CLI_COMMAND_TIMEOUT_MS, 25_000),
  presetsPath: getPresetsPath()
};

export function loadPresets() {
  try {
    if (!fs.existsSync(appConfig.presetsPath)) {
      return defaultPresets;
    }

    const raw = fs.readFileSync(appConfig.presetsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultPresets;
    }
    return parsed;
  } catch {
    return defaultPresets;
  }
}

