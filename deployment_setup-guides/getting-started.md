# Getting Started - MobiCycle Email System

## Prerequisites

- Bun installed
- Cloudflare account with Workers enabled
- Email account credentials
- KV namespace access

## Step 1: Clone and Setup

```bash
# Navigate to the email system
cd email/

# Install dependencies for generic backend
cd generic/localhosts/4000-backend-server
bun install

# Start the backend server
bun run dev
```

The backend server will start on `http://localhost:4000`

## Step 2: Configure MobiCycle Settings

Edit your company configuration:
```bash
# Edit MobiCycle-specific config
nano account-based/mobicycle-ou/_config/company.json
```

Update these fields:
- Email accounts to monitor
- Custom classification rules
- KV namespace names
- Cron schedules (if different from defaults)

## Step 3: Deploy Workers

```bash
cd account-based/mobicycle-ou/workers/

# Deploy fetch worker
cd fetch/
bun run deploy

# Deploy classify worker
cd ../classify/
bun run deploy

# Deploy triage worker
cd ../triage/
bun run deploy
```

## Step 4: Test the System

```bash
# Run tests
cd account-based/mobicycle-ou/tests/
bun test

# Check backend health
curl http://localhost:4000/health

# Test email fetch
curl http://localhost:4000/fetch-emails
```

## Step 5: Monitor

- Check Cloudflare Workers logs
- Monitor KV storage usage
- Review processed emails in folders

## Troubleshooting

**Backend won't start**: Check port 4000 isn't in use
**Workers fail to deploy**: Verify Cloudflare credentials
**No emails processing**: Check email account credentials in config
**Classification errors**: Review classification rules in config

## Next Steps

- [Configuration Guide](./configuration.md)
- [API Documentation](./api.md)
- [Testing Guide](./testing.md)