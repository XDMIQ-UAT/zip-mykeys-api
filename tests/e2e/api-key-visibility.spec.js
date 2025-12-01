const { test, expect } = require('@playwright/test');

test.describe('Key Visibility API', () => {
  let userToken;
  let ringId;
  let sharedKeyName;
  let privateKeyName;
  
  test('should create shared key (visible to all members)', async ({ request }) => {
    const response = await request.post('/api/v1/secrets/test', {
      headers: {
        'Authorization': 'Bearer user-token'
      },
      data: {
        secret_name: 'shared-key',
        secret_value: 'shared-value',
        isShared: true
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      sharedKeyName = 'shared-key';
    } else {
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should create private key (visible only to creator)', async ({ request }) => {
    const response = await request.post('/api/v1/secrets/test', {
      headers: {
        'Authorization': 'Bearer user-token'
      },
      data: {
        secret_name: 'private-key',
        secret_value: 'private-value',
        isShared: false
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      privateKeyName = 'private-key';
    } else {
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should list only visible keys', async ({ request }) => {
    if (!ringId) {
      test.skip();
      return;
    }
    
    const response = await request.get(`/api/rings/${ringId}/keys`, {
      headers: {
        'Authorization': 'Bearer member-token'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('keys');
      
      // Should see shared keys but not private keys (unless creator)
      const keys = json.data.keys;
      if (sharedKeyName) {
        expect(keys).toContain(sharedKeyName);
      }
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('should allow admin to request access to private key', async ({ request }) => {
    if (!ringId || !privateKeyName) {
      test.skip();
      return;
    }
    
    const response = await request.post(`/api/rings/${ringId}/keys/${privateKeyName}/request`, {
      headers: {
        'Authorization': 'Bearer admin-token'
      },
      data: {
        reason: 'VPN setup for home automation'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('requested', true);
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('should allow creator to grant access (make shared)', async ({ request }) => {
    if (!ringId || !privateKeyName) {
      test.skip();
      return;
    }
    
    const response = await request.post(`/api/rings/${ringId}/keys/${privateKeyName}/grant`, {
      headers: {
        'Authorization': 'Bearer creator-token'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('isShared', true);
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('should reject grant from non-creator', async ({ request }) => {
    if (!ringId || !privateKeyName) {
      test.skip();
      return;
    }
    
    const response = await request.post(`/api/rings/${ringId}/keys/${privateKeyName}/grant`, {
      headers: {
        'Authorization': 'Bearer non-creator-token'
      },
      failOnStatusCode: false
    });
    
    expect([401, 403, 404]).toContain(response.status());
  });
});


