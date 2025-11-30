const { test, expect } = require('@playwright/test');

test.describe('Google OAuth Button Debug', () => {
    test('Check Google button visibility and functionality', async ({ page }) => {
        // Navigate to role management page
        await page.goto('http://localhost:5173/role-management.html');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Take screenshot for visual debugging
        await page.screenshot({ path: 'tests/e2e/screenshots/google-button-initial.png', fullPage: true });
        
        // Check if Google Sign-In button exists
        const googleButton = page.locator('button:has-text("Sign in with Google"), div[data-google-signin], #google-signin-button, [id*="google"], [class*="google"]');
        
        console.log('=== Checking for Google Sign-In Button ===');
        
        // Check various possible selectors
        const selectors = [
            'button:has-text("Sign in with Google")',
            'button:has-text("Sign in")',
            '#google-signin-button',
            '[data-google-signin]',
            '[id*="google"]',
            '[class*="google"]',
            '.google-auth-section button',
            '#googleAuthSection button'
        ];
        
        for (const selector of selectors) {
            const element = page.locator(selector);
            const count = await element.count();
            console.log(`Selector "${selector}": ${count} element(s) found`);
            if (count > 0) {
                const isVisible = await element.first().isVisible();
                console.log(`  Visible: ${isVisible}`);
                const text = await element.first().textContent();
                console.log(`  Text: ${text}`);
            }
        }
        
        // Check for Google Identity Services script
        console.log('\n=== Checking for Google Scripts ===');
        const googleScripts = await page.locator('script[src*="google"], script[src*="gsi"]').all();
        console.log(`Found ${googleScripts.length} Google-related scripts`);
        for (const script of googleScripts) {
            const src = await script.getAttribute('src');
            console.log(`  Script src: ${src}`);
        }
        
        // Check for Google Auth section
        console.log('\n=== Checking Google Auth Section ===');
        const authSection = page.locator('#googleAuthSection, .google-auth-section');
        const sectionCount = await authSection.count();
        console.log(`Auth section count: ${sectionCount}`);
        if (sectionCount > 0) {
            const isVisible = await authSection.first().isVisible();
            console.log(`  Visible: ${isVisible}`);
            const html = await authSection.first().innerHTML();
            console.log(`  HTML content (first 200 chars): ${html.substring(0, 200)}`);
        }
        
        // Check console for errors
        console.log('\n=== Checking Console Messages ===');
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || text.toLowerCase().includes('error') || text.toLowerCase().includes('google')) {
                console.log(`  [${type}] ${text}`);
            }
        });
        
        // Check for any errors in the page
        const errors = [];
        page.on('pageerror', error => {
            errors.push(error.message);
            console.log(`  Page Error: ${error.message}`);
        });
        
        // Wait a bit for scripts to load
        await page.waitForTimeout(2000);
        
        // Try to find and click the button if it exists
        const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Google")').first();
        const buttonCount = await signInButton.count();
        
        if (buttonCount > 0) {
            console.log('\n=== Attempting to Click Button ===');
            const isVisible = await signInButton.isVisible();
            console.log(`Button visible: ${isVisible}`);
            
            if (isVisible) {
                await signInButton.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: 'tests/e2e/screenshots/google-button-after-click.png', fullPage: true });
            }
        } else {
            console.log('\n=== No Sign-In Button Found ===');
        }
        
        // Check network requests for Google OAuth
        console.log('\n=== Checking Network Requests ===');
        const requests = [];
        page.on('request', request => {
            const url = request.url();
            if (url.includes('google') || url.includes('oauth') || url.includes('gsi')) {
                requests.push({ url, method: request.method() });
                console.log(`  ${request.method()} ${url}`);
            }
        });
        
        await page.waitForTimeout(2000);
        
        // Final screenshot
        await page.screenshot({ path: 'tests/e2e/screenshots/google-button-final.png', fullPage: true });
        
        // Output summary
        console.log('\n=== Summary ===');
        console.log(`Total errors: ${errors.length}`);
        console.log(`Google-related requests: ${requests.length}`);
    });
    
    test('Check Google OAuth API endpoint', async ({ page }) => {
        await page.goto('http://localhost:5173/role-management.html');
        await page.waitForLoadState('networkidle');
        
        // Intercept API calls
        let apiCallMade = false;
        let apiResponse = null;
        
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('/api/auth/google')) {
                apiCallMade = true;
                apiResponse = {
                    url,
                    status: response.status(),
                    statusText: response.statusText()
                };
                try {
                    const body = await response.json();
                    apiResponse.body = body;
                } catch (e) {
                    apiResponse.body = await response.text();
                }
                console.log('Google OAuth API Response:', JSON.stringify(apiResponse, null, 2));
            }
        });
        
        // Try to trigger the button click
        const button = page.locator('button:has-text("Sign"), button:has-text("Google")').first();
        const count = await button.count();
        
        if (count > 0 && await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(2000);
        }
        
        console.log('API call made:', apiCallMade);
    });
});

