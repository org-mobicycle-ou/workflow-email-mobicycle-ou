import type { Env } from './pipeline/shared/types';

// === HTTP RESPONSES ===
// Web API router - handles all HTTP requests to various endpoints
import { handleFetch } from './pipeline/runPipeline';

// === SCHEDULED HEALTH CHECKS ===
// Infrastructure monitoring - runs automatically on schedule
import { checkTunnel } from './cron-jobs/check-tunnel';
import { checkBridge } from './cron-jobs/check-bridge'; 
import { checkBackend } from './cron-jobs/check-backend';

// === PIPELINE EXECUTION ===
// Email processing - runs after all health checks pass
import { triggerPipeline } from './cron-jobs/trigger-pipeline';

// Workflow class (required by wrangler.jsonc)
export class EmailTriageWorkflow {
  async run() { return { status: 'stub' }; }
}

export default {
  // === HTTP RESPONSES ===
  // Handles all web API requests (status, dashboard, manual triggers, etc.)
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleFetch(request, env);
  },
  
  // === SCHEDULED EXECUTION ===
  // Infrastructure health checks + pipeline execution
  async scheduled(event: ScheduledEvent, env: Env) {
    // Health checks (store results in KV)
    if (event.cron === '*/2 * * * *') return checkTunnel(env);    // Every 2 min
    if (event.cron === '*/3 * * * *') return checkBridge(env);    // Every 3 min  
    if (event.cron === '*/4 * * * *') return checkBackend(env);   // Every 4 min
    
    // Pipeline execution (only if all health checks pass)
    if (event.cron === '*/5 * * * *') return triggerPipeline(env); // Every 5 min
  },
};
