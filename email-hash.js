/**
 * Email Hashing Utility
 * 
 * Provides privacy-focused email hashing for user identification.
 * Users must provide their email to access their data - we cannot recover
 * the email from the hash alone.
 */

const crypto = require('crypto');

/**
 * Hash an email address for storage/identification
 * Uses SHA-256 for consistent, secure hashing
 * 
 * @param {string} email - Email address to hash
 * @returns {string} Hex-encoded hash of the email
 */
function hashEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required and must be a string');
  }
  
  // Normalize email (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim();
  
  // Create hash
  const hash = crypto.createHash('sha256');
  hash.update(normalizedEmail);
  
  return hash.digest('hex');
}

/**
 * Verify an email matches a hash
 * 
 * @param {string} email - Email to verify
 * @param {string} hash - Hash to compare against
 * @returns {boolean} True if email matches hash
 */
function verifyEmailHash(email, hash) {
  if (!email || !hash) {
    return false;
  }
  
  const emailHash = hashEmail(email);
  return emailHash === hash;
}

/**
 * Get email hash prefix for namespacing
 * Returns first 8 characters of hash for easier identification
 * 
 * @param {string} email - Email address
 * @returns {string} Short hash prefix
 */
function getEmailHashPrefix(email) {
  return hashEmail(email).substring(0, 8);
}

/**
 * Create a storage key using email hash
 * 
 * @param {string} email - Email address
 * @param {string} prefix - Key prefix (e.g., 'user', 'ring', 'session')
 * @returns {string} Storage key
 */
function getStorageKey(email, prefix) {
  const emailHash = hashEmail(email);
  return `${prefix}:${emailHash}`;
}

/**
 * Extract email hash from storage key
 * 
 * @param {string} storageKey - Storage key
 * @returns {string|null} Email hash or null if not found
 */
function extractEmailHashFromKey(storageKey) {
  const match = storageKey.match(/^[^:]+:(.+)$/);
  return match ? match[1] : null;
}

module.exports = {
  hashEmail,
  verifyEmailHash,
  getEmailHashPrefix,
  getStorageKey,
  extractEmailHashFromKey
};

