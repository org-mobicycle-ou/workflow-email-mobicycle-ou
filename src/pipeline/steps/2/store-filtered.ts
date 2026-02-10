import type { RawEmail } from '../1/fetch-emails';
import type { Rule } from './classify';
import { classify } from './classify';
import { formatKey, formatValue } from '../../shared/format';

export async function storeFiltered(
  emails: RawEmail[],
  rules: Rule[],
  filteredNamespace: KVNamespace,
): Promise<number> {
  let count = 0;
  for (const email of emails) {
    const result = classify(email, rules);
    if (!result.matched) continue;
    const key = formatKey(email.from, email.date);
    await filteredNamespace.put(key, formatValue(email, result.namespaces));
    count++;
  }
  return count;
}
