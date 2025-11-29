# Cursor MCP Configuration for MyKeys.zip

## Quick Setup

Add this configuration to your Cursor MCP settings file.

### Windows Location
`%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

Or via Cursor Settings:
1. Open Cursor Settings (Ctrl+,)
2. Search for "MCP" or "Model Context Protocol"
3. Click "Edit MCP Settings" or "Configure MCP Servers"
4. Add the configuration below

### macOS/Linux Location
`~/.cursor/mcp.json` or `~/.config/Cursor/mcp.json`

## Configuration Code

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
        "MYKEYS_PASS": "XRi6TgSrwfeuK8taYzhknoJc",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

## Alternative: Using tsx (for development)

If you want to run TypeScript directly without building:

```json
{
  "mcpServers": {
    "mykeys-zip": {
      "command": "npx",
      "args": [
        "tsx",
        "E:\\zip-myl-mykeys-api\\mcp-server.ts"
      ],
      "env": {
        "MYKEYS_URL": "https://mykeys.zip",
        "MYKEYS_USER": "admin",
        "MYKEYS_PASS": "XRi6TgSrwfeuK8taYzhknoJc",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

## Path Adjustments

### Windows
- Use forward slashes or escaped backslashes: `E:\\zip-myl-mykeys-api\\dist\\mcp-server.js`
- Or use forward slashes: `E:/zip-myl-mykeys-api/dist/mcp-server.js`

### macOS/Linux
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
        "MYKEYS_PASS": "YOUR_PASSWORD_HERE",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

## Security Note

⚠️ **Important**: Replace `MYKEYS_PASS` with your actual password. Consider using environment variables or a secrets manager for production.

## Verification

After adding the configuration:

1. Restart Cursor
2. Open Cursor's AI chat
3. Try using the MCP tools:
   - "Get the stripe-secret-key from the shared ecosystem"
   - "List all secrets in the shared ecosystem"
   - "Store a new secret called test-key with value test-value in the shared ecosystem"

## Troubleshooting

### MCP Server Not Starting

1. Check Node.js is installed: `node --version` (needs >= 18)
2. Verify the path to `mcp-server.js` is correct
3. Check if the file exists: `ls E:\zip-myl-mykeys-api\dist\mcp-server.js`
4. Build the project: `cd E:\zip-myl-mykeys-api && npm run build`

### Credentials Not Working

1. Verify `MYKEYS_URL` is accessible
2. Check `MYKEYS_USER` and `MYKEYS_PASS` are correct
3. Test the API directly:
   ```bash
   curl -u admin:YOUR_PASSWORD https://mykeys.zip/api/v1/health
   ```

### Cursor Not Recognizing MCP Server

1. Check Cursor's MCP settings file exists
2. Verify JSON syntax is valid (use a JSON validator)
3. Restart Cursor completely
4. Check Cursor's developer console for errors (Help → Toggle Developer Tools)

## Available Tools

Once configured, Cursor agents can use these tools:

- `get_secret` - Get a secret from mykeys.zip
- `store_secret` - Store a secret (auto-syncs to all clients)
- `list_secrets` - List all secrets in an ecosystem
- `sync_credentials` - Manually sync credentials
- `register_client` - Register this client for syncing

## Example Usage in Cursor

```
User: Get the Stripe secret key from mykeys.zip

Agent: [Uses get_secret tool]
       Retrieved: sk_live_... (truncated for security)

User: Store a new API key for my service

Agent: [Uses store_secret tool]
       Stored successfully. Credentials synced to all connected clients.
```





