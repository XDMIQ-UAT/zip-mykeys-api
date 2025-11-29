# How to Verify Production Setup

## Quick Verification

Run the verification script:
```bash
node verify-production.js
```

## Manual Verification Steps

### 1. Check Vercel Deployment Logs

```bash
# Get latest deployment URL from vercel --prod output
vercel logs <deployment-url>

# Or follow logs in real-time
vercel logs <deployment-url> --follow
```

**Look for:**
- ✅ `✓ Upstash Redis initialized` - Redis is working
- ❌ `⚠️ Upstash Redis not configured` - Environment variables missing
- ✅ `[AUDIT] Secret accessed: ses-credentials` - Credentials found
- ❌ `SES credentials not configured` - Can't read from Redis

### 2. Check Environment Variables in Vercel

1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
2. Verify these are set for **Production**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Test Email Send

```bash
node test-send-email.js hello@cosmiciq.org
```

**Expected:**
- ✅ `✓ Email sent successfully!` - Everything working
- ❌ `SES credentials not configured` - Redis not accessible

### 4. Check Redis Directly

```bash
node test-upstash-connection.js
```

**Expected:**
- ✅ `✓ Upstash Redis connection successful!`
- ✅ `✓ SES credentials stored`

## Common Issues

### Issue: "SES credentials not configured"
**Cause:** Server can't read from Redis
**Fix:** 
- Check environment variables are set in Vercel
- Verify Redis client initializes (check logs)
- Ensure credentials are in Redis

### Issue: "Upstash Redis not configured"
**Cause:** Environment variables not available
**Fix:**
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel
- Redeploy: `vercel --prod`

### Issue: "Timeout"
**Cause:** Server trying to call own API
**Fix:** Already fixed - server reads directly from Redis




