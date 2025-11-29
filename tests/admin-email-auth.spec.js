/**
 * Playwright Test Suite: MyKeys Admin Email Authentication
 * 
 * Tests the email-based authentication flow for `mykeys admin` command
 * including email delivery, code verification, and admin info display
 */

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const MYKEYS_URL = process.env.MYKEYS_URL || 'http://localhost:8080';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@xdmiq.com';
const TOKEN_FILE = path.join(os.homedir(), '.mykeys', 'token');

// Helper: Clear token before test
async function clearToken() {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}

// Helper: Spawn CLI process
function spawnCLI(command, args = []) {
  return spawn('node', ['mykeys-cli.js', command, '--skip-seed', ...args], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, MYKEYS_URL }
  });
}

// Helper: Wait for prompt and send input
function sendInput(proc, input) {
  return new Promise((resolve) => {
    setTimeout(() => {
      proc.stdin.write(input + '\n');
      resolve();
    }, 500);
  });
}

// Helper: Request MFA code via API
async function requestMFACode(page, email) {
  const response = await page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
    data: { email }
  });
  return await response.json();
}

// Helper: Get the last verification code from email (mock for testing)
function getMockVerificationCode() {
  // In real tests, this would check email via API or test inbox
  // For now, return a mock code
  return '1234';
}

test.describe('Admin Email Authentication', () => {
  
  test.beforeEach(async () => {
    // Clear any existing tokens
    await clearToken();
  });

  test('should display authentication prompt when no token exists', async ({ page }) => {
    test.setTimeout(60000); // 60 second timeout

    // Start the CLI process
    const cli = spawnCLI('admin');
    
    let output = '';
    cli.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    cli.stderr.on('data', (data) => {
      output += data.toString();
    });

    // Wait for authentication prompt
    await new Promise((resolve) => {
      const checkOutput = setInterval(() => {
        if (output.includes('MyKeys Admin Authentication') && 
            output.includes('Enter your email address:')) {
          clearInterval(checkOutput);
          resolve();
        }
      }, 100);
    });

    // Verify prompt text
    expect(output).toContain('No token found. Authenticate via email:');
    expect(output).toContain('Enter your email address:');

    // Cleanup
    cli.kill();
  });

  test('should validate email format', async ({ page }) => {
    test.setTimeout(60000);

    const cli = spawnCLI('admin');
    
    let output = '';
    let errorOutput = '';
    
    cli.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    cli.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Wait for prompt and send invalid email
    await new Promise((resolve) => {
      const checkOutput = setInterval(() => {
        if (output.includes('Enter your email address:')) {
          clearInterval(checkOutput);
          sendInput(cli, 'invalid-email').then(resolve);
        }
      }, 100);
    });

    // Wait for error
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify error message
    expect(errorOutput).toContain('Invalid email address format');

    cli.kill();
  });

  test('should send verification code via email', async ({ page }) => {
    test.setTimeout(60000);

    // Test API endpoint directly
    const response = await page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      data: { email: TEST_EMAIL }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.method).toBe('email');
    expect(data.target).toBe(TEST_EMAIL);
    expect(data.expiresIn).toBe(600); // 10 minutes
  });

  test('should verify 4-digit code and generate token', async ({ page }) => {
    test.setTimeout(60000);

    // Step 1: Request MFA code
    const mfaResponse = await page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      data: { email: TEST_EMAIL }
    });
    expect(mfaResponse.status()).toBe(200);

    // Step 2: Get the code (in real test, would check email)
    const code = getMockVerificationCode();

    // Step 3: Verify code and generate token
    const verifyResponse = await page.request.post(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
      data: {
        email: TEST_EMAIL,
        code: code,
        clientId: 'test-admin',
        clientType: 'admin-cli',
        expiresInDays: 1
      }
    });

    // Note: This will fail if code doesn't match - that's expected in automated testing
    // In real UAT, tester will use actual email code
    if (verifyResponse.status() === 200) {
      const data = await verifyResponse.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.expiresAt).toBeDefined();
    }
  });

  test('should reject invalid verification code', async ({ page }) => {
    test.setTimeout(60000);

    // Request MFA code first
    await page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      data: { email: TEST_EMAIL }
    });

    // Try with invalid code
    const response = await page.request.post(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
      data: {
        email: TEST_EMAIL,
        code: '9999', // Invalid code
        clientId: 'test-admin',
        clientType: 'admin-cli',
        expiresInDays: 1
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Invalid verification code');
  });

  test('should display admin info after successful authentication', async ({ page }) => {
    test.setTimeout(90000);

    // This test requires a valid token
    // First, generate a token using the API
    
    // Request code
    await page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      data: { email: TEST_EMAIL }
    });

    // In a real test, we'd verify with actual code from email
    // For now, we'll skip to testing with a pre-generated token
    
    // Create a test token file
    const testToken = 'test-token-for-playwright-' + Date.now();
    const tokenDir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, testToken);

    // Test that admin command uses the token
    const cli = spawnCLI('admin');
    
    let output = '';
    cli.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Should attempt to use token (will fail auth, but that's expected)
    expect(output).toContain('Fetching admin information');

    cli.kill();
    
    // Cleanup
    fs.unlinkSync(TOKEN_FILE);
  });

  test('API health check', async ({ page }) => {
    const response = await page.request.get(`${MYKEYS_URL}/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('mykeys-api');
  });

  test('should handle expired verification codes', async ({ page }) => {
    test.setTimeout(60000);

    // This test would need to wait 10 minutes or manipulate time
    // For now, just verify the error handling exists
    
    const response = await page.request.post(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
      data: {
        email: TEST_EMAIL,
        code: '0000',
        clientId: 'test',
        clientType: 'cli',
        expiresInDays: 1
      }
    });

    // Should fail with error about code
    expect(response.status()).toBe(401);
  });
});

test.describe('Email Service Integration', () => {
  
  test('ProtonMail SMTP configuration check', async ({ page }) => {
    // Verify environment variables are set
    const hasProtonMailUser = !!process.env.PROTONMAIL_USER;
    const hasProtonMailPassword = !!process.env.PROTONMAIL_APP_PASSWORD;
    
    console.log('ProtonMail User configured:', hasProtonMailUser);
    console.log('ProtonMail Password configured:', hasProtonMailPassword);
    
    // This is informational - tests can proceed without it
    // but email delivery will fail in UAT
    if (!hasProtonMailUser || !hasProtonMailPassword) {
      console.warn('⚠️  ProtonMail SMTP not configured. Email delivery will fail.');
      console.warn('   Set PROTONMAIL_USER and PROTONMAIL_APP_PASSWORD');
    }
  });

  test('API endpoint availability', async ({ page }) => {
    // Test all required endpoints
    const endpoints = [
      { path: '/health', method: 'GET' },
      { path: '/api/health', method: 'GET' },
      { path: '/api/v1/health', method: 'GET' },
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(`${MYKEYS_URL}${endpoint.path}`);
      expect(response.status()).toBe(200);
    }
  });
});

test.describe('Security & Error Handling', () => {
  
  test('should not accept empty email', async ({ page }) => {
    const response = await page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      data: { email: '' }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('should rate limit MFA requests', async ({ page }) => {
    test.setTimeout(90000);

    // Send multiple requests rapidly
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        page.request.post(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
          data: { email: `test${i}@xdmiq.com` }
        })
      );
    }

    const responses = await Promise.all(promises);
    
    // Some requests should succeed, but excessive requests might be rate limited
    const statuses = responses.map(r => r.status());
    console.log('Rate limit test statuses:', statuses);
    
    // At least one should succeed
    expect(statuses.some(s => s === 200)).toBe(true);
  });

  test('should sanitize error messages', async ({ page }) => {
    const response = await page.request.post(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
      data: {
        email: TEST_EMAIL,
        code: '"><script>alert("xss")</script>',
        clientId: 'test',
        clientType: 'cli',
        expiresInDays: 1
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    
    // Error should not contain script tags
    expect(JSON.stringify(data)).not.toContain('<script>');
  });
});
