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

  mykeys list [ecosystem]          List all secrets (optionally filtered by ecosystem)
  mykeys get <ecosystem> <key>     Get a secret value
  mykeys set <ecosystem> <key> <value>  Set a secret value
  mykeys delete <ecosystem> <key>   Delete a secret
  mykeys admin                      Show admin information
  mykeys keys list [ringId]        List keys in ring
  mykeys keys get <ringId> <key>   Get key value
  mykeys rings [ringId]            Get ring information
  help                             Show this help message
  clear / cls                      Clear terminal
  theme <name>                     Change theme (linux, mac, windows)

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
    const url = ecosystem 
      ? `${baseUrl}/api/v1/secrets/${ecosystem}`
      : `${baseUrl}/api/v1/secrets`;
    
    const data = await apiRequest('GET', url, null, token);
    
    if (data.secrets && Array.isArray(data.secrets)) {
      if (data.secrets.length === 0) {
        return { output: 'No secrets found.' };
      }
      
      let output = `Found ${data.secrets.length} secret(s):\n\n`;
      data.secrets.forEach(secret => {
        output += `  ${secret.secret_name || secret.name}\n`;
        if (secret.ecosystem) {
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
    return { output: '', error: 'Usage: mykeys set <ecosystem> <secretName> <value>' };
  }
  
  try {
    const baseUrl = MYKEYS_URL || '';
    // Use POST to /api/v1/secrets/:ecosystem with secret_name and secret_value in body
    const url = `${baseUrl}/api/v1/secrets/${ecosystem}`;
    const data = await apiRequest('POST', url, { 
      secret_name: secretName,
      secret_value: value 
    }, token);
    
    return { output: `Secret '${secretName}' set successfully in ecosystem '${ecosystem}'.` };
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
    
    let output = 'Admin Information:\n\n';
    if (data.user) {
      output += `User: ${data.user}\n`;
    }
    if (data.ringId) {
      output += `Ring ID: ${data.ringId}\n`;
    }
    if (data.roles && Array.isArray(data.roles)) {
      output += `Roles: ${data.roles.join(', ')}\n`;
    }
    if (data.capabilities && Array.isArray(data.capabilities)) {
      output += `Capabilities: ${data.capabilities.join(', ')}\n`;
    }
    
    return { output: output.trim() || JSON.stringify(data, null, 2) };
  } catch (error) {
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
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || parsed.error || parsed.details || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
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

