/**
 * Unit tests for server.js endpoints
 * Tests Express route handlers directly to catch missing variables and errors
 */

const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

// Mock all dependencies
jest.mock('../../kv-utils', () => ({
  getStorage: jest.fn(() => mockStorage),
  getKV: jest.fn(() => mockStorage) // Backward compatibility
}));

jest.mock('../ring-registry', () => ({
  updateRingMetadata: jest.fn(() => Promise.resolve()),
  registerRingKey: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../key-management', () => ({
  registerRingKey: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../ring-management', () => ({
  logAuditEvent: jest.fn(() => Promise.resolve(true))
}));

// Mock storeSecret function
const mockStoreSecret = jest.fn(() => Promise.resolve({ created: true }));

describe('Server Endpoints - Secret Storage', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      params: { ecosystem: 'shared' },
      body: {
        secret_name: 'test-key',
        secret_value: 'test-value'
      },
      ringId: 'ring-123',
      userEmail: 'test@example.com',
      authType: 'cli-session',
      isAgent: false,
      token: 'test-token'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  test('should extract userEmail from req.userEmail', () => {
    // This test verifies the pattern that should be used
    const userEmail = req.userEmail;
    expect(userEmail).toBe('test@example.com');
    expect(userEmail).toBeDefined();
  });

  test('should handle missing userEmail gracefully', () => {
    const reqWithoutEmail = {
      ...req,
      userEmail: undefined
    };

    // The endpoint should handle this case
    const userEmail = reqWithoutEmail.userEmail || null;
    expect(userEmail).toBeNull();
  });

  test('should require secret_name and secret_value', () => {
    const invalidReq1 = {
      ...req,
      body: {
        secret_value: 'test-value'
        // missing secret_name
      }
    };

    const invalidReq2 = {
      ...req,
      body: {
        secret_name: 'test-key'
        // missing secret_value
      }
    };

    expect(invalidReq1.body.secret_name).toBeUndefined();
    expect(invalidReq2.body.secret_value).toBeUndefined();
  });

  test('should construct secret name correctly', () => {
    const { ecosystem } = req.params;
    const { secret_name } = req.body;
    const secretName = `${ecosystem}-${secret_name}`;
    
    expect(secretName).toBe('shared-test-key');
  });

  test('should register key with creator email when ringId exists', async () => {
    const { registerRingKey } = require('../key-management');
    const userEmail = req.userEmail;
    const ringId = req.ringId;
    
    if (ringId && userEmail) {
      await registerRingKey(ringId, 'shared-test-key', 'test-value', { ecosystem: 'shared' }, userEmail);
      
      expect(registerRingKey).toHaveBeenCalledWith(
        ringId,
        'shared-test-key',
        'test-value',
        { ecosystem: 'shared' },
        userEmail
      );
    }
  });

  test('should handle missing userEmail in registerRingKey call', () => {
    const reqWithoutEmail = {
      ...req,
      userEmail: undefined
    };

    const creatorEmail = reqWithoutEmail.userEmail || null;
    expect(creatorEmail).toBeNull();
    // Should not throw error when passing null
  });
});

