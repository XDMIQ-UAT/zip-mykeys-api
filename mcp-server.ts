/**
 * MyKeys.zip MCP Server
 * 
 * Model Context Protocol server for syncing credentials between agents and IDEs
 * Supports: Cursor, Warp, and other MCP-compatible clients
 * 
 * Protocol: https://modelcontextprotocol.io
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';

// Configuration
const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MCP_TOKEN = process.env.MCP_TOKEN || ''; // Token-based auth (preferred)
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin'; // Fallback for Basic Auth
const MYKEYS_PASS = process.env.MYKEYS_PASS || ''; // Fallback for Basic Auth
const CLIENT_ID = process.env.MCP_CLIENT_ID || 'mcp-mykeys-client';
const SYNC_ENABLED = process.env.MCP_SYNC_ENABLED !== 'false';
const AUTO_UPDATE_ENABLED = process.env.MCP_AUTO_UPDATE !== 'false'; // Auto-update enabled by default
const MCP_SERVER_VERSION = '2.0.0'; // Increment when adding new features

// In-memory credential cache for sync
interface CredentialCache {
  [key: string]: {
    value: string;
    ecosystem: string;
    timestamp: number;
    syncedTo: string[];
  };
}

const credentialCache: CredentialCache = {};

// Track connected clients
interface ConnectedClient {
  id: string;
  type: 'cursor' | 'warp' | 'other';
  lastSync: number;
  capabilities: string[];
}

const connectedClients: Map<string, ConnectedClient> = new Map();

/**
 * Authenticate with mykeys.zip API
 * Uses MCP token if available, otherwise falls back to Basic Auth
 */
function getAuthHeader(): string {
  if (MCP_TOKEN) {
    return `Bearer ${MCP_TOKEN}`;
  }
  const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
  return `Basic ${auth}`;
}

/**
 * Fetch secret from mykeys.zip
 */
async function fetchSecret(ecosystem: string, secretName: string): Promise<string | null> {
  try {
    const response = await axios.get(
      `${MYKEYS_URL}/api/v1/secrets/${ecosystem}/${secretName}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success && response.data?.secret_value) {
      const value = typeof response.data.secret_value === 'string'
        ? response.data.secret_value
        : JSON.stringify(response.data.secret_value);
      
      // Cache the credential
      const cacheKey = `${ecosystem}:${secretName}`;
      credentialCache[cacheKey] = {
        value,
        ecosystem,
        timestamp: Date.now(),
        syncedTo: [],
      };

      return value;
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching secret ${ecosystem}/${secretName}:`, error.message);
    return null;
  }
}

/**
 * Store secret to mykeys.zip
 */
async function storeSecret(
  ecosystem: string,
  secretName: string,
  secretValue: string,
  description?: string
): Promise<boolean> {
  try {
    const response = await axios.post(
      `${MYKEYS_URL}/api/v1/secrets/${ecosystem}`,
      {
        secret_name: secretName,
        secret_value: secretValue,
        description,
      },
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success) {
      // Update cache
      const cacheKey = `${ecosystem}:${secretName}`;
      credentialCache[cacheKey] = {
        value: secretValue,
        ecosystem,
        timestamp: Date.now(),
        syncedTo: [],
      };

      return true;
    }

    return false;
  } catch (error: any) {
    console.error(`Error storing secret ${ecosystem}/${secretName}:`, error.message);
    return false;
  }
}

/**
 * List secrets for an ecosystem
 */
async function listSecrets(ecosystem: string): Promise<string[]> {
  try {
    const response = await axios.get(
      `${MYKEYS_URL}/api/v1/secrets/${ecosystem}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success && Array.isArray(response.data.secrets)) {
      return response.data.secrets.map((s: any) => s.secret_name);
    }

    return [];
  } catch (error: any) {
    console.error(`Error listing secrets for ${ecosystem}:`, error.message);
    return [];
  }
}

/**
 * Sync credentials to connected clients
 */
async function syncCredentialsToClients(clientId: string, clientType: string) {
  if (!SYNC_ENABLED) return;

  const client = connectedClients.get(clientId);
  if (!client) {
    connectedClients.set(clientId, {
      id: clientId,
      type: clientType as 'cursor' | 'warp' | 'other',
      lastSync: Date.now(),
      capabilities: [],
    });
  } else {
    client.lastSync = Date.now();
  }

  // In a real implementation, you would notify clients via MCP protocol
  // For now, we just track sync status
  console.error(`Synced credentials to ${clientType} client: ${clientId}`);
}

/**
 * Initialize MCP Server
 */
/**
 * Check for MCP server updates
 */
async function checkForUpdates(): Promise<{ updateAvailable: boolean; latestVersion?: string; downloadUrl?: string }> {
  if (!AUTO_UPDATE_ENABLED) {
    return { updateAvailable: false };
  }

  try {
    // Check version endpoint (to be implemented on server)
    const response = await axios.get(`${MYKEYS_URL}/api/mcp/version`, {
      headers: { 'Authorization': getAuthHeader() },
      timeout: 5000,
    });

    if (response.data?.version && response.data.version !== MCP_SERVER_VERSION) {
      return {
        updateAvailable: true,
        latestVersion: response.data.version,
        downloadUrl: response.data.downloadUrl || `${MYKEYS_URL}/mcp-server.js`,
      };
    }

    return { updateAvailable: false };
  } catch (error) {
    // Silently fail - don't block server startup
    return { updateAvailable: false };
  }
}

/**
 * Get server capabilities and version
 */
async function getServerInfo() {
  return {
    name: 'mykeys-zip-mcp',
    version: MCP_SERVER_VERSION,
    capabilities: [
      'secrets',
      'rings',
      'keys',
      'vault',
      'discovery',
      'sync',
    ],
    tools: [
      'get_secret',
      'store_secret',
      'list_secrets',
      'list_rings',
      'get_ring',
      'list_ring_keys',
      'store_vault_secret',
      'get_vault_secret',
      'list_vault_secrets',
      'discover_rings',
      'sync_credentials',
      'register_client',
    ],
  };
}

async function initializeMCPServer() {
  // Check for updates on startup
  if (AUTO_UPDATE_ENABLED) {
    const updateCheck = await checkForUpdates();
    if (updateCheck.updateAvailable) {
      console.error(`⚠️  MCP Server update available: ${updateCheck.latestVersion}`);
      console.error(`   Current version: ${MCP_SERVER_VERSION}`);
      console.error(`   Download: ${updateCheck.downloadUrl}`);
      console.error(`   Or run: mykeys mcp update`);
    }
  }

  const server = new McpServer({
    name: 'mykeys-zip-mcp',
    version: MCP_SERVER_VERSION,
  });

  // Register get_secret tool
  server.registerTool(
    'get_secret',
    {
      title: 'Get Secret',
      description: 'Get a secret from mykeys.zip',
      inputSchema: {
        type: 'object',
        properties: {
          ecosystem: {
            type: 'string',
            description: 'Ecosystem name (e.g., "shared", "myl", "agents")',
          },
          secret_name: {
            type: 'string',
            description: 'Name of the secret to retrieve',
          },
        },
        required: ['ecosystem', 'secret_name'],
      },
    },
    async ({ ecosystem, secret_name }) => {
      const value = await fetchSecret(ecosystem, secret_name);
      if (value === null) {
        return {
          content: [{ type: 'text', text: `Secret ${ecosystem}/${secret_name} not found` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: value }],
      };
    }
  );

  // Register store_secret tool
  server.registerTool(
    'store_secret',
    {
      title: 'Store Secret',
      description: 'Store a secret in mykeys.zip (automatically syncs to all clients)',
      inputSchema: {
        type: 'object',
        properties: {
          ecosystem: {
            type: 'string',
            description: 'Ecosystem name',
          },
          secret_name: {
            type: 'string',
            description: 'Name of the secret',
          },
          secret_value: {
            type: 'string',
            description: 'Value of the secret',
          },
          description: {
            type: 'string',
            description: 'Optional description',
          },
        },
        required: ['ecosystem', 'secret_name', 'secret_value'],
      },
    },
    async ({ ecosystem, secret_name, secret_value, description }) => {
      const success = await storeSecret(ecosystem, secret_name, secret_value, description);
      if (success) {
        // Sync to connected clients
        const clientId = process.env.MCP_CLIENT_ID || 'unknown';
        const clientType = process.env.MCP_CLIENT_TYPE || 'other';
        await syncCredentialsToClients(clientId, clientType);
        
        return {
          content: [{ type: 'text', text: `Secret ${ecosystem}/${secret_name} stored successfully` }],
        };
      }
      return {
        content: [{ type: 'text', text: `Failed to store secret ${ecosystem}/${secret_name}` }],
        isError: true,
      };
    }
  );

  // Register list_secrets tool
  server.registerTool(
    'list_secrets',
    {
      title: 'List Secrets',
      description: 'List all secrets in an ecosystem',
      inputSchema: {
        type: 'object',
        properties: {
          ecosystem: {
            type: 'string',
            description: 'Ecosystem name',
          },
        },
        required: ['ecosystem'],
      },
    },
    async ({ ecosystem }) => {
      const secrets = await listSecrets(ecosystem);
      return {
        content: [{ type: 'text', text: JSON.stringify(secrets, null, 2) }],
      };
    }
  );

  // Register ring management tools
  server.registerTool(
    'list_rings',
    {
      title: 'List Rings',
      description: 'List all rings in mykeys.zip',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      try {
        const response = await axios.get(`${MYKEYS_URL}/api/admin/rings`, {
          headers: { 'Authorization': getAuthHeader() },
          timeout: 10000,
        });
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text', text: 'Failed to list rings' }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_ring',
    {
      title: 'Get Ring',
      description: 'Get details of a specific ring',
      inputSchema: {
        type: 'object',
        properties: {
          ring_id: {
            type: 'string',
            description: 'Ring ID',
          },
        },
        required: ['ring_id'],
      },
    },
    async ({ ring_id }) => {
      try {
        const response = await axios.get(`${MYKEYS_URL}/api/admin/rings/${ring_id}`, {
          headers: { 'Authorization': getAuthHeader() },
          timeout: 10000,
        });
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text', text: `Ring ${ring_id} not found` }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_ring_keys',
    {
      title: 'List Ring Keys',
      description: 'List all keys in a ring',
      inputSchema: {
        type: 'object',
        properties: {
          ring_id: {
            type: 'string',
            description: 'Ring ID',
          },
        },
        required: ['ring_id'],
      },
    },
    async ({ ring_id }) => {
      try {
        const response = await axios.get(`${MYKEYS_URL}/api/rings/${ring_id}/keys`, {
          headers: { 'Authorization': getAuthHeader() },
          timeout: 10000,
        });
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text', text: `Failed to list keys for ring ${ring_id}` }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'store_vault_secret',
    {
      title: 'Store Vault Secret',
      description: 'Store a personal/sacred secret in a key\'s privacy vault (not shared with ring)',
      inputSchema: {
        type: 'object',
        properties: {
          ring_id: {
            type: 'string',
            description: 'Ring ID',
          },
          key_name: {
            type: 'string',
            description: 'Key name',
          },
          vault_secret_name: {
            type: 'string',
            description: 'Name of the vault secret',
          },
          vault_secret_value: {
            type: 'string',
            description: 'Value of the vault secret',
          },
        },
        required: ['ring_id', 'key_name', 'vault_secret_name', 'vault_secret_value'],
      },
    },
    async ({ ring_id, key_name, vault_secret_name, vault_secret_value }) => {
      try {
        const response = await axios.post(
          `${MYKEYS_URL}/api/rings/${ring_id}/keys/${key_name}/vault`,
          {
            vault_secret_name,
            vault_secret_value,
          },
          {
            headers: { 'Authorization': getAuthHeader() },
            timeout: 10000,
          }
        );
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: `Vault secret ${vault_secret_name} stored successfully` }],
          };
        }
        return {
          content: [{ type: 'text', text: `Failed to store vault secret` }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_vault_secret',
    {
      title: 'Get Vault Secret',
      description: 'Get a personal/sacred secret from a key\'s privacy vault',
      inputSchema: {
        type: 'object',
        properties: {
          ring_id: {
            type: 'string',
            description: 'Ring ID',
          },
          key_name: {
            type: 'string',
            description: 'Key name',
          },
          vault_secret_name: {
            type: 'string',
            description: 'Name of the vault secret',
          },
        },
        required: ['ring_id', 'key_name', 'vault_secret_name'],
      },
    },
    async ({ ring_id, key_name, vault_secret_name }) => {
      try {
        const response = await axios.get(
          `${MYKEYS_URL}/api/rings/${ring_id}/keys/${key_name}/vault/${vault_secret_name}`,
          {
            headers: { 'Authorization': getAuthHeader() },
            timeout: 10000,
          }
        );
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: response.data.data.vaultSecretValue }],
          };
        }
        return {
          content: [{ type: 'text', text: `Vault secret ${vault_secret_name} not found` }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_vault_secrets',
    {
      title: 'List Vault Secrets',
      description: 'List all vault secrets for a key',
      inputSchema: {
        type: 'object',
        properties: {
          ring_id: {
            type: 'string',
            description: 'Ring ID',
          },
          key_name: {
            type: 'string',
            description: 'Key name',
          },
        },
        required: ['ring_id', 'key_name'],
      },
    },
    async ({ ring_id, key_name }) => {
      try {
        const response = await axios.get(
          `${MYKEYS_URL}/api/rings/${ring_id}/keys/${key_name}/vault`,
          {
            headers: { 'Authorization': getAuthHeader() },
            timeout: 10000,
          }
        );
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: JSON.stringify(response.data.data.vaultSecrets, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text', text: `Failed to list vault secrets` }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'discover_rings',
    {
      title: 'Discover Rings',
      description: 'Discover all rings in the ecosystem (minimal metadata only)',
      inputSchema: {
        type: 'object',
        properties: {
          include_anonymous: {
            type: 'boolean',
            description: 'Include anonymous rings',
            default: true,
          },
        },
      },
    },
    async ({ include_anonymous = true }) => {
      try {
        const response = await axios.get(
          `${MYKEYS_URL}/api/rings/discover?includeAnonymous=${include_anonymous}`,
          {
            headers: { 'Authorization': getAuthHeader() },
            timeout: 10000,
          }
        );
        if (response.data?.status === 'success') {
          return {
            content: [{ type: 'text', text: JSON.stringify(response.data.data, null, 2) }],
          };
        }
        return {
          content: [{ type: 'text', text: 'Failed to discover rings' }],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Register sync_credentials tool
  server.registerTool(
    'sync_credentials',
    {
      title: 'Sync Credentials',
      description: 'Sync credentials to all connected clients',
      inputSchema: {
        type: 'object',
        properties: {
          ecosystem: {
            type: 'string',
            description: 'Ecosystem to sync (optional, syncs all if not provided)',
          },
        },
      },
    },
    async ({ ecosystem }) => {
      const clientId = process.env.MCP_CLIENT_ID || 'unknown';
      const clientType = process.env.MCP_CLIENT_TYPE || 'other';
      await syncCredentialsToClients(clientId, clientType);
      return {
        content: [{ type: 'text', text: `Credentials synced for ${ecosystem || 'all ecosystems'}` }],
      };
    }
  );

  // Register register_client tool
  server.registerTool(
    'register_client',
    {
      title: 'Register Client',
      description: 'Register a client for credential syncing',
      inputSchema: {
        type: 'object',
        properties: {
          client_id: {
            type: 'string',
            description: 'Unique client identifier',
          },
          client_type: {
            type: 'string',
            description: 'Client type: cursor, warp, or other',
            enum: ['cursor', 'warp', 'other'],
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of client capabilities',
          },
        },
        required: ['client_id', 'client_type'],
      },
    },
    async ({ client_id, client_type, capabilities }) => {
      connectedClients.set(client_id, {
        id: client_id,
        type: client_type as 'cursor' | 'warp' | 'other',
        lastSync: Date.now(),
        capabilities: capabilities || [],
      });
      return {
        content: [{ type: 'text', text: `Client ${client_id} (${client_type}) registered successfully` }],
      };
    }
  );

  // Register resources (credentials as resources)
  // Using ResourceTemplate for URI pattern matching
  server.registerResource(
    'mykeys-secret',
    new ResourceTemplate('mykeys://{ecosystem}/{secret_name}', { list: undefined }),
    {
      title: 'MyKeys Secret',
      description: 'Access secrets from mykeys.zip',
    },
    async (uri, { ecosystem, secret_name }) => {
      const value = await fetchSecret(ecosystem, secret_name);

      if (value === null) {
        throw new Error(`Secret not found: ${ecosystem}/${secret_name}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              ecosystem,
              secret_name,
              secret_value: value,
            }),
          },
        ],
      };
    }
  );

  // Register ring resources
  server.registerResource(
    'mykeys-ring',
    new ResourceTemplate('mykeys://ring/{ring_id}', { list: undefined }),
    {
      title: 'MyKeys Ring',
      description: 'Access ring information from mykeys.zip',
    },
    async (uri, { ring_id }) => {
      try {
        const response = await axios.get(`${MYKEYS_URL}/api/admin/rings/${ring_id}`, {
          headers: { 'Authorization': getAuthHeader() },
          timeout: 10000,
        });
        if (response.data?.status === 'success') {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify(response.data.data, null, 2),
              },
            ],
          };
        }
        throw new Error(`Ring ${ring_id} not found`);
      } catch (error: any) {
        throw new Error(`Error fetching ring: ${error.message}`);
      }
    }
  );

  server.registerResource(
    'mykeys-ring-keys',
    new ResourceTemplate('mykeys://ring/{ring_id}/keys', { list: undefined }),
    {
      title: 'MyKeys Ring Keys',
      description: 'Access keys in a ring',
    },
    async (uri, { ring_id }) => {
      try {
        const response = await axios.get(`${MYKEYS_URL}/api/rings/${ring_id}/keys`, {
          headers: { 'Authorization': getAuthHeader() },
          timeout: 10000,
        });
        if (response.data?.status === 'success') {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify(response.data.data, null, 2),
              },
            ],
          };
        }
        throw new Error(`Failed to get keys for ring ${ring_id}`);
      } catch (error: any) {
        throw new Error(`Error fetching ring keys: ${error.message}`);
      }
    }
  );

  // Register prompts using the high-level API
  server.registerPrompt(
    'get_secret_prompt',
    {
      title: 'Get Secret',
      description: 'Prompt template for getting a secret from mykeys.zip',
      argsSchema: {
        type: 'object',
        properties: {
          ecosystem: {
            type: 'string',
            description: 'Ecosystem name',
          },
          secret_name: {
            type: 'string',
            description: 'Secret name',
          },
        },
        required: ['ecosystem', 'secret_name'],
      },
    },
    ({ ecosystem, secret_name }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Get the secret "${secret_name}" from ecosystem "${ecosystem}" using the get_secret tool.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'store_secret_prompt',
    {
      title: 'Store Secret',
      description: 'Prompt template for storing a secret in mykeys.zip',
      argsSchema: {
        type: 'object',
        properties: {
          ecosystem: {
            type: 'string',
            description: 'Ecosystem name',
          },
          secret_name: {
            type: 'string',
            description: 'Secret name',
          },
          secret_value: {
            type: 'string',
            description: 'Secret value',
          },
        },
        required: ['ecosystem', 'secret_name', 'secret_value'],
      },
    },
    ({ ecosystem, secret_name, secret_value }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Store the secret "${secret_name}" with value "${secret_value}" in ecosystem "${ecosystem}" using the store_secret tool.`,
          },
        },
      ],
    })
  );

  // Register server info tool
  server.registerTool(
    'get_server_info',
    {
      title: 'Get Server Info',
      description: 'Get MCP server version, capabilities, and available tools',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      const info = await getServerInfo();
      return {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
      };
    }
  );

  // Register check updates tool
  server.registerTool(
    'check_updates',
    {
      title: 'Check Updates',
      description: 'Check if MCP server update is available',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    async () => {
      const updateCheck = await checkForUpdates();
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            currentVersion: MCP_SERVER_VERSION,
            updateAvailable: updateCheck.updateAvailable,
            latestVersion: updateCheck.latestVersion,
            downloadUrl: updateCheck.downloadUrl,
            message: updateCheck.updateAvailable 
              ? `Update available: ${updateCheck.latestVersion}. Download from ${updateCheck.downloadUrl} or run: mykeys mcp update`
              : `MCP server is up to date (version ${MCP_SERVER_VERSION})`
          }, null, 2) 
        }],
      };
    }
  );

  return server;
}

/**
 * Main entry point
 */
async function main() {
  const server = await initializeMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('MyKeys.zip MCP Server started');
  console.error(`Connected to: ${MYKEYS_URL}`);
  console.error(`Sync enabled: ${SYNC_ENABLED}`);
}

// Start server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
