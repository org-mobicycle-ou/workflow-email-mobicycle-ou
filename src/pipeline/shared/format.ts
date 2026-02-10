/**
 * KV key/value formatting
 *
 * Key format: {year}.{month}.{day}_{sender}_{HH}-{MM}-{SS}
 * Example: 2026.02.09_casework_ico_org_uk_10-30-45
 *
 * Value: JSON with email fields + metadata
 */

import type { RawEmail } from '../steps/1/fetch-emails';

export function formatKey(from: string, date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const sender = from.replace(/[@.]/g, '_').toLowerCase();
  return `${year}.${month}.${day}_${sender}_${hours}-${minutes}-${seconds}`;
}

export function formatValue(email: RawEmail, namespaces: string[]): string {
  return JSON.stringify({
    from: email.from,
    to: email.to,
    subject: email.subject,
    date: email.date,
    messageId: email.messageId,
    body: email.body,
    namespaces: namespaces,
    storedAt: new Date().toISOString(),
    status: 'pending',
  });
}
