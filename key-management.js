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
 * Simplified: shared (visible to all members) or private (visible to creator only)
 * HIPAA-compliant separation of concerns
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} secretValue - Secret value (optional)
 * @param {Object} labels - Key labels (optional)
 * @param {string} createdBy - Identifier of user creating the key
 * @param {boolean} isShared - Whether key is shared (default: true for HIPAA compliance)
 * @returns {Promise<boolean>} - Success status
 */
async function registerRingKey(ringId, keyName, secretValue = null, labels = {}, createdBy = null, isShared = true) {
  if (!ringId || !keyName) return false;
  
  try {
    const kv = getKV();
    if (!kv) return false;
    
    const metadataKey = `ring:${ringId}:keys:list`;
    const existingList = await kv.get(metadataKey);
    const keys = existingList ? JSON.parse(existingList) : [];
    
    const isNewKey = !keys.includes(keyName);
    
    if (isNewKey) {
      keys.push(keyName);
      await kv.set(metadataKey, JSON.stringify(keys));
      
      // Simplified visibility: shared (all members) or private (creator only)
      const visibilityKey = `ring:${ringId}:key:${keyName}:visibility`;
      await kv.set(visibilityKey, JSON.stringify({
        createdBy: createdBy ? createdBy.trim().toLowerCase() : null,
        isShared: isShared, // Shared keys visible to all members, private keys only to creator
        createdAt: new Date().toISOString()
      }));
      
      // Track analytics if secret value is provided
      if (secretValue !== null) {
        try {
          const { trackKeyAddition } = require('./ring-registry');
          await trackKeyAddition(ringId, keyName, secretValue, labels);
        } catch (analyticsError) {
          console.warn('[key-management] Error tracking analytics:', analyticsError.message);
        }
      }
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
 * Simplified: shared (all members) or private (creator only)
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
      // Check visibility settings
      const visibilityKey = `ring:${ringId}:key:${keyName}:visibility`;
      const visibilityData = await kv.get(visibilityKey);
      
      if (visibilityData) {
        const visibility = JSON.parse(visibilityData);
        return {
          ringId,
          keyName,
          createdBy: visibility.createdBy,
          isShared: visibility.isShared === true,
          createdAt: visibility.createdAt,
          updatedAt: visibility.updatedAt,
          message: visibility.isShared === true
            ? 'Key is shared with all ring members'
            : `Key is private (visible only to creator: ${visibility.createdBy})`
        };
      }
    }
    
    // Default: shared (backward compatibility)
    return {
      ringId,
      keyName,
      isShared: true,
      message: 'Key is shared with all ring members',
    };
  } catch (error) {
    console.error('[key-management] Error getting key sharing info:', error.message);
    return null;
  }
}

/**
 * Check if a user can view a key
 * Simplified: shared keys visible to all members, private keys only to creator
 * HIPAA-compliant separation of concerns
 * @param {string} identifier - User identifier (email or token)
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @returns {Promise<boolean>} - True if user can view the key
 */
async function canUserViewKey(identifier, ringId, keyName) {
  if (!identifier || !ringId || !keyName) return false;
  
  identifier = identifier.trim().toLowerCase();
  
  try {
    const ring = await getRing(ringId);
    if (!ring) return false;
    
    // Check if user is a member of the ring
    if (!ring.members[identifier]) {
      return false;
    }
    
    const kv = getKV();
    if (!kv) return true; // Fallback to allowing access if KV unavailable
    
    // Check visibility settings
    const visibilityKey = `ring:${ringId}:key:${keyName}:visibility`;
    const visibilityData = await kv.get(visibilityKey);
    
    if (visibilityData) {
      const visibility = JSON.parse(visibilityData);
      
      // Shared keys are visible to all members
      if (visibility.isShared === true) {
        return true;
      }
      
      // Private keys only visible to creator
      if (visibility.createdBy === identifier) {
        return true;
      }
      
      return false;
    }
    
    // Legacy: if no visibility data, default to shared (backward compatibility)
    return true;
  } catch (error) {
    console.error('[key-management] Error checking key visibility:', error.message);
    return false;
  }
}

/**
 * Request access to a private key
 * Simplified: admins can request access to private keys
 * HIPAA-compliant audit trail
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} requestedBy - Identifier of user requesting access
 * @param {string} reason - Reason for request (e.g., "VPN setup", "Home automation")
 * @returns {Promise<Object>} - Request result
 */
async function requestKeyAccess(ringId, keyName, requestedBy, reason = '') {
  if (!ringId || !keyName || !requestedBy) {
    throw new Error('Ring ID, key name, and requester identifier are required');
  }
  
  requestedBy = requestedBy.trim().toLowerCase();
  
  try {
    const ring = await getRing(ringId);
    if (!ring) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Verify requester is a ring admin
    const requesterRole = ring.members[requestedBy]?.role;
    if (requesterRole !== 'admin') {
      throw new Error('Only ring admins can request key access');
    }
    
    // Get key visibility info
    const visibilityInfo = await getKeySharingInfo(ringId, keyName);
    if (!visibilityInfo) {
      throw new Error(`Key ${keyName} not found in ring ${ringId}`);
    }
    
    // If already shared, return success
    if (visibilityInfo.isShared === true) {
      return {
        success: true,
        alreadyVisible: true,
        message: 'Key is already shared with all members'
      };
    }
    
    // Create access request
    const kv = getKV();
    if (kv) {
      const requestKey = `ring:${ringId}:key:${keyName}:request:${requestedBy}`;
      await kv.set(requestKey, JSON.stringify({
        requestedBy,
        keyName,
        ringId,
        reason: reason || 'No reason provided',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      }));
      
      // Notify key creator (if different from requester)
      if (visibilityInfo.createdBy && visibilityInfo.createdBy !== requestedBy) {
        const notificationKey = `ring:${ringId}:key:${keyName}:notifications`;
        const notifications = await kv.get(notificationKey);
        const notificationList = notifications ? JSON.parse(notifications) : [];
        notificationList.push({
          type: 'access_request',
          requestedBy,
          reason: reason || 'No reason provided',
          requestedAt: new Date().toISOString()
        });
        await kv.set(notificationKey, JSON.stringify(notificationList));
      }
    }
    
    // Audit log for HIPAA compliance
    const { logAuditEvent } = require('./ring-management');
    await logAuditEvent('key_access_requested', {
      ringId,
      keyName,
      requestedBy,
      reason: reason || 'No reason provided'
    });
    
    return {
      success: true,
      requested: true,
      message: `Access request sent. Key creator will be notified.`,
      keyCreator: visibilityInfo.createdBy
    };
  } catch (error) {
    console.error('[key-management] Error requesting key access:', error.message);
    throw error;
  }
}

/**
 * Grant access to a private key (make it shared)
 * Simplified: key creator can make private key shared
 * HIPAA-compliant audit trail
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} grantedBy - Identifier of user granting access (must be key creator)
 * @returns {Promise<Object>} - Grant result
 */
async function grantKeyAccess(ringId, keyName, grantedBy) {
  if (!ringId || !keyName || !grantedBy) {
    throw new Error('Ring ID, key name, and grantedBy are required');
  }
  
  grantedBy = grantedBy.trim().toLowerCase();
  
  try {
    const visibilityInfo = await getKeySharingInfo(ringId, keyName);
    if (!visibilityInfo) {
      throw new Error(`Key ${keyName} not found in ring ${ringId}`);
    }
    
    // Verify grantor is the key creator
    if (visibilityInfo.createdBy !== grantedBy) {
      throw new Error('Only the key creator can grant access');
    }
    
    // Make key shared (visible to all members)
    const kv = getKV();
    if (kv) {
      const visibilityKey = `ring:${ringId}:key:${keyName}:visibility`;
      await kv.set(visibilityKey, JSON.stringify({
        createdBy: grantedBy,
        isShared: true, // Now shared with all members
        createdAt: visibilityInfo.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      // Remove pending requests (all resolved by making it shared)
      // Note: In a real implementation, you'd want to clean up individual requests
    }
    
    // Audit log for HIPAA compliance
    const { logAuditEvent } = require('./ring-management');
    await logAuditEvent('key_access_granted', {
      ringId,
      keyName,
      grantedBy,
      action: 'made_shared'
    });
    
    return {
      success: true,
      message: `Key is now shared with all ring members`,
      isShared: true
    };
  } catch (error) {
    console.error('[key-management] Error granting key access:', error.message);
    throw error;
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
  canUserViewKey,
  requestKeyAccess,
  grantKeyAccess,
};


