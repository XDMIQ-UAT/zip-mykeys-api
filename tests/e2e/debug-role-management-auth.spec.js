import { test, expect } from '@playwright/test';

test.describe('Role Management Authentication Debug', () => {
  test('Debug authentication flow and setRoles API call', async ({ page }) => {
    // Navigate to role management page
    await page.goto('http://localhost:8080/role-management.html');
    
    console.log('📋 Page loaded');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    
    // Check if Google Sign-In button is visible
    const signInButton = page.locator('button:has-text("Sign in with Google")');
    const isSignInVisible = await signInButton.isVisible().catch(() => false);
    console.log(`🔍 Sign-In button visible: ${isSignInVisible}`);
    
    // Monitor network requests
    const requests = [];
    const responses = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
        console.log(`📤 Request: ${request.method()} ${request.url()}`);
        console.log(`   Headers:`, JSON.stringify(request.headers(), null, 2));
        if (request.postData()) {
          console.log(`   Body:`, request.postData());
        }
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
        console.log(`📥 Response: ${response.status()} ${response.url()}`);
      }
    });
    
    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });
    
    // Try to interact with the form
    const emailInput = page.locator('#userEmail[type="email"]');
    const setRolesButton = page.locator('button:has-text("Set Roles")');
    
    // Check if email is pre-filled
    const emailValue = await emailInput.inputValue().catch(() => '');
    console.log(`📧 Email input value: ${emailValue}`);
    
    // Check if roles checkboxes are visible
    const ownerCheckbox = page.locator('#roleOwner');
    const architectCheckbox = page.locator('#roleArchitect');
    const memberCheckbox = page.locator('#roleMember');
    
    const ownerChecked = await ownerCheckbox.isChecked().catch(() => false);
    const architectChecked = await architectCheckbox.isChecked().catch(() => false);
    const memberChecked = await memberCheckbox.isChecked().catch(() => false);
    
    console.log(`☑️  Owner checked: ${ownerChecked}`);
    console.log(`☑️  Architect checked: ${architectChecked}`);
    console.log(`☑️  Member checked: ${memberChecked}`);
    
    // Check for error messages
    const errorBox = page.locator('.result-box.error, .error');
    const errorVisible = await errorBox.isVisible().catch(() => false);
    if (errorVisible) {
      const errorText = await errorBox.textContent().catch(() => '');
      console.log(`❌ Error visible: ${errorText}`);
    }
    
    // Check JavaScript variables
    const googleCredential = await page.evaluate(() => {
      return window.googleCredential || 'not set';
    });
    const googleUserInfo = await page.evaluate(() => {
      return window.googleUserInfo || 'not set';
    });
    
    console.log(`🔑 googleCredential: ${typeof googleCredential === 'string' ? googleCredential.substring(0, 20) + '...' : googleCredential}`);
    console.log(`👤 googleUserInfo: ${typeof googleUserInfo === 'object' ? JSON.stringify(googleUserInfo).substring(0, 100) : googleUserInfo}`);
    
    // Try clicking Set Roles button and capture the API call
    if (await setRolesButton.isVisible().catch(() => false)) {
      console.log(`\n🔍 Attempting to click "Set Roles" button...`);
      
      // Wait for any API calls after clicking
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/admin/roles') && resp.request().method() === 'POST', { timeout: 5000 }).catch(() => null),
        setRolesButton.click()
      ]);
      
      if (response) {
        console.log(`\n📥 API Response received:`);
        console.log(`   Status: ${response.status()}`);
        const responseBody = await response.json().catch(() => null);
        console.log(`   Body:`, JSON.stringify(responseBody, null, 2));
        
        const request = response.request();
        console.log(`\n📤 API Request details:`);
        console.log(`   URL: ${request.url()}`);
        console.log(`   Method: ${request.method()}`);
        console.log(`   Headers:`, JSON.stringify(request.headers(), null, 2));
        const postData = request.postData();
        if (postData) {
          console.log(`   Body:`, postData);
        }
      } else {
        console.log(`⚠️  No API response received within 5 seconds`);
      }
      
      // Wait a bit for error message to appear
      await page.waitForTimeout(1000);
      
      const errorAfterClick = await errorBox.isVisible().catch(() => false);
      if (errorAfterClick) {
        const errorTextAfter = await errorBox.textContent().catch(() => '');
        console.log(`\n❌ Error after click: ${errorTextAfter}`);
      }
    }
    
    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`   Total API requests: ${requests.length}`);
    console.log(`   Total API responses: ${responses.length}`);
    console.log(`   googleCredential set: ${googleCredential !== 'not set'}`);
    console.log(`   googleUserInfo set: ${googleUserInfo !== 'not set'}`);
    
    // Keep page open for inspection
    await page.waitForTimeout(2000);
  });
});

