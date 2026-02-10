import type { TriageDecision } from './determine';

export async function applyTriageLevels(
  decisions: TriageDecision[],
  namespace: KVNamespace,
): Promise<number> {
  let applied = 0;
  for (const d of decisions) {
    const raw = await namespace.get(d.key);
    if (!raw) continue;
    const email = JSON.parse(raw);
    email.triageLevel = d.level;
    email.triageReason = d.reason;
    email.triageSuggestedAction = d.suggestedAction;
    email.status = 'triaged';
    await namespace.put(d.key, JSON.stringify(email));
    applied++;
  }
  return applied;
}
