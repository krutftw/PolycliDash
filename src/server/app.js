import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { appConfig, loadPresets } from './config.js';
import { probeCli, runPreset } from './cliRunner.js';
import { buildResearchMessages } from './researchPrompt.js';
import { chatWithGlm5, pingOllama } from './ollamaClient.js';
import { evaluateSetupWizard } from './setupWizard.js';
import { buildLiveOverview } from './liveOverview.js';
import { resolveAiConfig } from './aiConfig.js';
import {
  chatWithOpenAiCompatible,
  probeOpenAiCompatible
} from './openAiCompatibleClient.js';

export function createApp() {
  const app = express();
  const presets = loadPresets();
  const presetMap = new Map(presets.map((preset) => [preset.id, preset]));
  const defaultAiConfig = {
    provider: 'ollama',
    baseUrl: appConfig.ollamaBaseUrl,
    model: appConfig.ollamaModel,
    apiKey: ''
  };

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const publicDir = path.join(appConfig.projectRoot, 'public');
  app.use(express.static(publicDir));

  function getPresetOrThrow(presetId) {
    const preset = presetMap.get(presetId);
    if (!preset) {
      throw new Error(`Unknown preset id "${presetId}".`);
    }
    return preset;
  }

  async function executePresetById(presetId, params = {}) {
    const preset = getPresetOrThrow(presetId);
    return runPreset({
      preset,
      params,
      cliBinary: appConfig.cliBinary,
      timeoutMs: appConfig.commandTimeoutMs
    });
  }

  function assertSuccessfulExecution(execution, label) {
    if (execution.success) {
      return;
    }
    const detail = execution.stderr || execution.stdout || 'Unknown CLI failure.';
    throw new Error(`${label} failed: ${detail}`.trim());
  }

  function summarizeExecution(execution, fallbackDetail) {
    if (!execution) {
      return fallbackDetail;
    }
    if (execution.success) {
      return execution.parsed
        ? 'Command returned JSON output.'
        : execution.stdout?.trim() || 'Command succeeded.';
    }
    return execution.stderr?.trim() || execution.stdout?.trim() || fallbackDetail;
  }

  async function safeRunPreset(presetId, params = {}) {
    if (!presetMap.has(presetId)) {
      return {
        attempted: false,
        success: false,
        error: `Missing preset "${presetId}".`
      };
    }

    try {
      const execution = await executePresetById(presetId, params);
      return {
        attempted: true,
        success: execution.success,
        execution
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        error: error.message
      };
    }
  }

  function extractWalletAddress(payload) {
    if (!payload) {
      return null;
    }
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return parsed?.address || null;
      } catch {
        return null;
      }
    }
    if (typeof payload === 'object' && payload.address) {
      return String(payload.address).trim();
    }
    return null;
  }

  async function runOpenPositionsProbe() {
    if (!presetMap.has('openPositions')) {
      return {
        attempted: false,
        success: false,
        error: 'Missing preset "openPositions".'
      };
    }

    const openPositionsPreset = presetMap.get('openPositions');
    const requiresWallet = (openPositionsPreset.requiredParams || []).includes(
      'walletAddress'
    );

    if (!requiresWallet) {
      return safeRunPreset('openPositions');
    }

    const walletProbe = await safeRunPreset('walletAddress');
    if (!walletProbe.success) {
      return {
        attempted: true,
        success: false,
        error: walletProbe.error || 'Wallet address probe failed.',
        walletProbe
      };
    }

    const walletAddress = extractWalletAddress(
      walletProbe.execution?.parsed ?? walletProbe.execution?.stdout
    );
    if (!walletAddress) {
      return {
        attempted: true,
        success: false,
        error: 'Wallet address not found from walletAddress preset output.',
        walletProbe
      };
    }

    const positionsProbe = await safeRunPreset('openPositions', { walletAddress });
    return {
      ...positionsProbe,
      walletAddress,
      walletProbe
    };
  }

  async function getAiStatus(aiConfig) {
    if (aiConfig.provider === 'openai-compatible') {
      const openAiStatus = await probeOpenAiCompatible(aiConfig);
      return {
        provider: aiConfig.provider,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
        reachable: openAiStatus.reachable,
        hasConfiguredModel: openAiStatus.hasConfiguredModel,
        hasAnyGlm5: true,
        availableModels: openAiStatus.models,
        detail: openAiStatus.error || null
      };
    }

    const ollamaStatus = await pingOllama(aiConfig.baseUrl, aiConfig.model);
    return {
      provider: aiConfig.provider,
      baseUrl: aiConfig.baseUrl,
      model: aiConfig.model,
      reachable: ollamaStatus.reachable,
      hasConfiguredModel: ollamaStatus.hasConfiguredModel,
      hasAnyGlm5: ollamaStatus.hasAnyGlm5,
      availableModels: ollamaStatus.models,
      detail: ollamaStatus.error || null
    };
  }

  async function chatWithAiConfig(aiConfig, messages) {
    if (aiConfig.provider === 'openai-compatible') {
      return chatWithOpenAiCompatible({
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        messages
      });
    }

    return chatWithGlm5({
      baseUrl: aiConfig.baseUrl,
      model: aiConfig.model,
      messages
    });
  }

  app.get('/api/status', async (_req, res) => {
    const [cliStatus, aiStatus] = await Promise.all([
      probeCli(appConfig.cliBinary, appConfig.commandTimeoutMs),
      getAiStatus(defaultAiConfig)
    ]);

    res.json({
      cli: {
        binary: appConfig.cliBinary,
        available: cliStatus.available,
        detail: cliStatus.stderr || null
      },
      ai: aiStatus
    });
  });

  app.get('/api/cli/presets', (_req, res) => {
    res.json({
      cliBinary: appConfig.cliBinary,
      presets
    });
  });

  app.post('/api/cli/run', async (req, res) => {
    const { presetId, params } = req.body ?? {};

    if (!presetId) {
      res.status(400).json({
        error: 'presetId is required.'
      });
      return;
    }

    try {
      const execution = await executePresetById(presetId, params || {});
      res.json(execution);
    } catch (error) {
      res.status(400).json({
        error: error.message
      });
    }
  });

  app.post('/api/setup/wizard', async (req, res) => {
    const marketId = String(req.body?.marketId || '').trim();
    const tokenId = String(req.body?.tokenId || '').trim();
    const marketIdProvided = marketId.length > 0;
    const tokenIdProvided = tokenId.length > 0;

    const [cliStatus, aiStatus] = await Promise.all([
      probeCli(appConfig.cliBinary, appConfig.commandTimeoutMs),
      getAiStatus(defaultAiConfig)
    ]);

    const requiredExecutionPresets = ['placeBuyOrder', 'placeSellOrder', 'cancelOrder'];
    const missingExecutionPresets = requiredExecutionPresets.filter(
      (presetId) => !presetMap.has(presetId)
    );
    const hasExecutionPresets = missingExecutionPresets.length === 0;

    const [listMarketsProbe, openPositionsProbe, openOrdersProbe, marketDetailProbe, orderbookProbe] =
      await Promise.all([
        safeRunPreset('listMarkets'),
        runOpenPositionsProbe(),
        safeRunPreset('openOrders'),
        marketIdProvided ? safeRunPreset('marketDetail', { marketId }) : Promise.resolve(null),
        tokenIdProvided ? safeRunPreset('orderBook', { tokenId }) : Promise.resolve(null)
      ]);

    const canListMarkets = Boolean(listMarketsProbe?.success);
    const canAccessAccount = Boolean(openPositionsProbe?.success || openOrdersProbe?.success);
    const canFetchMarketDetail = marketIdProvided ? Boolean(marketDetailProbe?.success) : false;
    const canFetchOrderbook = tokenIdProvided ? Boolean(orderbookProbe?.success) : false;

    const wizard = evaluateSetupWizard({
      cliAvailable: cliStatus.available,
      canListMarkets,
      canAccessAccount,
      hasExecutionPresets,
      aiReachable: aiStatus.reachable,
      hasAnyGlm5: aiStatus.hasAnyGlm5,
      hasConfiguredModel: aiStatus.hasConfiguredModel,
      marketIdProvided,
      tokenIdProvided,
      canFetchMarketDetail,
      canFetchOrderbook,
      details: {
        cli: cliStatus.stderr || (cliStatus.available ? 'CLI reachable.' : 'CLI unreachable.'),
        listMarkets:
          listMarketsProbe?.error ||
          summarizeExecution(listMarketsProbe?.execution, 'Market list probe failed.'),
        account:
          [openPositionsProbe, openOrdersProbe]
            .map((probe) => probe?.error || summarizeExecution(probe?.execution, 'Probe failed.'))
            .filter(Boolean)
            .join(' | ') || 'Account probes not executed.',
        executionPresets: hasExecutionPresets
          ? 'All required execution presets are present.'
          : `Missing presets: ${missingExecutionPresets.join(', ')}`,
        ollama:
          aiStatus.detail ||
          (aiStatus.reachable ? 'Ollama is reachable.' : 'Ollama is not reachable.'),
        glm5Installed: aiStatus.hasAnyGlm5
          ? 'GLM-5 model family detected.'
          : 'No GLM-5 model tags found on endpoint.',
        glm5Selected: aiStatus.hasConfiguredModel
          ? `Configured model ${appConfig.ollamaModel} is available.`
          : `Configured model ${appConfig.ollamaModel} not found on endpoint.`,
        marketDetail: marketDetailProbe?.error
          ? marketDetailProbe.error
          : summarizeExecution(
              marketDetailProbe?.execution,
              'Market detail probe failed or not executed.'
            ),
        orderbook: orderbookProbe?.error
          ? orderbookProbe.error
          : summarizeExecution(orderbookProbe?.execution, 'Orderbook probe failed or not executed.')
      }
    });

    res.json({
      generatedAt: new Date().toISOString(),
      marketId: marketIdProvided ? marketId : null,
      tokenId: tokenIdProvided ? tokenId : null,
      summary: wizard.summary,
      checks: wizard.checks
    });
  });

  app.post('/api/ai/test', async (req, res) => {
    try {
      const aiConfig = resolveAiConfig(req.body?.aiConfig, defaultAiConfig);
      const status = await getAiStatus(aiConfig);
      res.json(status);
    } catch (error) {
      res.status(400).json({
        error: error.message
      });
    }
  });

  app.get('/api/live/overview', async (req, res) => {
    const marketId = String(req.query.marketId || '').trim();
    const tokenId = String(req.query.tokenId || '').trim();

    const [listMarketsProbe, openPositionsProbe, openOrdersProbe, marketDetailProbe, orderbookProbe] =
      await Promise.all([
        safeRunPreset('listMarkets'),
        runOpenPositionsProbe(),
        safeRunPreset('openOrders'),
        marketId ? safeRunPreset('marketDetail', { marketId }) : Promise.resolve(null),
        tokenId ? safeRunPreset('orderBook', { tokenId }) : Promise.resolve(null)
      ]);

    const overview = buildLiveOverview({
      marketId,
      tokenId,
      listMarketsProbe,
      openPositionsProbe,
      openOrdersProbe,
      marketDetailProbe,
      orderbookProbe
    });

    res.json(overview);
  });

  app.post('/api/research', async (req, res) => {
    const {
      marketId,
      tokenId,
      question,
      timeHorizon = 'swing',
      riskTolerance = 'moderate'
    } = req.body ?? {};

    if (!marketId) {
      res.status(400).json({ error: 'marketId is required.' });
      return;
    }

    if (!question || String(question).trim().length < 8) {
      res
        .status(400)
        .json({ error: 'question is required and must be at least 8 characters.' });
      return;
    }

    try {
      const aiConfig = resolveAiConfig(req.body?.aiConfig, defaultAiConfig);
      const [market, orderbook, positionsProbe] = await Promise.all([
        executePresetById('marketDetail', { marketId }),
        tokenId ? executePresetById('orderBook', { tokenId }) : Promise.resolve(null),
        runOpenPositionsProbe()
      ]);

      assertSuccessfulExecution(market, 'Market detail command');
      if (tokenId && orderbook) {
        assertSuccessfulExecution(orderbook, 'Order book command');
      }

      const context = {
        market: market.parsed ?? market.stdout,
        orderbook:
          tokenId && orderbook
            ? orderbook.parsed ?? orderbook.stdout
            : {
                unavailable: true,
                reason: 'Token ID not provided for orderbook lookup.'
              },
        positions: positionsProbe.success
          ? positionsProbe.execution?.parsed ?? positionsProbe.execution?.stdout
          : {
              unavailable: true,
              reason:
                positionsProbe.error ||
                positionsProbe.execution?.stderr ||
                positionsProbe.execution?.stdout ||
                'No details.'
            }
      };

      const messages = buildResearchMessages({
        question,
        marketId,
        timeHorizon,
        riskTolerance,
        context
      });

      const aiResponse = await chatWithAiConfig(aiConfig, messages);

      res.json({
        provider: aiConfig.provider,
        model: aiResponse.model,
        analysis: aiResponse.content,
        context
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
