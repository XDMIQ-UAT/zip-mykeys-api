/**
 * Persona Management for MyKeys.zip
 * 
 * Progressive personas: Anonymous → Logged → Named → Profiled
 * Determines service level based on engagement and identity
 * Works for both AI agents and humans
 */

const { getKV } = require('./kv-utils');

const PERSONAS = {
  ANONYMOUS: 'anonymous',
  LOGGED: 'logged',
  NAMED: 'named',
  PROFILED: 'profiled'
};

const PERSONA_FEATURES = {
  anonymous: ['discover', 'read-public'],
  logged: ['discover', 'read-public', 'create-key', 'read-key', 'list-keys'],
  named: ['discover', 'read-public', 'create-key', 'read-key', 'list-keys', 'join-ring', 'create-ring', 'manage-profile'],
  profiled: ['discover', 'read-public', 'create-key', 'read-key', 'list-keys', 'join-ring', 'create-ring', 'manage-profile', 'automated-infrastructure', 'business-features', 'domain-management', 'entity-management']
};

const PERSONA_LIMITS = {
  anonymous: {
    keys: 0,
    rings: 0,
    members: 0,
    apiCallsPerHour: 10
  },
  logged: {
    keys: 10,
    rings: 1,
    members: 5,
    apiCallsPerHour: 100
  },
  named: {
    keys: 100,
    rings: 10,
    members: 50,
    apiCallsPerHour: 1000
  },
  profiled: {
    keys: 10000,
    rings: 100,
    members: 1000,
    apiCallsPerHour: 10000
  }
};

/**
 * Get persona for an identifier
 * @param {string} identifier - User/agent identifier (email or token)
 * @returns {Promise<string>} - Persona level
 */
async function getPersona(identifier) {
  if (!identifier) {
    return PERSONAS.ANONYMOUS;
  }
  
  identifier = identifier.trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) {
      return PERSONAS.ANONYMOUS;
    }
    
    // Check if has account (logged)
    const accountKey = `persona:${identifier}`;
    const accountData = await kv.get(accountKey);
    
    if (!accountData) {
      return PERSONAS.ANONYMOUS;
    }
    
    const account = typeof accountData === 'string' ? JSON.parse(accountData) : accountData;
    
    // Check persona override (if explicitly set)
    if (account.persona) {
      return account.persona;
    }
    
    // Determine persona based on profile completeness
    const hasIdentity = account.name || account.email || account.agentName;
    const hasProfile = account.profile && account.profile.complete;
    const hasBusiness = account.businessEntity || account.domain;
    
    if (hasBusiness && hasProfile) {
      return PERSONAS.PROFILED;
    } else if (hasIdentity && hasProfile) {
      return PERSONAS.NAMED;
    } else if (hasIdentity) {
      return PERSONAS.NAMED;
    } else {
      return PERSONAS.LOGGED;
    }
  } catch (error) {
    console.error('[persona-management] Error getting persona:', error.message);
    return PERSONAS.ANONYMOUS;
  }
}

/**
 * Check if persona can access a feature
 * @param {string} persona - Persona level
 * @param {string} feature - Feature name
 * @returns {boolean} - True if persona can access feature
 */
function canAccessFeature(persona, feature) {
  const features = PERSONA_FEATURES[persona] || [];
  return features.includes(feature);
}

/**
 * Get limits for a persona
 * @param {string} persona - Persona level
 * @returns {Object} - Limits object
 */
function getPersonaLimits(persona) {
  return PERSONA_LIMITS[persona] || PERSONA_LIMITS.anonymous;
}

/**
 * Upgrade persona for an identifier
 * @param {string} identifier - User/agent identifier
 * @param {string} targetPersona - Target persona level
 * @param {Object} data - Data needed for upgrade
 * @returns {Promise<Object>} - Upgrade result
 */
async function upgradePersona(identifier, targetPersona, data = {}) {
  if (!identifier) {
    throw new Error('Identifier is required');
  }
  
  identifier = identifier.trim().toLowerCase();
  
  const currentPersona = await getPersona(identifier);
  const personaOrder = [PERSONAS.ANONYMOUS, PERSONAS.LOGGED, PERSONAS.NAMED, PERSONAS.PROFILED];
  const currentIndex = personaOrder.indexOf(currentPersona);
  const targetIndex = personaOrder.indexOf(targetPersona);
  
  if (targetIndex <= currentIndex) {
    return {
      success: false,
      message: `Cannot downgrade from ${currentPersona} to ${targetPersona}`,
      currentPersona,
      targetPersona
    };
  }
  
  // Validate upgrade requirements
  const requirements = getUpgradeRequirements(targetPersona);
  const missing = requirements.filter(req => !data[req.field]);
  
  if (missing.length > 0) {
    return {
      success: false,
      message: `Missing required fields for upgrade: ${missing.map(r => r.field).join(', ')}`,
      requirements: missing,
      currentPersona,
      targetPersona
    };
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const accountKey = `persona:${identifier}`;
    const accountData = await kv.get(accountKey);
    const account = accountData ? (typeof accountData === 'string' ? JSON.parse(accountData) : accountData) : {};
    
    // Update account with new data
    account.persona = targetPersona;
    account.updatedAt = new Date().toISOString();
    
    // Update based on target persona
    if (targetPersona === PERSONAS.NAMED || targetPersona === PERSONAS.PROFILED) {
      account.name = data.name || account.name;
      account.email = data.email || account.email;
      account.agentName = data.agentName || account.agentName;
      account.entityType = data.entityType || account.entityType || 'person';
    }
    
    if (targetPersona === PERSONAS.PROFILED) {
      account.profile = {
        complete: true,
        businessEntity: data.businessEntity || account.businessEntity,
        domain: data.domain || account.domain,
        company: data.company || account.company,
        ...data.profile
      };
    }
    
    // Track persona history
    if (!account.personaHistory) {
      account.personaHistory = [];
    }
    account.personaHistory.push({
      persona: targetPersona,
      upgradedAt: new Date().toISOString(),
      upgradedFrom: currentPersona
    });
    
    await kv.set(accountKey, JSON.stringify(account));
    
    // Get unlocked features
    const previousFeatures = PERSONA_FEATURES[currentPersona] || [];
    const newFeatures = PERSONA_FEATURES[targetPersona] || [];
    const unlockedFeatures = newFeatures.filter(f => !previousFeatures.includes(f));
    
    return {
      success: true,
      previousPersona: currentPersona,
      currentPersona: targetPersona,
      unlockedFeatures,
      limits: getPersonaLimits(targetPersona)
    };
  } catch (error) {
    console.error('[persona-management] Error upgrading persona:', error.message);
    throw error;
  }
}

/**
 * Get upgrade requirements for a persona
 * @param {string} targetPersona - Target persona level
 * @returns {Array} - Array of requirement objects
 */
function getUpgradeRequirements(targetPersona) {
  const requirements = {
    [PERSONAS.LOGGED]: [],
    [PERSONAS.NAMED]: [
      { field: 'name', description: 'Name or agent name' }
    ],
    [PERSONAS.PROFILED]: [
      { field: 'name', description: 'Name or agent name' },
      { field: 'businessEntity', description: 'Business entity ID' },
      { field: 'domain', description: 'Domain name' }
    ]
  };
  
  return requirements[targetPersona] || [];
}

/**
 * Create or update account (for logged persona)
 * @param {string} identifier - User/agent identifier
 * @param {Object} data - Account data
 * @returns {Promise<Object>} - Account object
 */
async function createAccount(identifier, data = {}) {
  if (!identifier) {
    throw new Error('Identifier is required');
  }
  
  identifier = identifier.trim().toLowerCase();
  
  // Check if this is an AI agent - must be delegated by verified human
  if (data.entityType === 'agent' || data.type === 'agent') {
    if (!data.delegatedBy) {
      throw new Error('AI agent accounts must be delegated by a verified human account');
    }
    
    // Verify delegating human account is verified
    const humanAccount = await getAccount(data.delegatedBy);
    if (!humanAccount || !humanAccount.verified || !humanAccount.verificationMethod) {
      throw new Error('AI agent accounts must be delegated by a verified human account (Google/Microsoft OAuth)');
    }
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const accountKey = `persona:${identifier}`;
    const existingData = await kv.get(accountKey);
    const existing = existingData ? (typeof existingData === 'string' ? JSON.parse(existingData) : existingData) : {};
    
    const account = {
      identifier,
      persona: PERSONAS.LOGGED,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...existing,
      ...data
    };
    
    // For AI agents, track delegation
    if (account.entityType === 'agent' || account.type === 'agent') {
      account.delegatedBy = data.delegatedBy;
      account.delegatedAt = data.delegatedAt || new Date().toISOString();
      account.canDelegate = false; // Agents cannot delegate other agents
    }
    
    await kv.set(accountKey, JSON.stringify(account));
    
    // If this is a human account delegating an agent, track the delegation
    if (data.delegatedBy && (data.entityType === 'agent' || data.type === 'agent')) {
      await trackAgentDelegation(data.delegatedBy, identifier);
    }
    
    return account;
  } catch (error) {
    console.error('[persona-management] Error creating account:', error.message);
    throw error;
  }
}

/**
 * Get account data
 * @param {string} identifier - Account identifier
 * @returns {Promise<Object|null>} - Account object or null
 */
async function getAccount(identifier) {
  if (!identifier) return null;
  
  identifier = identifier.trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) return null;
    
    const accountKey = `persona:${identifier}`;
    const accountData = await kv.get(accountKey);
    
    if (!accountData) return null;
    
    return typeof accountData === 'string' ? JSON.parse(accountData) : accountData;
  } catch (error) {
    console.error('[persona-management] Error getting account:', error.message);
    return null;
  }
}

/**
 * Track agent delegation in human account
 * @param {string} humanIdentifier - Human account identifier
 * @param {string} agentIdentifier - Agent identifier
 */
async function trackAgentDelegation(humanIdentifier, agentIdentifier) {
  try {
    const kv = getKV();
    if (!kv) return;
    
    const humanAccount = await getAccount(humanIdentifier);
    if (!humanAccount) return;
    
    if (!humanAccount.delegatedAgents) {
      humanAccount.delegatedAgents = [];
    }
    
    if (!humanAccount.delegatedAgents.includes(agentIdentifier)) {
      humanAccount.delegatedAgents.push(agentIdentifier);
      humanAccount.updatedAt = new Date().toISOString();
      
      const accountKey = `persona:${humanIdentifier}`;
      await kv.set(accountKey, JSON.stringify(humanAccount));
    }
  } catch (error) {
    console.error('[persona-management] Error tracking agent delegation:', error.message);
  }
}

/**
 * Verify human account (Google/Microsoft OAuth)
 * @param {string} identifier - Human account identifier
 * @param {string} verificationMethod - 'google' or 'microsoft'
 * @param {string} verificationId - Provider user ID
 * @returns {Promise<Object>} - Updated account
 */
async function verifyHumanAccount(identifier, verificationMethod, verificationId) {
  if (!identifier || !verificationMethod || !verificationId) {
    throw new Error('Identifier, verification method, and verification ID are required');
  }
  
  identifier = identifier.trim().toLowerCase();
  
  if (verificationMethod !== 'google' && verificationMethod !== 'microsoft') {
    throw new Error('Verification method must be google or microsoft');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const account = await getAccount(identifier);
    if (!account) {
      throw new Error('Account not found');
    }
    
    // Only humans can be verified
    if (account.entityType === 'agent' || account.type === 'agent') {
      throw new Error('AI agent accounts cannot be verified - they must be delegated by verified humans');
    }
    
    account.verified = true;
    account.verificationMethod = verificationMethod;
    account.verificationId = verificationId;
    account.verifiedAt = new Date().toISOString();
    account.canDelegate = true; // Verified humans can delegate agents
    account.updatedAt = new Date().toISOString();
    
    const accountKey = `persona:${identifier}`;
    await kv.set(accountKey, JSON.stringify(account));
    
    return account;
  } catch (error) {
    console.error('[persona-management] Error verifying human account:', error.message);
    throw error;
  }
}

/**
 * Check if account can delegate AI agents
 * @param {string} identifier - Account identifier
 * @returns {Promise<boolean>} - True if can delegate
 */
async function canDelegateAgent(identifier) {
  const account = await getAccount(identifier);
  if (!account) return false;
  
  // Only verified humans can delegate
  return account.type === 'person' 
    && account.verified === true
    && account.verificationMethod !== null
    && account.canDelegate === true;
}

/**
 * Get persona info including features and limits
 * @param {string} identifier - User/agent identifier
 * @returns {Promise<Object>} - Persona info
 */
async function getPersonaInfo(identifier) {
  const persona = await getPersona(identifier);
  const features = PERSONA_FEATURES[persona] || [];
  const limits = getPersonaLimits(persona);
  
  const personaOrder = [PERSONAS.ANONYMOUS, PERSONAS.LOGGED, PERSONAS.NAMED, PERSONAS.PROFILED];
  const currentIndex = personaOrder.indexOf(persona);
  const nextPersona = currentIndex < personaOrder.length - 1 ? personaOrder[currentIndex + 1] : null;
  const upgradeRequirements = nextPersona ? getUpgradeRequirements(nextPersona) : [];
  
  return {
    persona,
    features,
    limits,
    nextPersona,
    upgradeRequirements,
    canUpgrade: nextPersona !== null
  };
}

module.exports = {
  getPersona,
  canAccessFeature,
  getPersonaLimits,
  upgradePersona,
  getUpgradeRequirements,
  createAccount,
  getAccount,
  getPersonaInfo,
  verifyHumanAccount,
  canDelegateAgent,
  trackAgentDelegation,
  PERSONAS,
  PERSONA_FEATURES,
  PERSONA_LIMITS
};

