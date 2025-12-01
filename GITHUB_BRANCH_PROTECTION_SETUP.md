# GitHub Branch Protection Setup - Quick Guide

This is a quick reference for setting up GitHub branch protection to ensure Vercel waits for tests.

## Quick Steps

1. **Go to GitHub:**
   ```
   https://github.com/XDM-ZSBW/zip-mykeys-api/settings/rules
   ```
   Or navigate: Repository → Settings → Rules → Rulesets

2. **Click "New ruleset"** → Select **"New branch ruleset"**

3. **Configure Branch Targeting:**
   - Click **"Add target"** dropdown
   - Select **"Include by pattern"**
   - Enter pattern: `master` (or `main` if that's your default branch)
   - This will add the branch to the targeting criteria

4. **Ruleset name** (if prompted):
   - Enter: `Protect master branch` (or any descriptive name)

4. **Under "Rules" section, enable:**
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging** (recommended)

5. **Add required status checks:**
   - Click "Add status check"
   - Search for: `Tests / test-summary`
   - Select it (it will appear after the first workflow run)

6. **Optional but recommended:**
   - ✅ **Do not allow bypassing the above settings**
   - ✅ **Require pull request reviews before merging** (if you want code reviews)

7. **Click "Create ruleset"** or **"Save"**

## How It Works

```
Developer creates PR
    ↓
GitHub Actions runs tests
    ↓
Tests must pass ✅
    ↓
PR can be merged
    ↓
Merge to master
    ↓
Vercel deploys (from master branch)
```

## Testing

1. Create a test PR:
   ```bash
   git checkout -b test-branch
   git commit --allow-empty -m "test: verify branch protection"
   git push origin test-branch
   ```

2. Create PR on GitHub

3. Verify:
   - PR shows "Required: Tests / test-summary" status check
   - PR cannot be merged until check passes
   - After merge, Vercel deploys from master

## Status Check Names

After first workflow run, these checks will be available:
- `Tests / unit-tests`
- `Tests / e2e-tests`  
- `Tests / test-summary` ← **Use this one**

## Troubleshooting

**Status check not appearing?**
- Push a commit to trigger the workflow first
- Wait for GitHub Actions to complete
- Then go back to ruleset settings and refresh

**Can't find the setting?**
- Make sure you have admin access to the repository
- Check you're in Settings → Rules → Rulesets (or Settings → Branches for legacy)
- If you see "Rulesets" page, use that (newer interface)
- If you see "Branch protection rules", use that (legacy interface)

**Which interface am I using?**
- **Rulesets** (newer): Shows "New ruleset" button with dropdown
- **Branch protection** (legacy): Shows "Add rule" or "Add branch protection rule" button

