/**
 * CLI Command Handler for Online CLI Interface
 * Executes mykeys CLI commands with user isolation
 */

const https = require('https');
const http = require('http');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';

/**
 * Execute a CLI command
 * @param {string} command - Command name (list, get, set, delete, admin, etc.)
 * @param {Array<string>} args - Command arguments
 * @param {Object} context - User context { email, ringId, token }
 * @returns {Promise<Object>} - { output: string, error: string|null }
 */
async function executeCLICommand(command, args = [], context = {}) {
  const { email, ringId, token } = context;
  
  if (!token) {
    return { output: '', error: 'Authentication required' };
  }
  
  try {
    // Handle different commands
    switch (command) {
      case 'list':
      case 'secrets':
        return await handleListSecrets(token, args[0]);
      
      case 'get':
        return await handleGetSecret(token, args[0], args[1]);
      
      case 'set':
        return await handleSetSecret(token, args[0], args[1], args[2]);
      
      case 'delete':
      case 'remove':
        return await handleDeleteSecret(token, args[0], args[1]);
      
      case 'admin':
        return await handleAdmin(token);
      
      case 'keys':
        return await handleKeys(token, args[0], args.slice(1));
      
      case 'rings':
        return await handleRings(token, args[0]);
      
      case 'help':
        return {
          output: `MyKeys CLI Commands:

You can use commands with or without the "mykeys" prefix:

SECRET MANAGEMENT:
  list <ecosystem>                           List secrets in an ecosystem
                                              Example: list shared
                                                      list mine
                                                      list gcp

  get <ecosystem> <secretName>              Get a secret value
                                              Example: get shared api-key

  set <ecosystem> <secretName> <value>      Set a secret value
                                              Example: set shared api-key abc123
                                                      set mine my-secret "my value"

  delete <ecosystem> <secretName>            Delete a secret
                                              Example: delete shared api-key

RING MANAGEMENT:
  keys list [ringId]                         List keys in ring
  keys get <ringId> <key>                    Get key value
  rings [ringId]                             Get ring information

OTHER:
  admin                                      Show admin information
  help                                       Show this help message
  clear / cls                                Clear terminal
  theme <name>                               Change theme (linux, mac, windows)

NOTES:
  • All secret commands require an <ecosystem> parameter (e.g., "shared", "mine", "gcp")
  • Secrets are organized by ecosystem for better organization
  • Use quotes around values with spaces: set shared key "value with spaces"

User: ${email || 'unknown'}
Ring: ${ringId || 'default'}
`
        };
      
      default:
        return {
          output: '',
          error: `Unknown command: ${command}. Type 'help' for available commands.`
        };
    }
  } catch (error) {
    return {
      output: '',
      error: `Error executing command: ${error.message}`
    };
  }
}

/**
 * List secrets
 */
async function handleListSecrets(token, ecosystem = null) {
  try {
    const baseUrl = MYKEYS_URL || '';
    
    // If no ecosystem specified, show message asking for one
    if (!ecosystem) {
      return { 
        output: 'Please specify an ecosystem.\n\nUsage: list <ecosystem>\n\nExample: list shared\n         list mine\n         list gcp' 
      };
    }
    
    const url = `${baseUrl}/api/v1/secrets/${ecosystem}`;
    const data = await apiRequest('GET', url, null, token);
    
    if (data.secrets && Array.isArray(data.secrets)) {
      if (data.secrets.length === 0) {
        return { output: `No secrets found in ecosystem '${ecosystem}'.` };
      }
      
      let output = `Found ${data.secrets.length} secret(s) in ecosystem '${ecosystem}':\n\n`;
      data.secrets.forEach(secret => {
        const secretName = secret.secret_name || secret.name || secret;
        output += `  ${secretName}\n`;
        if (secret.ecosystem && secret.ecosystem !== ecosystem) {
          output += `    Ecosystem: ${secret.ecosystem}\n`;
        }
        if (secret.created) {
          output += `    Created: ${new Date(secret.created).toLocaleString()}\n`;
        }
        output += '\n';
      });
      
      return { output: output.trim() };
    }
    
    return { output: JSON.stringify(data, null, 2) };
  } catch (error) {
    return { output: '', error: error.message };
  }
}

/**
 * Get a secret
 */
async function handleGetSecret(token, ecosystem, secretName) {
  if (!ecosystem || !secretName) {
    return { output: '', error: 'Usage: mykeys get <ecosystem> <secretName>' };
  }
  
  try {
    const baseUrl = MYKEYS_URL || '';
    const url = `${baseUrl}/api/v1/secrets/${ecosystem}/${secretName}`;
    const data = await apiRequest('GET', url, null, token);
    
    if (data.secret_value) {
      return { output: data.secret_value };
    }
    
    return { output: JSON.stringify(data, null, 2) };
  } catch (error) {
    return { output: '', error: error.message };
  }
}

/**
 * Set a secret
 */
async function handleSetSecret(token, ecosystem, secretName, value) {
  if (!ecosystem || !secretName || value === undefined) {
    return { output: '', error: 'Usage: set <ecosystem> <secretName> <value>' };
  }
  
  try {
    const baseUrl = MYKEYS_URL || '';
    // Use POST to /api/v1/secrets/:ecosystem with secret_name and secret_value in body
    const url = `${baseUrl}/api/v1/secrets/${ecosystem}`;
    const data = await apiRequest('POST', url, { 
      secret_name: secretName,
      secret_value: value 
    }, token);
    
    // Check if API returned a success message
    if (data.message) {
      return { output: data.message };
    } else if (data.success) {
      return { output: `Secret '${secretName}' set successfully in ecosystem '${ecosystem}'.` };
    } else {
      return { output: `Secret '${secretName}' set successfully in ecosystem '${ecosystem}'.` };
    }
  } catch (error) {
    return { output: '', error: error.message };
  }
}

/**
 * Delete a secret
 */
async function handleDeleteSecret(token, ecosystem, secretName) {
  if (!ecosystem || !secretName) {
    return { output: '', error: 'Usage: mykeys delete <ecosystem> <secretName>' };
  }
  
  try {
    const baseUrl = MYKEYS_URL || '';
    const url = `${baseUrl}/api/v1/secrets/${ecosystem}/${secretName}`;
    await apiRequest('DELETE', url, null, token);
    
    return { output: `Secret '${secretName}' deleted successfully from ecosystem '${ecosystem}'.` };
  } catch (error) {
    return { output: '', error: error.message };
  }
}

/**
 * Get admin info
 */
async function handleAdmin(token) {
  try {
    const baseUrl = MYKEYS_URL || '';
    const url = `${baseUrl}/api/admin/info`;
    const data = await apiRequest('GET', url, null, token);
    
    // Debug: log what we received
    console.log('[cli-handler] Admin API response:', JSON.stringify(data, null, 2));
    
    let output = 'Admin Information:\n\n';
    let hasData = false;
    
    if (data.email) {
      output += `Email: ${data.email}\n`;
      hasData = true;
    }
    if (data.primaryRole) {
      output += `Primary Role: ${data.primaryRole}\n`;
      hasData = true;
    }
    if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
      output += `Roles: ${data.roles.join(', ')}\n`;
      hasData = true;
    }
    if (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
      output += `Permissions: ${data.permissions.join(', ')}\n`;
      hasData = true;
    }
    if (data.capabilities && Array.isArray(data.capabilities) && data.capabilities.length > 0) {
      output += `Capabilities: ${data.capabilities.join(', ')}\n`;
      hasData = true;
    }
    if (data.stats) {
      output += `\nStats:\n`;
      if (data.stats.secretsCount !== undefined) {
        output += `  Secrets: ${data.stats.secretsCount}\n`;
        hasData = true;
      }
      if (data.stats.ecosystemsCount !== undefined) {
        output += `  Ecosystems: ${data.stats.ecosystemsCount}\n`;
        hasData = true;
      }
    }
    if (data.tokenInfo) {
      output += `\nToken Info:\n`;
      if (data.tokenInfo.clientId) {
        output += `  Client ID: ${data.tokenInfo.clientId}\n`;
        hasData = true;
      }
      if (data.tokenInfo.expiresAt) {
        output += `  Expires: ${data.tokenInfo.expiresAt}\n`;
        hasData = true;
      }
    }
    
    // If no expected fields found, show raw JSON for debugging
    if (!hasData) {
      output += `\nRaw API Response:\n${JSON.stringify(data, null, 2)}`;
    }
    
    return { output: output.trim() };
  } catch (error) {
    console.error('[cli-handler] Admin command error:', error);
    return { output: '', error: error.message };
  }
}

/**
 * Handle keys commands
 */
async function handleKeys(token, subcommand, args) {
  if (subcommand === 'list') {
    const ringId = args[0];
    try {
      const baseUrl = MYKEYS_URL || '';
      const url = `${baseUrl}/api/v1/rings/${ringId || 'default'}/keys`;
      const data = await apiRequest('GET', url, null, token);
      
      if (data.keys && Array.isArray(data.keys)) {
        if (data.keys.length === 0) {
          return { output: 'No keys found in ring.' };
        }
        return { output: `Keys in ring:\n${data.keys.map(k => `  - ${k}`).join('\n')}` };
      }
      return { output: JSON.stringify(data, null, 2) };
    } catch (error) {
      return { output: '', error: error.message };
    }
  } else if (subcommand === 'get') {
    const ringId = args[0];
    const keyName = args[1];
    if (!ringId || !keyName) {
      return { output: '', error: 'Usage: mykeys keys get <ringId> <keyName>' };
    }
    // Implementation would call appropriate API
    return { output: '', error: 'Keys get not yet implemented in online CLI' };
  }
  
  return { output: '', error: `Unknown keys subcommand: ${subcommand}` };
}

/**
 * Handle rings commands
 */
async function handleRings(token, ringId) {
  try {
    const baseUrl = MYKEYS_URL || '';
    const url = `${baseUrl}/api/v1/rings/${ringId || 'default'}`;
    const data = await apiRequest('GET', url, null, token);
    
    let output = `Ring Information:\n\n`;
    if (data.ringId) output += `Ring ID: ${data.ringId}\n`;
    if (data.publicName) output += `Name: ${data.publicName}\n`;
    if (data.capabilities) output += `Capabilities: ${data.capabilities.join(', ')}\n`;
    if (data.createdAt) output += `Created: ${new Date(data.createdAt).toLocaleString()}\n`;
    
    return { output: output.trim() || JSON.stringify(data, null, 2) };
  } catch (error) {
    return { output: '', error: error.message };
  }
}

/**
 * Make API request
 * Supports both absolute URLs and relative paths (for same-origin requests)
 */
function apiRequest(method, url, body, token) {
  return new Promise((resolve, reject) => {
    // Handle relative URLs (for same-origin requests)
    let urlObj;
    let useRelative = false;
    
    if (url.startsWith('/')) {
      // Relative URL - use fetch API in browser context or http module for Node
      useRelative = true;
    } else {
      urlObj = new URL(url);
    }
    
    // For relative URLs in Node.js context, construct full URL
    if (useRelative && typeof window === 'undefined') {
      const baseUrl = MYKEYS_URL || 'http://localhost:8080';
      urlObj = new URL(url, baseUrl);
    } else if (useRelative) {
      // Browser context - use fetch (but this is server-side, so shouldn't happen)
      urlObj = new URL(url, 'http://localhost:8080');
    }
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Check if response is HTML (error page) instead of JSON
        if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
          reject(new Error(`Server returned HTML instead of JSON (HTTP ${res.statusCode}). The endpoint may not exist or there was a server error.`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            // Build detailed error message
            const errorMsg = parsed.message || parsed.error || `HTTP ${res.statusCode}`;
            // Ensure details is always a string
            let details = '';
            if (parsed.details) {
              if (typeof parsed.details === 'string') {
                details = `: ${parsed.details}`;
              } else if (typeof parsed.details === 'object') {
                // Try to extract meaningful info from error object
                details = `: ${parsed.details.message || parsed.details.error || JSON.stringify(parsed.details)}`;
              } else {
                details = `: ${String(parsed.details)}`;
              }
            }
            reject(new Error(`${errorMsg}${details}`));
          }
        } catch (e) {
          // Provide more helpful error message
          const preview = data.substring(0, 200);
          const isHtml = preview.includes('<html') || preview.includes('<!DOCTYPE');
          const errorMsg = isHtml
            ? `Server returned HTML error page (HTTP ${res.statusCode}). Check if the endpoint exists.`
            : `Invalid JSON response (HTTP ${res.statusCode}): ${preview}`;
          reject(new Error(errorMsg));
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

module.exports = {
  executeCLICommand
};

