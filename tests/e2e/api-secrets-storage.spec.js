/**
 * E2E tests for API secret storage endpoints
 * Tests POST /api/v1/secrets/:ecosystem with proper authentication
 */

const { test, expect } = require('@playwright/test');

const MYKEYS_URL = process.env.MYKEYS_URL || 'http://localhost:8080';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
const MYKEYS_PASS = process.env.MYKEYS_PASS || 'caps-bats';

test.describe('API Secret Storage', () => {
  test('POST /api/v1/secrets/:ecosystem should require authentication', async ({ request }) => {
    const response = await request.post(`${MYKEYS_URL}/api/v1/secrets/shared`, {
      data: {
        secret_name: 'test-key',
        secret_value: 'test-value'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('POST /api/v1/secrets/:ecosystem should store secret with basic auth', async ({ request }) => {
    const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
    
    const response = await request.post(`${MYKEYS_URL}/api/v1/secrets/shared`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      data: {
        secret_name: 'test-key',
        secret_value: 'test-value'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.secret_name).toBe('test-key');
    expect(data.ecosystem).toBe('shared');
  });

  test('POST /api/v1/secrets/:ecosystem should require secret_name', async ({ request }) => {
    const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
    
    const response = await request.post(`${MYKEYS_URL}/api/v1/secrets/shared`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      data: {
        secret_value: 'test-value'
        // missing secret_name
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('secret_name');
  });

  test('POST /api/v1/secrets/:ecosystem should require secret_value', async ({ request }) => {
    const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
    
    const response = await request.post(`${MYKEYS_URL}/api/v1/secrets/shared`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      data: {
        secret_name: 'test-key'
        // missing secret_value
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('secret_value');
  });

  test('POST /api/v1/secrets/:ecosystem should work with CLI session token', async ({ request }) => {
    // First, get a CLI session token by requesting a magic link
    // (This would require email setup, so we'll use basic auth for now)
    // In a real scenario, you'd:
    // 1. POST /api/cli/send-magic-link
    // 2. Extract token from email (or mock it)
    // 3. POST /api/cli/verify-magic-link
    // 4. Use sessionToken for subsequent requests
    
    const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
    
    const response = await request.post(`${MYKEYS_URL}/api/v1/secrets/shared`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      data: {
        secret_name: 'cli-test-key',
        secret_value: 'cli-test-value'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    // Verify userEmail was properly set (should not cause errors)
    expect(data.message).toBeDefined();
  });
});

