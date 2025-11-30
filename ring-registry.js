/**
 * Ring Registry for MyKeys.zip
 * 
 * Manages ring discovery and mesh connections with minimal metadata
 * Supports anonymous usage while enabling ring-to-ring connections
 * 
 * Key principles:
 * - Rings can discover other rings in the ecosystem
 * - Only bare minimum data is shared (no secrets, no user emails)
 * - Supports anonymous usage patterns
 * - Enables mesh connections for key/token/password management
 */

const { getKV } = require('./server');
const { getRingForEmail, getRing } = require('./ring-management');

const REGISTRY_KEY = 'ring-registry';
const ANONYMOUS_RING_PREFIX = 'anon-';

/**
 * Minimal ring metadata for discovery
 * Contains only public information needed for mesh connections
 */
function createRingMetadata(ring) {
  return {
    ringId: ring.id,
    publicName: ring.publicName || null, // Optional public name
    capabilities: ring.capabilities || [], // What this ring can do (e.g., ['key-rotation', 'token-management'])
    createdAt: ring.createdAt,
    lastSeen: new Date().toISOString(),
    // NO user emails, NO secrets, NO sensitive data
  };
}

/**
 * Register a ring in the ecosystem registry
 * @param {string} ringId - Ring ID
 * @param {Object} metadata - Optional metadata (publicName, capabilities)
 * @returns {Promise<Object>} - Registered ring metadata
 */
async function registerRing(ringId, metadata = {}) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Get ring to ensure it exists
    const ring = await getRing(ringId);
    if (!ring) {
      throw new Error(`Ring ${ringId} does not exist`);
    }
    
    // Get registry
    const registryData = await kv.get(REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    
    // Create or update ring metadata
    const ringMetadata = createRingMetadata({
      ...ring,
      ...metadata,
    });
    
    registry[ringId] = ringMetadata;
    
    // Save registry
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return ringMetadata;
  } catch (error) {
    console.error('[ring-registry] Error registering ring:', error.message);
    throw error;
  }
}

/**
 * Get all registered rings (for discovery)
 * Returns minimal metadata only - no secrets, no user emails
 * @param {boolean} includeAnonymous - Include anonymous rings (default: true)
 * @returns {Promise<Object>} - Object mapping ringId -> metadata
 */
async function discoverRings(includeAnonymous = true) {
  try {
    const kv = getKV();
    if (!kv) return {};
    
    const registryData = await kv.get(REGISTRY_KEY);
    if (!registryData) return {};
    
    const registry = JSON.parse(registryData);
    
    // Filter anonymous rings if requested
    if (!includeAnonymous) {
      const filtered = {};
      for (const [ringId, metadata] of Object.entries(registry)) {
        if (!ringId.startsWith(ANONYMOUS_RING_PREFIX)) {
          filtered[ringId] = metadata;
        }
      }
      return filtered;
    }
    
    return registry;
  } catch (error) {
    console.error('[ring-registry] Error discovering rings:', error.message);
    return {};
  }
}

/**
 * Get metadata for a specific ring
 * @param {string} ringId - Ring ID
 * @returns {Promise<Object|null>} - Ring metadata or null
 */
async function getRingMetadata(ringId) {
  if (!ringId) return null;
  
  try {
    const kv = getKV();
    if (!kv) return null;
    
    const registryData = await kv.get(REGISTRY_KEY);
    if (!registryData) return null;
    
    const registry = JSON.parse(registryData);
    return registry[ringId] || null;
  } catch (error) {
    console.error('[ring-registry] Error getting ring metadata:', error.message);
    return null;
  }
}

/**
 * Update ring metadata (e.g., update lastSeen, capabilities)
 * @param {string} ringId - Ring ID
 * @param {Object} updates - Metadata updates
 * @returns {Promise<Object>} - Updated metadata
 */
async function updateRingMetadata(ringId, updates) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const registryData = await kv.get(REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    
    if (!registry[ringId]) {
      // Auto-register if not in registry
      return await registerRing(ringId, updates);
    }
    
    // Update metadata (only allow safe fields)
    const safeUpdates = {
      publicName: updates.publicName,
      capabilities: updates.capabilities,
      lastSeen: new Date().toISOString(),
    };
    
    registry[ringId] = {
      ...registry[ringId],
      ...safeUpdates,
    };
    
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return registry[ringId];
  } catch (error) {
    console.error('[ring-registry] Error updating ring metadata:', error.message);
    throw error;
  }
}

/**
 * Unregister a ring from the registry
 * @param {string} ringId - Ring ID
 * @returns {Promise<boolean>} - Success status
 */
async function unregisterRing(ringId) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const registryData = await kv.get(REGISTRY_KEY);
    if (!registryData) return true;
    
    const registry = JSON.parse(registryData);
    delete registry[ringId];
    
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return true;
  } catch (error) {
    console.error('[ring-registry] Error unregistering ring:', error.message);
    throw error;
  }
}

/**
 * Create an anonymous ring for temporary/anonymous usage
 * Anonymous rings are isolated but can still participate in mesh connections
 * @param {string} sessionId - Optional session identifier
 * @returns {Promise<Object>} - Created anonymous ring
 */
async function createAnonymousRing(sessionId = null) {
  const { createRing } = require('./ring-management');
  
  const anonRingId = sessionId 
    ? `${ANONYMOUS_RING_PREFIX}${sessionId}`
    : `${ANONYMOUS_RING_PREFIX}${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  // Create ring with no members (anonymous)
  const ring = await createRing(anonRingId, 'anonymous@mykeys.zip', {
    'anonymous@mykeys.zip': ['member'] // Minimal access
  });
  
  // Register in registry
  await registerRing(anonRingId, {
    publicName: 'Anonymous',
    capabilities: ['key-management', 'token-management'],
  });
  
  return ring;
}

/**
 * Check if a ring is anonymous
 * @param {string} ringId - Ring ID
 * @returns {boolean} - True if anonymous
 */
function isAnonymousRing(ringId) {
  return ringId && ringId.startsWith(ANONYMOUS_RING_PREFIX);
}

/**
 * Get ring ID for a user (from email or token)
 * Creates anonymous ring if user not found (for anonymous usage)
 * @param {string} email - User email (optional)
 * @param {boolean} createAnonymous - Create anonymous ring if not found (default: true)
 * @returns {Promise<string|null>} - Ring ID or null
 */
async function getRingForUser(email = null, createAnonymous = true) {
  if (email) {
    const ringId = await getRingForEmail(email);
    if (ringId) {
      return ringId;
    }
  }
  
  // For anonymous usage, create temporary ring
  if (createAnonymous) {
    const anonRing = await createAnonymousRing();
    return anonRing.id;
  }
  
  return null;
}

/**
 * Search rings by capability
 * @param {string} capability - Capability to search for
 * @returns {Promise<Object>} - Object mapping ringId -> metadata
 */
async function searchRingsByCapability(capability) {
  try {
    const allRings = await discoverRings(true);
    const matchingRings = {};
    
    for (const [ringId, metadata] of Object.entries(allRings)) {
      if (metadata.capabilities && metadata.capabilities.includes(capability)) {
        matchingRings[ringId] = metadata;
      }
    }
    
    return matchingRings;
  } catch (error) {
    console.error('[ring-registry] Error searching rings by capability:', error.message);
    return {};
  }
}

module.exports = {
  registerRing,
  discoverRings,
  getRingMetadata,
  updateRingMetadata,
  unregisterRing,
  createAnonymousRing,
  isAnonymousRing,
  getRingForUser,
  searchRingsByCapability,
  ANONYMOUS_RING_PREFIX,
};

