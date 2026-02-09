#!/bin/bash

###############################################################################
# Format Email as JSON for KV Storage
# Generates the email key and JSON structure for storing in KV namespaces
###############################################################################

# Usage: ./format-email-json.sh <from> <to> <subject> <date> <message-id>
# Example: ./format-email-json.sh "court@supremecourt.uk" "rose@mobicycle.ee" "Case hearing" "2026-02-09T10:30:45Z" "<msg@court.uk>"

FROM="$1"
TO="$2"
SUBJECT="$3"
DATE="$4"
MESSAGE_ID="$5"
BODY="${6:-}"
NAMESPACE="${7:-UNCLASSIFIED}"

if [ -z "$FROM" ] || [ -z "$TO" ] || [ -z "$SUBJECT" ] || [ -z "$DATE" ]; then
  echo "Usage: $0 <from> <to> <subject> <date> <message-id> [body] [namespace]"
  echo ""
  echo "Example:"
  echo "  $0 'court@supremecourt.uk' 'rose@mobicycle.ee' 'Case hearing' '2026-02-09T10:30:45Z' '<msg@court.uk>'"
  exit 1
fi

# Parse date: 2026-02-09T10:30:45Z
YEAR=$(echo "$DATE" | cut -d'-' -f1)
MONTH=$(echo "$DATE" | cut -d'-' -f2)
DAY=$(echo "$DATE" | cut -d'T' -f1 | cut -d'-' -f3)
TIME=$(echo "$DATE" | cut -d'T' -f2 | cut -d'.' -f1 | cut -d'Z' -f1)
HOURS=$(echo "$TIME" | cut -d':' -f1)
MINUTES=$(echo "$TIME" | cut -d':' -f2)
SECONDS=$(echo "$TIME" | cut -d':' -f3)

# Sanitize sender: casework@ico.org.uk → casework_ico_org_uk
SENDER_KEY=$(echo "$FROM" | sed 's/[@.]/_/g')

# Generate key: 2026.09.02_casework_ico_org_uk_10-30-45
EMAIL_KEY="${YEAR}.${DAY}.${MONTH}_${SENDER_KEY}_${HOURS}-${MINUTES}-${SECONDS}"

# Current timestamp
STORED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Generate JSON
cat <<JSON
{
  "key": "$EMAIL_KEY",
  "from": "$FROM",
  "to": "$TO",
  "subject": "$SUBJECT",
  "body": "$BODY",
  "date": "$DATE",
  "messageId": "$MESSAGE_ID",
  "whitelistMatch": {
    "namespace": "$NAMESPACE"
  },
  "storedAt": "$STORED_AT",
  "status": "pending"
}
JSON

echo "" >&2
echo "Key: $EMAIL_KEY" >&2
