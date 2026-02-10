# Deployment — MobiCycle OÜ

## Prerequisites

- Generic platform fully set up (Bridge, backend, tunnel)
- Cloudflare account: MobiCycle OÜ (2e4a7955aa124c38058cccd43902a8a5)
- `wrangler` authenticated to MobiCycle OÜ account

## Deploy

```bash
cd account-based/mobicycle-ou/
wrangler deploy
```

## Secrets

Set via wrangler (not committed to git):

```bash
wrangler secret put IMAP_USER    # rose@mobicycle.ee
wrangler secret put IMAP_PASS    # Bridge-generated password
wrangler secret put TUNNEL_URL   # https://imap.mobicycle.ee
```

## KV Namespace Bindings

All 19 namespaces must be bound in `wrangler.jsonc`. Verify after deploy:

```bash
wrangler kv:namespace list
```

## Verify Deployment

```bash
# Check worker is responding
curl https://imap.mobicycle.ee/health

# Check account-specific endpoints
curl https://imap.mobicycle.ee/sent-to-rose@mobicycle.ee
curl https://imap.mobicycle.ee/api/kpi/total-emails

# Run account integration tests
cd tests/
./run.sh integration
```

## Rollback

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous
wrangler rollback
```

