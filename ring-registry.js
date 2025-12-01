/**
 * Ring Registry for MyKeys.zip
 * 
 * Manages ring discovery and mesh connections with minimal metadata
 * Supports anonymous usage while enabling ring-to-ring connections
 * 
 * Key principles:
 * - Rings can discover other rings in the ecosystem
 * - Only bare minimum data is shared (no secrets, no user emails)
 * - Supports anonymous usage patterns
 * - Enables mesh connections for key/token/password management
 */

const { getKV } = require('./server');
const { getRingForEmail, getRing } = require('./ring-management');

const REGISTRY_KEY = 'ring-registry';
const ANONYMOUS_RING_PREFIX = 'anon-';

/**
 * Minimal ring metadata for discovery
 * Contains only public information needed for mesh connections
 * Includes analytics for viral expansion and resource planning
 */
function createRingMetadata(ring) {
  const now = new Date().toISOString();
  return {
    ringId: ring.id,
    publicName: ring.publicName || null, // Optional public name
    capabilities: ring.capabilities || [], // What this ring can do (e.g., ['key-rotation', 'token-management'])
    createdAt: ring.createdAt,
    lastSeen: now,
    // Analytics for viral expansion and resource planning
    analytics: {
      // Key growth metrics
      keyMetrics: {
        totalKeys: 0,
        keysAddedLast24h: 0,
        keysAddedLast7d: 0,
        keysAddedLast30d: 0,
        keyAdditionRate: 0, // keys per day (rolling average)
        keyGrowthTrend: 'stable', // 'growing', 'stable', 'declining'
        lastKeyAddedAt: null,
        keyAdditionHistory: [] // [{timestamp, count}] for trend analysis
      },
      // Key complexity metrics
      complexityMetrics: {
        averageKeySize: 0, // bytes
        totalKeySize: 0, // bytes
        complexityScore: 0, // weighted complexity (1-100)
        highComplexityKeys: 0, // keys with complexity > 70
        mediumComplexityKeys: 0, // keys with complexity 30-70
        lowComplexityKeys: 0, // keys with complexity < 30
        complexityHistory: [] // [{timestamp, avgComplexity, totalSize}]
      },
      // Resource usage patterns
      resourceMetrics: {
        estimatedStorageBytes: 0,
        estimatedStorageGrowthRate: 0, // bytes per day
        accessFrequency: 0, // accesses per day
        peakAccessRate: 0, // peak accesses per hour
        resourceIntensity: 'low', // 'low', 'medium', 'high', 'critical'
        resourceTrend: 'stable', // 'growing', 'stable', 'declining'
        lastResourceUpdate: now
      },
      // Viral expansion potential
      expansionMetrics: {
        viralPotential: 0, // 0-100 score based on growth rate and complexity
        expansionVelocity: 0, // rate of change in key addition rate
        memberGrowthRate: 0, // members added per time period
        ecosystemDiversity: 0, // number of unique ecosystems
        expansionRisk: 'low', // 'low', 'medium', 'high' - risk of resource exhaustion
        lastExpansionAnalysis: now
      },
      // Ring vs Vault requirements
      requirementMetrics: {
        ringLevelKeys: 0, // keys shared across ring
        vaultLevelKeys: 0, // keys for individual vaults
        ringResourceShare: 0, // percentage of resources for ring-level
        vaultResourceShare: 0, // percentage of resources for vault-level
        requirementTrend: 'balanced', // 'ring-focused', 'vault-focused', 'balanced'
        lastRequirementAnalysis: now
      }
    },
    // NO user emails, NO secrets, NO sensitive data
  };
}

/**
 * Register a ring in the ecosystem registry
 * @param {string} ringId - Ring ID
 * @param {Object} metadata - Optional metadata (publicName, capabilities)
 * @returns {Promise<Object>} - Registered ring metadata
 */
async function registerRing(ringId, metadata = {}) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Get ring to ensure it exists
    const ring = await getRing(ringId);
    if (!ring) {
      throw new Error(`Ring ${ringId} does not exist`);
    }
    
    // Get registry
    const registryData = await kv.get(REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    
    // Create or update ring metadata
    const ringMetadata = createRingMetadata({
      ...ring,
      ...metadata,
    });
    
    registry[ringId] = ringMetadata;
    
    // Save registry
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return ringMetadata;
  } catch (error) {
    console.error('[ring-registry] Error registering ring:', error.message);
    throw error;
  }
}

/**
 * Get all registered rings (for discovery)
 * Returns minimal metadata only - no secrets, no user emails
 * @param {boolean} includeAnonymous - Include anonymous rings (default: true)
 * @returns {Promise<Object>} - Object mapping ringId -> metadata
 */
async function discoverRings(includeAnonymous = true) {
  try {
    const kv = getKV();
    if (!kv) return {};
    
    const registryData = await kv.get(REGISTRY_KEY);
    if (!registryData) return {};
    
    const registry = JSON.parse(registryData);
    
    // Filter anonymous rings if requested
    if (!includeAnonymous) {
      const filtered = {};
      for (const [ringId, metadata] of Object.entries(registry)) {
        if (!ringId.startsWith(ANONYMOUS_RING_PREFIX)) {
          filtered[ringId] = metadata;
        }
      }
      return filtered;
    }
    
    return registry;
  } catch (error) {
    console.error('[ring-registry] Error discovering rings:', error.message);
    return {};
  }
}

/**
 * Get metadata for a specific ring
 * @param {string} ringId - Ring ID
 * @returns {Promise<Object|null>} - Ring metadata or null
 */
async function getRingMetadata(ringId) {
  if (!ringId) return null;
  
  try {
    const kv = getKV();
    if (!kv) return null;
    
    const registryData = await kv.get(REGISTRY_KEY);
    if (!registryData) return null;
    
    const registry = JSON.parse(registryData);
    return registry[ringId] || null;
  } catch (error) {
    console.error('[ring-registry] Error getting ring metadata:', error.message);
    return null;
  }
}

/**
 * Update ring metadata (e.g., update lastSeen, capabilities)
 * @param {string} ringId - Ring ID
 * @param {Object} updates - Metadata updates
 * @returns {Promise<Object>} - Updated metadata
 */
async function updateRingMetadata(ringId, updates) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const registryData = await kv.get(REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    
    if (!registry[ringId]) {
      // Auto-register if not in registry
      return await registerRing(ringId, updates);
    }
    
    // Update metadata (only allow safe fields)
    // Preserve analytics when updating
    const safeUpdates = {
      publicName: updates.publicName,
      capabilities: updates.capabilities,
      lastSeen: new Date().toISOString(),
    };
    
    registry[ringId] = {
      ...registry[ringId],
      ...safeUpdates,
      // Preserve analytics if they exist
      analytics: registry[ringId].analytics || createRingMetadata({ id: ringId }).analytics,
    };
    
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return registry[ringId];
  } catch (error) {
    console.error('[ring-registry] Error updating ring metadata:', error.message);
    throw error;
  }
}

/**
 * Unregister a ring from the registry
 * @param {string} ringId - Ring ID
 * @returns {Promise<boolean>} - Success status
 */
async function unregisterRing(ringId) {
  if (!ringId) {
    throw new Error('Ring ID is required');
  }
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    const registryData = await kv.get(REGISTRY_KEY);
    if (!registryData) return true;
    
    const registry = JSON.parse(registryData);
    delete registry[ringId];
    
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return true;
  } catch (error) {
    console.error('[ring-registry] Error unregistering ring:', error.message);
    throw error;
  }
}

/**
 * Create an anonymous ring for temporary/anonymous usage
 * Anonymous rings are isolated but can still participate in mesh connections
 * @param {string} sessionId - Optional session identifier
 * @returns {Promise<Object>} - Created anonymous ring
 */
async function createAnonymousRing(sessionId = null) {
  const { createRing } = require('./ring-management');
  
  const anonRingId = sessionId 
    ? `${ANONYMOUS_RING_PREFIX}${sessionId}`
    : `${ANONYMOUS_RING_PREFIX}${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  // Create ring with no members (anonymous)
  const ring = await createRing(anonRingId, 'anonymous@mykeys.zip', {
    'anonymous@mykeys.zip': ['member'] // Minimal access
  });
  
  // Register in registry
  await registerRing(anonRingId, {
    publicName: 'Anonymous',
    capabilities: ['key-management', 'token-management'],
  });
  
  return ring;
}

/**
 * Check if a ring is anonymous
 * @param {string} ringId - Ring ID
 * @returns {boolean} - True if anonymous
 */
function isAnonymousRing(ringId) {
  return ringId && ringId.startsWith(ANONYMOUS_RING_PREFIX);
}

/**
 * Get ring ID for a user (from email or token)
 * Creates anonymous ring if user not found (for anonymous usage)
 * @param {string} email - User email (optional)
 * @param {boolean} createAnonymous - Create anonymous ring if not found (default: true)
 * @returns {Promise<string|null>} - Ring ID or null
 */
async function getRingForUser(email = null, createAnonymous = true) {
  if (email) {
    const ringId = await getRingForEmail(email);
    if (ringId) {
      return ringId;
    }
    
    // If email provided but no ring exists, create a proper ring for this user
    if (createAnonymous) {
      try {
        const { createRing } = require('./ring-management');
        const userRingId = `ring-${email.replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        const ring = await createRing(userRingId, email, {
          [email]: 'admin' // User is admin of their own ring (string format, will be normalized)
        });
        
        // Try to register in registry (non-blocking, don't fail if this errors)
        // Registration is optional - the ring is already created and functional
        try {
          await registerRing(userRingId, {
            publicName: email.split('@')[0], // Use username part as public name
            capabilities: ['key-management', 'token-management'],
          });
        } catch (regError) {
          // Log but don't fail - ring is created, registration is optional
          console.warn('[ring-registry] Could not register ring (non-fatal):', regError.message);
        }
        
        return ring.id;
      } catch (error) {
        console.error('[ring-registry] Error creating ring for user:', error);
        // Fallback to anonymous ring if creation fails
        try {
          const anonRing = await createAnonymousRing();
          return anonRing.id;
        } catch (anonError) {
          console.error('[ring-registry] Error creating anonymous ring:', anonError);
          // Last resort: return a default ring ID
          return 'default';
        }
      }
    }
  }
  
  // For anonymous usage (no email), create temporary ring
  if (createAnonymous) {
    const anonRing = await createAnonymousRing();
    return anonRing.id;
  }
  
  return null;
}

/**
 * Calculate key complexity score (0-100)
 * Based on size, structure, and content patterns
 * @param {string} secretValue - Secret value
 * @returns {number} - Complexity score (0-100)
 */
function calculateKeyComplexity(secretValue) {
  if (!secretValue) return 0;
  
  const valueStr = typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue);
  const size = Buffer.byteLength(valueStr, 'utf8');
  
  let complexity = 0;
  
  // Size factor (0-40 points)
  if (size > 10000) complexity += 40;
  else if (size > 5000) complexity += 30;
  else if (size > 1000) complexity += 20;
  else if (size > 500) complexity += 10;
  
  // Structure factor (0-30 points)
  try {
    const parsed = JSON.parse(valueStr);
    if (typeof parsed === 'object' && parsed !== null) {
      const depth = getObjectDepth(parsed);
      complexity += Math.min(depth * 5, 30);
    }
  } catch {
    // Not JSON, check for structured patterns
    if (valueStr.includes('\n') || valueStr.includes(';') || valueStr.includes('|')) {
      complexity += 15;
    }
  }
  
  // Content pattern factor (0-30 points)
  const patterns = {
    base64: /^[A-Za-z0-9+/=]+$/,
    hex: /^[0-9a-fA-F]+$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
  };
  
  let patternMatches = 0;
  for (const [name, pattern] of Object.entries(patterns)) {
    if (pattern.test(valueStr)) {
      patternMatches++;
    }
  }
  complexity += Math.min(patternMatches * 10, 30);
  
  return Math.min(complexity, 100);
}

/**
 * Get depth of nested object
 * @param {Object} obj - Object to analyze
 * @param {number} depth - Current depth
 * @returns {number} - Maximum depth
 */
function getObjectDepth(obj, depth = 0) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return depth;
  }
  
  let maxDepth = depth;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      maxDepth = Math.max(maxDepth, getObjectDepth(value, depth + 1));
    }
  }
  return maxDepth;
}

/**
 * Track key addition and update analytics
 * @param {string} ringId - Ring ID
 * @param {string} keyName - Key name
 * @param {string} secretValue - Secret value
 * @param {Object} labels - Key labels (ecosystem, etc.)
 * @returns {Promise<Object>} - Updated analytics
 */
async function trackKeyAddition(ringId, keyName, secretValue, labels = {}) {
  if (!ringId || !keyName) return null;
  
  try {
    const kv = getKV();
    if (!kv) return null;
    
    // Get current metadata
    const metadata = await getRingMetadata(ringId);
    if (!metadata) {
      // Auto-register if not exists
      const ring = await getRing(ringId);
      if (ring) {
        await registerRing(ringId);
        return await trackKeyAddition(ringId, keyName, secretValue, labels);
      }
      return null;
    }
    
    const now = new Date().toISOString();
    const analytics = metadata.analytics || createRingMetadata({ id: ringId }).analytics;
    
    // Calculate key complexity
    const complexity = calculateKeyComplexity(secretValue);
    const keySize = Buffer.byteLength(typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue), 'utf8');
    
    // Update key metrics
    analytics.keyMetrics.totalKeys = (analytics.keyMetrics.totalKeys || 0) + 1;
    analytics.keyMetrics.lastKeyAddedAt = now;
    
    // Update key addition history (keep last 30 days)
    const history = analytics.keyMetrics.keyAdditionHistory || [];
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = history.find(h => h.date === today);
    if (todayEntry) {
      todayEntry.count++;
    } else {
      history.push({ date: today, count: 1 });
      // Keep only last 30 days
      if (history.length > 30) {
        history.shift();
      }
    }
    
    // Calculate addition rates
    const nowTime = new Date();
    const last24h = new Date(nowTime.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(nowTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(nowTime.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    analytics.keyMetrics.keysAddedLast24h = history
      .filter(h => new Date(h.date) >= last24h)
      .reduce((sum, h) => sum + h.count, 0);
    
    analytics.keyMetrics.keysAddedLast7d = history
      .filter(h => new Date(h.date) >= last7d)
      .reduce((sum, h) => sum + h.count, 0);
    
    analytics.keyMetrics.keysAddedLast30d = history
      .filter(h => new Date(h.date) >= last30d)
      .reduce((sum, h) => sum + h.count, 0);
    
    // Calculate rolling average (keys per day)
    const recentDays = history.slice(-7); // Last 7 days
    if (recentDays.length > 0) {
      const totalRecent = recentDays.reduce((sum, h) => sum + h.count, 0);
      analytics.keyMetrics.keyAdditionRate = totalRecent / recentDays.length;
    }
    
    // Determine growth trend
    if (recentDays.length >= 2) {
      const recentAvg = recentDays.slice(-3).reduce((sum, h) => sum + h.count, 0) / 3;
      const olderAvg = recentDays.slice(0, -3).reduce((sum, h) => sum + h.count, 0) / Math.max(recentDays.length - 3, 1);
      if (recentAvg > olderAvg * 1.2) {
        analytics.keyMetrics.keyGrowthTrend = 'growing';
      } else if (recentAvg < olderAvg * 0.8) {
        analytics.keyMetrics.keyGrowthTrend = 'declining';
      } else {
        analytics.keyMetrics.keyGrowthTrend = 'stable';
      }
    }
    
    // Update complexity metrics
    const complexityHistory = analytics.complexityMetrics.complexityHistory || [];
    const currentTotalSize = analytics.complexityMetrics.totalKeySize || 0;
    const currentAvgComplexity = analytics.complexityMetrics.complexityScore || 0;
    const totalKeys = analytics.keyMetrics.totalKeys;
    
    analytics.complexityMetrics.totalKeySize = currentTotalSize + keySize;
    analytics.complexityMetrics.averageKeySize = analytics.complexityMetrics.totalKeySize / totalKeys;
    
    // Update complexity score (weighted average)
    analytics.complexityMetrics.complexityScore = 
      ((currentAvgComplexity * (totalKeys - 1)) + complexity) / totalKeys;
    
    // Update complexity buckets
    if (complexity > 70) {
      analytics.complexityMetrics.highComplexityKeys = (analytics.complexityMetrics.highComplexityKeys || 0) + 1;
    } else if (complexity >= 30) {
      analytics.complexityMetrics.mediumComplexityKeys = (analytics.complexityMetrics.mediumComplexityKeys || 0) + 1;
    } else {
      analytics.complexityMetrics.lowComplexityKeys = (analytics.complexityMetrics.lowComplexityKeys || 0) + 1;
    }
    
    // Update complexity history (keep last 30 entries)
    complexityHistory.push({
      timestamp: now,
      avgComplexity: analytics.complexityMetrics.complexityScore,
      totalSize: analytics.complexityMetrics.totalKeySize,
      keyCount: totalKeys
    });
    if (complexityHistory.length > 30) {
      complexityHistory.shift();
    }
    
    // Update resource metrics
    analytics.resourceMetrics.estimatedStorageBytes = analytics.complexityMetrics.totalKeySize;
    
    // Calculate storage growth rate (bytes per day)
    if (complexityHistory.length >= 2) {
      const recent = complexityHistory[complexityHistory.length - 1];
      const previous = complexityHistory[complexityHistory.length - 2];
      const timeDiff = (new Date(recent.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60 * 24);
      if (timeDiff > 0) {
        analytics.resourceMetrics.estimatedStorageGrowthRate = 
          (recent.totalSize - previous.totalSize) / timeDiff;
      }
    }
    
    // Determine resource intensity
    const storageMB = analytics.resourceMetrics.estimatedStorageBytes / (1024 * 1024);
    const growthRateMB = analytics.resourceMetrics.estimatedStorageGrowthRate / (1024 * 1024);
    if (storageMB > 1000 || growthRateMB > 100) {
      analytics.resourceMetrics.resourceIntensity = 'critical';
    } else if (storageMB > 500 || growthRateMB > 50) {
      analytics.resourceMetrics.resourceIntensity = 'high';
    } else if (storageMB > 100 || growthRateMB > 10) {
      analytics.resourceMetrics.resourceIntensity = 'medium';
    } else {
      analytics.resourceMetrics.resourceIntensity = 'low';
    }
    
    // Determine resource trend
    if (analytics.keyMetrics.keyGrowthTrend === 'growing') {
      analytics.resourceMetrics.resourceTrend = 'growing';
    } else if (analytics.keyMetrics.keyGrowthTrend === 'declining') {
      analytics.resourceMetrics.resourceTrend = 'declining';
    } else {
      analytics.resourceMetrics.resourceTrend = 'stable';
    }
    
    analytics.resourceMetrics.lastResourceUpdate = now;
    
    // Update requirement metrics (ring vs vault)
    // Check if key is ring-level (shared) or vault-level (individual)
    const isRingLevel = labels.ringLevel === true || labels.shared === true || 
                        (labels.ecosystem && !labels.vaultId);
    if (isRingLevel) {
      analytics.requirementMetrics.ringLevelKeys = (analytics.requirementMetrics.ringLevelKeys || 0) + 1;
    } else {
      analytics.requirementMetrics.vaultLevelKeys = (analytics.requirementMetrics.vaultLevelKeys || 0) + 1;
    }
    
    const totalReqKeys = analytics.requirementMetrics.ringLevelKeys + analytics.requirementMetrics.vaultLevelKeys;
    if (totalReqKeys > 0) {
      analytics.requirementMetrics.ringResourceShare = 
        (analytics.requirementMetrics.ringLevelKeys / totalReqKeys) * 100;
      analytics.requirementMetrics.vaultResourceShare = 
        (analytics.requirementMetrics.vaultLevelKeys / totalReqKeys) * 100;
      
      // Determine requirement trend
      if (analytics.requirementMetrics.ringResourceShare > 70) {
        analytics.requirementMetrics.requirementTrend = 'ring-focused';
      } else if (analytics.requirementMetrics.vaultResourceShare > 70) {
        analytics.requirementMetrics.requirementTrend = 'vault-focused';
      } else {
        analytics.requirementMetrics.requirementTrend = 'balanced';
      }
    }
    analytics.requirementMetrics.lastRequirementAnalysis = now;
    
    // Calculate viral expansion potential
    await calculateViralExpansion(ringId, analytics);
    
    // Update metadata
    metadata.analytics = analytics;
    metadata.lastSeen = now;
    
    // Save updated metadata
    const registryData = await kv.get(REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    registry[ringId] = metadata;
    await kv.set(REGISTRY_KEY, JSON.stringify(registry));
    
    return analytics;
  } catch (error) {
    console.error('[ring-registry] Error tracking key addition:', error.message);
    return null;
  }
}

/**
 * Calculate viral expansion potential
 * @param {string} ringId - Ring ID
 * @param {Object} analytics - Analytics object to update
 * @returns {Promise<void>}
 */
async function calculateViralExpansion(ringId, analytics) {
  try {
    const kv = getKV();
    if (!kv) return;
    
    // Get ring to check member count
    const ring = await getRing(ringId);
    const memberCount = ring ? Object.keys(ring.members || {}).length : 0;
    
    // Calculate expansion velocity (rate of change in key addition rate)
    const keyHistory = analytics.keyMetrics.keyAdditionHistory || [];
    if (keyHistory.length >= 2) {
      const recent = keyHistory.slice(-3);
      const older = keyHistory.slice(0, -3);
      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((sum, h) => sum + h.count, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.count, 0) / older.length;
        analytics.expansionMetrics.expansionVelocity = olderAvg > 0 ? 
          ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
      }
    }
    
    // Calculate member growth rate (if we track member additions)
    // This would require tracking member additions separately
    
    // Calculate ecosystem diversity
    const keysList = await kv.get(`ring:${ringId}:keys:list`);
    if (keysList) {
      const keys = JSON.parse(keysList);
      const ecosystems = new Set();
      for (const keyName of keys) {
        const parts = keyName.split('-');
        if (parts.length > 0) {
          ecosystems.add(parts[0]);
        }
      }
      analytics.expansionMetrics.ecosystemDiversity = ecosystems.size;
    }
    
    // Calculate viral potential score (0-100)
    // Based on: growth rate, complexity, member count, ecosystem diversity
    let viralScore = 0;
    
    // Growth rate factor (0-40 points)
    const growthRate = analytics.keyMetrics.keyAdditionRate || 0;
    if (growthRate > 10) viralScore += 40;
    else if (growthRate > 5) viralScore += 30;
    else if (growthRate > 2) viralScore += 20;
    else if (growthRate > 1) viralScore += 10;
    
    // Expansion velocity factor (0-20 points)
    const velocity = Math.abs(analytics.expansionMetrics.expansionVelocity || 0);
    if (velocity > 50) viralScore += 20;
    else if (velocity > 25) viralScore += 15;
    else if (velocity > 10) viralScore += 10;
    else if (velocity > 5) viralScore += 5;
    
    // Member count factor (0-20 points)
    if (memberCount > 10) viralScore += 20;
    else if (memberCount > 5) viralScore += 15;
    else if (memberCount > 3) viralScore += 10;
    else if (memberCount > 1) viralScore += 5;
    
    // Ecosystem diversity factor (0-20 points)
    const diversity = analytics.expansionMetrics.ecosystemDiversity || 0;
    if (diversity > 10) viralScore += 20;
    else if (diversity > 5) viralScore += 15;
    else if (diversity > 3) viralScore += 10;
    else if (diversity > 1) viralScore += 5;
    
    analytics.expansionMetrics.viralPotential = Math.min(viralScore, 100);
    
    // Determine expansion risk
    const storageMB = analytics.resourceMetrics.estimatedStorageBytes / (1024 * 1024);
    const growthRateMB = analytics.resourceMetrics.estimatedStorageGrowthRate / (1024 * 1024);
    
    if (viralScore > 70 && (storageMB > 500 || growthRateMB > 50)) {
      analytics.expansionMetrics.expansionRisk = 'high';
    } else if (viralScore > 50 && (storageMB > 100 || growthRateMB > 10)) {
      analytics.expansionMetrics.expansionRisk = 'medium';
    } else {
      analytics.expansionMetrics.expansionRisk = 'low';
    }
    
    analytics.expansionMetrics.lastExpansionAnalysis = new Date().toISOString();
  } catch (error) {
    console.error('[ring-registry] Error calculating viral expansion:', error.message);
  }
}

/**
 * Search rings by capability
 * @param {string} capability - Capability to search for
 * @returns {Promise<Object>} - Object mapping ringId -> metadata
 */
async function searchRingsByCapability(capability) {
  try {
    const allRings = await discoverRings(true);
    const matchingRings = {};
    
    for (const [ringId, metadata] of Object.entries(allRings)) {
      if (metadata.capabilities && metadata.capabilities.includes(capability)) {
        matchingRings[ringId] = metadata;
      }
    }
    
    return matchingRings;
  } catch (error) {
    console.error('[ring-registry] Error searching rings by capability:', error.message);
    return {};
  }
}

module.exports = {
  registerRing,
  discoverRings,
  getRingMetadata,
  updateRingMetadata,
  unregisterRing,
  createAnonymousRing,
  isAnonymousRing,
  getRingForUser,
  searchRingsByCapability,
  trackKeyAddition,
  calculateKeyComplexity,
  calculateViralExpansion,
  ANONYMOUS_RING_PREFIX,
};


