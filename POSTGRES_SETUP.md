# Postgres Database Setup

## Current Status

✅ Code is ready for Postgres  
❌ Database not connected to Vercel project yet

## Quick Setup

### Option 1: Connect Existing Database (Recommended)

1. Go to Vercel Storage: https://vercel.com/xdmiq/zip-myl-mykeys-api/storage
2. Click **"Connect Database"** or **"Add"**
3. Select your existing Postgres database
4. Vercel will automatically add `POSTGRES_URL` environment variable

### Option 2: Create New Postgres Database

1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/storage
2. Click **"Create Database"** → **"Postgres"**
3. Choose a plan (Hobby/Pro)
4. Click **"Create"**
5. Vercel automatically adds `POSTGRES_URL` to environment variables

### Option 3: Manual Connection String

If you have a Postgres connection string from another provider:

1. Add to `.env.local`:
   ```
   POSTGRES_URL=postgresql://user:password@host:port/database
   ```

2. Add to Vercel environment variables:
   ```bash
   vercel env add POSTGRES_URL production
   ```

## After Connecting

1. **Pull environment variables:**
   ```bash
   vercel env pull .env.local --environment=production
   ```

2. **Test connection:**
   ```bash
   node test-postgres-connection.js
   ```

3. **Initialize secrets table:**
   The table will be created automatically on first use, or run:
   ```bash
   node test-postgres-connection.js
   ```

4. **Store SES credentials:**
   ```bash
   node store-ses-credentials.js
   ```

5. **Deploy:**
   ```bash
   vercel --prod
   ```

## Verify Database Connection

After connecting, verify:

```bash
# Check environment variable
node test-postgres-connection.js

# Should show:
# ✓ Connection successful
# ✓ Secrets table initialized
```

## Troubleshooting

### "POSTGRES_URL not found"
- Database not connected to project
- Pull env vars: `vercel env pull .env.local`
- Check: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables

### "Connection refused"
- Check connection string format
- Verify database is accessible
- Check firewall/network settings

### "Table does not exist"
- Run `test-postgres-connection.js` to create table
- Or manually create:
  ```sql
  CREATE TABLE secrets (
    name VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```



