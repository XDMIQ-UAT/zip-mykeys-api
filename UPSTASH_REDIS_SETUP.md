# Upstash Redis Setup Guide

## Overview
The mykeys.zip API now uses **Upstash Redis** (via Vercel Marketplace) instead of GCP Secret Manager for secret storage. This provides:
- ✅ Faster access (Redis is in-memory)
- ✅ Serverless (pay-per-use)
- ✅ Lower latency
- ✅ Free tier available (10K commands/day)

## Important Note
**Vercel KV was deprecated** in June 2025. We're using **Upstash Redis** from the Vercel Marketplace instead.

## Setup Steps

### 1. Create Upstash Redis Database via Vercel Marketplace

1. **Go to Vercel Dashboard**:
   - Navigate to your project → **Storage** → **Create Database**
   - Click on **"Marketplace Database Providers"**

2. **Select Upstash**:
   - Find **"Upstash"** (Serverless DB - Redis, Vector, Queue, Search)
   - Click on it to open the integration page
   - Click **"Add Integration"** or **"Create Database"**

3. **Configure Upstash**:
   - Choose a database name (e.g., `mykeys-redis`)
   - Select a region (choose closest to your Vercel deployment)
   - Click **"Create"**

4. **Connect to Project**:
   - Vercel will automatically add environment variables to your project:
     - `UPSTASH_REDIS_REST_URL` - REST API URL
     - `UPSTASH_REDIS_REST_TOKEN` - REST API token

### 2. Set Environment Variables

After connecting Upstash, Vercel automatically provides:
- `UPSTASH_REDIS_REST_URL` - Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - REST API token

**Optional**: Set `SECRET_STORAGE_MODE`:
- `redis` - Use Upstash Redis only (default, recommended)
- `hybrid` - Use Redis first, fallback to GCP (for migration)
- `gcp` - Use GCP Secret Manager only (legacy)

### 3. Local Development

For local development:

**Option A: Use Upstash (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Link your project
vercel link

# Pull environment variables (includes Upstash credentials)
vercel env pull .env.local
```

**Option B: Create Upstash account for local dev**
1. Go to https://upstash.com
2. Create a free account
3. Create a Redis database
4. Copy REST URL and token to `.env.local`:
   ```env
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

## Migration from GCP

The code supports **hybrid mode** for gradual migration:

1. Set `SECRET_STORAGE_MODE=hybrid`
2. Secrets are read from Redis first, fallback to GCP
3. Secrets found in GCP are automatically migrated to Redis
4. New secrets are stored in both Redis and GCP

Once migration is complete:
1. Set `SECRET_STORAGE_MODE=redis`
2. Remove GCP Secret Manager dependency (optional)

## Secret Storage Format

Secrets are stored in Redis with the prefix `secret:`:
- `secret:ses-credentials` - SES credentials
- `secret:twilio-credentials` - Twilio credentials
- `secret:mcp-token-*` - MCP tokens
- `secret:device-*` - Device tokens

Metadata (labels) are stored separately:
- `secret:ses-credentials:meta` - Metadata for ses-credentials

## API Usage

The API endpoints remain the same:

```javascript
// Get secret
GET /api/secrets/ses-credentials
Authorization: Bearer <token>

// Store secret
POST /api/secrets
Authorization: Bearer <token>
{
  "name": "ses-credentials",
  "value": "{\"smtp_username\":\"...\",\"smtp_password\":\"...\"}"
}

// Update secret
PUT /api/secrets/ses-credentials
Authorization: Bearer <token>
{
  "value": "{\"smtp_username\":\"...\",\"smtp_password\":\"...\"}"
}
```

## Benefits

1. **Performance**: Redis is much faster than GCP Secret Manager API calls
2. **Cost**: Free tier: 10K commands/day, then pay-as-you-go
3. **Simplicity**: No GCP credentials needed
4. **Serverless**: Auto-scaling, no infrastructure management
5. **Vercel Integration**: Native integration via Marketplace

## Limitations

1. **No Versioning**: Redis doesn't have built-in versioning (GCP Secret Manager does)
2. **No Encryption at Rest**: Redis doesn't encrypt by default (add encryption layer if needed)
3. **Size Limits**: Check Upstash limits (usually sufficient for secrets)

## Next Steps

1. ✅ Install `@upstash/redis` package
2. ✅ Update server.js to use Upstash Redis
3. ⏳ Create Upstash Redis database via Vercel Marketplace
4. ⏳ Set `SECRET_STORAGE_MODE=redis` in Vercel env vars (optional, default)
5. ⏳ Test secret storage/retrieval
6. ⏳ Migrate existing secrets from GCP (if using hybrid mode)

## Troubleshooting

**Error: "Redis client not initialized"**
- Check that `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- Verify Upstash database is connected to your Vercel project

**Error: "Connection timeout"**
- Check Upstash database is active (not paused)
- Verify network connectivity
- Check Upstash dashboard for rate limits

**Secrets not found**
- Check Redis keys with prefix `secret:`
- Verify `SECRET_STORAGE_MODE` is set correctly
- Check logs for migration errors




