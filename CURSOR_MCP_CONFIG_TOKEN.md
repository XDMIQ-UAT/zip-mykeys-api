# Cursor MCP Configuration with Token Authentication

## 🔐 Secure Token-Based Setup

Instead of sharing your admin password, use a secure token generated from the web interface.

## Step 1: Generate Token

1. **Go to:** `https://mykeys.zip/generate-token.html`
2. **Enter:**
   - Admin Username: `admin`
   - Admin Password: Your admin password
   - Client ID: `cursor-agent` (or any unique identifier)
   - Client Type: `Cursor`
   - Expires In: `90` days (or your preference)
3. **Click:** "Generate Token"
4. **Copy the token** - it will not be shown again!

## Step 2: Configure Cursor

Add this to your Cursor MCP settings:

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
        "MCP_TOKEN": "YOUR_GENERATED_TOKEN_HERE",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

**Replace `YOUR_GENERATED_TOKEN_HERE` with the token you copied from Step 1.**

## Configuration Locations

### Windows
`%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

### macOS
`~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

### Linux
`~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

## Alternative: Via Cursor Settings UI

1. Open Cursor Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "MCP" or "Model Context Protocol"
3. Click "Edit MCP Settings"
4. Add the configuration above

## Security Benefits

✅ **No password sharing** - Tokens are scoped and can be revoked  
✅ **Expiration dates** - Tokens expire automatically  
✅ **Per-client tokens** - Each client (Cursor, Warp) gets its own token  
✅ **Revocable** - Revoke tokens without changing admin password  

## Token Management

### Validate Token
```bash
curl -X POST https://mykeys.zip/api/mcp/token/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN"}'
```

### Revoke Token (requires admin auth)
```bash
curl -X POST https://mykeys.zip/api/mcp/token/revoke \
  -u admin:YOUR_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN"}'
```

## Troubleshooting

### Token Not Working

1. **Verify token is valid:**
   ```bash
   curl -X POST https://mykeys.zip/api/mcp/token/validate \
     -H "Content-Type: application/json" \
     -d '{"token": "YOUR_TOKEN"}'
   ```

2. **Check token expiration:**
   - Tokens expire after the number of days you specified
   - Generate a new token if expired

3. **Verify MCP server path:**
   - Make sure `E:\\zip-myl-mykeys-api\\dist\\mcp-server.js` exists
   - Build if needed: `cd E:\zip-myl-mykeys-api && npm run build`

### MCP Server Not Starting

1. Check Node.js: `node --version` (needs >= 18)
2. Verify file exists: `ls E:\zip-myl-mykeys-api\dist\mcp-server.js`
3. Check Cursor logs for errors

## Example: Complete Configuration

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
        "MCP_TOKEN": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

## Next Steps

1. ✅ Generate token at `https://mykeys.zip/generate-token.html`
2. ✅ Add configuration to Cursor
3. ✅ Restart Cursor
4. ✅ Test: "Get the stripe-secret-key from the shared ecosystem"





