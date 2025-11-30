/**
 * Role Management for MyKeys.zip
 * 
 * Manages user roles (owner, architect, member) by email
 * Now supports ring-scoped roles (multi-tenant)
 * Falls back to legacy global roles for backward compatibility
 */

const { getKV } = require('./kv-utils');
const { 
  getRingForEmail, 
  getRingMemberRoles, 
  initializeDefaultRing,
  FIRST_EMAIL 
} = require('./ring-management');

const ROLES_KEY = 'user-roles';
const DEFAULT_ROLE = 'member';

/**
 * Get roles for an email (ring-scoped if ring exists, otherwise legacy)
 * @param {string} email - User email address
 * @param {string} ringId - Optional ring ID (if not provided, auto-detects)
 * @returns {Promise<string[]>} - Array of roles (e.g., ['member', 'architect', 'owner'])
 */
async function getUserRoles(email, ringId = null) {
  if (!email) return [DEFAULT_ROLE];
  
  email = email.trim().toLowerCase();
  
  try {
    // Try ring-based roles first
    if (!ringId) {
      ringId = await getRingForEmail(email);
    }
    
    if (ringId) {
      const ringRoles = await getRingMemberRoles(ringId, email);
      if (ringRoles.length > 0) {
        return ringRoles;
      }
    }
    
    // Fallback to legacy global roles
    const kv = getKV();
    if (!kv) {
      // Fallback: check if it's the first email
      if (email === FIRST_EMAIL) {
        return ['owner', 'architect', 'member'];
      }
      return [DEFAULT_ROLE];
    }
    
    const rolesData = await kv.get(ROLES_KEY);
    if (!rolesData) {
      // Initialize with first email
      const initialRoles = {
        [FIRST_EMAIL]: ['owner', 'architect', 'member']
      };
      await kv.set(ROLES_KEY, JSON.stringify(initialRoles));
      return email === FIRST_EMAIL ? ['owner', 'architect', 'member'] : [DEFAULT_ROLE];
    }
    
    // Handle both string and object responses from KV
    const roles = typeof rolesData === 'string' ? JSON.parse(rolesData) : rolesData;
    return roles[email] || [DEFAULT_ROLE];
  } catch (error) {
    console.error('[role-management] Error getting user roles:', error.message);
    // Fallback: check if it's the first email
    if (email === FIRST_EMAIL) {
      return ['owner', 'architect', 'member'];
    }
    return [DEFAULT_ROLE];
  }
}

/**
 * Set roles for an email (ring-scoped if ring exists, otherwise legacy)
 * @param {string} email - User email address
 * @param {string[]} roles - Array of roles to assign
 * @param {string} ringId - Optional ring ID (if not provided, auto-detects or uses default)
 * @returns {Promise<boolean>} - Success status
 */
async function setUserRoles(email, roles, ringId = null) {
  if (!email) throw new Error('Email is required');
  
  email = email.trim().toLowerCase();
  
  // Validate roles
  const validRoles = ['owner', 'architect', 'member'];
  const invalidRoles = roles.filter(r => !validRoles.includes(r));
  if (invalidRoles.length > 0) {
    throw new Error(`Invalid roles: ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}`);
  }
  
  try {
    // Try ring-based roles first
    if (!ringId) {
      ringId = await getRingForEmail(email);
    }
    
    if (ringId) {
      // Update ring-scoped roles
      const { updateRingRoles, getRing } = require('./ring-management');
      const ring = await getRing(ringId);
      if (!ring) {
        throw new Error(`Ring ${ringId} not found`);
      }
      
      // Get current roles and update
      const currentRoles = {};
      for (const [memberEmail, memberData] of Object.entries(ring.members)) {
        currentRoles[memberEmail] = memberData.roles;
      }
      
      // Ensure at least member role
      if (!roles.includes('member')) {
        roles.push('member');
      }
      
      currentRoles[email] = roles;
      await updateRingRoles(ringId, currentRoles);
      return true;
    }
    
    // Fallback to legacy global roles
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Get existing roles
    const rolesData = await kv.get(ROLES_KEY);
    // Handle both string and object responses from KV
    const allRoles = rolesData ? (typeof rolesData === 'string' ? JSON.parse(rolesData) : rolesData) : {};
    
    // Update roles for this email
    allRoles[email] = roles;
    
    // Ensure at least member role
    if (!allRoles[email].includes('member')) {
      allRoles[email].push('member');
    }
    
    // Save back to KV
    await kv.set(ROLES_KEY, JSON.stringify(allRoles));
    
    return true;
  } catch (error) {
    console.error('[role-management] Error setting user roles:', error.message);
    throw error;
  }
}

/**
 * Get all users and their roles (for a specific ring or legacy global)
 * @param {string} ringId - Optional ring ID (if not provided, returns legacy global roles)
 * @returns {Promise<Object>} - Object mapping email -> roles array
 */
async function getAllUserRoles(ringId = null) {
  try {
    // Try ring-based roles first
    if (ringId) {
      const { getRing } = require('./ring-management');
      const ring = await getRing(ringId);
      if (ring) {
        const roles = {};
        for (const [email, memberData] of Object.entries(ring.members)) {
          roles[email] = memberData.roles;
        }
        return roles;
      }
    }
    
    // Fallback to legacy global roles
    const kv = getKV();
    if (!kv) {
      // Fallback: return first email
      return {
        [FIRST_EMAIL]: ['owner', 'architect', 'member']
      };
    }
    
    const rolesData = await kv.get(ROLES_KEY);
    if (!rolesData) {
      // Initialize with first email
      const initialRoles = {
        [FIRST_EMAIL]: ['owner', 'architect', 'member']
      };
      await kv.set(ROLES_KEY, JSON.stringify(initialRoles));
      return initialRoles;
    }
    
    // Handle both string and object responses from KV
    return typeof rolesData === 'string' ? JSON.parse(rolesData) : rolesData;
  } catch (error) {
    console.error('[role-management] Error getting all user roles:', error.message);
    return {
      [FIRST_EMAIL]: ['owner', 'architect', 'member']
    };
  }
}

/**
 * Remove roles for an email (sets to member only)
 * @param {string} email - User email address
 * @param {string} ringId - Optional ring ID
 * @returns {Promise<boolean>} - Success status
 */
async function removeUserRoles(email, ringId = null) {
  return setUserRoles(email, ['member'], ringId);
}

/**
 * Check if user has a specific role
 * @param {string} email - User email address
 * @param {string} role - Role to check (owner, architect, member)
 * @param {string} ringId - Optional ring ID
 * @returns {Promise<boolean>} - True if user has the role
 */
async function hasRole(email, role, ringId = null) {
  const roles = await getUserRoles(email, ringId);
  return roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 * @param {string} email - User email address
 * @param {string[]} roles - Array of roles to check
 * @param {string} ringId - Optional ring ID
 * @returns {Promise<boolean>} - True if user has any of the roles
 */
async function hasAnyRole(email, roles, ringId = null) {
  const userRoles = await getUserRoles(email, ringId);
  return roles.some(role => userRoles.includes(role));
}

module.exports = {
  getUserRoles,
  setUserRoles,
  getAllUserRoles,
  removeUserRoles,
  hasRole,
  hasAnyRole,
  DEFAULT_ROLE,
};

