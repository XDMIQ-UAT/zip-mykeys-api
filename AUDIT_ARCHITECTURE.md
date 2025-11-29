# Audit Architecture

## Principle: Server Reads Directly, Never Calls Own API

**Why:** The server should NEVER make HTTP calls to itself to read secrets. This causes:
- ❌ Performance issues (network overhead)
- ❌ Timeout loops (server calling itself)
- ❌ Audit trail confusion (can't tell if access was internal or external)
- ❌ Security risk (unnecessary network exposure)

## Correct Architecture

### Server Internal Access (Direct)
```
Server Code → getSecret() → Redis/GCP (direct)
```
- ✅ Fast (no network overhead)
- ✅ Reliable (no timeout issues)
- ✅ Auditable (clear internal access logs)
- ✅ Secure (no HTTP exposure)

### External Client Access (API)
```
External Client → HTTP API → getSecret() → Redis/GCP (direct)
```
- ✅ Proper API authentication
- ✅ Rate limiting
- ✅ Audit trail via API logs

## Audit Logging

All secret access is logged with `[AUDIT]` prefix:

### Read Operations
```
[AUDIT] Secret accessed: ses-credentials from Redis (5ms)
[AUDIT] Secret accessed: twilio-credentials from GCP (120ms)
[AUDIT] Secret not found: missing-secret (2ms)
```

### Write Operations
```
[AUDIT] Secret stored: ses-credentials to Redis (created) (8ms)
[AUDIT] Secret stored: twilio-credentials to Redis (updated) (6ms)
[AUDIT] Secret synced: ses-credentials to GCP (150ms)
```

### Error Operations
```
[AUDIT] Secret access failed: ses-credentials from redis: Connection timeout
[AUDIT] Secret store failed: ses-credentials to redis: Invalid token
```

## Audit Fields

Each audit log includes:
- **Operation**: accessed/stored/synced/failed
- **Secret Name**: Which secret was accessed
- **Source**: redis/gcp/gcp->redis
- **Result**: created/updated/not found
- **Duration**: Time taken in milliseconds
- **Error**: Error message if failed

## Compliance

This architecture supports:
- ✅ **HIPAA**: Clear audit trail of all secret access
- ✅ **SOC 2**: Access logging and monitoring
- ✅ **GDPR**: Data access tracking
- ✅ **Performance**: Fast direct access, no API overhead

## Monitoring

Audit logs can be:
1. **Streamed to monitoring service** (Datadog, CloudWatch, etc.)
2. **Stored in audit database** (separate from secrets)
3. **Alerted on failures** (failed access attempts)
4. **Analyzed for patterns** (unusual access patterns)

## Example Audit Query

```javascript
// Find all SES credential accesses in last hour
grep "[AUDIT] Secret accessed: ses-credentials" logs | tail -100

// Find failed secret accesses
grep "[AUDIT] Secret.*failed" logs

// Find slow secret accesses (>100ms)
grep "[AUDIT]" logs | grep -E "\([0-9]{3,}ms\)"
```




