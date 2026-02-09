# Populate MobiCycle OÜ Email KV Namespaces

## THE CORRECT PROJECT

This is for the **mobicycle-ou** workflow project with:
- **Account**: 2e4a7955aa124c38058cccd43902a8a5 (MobiCycle OÜ)
- **Email**: rose@mobicycle.ee (ONLY)
- **KV Namespaces**: 35 email namespaces
- **Dashboard**: https://workflow-email.mobicycle-ou.workers.dev

## Run the Population Script

```bash
# 1. Set your Cloudflare API token
export CLOUDFLARE_API_TOKEN='your-token-here'

# 2. Optional: Set backend URL (defaults to https://imap.mobicycle.ee)
export TUNNEL_URL='http://localhost:4000'  # if using local backend

# 3. Run the script
cd /sessions/happy-tender-galileo/mnt/email/mobicycle-ou
bun run populate-kv-correct.ts
```

## What Gets Populated

**35 KV Namespaces:**

**Courts (7):**
- EMAIL_COURTS_SUPREME_COURT
- EMAIL_COURTS_COURT_OF_APPEALS_CIVIL_DIVISION
- EMAIL_COURTS_KINGS_BENCH_APPEALS_DIVISION
- EMAIL_COURTS_CHANCERY_DIVISION
- EMAIL_COURTS_ADMINISTRATIVE_COURT
- EMAIL_COURTS_CENTRAL_LONDON_COUNTY_COURT
- EMAIL_COURTS_CLERKENWELL_COUNTY_COURT

**Complaints (5):**
- EMAIL_COMPLAINTS_ICO
- EMAIL_COMPLAINTS_PHSO
- EMAIL_COMPLAINTS_PARLIAMENT
- EMAIL_COMPLAINTS_HMCTS
- EMAIL_COMPLAINTS_BAR_STANDARDS_BOARD

**Legal Expenses (4):**
- EMAIL_EXPENSES_LEGAL_FEES_CLAIMANT
- EMAIL_EXPENSES_LEGAL_FEES_COMPANY
- EMAIL_EXPENSES_LEGAL_FEES_DIRECTOR
- EMAIL_EXPENSES_REPAIRS

**Claimants (4):**
- EMAIL_CLAIMANT_HK_LAW
- EMAIL_CLAIMANT_LESSEL
- EMAIL_CLAIMANT_LIU
- EMAIL_CLAIMANT_RENTIFY

**Defendants (5):**
- EMAIL_DEFENDANTS_DEFENDANT
- EMAIL_DEFENDANTS_BOTH_DEFENDANTS
- EMAIL_DEFENDANTS_BARRISTERS
- EMAIL_DEFENDANTS_LITIGANT_IN_PERSON_ONLY
- EMAIL_DEFENDANTS_MOBICYCLE_OU_ONLY

**Government (3):**
- EMAIL_GOVERNMENT_UK_LEGAL_DEPARTMENT
- EMAIL_GOVERNMENT_ESTONIA
- EMAIL_GOVERNMENT_US_STATE_DEPARTMENT

**Reconsideration (7):**
- EMAIL_RECONSIDERATION_SINGLE_JUDGE
- EMAIL_RECONSIDERATION_COURT_OFFICER_REVIEW
- EMAIL_RECONSIDERATION_PTA_REFUSAL
- EMAIL_RECONSIDERATION_CPR52_24_5
- EMAIL_RECONSIDERATION_CPR52_24_6
- EMAIL_RECONSIDERATION_CPR52_30
- EMAIL_RECONSIDERATION_PD52B

## Data Structure

Each namespace will have ONE key: `rose@mobicycle.ee`

```json
{
  "email": "rose@mobicycle.ee",
  "binding": "EMAIL_COURTS_SUPREME_COURT",
  "sentEmails": 0,
  "receivedEmails": 0,
  "lastUpdated": "2026-02-09T12:00:00.000Z",
  "status": "pending"
}
```

## Verify

Check the dashboard after populating:
https://workflow-email.mobicycle-ou.workers.dev/?token=mobicycle-workflows-2026

The Aristotelian dashboard should show:
- Pipeline Status: Bridge → Backend → KV
- Material Cause: Emails in ProtonMail
- Sync Verification: KV vs Bridge comparison
