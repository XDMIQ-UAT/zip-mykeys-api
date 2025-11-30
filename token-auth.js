/**
 * Token-based Authentication for MyKeys.zip MCP
 * 
 * Generates short-lived tokens for MCP clients instead of sharing admin password
 * Similar to GitHub OAuth flow: generate token → use in MCP config
 */

const crypto = require('crypto');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Initialize GCP Secret Manager client with error handling
let client;
let PROJECT_ID = process.env.GCP_PROJECT || 'myl-zip-www';

try {
  // Check if we have GCP credentials
  const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                        process.env.GCP_PROJECT || 
                        process.env.GCP_SERVICE_ACCOUNT_KEY;
  
  if (hasCredentials) {
    client = new SecretManagerServiceClient();
  } else {
    console.warn('GCP credentials not configured. Token generation will use in-memory storage (not persistent).');
    client = null;
  }
} catch (error) {
  console.error('Failed to initialize GCP Secret Manager:', error.message);
  client = null;
}

// Token storage in GCP Secret Manager
const TOKEN_SECRET_PREFIX = 'mcp-token-';

/**
 * Generate a new MCP token
 * @param {string} clientId - Client identifier (e.g., 'cursor-agent', 'warp-agent')
 * @param {string} clientType - Client type ('cursor', 'warp', 'other')
 * @param {number} expiresInDays - Token expiration in days (default: 90)
 * @param {string} email - User email address (optional)
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
// In-memory fallback storage for tokens (when GCP is not available)
const inMemoryTokens = new Map(); // tokenId -> tokenData

async function generateMCPToken(clientId, clientType, expiresInDays = 90, email = null) {
  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenId = `${clientId}-${Date.now()}`;
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  
  const tokenData = {
    token: token,
    clientId: clientId,
    clientType: clientType,
    email: email ? email.trim().toLowerCase() : null,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    permissions: ['read', 'write'], // MCP tokens can read and write
  };
  
  // Try to store in GCP Secret Manager if available
  if (client) {
    const secretName = `${TOKEN_SECRET_PREFIX}${tokenId}`;
    
    try {
      await client.createSecret({
        parent: `projects/${PROJECT_ID}`,
        secretId: secretName,
        secret: {
          replication: { automatic: {} },
          labels: {
            type: 'mcp-token',
            clientId: clientId,
            clientType: clientType,
          },
        },
      });
      
      await client.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/${secretName}`,
        payload: {
          data: Buffer.from(JSON.stringify(tokenData), 'utf8'),
        },
      });
      
      return {
        token: token,
        tokenId: tokenId,
        expiresAt: expiresAt,
      };
    } catch (error) {
      if (error.code === 6) {
        // Secret already exists, update it
        try {
          await client.addSecretVersion({
            parent: `projects/${PROJECT_ID}/secrets/${secretName}`,
            payload: {
              data: Buffer.from(JSON.stringify(tokenData), 'utf8'),
            },
          });
          
          return {
            token: token,
            tokenId: tokenId,
            expiresAt: expiresAt,
          };
        } catch (updateError) {
          console.error('Error updating existing secret:', updateError.message);
          // Fall through to in-memory storage
        }
      } else {
        console.error('GCP Secret Manager error:', error.message);
        console.warn('Falling back to in-memory storage (tokens will not persist across restarts)');
        // Fall through to in-memory storage
      }
    }
  }
  
  // Fallback: Store in memory (for development or when GCP is not configured)
  inMemoryTokens.set(tokenId, tokenData);
  console.log(`Token stored in memory (GCP not available). Token ID: ${tokenId}`);
  
  return {
    token: token,
    tokenId: tokenId,
    expiresAt: expiresAt,
  };
}

/**
 * Validate an MCP token
 * @param {string} token - Token to validate
 * @returns {Promise<{valid: boolean, clientId?: string, clientType?: string, expiresAt?: Date}>}
 */
async function validateMCPToken(token) {
  // First check in-memory storage
  for (const [tokenId, tokenData] of inMemoryTokens.entries()) {
    if (tokenData.token === token) {
      // Check expiration
      const expiresAt = new Date(tokenData.expiresAt);
      if (expiresAt < new Date()) {
        inMemoryTokens.delete(tokenId);
        return { valid: false, reason: 'Token expired' };
      }
      
      return {
        valid: true,
        clientId: tokenData.clientId,
        clientType: tokenData.clientType,
        email: tokenData.email || null,
        expiresAt: expiresAt,
        permissions: tokenData.permissions || ['read', 'write'],
      };
    }
  }
  
  // If GCP is available, check there
  if (client) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // List all MCP tokens
      const [secrets] = await client.listSecrets({
        parent: `projects/${PROJECT_ID}`,
        filter: `labels.type=mcp-token`,
      });
      
      for (const secret of secrets) {
        const secretName = secret.name.split('/').pop();
        
        try {
          const [version] = await client.accessSecretVersion({
            name: `${secret.name}/versions/latest`,
          });
          
          const tokenData = JSON.parse(version.payload.data.toString('utf8'));
          
          // Verify token matches
          const storedHash = crypto.createHash('sha256').update(tokenData.token).digest('hex');
          if (storedHash === tokenHash) {
            // Check expiration
            const expiresAt = new Date(tokenData.expiresAt);
            if (expiresAt < new Date()) {
              return { valid: false, reason: 'Token expired' };
            }
            
            return {
              valid: true,
              clientId: tokenData.clientId,
              clientType: tokenData.clientType,
              email: tokenData.email || null,
              expiresAt: expiresAt,
              permissions: tokenData.permissions || ['read', 'write'],
            };
          }
        } catch (err) {
          // Continue to next secret
          continue;
        }
      }
    } catch (error) {
      console.error('Error validating token in GCP:', error.message);
      // Fall through to return not found
    }
  }
  
  return { valid: false, reason: 'Token not found' };
}

/**
 * Revoke an MCP token
 * @param {string} token - Token to revoke
 * @returns {Promise<boolean>}
 */
async function revokeMCPToken(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  try {
    const [secrets] = await client.listSecrets({
      parent: `projects/${PROJECT_ID}`,
      filter: `labels.type=mcp-token`,
    });
    
    for (const secret of secrets) {
      try {
        const [version] = await client.accessSecretVersion({
          name: `${secret.name}/versions/latest`,
        });
        
        const tokenData = JSON.parse(version.payload.data.toString('utf8'));
        const storedHash = crypto.createHash('sha256').update(tokenData.token).digest('hex');
        
        if (storedHash === tokenHash) {
          // Delete the secret (revoke token)
          await client.deleteSecret({
            name: secret.name,
          });
          return true;
        }
      } catch (err) {
        continue;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error revoking token:', error);
    return false;
  }
}

module.exports = {
  generateMCPToken,
  validateMCPToken,
  revokeMCPToken,
};


