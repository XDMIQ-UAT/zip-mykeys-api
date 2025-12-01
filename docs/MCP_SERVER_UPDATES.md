# MCP Server Updates

## Overview

**MCP services do NOT automatically discover new API endpoints.** They require **manual updates** to expose new features as MCP tools and resources.

## Current Status

### ✅ Updated MCP Server (`mcp-server.ts`)

The MCP server has been updated to include all new features:

#### Tools Added:
- ✅ `list_rings` - List all rings
- ✅ `get_ring` - Get ring details
- ✅ `list_ring_keys` - List keys in a ring
- ✅ `store_vault_secret` - Store privacy vault secret
- ✅ `get_vault_secret` - Get privacy vault secret
- ✅ `list_vault_secrets` - List vault secrets for a key
- ✅ `discover_rings` - Discover rings in ecosystem

#### Existing Tools:
- ✅ `get_secret` - Get secret from ecosystem
- ✅ `store_secret` - Store secret in ecosystem
- ✅ `list_secrets` - List secrets in ecosystem
- ✅ `sync_credentials` - Sync credentials to clients
- ✅ `register_client` - Register client for syncing

#### Resources Added:
- ✅ `mykeys://ring/{ring_id}` - Access ring information
- ✅ `mykeys://ring/{ring_id}/keys` - Access ring keys

#### Existing Resources:
- ✅ `mykeys://{ecosystem}/{secret_name}` - Access secrets

## How MCP Tools Work

MCP tools are **manually registered** in the server initialization:

```typescript
server.registerTool(
  'tool_name',
  {
    title: 'Tool Title',
    description: 'Tool description',
    inputSchema: { /* JSON schema */ },
  },
  async (args) => {
    // Tool implementation - calls API endpoints
    const response = await axios.get(`${MYKEYS_URL}/api/endpoint`, {
      headers: { 'Authorization': getAuthHeader() },
    });
    return { content: [{ type: 'text', text: 'result' }] };
  }
);
```

## When to Update MCP Server

Update the MCP server when:

1. **New API endpoints are added** - Add corresponding MCP tools
2. **New features are implemented** - Expose via MCP tools/resources
3. **API changes** - Update tool implementations to match new API
4. **New resource types** - Register new resource templates

## Updating Process

### Step 1: Add Tool Registration

```typescript
server.registerTool(
  'new_feature',
  {
    title: 'New Feature',
    description: 'Description of new feature',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter 1' },
      },
      required: ['param1'],
    },
  },
  async ({ param1 }) => {
    // Call API endpoint
    const response = await axios.post(
      `${MYKEYS_URL}/api/new-endpoint`,
      { param1 },
      { headers: { 'Authorization': getAuthHeader() } }
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data) }],
    };
  }
);
```

### Step 2: Add Resource (if applicable)

```typescript
server.registerResource(
  'mykeys-new-resource',
  new ResourceTemplate('mykeys://new/{id}', { list: undefined }),
  {
    title: 'New Resource',
    description: 'Description',
  },
  async (uri, { id }) => {
    const response = await axios.get(`${MYKEYS_URL}/api/resource/${id}`, {
      headers: { 'Authorization': getAuthHeader() },
    });
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(response.data),
      }],
    };
  }
);
```

### Step 3: Rebuild MCP Server

```bash
npm run build:mcp
# or
npx tsx mcp-server.ts
```

## Available MCP Tools

### Secret Management
- `get_secret` - Get secret from ecosystem
- `store_secret` - Store secret in ecosystem
- `list_secrets` - List secrets in ecosystem

### Ring Management
- `list_rings` - List all rings
- `get_ring` - Get ring details
- `discover_rings` - Discover rings in ecosystem

### Key Management
- `list_ring_keys` - List keys in a ring

### Privacy Vault
- `store_vault_secret` - Store vault secret (personal/sacred)
- `get_vault_secret` - Get vault secret
- `list_vault_secrets` - List vault secrets

### Client Management
- `sync_credentials` - Sync credentials to clients
- `register_client` - Register client for syncing

## MCP Resources

### Secret Resources
- `mykeys://{ecosystem}/{secret_name}` - Access secret

### Ring Resources
- `mykeys://ring/{ring_id}` - Access ring information
- `mykeys://ring/{ring_id}/keys` - Access ring keys

## Testing MCP Tools

### Using MCP Client

```bash
# List available tools
mcp-client list-tools

# Call a tool
mcp-client call-tool list_rings

# Access a resource
mcp-client read-resource mykeys://ring/ring-123
```

### Using Cursor/Warp

MCP tools are automatically available in Cursor and Warp when the MCP server is configured in `mcp.json`.

## Summary

- ❌ **Automatic Discovery**: MCP servers do NOT automatically discover API endpoints
- ✅ **Manual Updates**: MCP tools must be manually registered
- ✅ **Updated**: MCP server now includes all new features (rings, keys, vaults)
- ✅ **Ready**: All features are accessible via MCP tools

## Related Files

- `mcp-server.ts` - MCP server implementation
- `public/mcp-server.js` - Compiled MCP server
- `docs/CLI_WEB_UI_COVERAGE.md` - CLI and Web UI coverage
- `docs/KEY_MANAGEMENT_MODEL.md` - Key management model



