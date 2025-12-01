/**
 * Device Registration & 2FA Authentication for MyKeys.zip
 * 
 * Manages device registration with multi-factor authentication
 * Uses Upstash Redis for storage
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');
const { sendAuthCode } = require('./email-service');

// Initialize Upstash Redis client (only if env vars are available)
let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (error) {
    console.warn('[device-auth] Failed to initialize Redis client:', error.message);
  }
} else {
  console.warn('[device-auth] Redis not configured - device token validation will be disabled for local development');
}

// Storage prefixes
const DEVICE_SECRET_PREFIX = 'device-';
const CHALLENGE_SECRET_PREFIX = '2fa-challenge-';

// 2FA code configuration
const CODE_LENGTH = 4; // Changed to 4 digits for CLI convenience
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

/**
 * Generate device fingerprint hash
 */
function generateDeviceFingerprint(fingerprint) {
  const fingerprintStr = JSON.stringify(fingerprint);
  return crypto.createHash('sha256').update(fingerprintStr).digest('hex');
}

/**
 * Generate 2FA code (4 digits)
 */
function generate2FACode() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
}

/**
 * Store 2FA challenge and optionally send via email
 * 
 * @param {string} challengeId - Unique challenge identifier
 * @param {string} code - 4-digit verification code
 * @param {string} deviceFingerprint - Device fingerprint hash
 * @param {string} username - Username
 * @param {Object} metadata - Optional metadata (email, phone, etc.)
 * @returns {Promise<Object>} - Challenge data with email status
 */
async function store2FAChallenge(challengeId, code, deviceFingerprint, username, metadata = {}) {
  if (!redis) {
    throw new Error('Storage not configured - cannot store 2FA challenge');
  }
  
  const challengeData = {
    code: code,
    deviceFingerprint: deviceFingerprint,
    username: username,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    ...metadata, // Include verification SID, phone number, email, delivery method, etc.
  };

  const key = `${CHALLENGE_SECRET_PREFIX}${challengeId}`;
  
  // Store in Redis with TTL (time to live)
  await redis.set(key, JSON.stringify(challengeData), {
    ex: CODE_EXPIRY_MINUTES * 60, // Expire after CODE_EXPIRY_MINUTES
  });

  // Send email if email address provided
  let emailSent = false;
  let emailError = null;
  if (metadata.email) {
    try {
      await sendAuthCode(metadata.email, code, username);
      emailSent = true;
      console.log(`✓ 2FA code sent to ${metadata.email}`);
    } catch (error) {
      emailError = error.message;
      console.error(`✗ Failed to send 2FA code to ${metadata.email}:`, error.message);
    }
  }

  return {
    ...challengeData,
    emailSent,
    emailError,
  };
}

/**
 * Verify 2FA code
 */
async function verify2FACode(challengeId, code) {
  try {
    const key = `${CHALLENGE_SECRET_PREFIX}${challengeId}`;
    const data = await redis.get(key);
    
    if (!data) {
      return { valid: false, reason: 'Challenge not found or expired' };
    }
    
    const challengeData = JSON.parse(data);

    // Check expiration (Redis TTL handles this, but double-check)
    if (new Date(challengeData.expiresAt) < new Date()) {
      await redis.del(key);
      return { valid: false, reason: 'Code expired' };
    }

    // Check attempts
    if (challengeData.attempts >= MAX_ATTEMPTS) {
      return { valid: false, reason: 'Too many attempts' };
    }

    // Increment attempts
    challengeData.attempts += 1;
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(challengeData), {
      ex: ttl > 0 ? ttl : CODE_EXPIRY_MINUTES * 60,
    });

    // Verify code
    if (challengeData.code !== code) {
      return { valid: false, reason: 'Invalid code', attempts: challengeData.attempts };
    }

    // Clean up challenge (delete from Redis)
    await redis.del(key);

    return {
      valid: true,
      deviceFingerprint: challengeData.deviceFingerprint,
      username: challengeData.username,
    };
  } catch (error) {
    console.error('Error verifying 2FA code:', error);
    return { valid: false, reason: 'Verification error' };
  }
}

/**
 * Register new device and generate device token
 */
async function registerDevice(deviceFingerprint, username) {
  const fingerprintHash = generateDeviceFingerprint(deviceFingerprint);
  const deviceId = `device-${fingerprintHash.substring(0, 16)}-${Date.now()}`;
  
  // Generate device token (long-lived, 1 year)
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiration

  const deviceData = {
    deviceId: deviceId,
    deviceToken: deviceToken,
    tokenHash: tokenHash,
    fingerprint: deviceFingerprint,
    fingerprintHash: fingerprintHash,
    username: username,
    registeredAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastAccessAt: new Date().toISOString(),
    revoked: false,
  };

  const key = `${DEVICE_SECRET_PREFIX}${deviceId}`;
  const tokenKey = `device-token:${tokenHash}`;
  
  // Store device data in Redis (1 year TTL)
  await redis.set(key, JSON.stringify(deviceData), {
    ex: 365 * 24 * 60 * 60, // 1 year
  });
  
  // Store token hash mapping for quick lookup
  await redis.set(tokenKey, deviceId, {
    ex: 365 * 24 * 60 * 60, // 1 year
  });

  return {
    deviceId: deviceId,
    deviceToken: deviceToken,
    expiresAt: expiresAt,
  };
}

/**
 * Validate device token
 */
async function validateDeviceToken(token) {
  // Skip validation if Redis isn't configured (local development)
  if (!redis) {
    return { valid: false, reason: 'Device token validation not available (storage not configured)' };
  }
  
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const tokenKey = `device-token:${tokenHash}`;
    const deviceId = await redis.get(tokenKey);
    
    if (!deviceId) {
      return { valid: false, reason: 'Device token not found' };
    }
    
    const key = `${DEVICE_SECRET_PREFIX}${deviceId}`;
    const data = await redis.get(key);
    
    if (!data) {
      return { valid: false, reason: 'Device data not found' };
    }
    
    const deviceData = JSON.parse(data);
    
    // Check if revoked
    if (deviceData.revoked) {
      return { valid: false, reason: 'Device revoked' };
    }

    // Check expiration
    if (new Date(deviceData.expiresAt) < new Date()) {
      return { valid: false, reason: 'Device token expired' };
    }

    // Update last access
    deviceData.lastAccessAt = new Date().toISOString();
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(deviceData), {
      ex: ttl > 0 ? ttl : 365 * 24 * 60 * 60,
    });

    return {
      valid: true,
      deviceId: deviceData.deviceId,
      username: deviceData.username,
      fingerprintHash: deviceData.fingerprintHash,
    };
  } catch (error) {
    console.error('Error validating device token:', error);
    return { valid: false, reason: 'Validation error' };
  }
}

/**
 * List devices for a user
 */
async function listDevices(username) {
  try {
    // Scan for device keys (Redis doesn't have great filtering, so we scan all device keys)
    const pattern = `${DEVICE_SECRET_PREFIX}*`;
    const keys = await redis.keys(pattern);
    
    const devices = [];
    
    for (const key of keys) {
      try {
        const data = await redis.get(key);
        if (!data) continue;
        
        const deviceData = JSON.parse(data);
        
        // Filter by username
        if (deviceData.username !== username) continue;
        
        // Don't expose token, only metadata
        devices.push({
          deviceId: deviceData.deviceId,
          fingerprint: {
            hostname: deviceData.fingerprint.hostname,
            username: deviceData.fingerprint.username,
            os_version: deviceData.fingerprint.os_version,
          },
          registeredAt: deviceData.registeredAt,
          lastAccessAt: deviceData.lastAccessAt,
          expiresAt: deviceData.expiresAt,
          revoked: deviceData.revoked,
        });
      } catch (err) {
        continue;
      }
    }

    return devices;
  } catch (error) {
    console.error('Error listing devices:', error);
    throw error;
  }
}

/**
 * Get 2FA challenge data (without verification)
 */
async function get2FAChallenge(challengeId) {
  try {
    const key = `${CHALLENGE_SECRET_PREFIX}${challengeId}`;
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const challengeData = JSON.parse(data);

    // Check expiration
    if (new Date(challengeData.expiresAt) < new Date()) {
      await redis.del(key);
      return null; // Expired
    }

    return challengeData;
  } catch (error) {
    console.error('Error getting 2FA challenge:', error);
    return null;
  }
}

/**
 * Delete 2FA challenge
 */
async function delete2FAChallenge(challengeId) {
  try {
    const key = `${CHALLENGE_SECRET_PREFIX}${challengeId}`;
    const result = await redis.del(key);
    return result > 0;
  } catch (error) {
    console.error('Error deleting 2FA challenge:', error);
    return false;
  }
}

/**
 * Revoke device
 */
async function revokeDevice(deviceId, username) {
  try {
    const key = `${DEVICE_SECRET_PREFIX}${deviceId}`;
    const data = await redis.get(key);
    
    if (!data) {
      return { success: false, reason: 'Device not found' };
    }

    const deviceData = JSON.parse(data);

    // Verify username matches
    if (deviceData.username !== username) {
      return { success: false, reason: 'Unauthorized' };
    }

    // Mark as revoked
    deviceData.revoked = true;
    deviceData.revokedAt = new Date().toISOString();

    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(deviceData), {
      ex: ttl > 0 ? ttl : 365 * 24 * 60 * 60,
    });

    return { success: true };
  } catch (error) {
    console.error('Error revoking device:', error);
    return { success: false, reason: 'Error revoking device' };
  }
}

module.exports = {
  generate2FACode,
  store2FAChallenge,
  verify2FACode,
  get2FAChallenge,
  delete2FAChallenge,
  registerDevice,
  validateDeviceToken,
  listDevices,
  revokeDevice,
  generateDeviceFingerprint,
};

