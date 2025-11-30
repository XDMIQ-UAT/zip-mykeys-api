# MyKeys.zip MCP Server Setup Guide

## Overview

The MyKeys.zip MCP (Model Context Protocol) server enables credential synchronization between agents and IDEs like Cursor and Warp. This allows credentials stored in mykeys.zip to be automatically synced and accessible across all connected clients.

## Features

- **Credential Sync**: Automatically sync credentials between Cursor, Warp, and other MCP-compatible clients
- **Secure Storage**: Uses mykeys.zip API backed by Google Cloud Secret Manager
- **Real-time Updates**: Changes to credentials are propagated to all connected clients
- **Multi-Ecosystem Support**: Organize credentials by ecosystem (shared, myl, agents, etc.)

## Installation

### 1. Install Dependencies

```bash
cd E:\zip-myl-mykeys-api
npm install
```

### 2. Build MCP Server

```bash
npm run build
# Or if using tsx directly:
npm run mcp
```

### 3. Configure Cursor

1. Open Cursor Settings
2. Navigate to **Features** → **Model Context Protocol**
3. Add the following configuration:

**Windows:**
```json
{
  "mcpServers": {
    "mykeys-zip": {
      "command": "node",
      "args": [
        "E:\\zip-myl-mykeys-api\\dist\\mcp-server.js"
      ],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MYKEYS_USER": "admin",
        "MYKEYS_PASS": "YOUR_PASSWORD_HERE",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

**macOS/Linux:**
```json
{
  "mcpServers": {
    "mykeys-zip": {
      "command": "node",
      "args": [
        "/path/to/zip-myl-mykeys-api/dist/mcp-server.js"
      ],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MYKEYS_USER": "admin",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

### 4. Configure Warp

Warp uses a similar configuration format. Add to your Warp MCP settings:

```json
{
  "mcpServers": {
    "mykeys-zip": {
      "command": "node",
      "args": [
        "E:\\zip-myl-mykeys-api\\dist\\mcp-server.js"
      ],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MYKEYS_USER": "admin",
        "MCP_CLIENT_ID": "warp-agent",
        "MCP_CLIENT_TYPE": "warp",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

## Usage

### Available Tools

The MCP server provides the following tools:

#### 1. `get_secret`
Retrieve a secret from mykeys.zip

**Parameters:**
- `ecosystem` (string): Ecosystem name (e.g., "shared", "myl", "agents")
- `secret_name` (string): Name of the secret

**Example:**
```typescript
// In Cursor or Warp agent
const secret = await mcp.callTool('get_secret', {
  ecosystem: 'shared',
  secret_name: 'stripe-secret-key'
});
```

#### 2. `store_secret`
Store a secret in mykeys.zip (automatically syncs to all clients)

**Parameters:**
- `ecosystem` (string): Ecosystem name
- `secret_name` (string): Name of the secret
- `secret_value` (string): Value of the secret
- `description` (string, optional): Description of the secret

**Example:**
```typescript
await mcp.callTool('store_secret', {
  ecosystem: 'shared',
  secret_name: 'new-api-key',
  secret_value: 'sk_live_...',
  description: 'API key for new service'
});
```

#### 3. `list_secrets`
List all secrets in an ecosystem

**Parameters:**
- `ecosystem` (string): Ecosystem name

**Example:**
```typescript
const secrets = await mcp.callTool('list_secrets', {
  ecosystem: 'shared'
});
```

#### 4. `sync_credentials`
Manually trigger credential sync to all connected clients

**Parameters:**
- `ecosystem` (string, optional): Specific ecosystem to sync (syncs all if not provided)

**Example:**
```typescript
await mcp.callTool('sync_credentials', {
  ecosystem: 'shared'
});
```

#### 5. `register_client`
Register a client for credential syncing

**Parameters:**
- `client_id` (string): Unique client identifier
- `client_type` (string): "cursor", "warp", or "other"
- `capabilities` (array, optional): List of client capabilities

**Example:**
```typescript
await mcp.callTool('register_client', {
  client_id: 'my-custom-agent',
  client_type: 'other',
  capabilities: ['read', 'write']
});
```

### Resources

Credentials are also available as MCP resources:

- `mykeys://shared/stripe-secret-key`
- `mykeys://myl/google-oauth-client-id`
- `mykeys://agents/openai-api-key`

Access resources using:
```typescript
const resource = await mcp.readResource('mykeys://shared/stripe-secret-key');
```

## Credential Sync Flow

1. **Client Registration**: When Cursor or Warp connects, it registers itself with the MCP server
2. **Credential Storage**: When a credential is stored via `store_secret`, it's cached locally
3. **Sync Trigger**: The server automatically syncs credentials to all registered clients
4. **Client Update**: Each client receives updated credentials and can use them immediately

## Security Considerations

1. **Authentication**: All requests to mykeys.zip API require Basic Auth credentials
2. **Environment Variables**: Store `MYKEYS_PASS` securely, never commit to git
3. **Client Isolation**: Each client has its own client ID and sync tracking
4. **Encryption**: Credentials are encrypted at rest in Google Cloud Secret Manager

## Troubleshooting

### MCP Server Not Starting

1. Check Node.js version: `node --version` (requires >= 18)
2. Verify dependencies: `npm install`
3. Check build output: `npm run build`
4. Verify environment variables are set correctly

### Credentials Not Syncing

1. Verify `MCP_SYNC_ENABLED` is set to `"true"`
2. Check client registration: Use `register_client` tool
3. Verify mykeys.zip API connectivity: Check `MYKEYS_URL` and credentials
4. Check MCP server logs for errors

### Cursor/Warp Not Connecting

1. Verify MCP server path is correct (use absolute paths)
2. Check Cursor/Warp MCP settings are saved correctly
3. Restart Cursor/Warp after configuration changes
4. Check for conflicting MCP server configurations

## Development

### Running in Development Mode

```bash
npm run mcp:dev
```

This will watch for file changes and automatically restart the server.

### Testing MCP Server

You can test the MCP server using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/mcp-server.js
```

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Cursor    │────────▶│  MCP Server  │────────▶│ mykeys.zip  │
│   Agent     │         │              │         │     API      │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
┌─────────────┐               │                   ┌─────────────┐
│    Warp     │───────────────┘                   │   GCP       │
│   Agent     │                                   │   Secret    │
└─────────────┘                                   │   Manager   │
                                                  └─────────────┘
```

## Environment Variables

- `MYKEYS_URL`: mykeys.zip API URL (default: `https://mykeys.zip`)
- `MYKEYS_USER`: API username (default: `admin`)
- `MYKEYS_PASS`: API password (required)
- `MCP_CLIENT_ID`: Unique identifier for this client
- `MCP_CLIENT_TYPE`: Client type (`cursor`, `warp`, or `other`)
- `MCP_SYNC_ENABLED`: Enable credential syncing (`true` or `false`)

## License

MIT






