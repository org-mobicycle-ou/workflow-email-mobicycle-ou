/**
 * Part 1: Get emails from ProtonMail Bridge
 * 
 * Step 0: Check prereqs (tunnel → backend → bridge)
 * Step 1: Fetch from 'All Mail' folder
 * Step 2: Filter out emails sent BY Rose
 * Returns clean inbound email array.
 */

const ROSE_ADDRESSES = [
  'rose@mobicycle.ee',
  'rose@mobicycle.productions',
  'rose@mobicycle.us',
  'rose@mobicycle.consulting',
  'rose@mobicycle.eu',
];

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
  inbound: number;
  filtered: number;
  emails: RawEmail[];
  error?: string;
}

export interface PrereqResult {
  ok: boolean;
  tunnel: boolean;
  backend: boolean;
  bridge: boolean;
  error?: string;
}

/**
 * Step 0: Check all three prereqs via a single call.
 * 
 * Worker → https://imap.mobicycle.ee/health → tunnel → backend → bridge
 * 
 * If tunnel is down: fetch throws (network error)
 * If backend is down: tunnel returns 502
 * If bridge is down: backend returns 503 with { status: 'unhealthy', bridge: 'error' }
 * If all up: backend returns 200 with { status: 'ok', bridge: 'connected' }
 */
export async function checkPrereqs(tunnelUrl: string): Promise<PrereqResult> {
  try {
    const response = await fetch(`${tunnelUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    });

    // Tunnel is up (we got a response)
    // But backend might have returned an error status
    if (response.status === 502 || response.status === 504) {
      return { ok: false, tunnel: true, backend: false, bridge: false, error: 'Backend server is down' };
    }

    const data = (await response.json()) as any;

    if (data.status === 'ok' && data.bridge === 'connected') {
      return { ok: true, tunnel: true, backend: true, bridge: true };
    }

    // Backend is up but bridge is down
    return {
      ok: false,
      tunnel: true,
      backend: true,
      bridge: false,
      error: data.bridgeError || 'ProtonMail Bridge is not connected',
    };
  } catch (e: any) {
    // Tunnel unreachable
    return { ok: false, tunnel: false, backend: false, bridge: false, error: e.message };
  }
}

/**
 * Steps 1+2: Fetch emails and filter Rose's sent.
 * Call checkPrereqs() first.
 */
export async function fetchEmails(tunnelUrl: string): Promise<FetchResult> {
  const response = await fetch(`${tunnelUrl}/fetch-emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder: 'All Mail',
      limit: 100,
    }),
    signal: AbortSignal.timeout(30000),
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

  // Filter out emails FROM Rose
  const inbound = all.filter((e) => {
    const fromLower = e.from.toLowerCase();
    return !ROSE_ADDRESSES.some((addr) => fromLower.includes(addr));
  });

  return {
    fetched: all.length,
    inbound: inbound.length,
    filtered: all.length - inbound.length,
    emails: inbound,
  };
}

