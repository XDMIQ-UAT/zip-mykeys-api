# How to Update Your MCP Server to Get New Tools

## Current Situation

Your MCP server is running the **old version** (`mcp-server.js`). The new tools (rings, vault, discovery) won't appear until you update.

## Quick Update Steps

### Step 1: Update MCP Server

Run this command in your terminal:

```bash
mykeys mcp update
```

This will:
- ✅ Download the latest `mcp-server.js`
- ✅ Backup your current file
- ✅ Replace with the new version

### Step 2: Restart Cursor

**Important**: You must restart Cursor for the new tools to appear:

1. Close Cursor completely
2. Reopen Cursor
3. The new tools will now be available

## What You'll See After Update

After updating and restarting, you'll see these **new tools** in Cursor:

### Ring Management
- `list_rings` - List all rings
- `get_ring` - Get ring details
- `discover_rings` - Discover rings in ecosystem

### Key Management
- `list_ring_keys` - List keys in a ring

### Privacy Vault
- `store_vault_secret` - Store personal vault secret
- `get_vault_secret` - Get vault secret
- `list_vault_secrets` - List vault secrets

### Server Info
- `get_server_info` - Get server version and capabilities
- `check_updates` - Check for updates

## Alternative: Manual Update

If the CLI command doesn't work:

1. **Download**: Visit `https://mykeys.zip/mcp-server.js`
2. **Replace**: Copy to `c:\users\dash\.mykeys\mcp-server.js`
3. **Restart**: Close and reopen Cursor

## Verify Update Worked

After restarting Cursor, you should see:
- More tools in the MCP server panel
- Tools like `list_rings`, `store_vault_secret`, etc.
- Server version 2.0.0 (check with `get_server_info` tool)

## Troubleshooting

### Tools Still Not Showing

1. **Check file location**: Verify `c:\users\dash\.mykeys\mcp-server.js` exists
2. **Check version**: Run `mykeys mcp check` to see current version
3. **Restart Cursor**: Make sure Cursor is fully restarted (not just reloaded)
4. **Check MCP config**: Verify `mcp.json` points to correct file path

### Update Command Fails

```bash
# Check if script exists
ls scripts/mcp-update.js

# Run manually
node scripts/mcp-update.js

# Or download directly
curl -o ~/.mykeys/mcp-server.js https://mykeys.zip/mcp-server.js
```

## Summary

- ✅ **Update**: Run `mykeys mcp update`
- ✅ **Restart**: Close and reopen Cursor
- ✅ **Verify**: Check for new tools in MCP panel

The new tools will appear automatically after updating and restarting!


