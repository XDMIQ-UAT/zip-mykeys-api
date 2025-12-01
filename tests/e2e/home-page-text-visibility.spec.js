const { test, expect } = require('@playwright/test');

test.describe('Home Page - AI Agents Text Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // Wait for React to load
    await page.waitForSelector('#root', { state: 'visible', timeout: 10000 });
    // Wait for hero section to be present (with timeout)
    try {
      await page.waitForSelector('.hero', { state: 'visible', timeout: 10000 });
    } catch (error) {
      // If hero section doesn't exist, take screenshot for debugging
      await page.screenshot({ path: 'test-results/home-page-debug.png', fullPage: true });
      throw new Error(`Hero section not found. Page HTML: ${await page.content().substring(0, 500)}`);
    }
  });

  test('should display "AI Agents" text in hero section', async ({ page }) => {
    // Verify it's in the hero section
    const heroSection = page.locator('.hero');
    await expect(heroSection).toBeVisible({ timeout: 10000 });
    
    // Check that the text is within the hero section - use more specific selector
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible({ timeout: 10000 });
    
    // Check if text contains "AI Agents" - be flexible with selector
    const titleText = await heroTitle.textContent();
    expect(titleText).toContain('AI Agents');
    
    // Check for accent text element (may be .hero-title-accent or .gradient-text)
    const accentText = heroTitle.locator('.hero-title-accent, .gradient-text').first();
    if (await accentText.count() > 0) {
      await expect(accentText).toBeVisible({ timeout: 5000 });
      await expect(accentText).toContainText('AI Agents');
    } else {
      // If accent element doesn't exist, just verify text is in title
      expect(titleText).toContain('AI Agents');
    }
  });

  test('should have readable "AI Agents" text with proper contrast', async ({ page }) => {
    const accentText = page.locator('.hero-title-accent');
    await expect(accentText).toBeVisible({ timeout: 10000 });
    
    // Check computed styles for readability
    const opacity = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
    
    // Opacity should be 1 (no fade)
    expect(parseFloat(opacity)).toBeGreaterThanOrEqual(0.95);
    
    // Check that text-shadow is applied for readability
    const textShadow = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).textShadow;
    });
    
    // Should have text-shadow for better visibility
    expect(textShadow).not.toBe('none');
    expect(textShadow).toContain('rgba');
    
    // Check color is white
    const color = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(color).toContain('rgb(255, 255, 255)');
  });

  test('should have solid white color (no gradient) on "AI Agents" text', async ({ page }) => {
    const accentText = page.locator('.hero-title-accent');
    await expect(accentText).toBeVisible({ timeout: 10000 });
    
    // Check that background is none (no gradient)
    const background = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).background;
    });
    
    expect(background).toContain('none');
    
    // Check that text-fill-color is white (not transparent)
    const webkitTextFillColor = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).webkitTextFillColor;
    });
    
    // Should be white, not transparent
    expect(webkitTextFillColor).toContain('rgb(255, 255, 255)');
  });

  test('should have sufficient contrast ratio for accessibility', async ({ page }) => {
    const accentText = page.locator('.hero-title-accent');
    await expect(accentText).toBeVisible({ timeout: 10000 });
    
    // Check color is white for contrast against purple background
    const color = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    
    // Should be white for maximum contrast
    expect(color).toContain('rgb(255, 255, 255)');
    
    // Check font weight for better visibility
    const fontWeight = await accentText.evaluate((el) => {
      return window.getComputedStyle(el).fontWeight;
    });
    
    // Should be bold (800) for better readability
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(700);
  });

  test('should be visible in hero title', async ({ page }) => {
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible({ timeout: 10000 });
    
    // Check that "AI Agents" is part of the title
    const titleText = await heroTitle.textContent();
    expect(titleText).toContain('AI Agents');
    
    // Check that hero-title-accent span is within the title
    const accentTextInTitle = heroTitle.locator('.hero-title-accent');
    await expect(accentTextInTitle).toBeVisible();
    
    // Verify the full title text
    expect(titleText).toContain('Secure Credentials for');
  });

  test('visual regression - AI Agents text should be readable', async ({ page }) => {
    // Take a screenshot of the hero section
    const heroSection = page.locator('.hero');
    await expect(heroSection).toBeVisible({ timeout: 10000 });
    
    // Wait for any animations to complete
    await page.waitForTimeout(500);
    
    // Take screenshot of hero section
    await heroSection.screenshot({ 
      path: 'test-results/hero-ai-agents-text.png',
      fullPage: false 
    });
    
    // Verify the accent text is visible in screenshot
    const accentText = page.locator('.hero-title-accent');
    const boundingBox = await accentText.boundingBox();
    
    expect(boundingBox).not.toBeNull();
    expect(boundingBox.width).toBeGreaterThan(0);
    expect(boundingBox.height).toBeGreaterThan(0);
  });
});

