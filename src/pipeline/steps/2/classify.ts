import type { RawEmail } from '../1/fetch-emails';

export interface Rule {
  namespace: string;
  priority: string;
  conditions: {
    fromIncludes?: string[];
    toIncludes?: string[];
    subjectIncludes?: string[];
  };
}

export function classify(
  email: RawEmail,
  rules: Rule[]
): { matched: boolean; namespaces: string[] } {
  const from = email.from.toLowerCase();
  const to = email.to.toLowerCase();
  const subject = email.subject.toLowerCase();
  const matched: string[] = [];

  for (const rule of rules) {
    const c = rule.conditions;
    let hit = false;
    if (c.fromIncludes) {
      for (const p of c.fromIncludes) {
        if (from.includes(p.toLowerCase())) { hit = true; break; }
      }
    }
    if (!hit && c.toIncludes) {
      for (const p of c.toIncludes) {
        if (to.includes(p.toLowerCase())) { hit = true; break; }
      }
    }
    if (!hit && c.subjectIncludes) {
      for (const p of c.subjectIncludes) {
        if (subject.includes(p.toLowerCase())) { hit = true; break; }
      }
    }
    if (hit) matched.push(rule.namespace);
  }

  return { matched: matched.length > 0, namespaces: [...new Set(matched)] };
}
