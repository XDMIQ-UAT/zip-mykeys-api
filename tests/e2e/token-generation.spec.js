const { test, expect } = require('@playwright/test');

test.describe('Token Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/generate-token.html');
  });

  test('should display token generation form', async ({ page }) => {
    // Check that step 1 (partial password) is visible
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#partialPassword')).toBeVisible();
    await expect(page.locator('button:has-text("Verify Partial Password")')).toBeVisible();
  });

  test('should verify partial password and show step 2', async ({ page }) => {
    // Enter partial password
    await page.fill('#partialPassword', 'riddle-squiggle');
    await page.click('button:has-text("Verify Partial Password")');

    // Wait for verification
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });
    
    // Check that step 2 is visible
    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#clientId')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Token")')).toBeVisible();
    
    // Check success message (use specific selector to avoid ambiguity)
    await expect(page.locator('#resultTitle')).toBeVisible();
    await expect(page.locator('#resultTitle')).toContainText('Partial Password Verified');
  });

  test('should show error for invalid partial password', async ({ page }) => {
    // Enter invalid partial password
    await page.fill('#partialPassword', 'invalid-password');
    await page.click('button:has-text("Verify Partial Password")');

    // Wait for error message
    await page.waitForSelector('.token-result.error', { state: 'visible', timeout: 10000 });
    
    // Check error message
    await expect(page.locator('text=Verification Failed')).toBeVisible();
    await expect(page.locator('text=Partial password does not match')).toBeVisible();
  });

  test('should generate token with valid credentials', async ({ page }) => {
    // Step 1: Verify partial password
    await page.fill('#partialPassword', 'riddle-squiggle');
    await page.click('button:has-text("Verify Partial Password")');
    
    // Wait for step 2
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });
    
    // Step 2: Fill in token generation form
    await page.fill('#clientId', 'playwright-test');
    await page.check('#ecosystemAcknowledged');
    
    // Generate token
    await page.click('button:has-text("Generate Token")');
    
    // Wait for result (either success or error)
    await page.waitForSelector('.token-result', { state: 'visible', timeout: 15000 });
    
    // Check if we got a token or an error
    const resultTitle = page.locator('#resultTitle');
    const titleText = await resultTitle.textContent();
    
    if (titleText.includes('✅')) {
      // Success - check for token
      await expect(page.locator('text=Token Generated Successfully')).toBeVisible();
      await expect(page.locator('.token-value')).toBeVisible();
      
      // Verify token is not empty
      const tokenText = await page.locator('.token-value').textContent();
      expect(tokenText.length).toBeGreaterThan(0);
    } else {
      // Error - log it for debugging
      const errorMessage = await page.locator('#resultMessage').textContent();
      console.log('Token generation failed:', errorMessage);
      
      // This test will fail, but we'll see the actual error
      throw new Error(`Token generation failed: ${errorMessage}`);
    }
  });

  test('should require client ID before generating token', async ({ page }) => {
    // Step 1: Verify partial password
    await page.fill('#partialPassword', 'riddle-squiggle');
    await page.click('button:has-text("Verify Partial Password")');
    
    // Wait for step 2
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });
    
    // Try to generate without client ID
    await page.check('#ecosystemAcknowledged');
    await page.click('button:has-text("Generate Token")');
    
    // Should show alert or validation error
    // Note: This depends on your form validation implementation
    // If using HTML5 validation, the form won't submit
    const clientId = page.locator('#clientId');
    await expect(clientId).toHaveAttribute('required');
  });

  test('should allow going back to step 1', async ({ page }) => {
    // Step 1: Verify partial password
    await page.fill('#partialPassword', 'riddle-squiggle');
    await page.click('button:has-text("Verify Partial Password")');
    
    // Wait for step 2
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });
    
    // Click back button (actual text is "← Back to Step 1")
    await page.click('a.step-link:has-text("Back to Step 1")');
    
    // Should return to step 1
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).not.toBeVisible();
  });

  test('should show advanced options when toggled', async ({ page }) => {
    // Step 1: Verify partial password
    await page.fill('#partialPassword', 'riddle-squiggle');
    await page.click('button:has-text("Verify Partial Password")');
    
    // Wait for step 2
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });
    
    // Advanced options should be hidden initially
    await expect(page.locator('#advancedOptions')).not.toBeVisible();
    
    // Click toggle button (wait for it to be visible and enabled)
    const toggleButton = page.locator('button:has-text("Show Advanced Options")');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    
    // Wait a bit for the toggle animation/transition
    await page.waitForTimeout(100);
    
    // Advanced options should be visible
    await expect(page.locator('#advancedOptions')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#clientType')).toBeVisible();
    await expect(page.locator('#expiresInDays')).toBeVisible();
  });

  test('should show error when architect code is missing or expired', async ({ page }) => {
    // Navigate directly to step 2 without verifying password (simulating expired code)
    await page.evaluate(() => {
      document.getElementById('step1').style.display = 'none';
      document.getElementById('step2').style.display = 'block';
      const architectCodeInput = document.getElementById('architectCode');
      if (architectCodeInput) {
        architectCodeInput.value = ''; // Clear architect code
      }
    });
    
    // Fill in form
    await page.fill('#clientId', 'test-client');
    await page.check('#ecosystemAcknowledged');
    
    // Try to generate token without architect code
    await page.click('button:has-text("Generate Token")');
    
    // Wait for error message (could be alert or result box)
    // Check for alert first
    let errorFound = false;
    page.on('dialog', async dialog => {
      const message = dialog.message();
      if (message.match(/architect code|partial password|Authentication/i)) {
        errorFound = true;
      }
      await dialog.accept();
    });
    
    // Also wait for error result box
    try {
      await page.waitForSelector('.token-result.error, .token-result.show', { state: 'visible', timeout: 5000 });
      const errorText = await page.locator('#resultMessage').textContent();
      if (errorText && errorText.match(/Authentication|architect code|partial password/i)) {
        errorFound = true;
      }
    } catch (e) {
      // Error box might not appear if alert is shown instead
    }
    
    // Should have found error in either alert or error box
    expect(errorFound).toBe(true);
  });
});

