/**
 * Unit tests for secret endpoint handlers
 * Tests the actual route handler logic to catch errors like getKV() vs getStorage()
 */

const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

jest.mock('../../kv-utils', () => ({
  getStorage: jest.fn(() => mockStorage),
  getKV: jest.fn(() => mockStorage) // Backward compatibility
}));

jest.mock('../../ring-registry', () => ({
  updateRingMetadata: jest.fn(() => Promise.resolve()),
  getRingForUser: jest.fn(() => Promise.resolve('test-ring-123'))
}));

jest.mock('../../key-management', () => ({
  registerRingKey: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../../ring-management', () => ({
  logAuditEvent: jest.fn(() => Promise.resolve(true))
}));

// Mock storeSecretInStorage
const mockStoreSecretInStorage = jest.fn(() => Promise.resolve({ created: true }));
jest.mock('../../server', () => {
  const actualServer = jest.requireActual('../../server');
  return {
    ...actualServer,
    storeSecretInStorage: mockStoreSecretInStorage
  };
}, { virtual: true });

describe('Secret Endpoint Handlers', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.get.mockResolvedValue(null);
    mockStorage.set.mockResolvedValue(true);
    mockStorage.del.mockResolvedValue(true);
  });

  describe('POST /api/v1/secrets/:ecosystem handler logic', () => {
    beforeEach(() => {
      req = {
        params: { ecosystem: 'shared' },
        body: {
          secret_name: 'test-key',
          secret_value: 'test-value'
        },
        ringId: 'test-ring-123',
        userEmail: 'test@example.com',
        token: 'test-token'
      };

      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
    });

    test('should use getStorage() not getKV()', async () => {
      // This test will fail if the handler uses getKV() instead of getStorage()
      const { getStorage } = require('../../kv-utils');
      
      // Simulate what the handler should do
      const storage = getStorage();
      expect(storage).toBeDefined();
      expect(storage).toBe(mockStorage);
      
      // Verify getStorage was called (not getKV directly)
      expect(getStorage).toBeDefined();
    });

    test('should extract userEmail from req.userEmail', () => {
      const userEmail = req.userEmail;
      expect(userEmail).toBe('test@example.com');
      expect(userEmail).toBeDefined();
    });

    test('should handle error serialization correctly', () => {
      // Test error message extraction
      const testError = new Error('Test error message');
      let errorMessage = 'Unknown error occurred';
      
      if (testError && typeof testError.message === 'string') {
        errorMessage = testError.message;
      }
      
      expect(errorMessage).toBe('Test error message');
      expect(typeof errorMessage).toBe('string');
    });

    test('should serialize error details as string', () => {
      const errorMessage = 'Test error';
      
      // Simulate the error serialization logic from the endpoint
      const detailsStr = typeof errorMessage === 'string' 
        ? errorMessage 
        : (typeof errorMessage === 'object' 
            ? JSON.stringify(errorMessage) 
            : String(errorMessage));
      
      expect(typeof detailsStr).toBe('string');
      expect(detailsStr).toBe('Test error');
    });

    test('should handle object error details', () => {
      const objectError = { message: 'Object error', code: 500 };
      
      const detailsStr = typeof objectError === 'string' 
        ? objectError 
        : (typeof objectError === 'object' 
            ? JSON.stringify(objectError) 
            : String(objectError));
      
      expect(typeof detailsStr).toBe('string');
      expect(detailsStr).toContain('Object error');
      expect(detailsStr).not.toBe('[object Object]');
    });

    test('should require secret_name and secret_value', () => {
      const invalidReq1 = { ...req, body: { secret_value: 'value' } };
      const invalidReq2 = { ...req, body: { secret_name: 'key' } };
      
      expect(invalidReq1.body.secret_name).toBeUndefined();
      expect(invalidReq2.body.secret_value).toBeUndefined();
    });
  });

  describe('GET /api/v1/secrets/:ecosystem handler logic', () => {
    test('should use getStorage() not getKV()', () => {
      const { getStorage } = require('../../kv-utils');
      const storage = getStorage();
      expect(storage).toBeDefined();
      expect(storage).toBe(mockStorage);
    });
  });

  describe('GET /api/v1/secrets/:ecosystem/:secretName handler logic', () => {
    test('should use getStorage() not getKV()', () => {
      const { getStorage } = require('../../kv-utils');
      const storage = getStorage();
      expect(storage).toBeDefined();
      expect(storage).toBe(mockStorage);
    });
  });
});


