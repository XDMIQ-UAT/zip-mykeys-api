# MyKeys.zip MCP Server

Model Context Protocol server for syncing credentials between agents and IDEs (Cursor, Warp, etc.)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Cursor

Add to Cursor settings (Settings → Features → Model Context Protocol):

```json
{
  "mcpServers": {
    "mykeys-zip": {
      "command": "node",
      "args": ["E:\\zip-myl-mykeys-api\\dist\\mcp-server.js"],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MYKEYS_USER": "admin",
        "MYKEYS_PASS": "YOUR_PASSWORD",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

### 4. Configure Warp

Similar configuration for Warp MCP settings.

## Features

- ✅ Credential sync between Cursor and Warp agents
- ✅ Secure storage via mykeys.zip API
- ✅ Real-time credential updates
- ✅ Multi-ecosystem support (shared, myl, agents, etc.)
- ✅ MCP protocol compliant

## Usage in Agents

```typescript
import { createMyKeysClient } from './mcp-client';

// Initialize client
const client = createMyKeysClient(mcpServer);

// Get a secret
const apiKey = await client.getSecret('shared', 'stripe-secret-key');

// Store a secret (auto-syncs to all clients)
await client.storeSecret('shared', 'new-key', 'value', 'Description');

// List secrets
const secrets = await client.listSecrets('shared');
```

## Documentation

See [MCP_SETUP.md](./MCP_SETUP.md) for detailed setup instructions.






