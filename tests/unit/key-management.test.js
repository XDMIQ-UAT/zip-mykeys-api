/**
 * Unit tests for key-management.js (simplified visibility)
 * Note: This test file is simplified to avoid loading the entire server.js file
 */

// Mock KV storage and ring-management BEFORE requiring key-management
const mockKV = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

const mockRing = {
  id: 'ring-123',
  members: {
    'user@example.com': { role: 'admin', entityType: 'person' },
    'member@example.com': { role: 'member', entityType: 'person' }
  }
};

// Mock server.js functions to avoid loading the entire file
jest.mock('../../server', () => {
  const mockGetKV = jest.fn(() => mockKV);
  const mockGetSecret = jest.fn((keyName, ringId) => Promise.resolve(`secret-value-${keyName}`));
  const mockStoreSecret = jest.fn(() => Promise.resolve(true));
  
  return {
    getKV: mockGetKV,
    getSecret: mockGetSecret,
    storeSecret: mockStoreSecret
  };
});

jest.mock('../../kv-utils', () => ({
  getKV: jest.fn(() => mockKV)
}));

jest.mock('../../ring-management', () => ({
  getRing: jest.fn((ringId) => Promise.resolve(mockRing)),
  getRingForEmail: jest.fn(),
  logAuditEvent: jest.fn(() => Promise.resolve(true))
}));

// Mock ring-registry to avoid circular dependencies
jest.mock('../../ring-registry', () => ({
  trackKeyAddition: jest.fn(() => Promise.resolve(true))
}));

const {
  canUserViewKey,
  requestKeyAccess,
  grantKeyAccess,
  getKeySharingInfo,
  registerRingKey
} = require('../../key-management');

describe('Key Management (Simplified Visibility)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canUserViewKey', () => {
    test('should return false for non-member', async () => {
      mockKV.get.mockResolvedValue(null);
      
      const canView = await canUserViewKey('nonmember@example.com', 'ring-123', 'test-key');
      expect(canView).toBe(false);
    });

    test('should return true for shared key', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: true,
        createdAt: new Date().toISOString()
      }));
      
      const canView = await canUserViewKey('user@example.com', 'ring-123', 'test-key');
      expect(canView).toBe(true);
    });

    test('should return true for private key creator', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'user@example.com',
        isShared: false,
        createdAt: new Date().toISOString()
      }));
      
      const canView = await canUserViewKey('user@example.com', 'ring-123', 'test-key');
      expect(canView).toBe(true);
    });

    test('should return false for private key non-creator', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: false,
        createdAt: new Date().toISOString()
      }));
      
      const canView = await canUserViewKey('member@example.com', 'ring-123', 'test-key');
      expect(canView).toBe(false);
    });

    test('should default to shared if no visibility data', async () => {
      mockKV.get.mockResolvedValue(null);
      
      const canView = await canUserViewKey('user@example.com', 'ring-123', 'test-key');
      expect(canView).toBe(true); // Default to shared for backward compatibility
    });
  });

  describe('requestKeyAccess', () => {
    test('should create access request for admin', async () => {
      // Mock getKeySharingInfo call
      mockKV.get.mockImplementation((key) => {
        if (key.includes('visibility')) {
          return Promise.resolve(JSON.stringify({
            createdBy: 'creator@example.com',
            isShared: false,
            createdAt: new Date().toISOString()
          }));
        }
        if (key.includes('notifications')) {
          return Promise.resolve(JSON.stringify([])); // Return array as JSON string
        }
        return Promise.resolve(null);
      });
      mockKV.set.mockResolvedValue(true);
      
      const result = await requestKeyAccess(
        'ring-123',
        'test-key',
        'user@example.com', // admin
        'VPN setup'
      );
      
      expect(result.success).toBe(true);
      expect(result.requested).toBe(true);
      expect(mockKV.set).toHaveBeenCalled();
    });

    test('should reject request from non-admin', async () => {
      const nonAdminRing = {
        ...mockRing,
        members: {
          'member@example.com': { role: 'member', entityType: 'person' }
        }
      };
      const { getRing } = require('../../ring-management');
      getRing.mockResolvedValueOnce(nonAdminRing);
      
      await expect(
        requestKeyAccess('ring-123', 'test-key', 'member@example.com', 'VPN setup')
      ).rejects.toThrow('Only ring admins can request key access');
    });

    test('should return already visible for shared key', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: true,
        createdAt: new Date().toISOString()
      }));
      
      const result = await requestKeyAccess(
        'ring-123',
        'test-key',
        'user@example.com',
        'VPN setup'
      );
      
      expect(result.success).toBe(true);
      expect(result.alreadyVisible).toBe(true);
    });
  });

  describe('grantKeyAccess', () => {
    test('should grant access (make key shared)', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: false,
        createdAt: new Date().toISOString()
      }));
      mockKV.set.mockResolvedValue(true);
      
      // Mock logAuditEvent
      const { logAuditEvent } = require('../../ring-management');
      logAuditEvent.mockResolvedValue(true);
      
      const result = await grantKeyAccess(
        'ring-123',
        'test-key',
        'creator@example.com'
      );
      
      expect(result.success).toBe(true);
      expect(result.isShared).toBe(true);
      expect(mockKV.set).toHaveBeenCalled();
    });

    test('should reject grant from non-creator', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: false,
        createdAt: new Date().toISOString()
      }));
      
      await expect(
        grantKeyAccess('ring-123', 'test-key', 'other@example.com')
      ).rejects.toThrow('Only the key creator can grant access');
    });
  });

  describe('getKeySharingInfo', () => {
    test('should return sharing info for shared key', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: true,
        createdAt: new Date().toISOString()
      }));
      
      const info = await getKeySharingInfo('ring-123', 'test-key');
      
      expect(info).toBeDefined();
      expect(info.isShared).toBe(true);
      expect(info.message).toContain('shared');
    });

    test('should return sharing info for private key', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        createdBy: 'creator@example.com',
        isShared: false,
        createdAt: new Date().toISOString()
      }));
      
      const info = await getKeySharingInfo('ring-123', 'test-key');
      
      expect(info).toBeDefined();
      expect(info.isShared).toBe(false);
      expect(info.message).toContain('private');
    });
  });

  describe('registerRingKey', () => {
    test('should register key with shared visibility by default', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.set.mockResolvedValue(true);
      
      const result = await registerRingKey(
        'ring-123',
        'test-key',
        'test-value',
        {},
        'creator@example.com',
        true // isShared
      );
      
      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalled();
      
      // Check that visibility was set to shared
      const setCalls = mockKV.set.mock.calls;
      const visibilityCall = setCalls.find(call => call[0] && call[0].includes('visibility'));
      if (visibilityCall) {
        const visibilityData = JSON.parse(visibilityCall[1]);
        expect(visibilityData.isShared).toBe(true);
      }
    });

    test('should register key with private visibility', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.set.mockResolvedValue(true);
      
      const result = await registerRingKey(
        'ring-123',
        'test-key',
        'test-value',
        {},
        'creator@example.com',
        false // isShared = false (private)
      );
      
      expect(result).toBe(true);
      
      // Check that visibility was set to private
      const setCalls = mockKV.set.mock.calls;
      const visibilityCall = setCalls.find(call => call[0] && call[0].includes('visibility'));
      if (visibilityCall) {
        const visibilityData = JSON.parse(visibilityCall[1]);
        expect(visibilityData.isShared).toBe(false);
      }
    });
  });
});
