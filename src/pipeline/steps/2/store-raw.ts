import type { RawEmail } from '../1/fetch-emails';
import { formatKey, formatValue } from '../../shared/format';

export async function storeRaw(
  emails: RawEmail[],
  rawNamespace: KVNamespace,
): Promise<number> {
  for (const email of emails) {
    const key = formatKey(email.from, email.date);
    await rawNamespace.put(key, formatValue(email, []));
  }
  return emails.length;
}
