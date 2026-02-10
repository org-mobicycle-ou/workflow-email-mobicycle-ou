import type { Env } from '../pipeline/shared/types';

interface HopResult {
  ok: boolean;
  url: string;
  status?: number;
  error?: string;
}

async function pingTunnel(tunnelUrl: string): Promise<HopResult> {
  try {
    const res = await fetch(tunnelUrl + '/health', { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, url: tunnelUrl, status: res.status };
  } catch (e: any) {
    return { ok: false, url: tunnelUrl, error: e.message };
  }
}

async function pingBackend(tunnelUrl: string): Promise<HopResult> {
  try {
    const res = await fetch(tunnelUrl + '/health', { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, url: 'localhost:4000', status: res.status };
  } catch (e: any) {
    return { ok: false, url: 'localhost:4000', error: e.message };
  }
}

async function pingBridge(tunnelUrl: string): Promise<HopResult> {
  try {
    const res = await fetch(tunnelUrl + '/email-count', { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, url: '127.0.0.1:1143', status: res.status };
  } catch (e: any) {
    return { ok: false, url: '127.0.0.1:1143', error: e.message };
  }
}

export async function checkTunnel(env: Env) {
  const now = new Date().toISOString();

  const tunnel = await pingTunnel(env.TUNNEL_URL);
  const backend = tunnel.ok
    ? await pingBackend(env.TUNNEL_URL)
    : { ok: false, url: 'localhost:4000', error: 'tunnel down' };
  const bridge = backend.ok
    ? await pingBridge(env.TUNNEL_URL)
    : { ok: false, url: '127.0.0.1:1143', error: 'backend down' };

  await env.DASHBOARD_SCREENSHOTS.put('hop_tunnel', JSON.stringify({ ...tunnel, checkedAt: now }));
  await env.DASHBOARD_SCREENSHOTS.put('hop_backend', JSON.stringify({ ...backend, checkedAt: now }));
  await env.DASHBOARD_SCREENSHOTS.put('hop_bridge', JSON.stringify({ ...bridge, checkedAt: now }));

  console.log('[CHECK] tunnel=' + tunnel.ok + ' backend=' + backend.ok + ' bridge=' + bridge.ok);
}
