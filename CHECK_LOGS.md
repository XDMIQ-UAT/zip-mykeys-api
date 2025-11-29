# How to Check Logs

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




