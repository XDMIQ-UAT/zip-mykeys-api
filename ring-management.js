/**
 * Ring Management for MyKeys.zip
 * 
 * Manages rings (branches) - isolated account spaces with their own users and roles
 * Each ring must have at least:
 * - 1 person with all 3 roles (owner + architect + member), OR
 * - 2 people with 2 roles each + 1 person with 1 role, OR
 * - 3 people where each has one role individually
 */

const { getKV } = require('./kv-utils');

const RINGS_KEY = 'rings';
const FIRST_EMAIL = 'bcherrman@gmail.com'; // Always known first email

/**
 * Validate that a ring meets role requirements
 * @param {Object} ringRoles - Object mapping email -> roles array
 * @returns {Object} - { valid: boolean, reason?: string }
 */
function validateRingRoles(ringRoles) {
  const emails = Object.keys(ringRoles);
  
  if (emails.length === 0) {
    return { valid: false, reason: 'Ring must have at least one member' };
  }
  
  // Count role coverage
  const hasOwner = emails.some(email => ringRoles[email].includes('owner'));
  const hasArchitect = emails.some(email => ringRoles[email].includes('architect'));
  const hasMember = emails.some(email => ringRoles[email].includes('member'));
  
  if (!hasOwner || !hasArchitect || !hasMember) {
    return { 
      valid: false, 
      reason: 'Ring must have at least one owner, one architect, and one member' 
    };
  }
  
  // Check for valid configurations
  // Option 1: One person with all 3 roles
  const hasAllThree = emails.some(email => 
    ringRoles[email].includes('owner') &&
    ringRoles[email].includes('architect') &&
    ringRoles[email].includes('member')
  );
  
  if (hasAllThree) {
    return { valid: true };
  }
  
  // Option 2: Count role distribution
  const roleCounts = {
    owner: emails.filter(email => ringRoles[email].includes('owner')).length,
    architect: emails.filter(email => ringRoles[email].includes('architect')).length,
    member: emails.filter(email => ringRoles[email].includes('member')).length,
  };
  
  // Count people with multiple roles
  const peopleWithMultipleRoles = emails.filter(email => {
    const roles = ringRoles[email];
    return roles.length >= 2;
  }).length;
  
  const peopleWithSingleRole = emails.filter(email => {
    const roles = ringRoles[email];
    return roles.length === 1;
  }).length;
  
  // Option 2: 2 people with 2 roles each + 1 person with 1 role
  if (peopleWithMultipleRoles >= 2 && peopleWithSingleRole >= 1) {
    // Verify the 2 people with multiple roles cover all 3 roles
    const multiRoleEmails = emails.filter(email => ringRoles[email].length >= 2);
    const coveredRoles = new Set();
    multiRoleEmails.forEach(email => {
      ringRoles[email].forEach(role => coveredRoles.add(role));
    });
    
    if (coveredRoles.has('owner') && coveredRoles.has('architect') && coveredRoles.has('member')) {
      return { valid: true };
    }
  }
  
  // Option 3: 3 people where each has one role individually
  if (peopleWithSingleRole >= 3 && roleCounts.owner >= 1 && roleCounts.architect >= 1 && roleCounts.member >= 1) {
    return { valid: true };
  }
  
  return { 
    valid: false, 
    reason: 'Ring must have: (1) one person with all 3 roles, OR (2) two people with 2 roles each + one person with 1 role covering all roles, OR (3) three people each with one role (owner, architect, member)' 
  };
}

/**
 * Get ring ID for an email (finds which ring the email belongs to)
 * @param {string} email - User email address
 * @returns {Promise<string|null>} - Ring ID or null if not found
 */
async function getRingForEmail(email) {
  if (!email) return null;
  
  email = email.trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) return null;
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) return null;
    
    // Handle both string and object responses from KV
    const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
    
    // Find ring containing this email
    for (const [ringId, ring] of Object.entries(rings)) {
      if (ring.members && ring.members[email]) {
        return ringId;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[ring-management] Error getting ring for email:', error.message);
    return null;
  }
}

/**
 * Create a new ring
 * @param {string} ringId - Unique ring identifier (optional, auto-generated if not provided)
 * @param {string} firstEmail - First email for the ring (required)
 * @param {Object} initialRoles - Initial roles mapping { email: [roles] }
 * @returns {Promise<Object>} - Created ring object
 */
async function createRing(ringId = null, firstEmail = FIRST_EMAIL, initialRoles = null) {
  if (!firstEmail) {
    throw new Error('First email is required');
  }
  
  firstEmail = firstEmail.trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Generate ring ID if not provided
    if (!ringId) {
      ringId = `ring-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    
    // Initialize roles - if not provided, give first email all roles
    const roles = initialRoles || {
      [firstEmail]: ['owner', 'architect', 'member']
    };
    
    // Ensure first email is included
    if (!roles[firstEmail]) {
      roles[firstEmail] = ['owner', 'architect', 'member'];
    }
    
    // Validate ring roles
    const validation = validateRingRoles(roles);
    if (!validation.valid) {
      throw new Error(`Invalid ring configuration: ${validation.reason}`);
    }
    
    // Get existing rings
    const ringsData = await kv.get(RINGS_KEY);
    // Handle both string and object responses from KV
    const rings = ringsData ? (typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData) : {};
    
    // Check if ring ID already exists
    if (rings[ringId]) {
      throw new Error(`Ring ${ringId} already exists`);
    }
    
    // Create ring object
    const ring = {
      id: ringId,
      firstEmail: firstEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: {}
    };
    
    // Add members with roles
    for (const [email, emailRoles] of Object.entries(roles)) {
      ring.members[email] = {
        roles: emailRoles,
        addedAt: new Date().toISOString()
      };
    }
    
    // Save ring
    rings[ringId] = ring;
    await kv.set(RINGS_KEY, JSON.stringify(rings));
    
    return ring;
  } catch (error) {
    console.error('[ring-management] Error creating ring:', error.message);
    throw error;
  }
}

/**
 * Get ring by ID
 * @param {string} ringId - Ring ID
 * @returns {Promise<Object|null>} - Ring object or null
 */
async function getRing(ringId) {
  if (!ringId) return null;
  
  try {
    const kv = getKV();
    if (!kv) return null;
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) return null;
    
    // Handle both string and object responses from KV
    const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
    return rings[ringId] || null;
  } catch (error) {
    console.error('[ring-management] Error getting ring:', error.message);
    return null;
  }
}

/**
 * Get all rings
 * @returns {Promise<Object>} - Object mapping ringId -> ring object
 */
async function getAllRings() {
  try {
    const kv = getKV();
    if (!kv) return {};
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) return {};
    
    // Handle both string and object responses from KV
    return typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
  } catch (error) {
    console.error('[ring-management] Error getting all rings:', error.message);
    return {};
  }
}

/**
 * Update ring members and roles
 * @param {string} ringId - Ring ID
 * @param {Object} roles - Updated roles mapping { email: [roles] }
 * @returns {Promise<Object>} - Updated ring object
 */
async function updateRingRoles(ringId, roles) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Handle both string and object responses from KV
    const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
    const ring = rings[ringId];
    
    if (!ring) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Ensure first email is still included
    if (!roles[ring.firstEmail]) {
      roles[ring.firstEmail] = ring.members[ring.firstEmail]?.roles || ['member'];
    }
    
    // Validate ring roles
    const validation = validateRingRoles(roles);
    if (!validation.valid) {
      throw new Error(`Invalid ring configuration: ${validation.reason}`);
    }
    
    // Update members
    ring.members = {};
    for (const [email, emailRoles] of Object.entries(roles)) {
      const existingMember = rings[ringId].members[email];
      ring.members[email] = {
        roles: emailRoles,
        addedAt: existingMember?.addedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    ring.updatedAt = new Date().toISOString();
    
    // Save updated ring
    rings[ringId] = ring;
    await kv.set(RINGS_KEY, JSON.stringify(rings));
    
    return ring;
  } catch (error) {
    console.error('[ring-management] Error updating ring roles:', error.message);
    throw error;
  }
}

/**
 * Add member to ring
 * @param {string} ringId - Ring ID
 * @param {string} email - Email to add
 * @param {string[]} roles - Roles to assign (defaults to ['member'])
 * @returns {Promise<Object>} - Updated ring object
 */
async function addRingMember(ringId, email, roles = ['member']) {
  if (!ringId || !email) {
    throw new Error('Ring ID and email are required');
  }
  
  email = email.trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Handle both string and object responses from KV
    const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
    const ring = rings[ringId];
    
    if (!ring) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Get current roles
    const currentRoles = {};
    for (const [memberEmail, memberData] of Object.entries(ring.members)) {
      currentRoles[memberEmail] = memberData.roles;
    }
    
    // Add new member
    currentRoles[email] = roles;
    
    // Validate ring roles
    const validation = validateRingRoles(currentRoles);
    if (!validation.valid) {
      throw new Error(`Adding this member would make ring invalid: ${validation.reason}`);
    }
    
    // Update ring
    ring.members[email] = {
      roles: roles,
      addedAt: new Date().toISOString()
    };
    
    ring.updatedAt = new Date().toISOString();
    
    rings[ringId] = ring;
    await kv.set(RINGS_KEY, JSON.stringify(rings));
    
    return ring;
  } catch (error) {
    console.error('[ring-management] Error adding ring member:', error.message);
    throw error;
  }
}

/**
 * Remove member from ring (only if ring remains valid)
 * @param {string} ringId - Ring ID
 * @param {string} email - Email to remove
 * @returns {Promise<Object>} - Updated ring object
 */
async function removeRingMember(ringId, email) {
  if (!ringId || !email) {
    throw new Error('Ring ID and email are required');
  }
  
  email = email.trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Handle both string and object responses from KV
    const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
    const ring = rings[ringId];
    
    if (!ring) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Cannot remove first email
    if (email === ring.firstEmail) {
      throw new Error('Cannot remove the first email from a ring');
    }
    
    // Get current roles
    const currentRoles = {};
    for (const [memberEmail, memberData] of Object.entries(ring.members)) {
      if (memberEmail !== email) {
        currentRoles[memberEmail] = memberData.roles;
      }
    }
    
    // Validate ring roles after removal
    const validation = validateRingRoles(currentRoles);
    if (!validation.valid) {
      throw new Error(`Removing this member would make ring invalid: ${validation.reason}`);
    }
    
    // Remove member
    delete ring.members[email];
    ring.updatedAt = new Date().toISOString();
    
    rings[ringId] = ring;
    await kv.set(RINGS_KEY, JSON.stringify(rings));
    
    return ring;
  } catch (error) {
    console.error('[ring-management] Error removing ring member:', error.message);
    throw error;
  }
}

/**
 * Get roles for an email within a specific ring
 * @param {string} ringId - Ring ID
 * @param {string} email - User email address
 * @returns {Promise<string[]>} - Array of roles
 */
async function getRingMemberRoles(ringId, email) {
  if (!ringId || !email) return [];
  
  email = email.trim().toLowerCase();
  
  try {
    const ring = await getRing(ringId);
    if (!ring) return [];
    
    return ring.members[email]?.roles || [];
  } catch (error) {
    console.error('[ring-management] Error getting ring member roles:', error.message);
    return [];
  }
}

/**
 * Initialize default ring for first email (migration helper)
 * @returns {Promise<Object>} - Created default ring
 */
async function initializeDefaultRing() {
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const ringsData = await kv.get(RINGS_KEY);
    if (ringsData) {
      // Rings already exist, return first ring
      // Handle both string and object responses from KV
      const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
      const firstRingId = Object.keys(rings)[0];
      return rings[firstRingId];
    }
    
    // Create default ring with first email
    return await createRing('default', FIRST_EMAIL, {
      [FIRST_EMAIL]: ['owner', 'architect', 'member']
    });
  } catch (error) {
    console.error('[ring-management] Error initializing default ring:', error.message);
    throw error;
  }
}

module.exports = {
  validateRingRoles,
  getRingForEmail,
  createRing,
  getRing,
  getAllRings,
  updateRingRoles,
  addRingMember,
  removeRingMember,
  getRingMemberRoles,
  initializeDefaultRing,
  FIRST_EMAIL,
};

