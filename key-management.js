/**
 * Key Management for MyKeys.zip
 * 
 * Manages keys (secrets) within and between rings
 * - Content belongs to the ring, not individual keys
 * - Keys can be moved or copied between rings
 * - Content is shared within a ring (all members can access)
 * - Content is isolated between rings (no cross-ring access)
 */

const { getKV } = require('./server');
const { getRing, getRingForEmail } = require('./ring-management');
const { getSecret, storeSecret } = require('./server');

/**
 * Check if user has access to a ring's content
 * @param {string} email - User email
 * @param {string} ringId - Ring ID
 * @returns {Promise<boolean>} - True if user has access
 */
async function hasRingAccess(email, ringId) {
  if (!email || !ringId) return false;
  
  try {
    const ring = await getRing(ringId);
    if (!ring) return false;
    
    // Check if user is a member of the ring
    email = email.trim().toLowerCase();
    return ring.members && ring.members[email] !== undefined;
  } catch (error) {
    console.error('[key-management] Error checking ring access:', error.message);
    return false;
  }
}

/**
 * List all keys (secrets) in a ring
 * @param {string} ringId - Ring ID
 * @returns {Promise<Array>} - Array of key names
 */
async function listRingKeys(ringId) {
  if (!ringId) return [];
  
  try {
    const kv = getKV();
    if (!kv) return [];
    
    // Get all secrets for this ring
    // Pattern: ring:{ringId}:secret:*
    const pattern = `ring:${ringId}:secret:`;
    const keys = [];
    
    // Note: Redis/KV doesn't support pattern matching directly
    // This is a simplified implementation - in production, you'd use SCAN or similar
    // For now, we'll need to track keys separately
    
    // Try to get a list of keys from metadata
    const metadataKey = `ring:${ringId}:keys:list`;
    const keysList = await kv.get(metadataKey);
    
    if (keysList) {
      return JSON.parse(keysList);
    }
    
    return [];
  } catch (error) {
    console.error('[key-management] Error listing ring keys:', error.message);
    return [];
  }
}

/**
 * Register a key in the ring's key list
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @returns {Promise<boolean>} - Success status
 */
async function registerRingKey(ringId, keyName) {
  if (!ringId || !keyName) return false;
  
  try {
    const kv = getKV();
    if (!kv) return false;
    
    const metadataKey = `ring:${ringId}:keys:list`;
    const existingList = await kv.get(metadataKey);
    const keys = existingList ? JSON.parse(existingList) : [];
    
    if (!keys.includes(keyName)) {
      keys.push(keyName);
      await kv.set(metadataKey, JSON.stringify(keys));
    }
    
    return true;
  } catch (error) {
    console.error('[key-management] Error registering ring key:', error.message);
    return false;
  }
}

/**
 * Copy a key from one ring to another
 * @param {string} sourceRingId - Source ring ID
 * @param {string} targetRingId - Target ring ID
 * @param {string} keyName - Key name to copy
 * @param {string} newKeyName - Optional new name for copied key
 * @returns {Promise<Object>} - Copy result
 */
async function copyKeyBetweenRings(sourceRingId, targetRingId, keyName, newKeyName = null) {
  if (!sourceRingId || !targetRingId || !keyName) {
    throw new Error('Source ring ID, target ring ID, and key name are required');
  }
  
  // Verify rings exist
  const sourceRing = await getRing(sourceRingId);
  const targetRing = await getRing(targetRingId);
  
  if (!sourceRing) {
    throw new Error(`Source ring ${sourceRingId} not found`);
  }
  
  if (!targetRing) {
    throw new Error(`Target ring ${targetRingId} not found`);
  }
  
  // Get secret from source ring
  const secretValue = await getSecret(keyName, sourceRingId);
  
  if (!secretValue) {
    throw new Error(`Key ${keyName} not found in source ring ${sourceRingId}`);
  }
  
  // Get metadata if available
  const kv = getKV();
  let metadata = {};
  if (kv) {
    const metaKey = `ring:${sourceRingId}:secret:${keyName}:meta`;
    const metaData = await kv.get(metaKey);
    if (metaData) {
      metadata = JSON.parse(metaData);
    }
  }
  
  // Determine target key name
  const targetKeyName = newKeyName || keyName;
  
  // Store in target ring
  const labels = {
    ...metadata,
    ringId: targetRingId,
    copiedFrom: sourceRingId,
    copiedAt: new Date().toISOString(),
  };
  
  const result = await storeSecret(targetKeyName, secretValue, labels, targetRingId);
  
  // Register key in target ring
  await registerRingKey(targetRingId, targetKeyName);
  
  return {
    success: true,
    sourceRingId,
    targetRingId,
    sourceKeyName: keyName,
    targetKeyName,
    copied: result.created,
  };
}

/**
 * Move a key from one ring to another
 * @param {string} sourceRingId - Source ring ID
 * @param {string} targetRingId - Target ring ID
 * @param {string} keyName - Key name to move
 * @param {string} newKeyName - Optional new name for moved key
 * @returns {Promise<Object>} - Move result
 */
async function moveKeyBetweenRings(sourceRingId, targetRingId, keyName, newKeyName = null) {
  if (!sourceRingId || !targetRingId || !keyName) {
    throw new Error('Source ring ID, target ring ID, and key name are required');
  }
  
  // Copy key to target ring
  const copyResult = await copyKeyBetweenRings(sourceRingId, targetRingId, keyName, newKeyName);
  
  // Delete from source ring
  const kv = getKV();
  if (kv) {
    const sourceKey = `ring:${sourceRingId}:secret:${keyName}`;
    const sourceMetaKey = `ring:${sourceRingId}:secret:${keyName}:meta`;
    
    await kv.del(sourceKey);
    await kv.del(sourceMetaKey);
    
    // Remove from key list
    const metadataKey = `ring:${sourceRingId}:keys:list`;
    const existingList = await kv.get(metadataKey);
    if (existingList) {
      const keys = JSON.parse(existingList);
      const filteredKeys = keys.filter(k => k !== keyName);
      await kv.set(metadataKey, JSON.stringify(filteredKeys));
    }
  }
  
  // Also delete from GCP if using GCP storage
  // (This would require additional implementation)
  
  return {
    success: true,
    sourceRingId,
    targetRingId,
    sourceKeyName: keyName,
    targetKeyName: copyResult.targetKeyName,
    moved: true,
  };
}

/**
 * Share a key within a ring (all members already have access, this is for explicit sharing)
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} sharedBy - Email of user sharing the key
 * @returns {Promise<Object>} - Share result
 */
async function shareKeyWithinRing(ringId, keyName, sharedBy) {
  if (!ringId || !keyName || !sharedBy) {
    throw new Error('Ring ID, key name, and sharedBy email are required');
  }
  
  const ring = await getRing(ringId);
  if (!ring) {
    throw new Error(`Ring ${ringId} not found`);
  }
  
  // Verify key exists
  const secretValue = await getSecret(keyName, ringId);
  if (!secretValue) {
    throw new Error(`Key ${keyName} not found in ring ${ringId}`);
  }
  
  // All members already have access (content belongs to ring)
  // This function is mainly for tracking/audit purposes
  
  const kv = getKV();
  if (kv) {
    const shareKey = `ring:${ringId}:key:${keyName}:shared`;
    await kv.set(shareKey, JSON.stringify({
      sharedBy,
      sharedAt: new Date().toISOString(),
      ringId,
      accessibleTo: Object.keys(ring.members || {}),
    }));
  }
  
  return {
    success: true,
    ringId,
    keyName,
    sharedBy,
    accessibleTo: Object.keys(ring.members || {}),
    message: 'Key is accessible to all ring members',
  };
}

/**
 * Get key sharing information
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @returns {Promise<Object|null>} - Sharing information
 */
async function getKeySharingInfo(ringId, keyName) {
  if (!ringId || !keyName) return null;
  
  try {
    const ring = await getRing(ringId);
    if (!ring) return null;
    
    const kv = getKV();
    if (kv) {
      const shareKey = `ring:${ringId}:key:${keyName}:shared`;
      const shareData = await kv.get(shareKey);
      
      if (shareData) {
        return JSON.parse(shareData);
      }
    }
    
    // Default: accessible to all ring members
    return {
      ringId,
      keyName,
      accessibleTo: Object.keys(ring.members || {}),
      shared: true,
      message: 'Key is accessible to all ring members',
    };
  } catch (error) {
    console.error('[key-management] Error getting key sharing info:', error.message);
    return null;
  }
}

module.exports = {
  hasRingAccess,
  listRingKeys,
  registerRingKey,
  copyKeyBetweenRings,
  moveKeyBetweenRings,
  shareKeyWithinRing,
  getKeySharingInfo,
};

