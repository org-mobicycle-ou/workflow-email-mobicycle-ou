/**
 * Fetch emails from ProtonMail Bridge
 *
 * Chain: Worker -> imap.mobicycle.ee (tunnel) -> localhost:4000 (backend) -> 127.0.0.1:1143 (bridge)
 *
 * Filters applied in fetchEmails():
 *   1. Exclude Spam/Trash by messageId
 *   2. Exclude emails older than lastTimestamp (incremental)
 *   3. Deduplicate by messageId
 */

export interface RawEmail {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  body: string;
}

export interface FetchResult {
  fetched: number;
  spamTrashExcluded: number;
  olderThanCutoff: number;
  duplicates: number;
  inbound: number;
  emails: RawEmail[];
  newestTimestamp: string | null;
}

/**
 * Fetch emails from ProtonMail Bridge -- incremental.
 *
 * 1. Fetch Spam + Trash messageIds
 * 2. Fetch All Mail
 * 3. Exclude spam/trash by messageId
 * 4. Exclude emails older than lastTimestamp
 * 5. Deduplicate by messageId
 * 6. Return new emails + newest timestamp for next run
 */
export async function fetchEmails(
  tunnelUrl: string,
  lastTimestamp?: string | null,
): Promise<FetchResult> {
  const excludeIds = new Set<string>();
  for (const folder of ['Spam', 'Trash']) {
    try {
      const res = await fetch(`${tunnelUrl}/fetch-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const d = (await res.json()) as any;
        for (const e of d.emails || []) {
          if (e.messageId) excludeIds.add(e.messageId);
        }
      }
    } catch {
      // Continue if a folder fails
    }
  }

  const response = await fetch(`${tunnelUrl}/fetch-emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: 'All Mail' }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  const data = (await response.json()) as any;
  const all: RawEmail[] = (data.emails || []).map((e: any) => ({
    from: e.from || '',
    to: e.to || '',
    subject: e.subject || '',
    date: e.date || new Date().toISOString(),
    messageId: e.messageId || '',
    body: e.body || '',
  }));

  const fetched = all.length;

  // Exclude spam/trash
  const noSpam = all.filter(e => !excludeIds.has(e.messageId));
  const spamTrashExcluded = fetched - noSpam.length;

  // Exclude older than cutoff
  let afterCutoff = noSpam;
  let olderThanCutoff = 0;
  if (lastTimestamp) {
    const cutoff = new Date(lastTimestamp).getTime();
    afterCutoff = noSpam.filter(e => new Date(e.date).getTime() > cutoff);
    olderThanCutoff = noSpam.length - afterCutoff.length;
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: RawEmail[] = [];
  let duplicates = 0;
  for (const e of afterCutoff) {
    if (seen.has(e.messageId)) {
      duplicates++;
      continue;
    }
    seen.add(e.messageId);
    deduped.push(e);
  }

  let newestTimestamp: string | null = null;
  if (deduped.length > 0) {
    newestTimestamp = deduped.reduce((newest, e) => {
      return new Date(e.date).getTime() > new Date(newest).getTime() ? e.date : newest;
    }, deduped[0].date);
  }

  return {
    fetched,
    spamTrashExcluded,
    olderThanCutoff,
    duplicates,
    inbound: deduped.length,
    emails: deduped,
    newestTimestamp,
  };
}