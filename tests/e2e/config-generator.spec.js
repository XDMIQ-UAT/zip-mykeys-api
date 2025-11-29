const { test, expect } = require('@playwright/test');

test.describe('MCP Config Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://mykeys.zip/mcp-config-generator.html');
    // Wait for page to load
    await expect(page.locator('h1')).toHaveText('🔧 MCP Configuration Generator');
  });

  test('should display config form', async ({ page }) => {
    await expect(page.locator('#mcpToken')).toBeVisible();
    await expect(page.locator('#clientId')).toBeVisible();
    await expect(page.locator('#serverSource')).toBeVisible();
    await expect(page.locator('#serverPath')).toBeVisible();
  });

  test('should auto-populate path when "Download from mykeys.zip" is selected', async ({ page }) => {
    // Check initial state
    const serverSource = page.locator('#serverSource');
    await expect(serverSource).toBeVisible();
    
    // Check if "hosted" is selected by default or select it
    const currentValue = await serverSource.inputValue();
    console.log('Current serverSource value:', currentValue);
    
    // Select "hosted" option
    await serverSource.selectOption('hosted');
    await page.waitForTimeout(500); // Wait for updateServerPath to run
    
    // Check if path is populated
    const serverPath = page.locator('#serverPath');
    const pathValue = await serverPath.inputValue();
    console.log('Server path value after selecting hosted:', pathValue);
    
    // Path should not be empty
    expect(pathValue).not.toBe('');
    expect(pathValue).toMatch(/mcp-server\.js/);
  });

  test('should show error when submitting without token', async ({ page }) => {
    // Fill in other fields but not token
    await page.fill('#clientId', 'test-client');
    await page.selectOption('#clientType', 'cursor');
    
    // Select hosted source
    await page.selectOption('#serverSource', 'hosted');
    await page.waitForTimeout(500);
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Should show HTML5 validation error for required token field
    const tokenInput = page.locator('#mcpToken');
    const isInvalid = await tokenInput.evaluate((el) => el.validity.valid === false);
    expect(isInvalid).toBe(true);
  });

  test('should generate config with hosted option', async ({ page }) => {
    // Fill in token (using a test token)
    await page.fill('#mcpToken', 'test-token-123456789012345678901234567890123456789012345678901234567890');
    await page.fill('#clientId', 'test-client');
    await page.selectOption('#clientType', 'cursor');
    
    // Select hosted source
    await page.selectOption('#serverSource', 'hosted');
    await page.waitForTimeout(500); // Wait for path to populate
    
    // Check path is populated
    const serverPath = page.locator('#serverPath');
    const pathValue = await serverPath.inputValue();
    console.log('Path value before submit:', pathValue);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for result to appear
    await page.waitForSelector('#configResult.show', { timeout: 5000 });
    
    // Check that config was generated
    const configOutput = page.locator('#configOutput');
    await expect(configOutput).toBeVisible();
    
    const configText = await configOutput.textContent();
    console.log('Generated config:', configText);
    
    // Should contain MCP server configuration
    expect(configText).toContain('mykeys-zip');
    expect(configText).toContain('MCP_TOKEN');
    expect(configText).toContain('test-token');
  });

  test('should show download instructions for hosted option', async ({ page }) => {
    // Select hosted source
    await page.selectOption('#serverSource', 'hosted');
    await page.waitForTimeout(500);
    
    // Check help text
    const helpText = page.locator('#serverPathHelp');
    const helpContent = await helpText.textContent();
    console.log('Help text content:', helpContent);
    
    expect(helpContent).toContain('mykeys.zip/mcp-server.js');
    // Check for download instructions (may be in different format)
    expect(helpContent).toMatch(/Download|download|Instructions|instructions/);
  });

  test('should allow switching between hosted and local', async ({ page }) => {
    // Start with hosted
    await page.selectOption('#serverSource', 'hosted');
    await page.waitForTimeout(500);
    
    const pathValue1 = await page.locator('#serverPath').inputValue();
    console.log('Path value (hosted):', pathValue1);
    expect(pathValue1).not.toBe('');
    
    // Switch to local
    await page.selectOption('#serverSource', 'local');
    await page.waitForTimeout(500);
    
    const pathValue2 = await page.locator('#serverPath').inputValue();
    console.log('Path value (local):', pathValue2);
    expect(pathValue2).toBe('');
    
    // Switch back to hosted
    await page.selectOption('#serverSource', 'hosted');
    await page.waitForTimeout(500);
    
    const pathValue3 = await page.locator('#serverPath').inputValue();
    console.log('Path value (hosted again):', pathValue3);
    expect(pathValue3).not.toBe('');
  });

  test('should show alert when submitting without path', async ({ page }) => {
    // Fill in token
    await page.fill('#mcpToken', 'test-token-123456789012345678901234567890123456789012345678901234567890');
    await page.fill('#clientId', 'test-client');
    
    // Select local source but don't fill path
    await page.selectOption('#serverSource', 'local');
    await page.waitForTimeout(500);
    
    // Clear path if it has any value
    await page.fill('#serverPath', '');
    
    // Set up alert handler
    let alertMessage = null;
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
    
    console.log('Alert message:', alertMessage);
    expect(alertMessage).toContain('server path');
  });
});

