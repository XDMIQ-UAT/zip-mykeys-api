/**
 * Unit tests for cli-handler.js
 * Tests CLI command execution with proper mocking
 */

const mockStorage = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

// Mock kv-utils
jest.mock('../../kv-utils', () => ({
  getStorage: jest.fn(() => mockStorage)
}));

// Mock https/http for API requests
jest.mock('https', () => ({
  request: jest.fn()
}));

jest.mock('http', () => ({
  request: jest.fn()
}));

const { executeCLICommand } = require('../../cli-handler');

describe('CLI Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.MYKEYS_URL;
  });

  describe('executeCLICommand', () => {
    const mockContext = {
      email: 'test@example.com',
      ringId: 'ring-123',
      token: 'test-token-123'
    };

    test('should require authentication token', async () => {
      const result = await executeCLICommand('list', [], { email: 'test@example.com', ringId: 'ring-123' });
      expect(result.error).toBe('Authentication required');
    });

    test('should handle help command', async () => {
      const result = await executeCLICommand('help', [], mockContext);
      expect(result.output).toContain('MyKeys CLI Commands');
      expect(result.output).toContain('mykeys set');
      expect(result.error).toBeFalsy();
    });

    test('should handle set command with correct arguments', async () => {
      const https = require('https');
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({ success: true, message: 'Secret stored' }));
          }
          if (event === 'end') {
            callback();
          }
        })
      };
      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await executeCLICommand('set', ['shared', 'test-key', 'test-value'], mockContext);
      
      expect(result.error).toBeFalsy();
      expect(result.output).toContain('Secret \'test-key\' set successfully');
      expect(https.request).toHaveBeenCalled();
    });

    test('should handle set command with missing arguments', async () => {
      const result = await executeCLICommand('set', ['shared'], mockContext);
      expect(result.error).toContain('Usage: mykeys set');
    });

    test('should handle list command', async () => {
      const https = require('https');
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({ secrets: [] }));
          }
          if (event === 'end') {
            callback();
          }
        })
      };
      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await executeCLICommand('list', [], mockContext);
      expect(result.output).toContain('No secrets found');
      expect(result.error).toBeFalsy();
    });

    test('should handle get command with correct arguments', async () => {
      const https = require('https');
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify({ secret_value: 'secret-value' }));
          }
          if (event === 'end') {
            callback();
          }
        })
      };
      const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await executeCLICommand('get', ['shared', 'test-key'], mockContext);
      expect(result.output).toBe('secret-value');
      expect(result.error).toBeFalsy();
    });

    test('should handle get command with missing arguments', async () => {
      const result = await executeCLICommand('get', ['shared'], mockContext);
      expect(result.error).toContain('Usage: mykeys get');
    });

    test('should handle unknown command', async () => {
      const result = await executeCLICommand('unknown', [], mockContext);
      expect(result.error).toContain('Unknown command');
    });
  });
});

