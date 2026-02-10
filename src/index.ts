/**
 * MobiCycle OÜ Email Workflow
 * 
 * Part 1: Fetch emails from ProtonMail Bridge
 * Part 2: Classify and store in KV namespaces
 * Part 3: Triage - decide what to do with each email
 */

import { checkPrereqs, fetchEmails } from './part1_fetch/index';
import { storeEmails, classify } from './part2_store/index';
import { triageNamespace } from './part3_triage/index';
import classificationRules from '../classification-rules.json';




// --- Environment type ---

type Env = {
  PROTON_EMAIL: string;
  TUNNEL_URL: string;
  CE_FILE_URL: string;
  NOTIFICATION_EMAIL: string;
  CLAUDE_WEBHOOK: string;
  EMAIL_TRIAGE: any;

  // All 35 category KV namespaces
  EMAIL_COURTS_SUPREME_COURT: KVNamespace;
  EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION: KVNamespace;
  EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION: KVNamespace;
  EMAIL_COURTS_CHANCERY_DIVISION: KVNamespace;
  EMAIL_COURTS_ADMINISTRATIVE_COURT: KVNamespace;
  EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT: KVNamespace;
  EMAIL_COURTS_CLERKENWELL_COUNTY_COURT: KVNamespace;
  EMAIL_COMPLAINTS_ICO: KVNamespace;
  EMAIL_COMPLAINTS_PHSO: KVNamespace;
  EMAIL_COMPLAINTS_PARLIAMENT: KVNamespace;
  EMAIL_COMPLAINTS_HMCTS: KVNamespace;
  EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD: KVNamespace;
  EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT: KVNamespace;
  EMAIL_EXPENSES_LEGAL_FEES_COMPANY: KVNamespace;
  EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR: KVNamespace;
  EMAIL_EXPENSES_REPAIRS: KVNamespace;
  EMAIL_CLAIMANT_HK_LAW: KVNamespace;
  EMAIL_CLAIMANT_LESSEL: KVNamespace;
  EMAIL_CLAIMANT_LIU: KVNamespace;
  EMAIL_CLAIMANT_RENTIFY: KVNamespace;
  EMAIL_DEFENDANTS_DEFENDANT: KVNamespace;
  EMAIL_DEFENDANTS_BOTH_DEFENDANTS: KVNamespace;
  EMAIL_DEFENDANTS_BARRISTERS: KVNamespace;
  EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY: KVNamespace;
  EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY: KVNamespace;
  EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT: KVNamespace;
  EMAIL_GOVERNMENT_ESTONIA: KVNamespace;
  EMAIL_GOVERNMENT_US_STATE_DEPARTMENT: KVNamespace;
  EMAIL_RECONSIDERATION_SINGLE_JUDGE: KVNamespace;
  EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW: KVNamespace;
  EMAIL_RECONSIDERATION_PTA_REFUSAL: KVNamespace;
  EMAIL_RECONSIDERATION_CPR52_24_5: KVNamespace;
  EMAIL_RECONSIDERATION_CPR52_24_6: KVNamespace;
  EMAIL_RECONSIDERATION_CPR52_30: KVNamespace;
  EMAIL_RECONSIDERATION_PD52B: KVNamespace;
  RAW_DATA_HEADERS: KVNamespace;
  FILTERED_DATA_HEADERS: KVNamespace;
  DASHBOARD_SCREENSHOTS: KVNamespace;
};

// Helper: get all KV bindings as a record for Part 2
function getKVBindings(env: Env): Record<string, KVNamespace> {
  return {
    RAW_DATA_HEADERS: env.RAW_DATA_HEADERS,
    FILTERED_DATA_HEADERS: env.FILTERED_DATA_HEADERS,
    EMAIL_COURTS_SUPREME_COURT: env.EMAIL_COURTS_SUPREME_COURT,
    EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION: env.EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION,
    EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION: env.EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION,
    EMAIL_COURTS_CHANCERY_DIVISION: env.EMAIL_COURTS_CHANCERY_DIVISION,
    EMAIL_COURTS_ADMINISTRATIVE_COURT: env.EMAIL_COURTS_ADMINISTRATIVE_COURT,
    EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT: env.EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT,
    EMAIL_COURTS_CLERKENWELL_COUNTY_COURT: env.EMAIL_COURTS_CLERKENWELL_COUNTY_COURT,
    EMAIL_COMPLAINTS_ICO: env.EMAIL_COMPLAINTS_ICO,
    EMAIL_COMPLAINTS_PHSO: env.EMAIL_COMPLAINTS_PHSO,
    EMAIL_COMPLAINTS_PARLIAMENT: env.EMAIL_COMPLAINTS_PARLIAMENT,
    EMAIL_COMPLAINTS_HMCTS: env.EMAIL_COMPLAINTS_HMCTS,
    EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD: env.EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD,
    EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT: env.EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT,
    EMAIL_EXPENSES_LEGAL_FEES_COMPANY: env.EMAIL_EXPENSES_LEGAL_FEES_COMPANY,
    EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR: env.EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR,
    EMAIL_EXPENSES_REPAIRS: env.EMAIL_EXPENSES_REPAIRS,
    EMAIL_CLAIMANT_HK_LAW: env.EMAIL_CLAIMANT_HK_LAW,
    EMAIL_CLAIMANT_LESSEL: env.EMAIL_CLAIMANT_LESSEL,
    EMAIL_CLAIMANT_LIU: env.EMAIL_CLAIMANT_LIU,
    EMAIL_CLAIMANT_RENTIFY: env.EMAIL_CLAIMANT_RENTIFY,
    EMAIL_DEFENDANTS_DEFENDANT: env.EMAIL_DEFENDANTS_DEFENDANT,
    EMAIL_DEFENDANTS_BOTH_DEFENDANTS: env.EMAIL_DEFENDANTS_BOTH_DEFENDANTS,
    EMAIL_DEFENDANTS_BARRISTERS: env.EMAIL_DEFENDANTS_BARRISTERS,
    EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY: env.EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY,
    EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY: env.EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY,
    EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT: env.EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT,
    EMAIL_GOVERNMENT_ESTONIA: env.EMAIL_GOVERNMENT_ESTONIA,
    EMAIL_GOVERNMENT_US_STATE_DEPARTMENT: env.EMAIL_GOVERNMENT_US_STATE_DEPARTMENT,
    EMAIL_RECONSIDERATION_SINGLE_JUDGE: env.EMAIL_RECONSIDERATION_SINGLE_JUDGE,
    EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW: env.EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW,
    EMAIL_RECONSIDERATION_PTA_REFUSAL: env.EMAIL_RECONSIDERATION_PTA_REFUSAL,
    EMAIL_RECONSIDERATION_CPR52_24_5: env.EMAIL_RECONSIDERATION_CPR52_24_5,
    EMAIL_RECONSIDERATION_CPR52_24_6: env.EMAIL_RECONSIDERATION_CPR52_24_6,
    EMAIL_RECONSIDERATION_CPR52_30: env.EMAIL_RECONSIDERATION_CPR52_30,
    EMAIL_RECONSIDERATION_PD52B: env.EMAIL_RECONSIDERATION_PD52B,
  };
}

// Stub workflow class for Cloudflare Workflows binding
class EmailTriageWorkflow {
  async run() { return { status: 'stub' }; }
}
export { EmailTriageWorkflow };

// --- Worker entry point ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET /health - is the worker alive (no external calls)
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'workflow-email' });
    }

    // GET /prereqs - last prereq check result
    if (url.pathname === '/prereqs') {
      const data = await env.DASHBOARD_SCREENSHOTS.get('prereqs');
      return Response.json(data ? JSON.parse(data) : { status: 'no_data' });
    }

    // POST /run - execute full pipeline manually
    if (request.method === 'POST' && url.pathname === '/run') {
      try {
        const result = await runPipeline(env);
        return Response.json(result);
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // GET /triage - run triage on FILTERED emails
    if (url.pathname === '/triage') {
      try {
        const decisions = await triageNamespace(
          env.FILTERED_DATA_HEADERS,
          'FILTERED_DATA_HEADERS'
        );
        return Response.json({ count: decisions.length, decisions });
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // GET /status - last pipeline run
    if (url.pathname === '/status') {
      const last = await env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run');
      return Response.json(last ? JSON.parse(last) : { status: 'never_run' });
    }

    // GET /crons - all 3 cron job results from KV
    if (url.pathname === '/crons') {
      const [prereqs, pipelineRun, statusCheck] = await Promise.all([
        env.DASHBOARD_SCREENSHOTS.get('prereqs'),
        env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run'),
        env.DASHBOARD_SCREENSHOTS.get('status_check'),
      ]);
      return Response.json({
        prereqs: prereqs ? JSON.parse(prereqs) : null,
        connect: pipelineRun ? JSON.parse(pipelineRun) : null,
        status: statusCheck ? JSON.parse(statusCheck) : null,
      });
    }


    
  },

  async scheduled(event: ScheduledEvent, env: Env) {
    const cron = event.cron;

    // Cron 1: Prereq check (every 2 min)
    // Verifies tunnel, backend, and bridge are all reachable
    if (cron === '*/2 * * * *') {
      const prereqs = await checkPrereqs(env.TUNNEL_URL);
      await env.DASHBOARD_SCREENSHOTS.put('prereqs', JSON.stringify({
        ...prereqs,
        checkedAt: new Date().toISOString(),
      }));
      console.log(`[PREREQS] ${prereqs.ok ? 'OK' : 'FAIL: ' + prereqs.error}`);
      return;
    }

    // Cron 2: Connect + fetch + store + triage (every 5 min)
    // Only runs if prereqs passed
    if (cron === '*/5 * * * *') {
      // Read last prereq check
      const prereqData = await env.DASHBOARD_SCREENSHOTS.get('prereqs');
      if (!prereqData) {
        console.log('[CONNECT] No prereq data yet, skipping');
        return;
      }
      const prereqs = JSON.parse(prereqData);
      if (!prereqs.ok) {
        console.log(`[CONNECT] Prereqs not met: ${prereqs.error}, skipping`);
        return;
      }

      try {
        const result = await runPipeline(env);
        console.log(`[CONNECT] Done: fetched=${(result as any).part1?.fetched}, classified=${(result as any).part2?.filteredStored}`);
      } catch (e: any) {
        console.error('[CONNECT] Failed:', e.message);
        await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify({
          timestamp: new Date().toISOString(),
          status: 'error',
          error: e.message,
        }));
      }
      return;
    }

    // Cron 3: Status check (hourly)
    // Writes a summary of current state across all KV namespaces
    if (cron === '0 * * * *') {
      const prereqData = await env.DASHBOARD_SCREENSHOTS.get('prereqs');
      const lastRun = await env.DASHBOARD_SCREENSHOTS.get('pipeline_last_run');
      const status = {
        checkedAt: new Date().toISOString(),
        prereqs: prereqData ? JSON.parse(prereqData) : null,
        lastPipelineRun: lastRun ? JSON.parse(lastRun) : null,
      };
      await env.DASHBOARD_SCREENSHOTS.put('status_check', JSON.stringify(status));
      console.log('[STATUS] Status check written');
      return;
    }
  },
};

// --- Pipeline execution ---

async function runPipeline(env: Env) {
  const timestamp = new Date().toISOString();

  // Step 0: Prereq check (tunnel → backend → bridge)
  const prereqs = await checkPrereqs(env.TUNNEL_URL);
  if (!prereqs.ok) {
    const summary = {
      timestamp,
      status: 'skipped',
      prereqs,
    };
    await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));
    console.log(`[PIPELINE] Skipped: ${prereqs.error}`);
    return summary;
  }

  // Part 1: Fetch
  const fetchResult = await fetchEmails(env.TUNNEL_URL);

  // Part 2: Store
  const rules = (classificationRules as any).rules || [];
  const storeResult = await storeEmails(
    fetchResult.emails,
    rules,
    getKVBindings(env)
  );

  // Part 3: Triage (on newly filtered emails)
  const triageResult = await triageNamespace(
    env.FILTERED_DATA_HEADERS,
    'FILTERED_DATA_HEADERS'
  );

  const summary = {
    timestamp,
    part1: {
      fetched: fetchResult.fetched,
      inbound: fetchResult.inbound,
      roseFiltered: fetchResult.filtered,
    },
    part2: {
      rawStored: storeResult.rawStored,
      filteredStored: storeResult.filteredStored,
      routeStats: storeResult.routeStats,
    },
    part3: {
      total: triageResult.length,
      noted: triageResult.filter(d => d.level === 'NOTED').length,
      simple: triageResult.filter(d => d.level === 'SIMPLE').length,
      complex: triageResult.filter(d => d.level === 'COMPLEX').length,
    },
  };

  // Persist run status
  await env.DASHBOARD_SCREENSHOTS.put('pipeline_last_run', JSON.stringify(summary));

  return summary;
}

