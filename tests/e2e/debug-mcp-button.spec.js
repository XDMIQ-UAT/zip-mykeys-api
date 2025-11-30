import { test, expect } from '@playwright/test'

test.describe('Debug MCP Config Generator Button', () => {
  test('debug send verification button', async ({ page }) => {
    await page.goto('/mcp-config-generator.html')
    await page.waitForLoadState('networkidle')
    
    // Check if form exists
    const form = page.locator('#tokenMfaRequestForm')
    await expect(form).toBeVisible()
    
    // Check if email input exists
    const emailInput = page.locator('#tokenEmail')
    await expect(emailInput).toBeVisible()
    
    // Check if submit button exists
    const submitButton = page.locator('#tokenMfaRequestForm button[type="submit"]')
    await expect(submitButton).toBeVisible()
    
    // Log button details
    const buttonText = await submitButton.textContent()
    console.log('Button text:', buttonText)
    console.log('Button is visible:', await submitButton.isVisible())
    console.log('Button is enabled:', await submitButton.isEnabled())
    
    // Check if form has event listeners by trying to intercept
    let formSubmitted = false
    await page.on('request', request => {
      if (request.url().includes('/api/auth/request-mfa-code')) {
        formSubmitted = true
        console.log('Form submitted! Request URL:', request.url())
      }
    })
    
    // Fill email
    await emailInput.fill('test@example.com')
    
    // Try clicking the button
    console.log('Clicking button...')
    await submitButton.click()
    
    // Wait a bit to see if form submits
    await page.waitForTimeout(1000)
    
    // Check console for errors
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log('Console error:', msg.text())
      }
    })
    
    // Check if form was submitted
    if (!formSubmitted) {
      console.log('Form was NOT submitted!')
      
      // Try alternative methods
      console.log('Trying form.submit()...')
      await form.evaluate(form => form.submit())
      await page.waitForTimeout(1000)
      
      if (!formSubmitted) {
        console.log('Form.submit() also did not work')
        
        // Check if there are any JavaScript errors
        const jsErrors = await page.evaluate(() => {
          return window.errors || []
        })
        console.log('JavaScript errors:', jsErrors)
      }
    }
    
    // Mock API response for testing
    await page.route('**/api/auth/request-mfa-code', async route => {
      console.log('API route intercepted!')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    
    // Try again with mocked API
    await emailInput.fill('test2@example.com')
    await submitButton.click()
    
    // Wait for step 2 to appear
    try {
      await expect(page.locator('#tokenStep2')).toBeVisible({ timeout: 3000 })
      console.log('SUCCESS: Step 2 appeared!')
    } catch (e) {
      console.log('FAILED: Step 2 did not appear')
      console.log('Error:', e.message)
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-button-failure.png', fullPage: true })
    }
  })
})

