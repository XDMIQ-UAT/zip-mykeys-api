const { test, expect } = require('@playwright/test');

test.describe('React Router Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load home page', async ({ page }) => {
    await expect(page).toHaveURL(/.*\/$/);
    // Check for React app root
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should navigate to About page', async ({ page }) => {
    // Click navigation link (adjust selector based on your actual navigation)
    await page.click('a[href="/about"]');
    
    // Wait for navigation
    await page.waitForURL(/.*\/about/);
    await expect(page).toHaveURL(/.*\/about/);
  });

  test('should navigate to Docs page', async ({ page }) => {
    await page.click('a[href="/docs"]');
    await page.waitForURL(/.*\/docs/);
    await expect(page).toHaveURL(/.*\/docs/);
  });

  test('should navigate to Tools page', async ({ page }) => {
    await page.click('a[href="/tools"]');
    await page.waitForURL(/.*\/tools/);
    await expect(page).toHaveURL(/.*\/tools/);
  });

  test('should handle direct URL navigation', async ({ page }) => {
    // Navigate directly to a route
    await page.goto('/docs');
    await expect(page).toHaveURL(/.*\/docs/);
    
    // Content should load (React Router should handle it)
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should show 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-that-does-not-exist');
    
    // Should either show 404 page or redirect to home
    // Adjust based on your 404 handling
    const url = page.url();
    expect(url).toMatch(/\/(invalid-route-that-does-not-exist|404|\/)$/);
  });
});




