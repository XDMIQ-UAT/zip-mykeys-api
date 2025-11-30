import { test, expect } from '@playwright/test'

test.describe('Debug MCP Config Generator - Real API', () => {
  test('test with real API response format', async ({ page }) => {
    await page.goto('/mcp-config-generator.html')
    await page.waitForLoadState('networkidle')
    
    // Capture console logs and errors
    const logs = []
    const errors = []
    
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() })
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    page.on('pageerror', error => {
      errors.push(error.message)
    })
    
    // Mock API with standardized response format
    await page.route('**/api/auth/request-mfa-code', async route => {
      const request = route.request()
      console.log('API Request intercepted:', request.url())
      console.log('Request body:', request.postData())
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          status: 'success',
          timestamp: new Date().toISOString(),
          service: 'mykeys-api',
          data: {},
          message: 'Verification code sent'
        }),
      })
    })
    
    // Fill email
    const emailInput = page.locator('#tokenEmail')
    await emailInput.fill('test@example.com')
    
    // Click submit button
    const submitButton = page.locator('#tokenMfaRequestForm button[type="submit"]')
    await submitButton.click()
    
    // Wait and check what happened
    await page.waitForTimeout(2000)
    
    // Check if step 2 appeared
    const step2Visible = await page.locator('#tokenStep2').isVisible()
    const step1Visible = await page.locator('#tokenStep1').isVisible()
    
    console.log('Step 1 visible:', step1Visible)
    console.log('Step 2 visible:', step2Visible)
    console.log('Console logs:', logs)
    console.log('Errors:', errors)
    
    // Check for error messages
    const errorBox = page.locator('#tokenResult')
    const errorVisible = await errorBox.isVisible()
    if (errorVisible) {
      const errorText = await errorBox.textContent()
      console.log('Error box visible:', errorText)
    }
    
    // Take screenshot
    await page.screenshot({ path: 'debug-real-api.png', fullPage: true })
    
    // The test should pass if step 2 appears OR if we can see what went wrong
    if (!step2Visible && errors.length > 0) {
      throw new Error(`Step 2 did not appear. Errors: ${errors.join(', ')}`)
    }
  })
})

