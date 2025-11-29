# Playwright E2E Tests

End-to-end tests for MyKeys.zip using Playwright.

## Running Tests

### Run all tests
```bash
npm test
```

### Run with UI (interactive)
```bash
npm run test:ui
```

### Run in debug mode
```bash
npm run test:debug
```

### Run in headed mode (see browser)
```bash
npm run test:headed
```

### View test report
```bash
npm run test:report
```

## Test Structure

- `e2e/token-generation.spec.js` - Token generation flow tests
- `e2e/navigation.spec.js` - React Router navigation tests
- `e2e/api-endpoints.spec.js` - API endpoint tests

## Configuration

Tests use `playwright.config.js` for configuration. Default base URL is `https://mykeys.zip` but can be overridden with `BASE_URL` environment variable:

```bash
BASE_URL=http://localhost:8080 npm test
```

## CI/CD

Tests run automatically on push/PR via GitHub Actions (`.github/workflows/playwright.yml`).

## Writing New Tests

See Playwright documentation: https://playwright.dev/docs/intro

Example:
```javascript
const { test, expect } = require('@playwright/test');

test('my test', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('MyKeys');
});
```




