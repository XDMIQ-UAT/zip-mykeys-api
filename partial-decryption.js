/**
 * Partial Decryption with Key Chain Support
 * 
 * Implements hierarchical encryption where:
 * - Exact key decrypts everything
 * - Related keys from the same chain can decrypt partial information
 *   (e.g., expired/deceased entities but not living ones)
 * 
 * Similar to family history: more info available about deceased vs living people
 */

const crypto = require('crypto');

/**
 * Derive a key from a parent key using HKDF
 * @param {Buffer|string} parentKey - Parent key (token or derived key)
 * @param {string} info - Context information (e.g., 'expired-data', 'living-data')
 * @param {number} keyLength - Length of derived key in bytes (default: 32)
 * @returns {Buffer} Derived key
 */
function deriveKeyFromParent(parentKey, info = '', keyLength = 32) {
  const parentKeyBuffer = Buffer.isBuffer(parentKey) 
    ? parentKey 
    : Buffer.from(parentKey, 'utf8');
  
  // Use HKDF (HMAC-based Key Derivation Function) for secure key derivation
  const salt = crypto.createHash('sha256').update('mykeys-key-derivation-salt').digest();
  const hmac = crypto.createHmac('sha256', salt);
  hmac.update(parentKeyBuffer);
  hmac.update(Buffer.from(info, 'utf8'));
  
  let derivedKey = hmac.digest();
  
  // If we need more bytes, extend using HKDF expand
  if (derivedKey.length < keyLength) {
    const extended = Buffer.alloc(keyLength);
    derivedKey.copy(extended, 0);
    
    let counter = 1;
    let offset = derivedKey.length;
    
    while (offset < keyLength) {
      const hmac2 = crypto.createHmac('sha256', derivedKey);
      hmac2.update(Buffer.from([counter]));
      hmac2.update(Buffer.from(info, 'utf8'));
      const chunk = hmac2.digest();
      
      const copyLength = Math.min(chunk.length, keyLength - offset);
      chunk.copy(extended, offset, 0, copyLength);
      offset += copyLength;
      counter++;
    }
    
    derivedKey = extended;
  }
  
  return derivedKey.slice(0, keyLength);
}

/**
 * Generate a key chain identifier from a token
 * This allows identifying keys that belong to the same family/chain
 * @param {string} token - Token to generate chain ID from
 * @returns {string} Chain identifier
 */
function getKeyChainId(token) {
  // Use first 16 bytes of token hash as chain identifier
  // Keys with same prefix will be considered related
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Check if two tokens belong to the same key chain
 * @param {string} token1 - First token
 * @param {string} token2 - Second token
 * @returns {boolean} True if tokens are related
 */
function areKeysRelated(token1, token2) {
  if (!token1 || !token2) return false;
  return getKeyChainId(token1) === getKeyChainId(token2);
}

/**
 * Derive encryption keys for different data types
 * @param {string} token - Base token
 * @param {object} options - Options for key derivation
 * @returns {object} Keys for different data types
 */
function deriveEncryptionKeys(token, options = {}) {
  const {
    includeExpiredKey = true,
    includeLivingKey = true,
  } = options;
  
  const keys = {};
  
  // Base key for general encryption (exact match required)
  keys.base = crypto.createHash('sha256')
    .update(token + 'session-encryption-key')
    .digest();
  
  // Key for expired/deceased data (derivable from related keys)
  if (includeExpiredKey) {
    keys.expired = deriveKeyFromParent(token, 'expired-deceased-data');
  }
  
  // Key for living/active data (requires exact key)
  if (includeLivingKey) {
    keys.living = deriveKeyFromParent(token, 'living-active-data');
  }
  
  return keys;
}

/**
 * Encrypt data with partial decryption support
 * Separates data into expired/deceased and living/active portions
 * @param {object} data - Data to encrypt
 * @param {string} token - Encryption token
 * @param {function} dataClassifier - Function to classify data as expired/living
 * @returns {object} Encrypted data with metadata
 */
function encryptWithPartialSupport(data, token, dataClassifier = null) {
  // Default classifier: check for expiration dates or status fields
  const defaultClassifier = (item) => {
    if (typeof item === 'object' && item !== null) {
      // Check for expiration date
      if (item.expiresAt || item.expiredAt || item.expirationDate) {
        const expDate = new Date(item.expiresAt || item.expiredAt || item.expirationDate);
        if (expDate < new Date()) {
          return 'expired';
        }
      }
      
      // Check for status indicating expired/deceased
      if (item.status === 'expired' || item.status === 'deceased' || 
          item.status === 'inactive' || item.deceased === true) {
        return 'expired';
      }
      
      // Check for status indicating living/active
      if (item.status === 'active' || item.status === 'living' || 
          item.active === true) {
        return 'living';
      }
    }
    return 'unknown';
  };
  
  const classifier = dataClassifier || defaultClassifier;
  
  // Separate data into expired and living portions
  const expiredData = {};
  const livingData = {};
  const metadata = {
    timestamp: new Date().toISOString(),
    chainId: getKeyChainId(token),
    version: '1.0',
  };
  
  // Classify and separate data
  if (typeof data === 'object' && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      const classification = classifier(value);
      
      if (classification === 'expired') {
        expiredData[key] = value;
      } else if (classification === 'living') {
        livingData[key] = value;
      } else {
        // Unknown classification - include in both for safety
        // Or you could default to living for security
        livingData[key] = value;
      }
    }
  } else {
    // Non-object data defaults to living (requires exact key)
    livingData._data = data;
  }
  
  const keys = deriveEncryptionKeys(token);
  
  // Encrypt expired data (can be decrypted with related keys)
  let expiredEncrypted = null;
  let expiredIv = null;
  if (Object.keys(expiredData).length > 0) {
    expiredIv = crypto.randomBytes(16);
    const expiredCipher = crypto.createCipheriv('aes-256-cbc', keys.expired, expiredIv);
    let encrypted = expiredCipher.update(JSON.stringify(expiredData), 'utf8', 'hex');
    encrypted += expiredCipher.final('hex');
    expiredEncrypted = encrypted;
  }
  
  // Encrypt living data (requires exact key)
  let livingEncrypted = null;
  let livingIv = null;
  if (Object.keys(livingData).length > 0) {
    livingIv = crypto.randomBytes(16);
    const livingCipher = crypto.createCipheriv('aes-256-cbc', keys.living, livingIv);
    let encrypted = livingCipher.update(JSON.stringify(livingData), 'utf8', 'hex');
    encrypted += livingCipher.final('hex');
    livingEncrypted = encrypted;
  }
  
  // Also encrypt everything together with base key for backward compatibility
  const baseIv = crypto.randomBytes(16);
  const baseCipher = crypto.createCipheriv('aes-256-cbc', keys.base, baseIv);
  let baseEncrypted = baseCipher.update(JSON.stringify(data), 'utf8', 'hex');
  baseEncrypted += baseCipher.final('hex');
  
  return {
    encrypted: baseEncrypted,
    iv: baseIv.toString('hex'),
    algorithm: 'aes-256-cbc',
    partial: {
      expired: expiredEncrypted ? {
        encrypted: expiredEncrypted,
        iv: expiredIv.toString('hex'),
      } : null,
      living: livingEncrypted ? {
        encrypted: livingEncrypted,
        iv: livingIv.toString('hex'),
      } : null,
    },
    metadata,
  };
}

/**
 * Decrypt data with partial decryption support
 * Attempts to decrypt with exact key first, then tries related keys
 * @param {object} encryptedData - Encrypted data object
 * @param {string} token - Decryption token (may be exact or related)
 * @param {string[]} relatedTokens - Optional array of related tokens to try
 * @returns {object} Decryption result with decrypted data and completeness info
 */
function decryptWithPartialSupport(encryptedData, token, relatedTokens = []) {
  const result = {
    success: false,
    data: null,
    completeness: 0,
    decryptedPortions: {
      expired: false,
      living: false,
      full: false,
    },
    errors: [],
  };
  
  // Check if this is partial encryption format
  const hasPartial = encryptedData.partial && 
                     (encryptedData.partial.expired || encryptedData.partial.living);
  
  if (!hasPartial) {
    // Legacy format - try standard decryption
    try {
      const keys = deriveEncryptionKeys(token);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', keys.base, iv);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      result.success = true;
      result.data = JSON.parse(decrypted);
      result.completeness = 100;
      result.decryptedPortions.full = true;
      result.decryptedPortions.living = true;
      result.decryptedPortions.expired = true;
      
      return result;
    } catch (error) {
      result.errors.push(`Full decryption failed: ${error.message}`);
      return result;
    }
  }
  
  // Try exact key first (full decryption)
  try {
    const keys = deriveEncryptionKeys(token);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keys.base, iv);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    result.success = true;
    result.data = JSON.parse(decrypted);
    result.completeness = 100;
    result.decryptedPortions.full = true;
    result.decryptedPortions.living = true;
    result.decryptedPortions.expired = true;
    
    return result;
  } catch (error) {
    // Exact key failed, try partial decryption
    result.errors.push(`Exact key decryption failed: ${error.message}`);
  }
  
  // Try partial decryption with current token
  const partialData = {};
  let decryptedExpired = false;
  let decryptedLiving = false;
  
  // Try to decrypt expired data
  if (encryptedData.partial.expired) {
    try {
      const keys = deriveEncryptionKeys(token);
      const iv = Buffer.from(encryptedData.partial.expired.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', keys.expired, iv);
      
      let decrypted = decipher.update(encryptedData.partial.expired.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const expiredData = JSON.parse(decrypted);
      Object.assign(partialData, expiredData);
      decryptedExpired = true;
    } catch (error) {
      result.errors.push(`Expired data decryption failed: ${error.message}`);
    }
  }
  
  // Try to decrypt living data (may fail if key is not exact)
  if (encryptedData.partial.living) {
    try {
      const keys = deriveEncryptionKeys(token);
      const iv = Buffer.from(encryptedData.partial.living.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', keys.living, iv);
      
      let decrypted = decipher.update(encryptedData.partial.living.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const livingData = JSON.parse(decrypted);
      Object.assign(partialData, livingData);
      decryptedLiving = true;
    } catch (error) {
      result.errors.push(`Living data decryption failed: ${error.message}`);
    }
  }
  
  // Try related tokens if provided
  if (relatedTokens.length > 0 && (!decryptedExpired || !decryptedLiving)) {
    for (const relatedToken of relatedTokens) {
      // Only try if keys are actually related
      if (!areKeysRelated(token, relatedToken)) {
        continue;
      }
      
      // Try expired data with related token
      if (!decryptedExpired && encryptedData.partial.expired) {
        try {
          const keys = deriveEncryptionKeys(relatedToken);
          const iv = Buffer.from(encryptedData.partial.expired.iv, 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', keys.expired, iv);
          
          let decrypted = decipher.update(encryptedData.partial.expired.encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          const expiredData = JSON.parse(decrypted);
          Object.assign(partialData, expiredData);
          decryptedExpired = true;
        } catch (error) {
          // Continue to next token
        }
      }
      
      // Living data typically won't decrypt with related keys, but try anyway
      if (!decryptedLiving && encryptedData.partial.living) {
        try {
          const keys = deriveEncryptionKeys(relatedToken);
          const iv = Buffer.from(encryptedData.partial.living.iv, 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', keys.living, iv);
          
          let decrypted = decipher.update(encryptedData.partial.living.encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          const livingData = JSON.parse(decrypted);
          Object.assign(partialData, livingData);
          decryptedLiving = true;
        } catch (error) {
          // Expected to fail for living data
        }
      }
    }
  }
  
  // Calculate completeness
  if (decryptedExpired && decryptedLiving) {
    result.completeness = 100;
  } else if (decryptedExpired) {
    result.completeness = 50; // Only expired data decrypted
  } else if (decryptedLiving) {
    result.completeness = 50; // Only living data decrypted
  } else {
    result.completeness = 0;
  }
  
  if (Object.keys(partialData).length > 0) {
    result.success = true;
    result.data = partialData;
    result.decryptedPortions.expired = decryptedExpired;
    result.decryptedPortions.living = decryptedLiving;
  }
  
  return result;
}

module.exports = {
  deriveKeyFromParent,
  getKeyChainId,
  areKeysRelated,
  deriveEncryptionKeys,
  encryptWithPartialSupport,
  decryptWithPartialSupport,
};




