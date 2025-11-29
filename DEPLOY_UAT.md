# Deploy to Vercel for Cloud UAT

## Quick Deploy (2 commands)

### Option 1: Deploy to Preview (Recommended for UAT)
```powershell
# Deploy to preview environment (auto-creates unique URL)
vercel

# Get the deployment URL (e.g., https://zip-myl-mykeys-api-abc123.vercel.app)
```

### Option 2: Deploy to Development
```powershell
# Deploy to development environment
vercel --env development
```

### Option 3: Deploy to Production
```powershell
# Deploy to production (only after UAT passes)
vercel --prod
```

---

## Step-by-Step Cloud UAT

### 1. Set Environment Variables in Vercel

The ProtonMail credentials are already in `.env.local`, but Vercel needs them set explicitly:

```powershell
# Set ProtonMail credentials for preview environment
vercel env add PROTONMAIL_USER preview
# Enter: hello@xdmiq.com

vercel env add PROTONMAIL_APP_PASSWORD preview
# Enter: KF88M5H134CT5KXP
```

### 2. Deploy to Preview

```powershell
vercel
```

**Expected Output:**
```
🔍  Inspect: https://vercel.com/xdmiq/zip-myl-mykeys-api/...
✅  Preview: https://zip-myl-mykeys-api-abc123.vercel.app [2s]
```

### 3. Test the Deployment

```powershell
# Test health endpoint (replace with your URL)
Invoke-RestMethod -Uri "https://zip-myl-mykeys-api-abc123.vercel.app/health"
```

### 4. Update CLI to Use Cloud URL

```powershell
# Set the cloud URL
$env:MYKEYS_URL = "https://zip-myl-mykeys-api-abc123.vercel.app"

# Test admin command
node mykeys-cli.js admin --skip-seed
```

---

## Environment Structure

Your Vercel project will have:

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Preview** | `https://zip-myl-mykeys-api-[hash].vercel.app` | UAT testing |
| **Development** | `https://zip-myl-mykeys-api-dev.vercel.app` | Development |
| **Production** | `https://mykeys.zip` | Live production |

---

## Full Setup (First Time Only)

If you haven't linked the project yet:

```powershell
# 1. Login to Vercel (if not already)
vercel login

# 2. Link to existing project
vercel link

# Select:
# - Scope: xdmiq
# - Project: zip-myl-mykeys-api

# 3. Set environment variables
vercel env add PROTONMAIL_USER
vercel env add PROTONMAIL_APP_PASSWORD

# For each variable, select environments:
# - Preview
# - Development  
# - Production

# 4. Deploy
vercel
```

---

## Testing Workflow

### Deploy and Test
```powershell
# 1. Deploy to preview
vercel

# 2. Copy the preview URL from output

# 3. Set URL for testing
$env:MYKEYS_URL = "https://your-preview-url.vercel.app"

# 4. Test the CLI
node mykeys-cli.js admin --skip-seed
# Enter your email
# Get 4-digit code
# Verify it works!
```

### Check Logs
```powershell
# View real-time logs
vercel logs https://your-preview-url.vercel.app --follow

# Or view in dashboard
# https://vercel.com/xdmiq/zip-myl-mykeys-api
```

---

## Quick Commands Reference

```powershell
# Deploy to preview (UAT)
vercel

# Deploy to production
vercel --prod

# List deployments
vercel ls

# View logs
vercel logs [url]

# Open dashboard
vercel inspect [url]

# Remove deployment
vercel rm [url]

# List environment variables
vercel env ls

# Pull environment variables to local
vercel env pull
```

---

## UAT Testing on Cloud

Once deployed:

```powershell
# Set your preview URL
$env:MYKEYS_URL = "https://zip-myl-mykeys-api-xyz.vercel.app"

# Test 1: Health check
Invoke-RestMethod -Uri "$env:MYKEYS_URL/health"

# Test 2: Email authentication
node mykeys-cli.js admin --skip-seed
# Follow prompts as normal

# Test 3: API endpoints
Invoke-RestMethod -Uri "$env:MYKEYS_URL/api/health" -Method Get
```

---

## Current Project Info

Based on your `.env.local`:
- **Project:** `zip-myl-mykeys-api`
- **Team:** `xdmiq`
- **Region:** Auto (Vercel chooses optimal)

---

## Troubleshooting

### "Project not linked"
```powershell
vercel link
```

### "Environment variables not set"
```powershell
vercel env add PROTONMAIL_USER
vercel env add PROTONMAIL_APP_PASSWORD
```

### "Deployment failed"
Check build logs:
```powershell
vercel logs --follow
```

### "Email not working"
Verify environment variables are set:
```powershell
vercel env ls
```

---

## Advantages of Cloud UAT

✅ **No local server needed**  
✅ **Real production environment**  
✅ **Unique URL for each test**  
✅ **Easy rollback**  
✅ **Real-time logs**  
✅ **No port conflicts**  
✅ **HTTPS by default**  

---

## Next Steps

1. **Deploy:** `vercel`
2. **Copy URL:** Note the preview URL
3. **Test:** Update `MYKEYS_URL` and test CLI
4. **UAT:** Follow `START_UAT.md` but use cloud URL
5. **Promote:** If UAT passes, deploy to prod with `vercel --prod`

---

**Time to Deploy:** ~2 minutes  
**Time to Test:** ~10 minutes  
**Total:** ~12 minutes for complete cloud UAT
