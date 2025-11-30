/**
 * MyKeys.zip MCP Client Helper
 * 
 * Client-side library for interacting with the MyKeys MCP server
 * Use this in Cursor/Warp agents to easily sync credentials
 */

interface MCPServer {
  callTool(name: string, args: Record<string, any>): Promise<any>;
  readResource(uri: string): Promise<any>;
  listResources(): Promise<any[]>;
}

/**
 * MyKeys MCP Client
 * 
 * Usage in Cursor/Warp agents:
 * ```typescript
 * const client = new MyKeysMCPClient(mcpServer);
 * 
 * // Get a secret
 * const apiKey = await client.getSecret('shared', 'stripe-secret-key');
 * 
 * // Store a secret (automatically syncs to all clients)
 * await client.storeSecret('shared', 'new-key', 'value', 'Description');
 * 
 * // List all secrets in an ecosystem
 * const secrets = await client.listSecrets('shared');
 * ```
 */
export class MyKeysMCPClient {
  constructor(private mcp: MCPServer) {}

  /**
   * Get a secret from mykeys.zip
   */
  async getSecret(ecosystem: string, secretName: string): Promise<string | null> {
    try {
      const result = await this.mcp.callTool('get_secret', {
        ecosystem,
        secret_name: secretName,
      });

      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.success ? data.secret_value : null;
      }

      return null;
    } catch (error) {
      console.error(`Error getting secret ${ecosystem}/${secretName}:`, error);
      return null;
    }
  }

  /**
   * Store a secret in mykeys.zip (syncs to all clients)
   */
  async storeSecret(
    ecosystem: string,
    secretName: string,
    secretValue: string,
    description?: string
  ): Promise<boolean> {
    try {
      const result = await this.mcp.callTool('store_secret', {
        ecosystem,
        secret_name: secretName,
        secret_value: secretValue,
        description,
      });

      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.success === true;
      }

      return false;
    } catch (error) {
      console.error(`Error storing secret ${ecosystem}/${secretName}:`, error);
      return false;
    }
  }

  /**
   * List all secrets in an ecosystem
   */
  async listSecrets(ecosystem: string): Promise<string[]> {
    try {
      const result = await this.mcp.callTool('list_secrets', {
        ecosystem,
      });

      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.success ? data.secrets : [];
      }

      return [];
    } catch (error) {
      console.error(`Error listing secrets for ${ecosystem}:`, error);
      return [];
    }
  }

  /**
   * Sync credentials to all connected clients
   */
  async syncCredentials(ecosystem?: string): Promise<boolean> {
    try {
      const result = await this.mcp.callTool('sync_credentials', {
        ecosystem,
      });

      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.success === true;
      }

      return false;
    } catch (error) {
      console.error('Error syncing credentials:', error);
      return false;
    }
  }

  /**
   * Register this client for credential syncing
   */
  async registerClient(
    clientId: string,
    clientType: 'cursor' | 'warp' | 'other',
    capabilities?: string[]
  ): Promise<boolean> {
    try {
      const result = await this.mcp.callTool('register_client', {
        client_id: clientId,
        client_type: clientType,
        capabilities,
      });

      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.success === true;
      }

      return false;
    } catch (error) {
      console.error('Error registering client:', error);
      return false;
    }
  }

  /**
   * Get secret as resource (alternative method)
   */
  async getSecretAsResource(ecosystem: string, secretName: string): Promise<string | null> {
    try {
      const uri = `mykeys://${ecosystem}/${secretName}`;
      const resource = await this.mcp.readResource(uri);

      if (resource?.contents?.[0]?.text) {
        const data = JSON.parse(resource.contents[0].text);
        return data.secret_value || null;
      }

      return null;
    } catch (error) {
      console.error(`Error reading resource ${ecosystem}/${secretName}:`, error);
      return null;
    }
  }
}

/**
 * Create a MyKeys MCP client instance
 */
export function createMyKeysClient(mcp: MCPServer): MyKeysMCPClient {
  return new MyKeysMCPClient(mcp);
}






