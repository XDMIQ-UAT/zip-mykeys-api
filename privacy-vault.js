/**
 * Privacy Vault System for MyKeys.zip
 * 
 * Each key can have its own privacy vault for personal/sacred secrets
 * - Vault content is encrypted and private to the key owner
 * - Separate from ring-shared content
 * - Supports personal/sacred secrets that shouldn't be shared even within a ring
 */

const crypto = require('crypto');
const { getKV } = require('./server');
const { getRing } = require('./ring-management');

const ALGORITHM = 'aes-256-gcm';
const VAULT_PREFIX = 'vault:';

/**
 * Generate a vault encryption key from user's master key or password
 * @param {string} userId - User identifier (email or user ID)
 * @param {string} keyName - Key name
 * @param {string} masterKey - Optional master key/password
 * @returns {Buffer} - Encryption key
 */
function generateVaultKey(userId, keyName, masterKey = null) {
  // Use master key if provided, otherwise derive from user/key combination
  const salt = `${userId}:${keyName}`;
  const keyMaterial = masterKey || process.env.MASTER_KEY || crypto.randomBytes(32).toString('hex');
  
  return crypto.pbkdf2Sync(keyMaterial, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt vault content
 * @param {string} content - Content to encrypt
 * @param {Buffer} encryptionKey - Encryption key
 * @returns {Object} - Encrypted data with IV and auth tag
 */
function encryptVaultContent(content, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: ALGORITHM,
  };
}

/**
 * Decrypt vault content
 * @param {Object} encryptedData - Encrypted data with IV and auth tag
 * @param {Buffer} encryptionKey - Encryption key
 * @returns {string} - Decrypted content
 */
function decryptVaultContent(encryptedData, encryptionKey) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey,
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Store a secret in a key's privacy vault
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} userId - User ID (email)
 * @param {string} vaultSecretName - Name of secret in vault
 * @param {string} vaultSecretValue - Value of secret in vault
 * @param {string} masterKey - Optional master key for encryption
 * @returns {Promise<Object>} - Storage result
 */
async function storeVaultSecret(ringId, keyName, userId, vaultSecretName, vaultSecretValue, masterKey = null) {
  if (!ringId || !keyName || !userId || !vaultSecretName) {
    throw new Error('Ring ID, key name, user ID, and vault secret name are required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Verify key exists in ring
    const ring = await getRing(ringId);
    if (!ring) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Generate encryption key for this user's vault
    const encryptionKey = generateVaultKey(userId, keyName, masterKey);
    
    // Encrypt the vault secret
    const encrypted = encryptVaultContent(vaultSecretValue, encryptionKey);
    
    // Store encrypted vault secret
    const vaultKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secret:${vaultSecretName}`;
    await kv.set(vaultKey, JSON.stringify({
      ...encrypted,
      userId,
      keyName,
      ringId,
      vaultSecretName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    
    // Track vault secrets for this key/user combination
    const vaultListKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secrets:list`;
    const existingList = await kv.get(vaultListKey);
    const secretsList = existingList ? JSON.parse(existingList) : [];
    
    if (!secretsList.includes(vaultSecretName)) {
      secretsList.push(vaultSecretName);
      await kv.set(vaultListKey, JSON.stringify(secretsList));
    }
    
    return {
      success: true,
      ringId,
      keyName,
      userId,
      vaultSecretName,
      stored: true,
    };
  } catch (error) {
    console.error('[privacy-vault] Error storing vault secret:', error.message);
    throw error;
  }
}

/**
 * Get a secret from a key's privacy vault
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} userId - User ID (email)
 * @param {string} vaultSecretName - Name of secret in vault
 * @param {string} masterKey - Optional master key for decryption
 * @returns {Promise<string|null>} - Decrypted secret value or null
 */
async function getVaultSecret(ringId, keyName, userId, vaultSecretName, masterKey = null) {
  if (!ringId || !keyName || !userId || !vaultSecretName) {
    throw new Error('Ring ID, key name, user ID, and vault secret name are required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const vaultKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secret:${vaultSecretName}`;
    const encryptedData = await kv.get(vaultKey);
    
    if (!encryptedData) {
      return null;
    }
    
    const data = JSON.parse(encryptedData);
    
    // Generate decryption key
    const encryptionKey = generateVaultKey(userId, keyName, masterKey);
    
    // Decrypt the vault secret
    const decrypted = decryptVaultContent(data, encryptionKey);
    
    return decrypted;
  } catch (error) {
    console.error('[privacy-vault] Error getting vault secret:', error.message);
    throw error;
  }
}

/**
 * List all secrets in a user's vault for a specific key
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} userId - User ID (email)
 * @returns {Promise<Array>} - Array of vault secret names
 */
async function listVaultSecrets(ringId, keyName, userId) {
  if (!ringId || !keyName || !userId) {
    return [];
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      return [];
    }
    
    const vaultListKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secrets:list`;
    const secretsList = await kv.get(vaultListKey);
    
    return secretsList ? JSON.parse(secretsList) : [];
  } catch (error) {
    console.error('[privacy-vault] Error listing vault secrets:', error.message);
    return [];
  }
}

/**
 * Delete a secret from a key's privacy vault
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} userId - User ID (email)
 * @param {string} vaultSecretName - Name of secret in vault
 * @returns {Promise<boolean>} - Success status
 */
async function deleteVaultSecret(ringId, keyName, userId, vaultSecretName) {
  if (!ringId || !keyName || !userId || !vaultSecretName) {
    throw new Error('Ring ID, key name, user ID, and vault secret name are required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const vaultKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secret:${vaultSecretName}`;
    await kv.del(vaultKey);
    
    // Remove from list
    const vaultListKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secrets:list`;
    const existingList = await kv.get(vaultListKey);
    if (existingList) {
      const secretsList = JSON.parse(existingList);
      const filtered = secretsList.filter(name => name !== vaultSecretName);
      await kv.set(vaultListKey, JSON.stringify(filtered));
    }
    
    return true;
  } catch (error) {
    console.error('[privacy-vault] Error deleting vault secret:', error.message);
    throw error;
  }
}

/**
 * Check if a user has a vault for a specific key
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} userId - User ID (email)
 * @returns {Promise<boolean>} - True if vault exists
 */
async function hasVault(ringId, keyName, userId) {
  try {
    const secrets = await listVaultSecrets(ringId, keyName, userId);
    return secrets.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get vault metadata (without decrypting content)
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} userId - User ID (email)
 * @returns {Promise<Object>} - Vault metadata
 */
async function getVaultMetadata(ringId, keyName, userId) {
  try {
    const secrets = await listVaultSecrets(ringId, keyName, userId);
    
    const kv = getKV();
    const metadata = {
      ringId,
      keyName,
      userId,
      secretCount: secrets.length,
      secrets: secrets.map(name => ({
        name,
        // Don't decrypt, just return metadata
      })),
    };
    
    // Get creation/update times for first secret if available
    if (secrets.length > 0 && kv) {
      const firstSecretKey = `${VAULT_PREFIX}ring:${ringId}:key:${keyName}:user:${userId}:secret:${secrets[0]}`;
      const firstSecretData = await kv.get(firstSecretKey);
      if (firstSecretData) {
        const data = JSON.parse(firstSecretData);
        metadata.createdAt = data.createdAt;
        metadata.updatedAt = data.updatedAt;
      }
    }
    
    return metadata;
  } catch (error) {
    console.error('[privacy-vault] Error getting vault metadata:', error.message);
    return null;
  }
}

module.exports = {
  storeVaultSecret,
  getVaultSecret,
  listVaultSecrets,
  deleteVaultSecret,
  hasVault,
  getVaultMetadata,
  generateVaultKey,
  encryptVaultContent,
  decryptVaultContent,
};


