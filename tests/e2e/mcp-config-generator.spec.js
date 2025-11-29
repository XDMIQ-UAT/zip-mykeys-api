import { test, expect } from '@playwright/test'

test.describe('MCP Config Generator - Email MFA Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Access via dev server (now that file is copied to marketing-site/public/)
    await page.goto('/mcp-config-generator.html')
    await page.waitForLoadState('networkidle')
  })

  test('should load the MCP Config Generator page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MCP Configuration Generator')
    await expect(page.locator('.subtitle')).toContainText('Generate Cursor/Warp MCP configuration')
  })

  test('should show workflow steps', async ({ page }) => {
    await expect(page.locator('.workflow-step').first()).toContainText('Generate Token')
    await expect(page.locator('.workflow-step').nth(1)).toContainText('Configuration')
  })

  test('should start with email MFA flow', async ({ page }) => {
    // Unified flow - email input should be visible immediately in config tab
    await expect(page.locator('#tokenEmail')).toBeVisible()
    await expect(page.locator('#tokenEmail')).toHaveAttribute('type', 'email')
    
    // Should NOT show username/password fields
    await expect(page.locator('#username')).toHaveCount(0)
    await expect(page.locator('#password')).toHaveCount(0)
    
    // Config form should be hidden initially
    await expect(page.locator('#configFormSection')).not.toBeVisible()
  })

  test('should request verification code via email', async ({ page }) => {
    // Mock the API response
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    
    // Fill in email
    await page.fill('#tokenEmail', 'test@example.com')
    
    // Submit form - wait for button to be ready
    const submitButton = page.locator('#tokenMfaRequestForm button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await submitButton.click()
    
    // Wait for step 2 (verification code input) to appear
    await expect(page.locator('#tokenStep2')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#tokenMfaCode')).toBeVisible()
    await expect(page.locator('#tokenCodeSentMessage')).toContainText('Check your email')
  })

  test('should generate token after verification', async ({ page }) => {
    // Mock step 1: request code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    
    await page.fill('#tokenEmail', 'test@example.com')
    await page.click('#tokenMfaRequestForm button[type="submit"]')
    
    // Wait for step 2
    await expect(page.locator('#tokenStep2')).toBeVisible({ timeout: 5000 })
    
    // Mock step 2: verify code and generate token
    await page.route('**/api/auth/verify-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'test-token-12345',
          expiresAt: new Date().toISOString(),
        }),
      })
    })
    
    // Fill verification form
    await page.fill('#tokenMfaCode', '1234')
    await page.fill('#tokenClientId', 'test-client')
    await page.check('#tokenEcosystemAcknowledged')
    
    // Submit
    await page.click('#tokenForm button[type="submit"]')
    
    // Should hide token generation section and show config form
    await expect(page.locator('#tokenGenerationSection')).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('#configFormSection')).toBeVisible()
    await expect(page.locator('#mcpToken')).toHaveValue('test-token-12345')
  })

  test('should have resend code functionality', async ({ page }) => {
    // Mock request code
    await page.route('**/api/auth/request-mfa-code', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    
    await page.fill('#tokenEmail', 'test@example.com')
    await page.click('#tokenMfaRequestForm button[type="submit"]')
    
    // Wait for step 2
    await expect(page.locator('#tokenStep2')).toBeVisible({ timeout: 5000 })
    
    // Should show resend button
    await expect(page.locator('button:has-text("Resend Code")')).toBeVisible()
    
    // Click resend
    await page.click('button:has-text("Resend Code")')
    
    // Should go back to step 1
    await expect(page.locator('#tokenStep1')).toBeVisible()
    await expect(page.locator('#tokenStep2')).not.toBeVisible()
    // Config form should be hidden
    await expect(page.locator('#configFormSection')).not.toBeVisible()
  })
})

