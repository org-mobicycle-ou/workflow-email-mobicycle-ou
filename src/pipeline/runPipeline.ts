// Pipeline - runs the steps + handles all HTTP routes
// Does NOT run infrastructure checks - cron jobs do that

import type { Env } from './shared/types';
import { getKVBindings } from './shared/kv-bindings';
import classificationRules from './classification-rules.json';

// Re-export all step index files
export * from './steps/1/runStep1';
export * from './steps/2/runStep2';
export * from './steps/3/runStep3';
export * from './steps/4/runStep4';

// Internal imports for runPipeline
import { fetchEmails } from './steps/1/runStep1';
import { storeRaw, storeFiltered, routeToNamespaces } from './steps/2/runStep2';
import { triageNamespace } from './steps/3/runStep3';

// Routes
import { handleCheckTunnel } from './routes/check/check-tunnel';
import { handleCheckBackend } from './routes/check/check-backend';
import { handleCheckBridge } from './routes/check/check-bridge';
import { handleRunFetch } from './routes/run/run-fetch';
import { handleRunKvNamespaceRaw } from './routes/run/run-kv-namespace-raw';
import { handleRunKvNamespaceFiltered } from './routes/run/run-kv-namespace-filtered';
import { handleRunKvNamespaceFinal } from './routes/run/run-kv-namespace-final';
import { handleTriageDetermine } from './routes/triage/triage-determine';
import { handleTriageNoAction } from './routes/triage/triage-no-action';
import { handleTriageSimple } from './routes/triage/triage-simple';
import { handleTriageComplexityLow } from './routes/triage/triage-complexity-low';
import { handleTriageComplexityHigh } from './routes/triage/triage-complexity-high';
import { handleResolveLetter } from './routes/resolve/resolve-letter';
import { handleResolveApplication } from './routes/resolve/resolve-application';
import { handleResolveOnlineSubmission } from './routes/resolve/resolve-online-submission';
import { handleResolveEmailCoverLetter } from './routes/resolve/resolve-email-cover-letter';
import { handleDashboardData } from './routes/data/dashboard-data';
import { handleKvCounts } from './routes/data/kv-counts';
import { handleKvEmails } from './routes/data/kv-emails';
import { handleStatus } from './routes/data/status';
import { handlePurgeKv } from './routes/data/purge-kv';
import { handleSort } from './routes/data/sort';
import { handleRawDataHeaders } from './routes/data/raw-data-headers';
import { handleFilteredDataHeaders } from './routes/data/filtered-data-headers';
import { handleTodoScanner } from './routes/data/todo-scanner';

// --- Router ---

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/check-tunnel') return handleCheckTunnel(env);
  if (path === '/check-backend') return handleCheckBackend(env);
  if (path === '/check-bridge') return handleCheckBridge(env);

  if (path === '/run-fetch') return handleRunFetch(env);
  if (path === '/run-kv-namespace-raw') return handleRunKvNamespaceRaw(env);
  if (path === '/run-kv-namespace-filtered') return handleRunKvNamespaceFiltered(env);
  if (path === '/run-kv-namespace-final') return handleRunKvNamespaceFinal(env);

  if (path === '/sort') return handleSort(request, env);
  if (path === '/raw-data-headers') return handleRawDataHeaders(request, env);
  if (path === '/filtered-data-headers') return handleFilteredDataHeaders(request, env);
  if (path === '/todo-scanner') return handleTodoScanner(request, env);

  if (path === '/triage-determine') return handleTriageDetermine(request, env);
  if (path === '/triage-no-action') return handleTriageNoAction(request, env);
  if (path === '/triage-simple') return handleTriageSimple(request, env);
  if (path === '/triage-complexity-low') return handleTriageComplexityLow(request, env);
  if (path === '/triage-complexity-high') return handleTriageComplexityHigh(request, env);

  if (path === '/resolve-letter') return handleResolveLetter(request, env);
  if (path === '/resolve-application') return handleResolveApplication(request, env);
  if (path === '/resolve-online-submission') return handleResolveOnlineSubmission(request, env);
  if (path === '/resolve-email-cover-letter') return handleResolveEmailCoverLetter(request, env);

  if (path === '/api/dashboard-data') return handleDashboardData(env);
  if (path === '/api/kv-counts') return handleKvCounts(env);
  if (path === '/api/purge-kv') return handlePurgeKv(request, env);
  if (path === '/status') return handleStatus(env);

  if (path.startsWith('/api/kv-emails/')) {
    const slug = path.replace('/api/kv-emails/', '');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    return handleKvEmails(env, slug, limit);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// --- Pipeline orchestration (called by cron) ---

const LAST_FETCH_KEY = 'last_fetch_timestamp';

export async function runPipeline(env: Env) {
  const timestamp = new Date().toISOString();

  const bridgeData = await env.DASHBOARD_SCREENSHOTS.get('hop_bridge');
  if (!bridgeData) {
    const summary = { timestamp, status: 'skipped', reason: 'no bridge data yet' };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    return summary;
  }
  const bridge = JSON.parse(bridgeData);
  if (!bridge.ok) {
    const summary = { timestamp, status: 'skipped', reason: 'bridge down', bridge };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    return summary;
  }

  const lastTimestamp = await env.DASHBOARD_SCREENSHOTS.get(LAST_FETCH_KEY);
  const fetchResult = await fetchEmails(env.TUNNEL_URL, lastTimestamp);

  if (fetchResult.inbound === 0) {
    const summary = { timestamp, status: 'no_new_emails', lastFetchTimestamp: lastTimestamp, fetched: fetchResult.fetched, spamTrashExcluded: fetchResult.spamTrashExcluded, olderThanCutoff: fetchResult.olderThanCutoff };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    return summary;
  }

  const rules = (classificationRules as any).rules || [];
  const bindings = getKVBindings(env);
  const rawStored = await storeRaw(fetchResult.emails, env.RAW_DATA_HEADERS);
  const filteredStored = await storeFiltered(fetchResult.emails, rules, env.FILTERED_DATA_HEADERS);
  const routeStats = await routeToNamespaces(fetchResult.emails, rules, bindings);
  const triageResult = await triageNamespace(env.FILTERED_DATA_HEADERS, 'FILTERED_DATA_HEADERS');

  if (fetchResult.newestTimestamp) {
    await env.DASHBOARD_SCREENSHOTS.put(LAST_FETCH_KEY, fetchResult.newestTimestamp);
  }

  const summary = {
    timestamp,
    status: 'complete',
    step1: { fetched: fetchResult.fetched, newEmails: fetchResult.inbound },
    step2: { rawStored, filteredStored, routeStats },
    step3: { total: triageResult.length, noAction: triageResult.filter((d: any) => d.level === 'NO_ACTION').length },
  };

  await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
  return summary;
}
