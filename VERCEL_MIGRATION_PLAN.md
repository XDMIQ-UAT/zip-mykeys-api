# Vercel Migration Plan - Consolidate All Deployments

## 🎯 Goal

**Move everything to Vercel** - Production, Preview, and Development all managed via Vercel CLI for faster, unified deployments.

---

## Current State

### ✅ Already on Vercel
- **Production**: `https://mykeys.zip` (Vercel)
- **Preview**: Preview deployments (Vercel)
- **Development**: Development deployments (Vercel)

### 📋 Legacy References (To Remove)
- Cloud Run deployment scripts
- VM deployment documentation
- GCP Cloud Run references in docs

---

## Migration Steps

### 1. Standardize on Vercel CLI

**All deployments via Vercel CLI:**

```powershell
# Production
vercel --prod

# Preview (default)
vercel

# Development (via environment)
vercel --env development
```

### 2. Update Deployment Scripts

**Single unified deployment script:**
- `scripts/deploy-vercel.ps1` - Already exists, enhance it
- Remove Cloud Run deployment references
- Remove VM deployment references

### 3. Environment Management

**All environments managed in Vercel:**
- Production: Encrypted env vars
- Preview: Plain env vars (for testing)
- Development: Plain env vars (for local testing)

### 4. Update Documentation

**Remove references to:**
- Cloud Run deployments
- VM deployments
- GCP Cloud Run setup

**Update to focus on:**
- Vercel CLI deployment
- Vercel environment variables
- Vercel project settings

---

## Benefits

✅ **Faster deployments** - Vercel CLI is instant  
✅ **Unified workflow** - One tool for all environments  
✅ **Better DX** - CLI-first approach  
✅ **Automatic previews** - Every PR gets a preview URL  
✅ **Simplified management** - One platform, one set of tools  

---

## Implementation

### Phase 1: Update Deployment Scripts ✅
- [x] `scripts/deploy-vercel.ps1` exists
- [ ] Enhance with environment selection
- [ ] Add development deployment support

### Phase 2: Remove Legacy References
- [ ] Update `DEPLOYMENT_STATUS.md`
- [ ] Update `DEPLOYMENT_CHECKLIST.md`
- [ ] Update `README.md`
- [ ] Remove Cloud Run scripts (or mark as deprecated)

### Phase 3: Standardize Documentation
- [ ] Create `VERCEL_DEPLOYMENT_GUIDE.md`
- [ ] Update all deployment references
- [ ] Add Vercel CLI quick start

---

## Quick Start (After Migration)

```powershell
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login
vercel login

# Deploy to Preview
vercel

# Deploy to Production
vercel --prod

# Link to project (first time)
vercel link
```

---

## Environment Variables

**All managed in Vercel Dashboard:**
- Production: Encrypted
- Preview: Plain (readable)
- Development: Plain (readable)

**Access via:**
- Vercel Dashboard: https://vercel.com/xdmiq/zip-myl-mykeys-api/settings/environment-variables
- Vercel CLI: `vercel env ls`
- Scripts: `scripts/get-mykeys-pass-from-vercel.ps1`

---

## Next Steps

1. ✅ Review current Vercel setup
2. ⏳ Enhance deployment scripts
3. ⏳ Update documentation
4. ⏳ Remove legacy references
5. ⏳ Test all environments

---

**Status:** 🚀 Ready to migrate - Vercel is already primary platform!




