import type { TriageDecision } from './determine';

export async function closeNoAction(
  decisions: TriageDecision[],
  namespace: KVNamespace,
): Promise<number> {
  const noAction = decisions.filter(d => d.level === 'NO_ACTION');
  for (const d of noAction) {
    const raw = await namespace.get(d.key);
    if (!raw) continue;
    const email = JSON.parse(raw);
    email.status = 'closed';
    email.triageLevel = 'NO_ACTION';
    email.closedAt = new Date().toISOString();
    await namespace.put(d.key, JSON.stringify(email));
  }
  return noAction.length;
}
