import { triageEmail } from './determine';
import type { TriageDecision } from './determine';

export async function triageNamespace(namespace: KVNamespace, namespaceName: string): Promise<TriageDecision[]> {
  const decisions: TriageDecision[] = [];
  const keys = await namespace.list();

  for (const key of keys.keys) {
    const raw = await namespace.get(key.name);
    if (!raw) continue;
    const email = JSON.parse(raw);
    if (email.status !== 'pending') continue;
    decisions.push(triageEmail(key.name, {
      from: email.from || '', to: email.to || '', subject: email.subject || '',
      date: email.date || '', body: email.body || '', namespaces: email.namespaces || [namespaceName],
    }));
  }

  return decisions;
}
