/**
 * Role Management for MyKeys.zip
 * 
 * Simplified: admin/member roles
 * Supports people/agents/bots
 * Ring-scoped roles with HIPAA-compliant separation
 */

const { getKV } = require('./kv-utils');
const { 
  getRingForEmail, 
  getRingMemberRoles, 
  initializeDefaultRing,
  FIRST_EMAIL,
  ENTITY_TYPES
} = require('./ring-management');

const ROLES_KEY = 'user-roles';
const DEFAULT_ROLE = 'member';

/**
 * Get role for an identifier (ring-scoped if ring exists, otherwise legacy)
 * @param {string} identifier - User identifier (email or token)
 * @param {string} ringId - Optional ring ID (if not provided, auto-detects)
 * @returns {Promise<string>} - Role ('admin' or 'member')
 */
async function getUserRoles(identifier, ringId = null) {
  if (!identifier) return DEFAULT_ROLE;
  
  identifier = identifier.trim().toLowerCase();
  
  try {
    // Try ring-based roles first
    if (!ringId && identifier.includes('@')) {
      ringId = await getRingForEmail(identifier);
    }
    
    if (ringId) {
      const memberData = await getRingMemberRoles(ringId, identifier);
      if (memberData && memberData.role) {
        return memberData.role;
      }
    }
    
    // Fallback to legacy global roles
    const kv = getKV();
    if (!kv) {
      return identifier === FIRST_EMAIL ? 'admin' : DEFAULT_ROLE;
    }
    
    const rolesData = await kv.get(ROLES_KEY);
    if (!rolesData) {
      const initialRoles = {
        [FIRST_EMAIL]: 'admin'
      };
      await kv.set(ROLES_KEY, JSON.stringify(initialRoles));
      return identifier === FIRST_EMAIL ? 'admin' : DEFAULT_ROLE;
    }
    
    const roles = typeof rolesData === 'string' ? JSON.parse(rolesData) : rolesData;
    return roles[identifier] || DEFAULT_ROLE;
  } catch (error) {
    console.error('[role-management] Error getting user roles:', error.message);
    return identifier === FIRST_EMAIL ? 'admin' : DEFAULT_ROLE;
  }
}

/**
 * Set role for an identifier (ring-scoped if ring exists, otherwise legacy)
 * @param {string} identifier - User identifier (email or token)
 * @param {string} role - Role to assign ('admin' or 'member')
 * @param {string} ringId - Optional ring ID (if not provided, auto-detects)
 * @returns {Promise<boolean>} - Success status
 */
async function setUserRoles(identifier, role, ringId = null) {
  if (!identifier) throw new Error('Identifier is required');
  
  identifier = identifier.trim().toLowerCase();
  
  // Validate role
  const validRoles = ['admin', 'member'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
  }
  
  try {
    // Try ring-based roles first
    if (!ringId && identifier.includes('@')) {
      ringId = await getRingForEmail(identifier);
    }
    
    if (ringId) {
      // Update ring-scoped role
      const { updateRingRoles, getRing } = require('./ring-management');
      const ring = await getRing(ringId);
      if (!ring) {
        throw new Error(`Ring ${ringId} not found`);
      }
      
      // Get current members and update
      const currentMembers = {};
      for (const [id, memberData] of Object.entries(ring.members)) {
        currentMembers[id] = {
          role: memberData.role || 'member',
          entityType: memberData.entityType || ENTITY_TYPES.PERSON
        };
      }
      
      // Update role for this identifier
      if (currentMembers[identifier]) {
        currentMembers[identifier].role = role;
      } else {
        currentMembers[identifier] = {
          role: role,
          entityType: ENTITY_TYPES.PERSON
        };
      }
      
      await updateRingRoles(ringId, currentMembers);
      return true;
    }
    
    // Fallback to legacy global roles
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const rolesData = await kv.get(ROLES_KEY);
    const allRoles = rolesData ? (typeof rolesData === 'string' ? JSON.parse(rolesData) : rolesData) : {};
    
    allRoles[identifier] = role;
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
 * @param {string} identifier - User identifier (email or token)
 * @param {string} role - Role to check ('admin' or 'member')
 * @param {string} ringId - Optional ring ID
 * @returns {Promise<boolean>} - True if user has the role
 */
async function hasRole(identifier, role, ringId = null) {
  const userRole = await getUserRoles(identifier, ringId);
  return userRole === role;
}

/**
 * Check if user has admin role
 * @param {string} identifier - User identifier (email or token)
 * @param {string} ringId - Optional ring ID
 * @returns {Promise<boolean>} - True if user is admin
 */
async function isAdmin(identifier, ringId = null) {
  return hasRole(identifier, 'admin', ringId);
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

