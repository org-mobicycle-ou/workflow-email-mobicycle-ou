import type { Env } from '../../shared/types';
import { getKVBindings, NAMESPACE_META } from '../../shared/kv-bindings';

export async function handlePurgeKv(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'POST required with {"namespace": "slug-or-all"}' }, { status: 405 });
  }
  const body = (await request.json()) as any;
  const target = body.namespace || '';
  const bindings = getKVBindings(env);
  const purged: Record<string, number> = {};

  const slugs = target === 'all'
    ? Object.keys(NAMESPACE_META)
    : [target];

  for (const slug of slugs) {
    const meta = NAMESPACE_META[slug];
    if (!meta) continue;
    const ns = bindings[meta.binding];
    if (!ns) continue;
    let count = 0;
    let cursor: string | undefined;
    do {
      const list = await ns.list({ cursor, limit: 1000 });
      for (const key of list.keys) {
        await ns.delete(key.name);
        count++;
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
    purged[slug] = count;
  }
  return Response.json({ purged });
}

