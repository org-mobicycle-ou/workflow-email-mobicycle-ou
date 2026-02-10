# Email Workflow Architecture

## Prerequisites

Three services must be running on your Mac before the workflow does anything:

### 1. ProtonMail Bridge
- **What**: Desktop app that exposes ProtonMail as local IMAP/SMTP
- **Ports**: IMAP on `localhost:1143`, SMTP on `localhost:1025`
- **Start**: Open ProtonMail Bridge app
- **Verify**: `openssl s_client -connect 127.0.0.1:1143 -starttls imap`

### 2. Backend Server
- **What**: Node.js server that wraps IMAP/SMTP into HTTP endpoints
- **Port**: `localhost:4000`
- **Start**: `cd /path/to/backend && node backend-server.js`
- **Verify**: `curl http://localhost:4000/health`
- **Endpoints used by the worker**:
  - `POST /fetch-emails` — fetches from All Mail via IMAP
  - `GET /health` — health check
  - `GET /email-count` — total email count
  - `GET /list-folders` — IMAP folder listing
  - `GET /account-info` — account + email addresses

### 3. Cloudflare Tunnel
- **What**: Exposes `localhost:4000` to the internet as `https://imap.mobicycle.ee`
- **Start**: `cloudflared tunnel run imap-mobicycle`
- **Verify**: `curl https://imap.mobicycle.ee/health`

### Dependency chain

```
ProtonMail Bridge (localhost:1143)
       ↑ IMAP
Backend Server (localhost:4000)
       ↑ HTTP
Cloudflare Tunnel (https://imap.mobicycle.ee)
       ↑ HTTPS
Cloudflare Worker (workflow-email)
       ↑ CRON trigger
Cloudflare scheduler (every 5 minutes)
```

If Bridge is down → backend can't fetch mail → tunnel serves errors → worker fails.
If backend is down → tunnel has nothing to forward → worker fails.
If tunnel is down → worker can't reach backend → worker fails.

## The Worker: workflow-email

**Deployed to**: Cloudflare Workers (MobiCycle OÜ account)
**Entry point**: `src/index.ts`
**Config**: `wrangler.jsonc`

### What it does

The worker has a CRON trigger (`*/5 * * * *`) and 4 HTTP endpoints.
Each CRON execution runs the full pipeline: fetch → store → triage.

### HTTP Endpoints

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: 'ok' }` |
| POST | `/run` | Manually triggers the full pipeline |
| GET | `/triage` | Runs triage on FILTERED_DATA_HEADERS |
| GET | `/status` | Returns last pipeline run result |

### Pipeline Steps

When the CRON fires (or you POST `/run`), this happens:

#### Step 0: Prereq check (Part 1)
- Worker calls `https://imap.mobicycle.ee/health`
- Backend `/health` actually connects to Bridge IMAP to verify it is alive
- Three possible failures:
  - Tunnel down: fetch throws network error → `{ tunnel: false }`
  - Backend down: tunnel returns 502/504 → `{ backend: false }`
  - Bridge down: backend returns 503 → `{ bridge: false }`
- If any prereq fails: write `status: skipped` to KV, exit. No further processing.
- If all three up: proceed.

#### Step 1: Fetch (Part 1)
- Worker calls `https://imap.mobicycle.ee/fetch-emails`
- Request: `POST { folder: 'All Mail', limit: 100 }`
- Tunnel forwards to `localhost:4000`
- Backend connects to ProtonMail Bridge on `localhost:1143`
- Returns array of emails with: from, to, subject, date, messageId, body

#### Step 2: Filter Rose's sent emails (Part 1)
- Removes any email where `from` contains:
  - rose@mobicycle.ee
  - rose@mobicycle.productions
  - rose@mobicycle.us
  - rose@mobicycle.consulting
  - rose@mobicycle.eu
- Result: only inbound emails remain

#### Step 3: Store all inbound in RAW_DATA_HEADERS (Part 2)
- Each email gets a key: `2026.02.09_sender_name_14-30-00`
- Value: JSON with from, to, subject, date, messageId, body, status='pending'
- Every inbound email goes here regardless of classification

#### Step 4: Classify against rules (Part 2)
- Loads `classification-rules.json` (35 rules, 80+ email patterns)
- Checks each email's from, to, and subject against rule conditions
- An email can match multiple rules (e.g. court email about CPR 52.24(5))

#### Step 5: Store matched emails in FILTERED_DATA_HEADERS (Part 2)
- Only emails that matched at least one rule
- Value includes which namespaces it matched

#### Step 6: Route to category KV namespaces (Part 2)
- For each matched namespace, store a copy in that KV
- e.g. email from ICO goes to EMAIL_COMPLAINTS_ICO
- e.g. email from Court of Appeal about CPR 52.24(5) goes to BOTH:
  - EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION
  - EMAIL_RECONSIDERATION_CPR52_24_5

#### Step 7: Triage pending emails (Part 3)
- Reads all `status: 'pending'` emails from FILTERED_DATA_HEADERS
- Labels each as:
  - **NOTED** — auto-replies, delivery notifications, out of office → no action
  - **SIMPLE** — standard correspondence → Claude drafts acknowledgement
  - **COMPLEX** — reconsideration applications, Supreme Court, Court of Appeal → needs document generation + CE-File submission
- Decision based on namespace + subject content signals

#### Step 8: Save pipeline run summary
- Writes to DASHBOARD_SCREENSHOTS/pipeline_last_run:
  - Timestamp
  - Part 1 stats: fetched, inbound, rose-filtered
  - Part 2 stats: raw stored, filtered stored, route stats per namespace
  - Part 3 stats: total triaged, count per level (NOTED/SIMPLE/COMPLEX)

## KV Namespaces (38 total)

### Data Processing (3)
- `RAW_DATA_HEADERS` — all inbound emails
- `FILTERED_DATA_HEADERS` — emails matching classification rules
- `DASHBOARD_SCREENSHOTS` — pipeline status, CRON logs

### Courts (7)
- Supreme Court, Court of Appeals Civil Division, Kings Bench Appeals,
  Chancery Division, Administrative Court, Central London County Court,
  Clerkenwell County Court

### Complaints (5)
- ICO, PHSO, Parliament, HMCTS, Bar Standards Board

### Legal Expenses (4)
- Legal Fees Claimant, Legal Fees Company, Legal Fees Director, Repairs

### Claimants (4)
- HK Law, Lessel, Liu, Rentify

### Defendants (5)
- Defendant, Both Defendants, Barristers, Litigant in Person Only, MobiCycle OÜ Only

### Government (3)
- UK Legal Department, Estonia, US State Department

### Reconsideration (7)
- Single Judge, Court Officer Review, PTA Refusal,
  CPR52.24(5), CPR52.24(6), CPR52.30, PD52B

## File Structure

```
src/
├── index.ts           — worker entry point, CRON handler, HTTP routes, pipeline runner
├── part1_fetch/
│   └── index.ts       — connect to bridge, fetch emails, filter Rose's sent
├── part2_store/
│   └── index.ts       — classify, store RAW → FILTERED → category KV namespaces
└── part3_triage/
    └── index.ts       — label emails as NOTED / SIMPLE / COMPLEX
```

## What is NOT implemented yet

- SIMPLE action: Claude drafting reply emails
- COMPLEX action: document generation (letters, PDFs)
- COMPLEX action: CE-File submission
- SMTP sending via bridge
- Email cover letters
- Notifications to Rose
- Dashboard frontend

