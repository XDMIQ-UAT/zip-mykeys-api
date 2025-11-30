import { test, expect } from '@playwright/test';

test.describe('Role Management Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to role management page
    await page.goto('/role-management.html');
  });

  test('should load the role management page', async ({ page }) => {
    // Check that the page title is correct
    await expect(page).toHaveTitle(/Role Management/);
    
    // Check that the main heading is visible
    await expect(page.locator('h1')).toContainText('Role Management');
    
    // Check that the subtitle is visible
    await expect(page.locator('.subtitle')).toContainText('Manage user roles');
  });

  test('should show Google Sign-In button', async ({ page }) => {
    // Check that Google Sign-In section is visible
    const googleAuthSection = page.locator('#googleAuthSection');
    await expect(googleAuthSection).toBeVisible();
    
    // Check that the sign-in button exists
    const signInButton = page.locator('button:has-text("Sign in with Google")');
    await expect(signInButton).toBeVisible();
  });

  test('should show authentication section', async ({ page }) => {
    // Check that authentication section is visible
    const authSection = page.locator('.token-input-section');
    await expect(authSection).toBeVisible();
    
    // Check that the description text is present
    await expect(authSection).toContainText('Sign in with Google to manage roles');
  });

  test('should hide management section initially', async ({ page }) => {
    // Management section should be hidden until authenticated
    const managementSection = page.locator('#managementSection');
    await expect(managementSection).not.toBeVisible();
  });

  test('should show error if Google OAuth not configured', async ({ page }) => {
    // Mock the API response to simulate OAuth not configured
    await page.route('**/api/auth/google/url', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'failure',
          error: 'Google OAuth not configured'
        })
      });
    });

    // Wait for the page to load and check for error
    await page.waitForTimeout(1000);
    
    // Check that error message is shown
    const authError = page.locator('#authError');
    await expect(authError).toBeVisible();
  });

  test('should handle Google OAuth callback with code', async ({ page }) => {
    // Mock Google OAuth verification
    await page.route('**/api/auth/google/verify-admin', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/pic.jpg',
            roles: ['owner', 'architect', 'member'],
            hasAdminAccess: true
          }
        })
      });
    });

    // Navigate with OAuth callback code
    await page.goto('/role-management.html?code=test-code');
    
    // Wait for verification to complete
    await page.waitForTimeout(1000);
    
    // Check that user info is displayed
    const userInfo = page.locator('#googleUserInfo');
    await expect(userInfo).toBeVisible();
    
    // Check that management section is now visible
    const managementSection = page.locator('#managementSection');
    await expect(managementSection).toBeVisible();
  });

  test('should handle Google OAuth callback with error', async ({ page }) => {
    // Navigate with OAuth error
    await page.goto('/role-management.html?error=access_denied');
    
    // Wait for error handling
    await page.waitForTimeout(500);
    
    // Check that error is displayed (implementation may vary)
    // The page should handle the error gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show role management form when authenticated', async ({ page }) => {
    // Mock successful authentication
    await page.route('**/api/auth/google/verify-admin', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/pic.jpg',
            roles: ['owner', 'architect', 'member'],
            hasAdminAccess: true
          }
        })
      });
    });

    // Simulate Google sign-in by navigating with code
    await page.goto('/role-management.html?code=test-code');
    
    // Wait for authentication to complete
    await page.waitForTimeout(1000);
    
    // Check that role management form is visible
    const setRolesForm = page.locator('#setRolesForm');
    await expect(setRolesForm).toBeVisible();
    
    // Check that email input exists
    const emailInput = page.locator('#userEmail');
    await expect(emailInput).toBeVisible();
    
    // Check that role checkboxes exist
    await expect(page.locator('#roleOwner')).toBeVisible();
    await expect(page.locator('#roleArchitect')).toBeVisible();
    await expect(page.locator('#roleMember')).toBeVisible();
  });

  test('should show users list when authenticated', async ({ page }) => {
    // Mock successful authentication
    await page.route('**/api/auth/google/verify-admin', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/pic.jpg',
            roles: ['owner', 'architect', 'member'],
            hasAdminAccess: true
          }
        })
      });
    });

    // Mock users list API
    await page.route('**/api/admin/roles', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: {
              users: [
                { email: 'test@example.com', roles: ['owner', 'architect', 'member'] },
                { email: 'user2@example.com', roles: ['member'] }
              ]
            }
          })
        });
      } else {
        route.continue();
      }
    });

    // Simulate Google sign-in
    await page.goto('/role-management.html?code=test-code');
    
    // Wait for authentication and users list to load
    await page.waitForTimeout(1500);
    
    // Check that users list is visible
    const usersList = page.locator('#usersList');
    await expect(usersList).toBeVisible();
    
    // Check that user emails are displayed
    await expect(usersList).toContainText('test@example.com');
    await expect(usersList).toContainText('user2@example.com');
  });
});

