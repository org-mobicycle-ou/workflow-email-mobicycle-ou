import type { Env } from '../../shared/types';
import { fetchEmails } from '../../steps/1/index-s1';

export async function handleRunFetch(env: Env): Promise<Response> {
  try {
    const lastTimestamp = await env.DASHBOARD_SCREENSHOTS.get('last_fetch_timestamp');
    const result = await fetchEmails(env.TUNNEL_URL, lastTimestamp);
    return Response.json({
      lastFetchTimestamp: lastTimestamp,
      ...result,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

