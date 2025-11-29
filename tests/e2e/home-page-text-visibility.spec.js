const { test, expect } = require('@playwright/test');

test.describe('Home Page - AI Agents Text Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for React to load
    await page.waitForSelector('#root', { state: 'visible' });
  });

  test('should display "AI Agents" text in hero section', async ({ page }) => {
    // Verify it's in the hero section
    const heroSection = page.locator('.hero');
    await expect(heroSection).toBeVisible();
    
    // Check that the text is within the hero section - use more specific selector
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('AI Agents');
    
    // Specifically check the gradient-text element
    const gradientText = heroTitle.locator('.gradient-text');
    await expect(gradientText).toBeVisible();
    await expect(gradientText).toContainText('AI Agents');
  });

  test('should have readable "AI Agents" text with proper contrast', async ({ page }) => {
    const accentText = page.locator('.hero-title-accent');
    await expect(accentText).toBeVisible();
    
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
    await expect(accentText).toBeVisible();
    
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
    await expect(accentText).toBeVisible();
    
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
    await expect(heroTitle).toBeVisible();
    
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
    await expect(heroSection).toBeVisible();
    
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

