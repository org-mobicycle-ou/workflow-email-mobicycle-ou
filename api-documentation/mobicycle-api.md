# MobiCycle-Specific API Extensions

## Base URL
`http://localhost:4000` (inherits from generic API)

## MobiCycle Custom Endpoints

These endpoints are specific to MobiCycle's business needs and extend the generic API.

### Project Management

**GET** `/mobicycle/projects`

List all client projects tracked through emails.

```json
{
  "projects": [
    {
      "id": "proj-123",
      "client": "Acme Corp",
      "name": "Website Redesign",
      "email_count": 47,
      "last_activity": "2024-01-01T15:30:00Z",
      "status": "active"
    }
  ]
}
```

**GET** `/mobicycle/projects/{id}/emails`

Get all emails related to a specific project.

```json
{
  "project": {
    "id": "proj-123",
    "name": "Website Redesign",
    "client": "Acme Corp"
  },
  "emails": [
    {
      "id": "email-456",
      "subject": "Design mockups ready",
      "from": "design@acme.com",
      "date": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Contract Management

**GET** `/mobicycle/contracts`

List contract-related emails and status.

```json
{
  "contracts": [
    {
      "id": "contract-789",
      "client": "Acme Corp",
      "type": "Service Agreement",
      "status": "pending_signature",
      "emails": 5,
      "last_update": "2024-01-01T14:00:00Z"
    }
  ]
}
```

### Client Communication

**GET** `/mobicycle/clients/{client}/summary`

Get communication summary for a specific client.

```json
{
  "client": "Acme Corp",
  "summary": {
    "total_emails": 124,
    "last_contact": "2024-01-01T16:00:00Z",
    "categories": {
      "projects": 89,
      "contracts": 12,
      "support": 23
    },
    "response_time_avg": "4.2 hours"
  }
}
```

### Analytics

**GET** `/mobicycle/analytics/activity`

Email activity analytics for business insights.

**Query Parameters:**
- `period`: `day`, `week`, `month` (default: week)
- `category`: Filter by email category

```json
{
  "period": "week",
  "data": [
    {
      "date": "2024-01-01",
      "emails_received": 45,
      "emails_classified": 43,
      "top_categories": ["projects", "support", "contracts"]
    }
  ],
  "totals": {
    "received": 315,
    "classified": 298,
    "unclassified": 17
  }
}
```

### Classification Rules (MobiCycle-Specific)

**GET** `/mobicycle/classification/custom-rules`

View MobiCycle's custom classification rules.

```json
{
  "rules": [
    {
      "id": "client-projects",
      "name": "Client Projects",
      "keywords": ["project", "client", "delivery", "milestone"],
      "from_domains": ["@acme.com", "@clientdomain.com"],
      "folder": "projects",
      "priority": "high",
      "auto_tag": ["client-work", "billable"]
    },
    {
      "id": "contracts",
      "name": "Legal Contracts",
      "keywords": ["contract", "agreement", "legal", "signature"],
      "folder": "legal",
      "priority": "high",
      "notify": ["admin@mobicycle.com"]
    }
  ]
}
```

**POST** `/mobicycle/classification/custom-rules`

Add new MobiCycle-specific classification rule.

**Request:**
```json
{
  "name": "New Client Inquiries",
  "keywords": ["inquiry", "quote", "estimate", "new project"],
  "folder": "leads",
  "priority": "high",
  "auto_tag": ["potential-client"],
  "notify": ["sales@mobicycle.com"]
}
```

### Account-Specific Configuration

**GET** `/mobicycle/config`

View MobiCycle's complete configuration (base + overrides).

```json
{
  "account": {
    "name": "MobiCycle Technologies",
    "id": "mobicycle-ou"
  },
  "email_accounts": [
    "admin@mobicycle.com",
    "support@mobicycle.com"
  ],
  "kv_namespaces": {
    "emails": "email_mobicycle_production",
    "classifications": "classify_mobicycle_production"
  },
  "custom_settings": {
    "client_notification": true,
    "project_tracking": true,
    "contract_alerts": true
  }
}
```

### Webhooks (MobiCycle-Specific)

**POST** `/mobicycle/webhooks/client-notification`

Webhook for notifying clients about email processing.

**POST** `/mobicycle/webhooks/project-update`

Webhook triggered when project-related emails are processed.

## MobiCycle Business Logic

### Auto-Tagging
Emails matching certain rules automatically get business-relevant tags:
- `client-work` - Billable client communications
- `urgent` - High-priority items needing immediate attention
- `contract-related` - Legal/contract documents

### Smart Notifications
- Contract emails → Notify admin immediately
- Client project emails → Tag for project tracking
- Support emails → Route to support queue

### Integration Points
- Project management system integration
- Time tracking system hooks
- Client portal notifications