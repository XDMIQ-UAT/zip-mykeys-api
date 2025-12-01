# 🔧 Fix Cursor MCP Configuration

## Problem

Cursor is trying to run `E:\zip-myl-mykeys-api\dist\mcp-server.js` but that file doesn't exist. The MCP server is TypeScript (`mcp-server.ts`) and needs to be run with `tsx`.

## Solution

Update your Cursor MCP configuration to use `tsx` to run the TypeScript file directly.

## Quick Fix

### Option 1: Update Cursor Settings (Recommended)

1. Open Cursor Settings → Features → Model Context Protocol
2. Find the `mykeys-zip` server configuration
3. Update it to:

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
        "MCP_TOKEN": "YOUR_GENERATED_TOKEN_HERE",
        "MCP_CLIENT_ID": "cursor-agent",
        "MCP_CLIENT_TYPE": "cursor",
        "MCP_SYNC_ENABLED": "true"
      }
    }
  }
}
```

### Option 2: Edit Config File Directly

Edit the file:
**Windows**: `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

Change:
- `"command": "node"` → `"command": "npx"`
- `"args": ["E:\\zip-myl-mykeys-api\\dist\\mcp-server.js"]` → `"args": ["tsx", "E:\\zip-myl-mykeys-api\\mcp-server.ts"]`

### Option 3: Use Config Generator

1. Go to: https://mykeys.zip/mcp-config-generator.html
2. Paste your token
3. Set MCP Server Path to: `E:\zip-myl-mykeys-api\mcp-server.ts`
4. Generate and copy the configuration
5. Paste into Cursor MCP settings

## Verify Fix

After updating:
1. Restart Cursor
2. Check MCP logs (should see successful connection)
3. Try using MCP features

## Alternative: Build TypeScript (Optional)

If you prefer compiled JavaScript:

```powershell
cd E:\zip-myl-mykeys-api
npx tsc
```

This will create `dist/mcp-server.js` and you can use the original config with `node`.

---

**Note**: Using `tsx` is recommended as it's faster for development and doesn't require a build step.






