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
 * Extract domain from email address (for metadata/analytics only)
 * @param {string} email - Email address
 * @returns {string|null} - Domain or null if invalid
 */
function extractDomain(email) {
  if (!email) return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  return parts[1];
}

/**
 * Get primary domain from a set of emails (most common domain)
 * Used for metadata/analytics, not for access control
 * @param {string[]} emails - Array of email addresses
 * @returns {string|null} - Most common domain or null
 */
function getPrimaryDomain(emails) {
  if (!emails || emails.length === 0) return null;
  
  const domainCounts = {};
  for (const email of emails) {
    const domain = extractDomain(email);
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  }
  
  // Return most common domain
  let maxCount = 0;
  let primaryDomain = null;
  for (const [domain, count] of Object.entries(domainCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryDomain = domain;
    }
  }
  
  return primaryDomain;
}

/**
 * Entity types for HIPAA compliance and separation of concerns
 */
const ENTITY_TYPES = {
  PERSON: 'person',    // Human user
  AGENT: 'agent',      // AI agent/bot
  BOT: 'bot'           // Automated system
};

/**
 * Simplified roles: admin (full access) and member (read/write)
 * @param {Object} ringRoles - Object mapping identifier -> { role, entityType }
 * @returns {Object} - { valid: boolean, reason?: string }
 */
function validateRingRoles(ringRoles) {
  const identifiers = Object.keys(ringRoles);
  
  if (identifiers.length === 0) {
    return { valid: false, reason: 'Ring must have at least one member' };
  }
  
  // Must have at least one admin
  const hasAdmin = identifiers.some(id => {
    const member = ringRoles[id];
    return (typeof member === 'string' && member === 'admin') || 
           (typeof member === 'object' && member.role === 'admin');
  });
  
  if (!hasAdmin) {
    return { 
      valid: false, 
      reason: 'Ring must have at least one admin' 
    };
  }
  
  return { valid: true };
}

/**
 * Normalize member data to object format
 * @param {string|Object} memberData - Role string or member object
 * @returns {Object} - Normalized member object
 */
function normalizeMember(memberData) {
  if (typeof memberData === 'string') {
    return {
      role: memberData,
      entityType: ENTITY_TYPES.PERSON // Default to person
    };
  }
  return {
    role: memberData.role || 'member',
    entityType: memberData.entityType || ENTITY_TYPES.PERSON
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
 * Create a new ring (project/team/family)
 * Simplified: admin/member roles, supports people/agents/bots
 * HIPAA-compliant separation of concerns
 * @param {string} ringId - Unique ring identifier (optional, auto-generated)
 * @param {string} firstIdentifier - First member identifier (email or token)
 * @param {Object} initialMembers - Initial members { identifier: { role, entityType } }
 * @param {string} createdBy - Identifier of creator (for ownership tracking)
 * @param {Object} metadata - Optional metadata (label, description, tags, type)
 * @returns {Promise<Object>} - Created ring object
 */
async function createRing(ringId = null, firstIdentifier = FIRST_EMAIL, initialMembers = null, createdBy = null, metadata = {}) {
  if (!firstIdentifier) {
    throw new Error('First member identifier is required');
  }
  
  firstIdentifier = firstIdentifier.trim().toLowerCase();
  const creatorIdentifier = (createdBy || firstIdentifier).trim().toLowerCase();
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Generate ring ID if not provided (token-based identifier)
    if (!ringId) {
      ringId = `ring-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    
    // Initialize members - if not provided, make first member admin
    const members = initialMembers || {
      [firstIdentifier]: { role: 'admin', entityType: ENTITY_TYPES.PERSON }
    };
    
    // Ensure first member is included as admin
    if (!members[firstIdentifier]) {
      members[firstIdentifier] = { role: 'admin', entityType: ENTITY_TYPES.PERSON };
    }
    
    // Normalize all members to object format
    const normalizedMembers = {};
    for (const [identifier, memberData] of Object.entries(members)) {
      normalizedMembers[identifier] = normalizeMember(memberData);
    }
    
    // Validate ring (must have at least one admin)
    const validation = validateRingRoles(normalizedMembers);
    if (!validation.valid) {
      throw new Error(`Invalid ring configuration: ${validation.reason}`);
    }
    
    // Get existing rings
    const ringsData = await kv.get(RINGS_KEY);
    const rings = ringsData ? (typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData) : {};
    
    // Check if ring ID already exists
    if (rings[ringId]) {
      throw new Error(`Ring ${ringId} already exists`);
    }
    
    // Calculate primary domain from email identifiers (for metadata/analytics)
    const emailIdentifiers = Object.keys(normalizedMembers).filter(id => id.includes('@'));
    const primaryDomain = getPrimaryDomain(emailIdentifiers);
    
    // Create ring object - simplified structure
    const ring = {
      id: ringId, // Token-based identifier
      firstMember: firstIdentifier,
      domain: primaryDomain || null, // Metadata only
      createdBy: creatorIdentifier, // Ownership tracking
      type: metadata.type || 'project', // project/team/family
      label: metadata.label || null, // Human-readable label
      description: metadata.description || null,
      tags: metadata.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: {}
    };
    
    // Add members with normalized data
    for (const [identifier, memberData] of Object.entries(normalizedMembers)) {
      ring.members[identifier] = {
        role: memberData.role,
        entityType: memberData.entityType,
        addedAt: new Date().toISOString()
      };
    }
    
    // Save ring
    rings[ringId] = ring;
    await kv.set(RINGS_KEY, JSON.stringify(rings));
    
    // Audit log for HIPAA compliance
    await logAuditEvent('ring_created', {
      ringId,
      createdBy: creatorIdentifier,
      memberCount: Object.keys(ring.members).length
    });
    
    return ring;
  } catch (error) {
    console.error('[ring-management] Error creating ring:', error.message);
    throw error;
  }
}

/**
 * Log audit event for HIPAA compliance
 * @param {string} eventType - Type of event
 * @param {Object} eventData - Event data
 */
async function logAuditEvent(eventType, eventData) {
  try {
    const kv = getKV();
    if (!kv) return;
    
    const auditKey = `audit:${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const auditEntry = {
      eventType,
      timestamp: new Date().toISOString(),
      ...eventData
    };
    
    await kv.set(auditKey, JSON.stringify(auditEntry));
    
    // Also maintain a recent audit log list (last 1000 events)
    const auditListKey = 'audit:recent';
    const auditList = await kv.get(auditListKey);
    const recentAudits = auditList ? JSON.parse(auditList) : [];
    recentAudits.push(auditEntry);
    
    // Keep only last 1000 events
    if (recentAudits.length > 1000) {
      recentAudits.shift();
    }
    
    await kv.set(auditListKey, JSON.stringify(recentAudits));
  } catch (error) {
    console.error('[ring-management] Error logging audit event:', error.message);
    // Don't throw - audit logging shouldn't break operations
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
 * Rings are flexible - any email addresses allowed
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
    
    // Validate ring roles (must maintain owner/architect/member coverage)
    const validation = validateRingRoles(roles);
    if (!validation.valid) {
      throw new Error(`Invalid ring configuration: ${validation.reason}`);
    }
    
    // Update members (any email addresses allowed)
    ring.members = {};
    for (const [email, emailRoles] of Object.entries(roles)) {
      const existingMember = rings[ringId].members[email];
      ring.members[email] = {
        roles: emailRoles,
        addedAt: existingMember?.addedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    // Update primary domain metadata (recalculate most common domain)
    const allEmails = Object.keys(ring.members);
    ring.domain = getPrimaryDomain(allEmails) || ring.domain;
    
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
 * Supports people/agents/bots - any identifier can join
 * @param {string} ringId - Ring ID
 * @param {string} identifier - Member identifier (email or token)
 * @param {string|Object} memberData - Role string ('admin'/'member') or { role, entityType }
 * @param {string} addedBy - Identifier of user adding member (for audit)
 * @returns {Promise<Object>} - Updated ring object
 */
async function addRingMember(ringId, identifier, memberData = 'member', addedBy = null) {
  if (!ringId || !identifier) {
    throw new Error('Ring ID and identifier are required');
  }
  
  identifier = identifier.trim().toLowerCase();
  const normalizedMember = normalizeMember(memberData);
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const ringsData = await kv.get(RINGS_KEY);
    if (!ringsData) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    const rings = typeof ringsData === 'string' ? JSON.parse(ringsData) : ringsData;
    const ring = rings[ringId];
    
    if (!ring) {
      throw new Error(`Ring ${ringId} not found`);
    }
    
    // Get current members
    const currentMembers = {};
    for (const [id, member] of Object.entries(ring.members)) {
      currentMembers[id] = {
        role: member.role || 'member',
        entityType: member.entityType || ENTITY_TYPES.PERSON
      };
    }
    
    // Add new member
    currentMembers[identifier] = normalizedMember;
    
    // Validate ring (must maintain at least one admin)
    const validation = validateRingRoles(currentMembers);
    if (!validation.valid) {
      throw new Error(`Adding this member would make ring invalid: ${validation.reason}`);
    }
    
    // Update ring
    ring.members[identifier] = {
      role: normalizedMember.role,
      entityType: normalizedMember.entityType,
      addedAt: new Date().toISOString()
    };
    
    // Update primary domain metadata
    const emailIdentifiers = Object.keys(ring.members).filter(id => id.includes('@'));
    ring.domain = getPrimaryDomain(emailIdentifiers) || ring.domain;
    
    ring.updatedAt = new Date().toISOString();
    
    rings[ringId] = ring;
    await kv.set(RINGS_KEY, JSON.stringify(rings));
    
    // Audit log
    await logAuditEvent('member_added', {
      ringId,
      identifier,
      role: normalizedMember.role,
      entityType: normalizedMember.entityType,
      addedBy: addedBy || 'system'
    });
    
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
 * Get role for an identifier within a specific ring
 * @param {string} ringId - Ring ID
 * @param {string} identifier - Member identifier (email or token)
 * @returns {Promise<Object|null>} - Member data { role, entityType } or null
 */
async function getRingMemberRoles(ringId, identifier) {
  if (!ringId || !identifier) return null;
  
  identifier = identifier.trim().toLowerCase();
  
  try {
    const ring = await getRing(ringId);
    if (!ring) return null;
    
    const member = ring.members[identifier];
    if (!member) return null;
    
    return {
      role: member.role || 'member',
      entityType: member.entityType || ENTITY_TYPES.PERSON
    };
  } catch (error) {
    console.error('[ring-management] Error getting ring member roles:', error.message);
    return null;
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

/**
 * Check if a user can own or architect a ring
 * Users can only own/architect rings they created (their referrals) or rings created when Google auth generated a record for them
 * Domain is not used for this check - rings are flexible mesh networks
 * @param {string} email - User email
 * @param {string} ringId - Ring ID
 * @returns {Promise<boolean>} - True if user can own/architect the ring
 */
async function canUserOwnRing(email, ringId) {
  if (!email || !ringId) return false;
  
  email = email.trim().toLowerCase();
  
  try {
    const ring = await getRing(ringId);
    if (!ring) return false;
    
    // User can own/architect if they created the ring
    if (ring.createdBy === email) {
      return true;
    }
    
    // User can own/architect if they are the first email (ring creator)
    if (ring.firstEmail === email) {
      return true;
    }
    
    // Otherwise, check if user is already an owner/architect (grandfathered in)
    const memberRoles = ring.members[email]?.roles || [];
    return memberRoles.includes('owner') || memberRoles.includes('architect');
  } catch (error) {
    console.error('[ring-management] Error checking ring ownership:', error.message);
    return false;
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
  canUserOwnRing,
  extractDomain,
  getPrimaryDomain,
  normalizeMember,
  logAuditEvent,
  ENTITY_TYPES,
  FIRST_EMAIL,
};

