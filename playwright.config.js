// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for MyKeys.zip testing
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  
  /* Skip debug tests in CI (they're for local development only) */
  testMatch: process.env.CI 
    ? ['**/*.spec.js', '!**/debug-*.spec.js']
    : ['**/*.spec.js'],
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only - reduced to 1 for faster feedback */
  retries: process.env.CI ? 1 : 0,
  
  /* Run tests in parallel on CI - increase workers for faster execution */
  workers: process.env.CI ? 2 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run dev:marketing',
    url: process.env.CI ? 'http://localhost:8080' : 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000, // Reduced from 120s to 60s - server should start faster
    startupTimeout: 30 * 1000, // Wait up to 30s for server to be ready
  },
  
  /* Global test timeout */
  timeout: 30000,
  
  /* Expect timeout */
  expect: {
    timeout: 10000,
  },
});




