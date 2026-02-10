import type { Env } from '../../shared/types';
import { getKVBindings } from '../../shared/kv-bindings';
import { fetchEmails } from '../../steps/1/index-s1';
import { classify } from '../../steps/2/index-s2';
import { formatKey, formatValue } from '../../shared/format';
import classificationRules from '../../classification-rules.json';

/**
 * Route classified emails to category-specific KV namespaces.
 * Uses lastTimestamp for incremental fetch.
 */
export async function handleRunKvNamespaceFinal(env: Env): Promise<Response> {
  try {
    const lastTimestamp = await env.DASHBOARD_SCREENSHOTS.get('last_fetch_timestamp');
    const fetched = await fetchEmails(env.TUNNEL_URL, lastTimestamp);
    const rules = (classificationRules as any).rules || [];
    const bindings = getKVBindings(env);
    const routeStats: Record<string, number> = {};
    for (const email of fetched.emails) {
      const result = classify(email, rules);
      if (!result.matched) continue;
      const key = formatKey(email.from, email.date);
      for (const ns of result.namespaces) {
        const namespace = bindings[ns];
        if (namespace) {
          await namespace.put(key, formatValue(email, result.namespaces));
          routeStats[ns] = (routeStats[ns] || 0) + 1;
        }
      }
    }
    return Response.json({ routeStats, namespacesHit: Object.keys(routeStats).length, lastFetchTimestamp: lastTimestamp });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

