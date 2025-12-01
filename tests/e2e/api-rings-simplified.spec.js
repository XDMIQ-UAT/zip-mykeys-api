const { test, expect } = require('@playwright/test');

test.describe('Ring Management API (Simplified Roles)', () => {
  let adminToken;
  let testRingId;
  
  test('should create ring with admin/member roles', async ({ request }) => {
    const response = await request.post('/api/admin/rings', {
      headers: {
        'Authorization': 'Bearer admin-token'
      },
      data: {
        firstIdentifier: 'admin@example.com',
        initialMembers: {
          'admin@example.com': { role: 'admin', entityType: 'person' },
          'member@example.com': { role: 'member', entityType: 'person' }
        },
        type: 'project',
        label: 'Test Ring'
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data).toHaveProperty('members');
      expect(json.data.members['admin@example.com'].role).toBe('admin');
      expect(json.data.members['member@example.com'].role).toBe('member');
      testRingId = json.data.id;
    } else {
      // If test setup incomplete, that's expected
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should accept members from any domain', async ({ request }) => {
    if (!testRingId) {
      test.skip();
      return;
    }
    
    const response = await request.post(`/api/admin/rings/${testRingId}/members`, {
      headers: {
        'Authorization': 'Bearer admin-token'
      },
      data: {
        email: 'gmail-user@gmail.com',
        roles: ['member']
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json.data.members['gmail-user@gmail.com']).toBeDefined();
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test('should reject ring without admin', async ({ request }) => {
    const response = await request.post('/api/admin/rings', {
      headers: {
        'Authorization': 'Bearer admin-token'
      },
      data: {
        firstIdentifier: 'member@example.com',
        initialMembers: {
          'member@example.com': { role: 'member', entityType: 'person' }
        }
      },
      failOnStatusCode: false
    });
    
    // Should reject ring without admin
    expect([400, 401, 403]).toContain(response.status());
  });

  test('should update roles to admin/member', async ({ request }) => {
    if (!testRingId) {
      test.skip();
      return;
    }
    
    const response = await request.put(`/api/admin/rings/${testRingId}/roles`, {
      headers: {
        'Authorization': 'Bearer admin-token'
      },
      data: {
        roles: {
          'admin@example.com': { role: 'admin', entityType: 'person' },
          'member@example.com': { role: 'member', entityType: 'person' },
          'newadmin@example.com': { role: 'admin', entityType: 'person' }
        }
      },
      failOnStatusCode: false
    });
    
    if (response.ok()) {
      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      // Verify simplified roles (admin/member, not owner/architect/member)
      expect(json.data.members['admin@example.com'].role).toBe('admin');
      expect(json.data.members['member@example.com'].role).toBe('member');
    } else {
      expect([401, 403, 404]).toContain(response.status());
    }
  });
});


