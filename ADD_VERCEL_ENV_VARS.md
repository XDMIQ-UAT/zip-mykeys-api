# Add Upstash Environment Variables to Vercel

## Current Status
✅ **Local**: Working perfectly
✅ **SES Credentials**: Stored in Upstash Redis (`upstash-kv-indigo-island`)
✅ **HIPAA Strategy**: Separate databases per environment

## Add Variables to Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables

2. Click **"Add New"**

3. Add **UPSTASH_REDIS_REST_URL**:
   - Key: `UPSTASH_REDIS_REST_URL`
   - Value: `https://diverse-guinea-10527.upstash.io`
   - Select: **Production** ✅ (and Preview/Dev if using same DB)

4. Click **"Add"**

5. Add **UPSTASH_REDIS_REST_TOKEN**:
   - Key: `UPSTASH_REDIS_REST_TOKEN`
   - Value: `ASkfAAIncDIwZDczNzU2MTY5YzI0YjdmYjk2MjI4YzI2ZWVkMzNmYXAyMTA1Mjc`
   - Select: **Production** ✅ (and Preview/Dev if using same DB)

6. Click **"Add"**

### Option 2: Via Vercel CLI

Run these commands (will prompt for values):

```bash
# Add URL
vercel env add UPSTASH_REDIS_REST_URL production
# When prompted, paste: https://diverse-guinea-10527.upstash.io

# Add Token
vercel env add UPSTASH_REDIS_REST_TOKEN production
# When prompted, paste: ASkfAAIncDIwZDczNzU2MTY5YzI0YjdmYjk2MjI4YzI2ZWVkMzNmYXAyMTA1Mjc
```

## After Adding Variables

1. **Redeploy**:
   ```bash
   vercel --prod
   ```

2. **Verify**:
   ```bash
   vercel env ls | Select-String -Pattern "UPSTASH"
   ```

3. **Test Email**:
   ```bash
   node test-send-email.js hello@cosmiciq.org
   ```

## HIPAA Compliance

For HIPAA compliance, you can create separate databases:
- **Production**: `upstash-kv-indigo-island` (current)
- **Preview**: Create new database in Upstash
- **Development**: Create new database in Upstash

Then set different environment variables per environment in Vercel.




