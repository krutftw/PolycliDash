function makeCheck({
  id,
  title,
  status,
  critical = true,
  detail = '',
  fix = ''
}) {
  return {
    id,
    title,
    status,
    critical,
    detail,
    fix
  };
}

function isPass(status) {
  return status === 'pass';
}

export function evaluateSetupWizard({
  cliAvailable,
  canListMarkets,
  canAccessAccount,
  hasExecutionPresets,
  aiReachable,
  hasAnyGlm5,
  hasConfiguredModel,
  marketIdProvided,
  canFetchMarketDetail,
  canFetchOrderbook,
  details = {}
}) {
  const checks = [
    makeCheck({
      id: 'cli-available',
      title: 'Polymarket CLI Reachable',
      status: cliAvailable ? 'pass' : 'fail',
      detail: details.cli || (cliAvailable ? 'CLI responded to --help.' : 'CLI did not respond.'),
      fix: 'Set CLI_BINARY in .env to the correct executable/path.'
    }),
    makeCheck({
      id: 'market-read',
      title: 'Market Read Command',
      status: canListMarkets ? 'pass' : 'fail',
      detail: details.listMarkets || (canListMarkets ? 'Market list command succeeded.' : 'Could not read market list.'),
      fix: 'Run your CLI manually and verify markets list command and API credentials.'
    }),
    makeCheck({
      id: 'account-auth',
      title: 'Account / Wallet Access',
      status: canAccessAccount ? 'pass' : 'fail',
      detail: details.account || (canAccessAccount ? 'Account endpoints are accessible.' : 'Account commands failed.'),
      fix: 'Authenticate the CLI account/wallet and ensure permissions for positions/orders.'
    }),
    makeCheck({
      id: 'execution-presets',
      title: 'Execution Presets Wired',
      status: hasExecutionPresets ? 'pass' : 'fail',
      detail:
        details.executionPresets ||
        (hasExecutionPresets
          ? 'Buy/sell/cancel presets exist.'
          : 'One or more execution presets are missing.'),
      fix: 'Add placeBuyOrder, placeSellOrder, and cancelOrder in config/cli-presets.json.'
    }),
    makeCheck({
      id: 'ollama-reachable',
      title: 'Ollama Endpoint Reachable',
      status: aiReachable ? 'pass' : 'fail',
      detail: details.ollama || (aiReachable ? 'Ollama endpoint responded.' : 'Cannot reach Ollama endpoint.'),
      fix: 'Set OLLAMA_BASE_URL and verify network/firewall reachability.'
    }),
    makeCheck({
      id: 'glm5-installed',
      title: 'GLM-5 Installed on Ollama',
      status: hasAnyGlm5 ? 'pass' : 'fail',
      detail:
        details.glm5Installed ||
        (hasAnyGlm5 ? 'Detected at least one glm-5 model.' : 'No glm-5 model detected.'),
      fix: 'Pull model with: ollama pull glm-5'
    }),
    makeCheck({
      id: 'glm5-selected',
      title: 'Configured Model Uses GLM-5',
      status: hasConfiguredModel ? 'pass' : 'fail',
      detail:
        details.glm5Selected ||
        (hasConfiguredModel
          ? 'Configured model is available.'
          : 'Configured OLLAMA_MODEL is not available on the endpoint.'),
      fix: 'Set OLLAMA_MODEL=glm-5 (or glm-5:<tag>) and ensure that exact tag exists.'
    })
  ];

  if (marketIdProvided) {
    checks.push(
      makeCheck({
        id: 'market-probe-detail',
        title: 'Market Detail Probe',
        status: canFetchMarketDetail ? 'pass' : 'fail',
        critical: false,
        detail:
          details.marketDetail ||
          (canFetchMarketDetail
            ? 'Market detail command succeeded for probe market.'
            : 'Market detail probe failed.'),
        fix: 'Use a valid market id from List Markets and retry.'
      }),
      makeCheck({
        id: 'market-probe-orderbook',
        title: 'Orderbook Probe',
        status: canFetchOrderbook ? 'pass' : 'fail',
        critical: false,
        detail:
          details.orderbook ||
          (canFetchOrderbook
            ? 'Orderbook command succeeded for probe market.'
            : 'Orderbook probe failed.'),
        fix: 'Use a liquid market id and verify orderbook command syntax.'
      })
    );
  } else {
    checks.push(
      makeCheck({
        id: 'market-probe',
        title: 'Market-Specific Probe',
        status: 'skip',
        critical: false,
        detail: 'Optional: provide a market id to validate market detail + orderbook.',
        fix: 'Enter a market id in the setup wizard and rerun checks.'
      })
    );
  }

  const tradeCriticalIds = new Set([
    'cli-available',
    'market-read',
    'account-auth',
    'execution-presets'
  ]);
  const aiCriticalIds = new Set(['ollama-reachable', 'glm5-installed', 'glm5-selected']);

  const tradeReady = checks
    .filter((check) => tradeCriticalIds.has(check.id))
    .every((check) => isPass(check.status));
  const aiReady = checks
    .filter((check) => aiCriticalIds.has(check.id))
    .every((check) => isPass(check.status));

  const marketProbeChecks = checks.filter((check) =>
    ['market-probe-detail', 'market-probe-orderbook'].includes(check.id)
  );
  const marketProbeReady =
    marketProbeChecks.length === 0 ? null : marketProbeChecks.every((check) => isPass(check.status));

  const overallReady = marketProbeReady === null ? tradeReady && aiReady : tradeReady && aiReady && marketProbeReady;
  const nextActions = checks
    .filter((check) => check.status === 'fail' && check.fix)
    .map((check) => `${check.title}: ${check.fix}`);

  return {
    checks,
    summary: {
      tradeReady,
      aiReady,
      marketProbeReady,
      overallReady,
      nextActions
    }
  };
}

