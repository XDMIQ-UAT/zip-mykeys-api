const { test, expect } = require('@playwright/test');

test.describe('API Endpoints', () => {
  test('should return health check', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('status');
  });

  test('should require authentication for protected endpoints', async ({ request }) => {
    const response = await request.get('/api/v1/secrets/shared/test');
    expect(response.status()).toBe(401);
    
    const json = await response.json();
    expect(json).toHaveProperty('error');
  });

  test('should verify partial password endpoint', async ({ request }) => {
    const response = await request.post('/api/auth/verify-partial', {
      data: {
        partialPassword: 'riddle-squiggle'
      }
    });
    
    // Should either succeed or fail with proper error
    expect([200, 401]).toContain(response.status());
    
    const json = await response.json();
    if (response.ok()) {
      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('code');
    } else {
      expect(json).toHaveProperty('error');
    }
  });
});




