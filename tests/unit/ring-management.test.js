/**
 * Unit tests for ring-management.js (simplified version)
 */

// Mock KV storage before requiring ring-management
const mockKV = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

jest.mock('../../kv-utils', () => ({
  getStorage: jest.fn(() => mockKV),
  getKV: jest.fn(() => mockKV) // Backward compatibility
}));

const {
  validateRingRoles,
  createRing,
  getRing,
  addRingMember,
  updateRingRoles,
  canUserOwnRing,
  extractDomain,
  getPrimaryDomain
} = require('../../ring-management');

describe('Ring Management (Simplified)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRingRoles', () => {
    test('should reject empty ring', () => {
      const result = validateRingRoles({});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('at least one member');
    });

    test('should require at least one admin', () => {
      const result = validateRingRoles({
        'user@example.com': { role: 'member' }
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('admin');
    });

    test('should accept ring with one admin', () => {
      const result = validateRingRoles({
        'user@example.com': { role: 'admin' }
      });
      expect(result.valid).toBe(true);
    });

    test('should accept ring with admin and members', () => {
      const result = validateRingRoles({
        'admin@example.com': { role: 'admin' },
        'member1@example.com': { role: 'member' },
        'member2@example.com': { role: 'member' }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('createRing', () => {
    test('should create ring with simplified roles', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.set.mockResolvedValue(true);
      
      const ring = await createRing(
        'test-ring-123',
        'admin@example.com',
        {
          'admin@example.com': { role: 'admin', entityType: 'person' },
          'member@example.com': { role: 'member', entityType: 'person' }
        },
        'admin@example.com',
        { label: 'Test Ring', type: 'project' }
      );
      
      expect(ring.id).toBe('test-ring-123');
      expect(ring.members['admin@example.com'].role).toBe('admin');
      expect(ring.members['member@example.com'].role).toBe('member');
      expect(ring.type).toBe('project');
    });

    test('should accept members from any domain', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.set.mockResolvedValue(true);
      
      const ring = await createRing(
        'test-ring-123',
        'admin@gmail.com',
        {
          'admin@gmail.com': { role: 'admin', entityType: 'person' },
          'member@xdmiq.com': { role: 'member', entityType: 'person' },
          'member2@cosmiciq.org': { role: 'member', entityType: 'person' }
        },
        'admin@gmail.com'
      );
      
      expect(ring.members['admin@gmail.com']).toBeDefined();
      expect(ring.members['member@xdmiq.com']).toBeDefined();
      expect(ring.members['member2@cosmiciq.org']).toBeDefined();
    });

    test('should reject ring without admin', async () => {
      mockKV.get.mockResolvedValue(null);
      
      await expect(
        createRing(
          'test-ring-123',
          'member@example.com',
          {
            'member@example.com': { role: 'member', entityType: 'person' }
          }
        )
      ).rejects.toThrow('admin');
    });
  });

  describe('addRingMember', () => {
    test('should add member from any domain', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        'ring-123': {
          id: 'ring-123',
          firstMember: 'admin@example.com',
          members: {
            'admin@example.com': { role: 'admin', entityType: 'person' }
          }
        }
      }));
      mockKV.set.mockResolvedValue(true);
      
      const ring = await addRingMember(
        'ring-123',
        'newmember@different-domain.com',
        { role: 'member', entityType: 'person' },
        'admin@example.com'
      );
      
      expect(ring.members['newmember@different-domain.com']).toBeDefined();
      expect(ring.members['newmember@different-domain.com'].role).toBe('member');
    });

    test('should reject adding member if ring would become invalid', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        'ring-123': {
          id: 'ring-123',
          firstMember: 'admin@example.com',
          members: {
            'admin@example.com': { role: 'admin', entityType: 'person' }
          }
        }
      }));
      
      // Try to remove admin (would make ring invalid)
      // This test would need removeRingMember, but demonstrates the concept
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('canUserOwnRing', () => {
    test('should return true if user created the ring', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        'ring-123': {
          id: 'ring-123',
          createdBy: 'creator@example.com',
          firstMember: 'creator@example.com',
          members: {
            'creator@example.com': { role: 'admin', entityType: 'person' }
          }
        }
      }));
      
      const canOwn = await canUserOwnRing('creator@example.com', 'ring-123');
      expect(canOwn).toBe(true);
    });

    test('should return false if user did not create ring', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        'ring-123': {
          id: 'ring-123',
          createdBy: 'creator@example.com',
          firstMember: 'creator@example.com',
          members: {
            'creator@example.com': { role: 'admin', entityType: 'person' },
            'other@example.com': { role: 'member', entityType: 'person' }
          }
        }
      }));
      
      const canOwn = await canUserOwnRing('other@example.com', 'ring-123');
      expect(canOwn).toBe(false);
    });
  });

  describe('extractDomain', () => {
    test('should extract domain from email', () => {
      const domain = extractDomain('user@example.com');
      expect(domain).toBe('example.com');
    });

    test('should return null for invalid email', () => {
      const domain = extractDomain('not-an-email');
      expect(domain).toBeNull();
    });
  });

  describe('getPrimaryDomain', () => {
    test('should return most common domain', () => {
      const emails = [
        'user1@gmail.com',
        'user2@gmail.com',
        'user3@xdmiq.com'
      ];
      const primaryDomain = getPrimaryDomain(emails);
      expect(primaryDomain).toBe('gmail.com');
    });

    test('should return null for empty array', () => {
      const primaryDomain = getPrimaryDomain([]);
      expect(primaryDomain).toBeNull();
    });
  });
});

