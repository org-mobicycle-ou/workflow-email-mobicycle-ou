# Populate Cloudflare KV Namespaces with Email Data

## THE TRUTH

**The KV namespaces are currently EMPTY.** This guide shows you how to actually populate them with real email count data from ProtonMail Bridge.

## Architecture

```
ProtonMail Bridge (localhost:1143)
    ↓ IMAP
Backend Server (localhost:4000)
    ↓ HTTP API
Population Script
    ↓ Cloudflare API
Cloudflare KV (19 namespaces)
```

## Prerequisites

1. **ProtonMail Bridge** running on localhost:1143 in split mode
2. **Cloudflare API Token** with KV write permissions
3. **Bun** runtime installed

## Setup

### 1. Get Your Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a token with these permissions:
   - Account > Workers KV Storage > Edit
3. Copy the token

### 2. Set the API Token

```bash
export CLOUDFLARE_API_TOKEN='your-token-here'
```

### 3. Run the Setup Script

```bash
cd /sessions/happy-tender-galileo/mnt/email
./setup-and-populate.sh
```

This will:
- ✓ Verify API token is set
- ✓ Start the backend server (if not running)
- ✓ Check ProtonMail Bridge connectivity
- ✓ Populate all email KV namespaces with email counts
- ✓ Write data for all 5 email accounts

## What Gets Populated

**Email KV Namespaces (dynamically detected):**

To see the current list:
```bash
wrangler kv namespace list | grep email-
```

**Email Accounts (dynamically detected):**

To see actual accounts, check your ProtonMail Bridge or backend configuration.

**Data Structure per Key:**
```json
{
  "email": "rose@mobicycle.ee",
  "label": "Admin Court",
  "sentEmails": 84,
  "receivedEmails": 112,
  "lastUpdated": "2026-02-09T05:30:00.000Z"
}
```

## Verify Population

After running, verify the data was written:

```bash
# Check one namespace
curl "https://api.cloudflare.com/client/v4/accounts/2e4a7955aa124c38058cccd43902a8a5/storage/kv/namespaces/37c7b5e5e8a84e2a8e340cb0e1b39202/keys" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

## View the Dashboard

Once populated, start the dashboard:

```bash
cd /sessions/happy-tender-galileo/mnt/email/mobicycle/src/3_workFlowEntrypoints/dashboard
bun run index.ts
```

Then visit http://localhost:3000 to see the Aristotelian data flow dashboard showing:
- Pipeline Status (Bridge → Backend → KV)
- The Four Causes
- Sync Verification

## Troubleshooting

**"Backend not accessible"**
- Ensure ProtonMail Bridge is running on localhost:1143
- Check that split mode is enabled
- Verify you can connect via IMAP

**"API Token invalid"**
- Verify the token has Workers KV Storage Edit permissions
- Check the token hasn't expired
- Ensure you're using the correct account ID (2e4a7955aa124c38058cccd43902a8a5)

**"Label not found"**
- The label mapping in populate-kv-api.ts must match actual ProtonMail labels
- Check `/list-folders` endpoint to see actual label names
