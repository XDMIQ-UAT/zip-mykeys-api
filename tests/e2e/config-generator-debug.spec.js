const { test, expect } = require('@playwright/test');

test.describe('MCP Config Generator - Debug', () => {
  test('debug form submission issue', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    await page.goto('https://mykeys.zip/mcp-config-generator.html');
    
    // Wait for page to load
    await expect(page.locator('h1')).toHaveText('🔧 MCP Configuration Generator');
    
    // Check initial state of serverSource
    const serverSource = page.locator('#serverSource');
    const initialValue = await serverSource.inputValue();
    console.log('Initial serverSource value:', initialValue);
    
    // Check initial state of serverPath
    const serverPath = page.locator('#serverPath');
    const initialPath = await serverPath.inputValue();
    console.log('Initial serverPath value:', initialPath);
    console.log('Initial serverPath isEmpty:', initialPath === '');
    
    // Fill in token
    await page.fill('#mcpToken', 'test-token-123456789012345678901234567890123456789012345678901234567890');
    await page.fill('#clientId', 'test-client');
    await page.selectOption('#clientType', 'cursor');
    
    // Ensure hosted is selected
    await serverSource.selectOption('hosted');
    await page.waitForTimeout(1000); // Wait longer for updateServerPath
    
    // Check path after selection
    const pathAfterSelect = await serverPath.inputValue();
    console.log('Path after selecting hosted:', pathAfterSelect);
    console.log('Path isEmpty after select:', pathAfterSelect === '');
    console.log('Path trimmed isEmpty:', pathAfterSelect.trim() === '');
    
    // Check if path is readonly
    const isReadonly = await serverPath.getAttribute('readonly');
    console.log('Is path readonly?', isReadonly);
    
    // Set up alert/dialog handler
    let dialogMessage = null;
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog appeared:', dialogMessage);
      await dialog.accept();
    });
    
    // Try to submit
    console.log('Attempting to submit form...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Check if config was generated
    const configResult = page.locator('#configResult');
    const isVisible = await configResult.isVisible();
    console.log('Config result visible?', isVisible);
    
    if (isVisible) {
      const configText = await page.locator('#configOutput').textContent();
      console.log('Config generated successfully:', configText.substring(0, 200));
    } else {
      console.log('Config NOT generated. Dialog message:', dialogMessage);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/config-generator-debug.png', fullPage: true });
    
    // Assert based on what we found
    if (dialogMessage) {
      console.log('ERROR: Dialog appeared:', dialogMessage);
      // If path was populated but dialog still appeared, that's the bug
      if (pathAfterSelect && pathAfterSelect.trim() !== '') {
        throw new Error(`Path was populated (${pathAfterSelect}) but validation failed. Dialog: ${dialogMessage}`);
      }
    }
    
    // Should have generated config if path was set
    if (pathAfterSelect && pathAfterSelect.trim() !== '') {
      expect(isVisible).toBe(true);
    }
  });
  
  test('check updateServerPath function exists and works', async ({ page }) => {
    await page.goto('https://mykeys.zip/mcp-config-generator.html');
    
    // Check if function exists
    const functionExists = await page.evaluate(() => {
      return typeof window.updateServerPath === 'function';
    });
    console.log('updateServerPath function exists?', functionExists);
    
    // Manually call the function
    await page.evaluate(() => {
      if (typeof updateServerPath === 'function') {
        updateServerPath();
      }
    });
    
    await page.waitForTimeout(500);
    
    const pathValue = await page.locator('#serverPath').inputValue();
    console.log('Path value after manual function call:', pathValue);
    
    // Check if event listener is attached
    const hasEventListener = await page.evaluate(() => {
      const select = document.getElementById('serverSource');
      return select.onchange !== null || select.getAttribute('onchange') !== null;
    });
    console.log('Has onchange listener?', hasEventListener);
    
    // Check if change event fires
    await page.selectOption('#serverSource', 'local');
    await page.waitForTimeout(500);
    const pathAfterChange = await page.locator('#serverPath').inputValue();
    console.log('Path after changing to local:', pathAfterChange);
    
    await page.selectOption('#serverSource', 'hosted');
    await page.waitForTimeout(500);
    const pathAfterHosted = await page.locator('#serverPath').inputValue();
    console.log('Path after changing to hosted:', pathAfterHosted);
  });
});






