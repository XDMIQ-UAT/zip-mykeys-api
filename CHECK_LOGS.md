# How to Check Logs

## Agent Runtime Log Parser (Recommended)

Since moving to Vercel, use the agent runtime log parser for structured analysis:

```bash
# From agents directory
cd E:\agents\vercel-log-monitor-agent

# Check for errors
python check_vercel_logs.py --keyword error

# Check MFA-related issues
python check_vercel_logs.py --keyword "MFA code"

# Check KV storage issues
python check_vercel_logs.py --keyword "KV"

# Check specific endpoint
python check_vercel_logs.py --endpoint /api/auth/verify-mfa-code

# Get JSON output for programmatic use
python check_vercel_logs.py --keyword error --json
```

The agent runs automatically every 15 minutes to monitor for errors.

## Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api
2. Click **"Deployments"** tab
3. Click on the **latest deployment** (most recent)
4. Click **"Logs"** tab
5. Look for:
   - `✓ Upstash Redis initialized` ✅
   - `⚠️ Upstash Redis not configured` ❌
   - `URL: set, Token: missing` (shows what's wrong)

## Command Line

```bash
# Get logs (may wait for new logs)
vercel logs zip-myl-mykeys-p0lwdwrkw-xdmiq.vercel.app

# Or get logs as JSON
vercel logs zip-myl-mykeys-p0lwdwrkw-xdmiq.vercel.app --json
```

## Using Python Parser Directly

```python
from runtime.vercel_log_parser import parse_vercel_logs_for_agent

# Parse logs for errors
result = parse_vercel_logs_for_agent(keyword='error', level='error')

if result['success']:
    print(result['summary'])
    # Access structured data
    errors = result['analysis']['errors']
    endpoints = result['analysis']['by_endpoint']
```

## What to Look For

### Good Signs ✅
- `✓ Upstash Redis initialized`
- `[AUDIT] Secret accessed: ses-credentials from Redis`
- No errors about missing environment variables

### Bad Signs ❌
- `⚠️ Upstash Redis not configured`
- `URL: missing, Token: missing`
- `SES credentials not configured`

## Current Status

- ✅ Credentials in Redis (verified via curl)
- ✅ Code reads directly from Redis
- ❓ Redis client initialization (check logs)

## If Redis Not Initializing

The environment variables might not be available at runtime. Check:
1. Variables are set for **Production** environment
2. Variables are named correctly: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Redeploy after adding variables: `vercel --prod`




