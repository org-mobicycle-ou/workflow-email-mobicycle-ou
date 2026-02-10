/**
 * Part 3: Decide what to do with the emails
 * 
 * Reads classified emails from KV namespaces.
 * Labels each as:
 *   NOTED   - no action needed (informational)
 *   SIMPLE  - standard acknowledgement, Claude responds
 *   COMPLEX - requires document generation, court filing, etc.
 * 
 * This is the decision layer. Execution happens downstream.
 */

export type TriageLevel = 'NOTED' | 'SIMPLE' | 'COMPLEX';

export interface TriageDecision {
  key: string;
  from: string;
  subject: string;
  date: string;
  namespace: string;
  level: TriageLevel;
  reason: string;
  suggestedAction?: string;
}

// Rules for auto-triage based on namespace and content signals
const NOTED_SIGNALS = [
  'delivery notification',
  'read receipt',
  'out of office',
  'automatic reply',
  'undeliverable',
  'noreply',
  'no-reply',
];

const COMPLEX_NAMESPACES = [
  'EMAIL_RECONSIDERATION_CPR52_24_5',
  'EMAIL_RECONSIDERATION_CPR52_24_6',
  'EMAIL_RECONSIDERATION_CPR52_30',
  'EMAIL_RECONSIDERATION_PD52B',
  'EMAIL_COURTS_SUPREME_COURT',
  'EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION',
];

export function triageEmail(
  key: string,
  email: { from: string; to: string; subject: string; date: string; body: string; namespaces: string[] }
): TriageDecision {
  const subjectLower = email.subject.toLowerCase();
  const fromLower = email.from.toLowerCase();
  const primaryNamespace = email.namespaces[0] || 'UNKNOWN';

  // Check for NOTED (auto-dismiss)
  for (const signal of NOTED_SIGNALS) {
    if (subjectLower.includes(signal) || fromLower.includes(signal)) {
      return {
        key,
        from: email.from,
        subject: email.subject,
        date: email.date,
        namespace: primaryNamespace,
        level: 'NOTED',
        reason: `Auto-dismiss: matches signal "${signal}"`,
      };
    }
  }

  // Check for COMPLEX (needs human review + document generation)
  for (const ns of email.namespaces) {
    if (COMPLEX_NAMESPACES.includes(ns)) {
      return {
        key,
        from: email.from,
        subject: email.subject,
        date: email.date,
        namespace: primaryNamespace,
        level: 'COMPLEX',
        reason: `Namespace ${ns} requires full pipeline processing`,
        suggestedAction: ns.includes('RECONSIDERATION')
          ? 'Generate response document + CE-File submission'
          : 'Draft reply with attachments for court filing',
      };
    }
  }

  // Default: SIMPLE (standard acknowledgement)
  return {
    key,
    from: email.from,
    subject: email.subject,
    date: email.date,
    namespace: primaryNamespace,
    level: 'SIMPLE',
    reason: 'Standard correspondence - acknowledge and file',
    suggestedAction: 'Draft acknowledgement email',
  };
}

export async function triageNamespace(
  namespace: KVNamespace,
  namespaceName: string
): Promise<TriageDecision[]> {
  const decisions: TriageDecision[] = [];
  const keys = await namespace.list();

  for (const key of keys.keys) {
    const raw = await namespace.get(key.name);
    if (!raw) continue;

    const email = JSON.parse(raw);
    if (email.status !== 'pending') continue;

    const decision = triageEmail(key.name, {
      from: email.from || '',
      to: email.to || '',
      subject: email.subject || '',
      date: email.date || '',
      body: email.body || '',
      namespaces: email.namespaces || [namespaceName],
    });

    decisions.push(decision);
  }

  return decisions;
}

