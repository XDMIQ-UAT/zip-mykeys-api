const express = require('express');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// Use Vercel KV (Redis) - already connected in Vercel
// Support both standard KV vars and mykeys_ prefixed vars
const { createClient } = require('@vercel/kv');

// Create KV client with fallback to mykeys_ prefixed variables
let kv = null;
function getKV() {
  if (!kv) {
    const kvUrl = process.env.KV_REST_API_URL || process.env.mykeys_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.mykeys_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (kvUrl && kvToken) {
      kv = createClient({
        url: kvUrl,
        token: kvToken,
      });
    } else {
      // Try default @vercel/kv (requires KV_REST_API_URL/TOKEN)
      try {
        const { kv: defaultKv } = require('@vercel/kv');
        kv = defaultKv;
      } catch (e) {
        console.error('KV client not available - missing environment variables');
      }
    }
  }
  return kv;
}
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { generateMCPToken, validateMCPToken, revokeMCPToken } = require('./token-auth');
const { sendVerificationCode: sendSMSVerificationCode } = require('./sms-service');
const { sendAuthCode: sendEmailAuthCode } = require('./email-service');
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
// Priority: .env.local (local dev) > .env (shared defaults)
require('dotenv').config({ path: '.env.local' }); // Load .env.local first (higher priority)
require('dotenv').config(); // Then load .env as fallback

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
const PORT = process.env.PORT || 8080;

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
// Helper function to get secret from Redis/KV
async function getSecretFromRedis(secretName) {
  const kvClient = getKV();
  if (!kvClient) return null;
  
  try {
    const value = await kvClient.get(`secret:${secretName}`);
    if (value === null) {
      console.log(`[INFO] Secret ${secretName} not found in KV`);
      return null;
    }
    return value;
  } catch (error) {
    console.error(`[ERROR] Failed to get secret ${secretName} from KV:`, error.message);
    return null;
  }
}

// Helper function to store secret in Redis
async function storeSecretInRedis(secretName, secretValue, labels = {}) {
  const kvClient = getKV();
  if (!kvClient) throw new Error('KV client not initialized');
  
  try {
    // Check if secret exists
    const existing = await kvClient.get(`secret:${secretName}`);
    const exists = existing !== null;
    
    // Store secret value
    await kvClient.set(`secret:${secretName}`, secretValue);
    
    // Store metadata if labels provided
    if (Object.keys(labels).length > 0) {
      await kvClient.set(`secret:${secretName}:meta`, JSON.stringify({
        labels,
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

// Unified secret getter - Simple: Read from Redis or GCP
async function getSecret(secretName) {
  if (SECRET_STORAGE_MODE === 'gcp') {
    return await getSecretFromGCP(secretName);
  }
  
  // Read from Redis
  const value = await getSecretFromRedis(secretName);
  if (value !== null) {
    return value;
  }
  
  // Fallback to GCP if hybrid mode
  if (SECRET_STORAGE_MODE === 'hybrid' && client) {
    const gcpValue = await getSecretFromGCP(secretName);
    if (gcpValue) {
      await storeSecretInRedis(secretName, gcpValue);
      return gcpValue;
    }
  }
  
  return null;
}

// Unified secret setter - Simple: Store in Redis or GCP
async function storeSecret(secretName, secretValue, labels = {}) {
  if (SECRET_STORAGE_MODE === 'gcp') {
    return await storeSecretInGCP(secretName, secretValue, labels);
  }
  
  // Store in Redis
  const result = await storeSecretInRedis(secretName, secretValue, labels);
  
  // Sync to GCP if hybrid mode
  if (SECRET_STORAGE_MODE === 'hybrid' && client) {
    try {
      await storeSecretInGCP(secretName, secretValue, labels);
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
        'Download TypeScript source: https://mykeys.zip/mcp-server.ts',
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
    
    // Try to get from GCP Secret Manager first
    // Format: ecosystem-secretName or just secretName
    const possibleNames = [
      `${ecosystem}-${secretName}`,
      secretName
    ];
    
    let secretValue = null;
    for (const name of possibleNames) {
      secretValue = await getSecret(name);
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

// Store secret (v1 format with ecosystem)
app.post('/api/v1/secrets/:ecosystem', authenticate, async (req, res) => {
  try {
    const { ecosystem } = req.params;
    const { secret_name, secret_value, description } = req.body;
    
    if (!secret_name || secret_value === undefined) {
      return res.status(400).json({ error: 'secret_name and secret_value are required' });
    }
    
    const secretName = `${ecosystem}-${secret_name}`;
    const secretValueStr = typeof secret_value === 'string' 
      ? secret_value 
      : JSON.stringify(secret_value);
    
    const labels = {
      ecosystem: ecosystem,
      ...(description && { description: description })
    };
    
    const result = await storeSecret(secretName, secretValueStr, labels);
    
    res.json({
      success: true,
      secret_name: secret_name,
      ecosystem: ecosystem,
      message: `Secret ${secret_name} ${result.created ? 'created' : 'updated'} successfully`
    });
  } catch (error) {
    console.error(`Error storing secret ${req.params.ecosystem}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to store secret',
      details: error.message 
    });
  }
});

// List secrets for ecosystem (v1 format)
app.get('/api/v1/secrets/:ecosystem', authenticate, async (req, res) => {
  try {
    const { ecosystem } = req.params;
    
    const [secrets] = await client.listSecrets({
      parent: `projects/${PROJECT_ID}`,
    });
    
    // Filter secrets by ecosystem label or name prefix
    const ecosystemSecrets = secrets
      .filter(secret => {
        const name = secret.name.split('/').pop();
        const labels = secret.labels || {};
        return name.startsWith(`${ecosystem}-`) || labels.ecosystem === ecosystem;
      })
      .map(secret => ({
        secret_name: secret.name.split('/').pop().replace(`${ecosystem}-`, ''),
        ecosystem: ecosystem,
        created: secret.createTime,
        labels: secret.labels || {}
      }));
    
    res.json({
      success: true,
      ecosystem: ecosystem,
      secrets: ecosystemSecrets
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
      // Determine service name from request (defaults to 'mykeys')
      const serviceName = req.body.service || 'mykeys';
      // For SMS, send the 4-digit code via Twilio
      result = await send2FACodeViaSMS(phoneNumber, code, false, serviceName);
      if (result.success) {
        mfaCodes.set(phoneNumber, {
          code,
          expiresAt,
          verificationSid: result.verificationSid,
        });
      }
    } else if (email) {
      const emailResult = await send2FACodeViaEmail(email, code);
      if (emailResult.success) {
        mfaCodes.set(email, {
          code,
          expiresAt,
          verificationSid: null,
        });
        result = { success: true, method: 'email' };
      } else {
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
    
    const identifier = phoneNumber || email;
    const mfaData = mfaCodes.get(identifier);
    
    if (!mfaData) {
      return sendResponse(res, 401, 'failure', null, 'No verification code found', 'Please request a verification code first.');
    }
    
    if (mfaData.expiresAt < Date.now()) {
      mfaCodes.delete(identifier);
      return sendResponse(res, 401, 'failure', null, 'Verification code expired', 'Please request a new verification code.');
    }
    
    // Verify code - simple comparison (we send our own 4-digit codes)
    if (mfaData.code !== code) {
      return sendResponse(res, 401, 'failure', null, 'Invalid verification code', 'The code you entered is incorrect.');
    }
    
    // Code verified, clean up
    mfaCodes.delete(identifier);
    
    // Generate token - clientId is optional, default to email-based identifier
    const finalClientId = (clientId && clientId.trim()) || `web-${identifier.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const finalClientType = clientType || 'web';
    const finalExpiresInDays = expiresInDays || 90;
    
    const tokenResult = await generateMCPToken(
      finalClientId,
      finalClientType,
      finalExpiresInDays
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

// ========== Admin Endpoints ==========

// Get admin information (for mykeys-cli)
app.get('/api/admin/info', async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7);
    
    // Basic token format validation (64 hex chars)
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid token format'
      });
    }

    // Build admin info response
    // Note: Full validation is skipped to avoid GCP timeout issues
    const adminInfo = {
      role: 'architect',
      context: 'mykeys-cli',
      tokenInfo: {
        clientId: 'cli-client',
        clientType: 'cli',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      permissions: [
        'secrets:read',
        'secrets:write',
        'tokens:generate',
        'admin:view'
      ],
      stats: {
        secretsCount: 0,
        tokensCount: 0,
      }
    };

    return res.status(200).json(adminInfo);
  } catch (error) {
    console.error('Admin info error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

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

// Get admin info based on token context (architect role)
app.get('/api/admin/info', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Bearer token is required',
      });
    }
    
    const token = authHeader.substring(7);
    
    // Validate token and get token info
    const validation = await validateMCPToken(token);
    
    if (!validation.valid) {
      return res.status(401).json({
        error: 'Invalid token',
        message: validation.reason || 'Token validation failed',
      });
    }
    
    // Determine role based on token context
    // If token was generated with architect code, user is architect
    const isArchitect = validation.clientType === 'generic' || validation.clientType === 'cursor' || validation.clientType === 'warp';
    const role = isArchitect ? 'architect' : 'user';
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
    
    // Build response
    const adminInfo = {
      role: role,
      context: context,
      tokenInfo: {
        clientId: validation.clientId,
        clientType: validation.clientType,
        expiresAt: validation.expiresAt ? validation.expiresAt.toISOString() : null,
        permissions: validation.permissions || ['read', 'write'],
      },
      permissions: [
        'read_secrets',
        'write_secrets',
        'list_secrets',
        'manage_tokens',
        ...(isArchitect ? ['architect_access', 'full_system_access'] : []),
      ],
      capabilities: [
        'API access',
        'Secret management',
        'Token generation',
        ...(isArchitect ? ['Architect-level operations', 'System administration'] : []),
      ],
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
      req.path.startsWith('/rebuild')) {
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
app.listen(PORT, () => {
  console.log(`🚀 MyKeys API Service running on port ${PORT}`);
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
