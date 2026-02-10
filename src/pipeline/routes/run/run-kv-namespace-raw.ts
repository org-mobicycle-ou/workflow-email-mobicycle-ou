import type { Env } from '../../shared/types';
import { fetchEmails } from '../../steps/1/index-s1';
import { formatKey, formatValue } from '../../shared/format';

/**
 * Store all inbound emails in RAW_DATA_HEADERS.
 * Uses lastTimestamp for incremental fetch.
 */
export async function handleRunKvNamespaceRaw(env: Env): Promise<Response> {
  try {
    const lastTimestamp = await env.DASHBOARD_SCREENSHOTS.get('last_fetch_timestamp');
    const fetched = await fetchEmails(env.TUNNEL_URL, lastTimestamp);
    let stored = 0;
    for (const email of fetched.emails) {
      const key = formatKey(email.from, email.date);
      await env.RAW_DATA_HEADERS.put(key, formatValue(email, []));
      stored++;
    }
    return Response.json({ stored, fetched: fetched.fetched, inbound: fetched.inbound, lastFetchTimestamp: lastTimestamp });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

