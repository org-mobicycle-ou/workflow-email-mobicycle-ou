import type { Env } from '../../shared/types';
import { fetchEmails } from '../../steps/1/index-s1';
import { classify } from '../../steps/2/index-s2';
import { formatKey, formatValue } from '../../shared/format';
import classificationRules from '../../classification-rules.json';

/**
 * Store emails matching classification rules in FILTERED_DATA_HEADERS.
 * Uses lastTimestamp for incremental fetch.
 */
export async function handleRunKvNamespaceFiltered(env: Env): Promise<Response> {
  try {
    const lastTimestamp = await env.DASHBOARD_SCREENSHOTS.get('last_fetch_timestamp');
    const fetched = await fetchEmails(env.TUNNEL_URL, lastTimestamp);
    const rules = (classificationRules as any).rules || [];
    let stored = 0;
    for (const email of fetched.emails) {
      const result = classify(email, rules);
      if (!result.matched) continue;
      const key = formatKey(email.from, email.date);
      await env.FILTERED_DATA_HEADERS.put(key, formatValue(email, result.namespaces));
      stored++;
    }
    return Response.json({ stored, totalInbound: fetched.inbound, lastFetchTimestamp: lastTimestamp });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

