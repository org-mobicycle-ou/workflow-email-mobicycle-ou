# API Documentation — MobiCycle OÜ

## Overview

These endpoints are specific to the MobiCycle OÜ email worker (`workflow-email`). They extend the generic API with account-specific routes.

## Base URL

```
https://imap.mobicycle.ee
```

## Account-Specific Email Queries (Sent)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sent-by-rose@mobicycle.ee` | Sent count for rose@mobicycle.ee |
| GET | `/sent-by-rose@mobicycle.consulting` | Sent count for rose@mobicycle.consulting |
| GET | `/sent-by-rose@mobicycle.us` | Sent count for rose@mobicycle.us |
| GET | `/sent-by-rose@mobicycle.productions` | Sent count for rose@mobicycle.productions |

## Account-Specific Email Queries (Received)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sent-to-rose@mobicycle.ee` | Received count for rose@mobicycle.ee |
| GET | `/sent-to-rose@mobicycle.consulting` | Received count for rose@mobicycle.consulting |
| GET | `/sent-to-rose@mobicycle.productions` | Received count for rose@mobicycle.productions |
| GET | `/sent-to-rose@mobicycle.us` | Received count for rose@mobicycle.us |

## Account-Specific Email Queries (Received, Excluding Spam)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sent-to-rose@mobicycle.ee-no-spam` | Received excluding spam |
| GET | `/sent-to-rose@mobicycle.consulting-no-spam` | Received excluding spam |
| GET | `/sent-to-rose@mobicycle.productions-no-spam` | Received excluding spam |
| GET | `/sent-to-rose@mobicycle.us-no-spam` | Received excluding spam |

## Dynamic Label-Based Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/label-sent/{label}?email=` | Sent count by label for specific email |
| GET | `/label-received/{label}?email=` | Received count by label for specific email |

## Classification Rules

See `_config/classification-rules.json` for the full set of rules specific to MobiCycle OÜ. These determine how incoming emails are categorised into KV namespaces.

## KV Namespaces (MobiCycle OÜ)

This account uses 19 KV namespaces for email classification. See the worker's `wrangler.jsonc` for bindings.

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| */5 * * * * | trigger-pipeline | Main email fetch and process |
| */10 * * * * | check-backend | Verify backend server health |
| */10 * * * * | check-bridge | Verify ProtonMail Bridge connectivity |
| */10 * * * * | check-tunnel | Verify Cloudflare Tunnel status |

