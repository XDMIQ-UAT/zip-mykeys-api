import { test, expect } from '@playwright/test';

test.describe('Debug Set Roles 500 Error', () => {
  test('Test setting roles and capture server errors', async ({ page }) => {
    await page.goto('http://localhost:8080/role-management.html');
    await page.waitForLoadState('networkidle');
    
    // Monitor API calls
    page.on('response', async response => {
      if (response.url().includes('/api/admin/roles') && response.request().method() === 'POST') {
        console.log(`\n📥 POST /api/admin/roles Response:`);
        console.log(`   Status: ${response.status()}`);
        const body = await response.json().catch(() => null);
        if (body) {
          console.log(`   Body:`, JSON.stringify(body, null, 2));
        }
      }
    });
    
    // Check if signed in
    const signInButton = page.locator('button:has-text("Sign in with Google")');
    const isSignedIn = !(await signInButton.isVisible().catch(() => false));
    
    if (!isSignedIn) {
      console.log('⚠️  Please sign in with Google first, then run this test again');
      await page.waitForTimeout(5000);
      return;
    }
    
    // Click Set Roles
    const setRolesButton = page.locator('button:has-text("Set Roles")');
    if (await setRolesButton.isVisible().catch(() => false)) {
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/admin/roles') && resp.request().method() === 'POST', { timeout: 10000 }).catch(() => null),
        setRolesButton.click()
      ]);
      
      if (response) {
        console.log(`\n✅ Test complete. Status: ${response.status()}`);
        if (response.status() === 500) {
          console.log(`❌ 500 Error - Check server console for details`);
        }
      }
    }
    
    await page.waitForTimeout(2000);
  });
});


