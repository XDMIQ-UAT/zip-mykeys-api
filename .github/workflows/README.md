# GitHub Actions CI/CD Setup

## Overview

This repository uses a **hybrid CI/CD approach**:

- **GitHub Actions**: Runs tests (CI) - catches issues before deployment
- **Vercel**: Builds and deploys (CD) - automatic deployments via connected repository

## No Duplicate Builds

✅ **GitHub Actions does NOT build or deploy** - it only runs tests  
✅ **Vercel handles all builds and deployments** via connected repository  
✅ **No conflicts** - they serve different purposes

## Workflow: `.github/workflows/test.yml`

### Triggers
- **Push to `master`/`main`**: Runs unit tests + E2E tests
- **Pull Requests**: Runs unit tests + E2E tests
- **Feature branch pushes**: Only unit tests (E2E skipped for speed)

### Jobs

1. **Unit Tests** (`unit-tests`)
   - Runs on every push/PR
   - Fast feedback (< 1 minute typically)
   - Uses Jest to test individual functions/modules

2. **E2E Tests** (`e2e-tests`)
   - Runs on PRs and main/master pushes only
   - Slower but comprehensive (~5-10 minutes)
   - Uses Playwright to test full application flow
   - Starts local server and tests against it

3. **Test Summary** (`test-summary`)
   - Aggregates results from both test jobs
   - Fails if any tests fail

### Test Artifacts

- Unit test results: Uploaded to GitHub Actions artifacts
- E2E test results: Playwright HTML report uploaded
- Retention: 7 days

## Integration with Vercel

### How It Works

1. **Developer pushes code** → Triggers both:
   - GitHub Actions (tests)
   - Vercel webhook (build + deploy)

2. **Tests run in parallel** with Vercel build:
   - If tests fail → GitHub Actions shows failure (but Vercel still deploys)
   - If tests pass → Green checkmark on commit

3. **Vercel deployment**:
   - Always happens (connected repository)
   - Independent of test results
   - Fast feedback loop

### Require Tests Before Deploy

**📖 See detailed guide**: [`VERCEL_WAIT_FOR_TESTS.md`](../VERCEL_WAIT_FOR_TESTS.md)

Quick setup:
1. Go to Vercel Dashboard → Project Settings → Git
2. Enable **"Wait for GitHub Actions checks"**
3. Add required status check: **`Tests / test-summary`**

**Status checks created:**
- `Tests / unit-tests` - Unit tests (Jest)
- `Tests / e2e-tests` - E2E tests (Playwright)
- `Tests / test-summary` - Overall summary (recommended for Vercel wait)

## Environment Variables

Tests use minimal environment variables:
- `KV_REST_API_URL`: Optional (tests should mock external services)
- `KV_REST_API_TOKEN`: Optional (tests should mock external services)

For E2E tests, add these as GitHub Secrets if needed:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

## Local Testing

Run tests locally before pushing:

```bash
# Unit tests only
npm run test:unit

# E2E tests only
npm test

# Both
npm run test:all
```

## Troubleshooting

### Tests Fail in CI but Pass Locally

1. Check environment differences
2. Verify Node.js version matches (18.x)
3. Check for missing dependencies
4. Review test logs in GitHub Actions

### E2E Tests Timeout

- Increase timeout in `playwright.config.js`
- Check server startup time
- Verify `BASE_URL` is correct

### Vercel Builds Before Tests Complete

This is expected behavior. Tests run in parallel with Vercel builds. If you want sequential execution, enable "Wait for GitHub Actions checks" in Vercel settings.

