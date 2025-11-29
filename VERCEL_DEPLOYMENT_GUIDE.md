# Vercel Deployment Guide - Unified Platform 🚀

## Overview

**All deployments now use Vercel** - Production, Preview, and Development managed via Vercel CLI for faster, unified deployments.

---

## Quick Start

### Install Vercel CLI

```powershell
npm i -g vercel
```

### Login

```powershell
vercel login
```

### Deploy

```powershell
# Production
vercel deploy --prod
# or
vercel deploy --target=production

# Preview
vercel deploy --target=preview

# Development
vercel deploy --target=development
```

---

## Deployment Scripts

### PowerShell Script (Recommended)

```powershell
# Preview deployment
.\scripts\deploy-vercel.ps1

# Production deployment
.\scripts\deploy-vercel.ps1 -Prod

# Development deployment
.\scripts\deploy-vercel.ps1 -Dev
```

### Direct Vercel CLI

```powershell
# Production
vercel deploy --prod
# or
vercel deploy --target=production

# Preview
vercel deploy --target=preview

# Development
vercel deploy --target=development
```

**Note:** Always use explicit `--target` flags to specify the environment. This ensures you're deploying to the correct environment, not relying on defaults.

---

## Environments

### Production
- **URL**: https://mykeys.zip
- **Deploy**: `vercel --prod` or `.\scripts\deploy-vercel.ps1 -Prod`
- **Env Vars**: Encrypted (sensitive)
- **Auto-deploy**: On push to `main` branch

### Preview
- **URL**: Auto-generated preview URL per deployment
- **Deploy**: `vercel` or `.\scripts\deploy-vercel.ps1`
- **Env Vars**: Plain (readable for testing)
- **Auto-deploy**: On pull requests

### Development
- **URL**: Development-specific URL
- **Deploy**: `vercel --env development` or `.\scripts\deploy-vercel.ps1 -Dev`
- **Env Vars**: Plain (readable for testing)
- **Auto-deploy**: On push to `dev` branch (if configured)

---

## Environment Variables

### Managing Variables

**Via Vercel Dashboard:**
1. Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
2. Add/edit variables per environment
3. Production variables are encrypted automatically

**Via Vercel CLI:**
```powershell
# List variables
vercel env ls

# Add variable
vercel env add MYKEYS_PASS production

# Remove variable
vercel env rm MYKEYS_PASS production
```

**Via Scripts:**
```powershell
# Get password from Vercel
.\scripts\get-mykeys-pass-from-vercel.ps1 -Environment preview

# Update password
.\scripts\update-mykeys-password.ps1 -Interactive
```

### Required Variables

- `GCP_PROJECT` - GCP project ID (e.g., `myl-zip-www`)
- `GOOGLE_APPLICATION_CREDENTIALS` - GCP service account JSON (base64 encoded)
- `MYKEYS_PASS` - Admin password (different per environment)
- `MYKEYS_USER` - Admin username (default: `admin`)

---

## Project Configuration

### Vercel Project Settings

**Project ID**: `prj_z7PH1IzqYB7DusqyUuOcheekW77j`  
**Team**: `xdmiq`  
**Framework**: Node.js  
**Build Command**: (auto-detected)  
**Output Directory**: (auto-detected)

### Custom Domain

**Production**: `mykeys.zip`
- Configured in Vercel Dashboard
- SSL certificate managed by Vercel
- Auto-renewal enabled

---

## Deployment Workflow

### Standard Workflow

1. **Make changes** to code
2. **Test locally**: `npm start` or `node server.js`
3. **Deploy to Preview**: `vercel`
4. **Test preview URL**
5. **Deploy to Production**: `vercel --prod`

### CI/CD (Automatic)

**Production:**
- Auto-deploys on push to `main` branch
- Configured in Vercel Dashboard → Settings → Git

**Preview:**
- Auto-deploys on pull requests
- Each PR gets unique preview URL

---

## Monitoring & Logs

### View Logs

**Via Vercel Dashboard:**
- Go to: https://vercel.com/xdmiq/zip-myl-mykeys-api
- Click on deployment
- View "Logs" tab

**Via Vercel CLI:**
```powershell
# View logs for latest deployment
vercel logs

# View logs for specific deployment
vercel logs [deployment-url]
```

### Health Checks

```powershell
# Production
Invoke-RestMethod -Uri "https://mykeys.zip/api/health"

# Preview (use your preview URL)
Invoke-RestMethod -Uri "https://your-preview-url.vercel.app/api/health"
```

---

## Troubleshooting

### Deployment Fails

1. **Check logs**: `vercel logs`
2. **Verify environment variables**: `vercel env ls`
3. **Check build errors**: Review deployment logs in dashboard
4. **Verify GCP credentials**: Ensure service account JSON is valid

### Environment Variables Not Working

1. **Redeploy**: Variables only apply to new deployments
2. **Check environment**: Ensure variable is set for correct environment
3. **Verify format**: Check for typos or encoding issues

### Slow Deployments

- **First deployment**: May take 2-3 minutes (cold start)
- **Subsequent deployments**: Usually 30-60 seconds
- **Check build time**: Review deployment logs

---

## Best Practices

✅ **Use Preview for Testing** - Test changes before production  
✅ **Review Logs** - Check deployment logs after each deploy  
✅ **Monitor Health** - Set up health check monitoring  
✅ **Version Control** - Keep deployment scripts in git  
✅ **Document Changes** - Update deployment docs when changing process  

---

## Migration from Cloud Run/VM

If migrating from Cloud Run or VM:

1. **Export environment variables** from old platform
2. **Import to Vercel** via dashboard or CLI
3. **Update DNS** (if needed) - Vercel handles SSL automatically
4. **Test thoroughly** before switching DNS
5. **Monitor** for 24-48 hours after migration

---

## Summary

**✅ Unified Platform**: All environments on Vercel  
**✅ Fast Deployments**: Vercel CLI is instant  
**✅ Better DX**: CLI-first workflow  
**✅ Automatic Previews**: Every PR gets preview URL  
**✅ Simplified Management**: One platform, one set of tools  

**Deploy with confidence!** 🚀

