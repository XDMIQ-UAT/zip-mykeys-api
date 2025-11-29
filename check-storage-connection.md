# Checking Storage Connection

After connecting the project to storage, the environment variables should be automatically added. 

## Check if variables are there:

1. **Via Vercel Dashboard**:
   - Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
   - Look for variables starting with `UPSTASH_` or `KV_`

2. **Via Storage Tab**:
   - Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/storage
   - Click on `upstash-kv-purple-umbrella`
   - Look for "Environment Variables" or "Connection Details" section
   - The variables might be named:
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`
     - OR `KV_REST_API_URL`
     - OR `KV_REST_API_TOKEN`

## If variables are there but not showing in CLI:

The variables might be scoped to specific environments. Try:
```bash
vercel env pull .env.local --environment=production
vercel env pull .env.local --environment=preview
vercel env pull .env.local --environment=development
```

## Alternative: Continue with GCP

Since the code supports hybrid mode, we can:
1. Store SES credentials using GCP Secret Manager (current fallback)
2. Migrate to Upstash Redis later when variables are available

The code will automatically use Redis when variables are detected, and fall back to GCP otherwise.




