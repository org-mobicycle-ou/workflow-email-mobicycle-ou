# MobiCycle-Specific Testing

## Purpose

Tests MobiCycle's custom business logic, classification rules, and integration requirements.

## Test Categories

### 1. Business Logic Tests
- MobiCycle-specific classification rules
- Project tracking functionality
- Contract management workflows
- Client communication patterns

### 2. Configuration Tests
- MobiCycle configuration overrides
- KV namespace isolation
- Email account-specific settings
- Custom cron schedule validation

### 3. Integration Tests
- MobiCycle API extensions
- Webhook functionality
- External system integrations
- Custom notification systems

### 4. End-to-End Tests
- Complete email processing for MobiCycle scenarios
- Multi-client project tracking
- Contract workflow automation
- Analytics and reporting

## Running Tests

```bash
cd account-based/mobicycle-ou/tests
bun test

# Run specific business scenarios
bun test --grep "project-tracking"
bun test --grep "contracts"
bun test --grep "client-communication"
```

## Test Structure

```
account-based/mobicycle-ou/tests/
├── business/
│   ├── project-tracking.test.ts    # Client project management
│   ├── contracts.test.ts           # Contract workflow tests
│   └── client-analytics.test.ts    # Business intelligence
├── config/
│   ├── mobicycle-config.test.ts    # Configuration validation
│   └── classification-rules.test.ts # Custom rule testing
├── integration/
│   ├── api-extensions.test.ts      # MobiCycle-specific APIs
│   └── webhooks.test.ts            # Notification systems
└── e2e/
    └── full-workflow.test.ts       # Complete business scenarios
```

## MobiCycle Test Scenarios

### Project Tracking Tests
```typescript
describe('Project Email Classification', () => {
  test('identifies client project emails', async () => {
    const email = {
      subject: 'Acme Corp - Website Design Update',
      from: 'project.manager@acme.com',
      body: 'The client has approved the mockups...'
    };
    
    const result = await classifyEmail(email, 'mobicycle-ou');
    expect(result.folder).toBe('projects');
    expect(result.tags).toContain('client-work');
  });
});
```

### Contract Management Tests
```typescript
describe('Contract Processing', () => {
  test('triggers admin notification for contracts', async () => {
    const contractEmail = {
      subject: 'Service Agreement - Review Required',
      from: 'legal@client.com'
    };
    
    const notifications = await processEmail(contractEmail, 'mobicycle-ou');
    expect(notifications).toContain('admin@mobicycle.com');
  });
});
```

### Analytics Tests
```typescript
describe('Business Analytics', () => {
  test('tracks client communication patterns', async () => {
    const analytics = await getClientAnalytics('Acme Corp');
    expect(analytics.response_time_avg).toBeDefined();
    expect(analytics.categories.projects).toBeGreaterThan(0);
  });
});
```

## Test Data

### Sample MobiCycle Emails
- Client project communications
- Contract and legal documents
- Support requests
- Internal team coordination

### Mock Configurations
- Test KV namespaces
- Sample client data
- Mock webhook endpoints

## Coverage Requirements

- Business logic: 95%
- Custom classification rules: 100%
- API extensions: 90%
- Webhook integrations: 85%

## Integration with Generic Tests

MobiCycle tests extend generic tests by:
1. Using generic test utilities
2. Testing company-specific overrides
3. Validating business rule compliance
4. Ensuring data isolation from other companies

## Prerequisites

Before running MobiCycle tests:
1. Generic tests must pass
2. Test KV namespaces configured
3. Mock email providers set up
4. Sample data loaded