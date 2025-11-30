/**
 * Unit tests for persona-management.js
 */

// Mock KV storage before requiring persona-management
const mockKV = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

jest.mock('../../kv-utils', () => ({
  getKV: jest.fn(() => mockKV)
}));

const {
  getPersona,
  canAccessFeature,
  getPersonaLimits,
  upgradePersona,
  createAccount,
  getAccount,
  verifyHumanAccount,
  canDelegateAgent,
  PERSONAS,
  PERSONA_FEATURES
} = require('../../persona-management');

describe('Persona Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPersona', () => {
    test('should return anonymous for null identifier', async () => {
      const persona = await getPersona(null);
      expect(persona).toBe(PERSONAS.ANONYMOUS);
    });

    test('should return anonymous for non-existent account', async () => {
      mockKV.get.mockResolvedValue(null);
      
      const persona = await getPersona('test@example.com');
      expect(persona).toBe(PERSONAS.ANONYMOUS);
    });

    test('should return logged for account without identity', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'test@example.com',
        persona: PERSONAS.LOGGED
      }));
      
      const persona = await getPersona('test@example.com');
      expect(persona).toBe(PERSONAS.LOGGED);
    });

    test('should return named for account with identity', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com'
      }));
      
      const persona = await getPersona('test@example.com');
      expect(persona).toBe(PERSONAS.NAMED);
    });

    test('should return profiled for account with business', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'test@example.com',
        name: 'Test User',
        email: 'test@example.com',
        profile: { complete: true },
        businessEntity: 'entity-123',
        domain: 'example.com'
      }));
      
      const persona = await getPersona('test@example.com');
      expect(persona).toBe(PERSONAS.PROFILED);
    });
  });

  describe('canAccessFeature', () => {
    test('anonymous should access discover', () => {
      expect(canAccessFeature(PERSONAS.ANONYMOUS, 'discover')).toBe(true);
    });

    test('anonymous should not access create-key', () => {
      expect(canAccessFeature(PERSONAS.ANONYMOUS, 'create-key')).toBe(false);
    });

    test('logged should access create-key', () => {
      expect(canAccessFeature(PERSONAS.LOGGED, 'create-key')).toBe(true);
    });

    test('named should access join-ring', () => {
      expect(canAccessFeature(PERSONAS.NAMED, 'join-ring')).toBe(true);
    });

    test('profiled should access automated-infrastructure', () => {
      expect(canAccessFeature(PERSONAS.PROFILED, 'automated-infrastructure')).toBe(true);
    });
  });

  describe('getPersonaLimits', () => {
    test('should return anonymous limits', () => {
      const limits = getPersonaLimits(PERSONAS.ANONYMOUS);
      expect(limits.keys).toBe(0);
      expect(limits.rings).toBe(0);
    });

    test('should return logged limits', () => {
      const limits = getPersonaLimits(PERSONAS.LOGGED);
      expect(limits.keys).toBe(10);
      expect(limits.rings).toBe(1);
    });

    test('should return profiled limits', () => {
      const limits = getPersonaLimits(PERSONAS.PROFILED);
      expect(limits.keys).toBe(10000);
      expect(limits.rings).toBe(100);
    });
  });

  describe('createAccount', () => {
    test('should create human account', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.set.mockResolvedValue(true);
      
      const account = await createAccount('test@example.com', {
        type: 'person',
        email: 'test@example.com'
      });
      
      expect(account.identifier).toBe('test@example.com');
      expect(account.type).toBe('person');
      expect(mockKV.set).toHaveBeenCalled();
    });

    test('should reject AI agent without delegation', async () => {
      mockKV.get.mockResolvedValue(null);
      
      await expect(
        createAccount('agent-token-123', {
          type: 'agent',
          entityType: 'agent'
        })
      ).rejects.toThrow('AI agent accounts must be delegated by a verified human account');
    });

    test('should create AI agent with delegation', async () => {
      // Mock human account (verified) - first call for agent, second for human
      mockKV.get.mockImplementation((key) => {
        if (key === 'persona:human@example.com') {
          return Promise.resolve(JSON.stringify({
            identifier: 'human@example.com',
            verified: true,
            verificationMethod: 'google',
            canDelegate: true
          }));
        }
        return Promise.resolve(null);
      });
      mockKV.set.mockResolvedValue(true);
      
      const account = await createAccount('agent-token-123', {
        type: 'agent',
        entityType: 'agent',
        delegatedBy: 'human@example.com'
      });
      
      expect(account.delegatedBy).toBe('human@example.com');
      expect(account.canDelegate).toBe(false);
    });
  });

  describe('verifyHumanAccount', () => {
    test('should verify human account with Google', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'test@example.com',
        type: 'person'
      }));
      mockKV.set.mockResolvedValue(true);
      
      const account = await verifyHumanAccount('test@example.com', 'google', 'google-id-123');
      
      expect(account.verified).toBe(true);
      expect(account.verificationMethod).toBe('google');
      expect(account.canDelegate).toBe(true);
    });

    test('should reject verification for AI agent', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'agent-token-123',
        type: 'agent'
      }));
      
      await expect(
        verifyHumanAccount('agent-token-123', 'google', 'google-id-123')
      ).rejects.toThrow('AI agent accounts cannot be verified');
    });
  });

  describe('canDelegateAgent', () => {
    test('should return false for non-existent account', async () => {
      mockKV.get.mockResolvedValue(null);
      
      const canDelegate = await canDelegateAgent('test@example.com');
      expect(canDelegate).toBe(false);
    });

    test('should return false for unverified human', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'test@example.com',
        type: 'person',
        verified: false
      }));
      
      const canDelegate = await canDelegateAgent('test@example.com');
      expect(canDelegate).toBe(false);
    });

    test('should return true for verified human', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({
        identifier: 'test@example.com',
        type: 'person',
        verified: true,
        verificationMethod: 'google',
        canDelegate: true
      }));
      
      const canDelegate = await canDelegateAgent('test@example.com');
      expect(canDelegate).toBe(true);
    });
  });
});

