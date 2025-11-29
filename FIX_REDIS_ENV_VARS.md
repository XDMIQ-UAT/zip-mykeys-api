# Fix Redis Environment Variables

## Problem
The production server cannot access Redis because environment variables are not available at runtime.

## Solution

### Step 1: Verify Variables in Vercel Dashboard

1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
2. Check that these variables exist:
   - `UPSTASH_REDIS_REST_URL` (or `KV_REST_API_URL`)
   - `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_TOKEN`)

### Step 2: Check Environment Scope

Make sure the variables are set for **Production** environment:
- ✅ Production
- ✅ Preview (optional)
- ✅ Development (optional)

### Step 3: Get Values from Upstash

If variables are missing, get them from Upstash console:
1. Go to: https://console.upstash.com/
2. Select your database: `upstash-kv-indigo-island` (or similar)
3. Copy:
   - **REST URL**: `https://diverse-guinea-10527.upstash.io`
   - **REST TOKEN**: `ASkfAAIncDIwZDczNzU2MTY5YzI0YjdmYjk2MjI4YzI2ZWVkMzNmYXAyMTA1Mjc`

### Step 4: Add Variables in Vercel

**Option A: Via Dashboard**
1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
2. Click "Add New"
3. Add:
   - Key: `UPSTASH_REDIS_REST_URL`
   - Value: `https://diverse-guinea-10527.upstash.io`
   - Environment: ✅ Production
4. Click "Add New" again
5. Add:
   - Key: `UPSTASH_REDIS_REST_TOKEN`
   - Value: `ASkfAAIncDIwZDczNzU2MTY5YzI0YjdmYjk2MjI4YzI2ZWVkMzNmYXAyMTA1Mjc`
   - Environment: ✅ Production

**Option B: Via CLI**
```powershell
cd E:\zip-myl-mykeys-api
vercel env add UPSTASH_REDIS_REST_URL production
# Paste: https://diverse-guinea-10527.upstash.io

vercel env add UPSTASH_REDIS_REST_TOKEN production
# Paste: ASkfAAIncDIwZDczNzU2MTY5YzI0YjdmYjk2MjI4YzI2ZWVkMzNmYXAyMTA1Mjc
```

### Step 5: Redeploy

After adding variables, redeploy:
```powershell
vercel --prod
```

### Step 6: Verify

Check Redis status:
```powershell
curl -s "https://mykeys.zip/api/debug/redis-status" | ConvertFrom-Json | Format-List
```

Should show:
- `redis_initialized: True`
- `redis_url_set: True`
- `redis_token_set: True`

## Alternative: Use KV Variables

If Upstash integration uses different variable names, the code also checks:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

These are automatically checked as fallbacks.




