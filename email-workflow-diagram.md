# Email Workflow Process Map

```mermaid
flowchart TD
    A[CRON Job Every 10 Minutes] --> B[Cloudflare Worker]
    B --> C[HTTP POST to localhost:4000]
    C --> D[Backend Server]
    D --> E[IMAP Connection to localhost:1143]
    E --> F[ProtonMail Bridge]
    F --> G[Fetch 50 Recent Emails]
    G --> H[Return Raw Email Data]
    H --> I[Format Email Keys]
    I --> J[Format Email Values]
    J --> K[Save to RAW_DATA_HEADERS KV]
    K --> L[Apply Whitelist Filter]
    L --> M{Email Passes Whitelist?}
    M -->|Yes| N[Save to FILTERED_DATA_HEADERS KV]
    M -->|No| O[Discard Email]
    N --> P[Determine Legal Category]
    P --> Q[Save to Legal KV Namespace]
    
    subgraph "KV Namespaces"
        Q --> R[EMAIL_COURTS_*]
        Q --> S[EMAIL_COMPLAINTS_*]
        Q --> T[EMAIL_GOVERNMENT_*]
        Q --> U[EMAIL_CLAIMANTS_*]
        Q --> V[EMAIL_DEFENDANTS_*]
    end
    
    Q --> W[Update Dashboard Counts]
    
    subgraph "Key Formatting"
        I --> I1["{year}.{day}.{month}_{sender}_{time}"]
    end
    
    subgraph "Value Formatting"  
        J --> J1["JSON: from, to, subject, body, date, messageId, namespace, storedAt, status"]
    end
    
    subgraph "Whitelist Criteria"
        L --> L1[".court domains"]
        L --> L2[".gov.uk domains"] 
        L --> L3["@ico.org.uk addresses"]
        L --> L4["Legal keywords"]
    end
```

## Process Flow

1. **CRON Trigger** - Every 10 minutes
2. **Cloudflare Worker** - Processes the scheduled job
3. **Backend Call** - POST to `localhost:4000/fetch-emails`
4. **ProtonMail Bridge** - Backend connects to `localhost:1143`
5. **Email Retrieval** - Fetches 50 most recent emails from "All Mail"
6. **Raw Storage** - All emails saved to `RAW_DATA_HEADERS` with proper formatting
7. **Whitelist Filtering** - Apply legal domain/keyword filters
8. **Filtered Storage** - Relevant emails saved to `FILTERED_DATA_HEADERS`
9. **Legal Categorization** - Distribute emails to specific legal KV namespaces
10. **Dashboard Update** - Refresh counts and status

## Data Flow

```
ProtonMail Bridge (1143) 
    ↓
Backend Server (4000)
    ↓  
Cloudflare Worker
    ↓
RAW_DATA_HEADERS KV
    ↓
Whitelist Filter
    ↓
FILTERED_DATA_HEADERS KV
    ↓
Legal Category KV Namespaces
```