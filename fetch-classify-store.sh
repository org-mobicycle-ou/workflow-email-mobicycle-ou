#!/bin/bash

###############################################################################
# Fetch → Classify → Store Email Pipeline
# Fetches emails from ProtonMail Bridge, classifies them, and stores in KV
###############################################################################

set -e

ACCOUNT_ID="2e4a7955aa124c38058cccd43902a8a5"
EMAIL="rose@mobicycle.ee"
BACKEND_URL="${TUNNEL_URL:-https://imap.mobicycle.ee}"
CLASSIFICATION_RULES="./classification-rules.json"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Email Processing Pipeline"
echo "========================================="
echo ""

# Check prerequisites
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo -e "${RED}❌ CLOUDFLARE_API_TOKEN not set${NC}"
  exit 1
fi

if [ ! -f "$CLASSIFICATION_RULES" ]; then
  echo -e "${RED}❌ Classification rules not found: $CLASSIFICATION_RULES${NC}"
  echo "Run: ./generate-classification-rules.sh"
  exit 1
fi

echo -e "${GREEN}✓ API token set${NC}"
echo -e "${GREEN}✓ Classification rules found${NC}"
echo ""

# Function to generate email key
generate_email_key() {
  local date_str="$1"
  local from_email="$2"

  # Parse ISO date: 2026-02-09T10:30:45Z
  local year=$(echo "$date_str" | cut -d'-' -f1)
  local month=$(echo "$date_str" | cut -d'-' -f2)
  local day=$(echo "$date_str" | cut -d'T' -f1 | cut -d'-' -f3)
  local time=$(echo "$date_str" | cut -d'T' -f2 | cut -d'.' -f1)
  local hours=$(echo "$time" | cut -d':' -f1)
  local minutes=$(echo "$time" | cut -d':' -f2)
  local seconds=$(echo "$time" | cut -d':' -f3 | cut -d'Z' -f1)

  # Sanitize sender email: casework@ico.org.uk → casework_ico_org_uk
  local sender_key=$(echo "$from_email" | sed 's/[@.]/_/g')

  # Format: 2026.09.02_casework_ico_org_uk_10-30-45
  echo "${year}.${day}.${month}_${sender_key}_${hours}-${minutes}-${seconds}"
}

# Function to classify email and get KV namespace
classify_email() {
  local from_email="$1"
  local subject="$2"

  # Check against classification rules
  local namespace=""

  while IFS= read -r rule; do
    local ns=$(echo "$rule" | jq -r '.namespace')
    local to_includes=$(echo "$rule" | jq -r '.conditions.toIncludes[]' 2>/dev/null || echo "")
    local from_includes=$(echo "$rule" | jq -r '.conditions.fromIncludes[]' 2>/dev/null || echo "")
    local subject_includes=$(echo "$rule" | jq -r '.conditions.subjectIncludes[]' 2>/dev/null || echo "")

    # Check if email matches this rule
    if echo "$from_email" | grep -qi "$from_includes" || \
       echo "$subject" | grep -qi "$subject_includes"; then
      namespace="$ns"
      break
    fi
  done < <(jq -c '.rules[]' "$CLASSIFICATION_RULES")

  echo "$namespace"
}

# Function to get namespace ID from wrangler.jsonc
get_namespace_id() {
  local binding="$1"
  cat wrangler.jsonc | jq -r ".kv_namespaces[] | select(.binding == \"$binding\") | .id"
}

# Function to store email in KV
store_email_in_kv() {
  local namespace_id="$1"
  local email_key="$2"
  local email_data="$3"

  local url="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${namespace_id}/values/${email_key}"

  local response=$(curl -s -X PUT "$url" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$email_data")

  if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC}"
    echo "$response" | jq '.errors'
  fi
}

# Main processing loop
echo "Fetching emails from ProtonMail Bridge..."
echo ""

# Fetch emails from backend (assumes backend exposes /list-emails endpoint)
# For now, we'll process test data - replace with actual IMAP fetch
cat > /tmp/test-emails.json << 'EOF'
[
  {
    "from": "casework@ico.org.uk",
    "to": "rose@mobicycle.ee",
    "subject": "Data Protection Complaint ICO-123456",
    "body": "We are investigating your complaint...",
    "date": "2026-02-09T10:30:45Z",
    "messageId": "<test-001@ico.org.uk>"
  },
  {
    "from": "admin@supremecourt.uk",
    "to": "rose@mobicycle.ee",
    "subject": "Appeal Case SC/2024/0156",
    "body": "Your appeal hearing is scheduled...",
    "date": "2026-02-09T11:15:22Z",
    "messageId": "<test-002@supremecourt.uk>"
  },
  {
    "from": "legal@gov.ee",
    "to": "rose@mobicycle.ee",
    "subject": "Estonian Legal Matter EE-2024-001",
    "body": "Reference to proceedings in Estonia...",
    "date": "2026-02-09T14:20:10Z",
    "messageId": "<test-003@gov.ee>"
  }
]
EOF

# Process each email
total=0
stored=0
blocked=0

while IFS= read -r email; do
  total=$((total + 1))

  from=$(echo "$email" | jq -r '.from')
  to=$(echo "$email" | jq -r '.to')
  subject=$(echo "$email" | jq -r '.subject')
  body=$(echo "$email" | jq -r '.body')
  date=$(echo "$email" | jq -r '.date')
  messageId=$(echo "$email" | jq -r '.messageId')

  echo -e "${BLUE}📧 Processing:${NC} $from → \"$subject\""

  # Classify email
  namespace=$(classify_email "$from" "$subject")

  if [ -z "$namespace" ] || [ "$namespace" = "null" ]; then
    echo -e "   ${RED}❌ BLOCKED${NC} - Not whitelisted"
    blocked=$((blocked + 1))
    echo ""
    continue
  fi

  echo -e "   ${GREEN}✓ Classified:${NC} $namespace"

  # Get namespace ID
  namespace_id=$(get_namespace_id "$namespace")

  if [ -z "$namespace_id" ]; then
    echo -e "   ${RED}❌ ERROR${NC} - Namespace ID not found"
    echo ""
    continue
  fi

  # Generate email key
  email_key=$(generate_email_key "$date" "$from")
  echo -e "   ${BLUE}🔑 Key:${NC} $email_key"

  # Prepare email data
  email_data=$(cat <<JSON
{
  "key": "$email_key",
  "from": "$from",
  "to": "$to",
  "subject": "$subject",
  "body": "$body",
  "date": "$date",
  "messageId": "$messageId",
  "whitelistMatch": {
    "namespace": "$namespace"
  },
  "storedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "pending"
}
JSON
)

  # Store in KV
  echo -n "   💾 Storing in KV ($namespace_id)... "
  store_email_in_kv "$namespace_id" "$email_key" "$email_data"

  stored=$((stored + 1))
  echo ""
done < <(jq -c '.[]' /tmp/test-emails.json)

# Summary
echo "========================================="
echo "Summary"
echo "========================================="
echo -e "${BLUE}Total emails processed:${NC} $total"
echo -e "${GREEN}Stored in KV:${NC} $stored"
echo -e "${RED}Blocked:${NC} $blocked"
echo ""
echo "✅ Pipeline complete!"
