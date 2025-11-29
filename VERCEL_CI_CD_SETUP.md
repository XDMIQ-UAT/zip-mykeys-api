# Vercel CI/CD Setup Guide

This guide explains how to set up automatic deployments from GitHub to Vercel.

## Option 1: Vercel Dashboard (Recommended - Easiest)

This is the simplest method and automatically sets up CI/CD:

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/new
   - Or: https://vercel.com/xdmiq/zip-mykeys-api

2. **Connect GitHub Repository:**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find and select: `XDM-ZSBW/zip-mykeys-api`
   - Click "Import"

3. **Configure Project:**
   - **Framework Preset:** Other
   - **Root Directory:** `./` (default)
   - **Build Command:** (leave empty - Vercel auto-detects)
   - **Output Directory:** (leave empty)
   - **Install Command:** `npm install`

4. **Environment Variables:**
   - Add all required environment variables in Vercel dashboard
   - Go to: Settings → Environment Variables

5. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically:
     - Deploy on every push to `master`/`main` branch
     - Create preview deployments for pull requests
     - Set up webhooks automatically

## Option 2: GitHub Actions (Current Setup)

If you prefer using GitHub Actions for more control:

### Step 1: Get Vercel Credentials

Run locally to get your project info:
```bash
cd E:\zip-myl-mykeys-api
vercel link
```

Current project info:
- **Project ID:** `prj_z7PH1IzqYB7DusqyUuOcheekW77j`
- **Org ID:** `team_LnDwQeWWn03G6B9bTbma8o2K`

### Step 2: Create Vercel Token

1. Go to: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name it: `github-actions-zip-mykeys-api`
4. Copy the token (starts with `vercel_`)

### Step 3: Add GitHub Secrets

Go to: https://github.com/XDM-ZSBW/zip-mykeys-api/settings/secrets/actions

Add these secrets:

1. **VERCEL_TOKEN**
   - Value: Your Vercel token from Step 2
   - Example: `vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **VERCEL_ORG_ID**
   - Value: `team_LnDwQeWWn03G6B9bTbma8o2K`

3. **VERCEL_PROJECT_ID_ZIP_MYKEYS_API**
   - Value: `prj_z7PH1IzqYB7DusqyUuOcheekW77j`

### Step 4: Verify Workflow

The GitHub Actions workflow (`.github/workflows/deploy-vercel.yml`) is already configured:

- **Triggers:**
  - Push to `master` or `main` → Production deployment
  - Pull requests → Preview deployment

- **Steps:**
  1. Checkout code
  2. Setup Node.js 18
  3. Install dependencies (`npm ci`)
  4. Install Vercel CLI
  5. Deploy to Vercel

### Step 5: Test Deployment

1. Make a small change and commit:
   ```bash
   git add .
   git commit -m "test: CI/CD setup"
   git push origin master
   ```

2. Check GitHub Actions:
   - Go to: https://github.com/XDM-ZSBW/zip-mykeys-api/actions
   - You should see "Deploy to Vercel" workflow running

3. Check Vercel Dashboard:
   - Go to: https://vercel.com/xdmiq/zip-mykeys-api/deployments
   - You should see a new deployment

## Verification

After setup, verify:

1. **GitHub Actions:**
   - https://github.com/XDM-ZSBW/zip-mykeys-api/actions
   - Should show workflow runs on each push

2. **Vercel Dashboard:**
   - https://vercel.com/xdmiq/zip-mykeys-api/deployments
   - Should show automatic deployments

3. **Deployment URLs:**
   - Production: `https://zip-mykeys-api.vercel.app` (or custom domain)
   - Preview: Unique URL per PR

## Troubleshooting

### GitHub Actions Fails

1. **Check Secrets:**
   - Verify all three secrets are set correctly
   - Secret names must match exactly (case-sensitive)

2. **Check Vercel Token:**
   ```bash
   vercel whoami --token YOUR_TOKEN
   ```

3. **Check Project Access:**
   - Ensure your Vercel account has access to the project
   - Check: https://vercel.com/xdmiq/zip-mykeys-api/settings

### Vercel Dashboard Method Not Working

1. **Check Repository Access:**
   - Vercel needs GitHub app permissions
   - Go to: https://github.com/settings/installations
   - Authorize Vercel app

2. **Check Webhooks:**
   - Go to: https://github.com/XDM-ZSBW/zip-mykeys-api/settings/hooks
   - Should see Vercel webhook

## Current Configuration

- **Repository:** XDM-ZSBW/zip-mykeys-api
- **Vercel Project:** xdmiq/zip-mykeys-api
- **Branch:** master
- **Framework:** Node.js (Express)
- **Build:** Automatic (no build step needed)

## Next Steps

1. ✅ Choose setup method (Dashboard recommended)
2. ✅ Add environment variables to Vercel
3. ✅ Test deployment with a commit
4. ✅ Set up custom domain (optional)
5. ✅ Configure production environment variables

---

**Last Updated:** 2025-11-29
**Status:** ✅ Ready for CI/CD setup

