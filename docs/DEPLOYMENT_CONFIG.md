# Deployment Configuration

## Current Setup

You have **two potential deployment mechanisms**:

### 1. GitHub Actions → Vercel CLI
- **Trigger**: Push to `master` or `main` branch
- **File**: `.github/workflows/deploy-vercel.yml`
- **Method**: Uses Vercel CLI to deploy
- **Status**: ✅ Active

### 2. Vercel Connected Repository (if enabled)
- **Trigger**: Push to connected branch
- **Method**: Vercel automatically detects commits
- **Status**: ❓ Unknown (check Vercel dashboard)

## Potential Double Deployment Issue

If **both** are enabled, you'll get **double deployments**:
1. Vercel auto-deploys from connected repo
2. GitHub Actions also deploys via CLI

## How to Check

### Check Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`zip-myl-mykeys-api`)
3. Go to **Settings** → **Git**
4. Check if **GitHub** is connected

### If Connected Repository Exists

You'll see:
- ✅ Connected to GitHub repository
- ✅ Auto-deploy enabled
- Branch: `master` or `main`

## Solution: Choose One Method

### Option 1: Use GitHub Actions Only (Recommended)

**Disable Vercel auto-deploy:**
1. Vercel Dashboard → Settings → Git
2. Disconnect GitHub repository OR
3. Disable "Auto-deploy" for production branch

**Keep GitHub Actions:**
- ✅ More control over deployment process
- ✅ Can add custom build steps
- ✅ Better for CI/CD pipelines

### Option 2: Use Vercel Connected Repo Only

**Disable GitHub Actions:**
1. Delete or disable `.github/workflows/deploy-vercel.yml`
2. Or add condition to skip: `if: false`

**Keep Vercel auto-deploy:**
- ✅ Simpler setup
- ✅ Automatic deployments
- ✅ Built-in preview deployments

## Recommended Configuration

Based on your memory preference [[memory:7656317]], you prefer **connected repository** deployments.

### Recommended: Vercel Connected Repo

1. **Keep Vercel connected** to GitHub
2. **Disable GitHub Actions** deployment (or make it conditional)

Update `.github/workflows/deploy-vercel.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    # Only run if Vercel auto-deploy is disabled
    if: false  # Set to false to disable GitHub Actions deployment
    steps:
      # ... rest of workflow
```

Or **delete the workflow file** if you're using Vercel connected repo.

## Current Status Check

Run this to see recent deployments:

```bash
# Check Vercel deployments (if CLI installed)
vercel ls

# Or check GitHub Actions runs
# Go to: https://github.com/your-org/zip-myl-mykeys-api/actions
```

## Summary

- ⚠️ **Potential Issue**: Double deployments if both enabled
- ✅ **Solution**: Choose one method (Vercel connected repo recommended)
- 🔍 **Check**: Vercel Dashboard → Settings → Git
- 💡 **Action**: Disable one deployment method

