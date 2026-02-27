import { spawn } from 'node:child_process';

const PARAM_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function assertRequiredParams(preset, params = {}) {
  const missing = (preset.requiredParams ?? []).filter((paramName) => {
    const value = params[paramName];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required params: ${missing.join(', ')}`);
  }
}

function injectParams(token, params) {
  return token.replace(PARAM_TOKEN_RE, (_, key) => {
    const rawValue = params[key];
    if (rawValue === undefined || rawValue === null) {
      throw new Error(`No value supplied for param "${key}"`);
    }
    return String(rawValue);
  });
}

export function buildCommandArgs(preset, params = {}) {
  assertRequiredParams(preset, params);
  return (preset.argsTemplate ?? []).map((token) => injectParams(token, params));
}

function parseOutput(rawStdout) {
  const trimmed = rawStdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through. Some CLIs emit line-delimited JSON.
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length > 1) {
    const parsedLines = [];
    for (const line of lines) {
      try {
        parsedLines.push(JSON.parse(line));
      } catch {
        return null;
      }
    }
    return parsedLines;
  }

  return null;
}

function runProcess(binary, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      env: process.env
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finalize = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 500);
      finalize({
        exitCode: -1,
        stdout,
        stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim(),
        durationMs: Date.now() - startedAt
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      clearTimeout(timeout);
      settled = true;
      reject(error);
    });

    child.on('close', (exitCode) => {
      finalize({
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

export async function runPreset({
  preset,
  params = {},
  cliBinary,
  timeoutMs = 25_000
}) {
  const args = buildCommandArgs(preset, params);
  const command = [cliBinary, ...args];
  const result = await runProcess(cliBinary, args, timeoutMs);
  return {
    ...result,
    success: result.exitCode === 0,
    command,
    parsed: parseOutput(result.stdout)
  };
}

export async function probeCli(cliBinary, timeoutMs = 7_000) {
  try {
    const result = await runProcess(cliBinary, ['--help'], timeoutMs);
    return {
      available: result.exitCode === 0,
      stderr: result.stderr.trim()
    };
  } catch (error) {
    return {
      available: false,
      stderr: error.message
    };
  }
}

