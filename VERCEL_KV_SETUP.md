# Vercel KV Setup Guide

## Overview
The mykeys.zip API now uses **Vercel KV** (Redis) instead of GCP Secret Manager for secret storage. This provides:
- ✅ Faster access (Redis is in-memory)
- ✅ Vercel-native (no external dependencies)
- ✅ Lower latency
- ✅ Free tier available

## Configuration

### 1. Set Environment Variable
Set `SECRET_STORAGE_MODE` in your Vercel environment variables:

- `kv` - Use Vercel KV only (default, recommended)
- `hybrid` - Use KV first, fallback to GCP (for migration)
- `gcp` - Use GCP Secret Manager only (legacy)

### 2. Vercel KV Setup (via Marketplace)

**KV is now available through the Marketplace!**

1. **Create Redis Database via Marketplace**:
   - Go to your project → Storage → Create Database
   - Click on **"Marketplace Database Providers"**
   - Select **"Redis"** (Serverless Redis) or **"Upstash"** (Serverless DB - Redis)
   - Follow the setup wizard to create your Redis database
   - Choose a name (e.g., `mykeys-kv`)

2. **Environment Variables**:
   After connecting the Redis database, Vercel will automatically provide:
   - `KV_URL` - Redis connection URL
   - `KV_REST_API_URL` - REST API URL (for Upstash)
   - `KV_REST_API_TOKEN` - REST API token (for Upstash)
   - `KV_REST_API_READ_ONLY_TOKEN` - Read-only token (for Upstash)

   These are automatically available in your Vercel functions.

**Note**: If using **Upstash**, you'll use the REST API endpoints. If using **Redis** directly, you'll use the Redis connection URL.

### 3. Local Development

For local development, you can:

**Option A: Use Vercel KV (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Link your project
vercel link

# Pull environment variables (includes KV credentials)
vercel env pull .env.local
```

**Option B: Mock KV for local dev**
Create a `.env.local` file:
```env
KV_URL=redis://localhost:6379
# Or use Upstash Redis for local dev
```

## Migration from GCP

The code supports **hybrid mode** for gradual migration:

1. Set `SECRET_STORAGE_MODE=hybrid`
2. Secrets are read from KV first, fallback to GCP
3. Secrets found in GCP are automatically migrated to KV
4. New secrets are stored in both KV and GCP

Once migration is complete:
1. Set `SECRET_STORAGE_MODE=kv`
2. Remove GCP Secret Manager dependency (optional)

## Secret Storage Format

Secrets are stored in KV with the prefix `secret:`:
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
2. **Cost**: Free tier available, then pay-as-you-go
3. **Simplicity**: No GCP credentials needed
4. **Vercel Integration**: Native integration with Vercel platform

## Limitations

1. **No Versioning**: KV doesn't have built-in versioning (GCP Secret Manager does)
2. **No Encryption at Rest**: KV doesn't encrypt by default (add encryption layer if needed)
3. **Size Limits**: KV has size limits (check Vercel docs)

## Next Steps

1. ✅ Install `@vercel/kv` package
2. ✅ Update server.js to use KV
3. ⏳ Create KV database in Vercel
4. ⏳ Set `SECRET_STORAGE_MODE=kv` in Vercel env vars
5. ⏳ Test secret storage/retrieval
6. ⏳ Migrate existing secrets from GCP (if using hybrid mode)

