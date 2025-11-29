# Deployment Verification Prompt

Use this prompt in a new thread to verify that the credential rotation was successful and deployments are working correctly.

---

## Prompt for Deployment Verification Thread

```
I just rotated Google Cloud Platform (GCP) service account credentials for mykeys.zip Vercel deployments across Production, Preview, and Development environments.

**What was done:**
1. Created new service account keys for all 3 environments:
   - Production: mykeys-vercel-prod-sa@myl-zip-www.iam.gserviceaccount.com
   - Preview: mykeys-vercel-preview-sa@myl-zip-www.iam.gserviceaccount.com
   - Development: mykeys-vercel-dev-sa@myl-zip-www.iam.gserviceaccount.com

2. Updated Vercel environment variables via API:
   - GOOGLE_APPLICATION_CREDENTIALS (new JSON keys)
   - GCP_PROJECT=myl-zip-www
   - For all 3 environments: Production, Preview, Development

**Project Details:**
- Vercel Project: zip-myl-mykeys-api
- Vercel Project ID: prj_z7PH1IzqYB7DusqyUuOcheekW77j
- Team: xdmiq
- GCP Project: myl-zip-www
- Production URL: https://mykeys.zip

**Please verify:**
1. Check that all 3 Vercel deployments (Production, Preview, Development) are working
2. Test API endpoints that require GCP Secret Manager access:
   - /api/health
   - /api/admin/info (requires token)
   - /api/mcp/token/generate (requires authentication)
   - /api/v1/secrets/* (requires GCP credentials)
3. Verify GCP Secret Manager operations work:
   - Reading secrets
   - Creating/updating secrets (MCP tokens)
   - Listing secrets
4. Test the token generation flow end-to-end
5. Check Vercel deployment logs for any GCP authentication errors
6. Verify that old credentials are no longer being used

**Key Files:**
- Rotation script: E:\zip-myl-mykeys-api\scripts\rotate-vercel-gcp-credentials.ps1
- Update script: E:\zip-myl-mykeys-api\scripts\update-vercel-env-vars.ps1
- Key files created:
  - vercel-prod-key.json
  - vercel-preview-key.json
  - vercel-dev-key.json

**Next Steps After Verification:**
- If everything works: Delete old keys using `.\scripts\rotate-vercel-gcp-credentials.ps1 -DeleteOldKeys`
- If issues found: Investigate and potentially rollback

Please provide a comprehensive verification report with:
- Status of each environment
- Test results for each API endpoint
- Any errors or warnings found
- Recommendations for next steps
```

---

## Context for Verification

**Service Accounts Created:**
- All service accounts have `roles/secretmanager.secretAccessor` and `roles/secretmanager.admin`
- Keys are stored locally in JSON files
- Environment variables updated in Vercel via API

**What to Test:**
1. **Production:** https://mykeys.zip
2. **Preview:** Check latest preview deployment URL
3. **Development:** Check development deployment URL

**Critical Endpoints to Test:**
- `/api/health` - Should work without auth
- `/api/admin/info` - Requires Bearer token, tests GCP Secret Manager read
- `/api/mcp/token/generate` - Requires auth, tests GCP Secret Manager write
- `/api/v1/secrets/*` - Tests full GCP Secret Manager integration

**Expected Behavior:**
- All endpoints should work without authentication errors
- GCP Secret Manager operations should succeed
- No "permission denied" or "credentials not found" errors
- Token generation should work end-to-end




