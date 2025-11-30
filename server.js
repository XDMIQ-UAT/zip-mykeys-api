const express = require('express');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// Use Vercel KV (Redis) - already connected in Vercel
// Support both standard KV vars and mykeys_ prefixed vars
const { createClient } = require('@vercel/kv');

// Import getKV from shared module to avoid circular dependencies
const { getKV } = require('./kv-utils');

// Load environment variables FIRST (before any modules that need them)
// Priority: .env.local (local dev) > .env (shared defaults)
require('dotenv').config({ path: '.env.local' }); // Load .env.local first (higher priority)
require('dotenv').config(); // Then load .env as fallback

const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { generateMCPToken, validateMCPToken, revokeMCPToken } = require('./token-auth');
const { sendVerificationCode: sendSMSVerificationCode } = require('./sms-service');
const { sendAuthCode: sendEmailAuthCode } = require('./email-service');
// Import role-management AFTER getKV is exported
const { getUserRoles, setUserRoles, getAllUserRoles, removeUserRoles, hasRole, hasAnyRole } = require('./role-management');
const { 
  createRing, 
  getRing, 
  getAllRings, 
  updateRingRoles, 
  addRingMember, 
  removeRingMember, 
  getRingForEmail,
  initializeDefaultRing,
  validateRingRoles
} = require('./ring-management');
const {
  getRingForUser,
  registerRing,
  discoverRings,
  getRingMetadata,
  updateRingMetadata,
  isAnonymousRing
} = require('./ring-registry');
const {
  hasRingAccess,
  listRingKeys,
  registerRingKey,
  copyKeyBetweenRings,
  moveKeyBetweenRings,
  shareKeyWithinRing,
  getKeySharingInfo
} = require('./key-management');
const {
  storeVaultSecret,
  getVaultSecret,
  listVaultSecrets,
  deleteVaultSecret,
  hasVault,
  getVaultMetadata
} = require('./privacy-vault');
const { getAuthUrl, verifyGoogleToken, verifyIdToken, isConfigured: isGoogleOAuthConfigured } = require('./google-oauth');
const {
  generate2FACode,
  store2FAChallenge,
  verify2FACode,
  get2FAChallenge,
  delete2FAChallenge,
  registerDevice,
  validateDeviceToken,
  listDevices,
  revokeDevice,
} = require('./device-auth');
// Load environment variables for local development

// Architect partial password verification
// Store temporary codes in memory (expire after 10 minutes)
const architectCodes = new Map(); // code -> { expiresAt, partialMatch }

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of architectCodes.entries()) {
    if (data.expiresAt < now) {
      architectCodes.delete(code);
    }
  }
}, 5 * 60 * 1000);

const app = express();

// Trust proxy (required for Vercel)
app.set('trust proxy', true);

// Initialize GCP Secret Manager client (fallback for migration)
let client;
try {
  client = new SecretManagerServiceClient();
} catch (error) {
  console.warn('GCP Secret Manager not available, using Upstash Redis only');
  client = null;
}
const PROJECT_ID = process.env.GCP_PROJECT || 'myl-zip-www';
// Force port 8080 for Google OAuth redirect URI compatibility
const PORT = process.env.PORT || 8080;
if (PORT === 8000) {
  console.warn('⚠️  PORT was set to 8000, but Google OAuth requires 8080. Overriding to 8080.');
}
const FINAL_PORT = PORT === 8000 ? 8080 : PORT;

// Vercel KV is auto-configured - no initialization needed
// Uses KV_REST_API_URL and KV_REST_API_TOKEN from Vercel environment

// Vercel KV is used directly - no wrapper function needed

// Secret storage mode: 'redis' (Vercel KV/Redis) or 'gcp' (GCP Secret Manager) or 'hybrid' (Redis with GCP fallback)
const SECRET_STORAGE_MODE = process.env.SECRET_STORAGE_MODE || 'redis';

// Configuration for passthrough (optional fallback)
const API_MYL_ZIP_BASE = process.env.API_MYL_ZIP_BASE || 'https://api.myl.zip';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '3a4b86f007fe813763a373287de906be4ed087fe7b48d6b3accd49db1ac24883';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for HTML pages
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Authentication middleware - supports Basic Auth, Bearer token (MCP token), and Device tokens
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return sendResponse(res, 401, 'failure', null, 'Authentication required', 'Authorization header is required');
  }
  
  // Check for Bearer token (Device token or MCP token)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.length >= 32) {
      // Try device token first
      try {
        const deviceValidation = await validateDeviceToken(token);
        if (deviceValidation.valid) {
          req.authType = 'device';
          req.deviceId = deviceValidation.deviceId;
          req.username = deviceValidation.username;
          // Determine ring for device token
          req.ringId = await getRingForUser(deviceValidation.username, true);
          return next();
        }
      } catch (err) {
        // Continue to MCP token check
      }

      // Try MCP token
      try {
        const validation = await validateMCPToken(token);
        if (validation.valid) {
          req.authType = 'bearer';
          req.token = token;
          req.clientId = validation.clientId;
          req.clientType = validation.clientType;
          req.userEmail = validation.email;
          // Determine ring for MCP token (from email)
          req.ringId = await getRingForUser(validation.email, true);
          return next();
        } else {
          return sendResponse(res, 401, 'failure', null, 'Authentication failed', validation.reason || 'Invalid token');
        }
      } catch (err) {
        return sendResponse(res, 401, 'failure', null, 'Authentication failed', 'Token validation error', err.message);
      }
    }
  }
  
  // Check for Basic Auth
  if (authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    
    const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
    // Standardized on MYKEYS_PASS for all environments (Production is sensitive/encrypted, Preview/Dev are plain/readable)
    const MYKEYS_PASS = process.env.MYKEYS_PASS || 'caps-bats';
    
    if (username === MYKEYS_USER && password === MYKEYS_PASS) {
      req.authType = 'basic';
      // Basic auth uses default ring
      req.ringId = await getRingForUser(null, false) || 'default';
      return next();
    }
  }
  
  return sendResponse(res, 401, 'failure', null, 'Authentication failed', 'Invalid credentials');
};

// Standardized error response helper
// All API responses should follow this format with three possible states: success, failure, hung
function createResponse(status, data = null, error = null, message = null, details = null) {
  const response = {
    status: status, // 'success', 'failure', or 'hung'
    timestamp: new Date().toISOString(),
    service: 'mykeys-api'
  };
  
  if (status === 'success') {
    if (data) response.data = data;
    if (message) response.message = message;
  } else if (status === 'failure') {
    response.error = error || 'Operation failed';
    if (message) response.message = message;
    if (details) response.details = details;
  } else if (status === 'hung') {
    response.error = error || 'Operation timed out or is still in progress';
    if (message) response.message = message;
    if (details) response.details = details;
  }
  
  return response;
}

// Helper to send standardized responses
function sendResponse(res, statusCode, status, data = null, error = null, message = null, details = null) {
  const response = createResponse(status, data, error, message, details);
  return res.status(statusCode).json(response);
}

// Encryption utilities (for future use)
const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.MASTER_KEY || crypto.randomBytes(32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    MASTER_KEY,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper function to get secret from GCP Secret Manager
// Helper function to get secret from Redis/KV (ring-scoped)
async function getSecretFromRedis(secretName, ringId = null) {
  const kvClient = getKV();
  if (!kvClient) return null;
  
  try {
    // Ring-scoped secret key: ring:{ringId}:secret:{secretName}
    const key = ringId ? `ring:${ringId}:secret:${secretName}` : `secret:${secretName}`;
    const value = await kvClient.get(key);
    if (value === null) {
      console.log(`[INFO] Secret ${secretName} not found in KV${ringId ? ` for ring ${ringId}` : ''}`);
      return null;
    }
    return value;
  } catch (error) {
    console.error(`[ERROR] Failed to get secret ${secretName} from KV:`, error.message);
    return null;
  }
}

// Helper function to store secret in Redis (ring-scoped)
async function storeSecretInRedis(secretName, secretValue, labels = {}, ringId = null) {
  const kvClient = getKV();
  if (!kvClient) throw new Error('KV client not initialized');
  
  try {
    // Ring-scoped secret key: ring:{ringId}:secret:{secretName}
    const key = ringId ? `ring:${ringId}:secret:${secretName}` : `secret:${secretName}`;
    const metaKey = ringId ? `ring:${ringId}:secret:${secretName}:meta` : `secret:${secretName}:meta`;
    
    // Check if secret exists
    const existing = await kvClient.get(key);
    const exists = existing !== null;
    
    // Store secret value
    await kvClient.set(key, secretValue);
    
    // Store metadata if labels provided
    if (Object.keys(labels).length > 0) {
      await kvClient.set(metaKey, JSON.stringify({
        ...labels,
        ringId: ringId || null,
        updatedAt: new Date().toISOString()
      }));
    }
    
    return { created: !exists };
  } catch (error) {
    console.error(`Error storing secret ${secretName} in KV:`, error.message);
    throw error;
  }
}

// Helper function to get secret from GCP Secret Manager (fallback)
async function getSecretFromGCP(secretName) {
  if (!client) return null;
  try {
    const fullName = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name: fullName });
    return version.payload.data.toString('utf8');
  } catch (error) {
    if (error.code === 5) { // NOT_FOUND
      return null;
    }
    throw error;
  }
}

// Helper function to store secret in GCP Secret Manager (fallback)
async function storeSecretInGCP(secretName, secretValue, labels = {}) {
  if (!client) {
    throw new Error('GCP Secret Manager client not available');
  }
  try {
    // Check if secret exists
    try {
      await client.getSecret({ name: `projects/${PROJECT_ID}/secrets/${secretName}` });
      // Update existing secret
      await client.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/${secretName}`,
        payload: { data: Buffer.from(secretValue, 'utf8') },
      });
      return { created: false };
    } catch {
      // Create new secret
      const [secret] = await client.createSecret({
        parent: `projects/${PROJECT_ID}`,
        secretId: secretName,
        secret: {
          replication: { automatic: {} },
          labels: labels
        },
      });
      await client.addSecretVersion({
        parent: secret.name,
        payload: { data: Buffer.from(secretValue, 'utf8') },
      });
      return { created: true };
    }
  } catch (error) {
    throw error;
  }
}

// Unified secret getter - Simple: Read from Redis or GCP (ring-scoped)
async function getSecret(secretName, ringId = null) {
  if (SECRET_STORAGE_MODE === 'gcp') {
    // GCP storage: use ring-scoped secret name
    const gcpSecretName = ringId ? `ring-${ringId}-${secretName}` : secretName;
    return await getSecretFromGCP(gcpSecretName);
  }
  
  // Read from Redis (ring-scoped)
  const value = await getSecretFromRedis(secretName, ringId);
  if (value !== null) {
    return value;
  }
  
  // Fallback to GCP if hybrid mode
  if (SECRET_STORAGE_MODE === 'hybrid' && client) {
    const gcpSecretName = ringId ? `ring-${ringId}-${secretName}` : secretName;
    const gcpValue = await getSecretFromGCP(gcpSecretName);
    if (gcpValue) {
      await storeSecretInRedis(secretName, gcpValue, {}, ringId);
      return gcpValue;
    }
  }
  
  return null;
}

// Unified secret setter - Simple: Store in Redis or GCP (ring-scoped)
async function storeSecret(secretName, secretValue, labels = {}, ringId = null) {
  if (SECRET_STORAGE_MODE === 'gcp') {
    // GCP storage: use ring-scoped secret name
    const gcpSecretName = ringId ? `ring-${ringId}-${secretName}` : secretName;
    const gcpLabels = { ...labels, ringId: ringId || null };
    return await storeSecretInGCP(gcpSecretName, secretValue, gcpLabels);
  }
  
  // Store in Redis (ring-scoped)
  const result = await storeSecretInRedis(secretName, secretValue, labels, ringId);
  
  // Sync to GCP if hybrid mode
  if (SECRET_STORAGE_MODE === 'hybrid' && client) {
    try {
      const gcpSecretName = ringId ? `ring-${ringId}-${secretName}` : secretName;
      const gcpLabels = { ...labels, ringId: ringId || null };
      await storeSecretInGCP(gcpSecretName, secretValue, gcpLabels);
    } catch (error) {
      console.warn(`Failed to sync ${secretName} to GCP:`, error.message);
    }
  }
  
  return result;
}

// ========== Static HTML Routes ==========
// Explicit routes for HTML pages to ensure they're served
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mcp-config-generator.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mcp-config-generator.html'));
});

app.get('/generate-token.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'generate-token.html'));
});

app.get('/rebuild', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'rebuild.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving rebuild.html:', err);
      res.status(500).json({ error: 'Failed to load rebuild page', details: err.message });
    }
  });
});

app.get('/rebuild.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'rebuild.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving rebuild.html:', err);
      res.status(500).json({ error: 'Failed to load rebuild page', details: err.message });
    }
  });
});

// Serve recovery script
app.get('/winget-restore.ps1', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'winget-restore.ps1');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="winget-restore.ps1"');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving winget-restore.ps1:', err);
      res.status(500).json({ error: 'Failed to load recovery script', details: err.message });
    }
  });
});

// MCP Server Version Endpoint
app.get('/api/mcp/version', (req, res) => {
  try {
    const fs = require('fs');
    // Read version from mcp-server.ts source
    const mcpServerPath = path.join(__dirname, 'mcp-server.ts');
    let version = '2.0.0'; // Default version
    
    if (fs.existsSync(mcpServerPath)) {
      const content = fs.readFileSync(mcpServerPath, 'utf8');
      const versionMatch = content.match(/const MCP_SERVER_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }
    
    res.json({
      version: version,
      downloadUrl: `${req.protocol}://${req.get('host')}/mcp-server.js`,
      updateAvailable: false, // Client should compare versions
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get version', version: '2.0.0' });
  }
});

// Serve MCP server JavaScript file (compiled)
app.get('/mcp-server.js', (req, res) => {
  // Try compiled version first
  const compiledPath = path.join(__dirname, 'public', 'mcp-server.js');
  const distPath = path.join(__dirname, 'dist', 'mcp-server.js');
  
  // Check if compiled version exists
  const fs = require('fs');
  if (fs.existsSync(compiledPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="mcp-server.js"');
    res.sendFile(compiledPath);
  } else if (fs.existsSync(distPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="mcp-server.js"');
    res.sendFile(distPath);
  } else {
    // Fallback: serve TypeScript source with note
    res.status(404).json({ 
      error: 'Compiled MCP server not found', 
      message: 'The compiled JavaScript version is not available. You can download the TypeScript source instead.',
      alternatives: [
        'Download TypeScript source: you create the https://mykeys.zip/mcp-server.ts',
        'Build locally: npm run build:mcp',
        'Use TypeScript directly: npx tsx mcp-server.ts'
      ]
    });
  }
});

// Serve MCP server TypeScript source
app.get('/mcp-server.ts', (req, res) => {
  const filePath = path.join(__dirname, 'mcp-server.ts');
  res.setHeader('Content-Type', 'application/typescript');
  res.setHeader('Content-Disposition', 'attachment; filename="mcp-server.ts"');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving mcp-server.ts:', err);
      res.status(500).json({ error: 'Failed to load source file', details: err.message });
    }
  });
});

// ========== Health Endpoints ==========

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'mykeys-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    project: PROJECT_ID
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    service: 'mykeys-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    project: PROJECT_ID
  });
});

// ========== Legacy API Endpoints (/api/secrets) ==========

// List all secrets
app.get('/api/secrets', authenticate, async (req, res) => {
  try {
    const kvClient = getKV();
    if (!kvClient) {
      return res.status(500).json({ error: 'KV client not initialized' });
    }
    
    // List secrets from Redis/KV
    // Note: Redis/KV doesn't have a native list operation, so we'll return empty for now
    // In production, you might want to maintain a separate index set
    const secretList = [];
    
    // Try to get common secrets
    const commonSecrets = ['ses-credentials', 'twilio-credentials'];
    for (const secretName of commonSecrets) {
      const exists = await kvClient.get(`secret:${secretName}`);
      if (exists) {
        const meta = await kvClient.get(`secret:${secretName}:meta`);
        secretList.push({
          name: secretName,
          created: meta ? JSON.parse(meta).updatedAt : new Date().toISOString(),
          labels: meta ? JSON.parse(meta).labels : {}
        });
      }
    }
    
    res.json({ secrets: secretList });
  } catch (error) {
    console.error('Error listing secrets:', error.message);
    res.status(500).json({ error: 'Failed to list secrets' });
  }
});

// Diagnostic endpoint to check Postgres status (no auth required for debugging)
app.get('/api/debug/redis-status', async (req, res) => {
  try {
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.mykeys_KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.mykeys_KV_REST_API_TOKEN;
    
    // Test Redis/KV connection
    let kvAvailable = false;
    let testSecretExists = null;
    let kvError = null;
    
    try {
      const kvClient = getKV();
      if (!kvClient) {
        throw new Error('KV client not initialized');
      }
      
      // Try a simple get to test connection
      await kvClient.get('test');
      kvAvailable = true;
      // Check if ses-credentials exists
      const sesCreds = await kvClient.get('secret:ses-credentials');
      testSecretExists = sesCreds !== null ? 1 : 0;
    } catch (err) {
      kvAvailable = false;
      kvError = err.message;
      testSecretExists = `error: ${err.message}`;
    }
    
    res.json({
      redis_initialized: kvAvailable,
      storage_mode: SECRET_STORAGE_MODE,
      test_secret_exists: testSecretExists,
      redis_error: kvError,
      kv_url_set: !!kvUrl,
      kv_token_set: !!kvToken,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check Redis/KV status',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Get secret value (legacy format)
app.get('/api/secrets/:name', authenticate, async (req, res) => {
  try {
    const secretName = req.params.name;
    console.log(`[INFO] Retrieving secret: ${secretName}`);
    console.log(`[INFO] Storage mode: ${SECRET_STORAGE_MODE}`);
    
    const secretValue = await getSecret(secretName);
    
    if (!secretValue) {
      console.log(`[WARN] Secret not found: ${secretName}`);
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    console.log(`[INFO] Secret retrieved successfully: ${secretName}`);
    res.json({ value: secretValue });
  } catch (error) {
    console.error('[ERROR] Error accessing secret:', error);
    console.error('[ERROR] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to access secret',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create secret (legacy format)
app.post('/api/secrets', authenticate, async (req, res) => {
  try {
    const { name, value, labels } = req.body;
    
    if (!name || !value) {
      return res.status(400).json({ error: 'Name and value are required' });
    }
    
    const result = await storeSecret(name, value, labels);
    
    res.json({ 
      success: true, 
      message: `Secret ${name} ${result.created ? 'created' : 'updated'} successfully`,
      name: name
    });
  } catch (error) {
    console.error('Error creating secret:', error.message);
    res.status(500).json({ error: 'Failed to create secret' });
  }
});

// Update secret (legacy format)
app.put('/api/secrets/:name', authenticate, async (req, res) => {
  try {
    const { value } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    await storeSecret(req.params.name, value);
    
    res.json({ 
      success: true, 
      message: `Secret ${req.params.name} updated successfully`
    });
  } catch (error) {
    console.error('Error updating secret:', error.message);
    res.status(500).json({ error: 'Failed to update secret' });
  }
});

// Delete secret (legacy format)
app.delete('/api/secrets/:name', authenticate, async (req, res) => {
  try {
    const secretName = `projects/${PROJECT_ID}/secrets/${req.params.name}`;
    await client.deleteSecret({ name: secretName });
    
    res.json({ 
      success: true, 
      message: `Secret ${req.params.name} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting secret:', error.message);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

// ========== V1 API Endpoints (/api/v1/secrets/:ecosystem/:secretName) ==========

// Get secret (v1 format with ecosystem)
app.get('/api/v1/secrets/:ecosystem/:secretName', authenticate, async (req, res) => {
  try {
    const { ecosystem, secretName } = req.params;
    const ringId = req.ringId; // From authenticate middleware
    const userEmail = req.userEmail; // From authentication
    
    // Ensure ring is registered
    if (ringId) {
      await updateRingMetadata(ringId, {}); // Update lastSeen
    }
    
    // Verify user has access to this ring (content belongs to ring, accessible to all members)
    if (ringId && userEmail) {
      const hasAccess = await hasRingAccess(userEmail, ringId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this ring\'s content'
        });
      }
    }
    
    // Try to get from ring-scoped storage first
    // Format: ecosystem-secretName or just secretName
    const possibleNames = [
      `${ecosystem}-${secretName}`,
      secretName
    ];
    
    let secretValue = null;
    for (const name of possibleNames) {
      secretValue = await getSecret(name, ringId);
      if (secretValue) break;
    }
    
    if (secretValue) {
      // Try to parse as JSON, fallback to plain text
      let parsedValue;
      try {
        parsedValue = JSON.parse(secretValue);
      } catch {
        parsedValue = secretValue;
      }
      
      return res.json({
        success: true,
        secret_name: secretName,
        secret_value: parsedValue,
        ecosystem: ecosystem
      });
    }
    
    // If not found in GCP and passthrough is enabled, try upstream
    if (process.env.ENABLE_PASSTHROUGH === 'true' && req.authType === 'bearer') {
      const axios = require('axios');
      try {
        const response = await axios.get(
          `${API_MYL_ZIP_BASE}/api/v1/secrets/${ecosystem}/${secretName}`,
          {
            headers: {
              'Authorization': `Bearer ${INTERNAL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000
          }
        );
        return res.json(response.data);
      } catch (passthroughError) {
        // Fall through to 404
      }
    }
    
    res.status(404).json({
      error: 'Secret not found',
      secret_name: secretName,
      ecosystem: ecosystem
    });
  } catch (error) {
    console.error(`Error retrieving secret ${req.params.ecosystem}/${req.params.secretName}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to retrieve secret',
      details: error.message 
    });
  }
});

// Store secret (v1 format with ecosystem) - Ring-scoped
app.post('/api/v1/secrets/:ecosystem', authenticate, async (req, res) => {
  try {
    const { ecosystem } = req.params;
    const { secret_name, secret_value, description } = req.body;
    const ringId = req.ringId; // From authenticate middleware
    
    if (!secret_name || secret_value === undefined) {
      return res.status(400).json({ error: 'secret_name and secret_value are required' });
    }
    
    // Ensure ring is registered
    if (ringId) {
      await updateRingMetadata(ringId, {}); // Update lastSeen
    }
    
    const secretName = `${ecosystem}-${secret_name}`;
    const secretValueStr = typeof secret_value === 'string' 
      ? secret_value 
      : JSON.stringify(secret_value);
    
    const labels = {
      ecosystem: ecosystem,
      ringId: ringId || null,
      ...(description && { description: description })
    };
    
    const result = await storeSecret(secretName, secretValueStr, labels, ringId);
    
    // Register key in ring's key list (content belongs to ring)
    if (ringId) {
      await registerRingKey(ringId, secretName);
    }
    
    res.json({
      success: true,
      secret_name: secret_name,
      ecosystem: ecosystem,
      ringId: ringId || null,
      message: `Secret ${secret_name} ${result.created ? 'created' : 'updated'} successfully. Content is accessible to all ring members.`
    });
  } catch (error) {
    console.error(`Error storing secret ${req.params.ecosystem}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to store secret',
      details: error.message 
    });
  }
});

// List secrets for ecosystem (v1 format) - Ring-scoped, content belongs to ring
app.get('/api/v1/secrets/:ecosystem', authenticate, async (req, res) => {
  try {
    const { ecosystem } = req.params;
    const ringId = req.ringId; // From authenticate middleware
    const userEmail = req.userEmail;
    
    // Verify user has access to this ring
    if (ringId && userEmail) {
      const hasAccess = await hasRingAccess(userEmail, ringId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this ring\'s content'
        });
      }
    }
    
    // Get keys from ring (content belongs to ring, accessible to all members)
    const ringKeys = ringId ? await listRingKeys(ringId) : [];
    
    // Also check GCP for backward compatibility
    let ecosystemSecrets = [];
    if (client) {
      try {
        const [secrets] = await client.listSecrets({
          parent: `projects/${PROJECT_ID}`,
        });
        
        // Filter secrets by ring and ecosystem
        ecosystemSecrets = secrets
          .filter(secret => {
            const name = secret.name.split('/').pop();
            const labels = secret.labels || {};
            const secretRingId = labels.ringId || (name.startsWith('ring-') ? name.split('-')[1] : null);
            
            // Only show secrets from user's ring
            if (ringId && secretRingId !== ringId) {
              return false;
            }
            
            return name.startsWith(`${ecosystem}-`) || labels.ecosystem === ecosystem;
          })
          .map(secret => ({
            secret_name: secret.name.split('/').pop().replace(`${ecosystem}-`, '').replace(/^ring-[^-]+-/, ''),
            ecosystem: ecosystem,
            ringId: secret.labels?.ringId || null,
            created: secret.createTime,
            labels: secret.labels || {}
          }));
      } catch (gcpError) {
        console.warn('Error listing secrets from GCP:', gcpError.message);
      }
    }
    
    // Combine ring keys and GCP secrets
    const allSecrets = [...ringKeys.map(key => ({
      secret_name: key,
      ecosystem: ecosystem,
      ringId: ringId || null,
      accessibleTo: 'all-ring-members'
    })), ...ecosystemSecrets];
    
    res.json({
      success: true,
      ecosystem: ecosystem,
      ringId: ringId || null,
      secrets: allSecrets,
      message: ringId ? 'Content belongs to ring and is accessible to all ring members' : 'Listing all accessible secrets'
    });
  } catch (error) {
    console.error(`Error listing secrets for ${req.params.ecosystem}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to list secrets',
      details: error.message 
    });
  }
});

// ========== TLD-specific Endpoints ==========

// Store TLD secrets (DNS, registrar credentials, etc.)
app.post('/api/tld/:domain', authenticate, async (req, res) => {
  try {
    const { domain } = req.params;
    const { registrar, api_key, dns_provider, dns_api_key, nameservers } = req.body;
    
    const secretData = JSON.stringify({
      registrar,
      api_key,
      dns_provider,
      dns_api_key,
      nameservers: nameservers || [],
      updated: new Date().toISOString()
    });
    
    const secretName = `tld-${domain.replace(/\./g, '-')}`;
    
    await storeSecret(secretName, secretData, {
      type: 'tld',
      domain: domain.replace(/\./g, '-')
    });
    
    res.json({ 
      success: true, 
      message: `TLD secrets for ${domain} stored successfully`
    });
  } catch (error) {
    console.error('Error storing TLD secret:', error.message);
    res.status(500).json({ error: 'Failed to store TLD secrets' });
  }
});

// Get TLD secrets
app.get('/api/tld/:domain', authenticate, async (req, res) => {
  try {
    const { domain } = req.params;
    const secretName = `tld-${domain.replace(/\./g, '-')}`;
    const secretValue = await getSecret(secretName);
    
    if (!secretValue) {
      return res.status(404).json({ error: `TLD secrets for ${domain} not found` });
    }
    
    const payload = JSON.parse(secretValue);
    res.json({ domain, ...payload });
  } catch (error) {
    console.error('Error retrieving TLD secret:', error.message);
    res.status(404).json({ error: `TLD secrets for ${req.params.domain} not found` });
  }
});

// ========== MCP Token Management Endpoints ==========

// Generate MCP token (requires admin auth)
// In-memory storage for MFA codes (phone/email -> code mapping)
const mfaCodes = new Map(); // phone/email -> { code, expiresAt, verificationSid }

// Helper function to generate 4-digit code
function generate4DigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper function to send 2FA code via email
async function send2FACodeViaEmail(email, code) {
  try {
    const result = await sendEmailAuthCode(email, code);
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Error sending email verification code:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Architect partial password verification endpoint
app.post('/api/auth/verify-partial', async (req, res) => {
  try {
    const { partialPassword } = req.body;
    
    if (!partialPassword || typeof partialPassword !== 'string') {
      return res.status(400).json({
        error: 'Partial password is required',
      });
    }

    // Standardized on MYKEYS_PASS for all environments
    const MYKEYS_PASS = process.env.MYKEYS_PASS || 'riddle-squiggle@#$34alkdjf';
    
    // Check if partial password matches any part of the full password
    // Case-insensitive partial match
    const partialLower = partialPassword.toLowerCase().trim();
    const fullLower = MYKEYS_PASS.toLowerCase();
    
    console.log('Partial password verification:', {
      partialLength: partialLower.length,
      partialProvided: partialLower.substring(0, 10) + '...',
      fullLength: fullLower.length,
      matchFound: fullLower.includes(partialLower)
    });
    
    if (fullLower.includes(partialLower) && partialLower.length >= 4) {
      // Generate a temporary code (valid for 10 minutes)
      const code = crypto.randomBytes(8).toString('hex');
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
      
      architectCodes.set(code, {
        expiresAt,
        partialMatch: partialLower,
        createdAt: Date.now(),
      });
      
      return res.json({
        success: true,
        code: code,
        expiresIn: 600, // seconds
        message: 'Partial password verified. Use this code to generate tokens.',
      });
    } else {
      return res.status(401).json({
        error: 'Partial password does not match',
        message: 'The partial password you provided does not match any part of the architect password.',
      });
    }
  } catch (error) {
    console.error('Error verifying partial password:', error.message);
    res.status(500).json({
      error: 'Failed to verify partial password',
      details: error.message,
    });
  }
});

// Request MFA code via SMS or Email (simplified - no architect code required)
app.post('/api/auth/request-mfa-code', async (req, res) => {
  try {
    const { phoneNumber, email } = req.body;
    
    if (!phoneNumber && !email) {
      return res.status(400).json({
        error: 'Phone number or email is required',
      });
    }
    
    // Generate 4-digit code
    const code = generate4DigitCode();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    let result = { success: false };
    
    if (phoneNumber) {
      // Normalize phone number (trim) for consistent storage/retrieval
      const normalizedPhone = phoneNumber.trim();
      // Determine service name from request (defaults to 'mykeys')
      const serviceName = req.body.service || 'mykeys';
      // For SMS, send the 4-digit code via Twilio
      result = await send2FACodeViaSMS(normalizedPhone, code, false, serviceName);
      if (result.success) {
        mfaCodes.set(normalizedPhone, {
          code,
          expiresAt,
          verificationSid: result.verificationSid,
        });
      }
    } else if (email) {
      // Normalize email (trim + lowercase) for consistent storage/retrieval
      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[request-mfa-code] Attempting to send email code to: ${normalizedEmail}`);
      const emailResult = await send2FACodeViaEmail(normalizedEmail, code);
      console.log(`[request-mfa-code] Email send result:`, { success: emailResult.success, error: emailResult.error });
      if (emailResult.success) {
        mfaCodes.set(normalizedEmail, {
          code,
          expiresAt,
          verificationSid: null,
        });
        result = { success: true, method: 'email', target: normalizedEmail };
      } else {
        console.error(`[request-mfa-code] Email send failed:`, emailResult.error);
        result = { success: false, error: emailResult.error || 'Failed to send email' };
      }
    }
    
    if (result.success) {
      res.json({
        success: true,
        method: phoneNumber ? 'sms' : 'email',
        target: phoneNumber || email,
        expiresIn: 600, // seconds
        message: `4-digit verification code sent to ${phoneNumber ? 'SMS' : 'email'}.`,
      });
    } else {
      console.error(`[request-mfa-code] Failed to send verification code:`, result.error);
      res.status(500).json({
        error: 'Failed to send verification code',
        details: result.error || 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Error requesting MFA code:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to request MFA code', 'An error occurred while requesting the verification code', error.message);
  }
});

// Verify MFA code and generate token (simplified)
app.post('/api/auth/verify-mfa-code', async (req, res) => {
  try {
    const { phoneNumber, email, code, clientId, clientType, expiresInDays } = req.body;
    
    if (!code || (!phoneNumber && !email)) {
      return sendResponse(res, 400, 'failure', null, 'Missing required fields', 'Code and phone number or email are required');
    }
    
    // Normalize identifier (email: lowercase + trim, phone: trim)
    let identifier;
    if (phoneNumber) {
      identifier = phoneNumber.trim();
    } else if (email) {
      identifier = email.trim().toLowerCase();
    } else {
      return sendResponse(res, 400, 'failure', null, 'Missing required fields', 'Code and phone number or email are required');
    }
    
    // Normalize code (remove non-digits, ensure 4 digits)
    const normalizedCode = code.toString().replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    
    const mfaData = mfaCodes.get(identifier);
    
    if (!mfaData) {
      console.error(`MFA code not found for identifier: ${identifier}`);
      console.error(`Available identifiers: ${Array.from(mfaCodes.keys()).join(', ')}`);
      return sendResponse(res, 401, 'failure', null, 'No verification code found', 'Please request a verification code first.');
    }
    
    if (mfaData.expiresAt < Date.now()) {
      mfaCodes.delete(identifier);
      return sendResponse(res, 401, 'failure', null, 'Verification code expired', 'Please request a new verification code.');
    }
    
    // Normalize stored code for comparison
    const storedCode = mfaData.code.toString().replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    
    // Verify code - normalized comparison
    if (storedCode !== normalizedCode) {
      console.error(`Code mismatch - stored: "${storedCode}", received: "${normalizedCode}"`);
      return sendResponse(res, 401, 'failure', null, 'Invalid verification code', 'The code you entered is incorrect.');
    }
    
    // Code verified, clean up
    mfaCodes.delete(identifier);
    
    // Generate token - clientId is optional, default to email-based identifier
    const finalClientId = (clientId && clientId.trim()) || `web-${identifier.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const finalClientType = clientType || 'web';
    const finalExpiresInDays = expiresInDays || 90;
    
    // Get user roles for the email
    const { getUserRoles } = require('./role-management');
    const userRoles = email ? await getUserRoles(email.trim().toLowerCase()) : ['member'];
    
    const tokenResult = await generateMCPToken(
      finalClientId,
      finalClientType,
      finalExpiresInDays,
      email ? email.trim().toLowerCase() : null
    );
    
    return sendResponse(res, 200, 'success', {
      token: tokenResult.token,
      tokenId: tokenResult.tokenId,
      expiresAt: tokenResult.expiresAt,
    }, null, 'Token generated successfully. Save this token - it will not be shown again!');
  } catch (error) {
    console.error('Error verifying MFA code:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to verify MFA code', 'An error occurred while verifying the code', error.message);
  }
});

// Middleware to require owner or architect role for admin endpoints
// Middleware that allows either admin role (via Bearer token) or Google OAuth
const requireAdminRoleOrGoogle = async (req, res, next) => {
  try {
    // First, try Google OAuth (check for X-Google-ID-Token header)
    const googleIdToken = req.headers['x-google-id-token'] || req.headers['X-Google-ID-Token'] || req.body?.idToken;
    
    console.log('[requireAdminRoleOrGoogle] Checking authentication...');
    console.log('[requireAdminRoleOrGoogle] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[requireAdminRoleOrGoogle] Google ID Token present:', !!googleIdToken);
    console.log('[requireAdminRoleOrGoogle] Google OAuth configured:', isGoogleOAuthConfigured());
    
    if (googleIdToken && isGoogleOAuthConfigured()) {
      try {
        console.log('[requireAdminRoleOrGoogle] Verifying Google ID token...');
        const googleUser = await verifyIdToken(googleIdToken);
        console.log('[requireAdminRoleOrGoogle] Google user verified:', googleUser.verified);
        console.log('[requireAdminRoleOrGoogle] Google user email:', googleUser.email);
        
        if (googleUser.verified) {
          const userRoles = await getUserRoles(googleUser.email);
          console.log('[requireAdminRoleOrGoogle] User roles:', userRoles);
          const hasAdminAccess = userRoles.includes('owner') || userRoles.includes('architect');
          console.log('[requireAdminRoleOrGoogle] Has admin access:', hasAdminAccess);
          
          if (hasAdminAccess) {
            req.userEmail = googleUser.email;
            req.userRoles = userRoles;
            req.isGoogleAuth = true;
            console.log('[requireAdminRoleOrGoogle] ✅ Google auth successful, proceeding...');
            return next();
          } else {
            console.log('[requireAdminRoleOrGoogle] ❌ User does not have admin access');
          }
        }
      } catch (googleError) {
        // Google auth failed, fall through to Bearer token check
        console.error('[requireAdminRoleOrGoogle] Google OAuth verification failed:', googleError.message);
        console.error('[requireAdminRoleOrGoogle] Error stack:', googleError.stack);
      }
    } else {
      if (!googleIdToken) {
        console.log('[requireAdminRoleOrGoogle] ⚠️  No Google ID token found in headers');
      }
      if (!isGoogleOAuthConfigured()) {
        console.log('[requireAdminRoleOrGoogle] ⚠️  Google OAuth not configured');
      }
    }
    
    // Fall back to Bearer token authentication (requireAdminRole logic)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendResponse(res, 401, 'failure', null, 'Authentication required', 'Bearer token or Google OAuth required');
    }
    
    const token = authHeader.substring(7);
    const tokenData = validateMCPToken(token);
    
    if (!tokenData || !tokenData.valid) {
      return sendResponse(res, 401, 'failure', null, 'Invalid token', 'The provided token is invalid or expired');
    }
    
    if (!tokenData.email) {
      return sendResponse(res, 403, 'failure', null, 'Token missing email', 'This token does not have an associated email address');
    }
    
    const userRoles = await getUserRoles(tokenData.email);
    const hasAdminAccess = userRoles.includes('owner') || userRoles.includes('architect');
    
    if (!hasAdminAccess) {
      return sendResponse(res, 403, 'failure', null, 'Insufficient permissions', 'Owner or architect role required');
    }
    
    req.userEmail = tokenData.email;
    req.userRoles = userRoles;
    req.isGoogleAuth = false;
    next();
  } catch (error) {
    console.error('Error in requireAdminRoleOrGoogle middleware:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Authentication error', 'An error occurred during authentication', error.message);
  }
};

const requireAdminRole = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendResponse(res, 401, 'failure', null, 'Authentication required', 'Bearer token is required');
    }
    
    const token = authHeader.substring(7);
    const validation = await validateMCPToken(token);
    
    if (!validation.valid) {
      return sendResponse(res, 401, 'failure', null, 'Invalid token', validation.reason || 'Token validation failed');
    }
    
    // Check if user has owner or architect role
    const userEmail = validation.email;
    if (!userEmail) {
      return sendResponse(res, 403, 'failure', null, 'Forbidden', 'Token does not have associated email. Only tokens generated via email MFA can access admin endpoints.');
    }
    
    const userRoles = await getUserRoles(userEmail);
    if (!userRoles.includes('owner') && !userRoles.includes('architect')) {
      return sendResponse(res, 403, 'failure', null, 'Forbidden', 'Only owners and architects can access admin endpoints');
    }
    
    // Attach user info to request
    req.userEmail = userEmail;
    req.userRoles = userRoles;
    req.tokenValidation = validation;
    
    next();
  } catch (error) {
    console.error('Error in requireAdminRole middleware:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Authentication error', 'An error occurred while checking permissions', error.message);
  }
};

// ========== Email Service Diagnostic Endpoint ==========

// Diagnostic endpoint to check email service configuration (for debugging)
app.get('/api/email/status', (req, res) => {
  try {
    const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    // Trim whitespace (including \r\n) that might be present in environment variables
    const senderEmailRaw = process.env.SES_SENDER_EMAIL || process.env.SES_FROM_EMAIL || 'hello@cosmiciq.org';
    const senderEmail = senderEmailRaw.trim();
    
    // Check if email service can initialize
    let canInitialize = false;
    let initError = null;
    try {
      const { testConnection } = require('./email-service');
      canInitialize = true;
    } catch (error) {
      initError = error.message;
    }
    
    const envVarNames = Object.keys(process.env).filter(key => 
      key.includes('AWS_') || key.includes('SES_')
    );
    const envVarInfo = {};
    envVarNames.forEach(key => {
      const value = process.env[key];
      if (key.includes('SECRET') || key.includes('KEY')) {
        envVarInfo[key] = value ? `***${value.slice(-4)}` : 'not set';
      } else {
        envVarInfo[key] = value || 'not set';
      }
    });
    
    console.log('[email-status] Configuration check:', {
      hasAccessKey,
      hasSecretKey,
      region,
      senderEmail,
      canInitialize
    });
    
    return sendResponse(res, 200, 'success', {
      configured: hasAccessKey && hasSecretKey,
      hasAccessKey,
      hasSecretKey,
      region,
      senderEmail,
      canInitialize,
      initError,
      debug: {
        envVarNames: envVarNames,
        envVarInfo: envVarInfo
      }
    }, null, 'Email service configuration status');
  } catch (error) {
    console.error('Error checking email status:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to check email status', 'An error occurred while checking email configuration', error.message);
  }
});

// ========== Google OAuth Endpoints ==========

// Diagnostic endpoint to check OAuth configuration status (for debugging)
app.get('/api/auth/google/status', (req, res) => {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    const vercelEnv = process.env.VERCEL_ENV;
    const nodeEnv = process.env.NODE_ENV;
    const isConfigured = isGoogleOAuthConfigured();
    
    // Determine default redirect URI
    const isProduction = vercelEnv === 'production' || nodeEnv === 'production';
    const defaultRedirectUri = isProduction 
      ? 'https://mykeys.zip/oauth2callback'
      : 'http://localhost:5173/oauth2callback';
    const finalRedirectUri = redirectUri || defaultRedirectUri;
    
    // Debug: Log all Google OAuth related env vars (without exposing secrets)
    const envVarNames = Object.keys(process.env).filter(key => 
      key.includes('GOOGLE_OAUTH') || key.includes('VERCEL') || key.includes('NODE_ENV')
    );
    const envVarInfo = {};
    envVarNames.forEach(key => {
      const value = process.env[key];
      if (key.includes('SECRET') || key.includes('CLIENT_SECRET')) {
        envVarInfo[key] = value ? `***${value.slice(-4)}` : 'not set';
      } else {
        envVarInfo[key] = value ? (value.length > 50 ? `${value.substring(0, 50)}...` : value) : 'not set';
      }
    });
    
    console.log('[google-oauth-status] Environment check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId ? clientId.length : 0,
      clientSecretLength: clientSecret ? clientSecret.length : 0,
      vercelEnv,
      nodeEnv,
      allGoogleOAuthVars: envVarNames
    });
    
    return sendResponse(res, 200, 'success', {
      configured: isConfigured,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      redirectUri: finalRedirectUri,
      environment: {
        vercelEnv: vercelEnv || 'not set',
        nodeEnv: nodeEnv || 'not set',
        isProduction: isProduction
      },
      debug: {
        clientIdLength: clientId ? clientId.length : 0,
        clientSecretLength: clientSecret ? clientSecret.length : 0,
        envVarNames: envVarNames,
        envVarInfo: envVarInfo
      }
      // Note: We don't expose the actual values for security
    }, null, 'OAuth configuration status');
  } catch (error) {
    console.error('Error checking OAuth status:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to check OAuth status', 'An error occurred while checking OAuth configuration', error.message);
  }
});

// Get Google OAuth authorization URL
app.get('/api/auth/google/url', (req, res) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      return sendResponse(res, 503, 'failure', null, 'Google OAuth not configured', 'Google OAuth credentials are not set');
    }
    
    const authUrl = getAuthUrl();
    return sendResponse(res, 200, 'success', { authUrl }, null, 'Google OAuth URL generated');
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to generate OAuth URL', 'An error occurred while generating the OAuth URL', error.message);
  }
});

// Verify Google OAuth code and return user info
app.post('/api/auth/google/verify', async (req, res) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      return sendResponse(res, 503, 'failure', null, 'Google OAuth not configured', 'Google OAuth credentials are not set');
    }
    
    const { code, idToken } = req.body;
    
    if (!code && !idToken) {
      return sendResponse(res, 400, 'failure', null, 'Missing required fields', 'Either code or idToken is required');
    }
    
    let userInfo;
    if (idToken) {
      // Client-side verification (more secure)
      userInfo = await verifyIdToken(idToken);
    } else {
      // Server-side code exchange
      userInfo = await verifyGoogleToken(code);
    }
    
    if (!userInfo.verified) {
      return sendResponse(res, 403, 'failure', null, 'Email not verified', 'Google email address is not verified');
    }
    
    return sendResponse(res, 200, 'success', {
      email: userInfo.email
      // Only return email - name and picture are not stored (comma removed intentionally)
    }, null, 'Google authentication successful');
  } catch (error) {
    console.error('Error verifying Google OAuth:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to verify Google OAuth', 'An error occurred while verifying Google authentication', error.message);
  }
});

// Verify Google OAuth and check admin role (for UI access - no token needed)
app.post('/api/auth/google/verify-admin', async (req, res) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      return sendResponse(res, 503, 'failure', null, 'Google OAuth not configured', 'Google OAuth credentials are not set');
    }
    
    const { code, idToken } = req.body;
    
    if (!code && !idToken) {
      return sendResponse(res, 400, 'failure', null, 'Missing required fields', 'Either code or idToken is required');
    }
    
    // Verify Google ID token
    let googleUser;
    let finalIdToken = null;
    if (idToken) {
      // Client-side verification - we already have the ID token
      googleUser = await verifyIdToken(idToken);
      finalIdToken = idToken; // Use the provided ID token
    } else {
      // Server-side code exchange - get ID token from exchange
      googleUser = await verifyGoogleToken(code);
      finalIdToken = googleUser.idToken; // Get ID token from exchange
    }
    
    if (!googleUser.verified) {
      return sendResponse(res, 403, 'failure', null, 'Email not verified', 'Google email address is not verified');
    }
    
    // Check if user has admin role based on Google email
    const userRoles = await getUserRoles(googleUser.email);
    const hasAdminAccess = userRoles.includes('owner') || userRoles.includes('architect');
    
    if (!hasAdminAccess) {
      return sendResponse(res, 403, 'failure', null, 'Insufficient permissions', 'User does not have owner or architect role');
    }
    
    return sendResponse(res, 200, 'success', {
      email: googleUser.email,
      // Only return email - name and picture are not stored
      roles: userRoles,
      hasAdminAccess: true,
      idToken: finalIdToken // Always return ID token (from either source)
    }, null, 'Google authentication successful - admin access granted');
  } catch (error) {
    console.error('Error verifying Google OAuth admin access:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to verify authentication', 'An error occurred while verifying Google authentication', error.message);
  }
});

// ========== Admin Endpoints ==========

// Get admin information (for mykeys-cli) - REMOVED DUPLICATE, using the one below

// ========== MCP Token Generation Endpoints ==========

// Token generation with architect code
app.post('/api/mcp/token/generate', async (req, res) => {
  try {
    const { clientId, clientType, expiresInDays, architectCode } = req.body;
    
    // Check for architect code first
    if (architectCode) {
      const codeData = architectCodes.get(architectCode);
      if (!codeData) {
        return res.status(401).json({
          error: 'Invalid or expired architect code',
          message: 'The architect code is invalid or has expired. Please verify your partial password again.',
        });
      }
      
      if (codeData.expiresAt < Date.now()) {
        architectCodes.delete(architectCode);
        return res.status(401).json({
          error: 'Architect code expired',
          message: 'The architect code has expired. Please verify your partial password again.',
        });
      }
      
      // Code is valid, proceed with token generation
      // Delete code after use (one-time use)
      architectCodes.delete(architectCode);
    } else {
      // Fall back to basic auth for backward compatibility
      // This requires the authenticate middleware
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide either an architect code or use basic authentication.',
      });
    }
    
    if (!clientId || clientId.trim() === '') {
      return res.status(400).json({
        error: 'clientId is required',
      });
    }

    // Default clientType to 'generic' if not provided
    const finalClientType = clientType || 'generic';
    const finalExpiresInDays = expiresInDays || 90;

    console.log('Generating token with:', {
      clientId: clientId.trim(),
      clientType: finalClientType,
      expiresInDays: finalExpiresInDays,
      hasArchitectCode: !!architectCode,
    });

    const result = await generateMCPToken(
      clientId.trim(),
      finalClientType,
      finalExpiresInDays
    );

    return sendResponse(res, 200, 'success', {
      token: result.token,
      tokenId: result.tokenId,
      expiresAt: result.expiresAt,
    }, null, 'Token generated successfully. Save this token - it will not be shown again!');
  } catch (error) {
    console.error('Error generating token:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to generate token';
    let errorDetails = error.message;
    
    if (error.code === 7) {
      errorMessage = 'GCP Secret Manager permission denied';
      errorDetails = 'The service account does not have permission to create secrets. Please check GCP permissions.';
    } else if (error.code === 3) {
      errorMessage = 'Invalid GCP project configuration';
      errorDetails = `Project ID "${process.env.GCP_PROJECT || 'myl-zip-www'}" may be invalid or inaccessible.`;
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      errorMessage = 'GCP Secret Manager connection failed';
      errorDetails = 'Unable to connect to Google Cloud Secret Manager. Check network connectivity and GCP credentials.';
    }
    
    return sendResponse(res, 500, 'failure', null, errorMessage, 'Token generation failed', errorDetails);
  }
});

// Legacy endpoint with authenticate middleware (for backward compatibility)
app.post('/api/mcp/token/generate-legacy', authenticate, async (req, res) => {
  try {
    // Only allow admin (basic auth) to generate tokens
    if (req.authType !== 'basic') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can generate tokens',
      });
    }

    const { clientId, clientType, expiresInDays } = req.body;
    
    if (!clientId || clientId.trim() === '') {
      return res.status(400).json({
        error: 'clientId is required',
      });
    }

    // Default clientType to 'generic' if not provided
    const finalClientType = clientType || 'generic';
    const finalExpiresInDays = expiresInDays || 90;

    const result = await generateMCPToken(
      clientId.trim(),
      finalClientType,
      finalExpiresInDays
    );

    res.json({
      success: true,
      token: result.token,
      tokenId: result.tokenId,
      expiresAt: result.expiresAt,
      message: 'Token generated successfully. Save this token - it will not be shown again!',
    });
  } catch (error) {
    console.error('Error generating token:', error.message);
    res.status(500).json({
      error: 'Failed to generate token',
      details: error.message,
    });
  }
});

// Validate MCP token
app.post('/api/mcp/token/validate', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return sendResponse(res, 400, 'failure', null, 'Token is required', 'Please provide a token to validate');
    }

    const validation = await validateMCPToken(token);
    
    if (validation.valid) {
      return sendResponse(res, 200, 'success', {
        valid: true,
        clientId: validation.clientId,
        clientType: validation.clientType,
        expiresAt: validation.expiresAt,
      }, null, 'Token is valid');
    } else {
      return sendResponse(res, 401, 'failure', {
        valid: false,
        reason: validation.reason,
      }, 'Token validation failed', validation.reason || 'Token is invalid or expired');
    }
  } catch (error) {
    console.error('Error validating token:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to validate token', 'An error occurred while validating the token', error.message);
  }
});

// Get admin info (requires owner or architect role)
app.get('/api/admin/info', requireAdminRole, async (req, res) => {
  try {
    // User info already attached by requireAdminRole middleware
    const userEmail = req.userEmail;
    const userRoles = req.userRoles;
    const validation = req.tokenValidation;
    const context = 'token-based'; // Token-based authentication
    
    // Get stats (if GCP is available)
    let stats = {};
    let ecosystemsCount = 0;
    let secretsCount = 0;
    
    try {
      if (client) {
        // Try to get some basic stats from GCP
        const [secrets] = await client.listSecrets({
          parent: `projects/${PROJECT_ID}`,
        });
        secretsCount = secrets.length;
        
        // Count unique ecosystems (approximate)
        const ecosystems = new Set();
        secrets.forEach(secret => {
          if (secret.labels && secret.labels.ecosystem) {
            ecosystems.add(secret.labels.ecosystem);
          }
        });
        ecosystemsCount = ecosystems.size;
      }
    } catch (error) {
      // Stats are optional, continue without them
      console.warn('Could not fetch stats:', error.message);
    }
    
    // Determine permissions based on roles
    const permissions = [];
    if (userRoles.includes('owner') || userRoles.includes('architect')) {
      permissions.push('read_secrets', 'write_secrets', 'list_secrets', 'manage_tokens', 'architect_access', 'full_system_access', 'roles:manage');
    } else if (userRoles.includes('member')) {
      permissions.push('read_secrets', 'write_secrets', 'list_secrets');
    }
    
    const capabilities = [
      'API access',
      'Secret management',
      'Token generation',
      ...(userRoles.includes('owner') || userRoles.includes('architect') ? ['Architect-level operations', 'System administration', 'Role management'] : []),
    ];
    
    // Build response
    const adminInfo = {
      email: userEmail,
      roles: userRoles,
      primaryRole: userRoles[0] || 'member',
      context: context,
      tokenInfo: {
        clientId: validation.clientId,
        clientType: validation.clientType,
        expiresAt: validation.expiresAt ? validation.expiresAt.toISOString() : null,
        permissions: validation.permissions || ['read', 'write'],
      },
      permissions: permissions,
      capabilities: capabilities,
      stats: {
        secretsCount: secretsCount,
        ecosystemsCount: ecosystemsCount,
      },
    };
    
    res.json(adminInfo);
  } catch (error) {
    console.error('Error getting admin info:', error.message);
    res.status(500).json({
      error: 'Failed to get admin info',
      details: error.message,
    });
  }
});

// Revoke MCP token (requires admin auth)
app.post('/api/mcp/token/revoke', authenticate, async (req, res) => {
  try {
    // Only allow admin (basic auth) to revoke tokens
    if (req.authType !== 'basic') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can revoke tokens',
      });
    }

    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
      });
    }

    const revoked = await revokeMCPToken(token);
    
    res.json({
      success: revoked,
      message: revoked ? 'Token revoked successfully' : 'Token not found',
    });
  } catch (error) {
    console.error('Error revoking token:', error.message);
    res.status(500).json({
      error: 'Failed to revoke token',
      details: error.message,
    });
  }
});

// ========== Role Management Endpoints ==========

// Get all user roles (requires owner or architect)
app.get('/api/admin/roles', requireAdminRoleOrGoogle, async (req, res) => {
  try {
    // User info already attached by requireAdminRoleOrGoogle middleware
    
    // Get all user roles
    const allRoles = await getAllUserRoles();
    
    return sendResponse(res, 200, 'success', {
      users: Object.keys(allRoles).map(email => ({
        email,
        roles: allRoles[email]
      }))
    }, null, 'User roles retrieved successfully');
  } catch (error) {
    console.error('Error getting user roles:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get user roles', 'An error occurred while retrieving user roles', error.message);
  }
});

// Set roles for a user (requires owner or architect)
app.post('/api/admin/roles', requireAdminRoleOrGoogle, async (req, res) => {
  try {
    // User info already attached by requireAdminRole middleware
    
    const { email, roles } = req.body;
    
    if (!email || !roles || !Array.isArray(roles)) {
      return sendResponse(res, 400, 'failure', null, 'Missing required fields', 'Email and roles array are required');
    }
    
    // Set roles
    await setUserRoles(email, roles);
    
    return sendResponse(res, 200, 'success', {
      email,
      roles: await getUserRoles(email)
    }, null, 'User roles updated successfully');
  } catch (error) {
    console.error('Error setting user roles:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to set user roles', 'An error occurred while setting user roles', error.message);
  }
});

// Get roles for a specific user (requires owner or architect)
app.get('/api/admin/roles/:email', requireAdminRoleOrGoogle, async (req, res) => {
  try {
    // User info already attached by requireAdminRoleOrGoogle middleware
    
    const targetEmail = req.params.email;
    const targetRoles = await getUserRoles(targetEmail);
    
    return sendResponse(res, 200, 'success', {
      email: targetEmail,
      roles: targetRoles
    }, null, 'User roles retrieved successfully');
  } catch (error) {
    console.error('Error getting user roles:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get user roles', 'An error occurred while retrieving user roles', error.message);
  }
});

// Remove roles for a user (sets to member only) (requires owner or architect)
app.delete('/api/admin/roles/:email', requireAdminRoleOrGoogle, async (req, res) => {
  try {
    // User info already attached by requireAdminRoleOrGoogle middleware
    
    const targetEmail = req.params.email;
    await removeUserRoles(targetEmail);
    
    return sendResponse(res, 200, 'success', {
      email: targetEmail,
      roles: ['member']
    }, null, 'User roles reset to member');
  } catch (error) {
    console.error('Error removing user roles:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to remove user roles', 'An error occurred while removing user roles', error.message);
  }
});

// ========== Ring Management Endpoints ==========

// Create a new ring (requires owner or architect)
app.post('/api/admin/rings', requireAdminRole, async (req, res) => {
  try {
    const { ringId, firstEmail, initialRoles } = req.body;
    
    if (!firstEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing required field', 'firstEmail is required');
    }
    
    const ring = await createRing(ringId, firstEmail, initialRoles);
    
    return sendResponse(res, 201, 'success', ring, null, 'Ring created successfully');
  } catch (error) {
    console.error('Error creating ring:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to create ring', 'An error occurred while creating the ring', error.message);
  }
});

// Get all rings (requires owner or architect)
app.get('/api/admin/rings', requireAdminRole, async (req, res) => {
  try {
    const rings = await getAllRings();
    
    return sendResponse(res, 200, 'success', rings, null, 'Rings retrieved successfully');
  } catch (error) {
    console.error('Error getting rings:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get rings', 'An error occurred while retrieving rings', error.message);
  }
});

// Get a specific ring (requires owner or architect, or member of that ring)
app.get('/api/admin/rings/:ringId', requireAdminRoleOrGoogle, async (req, res) => {
  try {
    const { ringId } = req.params;
    const ring = await getRing(ringId);
    
    if (!ring) {
      return sendResponse(res, 404, 'failure', null, 'Ring not found', `Ring ${ringId} does not exist`);
    }
    
    // Check if user is member of this ring
    const userEmail = req.userEmail;
    if (userEmail && ring.members[userEmail]) {
      return sendResponse(res, 200, 'success', ring, null, 'Ring retrieved successfully');
    }
    
    // Check if user has admin role (owner/architect)
    if (req.userRoles && (req.userRoles.includes('owner') || req.userRoles.includes('architect'))) {
      return sendResponse(res, 200, 'success', ring, null, 'Ring retrieved successfully');
    }
    
    return sendResponse(res, 403, 'failure', null, 'Forbidden', 'You do not have access to this ring');
  } catch (error) {
    console.error('Error getting ring:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get ring', 'An error occurred while retrieving the ring', error.message);
  }
});

// Get ring for current user's email
app.get('/api/admin/rings/by-email/:email', requireAdminRoleOrGoogle, async (req, res) => {
  try {
    const { email } = req.params;
    const ringId = await getRingForEmail(email);
    
    if (!ringId) {
      return sendResponse(res, 404, 'failure', null, 'Ring not found', `No ring found for email ${email}`);
    }
    
    const ring = await getRing(ringId);
    
    return sendResponse(res, 200, 'success', ring, null, 'Ring retrieved successfully');
  } catch (error) {
    console.error('Error getting ring for email:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get ring', 'An error occurred while retrieving the ring', error.message);
  }
});

// Update ring roles (requires owner or architect of that ring)
app.put('/api/admin/rings/:ringId/roles', requireAdminRole, async (req, res) => {
  try {
    const { ringId } = req.params;
    const { roles } = req.body;
    
    if (!roles || typeof roles !== 'object') {
      return sendResponse(res, 400, 'failure', null, 'Missing required field', 'roles object is required');
    }
    
    const ring = await updateRingRoles(ringId, roles);
    
    return sendResponse(res, 200, 'success', ring, null, 'Ring roles updated successfully');
  } catch (error) {
    console.error('Error updating ring roles:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to update ring roles', 'An error occurred while updating ring roles', error.message);
  }
});

// Add member to ring (requires owner or architect of that ring)
app.post('/api/admin/rings/:ringId/members', requireAdminRole, async (req, res) => {
  try {
    const { ringId } = req.params;
    const { email, roles } = req.body;
    
    if (!email) {
      return sendResponse(res, 400, 'failure', null, 'Missing required field', 'email is required');
    }
    
    const memberRoles = roles || ['member'];
    const ring = await addRingMember(ringId, email, memberRoles);
    
    return sendResponse(res, 200, 'success', ring, null, 'Member added to ring successfully');
  } catch (error) {
    console.error('Error adding ring member:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to add ring member', 'An error occurred while adding member to ring', error.message);
  }
});

// Remove member from ring (requires owner or architect of that ring)
app.delete('/api/admin/rings/:ringId/members/:email', requireAdminRole, async (req, res) => {
  try {
    const { ringId, email } = req.params;
    
    const ring = await removeRingMember(ringId, email);
    
    return sendResponse(res, 200, 'success', ring, null, 'Member removed from ring successfully');
  } catch (error) {
    console.error('Error removing ring member:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to remove ring member', 'An error occurred while removing member from ring', error.message);
  }
});

// Initialize default ring (migration helper - requires owner or architect)
app.post('/api/admin/rings/initialize-default', requireAdminRole, async (req, res) => {
  try {
    const ring = await initializeDefaultRing();
    
    return sendResponse(res, 200, 'success', ring, null, 'Default ring initialized successfully');
  } catch (error) {
    console.error('Error initializing default ring:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to initialize default ring', 'An error occurred while initializing default ring', error.message);
  }
});

// Validate ring roles (utility endpoint)
app.post('/api/admin/rings/validate', requireAdminRole, async (req, res) => {
  try {
    const { roles } = req.body;
    
    if (!roles || typeof roles !== 'object') {
      return sendResponse(res, 400, 'failure', null, 'Missing required field', 'roles object is required');
    }
    
    const validation = validateRingRoles(roles);
    
    return sendResponse(res, 200, 'success', validation, null, 'Ring roles validation completed');
  } catch (error) {
    console.error('Error validating ring roles:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to validate ring roles', 'An error occurred while validating ring roles', error.message);
  }
});

// ========== Ring Discovery & Mesh Connection Endpoints ==========

// Discover all rings in ecosystem (minimal metadata only)
app.get('/api/rings/discover', authenticate, async (req, res) => {
  try {
    const { includeAnonymous = 'true' } = req.query;
    const includeAnon = includeAnonymous === 'true';
    
    const rings = await discoverRings(includeAnon);
    
    return sendResponse(res, 200, 'success', rings, null, 'Rings discovered successfully');
  } catch (error) {
    console.error('Error discovering rings:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to discover rings', 'An error occurred while discovering rings', error.message);
  }
});

// Get metadata for a specific ring
app.get('/api/rings/:ringId/metadata', authenticate, async (req, res) => {
  try {
    const { ringId } = req.params;
    const metadata = await getRingMetadata(ringId);
    
    if (!metadata) {
      return sendResponse(res, 404, 'failure', null, 'Ring not found', `Ring ${ringId} not found in registry`);
    }
    
    return sendResponse(res, 200, 'success', metadata, null, 'Ring metadata retrieved successfully');
  } catch (error) {
    console.error('Error getting ring metadata:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get ring metadata', 'An error occurred while retrieving ring metadata', error.message);
  }
});

// Register/update ring in registry (requires owner or architect)
app.post('/api/admin/rings/:ringId/register', requireAdminRole, async (req, res) => {
  try {
    const { ringId } = req.params;
    const { publicName, capabilities } = req.body;
    
    const metadata = await registerRing(ringId, {
      publicName,
      capabilities: capabilities || ['key-management', 'token-management'],
    });
    
    return sendResponse(res, 200, 'success', metadata, null, 'Ring registered successfully');
  } catch (error) {
    console.error('Error registering ring:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to register ring', 'An error occurred while registering ring', error.message);
  }
});

// Update ring metadata (requires owner or architect)
app.put('/api/admin/rings/:ringId/metadata', requireAdminRole, async (req, res) => {
  try {
    const { ringId } = req.params;
    const { publicName, capabilities } = req.body;
    
    const metadata = await updateRingMetadata(ringId, {
      publicName,
      capabilities,
    });
    
    return sendResponse(res, 200, 'success', metadata, null, 'Ring metadata updated successfully');
  } catch (error) {
    console.error('Error updating ring metadata:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to update ring metadata', 'An error occurred while updating ring metadata', error.message);
  }
});

// Search rings by capability
app.get('/api/rings/search', authenticate, async (req, res) => {
  try {
    const { capability } = req.query;
    
    if (!capability) {
      return sendResponse(res, 400, 'failure', null, 'Missing required parameter', 'capability query parameter is required');
    }
    
    const rings = await searchRingsByCapability(capability);
    
    return sendResponse(res, 200, 'success', rings, null, 'Rings found successfully');
  } catch (error) {
    console.error('Error searching rings:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to search rings', 'An error occurred while searching rings', error.message);
  }
});

// Get current user's ring
app.get('/api/rings/my-ring', authenticate, async (req, res) => {
  try {
    const ringId = req.ringId;
    
    if (!ringId) {
      return sendResponse(res, 404, 'failure', null, 'Ring not found', 'No ring associated with current authentication');
    }
    
    const ring = await getRing(ringId);
    const metadata = await getRingMetadata(ringId);
    
    return sendResponse(res, 200, 'success', {
      ringId: ringId,
      ring: ring,
      metadata: metadata,
    }, null, 'Ring retrieved successfully');
  } catch (error) {
    console.error('Error getting user ring:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get ring', 'An error occurred while retrieving ring', error.message);
  }
});

// ========== Key Management Endpoints ==========

// List all keys in a ring (content belongs to ring, accessible to all members)
app.get('/api/rings/:ringId/keys', authenticate, async (req, res) => {
  try {
    const { ringId } = req.params;
    const userEmail = req.userEmail;
    
    // Verify user has access to this ring
    if (userEmail) {
      const hasAccess = await hasRingAccess(userEmail, ringId);
      if (!hasAccess) {
        return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
      }
    }
    
    const keys = await listRingKeys(ringId);
    
    return sendResponse(res, 200, 'success', {
      ringId,
      keys,
      count: keys.length,
      message: 'All keys are accessible to all ring members'
    }, null, 'Ring keys retrieved successfully');
  } catch (error) {
    console.error('Error listing ring keys:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to list ring keys', 'An error occurred while listing ring keys', error.message);
  }
});

// Copy a key from one ring to another
app.post('/api/rings/:sourceRingId/keys/:keyName/copy', requireAdminRole, async (req, res) => {
  try {
    const { sourceRingId, keyName } = req.params;
    const { targetRingId, newKeyName } = req.body;
    
    if (!targetRingId) {
      return sendResponse(res, 400, 'failure', null, 'Missing required field', 'targetRingId is required');
    }
    
    const result = await copyKeyBetweenRings(sourceRingId, targetRingId, keyName, newKeyName);
    
    return sendResponse(res, 200, 'success', result, null, 'Key copied successfully');
  } catch (error) {
    console.error('Error copying key:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to copy key', 'An error occurred while copying key', error.message);
  }
});

// Move a key from one ring to another
app.post('/api/rings/:sourceRingId/keys/:keyName/move', requireAdminRole, async (req, res) => {
  try {
    const { sourceRingId, keyName } = req.params;
    const { targetRingId, newKeyName } = req.body;
    
    if (!targetRingId) {
      return sendResponse(res, 400, 'failure', null, 'Missing required field', 'targetRingId is required');
    }
    
    const result = await moveKeyBetweenRings(sourceRingId, targetRingId, keyName, newKeyName);
    
    return sendResponse(res, 200, 'success', result, null, 'Key moved successfully');
  } catch (error) {
    console.error('Error moving key:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to move key', 'An error occurred while moving key', error.message);
  }
});

// Share a key within a ring (all members already have access, this is for tracking)
app.post('/api/rings/:ringId/keys/:keyName/share', authenticate, async (req, res) => {
  try {
    const { ringId, keyName } = req.params;
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing user email', 'User email is required for sharing');
    }
    
    // Verify user has access to this ring
    const hasAccess = await hasRingAccess(userEmail, ringId);
    if (!hasAccess) {
      return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
    }
    
    const result = await shareKeyWithinRing(ringId, keyName, userEmail);
    
    return sendResponse(res, 200, 'success', result, null, 'Key sharing information updated');
  } catch (error) {
    console.error('Error sharing key:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to share key', 'An error occurred while sharing key', error.message);
  }
});

// Get key sharing information
app.get('/api/rings/:ringId/keys/:keyName/share', authenticate, async (req, res) => {
  try {
    const { ringId, keyName } = req.params;
    const userEmail = req.userEmail;
    
    // Verify user has access to this ring
    if (userEmail) {
      const hasAccess = await hasRingAccess(userEmail, ringId);
      if (!hasAccess) {
        return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
      }
    }
    
    const sharingInfo = await getKeySharingInfo(ringId, keyName);
    
    if (!sharingInfo) {
      return sendResponse(res, 404, 'failure', null, 'Key not found', `Key ${keyName} not found in ring ${ringId}`);
    }
    
    return sendResponse(res, 200, 'success', sharingInfo, null, 'Key sharing information retrieved successfully');
  } catch (error) {
    console.error('Error getting key sharing info:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get key sharing info', 'An error occurred while retrieving key sharing info', error.message);
  }
});

// ========== Privacy Vault Endpoints (Personal/Sacred Secrets) ==========

// Store a secret in a key's privacy vault (personal/sacred, not shared with ring)
app.post('/api/rings/:ringId/keys/:keyName/vault', authenticate, async (req, res) => {
  try {
    const { ringId, keyName } = req.params;
    const { vault_secret_name, vault_secret_value, master_key } = req.body;
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing user email', 'User email is required');
    }
    
    if (!vault_secret_name || vault_secret_value === undefined) {
      return sendResponse(res, 400, 'failure', null, 'Missing required fields', 'vault_secret_name and vault_secret_value are required');
    }
    
    // Verify user has access to this ring
    const hasAccess = await hasRingAccess(userEmail, ringId);
    if (!hasAccess) {
      return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
    }
    
    const result = await storeVaultSecret(
      ringId,
      keyName,
      userEmail,
      vault_secret_name,
      vault_secret_value,
      master_key
    );
    
    return sendResponse(res, 200, 'success', result, null, 'Vault secret stored successfully. This secret is private to you and not shared with ring members.');
  } catch (error) {
    console.error('Error storing vault secret:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to store vault secret', 'An error occurred while storing vault secret', error.message);
  }
});

// Get a secret from a key's privacy vault
app.get('/api/rings/:ringId/keys/:keyName/vault/:vaultSecretName', authenticate, async (req, res) => {
  try {
    const { ringId, keyName, vaultSecretName } = req.params;
    const { master_key } = req.query;
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing user email', 'User email is required');
    }
    
    // Verify user has access to this ring
    const hasAccess = await hasRingAccess(userEmail, ringId);
    if (!hasAccess) {
      return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
    }
    
    const secretValue = await getVaultSecret(
      ringId,
      keyName,
      userEmail,
      vaultSecretName,
      master_key
    );
    
    if (secretValue === null) {
      return sendResponse(res, 404, 'failure', null, 'Vault secret not found', `Vault secret ${vaultSecretName} not found`);
    }
    
    return sendResponse(res, 200, 'success', {
      ringId,
      keyName,
      vaultSecretName,
      vaultSecretValue: secretValue,
      private: true,
      message: 'This is your personal vault secret, not shared with ring members'
    }, null, 'Vault secret retrieved successfully');
  } catch (error) {
    console.error('Error getting vault secret:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to get vault secret', 'An error occurred while retrieving vault secret', error.message);
  }
});

// List all secrets in a user's vault for a specific key
app.get('/api/rings/:ringId/keys/:keyName/vault', authenticate, async (req, res) => {
  try {
    const { ringId, keyName } = req.params;
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing user email', 'User email is required');
    }
    
    // Verify user has access to this ring
    const hasAccess = await hasRingAccess(userEmail, ringId);
    if (!hasAccess) {
      return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
    }
    
    const secrets = await listVaultSecrets(ringId, keyName, userEmail);
    const metadata = await getVaultMetadata(ringId, keyName, userEmail);
    
    return sendResponse(res, 200, 'success', {
      ringId,
      keyName,
      userId: userEmail,
      vaultSecrets: secrets,
      metadata: metadata,
      message: 'These are your personal vault secrets, not shared with ring members'
    }, null, 'Vault secrets listed successfully');
  } catch (error) {
    console.error('Error listing vault secrets:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to list vault secrets', 'An error occurred while listing vault secrets', error.message);
  }
});

// Delete a secret from a key's privacy vault
app.delete('/api/rings/:ringId/keys/:keyName/vault/:vaultSecretName', authenticate, async (req, res) => {
  try {
    const { ringId, keyName, vaultSecretName } = req.params;
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing user email', 'User email is required');
    }
    
    // Verify user has access to this ring
    const hasAccess = await hasRingAccess(userEmail, ringId);
    if (!hasAccess) {
      return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
    }
    
    const success = await deleteVaultSecret(ringId, keyName, userEmail, vaultSecretName);
    
    return sendResponse(res, 200, 'success', {
      ringId,
      keyName,
      vaultSecretName,
      deleted: success
    }, null, 'Vault secret deleted successfully');
  } catch (error) {
    console.error('Error deleting vault secret:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to delete vault secret', 'An error occurred while deleting vault secret', error.message);
  }
});

// Check if a user has a vault for a specific key
app.get('/api/rings/:ringId/keys/:keyName/vault/exists', authenticate, async (req, res) => {
  try {
    const { ringId, keyName } = req.params;
    const userEmail = req.userEmail;
    
    if (!userEmail) {
      return sendResponse(res, 400, 'failure', null, 'Missing user email', 'User email is required');
    }
    
    // Verify user has access to this ring
    const hasAccess = await hasRingAccess(userEmail, ringId);
    if (!hasAccess) {
      return sendResponse(res, 403, 'failure', null, 'Access denied', 'You do not have access to this ring');
    }
    
    const vaultExists = await hasVault(ringId, keyName, userEmail);
    const metadata = vaultExists ? await getVaultMetadata(ringId, keyName, userEmail) : null;
    
    return sendResponse(res, 200, 'success', {
      ringId,
      keyName,
      userId: userEmail,
      hasVault: vaultExists,
      metadata: metadata
    }, null, 'Vault existence checked successfully');
  } catch (error) {
    console.error('Error checking vault existence:', error.message);
    return sendResponse(res, 500, 'failure', null, 'Failed to check vault existence', 'An error occurred while checking vault existence', error.message);
  }
});

// ========== Device Registration & 2FA Endpoints ==========

// Helper function to get architect code using partial password from .env.local
// MYKEYS_PASS in .env.local is a partial password for mykeys.zip seed token generator
// Returns architect code that can be used for token generation
async function getArchitectCode() {
  const MYKEYS_PASS = process.env.MYKEYS_PASS; // Partial password from .env.local
  if (!MYKEYS_PASS) {
    return null;
  }
  
  try {
    const axios = require('axios');
    const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
    
    // Verify partial password to get architect code
    const response = await axios.post(`${MYKEYS_URL}/api/auth/verify-partial`, {
      partialPassword: MYKEYS_PASS,
    }, {
      timeout: 5000,
    });
    
    if (response.data && response.data.code) {
      console.log('✓ Got architect code using partial password from .env.local');
      return response.data.code;
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error('❌ Partial password verification failed - MYKEYS_PASS in .env.local may be incorrect');
    } else {
      console.warn('⚠️  Could not get architect code with partial password:', error.message);
    }
  }
  
  return null;
}

// Helper function to get auth token using architect code
// Uses architect code to generate a token for API access
async function getAuthToken() {
  const architectCode = await getArchitectCode();
  if (!architectCode) {
    return null;
  }
  
  try {
    const axios = require('axios');
    const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
    
    // Generate token using architect code
    const response = await axios.post(`${MYKEYS_URL}/api/mcp/token/generate`, {
      clientId: 'local-dev-server',
      clientType: 'server',
      expiresInDays: 1, // Short-lived token for local dev
      architectCode: architectCode,
    }, {
      timeout: 5000,
    });
    
    if (response.data && response.data.token) {
      console.log('✓ Generated auth token using architect code');
      return response.data.token;
    }
  } catch (error) {
    console.warn('⚠️  Could not generate token with architect code:', error.message);
  }
  
  return null;
}

// Helper function to get Twilio credentials from mykeys.zip API
// Flow: .env.local (MYKEYS_PASS partial) → architect code → token → fetch credentials
async function getTwilioCredentials() {
  const MYKEYS_PASS = process.env.MYKEYS_PASS; // Partial password from .env.local
  
  if (!MYKEYS_PASS) {
    console.warn('⚠️  MYKEYS_PASS not set in .env.local - cannot fetch credentials from mykeys.zip API');
    console.warn('   MYKEYS_PASS should be a partial password for mykeys.zip seed token generator');
    return null;
  }
  
  try {
    const axios = require('axios');
    const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
    
    // Try to get auth token using architect code flow
    const token = await getAuthToken();
    
    if (token) {
      // Use Bearer token authentication
      const response = await axios.get(`${MYKEYS_URL}/api/secrets/twilio-credentials`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 5000,
      });
      
      if (response.data && response.data.value) {
        const twilioSecret = response.data.value;
        try {
          return typeof twilioSecret === 'string' ? JSON.parse(twilioSecret) : twilioSecret;
        } catch (parseError) {
          console.error('❌ Failed to parse Twilio credentials from mykeys.zip:', parseError.message);
          return null;
        }
      }
    }
    
    // Fallback: Try Basic Auth with partial password (if API supports it)
    const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
    const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
    
    const response = await axios.get(`${MYKEYS_URL}/api/secrets/twilio-credentials`, {
      headers: { 'Authorization': `Basic ${auth}` },
      timeout: 5000,
    });
    
    if (response.data && response.data.value) {
      const twilioSecret = response.data.value;
      try {
        return typeof twilioSecret === 'string' ? JSON.parse(twilioSecret) : twilioSecret;
      } catch (parseError) {
        console.error('❌ Failed to parse Twilio credentials from mykeys.zip:', parseError.message);
        return null;
      }
    }
  } catch (apiError) {
    if (apiError.response) {
      if (apiError.response.status === 401) {
        console.error('❌ Authentication failed - check MYKEYS_PASS (partial password) in .env.local');
        console.error('   MYKEYS_PASS should be a partial of the admin password for mykeys.zip');
      } else if (apiError.response.status === 404) {
        console.error('❌ Twilio credentials not found in mykeys.zip API');
      } else {
        console.error('❌ Error fetching Twilio credentials:', apiError.message);
      }
    } else {
      console.error('❌ Network error fetching Twilio credentials:', apiError.message);
    }
  }
  
  return null;
}

// Helper function to send 2FA code via SMS using SMS service module
async function send2FACodeViaSMS(phoneNumber, code, useTwilioVerify = false, serviceName = 'mykeys') {
  try {
    // Get Twilio credentials from mykeys.zip (centralized credential management)
    const twilio = await getTwilioCredentials();
    if (!twilio) {
      console.error('❌ Twilio credentials not found');
      console.error('   Configure twilio-credentials in mykeys.zip API');
      console.error('   Or set in local GCP Secret Manager for development');
      return { 
        success: false, 
        verificationSid: null, 
        error: 'Twilio credentials not found. Configure twilio-credentials in mykeys.zip API (https://mykeys.zip/api/secrets/twilio-credentials)' 
      };
    }

    // Validate required fields
    if (!twilio.account_sid) {
      console.error('❌ Twilio account_sid is missing');
      return { 
        success: false, 
        verificationSid: null, 
        error: 'Twilio account_sid is required' 
      };
    }

    if (!twilio.auth_token) {
      console.error('❌ Twilio auth_token is missing');
      return { 
        success: false, 
        verificationSid: null, 
        error: 'Twilio auth_token is required' 
      };
    }

    const axios = require('axios');
    const fromNumber = twilio.phone_number || '+16269959974';

    console.log(`📤 Sending SMS via Twilio:`);
    console.log(`   From: ${fromNumber}`);
    console.log(`   To: ${phoneNumber}`);
    console.log(`   Account SID: ${twilio.account_sid.substring(0, 10)}...`);

    // For CLI MFA, we always send our own 4-digit code via Messages API
    // This allows us to control the code format and message
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio.account_sid}/Messages.json`,
      new URLSearchParams({
        From: fromNumber,
        To: phoneNumber,
        Body: `Your mykeys.zip verification code is: ${code}. Valid for 10 minutes.`,
      }),
      {
        auth: {
          username: twilio.account_sid,
          password: twilio.auth_token,
        },
        timeout: 30000,
      }
    );

    if (response.status === 201) {
      console.log(`✓ SMS sent successfully`);
      console.log(`   Message SID: ${response.data.sid}`);
      console.log(`   Status: ${response.data.status}`);
      return {
        success: true,
        verificationSid: response.data.sid,
        method: 'twilio-messages',
        message: '4-digit verification code sent via SMS',
        messageSid: response.data.sid,
        status: response.data.status,
      };
    } else {
      console.error(`❌ Unexpected response status: ${response.status}`);
      return {
        success: false,
        verificationSid: null,
        error: `Unexpected response status: ${response.status}`,
      };
    }
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Error sending SMS via Twilio:');
    console.error(`   Message: ${error.message}`);
    
    if (error.response) {
      // Twilio API error response
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Code: ${error.response.data?.code || 'N/A'}`);
      console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
      
      // Common Twilio error codes
      const errorCode = error.response.data?.code;
      let userMessage = error.response.data?.message || error.message;
      
      if (errorCode === 21211) {
        userMessage = 'Invalid phone number format. Use E.164 format (e.g., +12132484250)';
      } else if (errorCode === 21212) {
        userMessage = 'Invalid phone number. Number is not a valid mobile number.';
      } else if (errorCode === 21408) {
        userMessage = 'Permission denied. Phone number not verified (trial account restriction).';
      } else if (errorCode === 21608) {
        userMessage = 'Unsubscribed recipient. Phone number has opted out.';
      } else if (errorCode === 21610) {
        userMessage = 'Unsubscribed recipient. Phone number is on the unsubscribe list.';
      } else if (errorCode === 21614) {
        userMessage = 'Invalid "To" phone number. Number is not a valid mobile number.';
      } else if (error.response.status === 401) {
        userMessage = 'Authentication failed. Check Twilio account_sid and auth_token.';
      } else if (error.response.status === 404) {
        userMessage = 'Account not found. Check Twilio account_sid.';
      }
      
      return { 
        success: false, 
        verificationSid: null, 
        error: userMessage,
        errorCode: errorCode,
        statusCode: error.response.status,
      };
    } else if (error.request) {
      // Network error
      console.error('   Network error - no response received');
      return { 
        success: false, 
        verificationSid: null, 
        error: 'Network error. Check internet connection and Twilio API availability.' 
      };
    } else {
      // Other error
      return { 
        success: false, 
        verificationSid: null, 
        error: error.message 
      };
    }
  }
}

// Import ProtonMail email service
const { sendAuthCode } = require('./email-service');

// Helper function to send 2FA code via Email (AWS SES)
async function send2FACodeViaEmail(email, code) {
  try {
    console.log(`[send2FACodeViaEmail] Attempting to send code to ${email}`);
    const result = await sendAuthCode(email, code, 'admin');
    console.log(`[send2FACodeViaEmail] Result:`, result);
    return { success: result.success };
  } catch (error) {
    console.error('[send2FACodeViaEmail] Error sending email via AWS SES:');
    console.error(`  Error message: ${error.message}`);
    console.error(`  Error stack:`, error.stack);
    return { success: false, error: error.message };
  }
}

// Register device (Step 1: Request 2FA code)
app.post('/api/devices/register', authenticate, async (req, res) => {
  try {
    // Only allow basic auth for device registration
    if (req.authType !== 'basic') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Device registration requires admin credentials',
      });
    }

    const { device_fingerprint, phone_number, email, prefer_sms } = req.body;

    if (!device_fingerprint) {
      return res.status(400).json({
        error: 'device_fingerprint is required',
      });
    }

    // Get username from auth
    const authHeader = req.headers.authorization;
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const username = credentials.split(':')[0];

    // Determine delivery method: prefer SMS if phone_number provided and prefer_sms is true
    const useSMS = phone_number && (prefer_sms !== false); // Default to SMS if phone provided
    const useEmail = email && (!useSMS || prefer_sms === false);

    // Generate 2FA code (for email fallback or manual verification)
    const code = generate2FACode();
    const challengeId = crypto.randomBytes(16).toString('hex');

    // Store challenge
    const fingerprintHash = require('./device-auth').generateDeviceFingerprint(device_fingerprint);
    
    // Send 2FA code
    let sent = false;
    let verificationSid = null;
    let deliveryMethod = null;

    if (useSMS && phone_number) {
      // Use Twilio Verify API (preferred method)
      const smsResult = await send2FACodeViaSMS(phone_number, code, true);
      if (smsResult.success) {
        sent = true;
        verificationSid = smsResult.verificationSid;
        deliveryMethod = smsResult.method || 'sms';
        
        // Store challenge with verification SID for Twilio Verify
        await store2FAChallenge(challengeId, code, device_fingerprint, username, {
          verificationSid: verificationSid,
          phoneNumber: phone_number,
          deliveryMethod: 'twilio-verify',
        });
      }
    }
    
    // Fallback to email if SMS failed or email preferred
    if (!sent && useEmail && email) {
      sent = await send2FACodeViaEmail(email, code);
      if (sent) {
        deliveryMethod = 'email';
        await store2FAChallenge(challengeId, code, device_fingerprint, username, {
          email: email,
          deliveryMethod: 'email',
        });
      }
    }

    // If no delivery method worked, still create challenge for manual code entry
    if (!sent) {
      await store2FAChallenge(challengeId, code, device_fingerprint, username);
      console.warn('2FA code delivery failed, but challenge created');
    }

    res.json({
      success: true,
      device_id: null, // Will be set after 2FA verification
      challenge_id: challengeId,
      verification_sid: verificationSid, // For Twilio Verify API verification
      delivery_method: deliveryMethod || 'manual',
      message: sent
        ? `2FA code sent successfully via ${deliveryMethod || 'SMS'}`
        : '2FA code generated (delivery may have failed - check logs)',
      expires_in_minutes: 10,
      // Include code only if delivery failed (for testing/debugging)
      ...(process.env.NODE_ENV === 'development' && !sent ? { code } : {}),
    });
  } catch (error) {
    console.error('Error registering device:', error.message);
    res.status(500).json({
      error: 'Failed to register device',
      details: error.message,
    });
  }
});

// Verify 2FA and complete device registration (Step 2: Get device token)
app.post('/api/devices/verify-2fa', authenticate, async (req, res) => {
  try {
    // Only allow basic auth for 2FA verification
    if (req.authType !== 'basic') {
      return res.status(403).json({
        error: 'Forbidden',
        message: '2FA verification requires admin credentials',
      });
    }

    const { challenge_id, code, verification_sid, phone_number } = req.body;

    if (!challenge_id || !code) {
      return res.status(400).json({
        error: 'challenge_id and code are required',
      });
    }

    // If verification_sid is provided, use Twilio Verify API for verification
    if (verification_sid && phone_number) {
      try {
        const twilio = await getTwilioCredentials();
        if (twilio) {
          const axios = require('axios');

          // Verify code using Twilio Verify API
          const verifyResponse = await axios.post(
            `https://verify.twilio.com/v2/Services/${twilio.verify_service_sid}/VerificationCheck`,
            new URLSearchParams({
              To: phone_number,
              Code: code,
            }),
            {
              auth: {
                username: twilio.account_sid,
                password: twilio.auth_token,
              },
            }
          );

          if (verifyResponse.data.status === 'approved') {
            // Twilio verified successfully, now get challenge data to complete registration
            const challengeData = await get2FAChallenge(challenge_id);
            if (!challengeData) {
              return res.status(404).json({
                error: 'Challenge not found',
              });
            }

            // Register device and get token
            const device = await registerDevice(
              challengeData.deviceFingerprint,
              challengeData.username
            );

            // Clean up challenge
            await delete2FAChallenge(challenge_id);

            return res.json({
              success: true,
              device_id: device.deviceId,
              device_token: device.deviceToken,
              expires_at: device.expiresAt,
              verified_via: 'twilio-verify',
              message: 'Device registered successfully. Save the device_token - it will not be shown again!',
            });
          } else {
            return res.status(401).json({
              error: '2FA verification failed',
              reason: 'Invalid verification code',
              status: verifyResponse.data.status,
            });
          }
        }
      } catch (verifyError) {
        console.error('Twilio Verify API error:', verifyError.message);
        // Fall through to manual verification
      }
    }

    // Fallback to manual code verification (for email or if Twilio Verify fails)
    const verification = await verify2FACode(challenge_id, code);

    if (!verification.valid) {
      return res.status(401).json({
        error: '2FA verification failed',
        reason: verification.reason,
        attempts: verification.attempts,
      });
    }

    // Register device and get token
    const device = await registerDevice(
      verification.deviceFingerprint,
      verification.username
    );

    res.json({
      success: true,
      device_id: device.deviceId,
      device_token: device.deviceToken,
      expires_at: device.expiresAt,
      verified_via: 'manual',
      message: 'Device registered successfully. Save the device_token - it will not be shown again!',
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error.message);
    res.status(500).json({
      error: 'Failed to verify 2FA',
      details: error.message,
    });
  }
});

// Validate device token
app.post('/api/devices/validate', async (req, res) => {
  try {
    const { device_token } = req.body;

    if (!device_token) {
      return res.status(400).json({
        error: 'device_token is required',
      });
    }

    const validation = await validateDeviceToken(device_token);

    res.json({
      valid: validation.valid,
      device_id: validation.deviceId,
      username: validation.username,
      reason: validation.reason,
    });
  } catch (error) {
    console.error('Error validating device token:', error.message);
    res.status(500).json({
      error: 'Failed to validate device token',
      details: error.message,
    });
  }
});

// List devices (requires admin auth)
app.get('/api/devices', authenticate, async (req, res) => {
  try {
    // Get username from auth
    const authHeader = req.headers.authorization;
    let username;

    if (req.authType === 'basic') {
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      username = credentials.split(':')[0];
    } else if (req.authType === 'bearer') {
      // For device tokens, get username from token validation
      const token = authHeader.substring(7);
      const deviceValidation = await validateDeviceToken(token);
      if (!deviceValidation.valid) {
        return res.status(401).json({ error: 'Invalid device token' });
      }
      username = deviceValidation.username;
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const devices = await listDevices(username);

    res.json({
      success: true,
      devices: devices,
    });
  } catch (error) {
    console.error('Error listing devices:', error.message);
    res.status(500).json({
      error: 'Failed to list devices',
      details: error.message,
    });
  }
});

// Revoke device (requires admin auth)
app.delete('/api/devices/:deviceId', authenticate, async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get username from auth
    const authHeader = req.headers.authorization;
    let username;

    if (req.authType === 'basic') {
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      username = credentials.split(':')[0];
    } else {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin can revoke devices',
      });
    }

    const result = await revokeDevice(deviceId, username);

    if (!result.success) {
      return res.status(400).json({
        error: result.reason || 'Failed to revoke device',
      });
    }

    res.json({
      success: true,
      message: 'Device revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking device:', error.message);
    res.status(500).json({
      error: 'Failed to revoke device',
      details: error.message,
    });
  }
});

// Update authenticate middleware to support device tokens
const originalAuthenticate = authenticate;
const authenticateWithDevice = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Authorization header is required',
      service: 'mykeys-api',
    });
  }

  // Check for device token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Try device token first
    if (token.length >= 32) {
      const deviceValidation = await validateDeviceToken(token);
      if (deviceValidation.valid) {
        req.authType = 'device';
        req.deviceId = deviceValidation.deviceId;
        req.username = deviceValidation.username;
        return next();
      }
    }

    // Fall back to MCP token
    try {
      const validation = await validateMCPToken(token);
      if (validation.valid) {
        req.authType = 'bearer';
        req.token = token;
        req.clientId = validation.clientId;
        req.clientType = validation.clientType;
        return next();
      }
    } catch (err) {
      // Continue to basic auth
    }
  }

  // Fall back to original authenticate
  return originalAuthenticate(req, res, next);
};

// ========== Session Storage API (Encrypted) ==========

// In-memory session storage (in production, use GCP Secret Manager or database)
const sessionStorage = new Map(); // seed -> { encrypted, iv, algorithm, updatedAt }

// Store encrypted session
app.put('/api/sessions/:seed', authenticateWithDevice, async (req, res) => {
  try {
    const seed = req.params.seed;
    const { encrypted, iv, algorithm } = req.body;

    if (!encrypted || !iv || !algorithm) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'encrypted, iv, and algorithm are required',
      });
    }

    // Store encrypted session (server never sees plaintext)
    sessionStorage.set(seed, {
      encrypted,
      iv,
      algorithm,
      updatedAt: new Date().toISOString(),
      clientId: req.clientId || req.deviceId || 'unknown',
    });

    // Optionally also store in GCP Secret Manager for persistence
    try {
      const secretName = `session-${seed}`;
      const secretValue = JSON.stringify({ encrypted, iv, algorithm });
      await client.createSecret({
        parent: `projects/${PROJECT_ID}`,
        secretId: secretName,
        secret: {
          replication: {
            automatic: {},
          },
        },
      }).catch(() => {
        // Secret might already exist, that's okay
      });

      await client.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/${secretName}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });
    } catch (gcpError) {
      // GCP storage is optional, continue with in-memory
      console.warn('Failed to store session in GCP Secret Manager:', gcpError.message);
    }

    res.json({
      success: true,
      message: 'Session stored successfully',
      seed,
    });
  } catch (error) {
    console.error('Error storing session:', error.message);
    res.status(500).json({
      error: 'Failed to store session',
      details: error.message,
    });
  }
});

// Retrieve encrypted session
app.get('/api/sessions/:seed', authenticateWithDevice, async (req, res) => {
  try {
    const seed = req.params.seed;

    // Try in-memory first
    let sessionData = sessionStorage.get(seed);

    // If not in memory, try GCP Secret Manager
    if (!sessionData) {
      try {
        const secretName = `session-${seed}`;
        const [version] = await client.accessSecretVersion({
          name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
        });
        const secretValue = version.payload.data.toString('utf8');
        sessionData = JSON.parse(secretValue);
      } catch (gcpError) {
        // Session not found in GCP either
        return res.status(404).json({
          error: 'Session not found',
          message: `No session found for seed: ${seed}`,
        });
      }
    }

    res.json({
      success: true,
      encrypted: sessionData.encrypted,
      iv: sessionData.iv,
      algorithm: sessionData.algorithm,
      updatedAt: sessionData.updatedAt,
    });
  } catch (error) {
    console.error('Error retrieving session:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve session',
      details: error.message,
    });
  }
});

// Delete session
app.delete('/api/sessions/:seed', authenticateWithDevice, async (req, res) => {
  try {
    const seed = req.params.seed;

    // Remove from memory
    sessionStorage.delete(seed);

    // Try to delete from GCP Secret Manager
    try {
      const secretName = `session-${seed}`;
      await client.deleteSecret({
        name: `projects/${PROJECT_ID}/secrets/${secretName}`,
      });
    } catch (gcpError) {
      // Secret might not exist, that's okay
    }

    res.json({
      success: true,
      message: 'Session deleted successfully',
      seed,
    });
  } catch (error) {
    console.error('Error deleting session:', error.message);
    res.status(500).json({
      error: 'Failed to delete session',
      details: error.message,
    });
  }
});

// List sessions (returns only metadata, not encrypted data)
app.get('/api/sessions', authenticateWithDevice, async (req, res) => {
  try {
    const sessions = [];

    // Get from memory
    for (const [seed, data] of sessionStorage.entries()) {
      sessions.push({
        seed,
        updatedAt: data.updatedAt,
        clientId: data.clientId,
      });
    }

    // Optionally also list from GCP Secret Manager
    try {
      const [secrets] = await client.listSecrets({
        parent: `projects/${PROJECT_ID}`,
        filter: 'name:session-*',
      });

      for (const secret of secrets) {
        const seed = secret.name.split('/').pop().replace('session-', '');
        if (!sessions.find(s => s.seed === seed)) {
          sessions.push({
            seed,
            updatedAt: secret.createTime?.seconds ? new Date(secret.createTime.seconds * 1000).toISOString() : null,
            clientId: 'unknown',
          });
        }
      }
    } catch (gcpError) {
      // GCP listing is optional
    }

    res.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('Error listing sessions:', error.message);
    res.status(500).json({
      error: 'Failed to list sessions',
      details: error.message,
    });
  }
});

// ========== Fragment Storage API ==========

// In-memory fragment storage
const fragmentStorage = new Map(); // seed-index -> fragment data

// Store encrypted fragment
app.put('/api/sessions/:seed/fragments/:index', authenticateWithDevice, async (req, res) => {
  try {
    const seed = req.params.seed;
    const index = parseInt(req.params.index);
    const { encrypted, iv, algorithm, metadata } = req.body;

    if (!encrypted || !iv || !algorithm) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'encrypted, iv, and algorithm are required',
      });
    }

    const fragmentKey = `${seed}-${index}`;
    fragmentStorage.set(fragmentKey, {
      encrypted,
      iv,
      algorithm,
      metadata: metadata || {},
      updatedAt: new Date().toISOString(),
      clientId: req.clientId || req.deviceId || 'unknown',
    });

    // Optionally also store in GCP Secret Manager
    try {
      const secretName = `session-fragment-${seed}-${index}`;
      const secretValue = JSON.stringify({ encrypted, iv, algorithm, metadata });
      await client.createSecret({
        parent: `projects/${PROJECT_ID}`,
        secretId: secretName,
        secret: {
          replication: {
            automatic: {},
          },
        },
      }).catch(() => {
        // Secret might already exist
      });

      await client.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/${secretName}`,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });
    } catch (gcpError) {
      // GCP storage is optional
    }

    res.json({
      success: true,
      message: 'Fragment stored successfully',
      seed,
      index,
    });
  } catch (error) {
    console.error('Error storing fragment:', error.message);
    res.status(500).json({
      error: 'Failed to store fragment',
      details: error.message,
    });
  }
});

// Retrieve encrypted fragment
app.get('/api/sessions/:seed/fragments/:index', authenticateWithDevice, async (req, res) => {
  try {
    const seed = req.params.seed;
    const index = parseInt(req.params.index);
    const fragmentKey = `${seed}-${index}`;

    // Try in-memory first
    let fragmentData = fragmentStorage.get(fragmentKey);

    // If not in memory, try GCP Secret Manager
    if (!fragmentData) {
      try {
        const secretName = `session-fragment-${seed}-${index}`;
        const [version] = await client.accessSecretVersion({
          name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
        });
        const secretValue = version.payload.data.toString('utf8');
        fragmentData = JSON.parse(secretValue);
      } catch (gcpError) {
        return res.status(404).json({
          error: 'Fragment not found',
          message: `No fragment found for seed: ${seed}, index: ${index}`,
        });
      }
    }

    res.json({
      success: true,
      index,
      encrypted: fragmentData.encrypted,
      iv: fragmentData.iv,
      algorithm: fragmentData.algorithm,
      metadata: fragmentData.metadata,
      updatedAt: fragmentData.updatedAt,
    });
  } catch (error) {
    console.error('Error retrieving fragment:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve fragment',
      details: error.message,
    });
  }
});

// List fragments for a session
app.get('/api/sessions/:seed/fragments', authenticateWithDevice, async (req, res) => {
  try {
    const seed = req.params.seed;
    const fragments = [];

    // Get from memory
    for (const [key, data] of fragmentStorage.entries()) {
      if (key.startsWith(`${seed}-`)) {
        const index = parseInt(key.split('-').pop());
        fragments.push({
          index,
          updatedAt: data.updatedAt,
        });
      }
    }

    // Also check GCP Secret Manager
    try {
      const [secrets] = await client.listSecrets({
        parent: `projects/${PROJECT_ID}`,
        filter: `name:session-fragment-${seed}-*`,
      });

      for (const secret of secrets) {
        const indexMatch = secret.name.match(/session-fragment-.*-(\d+)$/);
        if (indexMatch) {
          const index = parseInt(indexMatch[1]);
          if (!fragments.find(f => f.index === index)) {
            fragments.push({
              index,
              updatedAt: secret.createTime?.seconds ? new Date(secret.createTime.seconds * 1000).toISOString() : null,
            });
          }
        }
      }
    } catch (gcpError) {
      // GCP listing is optional
    }

    fragments.sort((a, b) => a.index - b.index);

    res.json({
      success: true,
      seed,
      fragments,
      count: fragments.length,
    });
  } catch (error) {
    console.error('Error listing fragments:', error.message);
    res.status(500).json({
      error: 'Failed to list fragments',
      details: error.message,
    });
  }
});

// ========== Error Handling ==========

// Catch-all for undefined API routes (but not static files)
app.use((req, res, next) => {
  // Only handle API routes - let static files pass through
  if (req.path.startsWith('/api/') || req.path === '/health') {
    res.status(404).json({
      error: 'Endpoint not found',
      message: 'The requested endpoint does not exist',
      service: 'mykeys-api',
      availableEndpoints: [
        'GET /health',
        'GET /api/health',
        'GET /api/v1/health',
        'GET /api/secrets',
        'GET /api/secrets/:name',
        'POST /api/secrets',
        'PUT /api/secrets/:name',
        'DELETE /api/secrets/:name',
        'GET /api/v1/secrets/:ecosystem/:secretName',
        'POST /api/v1/secrets/:ecosystem',
        'GET /api/v1/secrets/:ecosystem',
        'POST /api/tld/:domain',
        'GET /api/tld/:domain',
        'POST /api/auth/verify-partial',
        'POST /api/auth/request-mfa-code',
        'POST /api/auth/verify-mfa-code',
        'GET /api/admin/info',
        'POST /api/mcp/token/generate',
        'POST /api/mcp/token/generate-legacy',
        'POST /api/mcp/token/validate',
        'POST /api/mcp/token/revoke',
        'POST /api/devices/register',
        'POST /api/devices/verify-2fa',
        'POST /api/devices/validate',
        'GET /api/devices',
        'DELETE /api/devices/:deviceId',
        'PUT /api/sessions/:seed',
        'GET /api/sessions/:seed',
        'GET /api/sessions',
        'DELETE /api/sessions/:seed',
        'PUT /api/sessions/:seed/fragments/:index',
        'GET /api/sessions/:seed/fragments/:index',
        'GET /api/sessions/:seed/fragments'
      ]
    });
  } else {
    // For non-API routes, let express.static handle it (or return 404 for missing files)
    next();
  }
});

// OAuth callback route (must be before static file serving)
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  
  if (error) {
    return res.redirect(`/role-management.html?error=${encodeURIComponent(error)}`);
  }
  
  if (code) {
    return res.redirect(`/role-management.html?code=${code}`);
  }
  
  res.redirect('/role-management.html');
});

// Serve static files (including React Router app)
app.use(express.static(path.join(__dirname, 'public'), {
  index: 'index.html',
  extensions: ['html']
}));

// Serve React Router app - catch all non-API routes and serve index.html for client-side routing
app.get('*', (req, res, next) => {
  // Skip API routes and specific HTML files
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/mcp-config-generator') || 
      req.path.startsWith('/generate-token') ||
      req.path.startsWith('/rebuild') ||
      req.path === '/role-management.html' ||
      req.path.endsWith('.html')) {
    return next();
  }
  // Serve React app index.html for all other routes (client-side routing)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    service: 'mykeys-api'
  });
});

// Start server
app.listen(FINAL_PORT, () => {
  console.log(`🚀 MyKeys API Service running on port ${FINAL_PORT}`);
  console.log(`📦 Project: ${PROJECT_ID}`);
  console.log(`🔐 Authentication: Basic Auth + Bearer Token`);
  console.log(`📚 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/v1/health`);
  console.log(`   GET  /api/secrets`);
  console.log(`   GET  /api/secrets/:name`);
  console.log(`   POST /api/secrets`);
  console.log(`   GET  /api/v1/secrets/:ecosystem/:secretName`);
  console.log(`   POST /api/v1/secrets/:ecosystem`);
  console.log(`   GET  /api/v1/secrets/:ecosystem`);
  console.log(`   POST /api/tld/:domain`);
  console.log(`   GET  /api/tld/:domain`);
});

module.exports = app;
