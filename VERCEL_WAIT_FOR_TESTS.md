# Configure Vercel to Wait for Tests

This guide shows how to configure Vercel to wait for GitHub Actions tests to pass before deploying.

## Status Checks Created

The GitHub Actions workflow (`.github/workflows/test.yml`) creates these status checks:

- **`Tests / unit-tests`** - Unit tests (Jest)
- **`Tests / e2e-tests`** - E2E tests (Playwright) - may be skipped on feature branches
- **`Tests / test-summary`** - Overall test summary (waits for both above)

## Configuration Steps

### Option 1: GitHub Rulesets (Recommended - Modern Interface)

Vercel doesn't have a direct "wait for checks" setting. Instead, use GitHub's Rulesets (the modern branch protection interface):

1. **Go to GitHub Repository Settings:**
   - Visit: https://github.com/XDM-ZSBW/zip-mykeys-api/settings/rules
   - Or navigate: Repository → Settings → Rules → Rulesets

2. **Create New Branch Ruleset:**
   - Click **"New ruleset"** button
   - Select **"New branch ruleset"** from dropdown

3. **Configure Branch Targeting:**
   - Click **"Add target"** dropdown
   - Select **"Include by pattern"**
   - Enter pattern: `master` (or `main` if that's your default branch)
   - This adds the branch to the targeting criteria

4. **Ruleset name** (if prompted):
   - Enter: `Protect master branch` (or any descriptive name)

4. **Enable Required Status Checks:**
   - Under "Rules" section, find **"Require status checks to pass before merging"**
   - ✅ Enable this option
   - ✅ Enable **"Require branches to be up to date before merging"** (recommended)
   - Click **"Add status check"**
   - Search for and select:
     - `Tests / test-summary` (required - waits for all tests)
     - Optionally: `Tests / unit-tests` (for faster feedback)

5. **Optional Settings:**
   - ✅ **Do not allow bypassing the above settings** (prevents admins from skipping checks)
   - ✅ **Require pull request reviews before merging** (if you want code reviews)

6. **Save the Ruleset:**
   - Click **"Create ruleset"** or **"Save"**

**Note**: This protects the branch from merging PRs without tests passing. Since Vercel deploys from the protected branch, it effectively ensures deployments only happen after tests pass.

### Alternative: Legacy Branch Protection (If Rulesets Not Available)

If you see the older "Branch protection rules" interface instead:

1. Go to: https://github.com/XDM-ZSBW/zip-mykeys-api/settings/branches
2. Click **"Add rule"** or **"Add branch protection rule"**
3. Follow the same configuration steps above

### Option 2: Vercel Deployment Protection (Alternative)

If available in your Vercel plan:

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/xdmiq/zip-mykeys-api/settings/deployment-protection
   - Or navigate: Project → Settings → Deployment Protection

2. **Enable Protection:**
   - Look for "GitHub Actions" or "Status Checks" options
   - Enable and add required checks: `Tests / test-summary`

**Note**: This feature may only be available on certain Vercel plans (Pro/Enterprise).

## How It Works

### Before Configuration (Current Behavior)
```
Push to master
    ↓
    ├─→ GitHub Actions (tests) ──→ ✅/❌ Status check
    └─→ Vercel (build + deploy) ──→ 🚀 Live site (immediate)
```

### After Configuration (With Wait)
```
Push to master
    ↓
    ├─→ GitHub Actions (tests) ──→ ✅/❌ Status check
    └─→ Vercel (waits) ──→ ✅ Tests pass ──→ Build + Deploy ──→ 🚀 Live site
```

## Status Check Names

Vercel will look for these status check names:
- **Primary**: `Tests / test-summary` (recommended - waits for all tests)
- **Alternative**: `Tests / unit-tests` (faster, but skips E2E tests)

## Testing the Configuration

1. **Make a test commit:**
   ```bash
   git commit --allow-empty -m "test: verify Vercel waits for tests"
   git push origin master
   ```

2. **Check GitHub Actions:**
   - Go to: https://github.com/XDM-ZSBW/zip-mykeys-api/actions
   - Wait for tests to complete

3. **Check Vercel Dashboard:**
   - Go to: https://vercel.com/xdmiq/zip-mykeys-api/deployments
   - You should see:
     - Deployment status: "Waiting for checks..."
     - Then: "Building..." (after tests pass)
     - Or: "Canceled" (if tests fail)

## Troubleshooting

### Vercel Not Waiting

**Problem**: Vercel deploys immediately, ignoring tests.

**Solutions**:
1. **Verify GitHub Ruleset/Branch Protection is set up:**
   - Go to: https://github.com/XDM-ZSBW/zip-mykeys-api/settings/rules (Rulesets)
   - Or: https://github.com/XDM-ZSBW/zip-mykeys-api/settings/branches (Legacy)
   - Ensure `master` branch has a ruleset/protection rule with required status checks
   
2. **Check status check name matches exactly** (case-sensitive):
   - Status check must be: `Tests / test-summary` (exact match)
   - Verify in GitHub: Settings → Branches → master → Edit → Required status checks
   
3. **Ensure GitHub Actions workflow runs on the branch:**
   - Check `.github/workflows/test.yml` triggers on `master` branch
   - Push a commit and verify tests run in GitHub Actions
   
4. **Verify Vercel deploys from protected branch:**
   - Vercel Dashboard → Settings → Git
   - Ensure production branch is `master` (the protected branch)
   
5. **For direct pushes to master:**
   - Branch protection prevents merging PRs without tests
   - For direct pushes, tests run but Vercel may still deploy
   - Consider using GitHub's "Require status checks to pass before merging" + "Do not allow bypassing"

### Status Check Not Appearing

**Problem**: Vercel can't find the status check.

**Solutions**:
1. Push a commit to trigger the workflow
2. Wait for GitHub Actions to complete
3. Check status check name in GitHub: Settings → Branches → master → Edit
4. Verify workflow file is in `.github/workflows/test.yml`

### Tests Take Too Long

**Problem**: E2E tests slow down deployments.

**Solutions**:
1. Use only `Tests / unit-tests` as required check (faster)
2. Run E2E tests in parallel with deployment (disable wait)
3. Optimize E2E tests to run faster
4. Use E2E tests only on PRs, not on every push

### Feature Branch Deployments

**Note**: E2E tests are skipped on feature branch pushes (not master/main). This is intentional to speed up development.

If you want E2E tests on feature branches:
- Remove the `if` condition from `e2e-tests` job in `.github/workflows/test.yml`
- Or create a separate workflow for feature branches

## Recommended Configuration

For production:
- ✅ **Required**: `Tests / test-summary` (waits for all tests)
- ✅ **Wait for checks**: Enabled

For faster development:
- ✅ **Required**: `Tests / unit-tests` (faster feedback)
- ⚠️ **E2E tests**: Run in parallel (don't block deployment)

## Verification Checklist

After configuration, verify:

- [ ] GitHub branch protection rule created for `master` branch
- [ ] Required status check `Tests / test-summary` is added in GitHub
- [ ] Push a test commit and verify tests run in GitHub Actions
- [ ] Create a PR and verify it can't be merged until tests pass
- [ ] Verify Vercel only deploys from `master` after tests pass
- [ ] Test that failed tests block PR merging (and thus deployment)

## Current Status

- **Workflow**: ✅ Created (`.github/workflows/test.yml`)
- **Status Checks**: ✅ Automatic (created by GitHub Actions)
- **Vercel Configuration**: ⚠️ **Needs manual setup** (follow steps above)

---

**Last Updated**: 2025-11-30  
**Next Step**: Configure Vercel dashboard to wait for `Tests / test-summary` status check

