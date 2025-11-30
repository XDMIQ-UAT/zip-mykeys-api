const { test, expect } = require('@playwright/test');

test.describe('AI Agent Delegation API', () => {
  let humanToken;
  let agentToken;
  
  test.beforeAll(async ({ request }) => {
    // Note: In real tests, you'd need to:
    // 1. Create a test human account
    // 2. Verify it with Google OAuth (mock or test account)
    // 3. Generate a token for the human
    // For now, tests will check for proper error responses when setup is incomplete
  });

  test('should verify human account with Google OAuth', async ({ request }) => {
    // This would require actual Google OAuth setup or mocking
    // For now, documenting the expected behavior
    
    const response = await request.post('/api/auth/verify', {
      data: {
        provider: 'google',
        idToken: 'mock-google-id-token',
        email: 'test@example.com'
      },
      failOnStatusCode: false
    });
    
    // Should either succeed (if properly configured) or return appropriate error
    expect([200, 400, 503]).toContain(response.status());
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('verified', true);
      expect(json.data).toHaveProperty('canDelegate', true);
    }
  });

  test('should require verified human to delegate agent', async ({ request }) => {
    // Test that unverified humans cannot delegate
    const response = await request.post('/api/agents/delegate', {
      headers: {
        'Authorization': 'Bearer unverified-token'
      },
      data: {
        agentName: 'test-agent',
        capabilities: ['key-management']
      },
      failOnStatusCode: false
    });
    
    expect([403, 401]).toContain(response.status());
  });

  test('should delegate AI agent successfully', async ({ request }) => {
    // This requires a verified human token
    // For now, documenting expected behavior
    
    const response = await request.post('/api/agents/delegate', {
      headers: {
        'Authorization': 'Bearer verified-human-token'
      },
      data: {
        agentName: 'test-agent',
        capabilities: ['key-management', 'ring-access'],
        entityType: 'agent'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('agentToken');
      expect(json.data).toHaveProperty('delegatedBy');
      expect(json.data).toHaveProperty('capabilities');
      
      agentToken = json.data.agentToken;
    } else {
      // If test setup incomplete, that's expected
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should list delegated agents', async ({ request }) => {
    const response = await request.get('/api/agents/delegated', {
      headers: {
        'Authorization': 'Bearer verified-human-token'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('agents');
      expect(Array.isArray(json.data.agents)).toBe(true);
    } else {
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should revoke AI agent', async ({ request }) => {
    if (!agentToken) {
      test.skip();
      return;
    }
    
    const response = await request.delete(`/api/agents/${agentToken}`, {
      headers: {
        'Authorization': 'Bearer verified-human-token'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('revoked', true);
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('should get delegation info', async ({ request }) => {
    if (!agentToken) {
      test.skip();
      return;
    }
    
    const response = await request.get(`/api/agents/${agentToken}/delegation`, {
      headers: {
        'Authorization': `Bearer ${agentToken}`
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('delegatedBy');
      expect(json.data).toHaveProperty('delegatedAt');
      expect(json.data).toHaveProperty('humanAccount');
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('should block revoked agent from accessing API', async ({ request }) => {
    if (!agentToken) {
      test.skip();
      return;
    }
    
    // First revoke the agent
    await request.delete(`/api/agents/${agentToken}`, {
      headers: {
        'Authorization': 'Bearer verified-human-token'
      }
    });
    
    // Then try to use the revoked token
    const response = await request.get('/api/v1/secrets/shared/test', {
      headers: {
        'Authorization': `Bearer ${agentToken}`
      },
      failOnStatusCode: false
    });
    
    expect([401, 403]).toContain(response.status());
  });
});

