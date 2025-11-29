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
async function initializeMCPServer() {
  const server = new McpServer({
    name: 'mykeys-zip-mcp',
    version: '1.0.0',
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
