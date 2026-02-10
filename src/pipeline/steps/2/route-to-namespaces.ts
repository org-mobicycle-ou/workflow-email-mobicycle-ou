import type { RawEmail } from '../1/fetch-emails';
import type { Rule } from './classify';
import { classify } from './classify';
import { formatKey, formatValue } from '../../shared/format';

export async function routeToNamespaces(
  emails: RawEmail[],
  rules: Rule[],
  bindings: Record<string, KVNamespace>,
): Promise<Record<string, number>> {
  const routeStats: Record<string, number> = {};

  for (const email of emails) {
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

  return routeStats;
}
