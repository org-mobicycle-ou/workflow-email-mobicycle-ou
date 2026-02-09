#!/bin/bash
# Format email as JSON with correct key structure
# Key format: {year}.{day}.{month}_{sender}_{hours}-{minutes}-{seconds}

from="$1"
to="$2"
subject="$3"
date="$4"
messageId="$5"

# Parse date
year=$(echo "$date" | cut -d'-' -f1)
month=$(echo "$date" | cut -d'-' -f2)
day=$(echo "$date" | cut -d'T' -f1 | cut -d'-' -f3)
time=$(echo "$date" | cut -d'T' -f2 | cut -d'Z' -f1)
hours=$(echo "$time" | cut -d':' -f1)
minutes=$(echo "$time" | cut -d':' -f2)
seconds=$(echo "$time" | cut -d':' -f3)

# Sanitize sender
sender=$(echo "$from" | sed 's/[@.]/_/g')

# Generate key
key="${year}.${day}.${month}_${sender}_${hours}-${minutes}-${seconds}"

# Output JSON
cat <<JSON
{
  "key": "$key",
  "from": "$from",
  "to": "$to",
  "subject": "$subject",
  "date": "$date",
  "messageId": "$messageId",
  "storedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "pending"
}
JSON
