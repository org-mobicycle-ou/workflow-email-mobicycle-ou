# Error Handling — MobiCycle OÜ

## Account-Specific Errors

### Classification Errors
| Error | Cause | Recovery |
|-------|-------|----------|
| Unclassified email | No rule matched | Falls to 'unclassified' KV namespace |
| Multiple rules matched | Ambiguous classification | First matching rule wins (priority order) |
| Missing sender address | Malformed email header | Log and skip, don't store |

### KV Namespace Errors
| Error | Cause | Recovery |
|-------|-------|----------|
| Namespace not bound | Missing binding in wrangler.jsonc | Add binding and redeploy |
| Write quota exceeded | Too many writes in period | Batch writes, implement queue |

### Cron Job Errors
| Error | Cause | Recovery |
|-------|-------|----------|
| check-backend fails | Backend or tunnel down | Alert Rose, skip pipeline run |
| check-bridge fails | Bridge not running | Alert Rose, skip pipeline run |
| trigger-pipeline fails | Upstream dependency down | Retry on next cron cycle |

### Email-Specific Errors
| Error | Cause | Recovery |
|-------|-------|----------|
| Duplicate email detected | Same email fetched twice | Deduplicate by Message-ID |
| Attachment too large | R2 upload limit | Split or compress, log warning |

## Escalation

Account-level errors that persist across 3 cron cycles should trigger a notification to Rose via the notification pipeline.

