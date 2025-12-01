const { test, expect } = require('@playwright/test');

const MYKEYS_URL = process.env.BASE_URL || 'https://mykeys.zip';
const TEST_EMAIL = process.env.TEST_EMAIL || 'bcherrman@gmail.com';

test.describe('Generate Token - Email MFA Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${MYKEYS_URL}/generate-token.html`);
  });

  test('should display step 1 email form', async ({ page }) => {
    // Check that step 1 (email request) is visible
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('button:has-text("Send Verification Code")')).toBeVisible();
    await expect(page.locator('#step2')).not.toBeVisible();
  });

  test('should request verification code and show step 2', async ({ page }) => {
    // Mock the API response for requesting code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          method: 'email',
          target: TEST_EMAIL,
          expiresIn: 600,
          message: '4-digit verification code sent to email.'
        })
      });
    });

    // Enter email and request code
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Send Verification Code")');

    // Wait for step 2 to appear
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });
    
    // Verify step 2 is visible
    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#mfaCode')).toBeVisible();
    await expect(page.locator('#clientId')).toBeVisible();
    await expect(page.locator('button:has-text("Verify Code & Generate Token")')).toBeVisible();
    
    // Verify success message
    await expect(page.locator('text=Verification code sent!')).toBeVisible();
    await expect(page.locator(`text=Check your email for the 4-digit code sent to ${TEST_EMAIL}`)).toBeVisible();
  });

  test('should show error if email request fails', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to send verification code',
          details: 'Email service unavailable'
        })
      });
    });

    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Send Verification Code")');

    // Wait for error message
    await page.waitForSelector('.token-result.error', { state: 'visible', timeout: 10000 });
    
    // Verify error state
    await expect(page.locator('#resultTitle')).toContainText('Failed to Send Code');
    await expect(page.locator('.token-result.error')).toBeVisible();
    await expect(page.locator('.token-result.success')).not.toBeVisible();
  });

  test('should verify code and generate token successfully', async ({ page }) => {
    const mockCode = '1234';
    const mockToken = 'test-token-12345';

    // Mock request code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          method: 'email',
          target: TEST_EMAIL
        })
      });
    });

    // Mock verify code and generate token
    await page.route('**/api/auth/verify-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: mockToken,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        })
      });
    });

    // Step 1: Request code
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Send Verification Code")');
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });

    // Step 2: Verify code and generate token
    await page.fill('#mfaCode', mockCode);
    await page.fill('#clientId', 'test-client');
    await page.check('#ecosystemAcknowledged');
    await page.click('button:has-text("Verify Code & Generate Token")');

    // Wait for success result
    await page.waitForSelector('.token-result.success', { state: 'visible', timeout: 15000 });
    
    // Verify success state - CRITICAL: Check that error class is NOT present
    await expect(page.locator('.token-result.success')).toBeVisible();
    await expect(page.locator('.token-result.error')).not.toBeVisible();
    await expect(page.locator('#resultTitle')).toContainText('Token Generated Successfully');
    await expect(page.locator('.token-value')).toContainText(mockToken);
    
    // Verify step 2 is hidden
    await expect(page.locator('#step2')).not.toBeVisible();
  });

  test('should show error if verification code is invalid', async ({ page }) => {
    // Mock request code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          method: 'email',
          target: TEST_EMAIL
        })
      });
    });

    // Mock verify code failure
    await page.route('**/api/auth/verify-mfa-code', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid verification code'
        })
      });
    });

    // Step 1: Request code
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Send Verification Code")');
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });

    // Step 2: Try with invalid code
    await page.fill('#mfaCode', '9999');
    await page.fill('#clientId', 'test-client');
    await page.check('#ecosystemAcknowledged');
    await page.click('button:has-text("Verify Code & Generate Token")');

    // Wait for error result
    await page.waitForSelector('.token-result.error', { state: 'visible', timeout: 15000 });
    
    // Verify error state - CRITICAL: Check that success class is NOT present
    await expect(page.locator('.token-result.error')).toBeVisible();
    await expect(page.locator('.token-result.success')).not.toBeVisible();
    await expect(page.locator('#resultTitle')).toContainText('Verification Failed');
    await expect(page.locator('#resultMessage')).toContainText('Invalid verification code');
  });

  test('should properly clear error state when showing success', async ({ page }) => {
    const mockCode = '1234';
    const mockToken = 'test-token-12345';

    // Mock request code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          method: 'email',
          target: TEST_EMAIL
        })
      });
    });

    // First, trigger an error
    await page.route('**/api/auth/verify-mfa-code', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid verification code'
        })
      });
    });

    // Step 1: Request code
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Send Verification Code")');
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });

    // Step 2: Try with invalid code (should show error)
    await page.fill('#mfaCode', '9999');
    await page.fill('#clientId', 'test-client');
    await page.check('#ecosystemAcknowledged');
    await page.click('button:has-text("Verify Code & Generate Token")');
    await page.waitForSelector('.token-result.error', { state: 'visible', timeout: 15000 });
    
    // Verify error is shown
    await expect(page.locator('.token-result.error')).toBeVisible();
    await expect(page.locator('.token-result.success')).not.toBeVisible();

    // Now mock success and try again
    await page.route('**/api/auth/verify-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: mockToken,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        })
      });
    });

    // Try again with valid code
    await page.fill('#mfaCode', mockCode);
    await page.click('button:has-text("Verify Code & Generate Token")');

    // Wait for success result
    await page.waitForSelector('.token-result.success', { state: 'visible', timeout: 15000 });
    
    // CRITICAL TEST: Verify error class is completely removed
    const tokenResult = page.locator('.token-result');
    const classes = await tokenResult.getAttribute('class');
    expect(classes).not.toContain('error');
    expect(classes).toContain('success');
    
    // Verify success message is shown, not error message
    await expect(page.locator('#resultTitle')).toContainText('Token Generated Successfully');
    await expect(page.locator('#resultTitle')).not.toContainText('Verification Failed');
  });

  test('should require client ID before generating token', async ({ page }) => {
    // Mock request code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          method: 'email',
          target: TEST_EMAIL
        })
      });
    });

    // Step 1: Request code
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Send Verification Code")');
    await page.waitForSelector('#step2', { state: 'visible', timeout: 10000 });

    // Try to submit without client ID
    await page.fill('#mfaCode', '1234');
    await page.check('#ecosystemAcknowledged');
    
    // Client ID is required, so form shouldn't submit
    const clientId = page.locator('#clientId');
    await expect(clientId).toHaveAttribute('required');
  });
});


